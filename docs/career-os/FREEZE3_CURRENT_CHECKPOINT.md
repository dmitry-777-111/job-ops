# Freeze 3 current checkpoint

Updated: 2026-10-03 20:55 EDT

## Durable state

- Branch: `freeze3-dev`.
- Last pushed commit: `5529d6e` — bounded resilience log growth.
- CI for `5529d6e`: GitHub Actions run `37166193657` completed successfully.
- Prior `f09403e` disk-pressure safeguards and `7619d6d` explicit dispatcher-owner startup gate also passed CI.
- Freeze 2 production remains untouched and remains rollback.
- R0 recovery container completed successfully and exited 0; pipeline run `6d2e2bad-1322-47e6-bf7e-5d53b7956ad9` is persisted as `completed` at `2026-10-04T00:49:46.327Z` with no error message. Do not restart or duplicate it.
- VPS root filesystem is at 92% use. Do not install dependencies, build images, or perform destructive cleanup while this checkpoint is active. GitHub CI is the validation path for the current small code units.

## Interruption recovery rule

Durable repo/CI/database evidence outranks chat narrative. Resume from `git status`, local-vs-origin SHA, this checkpoint, and existing CI. Keep at most one substantial unpushed unit and never manually redispatch CI after a push.

## Local next unit

Prepared but not yet pushed:
- controlled interrupted-vs-uninterrupted recovery equivalence test;
- uninterrupted scenario starts with both run jobs unscored;
- interrupted scenario starts with one persisted score plus persisted selected-job checkpoint;
- both must converge to the same terminal projection: completed run, identical scores/statuses, identical processed count.

The local VPS Vitest runner cannot currently start because dev dependencies such as `vite`, `@vitejs/plugin-react`, and `@tailwindcss/vite` are absent. No dependency installation was attempted because disk usage is critical. The test file passes Biome and `git diff --check`; automatic GitHub CI is authoritative.

## Next exact actions

1. Commit/push the prepared equivalence test once.
2. Read the single automatic CI run for that SHA; do not redispatch.
3. If PASS, record the F3-1 recovery-equivalence gate evidence and continue with identity/dedupe hardening plus delta/idempotency rules.
4. If FAIL, inspect only the failing job/log and apply the minimal repair.
5. Separately finish R0 closure evidence: exact final run membership/counts, DB integrity, and loss funnel. Do not rerun scoring.

## Safety / no-repeat rules

- One pushed SHA under CI validation at a time.
- One substantial unpushed unit maximum.
- No production migration/deploy while Freeze 3 validation is incomplete.
- No duplicate R0 scoring.
- No blind rerun of CI/tests.
- No Docker image/container deletion without a separate inspected rollback-safe cleanup decision.
