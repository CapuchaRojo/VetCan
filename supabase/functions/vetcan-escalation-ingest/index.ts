// supabase/functions/vetcan-escalation-ingest/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      correlation_id,
      data = {},
      occurred_at,
    } = payload ?? {};

    if (!event_type || !severity) {
      return new Response(
        JSON.stringify({ error: "event_type and severity are required" }),
        { status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing Supabase env vars");
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500 }
      );
    }

    // ✅ IMPORTANT: inject fetch explicitly
    const supabase = createClient(supabaseUrl, serviceKey, {
      global: { fetch },
    });

    const now = occurred_at ? new Date(occurred_at) : new Date();

    const { error } = await supabase
      .from("operational_events")
      .insert({
        event_name: event_type,
        severity,
        source,
        correlation_id,
        payload: data,
        occurred_at: now.toISOString(),
      });

    if (error) {
      console.error("Insert failed:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }

    const n8nUrl = Deno.env.get("N8N_INGEST_WEBHOOK_URL");
    if (n8nUrl) {
      fetch(n8nUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "vetcan.operational_event",
          emitted_at: new Date().toISOString(),
          event: {
            event_type,
            severity,
            source,
            correlation_id,
            occurred_at: now.toISOString(),
            data,
          },
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled edge error:", err);
    return new Response(
      JSON.stringify({ error: "Unhandled edge error" }),
      { status: 500 }
    );
  }
});
