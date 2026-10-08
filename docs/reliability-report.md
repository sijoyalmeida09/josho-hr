# Reliability report

> Part of the launch packet (plan Section 17.5). Signed by Backend Engineer and DevOps / SRE after GATE-REL-01, GATE-REL-02, GATE-OBS-01 all pass.

## KPI measurements (pre-launch shadow run)

Targets from plan Section 17.4 — record actuals below before signoff:

| KPI | Target | 7-day shadow actual | Source |
|---|---|---|---|
| Application submit success rate | ≥ 92% | TODO | `job_runs` success fraction over 7d |
| Apply latency p95 | ≤ 180s | TODO | Worker metrics |
| n8n delivery rate | ≥ 99% | TODO | Dispatcher metrics |
| Trace capture completeness | ≥ 95% | TODO | Storage count / applications |
| Cross-tenant isolation breaches | 0 | TODO | [../web/__tests__/rls.isolation.test.ts](../web/__tests__/rls.isolation.test.ts) |
| Companion CLI round-trip | ≥ 98% | TODO | `applications.upload_pending` clearance |

## Known risks at launch

- TODO: list any risks accepted under "Conditional Go" from [launch-packet.md](launch-packet.md).

## Signoff

- Backend Engineer: _TODO_
- DevOps / SRE: _TODO_
