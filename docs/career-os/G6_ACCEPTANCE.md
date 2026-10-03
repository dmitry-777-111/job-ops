# CAREER OS NEXT — G6 Acceptance / Freeze

Status: PASS
Accepted: 2026-10-02

## Purpose
Final end-to-end acceptance and v1.0 freeze after G0-G5.

## Required checks
1. Confirm current repository/runtime integrity and no unresolved gate regressions.
2. Verify backup availability and perform a controlled restore test before G6 PASS.
3. Verify restart/recovery behavior and checkpoint continuity.
4. Exercise representative end-to-end workflow on a real working set, including duplicate/error/failure handling.
5. Confirm no regression in evidence guardrails, Canada/immigration layer, Human Bridge, or post-application tracking.
6. Record remaining non-blocking issues in backlog; do not expand v1 scope.
7. Freeze accepted v1 state only after all blocking acceptance checks pass.


## Verified result
- Repository/runtime preflight: PASS.
- Runtime DB integrity: PASS (`quick_check=ok`, 0 foreign-key violations).
- Controlled backup/restore verification: PASS.
- Restart continuity: PASS; persistent JobOps data retained. Auth-session cleanup is transient/session lifecycle behavior and is excluded from persistent-data continuity checks.
- G2 live acceptance: PASS (60 assertions); fresh-process restart: PASS (9 assertions).
- G3 live acceptance: PASS (17 assertions); fresh-process restart: PASS (11 assertions).
- Targeted G6 regression suite passed before the live-acceptance runner failure. The failure was isolated to launching `tsx` from the monorepo root, which did not resolve the orchestrator `@shared/*` tsconfig alias; running the acceptance scripts from the orchestrator workspace resolves the alias correctly.

## Non-blocking backlog
- Harden the G6/live-acceptance wrapper so it always launches orchestrator scripts from the orchestrator workspace (or explicitly supplies its tsconfig).
- Keep transient auth-session rows excluded from restart persistence assertions; validate durable domain data instead.

## Freeze decision
All blocking G6 acceptance checks pass. CAREER OS NEXT v1 is accepted for freeze. No further v1 scope expansion is authorized by this gate.
