// supabase/functions/vetcan-ingest/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Minimal required fields (expand later)
  const {
    eventName,
    severity = "info",
    source = "unknown",
    correlationId,
    data = {},
  } = payload ?? {};

  if (!eventName) {
    return new Response(
      JSON.stringify({ error: "eventName is required" }),
      { status: 400 }
    );
  }

  const enrichedPayload = {
    eventName,
    severity,
    source,
    correlationId: correlationId ?? crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    data,
  };

  const n8nUrl = Deno.env.get("N8N_INGEST_WEBHOOK_URL");
  if (!n8nUrl) {
    return new Response(
      JSON.stringify({ error: "N8N_INGEST_WEBHOOK_URL not set" }),
      { status: 500 }
    );
  }

  const forward = await fetch(n8nUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "VetCan-Edge-Ingest/1.0",
    },
    body: JSON.stringify(enrichedPayload),
  });

  return new Response(
    JSON.stringify({
      ok: true,
      forwarded: forward.ok,
      correlationId: enrichedPayload.correlationId,
    }),
    { status: 200 }
  );
});
