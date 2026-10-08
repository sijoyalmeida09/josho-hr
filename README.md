# josho-hr

Multi-tenant job application tracker with AI-powered resume tailoring and cover letter generation. Built on Next.js 15 + Supabase + Python worker.

## What it does

- **Application Center**: track every job application — status, notes, resume used, tailoring score
- **AI tailoring**: per-posting resume and cover letter generation using Claude
- **Companion CLI**: browser extension / CLI for one-click apply on job boards
- **n8n integration**: webhook events for application_submitted, interview_invite, rejection, offer
- **Multi-tenant**: proper RLS isolation — no user can see another's data
- **Worker**: async Python worker on Fly.io handles scraping, LLM calls, and ATS form filling

## Layout

```
josho-hr/
├── web/                  Next.js 15 frontend (Vercel)
├── worker/               Python async worker (Fly.io)
├── companion/            Single-file sync CLI / browser extension helper
├── n8n-templates/        n8n workflow templates for webhook events
├── supabase/migrations/  Database schema, RLS policies, storage, seed, audit
├── docs/                 Data model, deploy guide, policy, security, runbook
└── .github/workflows/    CI, scheduled worker cron, retention cron
```

## Quick start

```bash
git clone https://github.com/sijoyalmeida09/josho-hr.git
cd josho-hr/web
cp .env.example .env.local   # fill in Supabase + Anthropic keys
npm install
npm run dev                  # http://localhost:3000
```

See `docs/deploy.md` for full Supabase + Fly.io + Vercel setup.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind |
| Backend / DB | Supabase (Postgres + RLS + Storage + Auth) |
| Worker | Python, FastAPI, Playwright |
| AI | Anthropic Claude (resume tailoring + cover letters) |
| Deploy | Vercel (web) + Fly.io (worker) |

## Contributing

PRs welcome. See `docs/data-model.md` for schema docs and `docs/policy.md` for the contribution model rules.

## License

MIT

## See also

- [AGENTS.md](AGENTS.md) — rules for AI agents editing this tree
- [CODEOWNERS](CODEOWNERS) — ownership per path
- [docs/architecture.md](docs/architecture.md) — system topology
- [docs/launch-packet.md](docs/launch-packet.md) — gate checklist
