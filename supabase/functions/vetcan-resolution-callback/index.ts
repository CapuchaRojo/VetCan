// supabase/functions/vetcan-resolution-callback/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Allowed non-open transitions.
 * "open" is created automatically at ingest time.
 */
const ALLOWED_STATES = new Set(["acknowledged", "resolved", "failed"]);

function stableIdempotencyKey(
  eventId: string,
  state: string,
  provided?: string | null
): string {
  if (provided && provided.trim().length > 0) {
    return provided.trim();
  }
  return `${state}:${eventId}`;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Optional shared-secret auth (recommended for n8n)
    const sharedSecret = Deno.env.get("VETCAN_CALLBACK_SECRET");
    if (sharedSecret) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${sharedSecret}`) {
        return new Response(
          JSON.stringify({ ok: false, error: "unauthorized" }),
          { status: 401 }
        );
      }
    }

    const payload = await req.json().catch(() => null);
    if (!payload) {
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_json" }),
        { status: 400 }
      );
    }

    const {
      event_id,
      dedupe_key,
      state,
      resolved_by = "automation",
      transitioned_at,
      idempotency_key,
      note,
      source = "n8n",
    } = payload;

    if (!event_id || !dedupe_key || !state) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "event_id, dedupe_key, and state are required",
        }),
        { status: 400 }
      );
    }

    if (!ALLOWED_STATES.has(state)) {
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_state" }),
        { status: 400 }
      );
    }

    if (resolved_by && !["automation", "human"].includes(resolved_by)) {
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_resolved_by" }),
        { status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing Supabase env vars");
      return new Response(
        JSON.stringify({ ok: false, error: "server_misconfigured" }),
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      global: { fetch },
      auth: { persistSession: false },
    });

    // 1️⃣ Verify event exists and dedupe_key matches (ownership check)
    const { data: event, error: eventErr } = await supabase
      .from("operational_events")
      .select("id, dedupe_key")
      .eq("id", event_id)
      .maybeSingle();

    if (eventErr) {
      console.error("event lookup error", eventErr);
      return new Response(
        JSON.stringify({ ok: false, error: "lookup_failed" }),
        { status: 500 }
      );
    }

    if (!event || event.dedupe_key !== dedupe_key) {
      return new Response(
        JSON.stringify({ ok: false, error: "ownership_mismatch" }),
        { status: 404 }
      );
    }

    // 2️⃣ Check current state
    const { data: current } = await supabase
      .from("operational_event_state_current")
      .select("state")
      .eq("event_id", event_id)
      .maybeSingle();

    // Idempotent no-op
    if (current?.state === state) {
      return new Response(
        JSON.stringify({ ok: true, idempotent: true, state }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Terminal enforcement
    if (current?.state && ["resolved", "failed"].includes(current.state)) {
      return new Response(
        JSON.stringify({ ok: false, error: "terminal_state" }),
        { status: 409 }
      );
    }

    // 3️⃣ Insert transition (append-only, idempotent)
    const transitionAtIso = transitioned_at
      ? new Date(transitioned_at).toISOString()
      : new Date().toISOString();

    const idemKey = stableIdempotencyKey(
      event_id,
      state,
      idempotency_key
    );

    const { data: transition, error: insertErr } = await supabase
      .from("operational_event_state_transitions")
      .insert({
        event_id,
        state,
        transitioned_at: transitionAtIso,
        resolved_by,
        note: typeof note === "string" ? note : null,
        source,
        idempotency_key: idemKey,
      })
      .select("id")
      .maybeSingle();

    if (insertErr) {
      // Unique constraint → idempotent retry
      if (insertErr.code === "23505") {
        return new Response(
          JSON.stringify({ ok: true, idempotent: true, state }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      console.error("transition insert error", insertErr);
      return new Response(
        JSON.stringify({ ok: false, error: "transition_failed" }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        state,
        transition_id: transition?.id ?? null,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unhandled edge error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "unhandled_edge_error" }),
      { status: 500 }
    );
  }
});
