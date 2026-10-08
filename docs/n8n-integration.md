# n8n integration (GATE-INT-01)

> Owner: Full-Stack Dev. Status: `not_started`.
> Reference workflow: [../n8n-templates/16-josho-hr-email-tracker.json](../n8n-templates/16-josho-hr-email-tracker.json).

## Event schema v1

`contractVersion = "v1"`. Frozen. Event envelope:

```json
{
  "event": "application_submitted | application_failed | email_received | interview_invite | rejection_received | offer_received | sijoy_contribution_made",
  "occurred_at": "2026-05-02T21:00:00Z",
  "data": { "...": "event-specific fields" }
}
```

Per-event `data` shapes live as JSON Schemas under [../worker/n8n_dispatcher.py](../worker/n8n_dispatcher.py) in Phase 3.

## Signature (HMAC-SHA256)

- Header: `X-JoshoHR-Signature: sha256=<hex-hmac>`
- Computed over the raw JSON body using the user's per-integration HMAC secret
- Secret at rest: `user_integrations.hmac_secret_encrypted` (`pgcrypto`)
- Signature MUST be verified before any DB write on the inbound webhook at `POST /api/webhooks/n8n/email`

## Idempotency keys

- Header: `Idempotency-Key: <uuid4>`
- Worker maintains a rolling set of seen idempotency keys (5-minute window) to prevent replay and duplicate inbound emails
- Duplicate keys return `200 OK` with `"deduped": true` and do NOT re-insert

## Retry + backoff

- Outbound: 3 attempts, 1s / 4s / 16s exponential
- Inbound: rejected signatures do not retry; deduped deliveries are idempotent

## Dead-letter

- Outbound exhaustion: insert into `job_runs` with `kind='email_scan'`, `status='dead_letter'`, and `metrics->'original_event'` preserved
- Inbound signature failures are logged but do not DLQ (potential abuse vector)
