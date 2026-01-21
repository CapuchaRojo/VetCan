Alert Lifecycle (A5.8+)
Overview

VetCan alerts follow a durable, auditable, and operator-controlled lifecycle designed to separate signal generation, delivery, and human acknowledgement without coupling any step to request handlers.

Alerts are event-driven, persisted, and retry-safe.

Lifecycle Flow
[ System Event ]
       |
       v
emitEvent(...)
       |
       v
OperationalEvent (DB)
       |
       v
Alert Engine
(thresholds / windows)
       |
       v
Alert (DB, active)
       |
       v
EscalationDelivery (pending)
       |
       v
Delivery Worker
(n8n / email / SMS)
       |
       v
[ sent | failed | retrying ]
       |
       v
Operator ACK
       |
       v
Alert acknowledged
Escalations canceled

Key Guarantees

Non-blocking
No alert persistence, escalation, or delivery can crash an API request.

Durable
All operational events and escalation attempts are stored in Postgres.

Idempotent
Escalations use a deterministic dedupeKey to prevent duplicate deliveries.

Observable
Ops Dashboard shows:

Active alerts

Delivery status (pending / sent / failed / canceled)

Attempt counts and timestamps

Operator-controlled
Acknowledging an alert:

Marks the alert as acknowledged

Cancels all pending or failed escalations

Emits an alert_acknowledged event for auditability

Responsibilities by Component
Component	Responsibility
emitEvent	Fire-and-forget event emission
Alert Engine	Threshold evaluation and alert creation
OperationalEvent	Immutable event audit trail
Alert	Human-relevant incident
EscalationDelivery	Delivery state machine
Delivery Worker	Retry logic + backoff
Ops Dashboard	Read-only operational visibility
ACK Endpoint	Human resolution and shutdown signal
Design Principle

Alerts are facts. Escalations are attempts. Acknowledgement is authority.

This separation allows VetCan to scale alerts safely without alert storms, duplicate notifications, or operator confusion.