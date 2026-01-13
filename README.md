VetCan

VetCan is a lightweight, clinic-style CRM and automation platform designed for regulated callback, renewal, scheduling, and follow-up workflows, including medical cannabis and adjacent industries.

It focuses on one core outcome:

Reduce missed callbacks and renewals without adding staff — safely, visibly, and compliantly.

⚠️ Compliance & Scope Disclaimer

VetCan is HIPAA-aware but NOT a HIPAA compliance guarantee.

No Protected Health Information (PHI) is required for core workflows

AI handling is restricted to non-medical routing and triage

AI never provides medical advice

Any production deployment involving patient data requires independent legal, security, and compliance review

VetCan is intentionally designed to avoid PHI whenever possible.

⚠️ Prisma & Execution Environment Notes (Important)

This repository pins Prisma v5.22.0.

Some execution environments (including certain AI sandboxes and restricted containers) force-install newer Prisma versions or restrict filesystem / socket access, which can cause false negatives.

✅ Local development and GitHub Actions CI are the source of truth
❌ Do not rely on restricted execution environments for validation

🧪 Testing & Environment Limitations (Important)
API Integration Tests

VetCan includes a comprehensive API test suite using Jest + Supertest.

However, some sandboxed or restricted environments forbid socket operations entirely, resulting in EPERM errors when running API integration tests — even when production code is correct.

In such environments:

API tests cannot execute

Production behavior is unaffected

Dashboards, metrics, and live API endpoints continue to function correctly

Official Testing Guidance

✅ Run API tests in:

GitHub Actions CI

A permissive local environment

A non-restricted Docker host

❌ Do not treat EPERM failures in restricted environments as code defects

This is a known and documented limitation, not a system instability.

What You Can Demo in ~60 Seconds

VetCan is built to demo cleanly and convincingly:

API health & uptime

Callback intake

AI-assisted callback handling

Automatic escalation when medical language is detected

Real-time admin dashboard updates

No page refresh required.

Demo, Simulation, and Production Modes

VetCan deliberately separates presentation, testing, and production behavior to prevent data contamination and ensure compliance.

🟦 Demo Mode (Non-Persistent)

Purpose: Sales demos, UI walkthroughs, investor presentations
How: ?demo=true or DEMO_MODE=true

❌ No database writes

❌ No state mutations

❌ No PHI risk

✅ Returns realistic, synthetic responses

✅ UI updates locally only

Demo mode is visually indistinguishable from real operation, but leaves zero footprint.

🟨 Simulation Mode (Persistent, Test-Safe)

Purpose: Local development, CI verification
How: NODE_ENV=test or AI_CALLBACK_SIMULATION=true

✅ Writes to database

✅ Enforces compliance-safe summaries

❌ Never stores medical details or PHI

✅ Used by the Jest test suite

Simulation mode proves guardrails under real persistence.

🟥 Real Execution Mode (Production)

Purpose: Live clinic operations

✅ Twilio voice / SMS (provider-abstracted)

✅ Staff notifications

✅ Auditable records

🔒 Requires legal + security review for regulated use

Live Demo Flow

A callback request is created (API or UI)

AI attempts to handle the callback

If medical language is detected:

The callback is escalated to staff

The AI stops immediately

The admin dashboard updates in real time

Once escalated, AI cannot re-enter the callback.

Architecture (MVP)
api/     Express + TypeScript API (Prisma + Postgres)
web/     Admin dashboard (React + Vite)
worker/  Background jobs / automation runner
infra/   Dockerfiles & compose configs
db/      Postgres 15
redis/   Redis 7 (queues + lightweight caching)

Core Concepts
Callback Lifecycle

Callbacks move through a strict, auditable lifecycle:

pending

completed (AI handled successfully)

needs_staff (medical language detected)

Once a callback leaves pending, it cannot be reprocessed.

This prevents:

double-calling

AI re-entry

compliance drift

AI Safety Guardrails

AI never provides medical advice

AI immediately escalates on medical language

Escalation permanently halts AI handling

These guardrails are enforced at the API layer, not the UI.

Quick Start (Local)
1) Configure environment
cp .env.example .env


Fill in required values (DB credentials, ports, etc).

2) Build & run
docker compose up --build -d

3) Verify API health
curl http://localhost:4000/health


Expected:

{
  "status": "ok",
  "service": "vetcan-api",
  "uptime": 12.34,
  "timestamp": "..."
}

4) Open the UI

Web UI: http://localhost:5173

API: http://localhost:4000

Demo-Friendly Endpoints
Method	Endpoint	Purpose
GET	/health	API health + uptime
GET	/api/callbacks	List callbacks
POST	/api/callbacks	Create callback
POST	/api/callbacks/:id/ai-call	Trigger AI handling (simulation supported)
GET	/api/internal/metrics	Internal metrics & alerts
Milestones
v0.1 — Stable Baseline ✅

Dockerized stack

Health endpoint

Admin dashboard

CI passing

v0.2 — Golden Flow Demo ✅

Callback intake

AI simulation

Medical escalation

Real-time UI updates

v0.3 — Voice & SMS Integration (Planned)

Twilio provider

Inbound/outbound hooks

Message templates & logs

Providers are abstracted to allow alternatives.

License

See LICENSE.

Contact / Ownership

VetCan is being built as a milestone-driven MVP for real-world operators.

If you’re evaluating it for a regulated clinic or renewal workflow, the best next step is a live demo of the callback → AI → escalation loop.