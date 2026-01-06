# VetCan

VetCan is a lightweight, clinic-style CRM and automation platform designed for **medical cannabis and adjacent regulated workflows** (callbacks, renewals, scheduling, and follow-ups).

It focuses on one core outcome:

> **Reduce missed callbacks and renewals without adding staff — safely, visibly, and compliantly.**

---

## ⚠️ Compliance & Scope Disclaimer

VetCan is **HIPAA-aware** but **NOT a HIPAA compliance guarantee**.

- No Protected Health Information (PHI) is required for core workflows
- AI handling is restricted to **non-medical routing and triage**
- Any production deployment involving patient data requires independent legal, security, and compliance review

VetCan is designed to *avoid* PHI whenever possible.

---

## ⚠️ Prisma / Cloud Execution Note (Important)

This repository pins **Prisma v5.22.0**.

Some cloud execution environments (including Codex) force-install Prisma v7+, which is incompatible.

✅ **Local development and GitHub Actions CI are the source of truth**  
❌ **Do not rely on Codex execution results for this repository**

---

## What You Can Demo in ~60 Seconds

VetCan is built to demo cleanly and convincingly:

- API health & uptime
- Callback intake
- AI-assisted callback handling
- Automatic escalation when medical questions are detected
- Real-time admin dashboard updates

### Live demo flow
1. A callback request is created (API or UI)
2. AI attempts to handle the callback
3. If a medical question is detected:
   - The callback is **escalated to staff**
   - The AI stops immediately (compliance-safe)
4. The admin dashboard updates in real time

No page refresh required.

---

## Architecture (MVP)

api/ Express + TypeScript API (Prisma + Postgres)
web/ Admin dashboard (React + Vite)
worker/ Background jobs / automation runner
infra/ Dockerfiles and compose configs
db Postgres 15
redis Redis 7 (queues + lightweight caching)


---

## Core Concepts

### Callback Lifecycle
Callbacks move through a strict, auditable lifecycle:

- `pending`
- `completed` (AI handled successfully)
- `needs_staff` (medical question detected)

Once a callback leaves `pending`, **it cannot be reprocessed**.

This prevents:
- double-calling
- AI re-entry
- compliance drift

---

### AI Safety Guardrails

AI callbacks are intentionally constrained:

- AI **never provides medical advice**
- AI **immediately escalates** if medical language is detected
- Escalation permanently halts AI handling for that callback

This behavior is enforced at the API layer.

---

## Quick Start (Local)

### 1) Configure environment
```bash
cp .env.example .env


---

## Core Concepts

### Callback Lifecycle
Callbacks move through a strict, auditable lifecycle:

- `pending`
- `completed` (AI handled successfully)
- `needs_staff` (medical question detected)

Once a callback leaves `pending`, **it cannot be reprocessed**.

This prevents:
- double-calling
- AI re-entry
- compliance drift

---

### AI Safety Guardrails

AI callbacks are intentionally constrained:

- AI **never provides medical advice**
- AI **immediately escalates** if medical language is detected
- Escalation permanently halts AI handling for that callback

This behavior is enforced at the API layer.

---

## Quick Start (Local)

### 1) Configure environment
```bash
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
Demo Mode (Non-Persistent)

VetCan supports demo-safe execution to prevent database pollution during demos.

When enabled, demo actions:

do not persist records

do not alter production-like data

still fully exercise AI and UI behavior

Demo mode is intended for sales, validation, and investor walkthroughs.

(Implementation documented in upcoming section.)

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

v0.3 — SMS / Voice Integration (Planned)

Twilio provider

Inbound/outbound call hooks

Message templates & logs

Twilio is abstracted behind a provider interface so alternatives can be added later.

Testing & CI

API tests:

cd api
npm test


CI runs:

API tests

Web build checks

Blocks failing commits

Production Hardening (Future)

Authentication & RBAC

Audit trails

Encrypted secrets

Retention policies

Monitoring & alerting

License

See LICENSE.

Contact / Ownership

VetCan is being built as a milestone-driven MVP for real-world operators.

If you’re evaluating it for a clinic or dispensary workflow, the best next step is a live demo of the callback → AI → escalation loop.
