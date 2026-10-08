# Companion CLI (GATE-INT-02)

> Owners: Full-Stack Dev + Security Engineer. Status: `not_started`.
> Source: [../companion/josho_hr_sync.py](../companion/josho_hr_sync.py).

## Token scope

Companion tokens are JWTs signed by the platform with:

- `aud = "companion"`
- `sub = <user_id>`
- `iat`, `exp` — expiration **≤ 90 days** from issue
- `jti` — unique per token, recorded as `sha256(jti)` in `companion_tokens.token_hash`

A companion token can:

- Read/write the holder's rows in `applications`, `application_events`, `application_skill_gaps` (via RLS with the user's effective `auth.uid()`)
- Read/write Storage under `resumes/{user_id}/`, `cover_letters/{user_id}/`, `traces/{user_id}/`, `inbox/{user_id}/`

It cannot:

- Read or write any row belonging to another user
- Read or write any other Storage bucket
- Create or modify `user_api_keys`, `user_integrations`, or `companion_tokens`

## Folder layout

The CLI auto-creates this tree on first run (`python josho_hr_sync.py --init`):

```
~/josho-hr/
├── resumes/
│   ├── master.pdf
│   └── {application_id}_{company}_{role}.pdf       (downloaded on sync)
├── cover_letters/{application_id}_{company}_{role}.txt
├── traces/{application_id}_{company}_{role}.zip
├── inbox/                                          (drop PDFs here to upload)
│   └── .synced/                                    (rotated-out uploads)
├── applications.csv                                (rolling export)
└── .josho-hr.json                                  (token + last-sync cursor, mode 0600)
```

Any PDF the user drops into `inbox/` is uploaded to the `inbox` Storage bucket under `{user_id}/{filename}` on the next `--sync` run, then moved locally into `inbox/.synced/` so the companion doesn't re-upload it. The Phase 3 worker promotes `inbox` PDFs into `resumes/{user_id}/master.pdf` only after the user confirms the replacement in the web UI.

## Rotation

- `/settings → Local sync → Rotate token` issues a new JWT and sets `revoked_at = now()` on all prior `companion_tokens` rows for the user
- A revoked token fails verification inside the signed-URL issuer and the CLI exits with a clear "token revoked, generate a new one" message
