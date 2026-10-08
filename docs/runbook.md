# Runbook (GATE-REL-01, GATE-OPS-01)

> Owners: Backend Engineer + DevOps / SRE. Status: `not_started`.

## Queue lease

- Table: `public.job_runs`
- Leasing: `UPDATE ... SET status='running', locked_by=<worker_id>, locked_at=now() WHERE status='queued' RETURNING *` via `SELECT ... FOR UPDATE SKIP LOCKED`
- Lease TTL: **15 minutes**. A reaper sweeps rows where `status='running' AND locked_at < now() - interval '15 minutes'` and returns them to `queued` (increment `attempt`).

## Retry policy

- Max attempts: **3** (`job_runs.attempt`)
- Backoff: exponential — 1 minute, 4 minutes, 16 minutes, then dead-letter
- Transient errors (5xx, timeout, network): retryable
- Terminal errors (4xx from ATS, validation failure): no retry, straight to `error`

## Dead-letter

- On attempt > 3 OR terminal error: `status='dead_letter'`, `error_msg` populated
- Weekly admin review of dead-letter rows; manual replay via admin tool (Phase 5)
- Outbound n8n dispatch failures also land here with `kind='email_scan'` and metadata linking to the source event

## Incident response

- P0 (data leak, cross-tenant breach, service down >15 min): page on-call immediately; create incident doc using [incident-playbook.md](incident-playbook.md)
- P1 (degraded service, quota exhaustion): same day, during business hours
- P2 (cosmetic bug): next sprint
- Communication: banner in `/app`, status page, Telegram bot

## On-call rotation

- First 14 days post-launch: maintainer is on-call 24/7
- Post-launch: TODO rotation schedule once there are multiple engineers
