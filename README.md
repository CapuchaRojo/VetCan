# VetCan

VetCan is a lightweight, clinic-style CRM + automation platform designed for **medical cannabis workflows** (and adjacent dispensary-style operations): appointments, callbacks, follow-ups, and operational visibility — with a clear path to SMS/voice automation (Twilio-ready).

> ⚠️ **Compliance disclaimer:** VetCan is *HIPAA-aware* but **not a HIPAA compliance guarantee**. Professional legal/security review is required for any production use involving patient/health data.

---

## What you can demo in 60 seconds

- API is online and responsive: `GET /health`
- Core workflow endpoints for:
  - patient records
  - appointments
  - calls/callback requests
- Containerized deployment (repeatable, low-ops): API + DB + Redis + worker + web UI

This is built to answer one business question:
> “How do we reduce missed callbacks, missed renewals, and manual follow-ups — without adding staff?”

---

## Architecture (MVP)

- **api/** — Express + TypeScript API (Prisma + Postgres)
- **web/** — Admin UI
- **worker/** — background jobs / automation runner
- **infra/** — Dockerfiles (api/web/worker)
- **db** — Postgres 15
- **redis** — Redis 7 (queues + lightweight caching)

---

## Quick start (local)

### 1) Configure env
Copy `.env.example` → `.env` and fill in values (DB creds, keys, etc).

### 2) Build + run
```bash
docker compose up --build -d
3) Verify API health
bash
Copy code
curl http://localhost:4000/health
Expected:

json
Copy code
{"status":"ok","service":"vetcan-api","uptime":12.34,"timestamp":"..."}
4) (Optional) Migrate & seed
If your project uses migrations/seeds:

bash
Copy code
docker exec -it vetcan-api-1 npm run migrate
docker exec -it vetcan-api-1 npm run seed
Web UI (if enabled):

http://localhost:5173

API:

http://localhost:4000

Key endpoints
GET /health — service health + uptime

GET /api/patients — patients

GET /api/appointments — appointments

GET /api/calls — calls / callback records

(Exact route sets may evolve as milestones progress.)

Milestones (presentation-driven)
Milestone v0.1 — Stable baseline (✅)
Docker compose runs reliably

API health endpoint

DB + Redis + worker + web containers start cleanly

Milestone v0.2 — “Golden flow” demo (next)
One simple, sellable loop:

customer requests callback

staff sees it in UI

customer receives a notification (initially console provider; Twilio later)

Milestone v0.3 — SMS/Voice integration (Twilio-ready)
SMS notifications

optional inbound/outbound call hooks

templates + message logging

Twilio & integrations
Twilio integration is planned behind a provider interface so the system can support:

Twilio (SMS/voice)

RingCentral (later)

email providers

We will ship with a “console provider” first to keep MVP stable and demo-ready, then switch to Twilio in a single focused PR.

Testing & CI
API tests:

bash
Copy code
cd api && npm test
If CI is enabled, it should:

install API deps

run API tests

install web deps

run web tests (if present)

Notes for production hardening (later)
authentication + RBAC

audit trails for patient/call actions

encrypted secrets management

data retention rules

logging + monitoring

License
See LICENSE.

Contact / Owner
VetCan is being built as a milestone-driven MVP for real-world operators. If you’re evaluating it for a clinic/dispensary workflow, the best next step is a live demo of the callback + follow-up loop.
