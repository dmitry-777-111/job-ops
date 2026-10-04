# Freeze 3 current checkpoint

Updated: 2026-10-03 21:30 EDT

## Durable state

- Branch: `freeze3-dev`.
- `9229a7e` passed full CI (`37167333605`): controlled interrupted-vs-uninterrupted recovery equivalence gate is PASS.
- `810f4b4` passed full CI (`37167544876`): source identity / fuzzy-dedupe hardening is PASS.
- `608946f` passed full CI (`37168123251`): delta/idempotency is race-safe and F3-1 is closed.
- `dc6519c` passed full CI (`37168368363`): F3-0 baseline/evidence and F3-1 acceptance are durably closed.
- `f46d896` passed full CI (`37168586940`): F3-2 legacy strategy bootstrap is green.
- Current prepared unit adds repository-level profile/strategy versioning coverage plus a read-only migration preview of the live legacy settings.
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

1. Commit/push the prepared candidate-domain repository tests + migration-preview evidence once.
2. Read its single automatic CI run; do not redispatch.
3. If PASS, finish the F3-2 gap audit: repository isolation/version semantics, market-adapter boundary, and behavior-equivalence gate against the current settings.
4. Do not activate or deploy the new domain in Freeze 2 production during development.

## Safety / no-repeat rules

- Repo/CI/DB evidence outranks chat narrative.
- One pushed SHA under CI validation at a time.
- One substantial unpushed unit maximum.
- No production migration/deploy while Freeze 3 validation is incomplete.
- No duplicate R0 scoring or discovery.
- No blind CI reruns.
- No Docker image/container deletion without inspected rollback safety.
