# Soft-launch runbook — josho-hr for friends

> Goal: 5 friends can sign up at https://hr.joshoit.com/signup and successfully apply to one job each.
> Audience: Sijoy (operator). Not for friends.

## Pre-flight (do these first, in order)

### 1. Set the invite gate on Vercel

Vercel → Project `josho-hr-web` → Settings → Environment Variables. Add:

```
JOSHO_HR_INVITE_CODES = your-invite-code-here
JOSHO_HR_INVITE_EMAILS = your-email@example.com
```

The `JOSHO_HR_INVITE_EMAILS` allowlist lets you and any pre-known friends sign up without typing a code. Anyone else needs the code. Redeploy or trigger a new Vercel deploy after setting (Settings → Deployments → Redeploy).

### 2. Run the RLS isolation test against a test Supabase project

```bash
cd the josho-hr/web directory
# point at a TEST project (NOT production <your-supabase-project-ref>)
$env:TEST_SUPABASE_URL = "https://<test-project>.supabase.co"
$env:TEST_SUPABASE_SERVICE_ROLE_KEY = "<test-service-role-key>"
$env:TEST_SUPABASE_ANON_KEY = "<test-anon-key>"
pnpm vitest run __tests__/rls.isolation.test.ts
```

Expect 8 green tests. If any fail, **do not invite friends until fixed** — that means user A can read user B's data.

If you don't have a separate test project, create a free one at supabase.com → New project → name it `josho-hr-test`. Run all migrations against it (`supabase db push --project-ref <test-ref>`). The test creates and cleans up its own users so the project stays empty.

After a green run, mark `GATE-DATA-02` as `passed` in `docs/launch-packet.md`.

### 3. Smoke-test the full apply path (you, on prod)

```
1. Open https://hr.joshoit.com/signup in an incognito window
2. Email: your-email@example.com  Invite code: your-invite-code-here  → Send magic link
3. Open Gmail → click the link → land on /onboarding
4. Complete onboarding (resume upload, target roles, work auth)
5. Land on /app — Application Center should be empty, "idle" status
6. In Quick apply, paste a Greenhouse job URL (e.g. an open Anthropic role)
7. Click Apply
   Expect: row appears in "Recent applications", status starts at queued
   Expect: within ~60s the worker picks it up — status moves to scraped/scoring/tailoring
8. Within 2-5 min: Resume preview + Cover letter + Skill gaps panels populate
9. Dashboard counter "Applied" goes from 0 to 1
```

If any step stalls > 5 min, check:
- Vercel function logs (worker queue dispatch)
- Supabase logs → `job_runs` table for stuck rows
- The companion CLI logs if scraping uses headed Playwright

### 4. Send invites

Template (copy-paste, edit the friend's name):

```
hey [name],

building josho-hr — a job-application tool that auto-tailors your resume +
cover letter per posting using AI. soft launch this week, you're on the
invite list.

  url:  https://hr.joshoit.com/signup
  code: your-invite-code-here

it works best if you bring your own anthropic api key (settings → keys).
you can also start on the trial pool — first 100 calls free.

if anything breaks, dm me. data export + delete is in /settings/account.

— your-name-here
```

### 5. Watch for fallout (first 48 hours)

- Telegram `[SOHAYA]` channel will catch any P0 alerts
- Check `application_events` table for kind=`error`
- Check `job_runs` table for rows stuck in `running` > 10 min
- Ask each friend after their first apply: "did the resume preview look right?"

## Roll-back lever

If something breaks badly:

1. Set `JOSHO_HR_INVITE_CODES` to an empty value AND set `JOSHO_HR_INVITE_EMAILS=your-email@example.com`. New signups blocked except yours.
2. Existing accounts continue to function.
3. Fix the bug. Re-enable codes. Re-deploy.

For full feature kill-switches see `docs/rollback.md`.

## Done-state checklist

- [ ] `JOSHO_HR_INVITE_CODES` and `JOSHO_HR_INVITE_EMAILS` set on Vercel
- [ ] RLS isolation test green against test Supabase project
- [ ] Personal smoke-test: 1 application end-to-end successful
- [ ] Privacy notice + Terms link in `/signup` resolve to actual pages (already shipped)
- [ ] At least 1 friend has signed up + applied successfully
- [ ] 0 P0 Telegram alerts in the first 24h after first friend signup

When all 6 are checked, `GATE-LAUNCH-CONDITIONAL` is satisfied. Move to public launch when:
- Lawyer-reviewed `terms.md` ships
- `GATE-OBS-01` (observability dashboard) passes
- `GATE-POLICY-01` (niche/cooloff) filled in
