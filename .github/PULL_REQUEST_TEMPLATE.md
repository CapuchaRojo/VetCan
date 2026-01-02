# 🚀 VetCan Pull Request

## Summary
<!--
Briefly describe what this PR does and why.
Focus on business value and system impact.
-->

---

## Type of Change
_Check all that apply:_
- [ ] 🐛 Bug fix (non-breaking change)
- [ ] ✨ New feature
- [ ] 🔧 Refactor / cleanup
- [ ] 🧪 Tests
- [ ] 📚 Documentation
- [ ] 🚨 Security / compliance-related change
- [ ] 🏗 Infrastructure / DevOps
- [ ] 🔌 Telephony integration (Twilio / RingCentral)
- [ ] 📊 Analytics / Reporting

---

## Related Issue / Ticket
<!--
Link the issue, ticket, or discussion this PR addresses.
Example: Fixes #42
-->
- Closes #

---

## Scope of Changes
_Which parts of the system are affected?_
- [ ] API (backend)
- [ ] Web (admin UI)
- [ ] Worker / queues
- [ ] Database / Prisma schema
- [ ] Telephony / IVR
- [ ] CI/CD
- [ ] Documentation

---

## Implementation Details
<!--
Explain HOW the change works.
Include:
- Key logic decisions
- New models / endpoints
- Queue behavior
- Telephony flows
-->
- 

---

## Security & Compliance Checklist
_Required for any change touching patient, call, or campaign data._

- [ ] No secrets committed
- [ ] Auth / RBAC enforced where required
- [ ] Input validation added or confirmed
- [ ] Webhooks verified (if applicable)
- [ ] Audit logging considered (if applicable)
- [ ] PHI exposure reviewed

---

## Telephony-Specific Checklist (if applicable)
- [ ] Webhook endpoints are idempotent
- [ ] Twilio/RingCentral signatures verified
- [ ] Retry behavior handled safely
- [ ] Call status callbacks tested
- [ ] DNC logic respected

---

## Database Changes
- [ ] No DB changes
- [ ] Prisma schema updated
- [ ] Migration included
- [ ] Backward compatibility considered

_Migration name:_  
`prisma/migrations/<migration_name>`

---

## Testing
_Check all that apply:_
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] Webhook behavior tested with provider simulator
- [ ] Campaign / queue flow tested

### How to Test Locally
```bash
# Example
docker-compose up --build
npm run test
