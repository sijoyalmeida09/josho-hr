# Privacy Policy (GATE-LEGAL-02)

> Owners: Tech Writer / DX + Security Engineer. Status: `not_started`.
> Cross-checks: [data-model.md](data-model.md), [retention.md](retention.md), [security.md](security.md).

## Data collected

- Account identity: email (Supabase Auth)
- Profile: name, contact, links, visa, brand preference, structured resume data (`profiles`)
- Uploaded resumes (Supabase Storage `resumes/{user_id}/...`)
- Generated cover letters (`applications.cover_letter_text` + Storage `cover_letters/{user_id}/...`)
- Application metadata and form-fill events (`applications`, `application_events`)
- Playwright submission traces (`traces/{user_id}/{application_id}.zip`)
- Optional: Gmail app password (encrypted), n8n webhook URL + HMAC secret (encrypted), LLM provider keys (encrypted)

## Retention

- Traces: ≤ 90 days (see [retention.md](retention.md))
- Emails: ≤ 365 days
- Deleted-account hard purge: ≤ 24 hours
- Application events and skill gaps: as long as the parent application exists

## Email ingestion

If a user enables Gmail ingestion (either builtin IMAP or n8n-inbound), only subject, sender, snippet, and classification are stored. Full message bodies are never persisted.

## Traces and events

Playwright traces may include screenshots of third-party ATS forms the user is applying to. The user agrees to this capture by enabling automated applications. Traces are auto-deleted per the Retention section.

## Deletion rights

Users can delete their account from Settings → Export / Delete. All rows with `user_id` matching the account and all storage paths under `{user_id}/` are hard-deleted within 24 hours. SLA target: 1 hour typical, 24 hour maximum.

## Sub-processors

TODO: final list of sub-processors (Supabase, Vercel, Fly.io, Groq, OpenRouter, Anthropic, Resend).
