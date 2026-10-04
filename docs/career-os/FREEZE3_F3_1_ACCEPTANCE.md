# Freeze 3 — F3-1 reliability acceptance

Accepted baseline date: 2026-10-03/04 EDT
Branch: `freeze3-dev`

## Reliability controls

| F3-1 requirement | Evidence | Result |
| --- | --- | --- |
| Run-item membership / isolation | `ee2c548`, `7587015`, `6d30ae8` | PASS |
| Exact scoring recovery semantics | `e73b0f6`, `8bee734`, equivalence test finalized in `9229a7e` | PASS |
| Worker heartbeat / progress | `86b73ae`, `e575827`, `ab2b607` | PASS |
| Scheduler ownership / lock | `8abfa5f`, `c785f09`, `a8a522a`, `5cf56a0`, `9eea53e`, `7619d6d` | PASS |
| Disk / log safeguards | `f09403e`, `5529d6e` | PASS |
| Identity / dedupe hardening | market identity foundation `d9b7f97`, shadow inventory `bf1dd09`, source-ID fuzzy-dedupe guard `810f4b4` | PASS |
| Delta / idempotency rules | versioned evaluation foundation `16c2f48`; race-safe immutable evaluation reuse `608946f` | PASS |

## Gate evidence

The F3-1 gate requires controlled interrupted and uninterrupted runs to converge to equivalent terminal results.

- Equivalence-test final SHA: `9229a7e`
- Automatic GitHub CI: `37167333605`
- Result: PASS

The test covers a persisted partial scoring state and verifies convergence to the same terminal run status, processed count, job scores, and job statuses as the uninterrupted controlled path.

## Idempotency invariant

Candidate evaluation identity is the immutable tuple:

`marketPostingVersionId + profileVersionId + strategyVersionId + scoringPolicyVersion`

Rules:
1. unchanged tuple => reuse existing evaluation;
2. concurrent attempts for the same tuple => one persisted evaluation, losers reuse the winner;
3. decision-relevant posting content change => new posting version => new evaluation;
4. profile, strategy, or scoring-policy version change => new evaluation;
5. historical full rescoring is not an ordinary daily-run operation.

`608946f` adds focused repository coverage for sequential reuse, changed posting content, and concurrent coalescing. Automatic CI `37168123251` passed.

## Acceptance decision

F3-1 Reliability Foundation: **PASS / CLOSED**.

This closes the reliability foundation only. It does not deploy Freeze 3 to production and does not remove Freeze 2 rollback protection.
