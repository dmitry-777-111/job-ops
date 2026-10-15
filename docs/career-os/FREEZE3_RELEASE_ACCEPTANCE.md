# CAREER OS Freeze3 — release acceptance checkpoint

Date: 2026-10-14
State: **NOT RELEASED / ACCEPTANCE PENDING**

## Release objective
Ship the smallest usable daily workflow:
candidate profile → resume import/review → saved strategy and profiles → relevant ready jobs → application package → outcome feedback.
No new feature domains until acceptance is complete.

## Verified durable implementation
- `freeze3-dev` contains 7-day default Ready-job window, editing of completed onboarding steps, direct Resume Studio navigation.
- Replacing a resume prevents confirming the previous source during import.
- Job-profile links populate after asynchronous resume parsing without overwriting in-progress edits.
- Review mode does not offer the destructive "Skip for now" action for saved profile links.
- Recent-job display now excludes malformed and future discovery dates.
- Unit tests for these paths have been committed, but their latest execution has **not** been verified.

## Required release gates (all mandatory)
- [ ] GitHub Actions CI for the final candidate revision: lint, types, targeted UX tests successful.
- [ ] Freeze3 build and deploy successful with `DEPLOY_OK` and healthy Docker checks.
- [ ] Runtime revision equals the accepted Git commit.
- [ ] Candidate can sign in and reopen completed profile, strategy, model, resume and job profiles without losing saved values.
- [ ] Upload PDF/DOCX, inspect extracted details, replace a file, confirm only the intended document, and see imported LinkedIn link.
- [ ] Show existing Ready jobs across 24h/3d/7d without false zero impression; verify a small real-world sample against original postings.
- [ ] Prepare an application package for a real suitable job and inspect the result; no automatic submission without approval.
- [ ] Record an application outcome and verify feedback persists across reload/sign-in.
- [ ] Confirm recoverable rollback snapshot and data preservation assumptions.
- [ ] Only after all gates pass: tag an immutable candidate release commit and record acceptance evidence.

## Source audit: jobs list (2026-10-14)

Verified by inspecting the current branch (code inspection, not live runtime):
- Client `getJobs({ statuses: ["ready"], view: "list" })` sends `GET /api/jobs?status=ready&view=list` with no pagination parameter.
- `orchestrator/src/server/api/routes/jobs/read.ts` uses `jobsRepo.getJobListItems(statuses)`; response `total` equals returned array length.
- `orchestrator/src/server/repositories/jobs.ts` selects all rows matching tenant scope and requested statuses, ordered by `discoveredAt`; it does not apply `limit` or `offset`.
- Consequently, the 24h/7d empty-list issue was a client-side time-window/visibility problem, not an API pagination problem. Avoid modifying server search/scoring without fresh evidence.
- The `All ready` option now provides access to older Ready jobs even when the 7-day window is empty. Client regression test committed; execution not yet proven.

## A-stage checkpoint — 2026-10-15

- User approved the operating constitution and authorized recovery execution. Approval recorded in `OPERATING_CONSTITUTION_2026-10-15.md`.
- Verified starting HEAD was `93dbcc3fc309cd39021264e78372a45aa85c40ea`; only approved documentation changes have followed.
- Verified `.github/workflows/ci.yml` has push/dispatch triggers and lint, test, typecheck, docs jobs.
- Verified `.github/workflows/freeze3-deploy.yml` has push/dispatch triggers, GHCR image build and restricted SSH deployment with immutable digest, serial concurrency and rollback command.
- **Acceptance risk:** the CI and deploy workflows are independent on push. A healthy deployed container does not prove tests passed. Require both separately for the exact candidate SHA.
- Read `scripts/deploy/freeze3-deploy.py`: it labels containers with `career-os.revision` and prints `DEPLOY_OK` after health checks. This is source inspection, **not** runtime proof.
- Combined commit-status and PR-only workflow-run queries do not establish push-triggered CI/deploy results. Public workflow URL was not retrievable through the available browser path. Runtime SHA and backup state remain unverified.
- Immediate next evidence: CI outcome, Freeze3 workflow outcome/log `DEPLOY_OK`, and active test-container revision; do not tag/release without these. Avoid repeating any infrastructure setup.

## Current constraint
Connector endpoints in this chat allow GitHub file and commit writes, but do not list push-triggered workflow runs or operate an authenticated browser. `fetch_commit_workflow_runs` only reports pull-request-triggered runs, so an empty result is not proof of failure or success. Public unauthenticated browsing cannot substitute for private deployment logs.

## Recovery
Source of truth: GitHub branch and specific commit, then CI/deploy logs, then this checkpoint. Do not repeat already-completed infrastructure setup. Never call a revision released solely because it was committed.
