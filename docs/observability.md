# Observability (GATE-OBS-01)

> Owners: DevOps / SRE + Backend Engineer. Status: `not_started`.

## Metrics

Minimum set the worker publishes (Phase 4 onward):

- `job_runs_success_rate` — completed / total in trailing 24h
- `apply_latency_p50_seconds` — median `finished_at - started_at` for `kind='apply'`
- `apply_latency_p95_seconds` — p95 same
- `upload_failure_rate` — fraction of applications with `upload_pending=true` not cleared within 10 min
- `n8n_outbound_failure_rate` — dispatcher failure counter / total attempts
- `trial_quota_burn_rate_per_hour` — rows inserted into `trial_quota_log` per hour

## Error triage

- Error sink: Supabase Logs (free tier) for Vercel + Fly.io + Postgres; optional Sentry upgrade post-launch.
- Every `error` row in `application_events` is mirrored to worker logs with the `application_id` tag for quick correlation.
- Dead-letter queue (`job_runs.status='dead_letter'`) reviewed weekly; anything older than 7 days triggers an alert.

## Alerts

| Alert | Threshold | Action |
|---|---|---|
| Submit success rate low | < 92% for 1h | Page on-call (P1) |
| Apply latency p95 high | > 240s for 1h | Page on-call (P2) |
| n8n delivery rate low | < 99% for 1h | Auto-create incident doc |
| Cross-tenant read violation | any | Page on-call (P0) |
| Storage ≥ 80% | any | Banner in `/app`; email maintainer |

Alert thresholds here must match plan Section 17.4 KPI minimums.
