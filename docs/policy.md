# Policy (GATE-POLICY-01)

> Owner: Product Manager. Status: `not_started` — content below is a skeleton; required section headings are already in place for gate validation.

## 20:1 Contribution model

Trial-pool users contribute one application on behalf of the product maintainer (Sijoy) for every 20 successful applications of their own. The counter (`user_quota.apps_since_sijoy_run`) resets on each contribution. `cycle_size = 20` — any change requires an explicit product decision and a migration note.

TODO: approved final copy for onboarding + Settings banner.

## BYOK exemption

Users who paste their own LLM provider keys in Settings set `user_api_keys.use_trial_pool = false` and are fully exempt from the contribution. The Settings banner message must make this explicit: "Bring your own keys to skip the contribution and unlock unlimited runs."

TODO: approved final copy.

## User-facing copy

Two verbatim strings live in this section and nowhere else — the frontend imports them:

- Onboarding consent checkbox: _TODO_
- Settings progress caption: _TODO_
- Contributor badge label: _TODO_
