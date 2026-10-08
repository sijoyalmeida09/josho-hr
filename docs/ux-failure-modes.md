# UX failure modes (GATE-REL-02)

> Owners: Frontend Engineer + Product Manager. Status: `not_started`.
> The five failure modes below map one-to-one to plan Section 17.6.

## Upload failure

- User-facing message: `Upload pending — we'll retry automatically.`
- Recovery action: Retry button on the application card (triggers worker retry immediately).
- Fallback path: Install the local-sync companion ([companion.md](companion.md)); drop the PDF into `~/josho-hr/inbox/`; sync pushes it on next poll.

## LLM key failure

- User-facing message: `Your <provider> key was rejected. Error: <provider-message>.`
- Recovery action: Link to Settings → API keys to update or remove the key.
- Fallback path: Toggle back to the trial pool (subject to Sijoy tax) or paste a different provider's key; the worker picks the next valid provider in the failover chain.

## Worker outage

- User-facing message: `Worker is catching up. New submissions will run in <eta>.`
- Recovery action: Status banner shows queue depth and ETA; no user action required.
- Fallback path: Companion CLI continues to reflect local state; submissions resume automatically when worker is healthy.

## n8n webhook failure

- User-facing message: `Last n8n delivery failed. <N> deliveries queued for retry.`
- Recovery action: Settings → Integrations → n8n shows the last 10 deliveries with status, signature-check result, and retry counts.
- Fallback path: User can disable n8n outbound and keep using the builtin inbox until the issue is resolved.

## Storage limit

- User-facing message at 80%: `You've used 80% of your storage quota. Old traces auto-delete in <days>.`
- Hard stop at 100%: `Storage full. New uploads paused until older traces expire or you clean up.`
- Recovery action: Settings → Storage → bulk delete old traces; or reduce trace retention in Preferences (user-selectable between 30/60/90 days).
- Fallback path: Companion CLI mirrors local copies, so traces remain available offline even after cloud delete.

---

Signoff (required for GATE-REL-02 pass):

- Product Manager: _TODO_
- Frontend Engineer: _TODO_
