// supabase/functions/vetcan-escalation-ingest/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* -------------------- helpers -------------------- */

function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return `[${obj.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",")}}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function minuteBucket(iso: string): string {
  return String(Math.floor(Date.parse(iso) / 60000));
}

function buildDedupeMaterial(input: {
  event_type: string;
  severity: string;
  source: string;
  correlation_id: string | null;
  occurred_at: string;
  data: any;
}) {
  return stableStringify({
    event_type: input.event_type,
    severity: input.severity,
    source: input.source,
    correlation_id: input.correlation_id,
    occurred_at_minute: minuteBucket(input.occurred_at),
    identity: {
      phone: typeof input.data?.phone === "string" ? input.data.phone : null,
    },
  });
}

function fireAndForget(url: string, body: any) {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/* -------------------- handler -------------------- */

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const payload = await req.json();

    const {
      event_type,
      severity,
      source = "vetcan-api",
      correlation_id = null,
      data = {},
      occurred_at,
    } = payload ?? {};

    if (!event_type || !severity) {
      return new Response(
        JSON.stringify({ ok: false, error: "event_type and severity are required" }),
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

    const occurredAtIso = occurred_at
      ? new Date(occurred_at).toISOString()
      : new Date().toISOString();

    /* -------- A6.3.4: deterministic dedupe key -------- */

    const dedupeMaterial = buildDedupeMaterial({
      event_type,
      severity,
      source,
      correlation_id,
      occurred_at: occurredAtIso,
      data,
    });

    const dedupe_key = await sha256Hex(dedupeMaterial);

    /* -------- Idempotent event insert -------- */

    const insertAttempt = await supabase
      .from("operational_events")
      .insert({
        event_name: event_type,
        severity,
        source,
        correlation_id,
        payload: data,
        occurred_at: occurredAtIso,
        dedupe_key,
      })
      .select("id")
      .maybeSingle();

    let event_id = insertAttempt.data?.id ?? null;
    const inserted = Boolean(event_id);

    if (!event_id) {
      const existing = await supabase
        .from("operational_events")
        .select("id")
        .eq("dedupe_key", dedupe_key)
        .maybeSingle();

      event_id = existing.data?.id ?? null;
    }

    if (!event_id) {
      console.error("Failed to persist or recover event");
      return new Response(
        JSON.stringify({ ok: false, error: "persist_failed" }),
        { status: 500 }
      );
    }

    /* -------- Ensure initial lifecycle state (open) -------- */

    await supabase
      .from("operational_event_state_transitions")
      .upsert(
        {
          event_id,
          state: "open",
          transitioned_at: occurredAtIso,
          resolved_by: "automation",
          source: "ingest",
          idempotency_key: `open:${event_id}`,
        },
        {
          onConflict: "idempotency_key",
          ignoreDuplicates: true,
        }
      );

    /* -------- At-most-once n8n dispatch -------- */

    const ledgerInsert = await supabase
      .from("operational_event_dispatches")
      .insert({
        event_id,
        target: "n8n",
        status: "sent",
      })
      .select("id")
      .maybeSingle();

    const dispatched = Boolean(ledgerInsert.data?.id);

    if (dispatched) {
      const n8nUrl = Deno.env.get("N8N_INGEST_WEBHOOK_URL");
      if (n8nUrl) {
        fireAndForget(n8nUrl, {
          type: "vetcan.operational_event",
          emitted_at: new Date().toISOString(),
          event_id,
          dedupe_key,
          event: {
            event_type,
            severity,
            source,
            correlation_id,
            occurred_at: occurredAtIso,
            data,
          },
        });
      }
    }

    /* -------- Deterministic response -------- */

    return new Response(
      JSON.stringify({
        ok: true,
        event_id,
        inserted,
        deduped: !inserted,
        dispatched,
        dedupe_key,
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
