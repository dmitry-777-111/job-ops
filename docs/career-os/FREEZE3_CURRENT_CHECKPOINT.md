# Freeze 3 current checkpoint

Updated: 2026-10-03 21:30 EDT

## Durable state

- Branch: `freeze3-dev`.
- `9229a7e` passed full CI (`37167333605`): controlled interrupted-vs-uninterrupted recovery equivalence gate is PASS.
- `810f4b4` passed full CI (`37167544876`): source identity / fuzzy-dedupe hardening is PASS.
- `608946f` passed full CI (`37168123251`): delta/idempotency is race-safe and F3-1 is closed.
- `dc6519c` passed full CI (`37168368363`): F3-0 baseline/evidence and F3-1 acceptance are durably closed.
- `f46d896` passed full CI (`37168586940`): F3-2 legacy strategy bootstrap is green.
- `e1f87df` passed full CI (`37168809285`): profile/strategy versioning repository coverage and live migration preview are green.
- `b8ca148` passed full CI (`37169023123`): legacy-vs-migrated strategy behavior projection is machine-checked.
- `8ffab66` passed full CI (`37169232837`): the frozen 1,274-row R0 corpus produces identical accepted IDs under legacy and migrated search/location configuration.
- `d4b39a1` passed full CI (`37169388118`): F3-2 Candidate/Strategy Domain is durably recorded as PASS/CLOSED.
- `1cf2569` passed full CI (`37169856874`): F3-3 shadow-only safe prefilter foundation is green after the single type-only test-fixture repair.
- `f612afb` passed full CI (`37170437988`): the R0 geography shadow now has zero false rejects after ambiguous multi-location evidence was downgraded to UNKNOWN-to-AI.
- Observed geography-only shadow result: 1,274 total = 0 safe rejects, 13 uncertain-to-AI, 1,261 pass-to-AI; therefore 0% savings and no basis for activation by geography alone.
- `a6e3356` passed full CI (`37170657515`) with an initial 13-reject Canada hard-evidence shadow result (1.0204% savings, max score 38, zero selected/score>=50 rejects).
- Semantic audit then found three phrases too broad for irreversible rejection; before any activation, the local parser was tightened to 10 safe rejects (0.7849%), still zero selected/score>=50 rejects.
- `1fd1e23` added the tightened parser, audit record, and staged rollout controller, but its single CI run `37170981072` failed only two focused tests: generic "authorized to work in Canada (Canadian Citizen or Permanent Resident)" wording was still being misclassified, producing 12 rejects instead of the audited 10.
- `e19bb90` passed full CI (`37174790740`): generic work-authorization framing is excluded from the citizen/PR-only hard signal. Final deterministic result is exactly 10 SAFE_REJECT cases, max historical score 38, zero `ready` rejects, zero score>=50 rejects, and 10/10 manual audit coverage.
- `63eeaa6` passed full CI (`37175005471`): F3-3 acceptance record is durable. F3-3 Safe Prefilter is PASS/CLOSED for shadow/audit readiness; production enforcement remains disabled pending a separate explicit activation approval.
- `6936ca4` passed full CI (`37175486379`): hosted two-candidate private-domain isolation is green for profile, strategy, connection status, encrypted credentials, and cross-user activation attempts.
- `03167bd` passed full CI (`37175728984`): the remaining F3-4 shared-discovery gap and safety boundary are durably documented.
- Current prepared unit adds a bounded shared-discovery coordinator: exact opaque fingerprinting, clean-result single-flight/cache reuse, LRU-style bounded retention, cloned outputs, and no propagation/cache of challenged/degraded/failed source results.
- Freeze 2 production remains untouched and remains rollback.
- R0 recovery is terminal and must not be restarted or rescored.
- VPS root filesystem remains in critical-pressure territory; no dependency install, image build, or destructive cleanup without a separate rollback-safe decision.

## F3-0 evidence

- `FREEZE3_R0_BASELINE.md` captures the terminal run, loss/disposition funnel, DB integrity, and all seven accounted unscored jobs.
- `evidence/R0_PREFILTER_SHADOW.jsonl`: 1,274 rows, SHA-256 `c18dfe087f6ffd5b3974e147dcfdeb3828544b8591500f62683d3d72697828d5`.
- `evidence/R0_REGRESSION_CORPUS.json`: 37 examples, SHA-256 `4cca540db379413ea8fbbbfeb09c53ec154d9d1e8c492b518352983ba9c3fc17`.
- DB evidence: `quick_check=ok`, 0 foreign-key violations, 1,274 R0-window persisted jobs, 1,267 scored, 7 explicitly accounted scoring failures, 10 selected/processed.

## F3-1 closure

F3-1 Reliability Foundation is PASS/CLOSED. See `FREEZE3_F3_1_ACCEPTANCE.md`.

## Next exact actions

1. Commit/push the prepared shared-discovery coordinator + focused tests once.
2. Read its single automatic CI run; do not redispatch.
3. If PASS, integrate it only into the safe public-extractor path with a conservative exact fingerprint (including settings and existing-job state) and Watchlist/recovery/challenge exclusions.
4. Prove two candidates cause one heavy discovery call while downstream candidate state remains isolated.
5. Keep prefilter enforcement disabled until a later explicit activation approval.

## Safety / no-repeat rules

- Repo/CI/DB evidence outranks chat narrative.
- One pushed SHA under CI validation at a time.
- One substantial unpushed unit maximum.
- No production migration/deploy while Freeze 3 validation is incomplete.
- No duplicate R0 scoring or discovery.
- No blind CI reruns.
- No Docker image/container deletion without inspected rollback safety.
