# Incident playbook

> Part of the launch packet (plan Section 17.5). Signed by DevOps / SRE and Architect.

## Severity levels

- **P0 — Security or data**: cross-tenant read/write, credential leak, service down > 15 minutes. Page on-call immediately.
- **P1 — Degraded service**: submit success < 92% for 1h, apply latency p95 > 240s, queue backlog > 100 rows for > 30min. Same-day response.
- **P2 — Cosmetic**: UI bugs, stale banner copy, slow non-critical pages. Next sprint.

## On-call

- Days 0–14 post-launch: maintainer (Sijoy) on-call 24/7 via Telegram bot notifications and Pingdom SMS.
- Days 15+: TODO rotation schedule.
- Escalation: if on-call has not acknowledged a P0 within 10 minutes, escalate to Architect; if within 20 minutes no ack, disable writes via `FEATURE_*` kill-switches (see [rollback.md](rollback.md)).

## Incident doc template

```markdown
# Incident <short slug> — <YYYY-MM-DD>

Severity: P0 | P1 | P2
Status:   open | mitigated | closed
On-call:  <handle>

## Impact
<user-visible symptoms, number of users affected, duration>

## Timeline (UTC)
- HH:MM  First signal
- HH:MM  On-call paged
- HH:MM  Mitigation applied
- HH:MM  All clear

## Root cause
<technical cause>

## Action items
- [ ] <owner> — <action> — <due>
```

## Postmortem cadence

P0 + P1: postmortem within 72h, published to the internal docs site. Blameless.

## Signoff

- DevOps / SRE: _TODO_
- Architect: _TODO_
