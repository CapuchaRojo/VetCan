# VetCan


VetCan is a full-stack automation & CRM platform for medical cannabis clinics, optimized for medical marijuana patient workflows. This repo scaffold covers Phase A-F (core CRM to analytics) and is intended as a robust starting point.


VetCan/
├── README.md
├── LICENSE (MIT)
├── .gitignore
├── docker-compose.yml
├── .env.example
├── infra/
│ ├── Dockerfile.api
│ ├── Dockerfile.worker
│ ├── Dockerfile.web
│ ├── nginx.conf
│ └── scripts/wait-for.sh
├── api/
│ ├── package.json
│ ├── tsconfig.json
│ ├── prisma/schema.prisma
│ ├── src/
│ │ ├── index.ts
│ │ ├── server.ts
│ │ ├── config/env.ts
│ │ ├── db/prisma.ts
│ │ ├── routes/*
│ │ ├── controllers/*
│ │ ├── services/*
│ │ ├── middleware/*
│ │ └── utils/*
│ └── tests/
├── worker/
│ ├── package.json
│ ├── tsconfig.json
│ └── src/
│ ├── index.ts
│ ├── queues/
│ └── processors/
├── web/
│ ├── package.json
│ ├── tsconfig.json
│ └── src/
│ ├── main.tsx
│ ├── App.tsx
│ ├── pages/
│ ├── components/
│ └── services/
├── .github/
│ ├── workflows/ci.yml
│ ├── ISSUE_TEMPLATE.md
│ └── PULL_REQUEST_TEMPLATE.md
└── scripts/
└── seed_admin.sh


## Quick start (dev)
1. Copy `.env.example` to `.env` and fill in values.
2. `docker-compose up --build`
3. `docker exec -it vetcan_api npm run migrate && docker exec -it vetcan_api npm run seed`
4. Visit http://localhost:5173 for the admin UI and http://localhost:4000/api for API.


## Phases
- Phase A: Core CRM & Appointments
- Phase B: Inbound voice flows
- Phase C: Outbound campaigns & dialer
- Phase D: Email automation
- Phase E: Security & compliance
- Phase F: Analytics & reporting


See the `docs/` folder (or this scaffold) for implementation details.


---


### `.gitignore`


# VetCan
VetCan — A HIPAA-aware full-stack automation toolkit for medical cannabis clinics: telephony &amp; contact-center agents (inbound/outbound/email), appointment &amp; patient CRM, automated campaigns, and analytics. Optimized for medical marijuana patient  workflows and secure, auditable operations.

**VetCan** is a full-stack automation & CRM platform tailored to medical cannabis (medical marijuana) clinics, with a focus on medical marijuana patient workflows. It provides modular telephony/contact-center components (Inbound Agents, Outbound Agents, Email Agents), appointment booking, secure patient data storage, analytics, and automation to dramatically reduce manual work and operating cost for small clinics.

> **Primary goals**
> - Rapid appointment booking and call routing for inbound callers  
> - Scalable outbound appointment/renewal campaigns and promos  
> - Email follow-up and lead nurturing automation  
> - Secure, auditable patient data store and role-based access control  
> - Low ops overhead; integrate with RingCentral / Twilio / CRM as needed

---

## Table of contents
- [Project scope & disclaimers](#project-scope--disclaimers)  
- [Architecture overview](#architecture-overview)  
- [Core components](#core-components)  
- [Getting started (dev)](#getting-started-dev)  
- [Database schema (proposed)](#database-schema-proposed)  
- [APIs (example endpoints)](#apis-example-endpoints)  
- [Telephony & third-party integrations](#telephony--third-party-integrations)  
- [Security & compliance notes](#security--compliance-notes)  
- [Operational runbook highlights](#operational-runbook-highlights)  
- [Monitoring, logging & backups](#monitoring-logging--backups)  
- [License recommendation](#license-recommendation)  
- [Project management & rollout plan (phased)](#project-management--rollout-plan-phased)  
- [KPIs & success metrics](#kpis--success-metrics)  
- [Contributing](#contributing)  
- [Contact / Owner info](#contact--owner-info)

---

## Project scope & disclaimers
VetCan will handle medical patient contact workflows and may process sensitive health information. This repo provides code and deployment patterns, but **you must** consult legal/compliance counsel for Florida medical cannabis & veteran data requirements and for whether HIPAA, state rules, or other statutes apply to your workflows. Treat all patient data as sensitive until counsel states otherwise.

---

## Architecture overview

High-level architecture (modular microservice-ish layout, can be deployed in a single VM for MVP):

