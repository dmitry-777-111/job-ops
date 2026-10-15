# TJAgent / CAREER OS — operating constitution and recovery plan
Date: 2026-10-15
Status: APPROVED by user on 2026-10-15 — execution authorized; no release authorized.

## Product north star
Deliver one usable daily candidate loop: import/review resume → preserve profile and work/visa constraints → discover and rank current real jobs with provenance → select a plausible vacancy → generate and approve an application package → record employer response/outcome → learn only from confirmed evidence. Do not optimize for raw job counts, code volume, or features shipped.

## Historical decisions and lessons
- 2026-10-02: limited G0–G6 v1 gates (Evidence, Canada, Human Bridge, migration) were closed and frozen. This did not prove the full candidate-facing product.
- Freeze2 is the protected fallback; Freeze3 is the development/test runtime, **not** an accepted release. Do not touch production/cut over automatically.
- F3-0…F3-6 were reported completed; F3-7 end-to-end acceptance and clean daily cycles remain the decisive gate. An earlier confirmed CI run does not validate subsequent commits.
- Current GitHub branch `freeze3-dev`, inspected starting HEAD `05d4539f92a2d555b88b12e2f462be9bfd01b4dc`. Recheck before execution.
- Historical UX defects: 24-hour filter looked like no jobs despite Ready records; completed onboarding inaccessible; resume/profile links difficult to find; stale resume confirmation possible; asynchronous LinkedIn import could fail to hydrate; review could accidentally clear links. Recent code changes address these but their latest test/deploy state is **unverified**.
- Mistakes to avoid: announcing PASS without checking deployed SHA, mistaking GitHub push for successful deployment, inventing access/CI results, claiming a password reset succeeded without evidence, changing code before checking prior commits, repeated mode/Desktop Commander requests, gratuitous tests, repeated CI/CD/VPS setup, release/tag before acceptance, overly short work batches.

## Tool routing and truthful capability
- Chat GitHub connector: read/write repository files and commits; use existing branch, exact SHA, minimal changes. The available `fetch_commit_workflow_runs` endpoint filters PR-triggered runs; empty results cannot validate push CI. Do not infer deployment state from it.
- GitHub Actions: existing `.github/workflows/ci.yml` and `.github/workflows/freeze3-deploy.yml`; GitHub-hosted runner builds immutable image and deploys through restricted VPS SSH. Docs: `FREEZE3_CICD.md`. Check logs and `DEPLOY_OK` with evidence before declaring success.
- RackNerd VPS: runtime, not a prerequisite for code authoring; production preserved. Windows, WSL, Docker Desktop, Desktop Commander, and Work mode are **not** part of the critical path. Never request their installation to proceed.
- If a required action is truly unavailable through the currently exposed connector (e.g. push-run listings, authenticated browser, workflow dispatch), state the **specific missing permission/action**, and use an existing GitHub Actions page or one minimal user intervention; no fake workarounds or unverified success.
- No subagents without user request; no secrets/passwords in chat, repository, outputs or logs.

## Execution constraints
1. Scope freeze: only P0 release blockers, data loss, security, and demonstrable acceptance failures. Everything else deferred.
2. Branch protection: preserve rollback and exact SHA, keep production untouched, never merge/tag/cut over without validated gates.
3. Work in several related fixes per work session. Commit checkpoint(s), then continue the next approved step in the same turn; do not stop merely because one commit succeeded.
4. Timebox substantial operations; durable logs and checkpoints per `RECOVERY_CHECKPOINT_PROTOCOL.md`. Report verified result, unverified claims, next action, and genuine blockers. No speculative polling.
5. Test pyramid: static review → narrowly targeted unit/integration tests → one build/deploy verification → one E2E acceptance; no repeated broad builds or tests for minor documentation edits.
6. Jobs/scoring, immigration logic and auto-submission: do not alter business rules without measured evidence and acceptance failure. Never send applications/DMs without candidate approval. Social profiles get wording/advice; the user applies changes manually.
7. No user-facing release until functionality and evidence have passed; distinguish `implemented`, `tested`, `deployed`, `accepted` for every gate.

## Recovery and completion roadmap
- A. Evidence gate: inspect current head, recent diffs, CI workflow runs/logs, deploy revision, rollback state; settle access path without infrastructure reset. **Important discovery:** CI and freeze3 deploy workflows trigger independently on push, so deployment may succeed while lint/types/tests fail. Successful deployment must not imply accepted release; require separate passing CI for exact SHA before any release/cutover.
- B. Functional gate: sign-in/onboarding-review, PDF/DOCX/replacement/LinkedIn hydration, saved strategy and profile persistence; repair confirmed blockers.
- C. Market gate: Ready jobs from API with 24h/3d/7d/all-history filters; compare 20-30 real postings for current state, source links, duplicate and ranking quality, Canadian work authorization and salary constraints.
- D. Application gate: create/review/export package for real eligible vacancy, verify QA evidence, explicit user approval; record/reload outcome and preserve feedback.
- E. Release gate: targeted tests/types/lint, image build, deploy `DEPLOY_OK`, runtime revision exact SHA, smoke test, verified rollback snapshot; only then tag immutable accepted release.
- F. Post-release: 3-5 clean daily cycles; defer multi-country breadth, commercial features, nonblocking UI enhancements, and optional voice feedback until after release.

## Estimates, conditional on access and observed defect count
A: 2-4 hours; B: 6-10 hours; C: 6-12 hours; D: 4-8 hours; E: 3-6 hours; reserve 20-30% for regressions and connector access. Total approximately 25-50 working hours (not elapsed time); greater if live environment or upstream adapters fail.

## Acceptance evidence
Use `FREEZE3_RELEASE_ACCEPTANCE.md` for concrete gates. No new PASS flag or release tag until the corresponding runtime and user evidence are attached. Approved by user 2026-10-15. Execution is active; release remains gated on evidence.
