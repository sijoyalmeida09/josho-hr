# Limits (GATE-COST-01)

> Owner: DevOps / SRE. Status: `not_started`.
> Source of truth: [../worker/config/limits.py](../worker/config/limits.py). The script `python -m worker.config.limits --print` must diff to zero against this doc.

## Per-user limits

| Constant | Value | Rationale |
|---|---|---|
| `MAX_APPS_PER_USER_PER_DAY` | 100 | Keeps Supabase free-tier DB writes under 50K/day for ~500 active users |
| `MAX_TRACE_SIZE_MB` | 10 | Playwright trace over 10 MB is discarded with an `error` event emitted |
| `MAX_RESUME_VERSIONS` | 25 | Per-user resume history retention before auto-prune |
| `MAX_EVENTS_PER_APP` | 500 | Guard against runaway event emission during a stuck submission |

## Global circuit breakers

| Constant | Value | Effect |
|---|---|---|
| `STORAGE_WARNING_PCT` | 80 | Banner warning at 80% of free-tier storage quota |
| `STORAGE_HARDSTOP_PCT` | 100 | Uploads blocked; existing data preserved |
| `WORKER_MAX_CONCURRENT_PLAYWRIGHT_SESSIONS` | 3 | Fly.io shared-CPU VM ceiling |

## Env defaults

All constants above live in `worker/config/limits.py` and are surfaced as integers via `worker.config.limits.to_dict()`. No environment override exists for these values; changing them is a code change, gated by CODEOWNERS.
