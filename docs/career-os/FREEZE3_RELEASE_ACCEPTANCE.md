# CAREER OS Freeze3 — release acceptance checkpoint

Date: 2026-10-14
State: **NOT RELEASED / ACCEPTANCE PENDING**

## Final Work verification reported — 2026-10-16

Work-mode completion report (cross-checked with user-provided screenshot; full underlying run IDs and logs not included in this document):
- Candidate `freeze3-dev` commit `3cc29e6b` is the current branch HEAD, verified independently through the GitHub connector.
- Work reported CI green: **2,371 tests passed, 3 skipped**. The previous seven Biome issues and lone onboarding test failure were fixed. Do not conflate these reports with logs for an earlier commit.
- Work reported test deployment of the **same full commit SHA**, healthy service and HTTP 200.
- Work reported isolated API acceptance: onboarding → resume → Ready → package → outcome, including candidate isolation and persistence on synthetic data. This is **API-level E2E**, not browser UX acceptance.
- Work explicitly **did not** exercise browser UX or actual PDF rendering, and did not submit any real applications. Production remains unchanged.
- Gates still open: browser sign-in/reopen and resume upload/replacement UX, actual PDF render/download, 20–30 real posting quality review, and release decision. No release tag based on API-only acceptance.
- Preserve previously observed `DEPLOY_OK` and rollback separately from post-deploy runtime or browser acceptance. Further evidence should refer to the same candidate SHA.

## PDF export stale-content blocker — 2026-10-16

- Source inspection found Resume Studio PDF export calling `generateDesignResumePdf()` without first persisting a dirty draft. A candidate could receive a PDF of the preceding saved revision even though the editor showed newer content.
- Fixed `useDesignResumeStudio.handleDownloadPdf` to call the existing `ensureLatestPersistedDraft()` before generating. It now aborts if no document exists, saving is busy, saving fails, or the edit version changes during the save.
- Added regression test in `useDesignResumeStudio.test.tsx` checking unsaved edit persistence precedes PDF API invocation.
- **Implementation only**: the new test has not been executed, actual PDF bytes have not been rendered/inspected, and no current-SHA CI/deploy evidence has been collected after the code change. Browser/PDF gate remains pending. No production changes.

## Real AI adaptation and PDF visual acceptance — 2026-10-18

- User supplied Work result of one real TJAgent AI adaptation based on the anonymized master resume and a description of a relevant ATS role. The exact revision of job posting 17454 was **not** verified.
- Work visually inspected the generated **three-page PDF**: no element overlaps; jobs, employment dates and education preserved. No invented PLC programming skills; Ontario 309A accurately described as examination stage.
- **PDF layout gate: PASS for this sample only.** This is stronger than the earlier synthetic PDF-header/EOF proof, but does not establish rendering of every template or every user input.
- **AI content acceptance: OPEN**. Reported defects: mostly empty third page; historical commercial experience too detailed; languages and aerial lift training omitted. Treat the first two as tailoring/pagination optimization and the latter as potentially material omissions requiring comparison against source resume and extraction stages before a code change.
- Vacancy-fit gate is also OPEN: a relevant ATS description was used, but the original ATS requisition #17454 posting/revision was not verified. Do not treat the match score as externally validated.
- GitHub branch HEAD independently checked as `3aa910ef3afc59374c9adc91d4abc49808e18884` on 2026-10-18: no newer code commits, so prior exact-SHA green CI still applies.
- Next: retrieve candidate-approved anonymized source and adapted output; compare field-by-field for omissions and assertions, inspect source-to-structured-resume and tailored-CV transformation, then verify on original real vacancy data. No production, applicant submissions, or release without acceptance.

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

## Verified deployment evidence — 2026-10-15

- Directly inspected GitHub Actions run [38666210262](https://github.com/dmitry-777-111/job-ops/actions/runs/38666210262) via GitHub connector (job list and full deploy log), rather than viewing workflow YAML.
- Build job `116198660362`: completed/success.
- Deploy job `116199817202`: completed/success.
- Deploy log confirms `IMAGE_READY 4a339894aed7b5dfc261a7842b8b9cebecbc93f9` and `DEPLOY_OK 4a339894aed7b5dfc261a7842b8b9cebecbc93f9 health=healthy rollback=career-os-ci-20261015t013112z-81e8dbcd` at 2026-10-15 01:38:15 UTC.
- This establishes a successfully deployed **historical revision 4a339894**, NOT that the current branch HEAD or latest documentation commits were deployed. It is deploy-time health, not a later runtime health check or full E2E pass.
- Corrected tool assessment: `fetch_workflow_run_jobs` and `fetch_workflow_job_logs` DO retrieve push-run evidence when the run/job ID is known. Do not request screenshots of YAML. CI run ID for exact candidate revision and runtime-current state remain unverified.
- Release still gated on exact candidate SHA's CI results and current runtime verification.

## Evidence retrieval and B-stage source review — 2026-10-15

- Verified Actions run `38666210262` via `fetch_workflow_run_jobs` and `fetch_workflow_job_logs`: build and deploy success; `DEPLOY_OK` for revision `4a339894` (historical). Run and job IDs enable direct audit without screenshots or YAML.
- The GitHub connector cannot list CI push workflow runs from commit alone. `get_commit_combined_status` contains no statuses and `fetch_commit_workflow_runs` filters pull-request runs; neither is evidence of CI outcome. CI outcome for the current candidate revision is **unknown**.
- Inspected `OnboardingPage.tsx`: completed review retains step after saving, profile settings hydrate once, active strategy is fetched for review, resume confirmation has import-busy guard, and profile-link save persists through API. These are code-level observations, not E2E proof. Risks remain around asynchronous data hydration and exact resume confirmation source.
- Next gate: obtain CI run identifier/evidence through a capable existing tool; verify exact-SHA lint/type/tests and currently running revision, then test saved data across reload and sign-in. Do not tag while either is unknown.

## UX stabilization checkpoint — 2026-10-15

- Reviewed Ready-job home code and tests after verified historical deploy `4a339894`.
- Corrected misleading `0 matches` display during initial API loading and during API errors; loading now displays an ellipsis and failure a dash instead of zero.
- Added a narrowly scoped pending-request regression test; cleaned up existing navigation/period test formatting.
- GitHub records these changes, but **test pass, exact-current-revision CI and deployment are unverified**. Do not mark acceptance checked.
- This checkpoint records code changes only, not a new runtime release. Next step: obtain actual latest CI run ID and deploy result; follow with onboarding and application package E2E checks.

## Resume flow blocker fixes — 2026-10-15

- Detected stale confirmation-source precedence: onboarding could choose the saved `local:old-document` over the newly imported Resume Studio document. Fixed source selection to prioritize current local document, preserving explicit Reactive Resume sources. Added regression test using different saved/current document IDs.
- Detected coupling between successful resume import and subsequent `pdfRenderer` preference update: if the optional settings update failed, UI previously reported the completed import as a failure. The settings update is now nonfatal and displays a specific warning. Success notification accurately distinguishes renderer-update outcome.
- Cross-checked import hook: a successful file import updates React Query designResume document/status caches before renderer settings update.
- New changes are **committed, not CI-verified nor deployed**. Do not release until target tests/types/lint pass; exact current runtime still unknown.

## Extended stabilization pass — 2026-10-15

- Successful Resume Studio import is no longer reported as failed if subsequent cache invalidation/refresh throws; a specific warning is shown and the saved document remains accessible.
- Application review now prevents overlapping approval/export mutations while either request is pending.
- Source-inspected completed onboarding and application actions; no search/scoring or production changes.
- These are durable GitHub changes, **not yet a verified CI pass or an accepted runtime release**.
- Next required gate is exact-commit CI/deploy evidence and actual end-to-end candidate flow (profile, PDF/DOCX, matching, approved package, outcome persistence). Release remains blocked until verified.

## Extended execution and source-selection checkpoint — 2026-10-15

- Beginning HEAD was `38262f5905db125b55f7a835424c0db38020771c`; verified no unexpected branch movement before changes.
- Resolved an import-mode blocker: a newly imported local file now explicitly selects the `upload` resume mode, so an earlier Reactive Resume connection does not silently override the new document ID.
- The confirmation code now honors `resumeSetupMode`: choosing Reactive Resume retains the connected `rxresume:` source; choosing local file uses the current `local:` document where present.
- Added parameterized regression cases for both source types. These tests are committed but **not executed/CI-verified in this chat**.
- Deduplicated the combined saved-and-imported job-platform URLs **before** applying the six-link display cap, to avoid losing unique profiles to repeated URLs.
- No change to scoring, immigration eligibility, external applications, VPS infrastructure, or production.
- Next: verify exact-SHA CI, deploy and runtime, then perform the user-facing onboarding→Ready→package→outcome acceptance gate. Do not tag a release without evidence.

## Current long-block checkpoint — 2026-10-15

- Base HEAD `9a944498e8e1f3caa02eefb6e48002f710c4fcac` matched current branch at start. No unexpected changes.
- Found a genuine source-selection gap: a stale `rxresume:` confirmation string could be used even when the candidate selected local upload but no local document existed. Confirmation now accepts only a source matching the selected mode, and gives the upload UI until a suitable source is present.
- Added a regression case for local upload mode with a stale Reactive Resume source and no imported local document. Also formatted the recent source-switch test fixture.
- Inspected the resume review branch to confirm that `hasResume=false` displays the importer instead of the confirmation button.
- Implementation and tests were committed; **tests not executed, CI and current VPS revision remain unverified**. Do not confuse reviewed source with release acceptance.
- Next gate: obtain CI and runtime proof for a candidate SHA, then manual E2E verification of resume, strategy, Ready list, application package and outcome.

## Safety and runner checkpoint — 2026-10-15

- Validated starting HEAD `9a944498` was unchanged before the batch.
- Tightened `OnboardingPage` confirmation: the selected upload mode cannot fall back to a saved Reactive Resume source and Reactive Resume mode cannot silently confirm an old local file. No matching source means the importer UI remains visible.
- Added a focused regression for upload mode with a stale `rxresume:` confirmation and no local document; cleaned formatting in the source-switch regression.
- Read the ResumeStep render branch to verify `hasResume=false` leads to importer UI rather than a confirm control. All observations are from source code, not test execution.
- Investigated optional Remote Desktop Commander to obtain independent test command execution: registered Windows device is **offline**, last seen about 40 hours previously. Desktop is not a release prerequisite; do not request a reinstall.
- No CI run or current runtime revision has been independently verified for this commit. Do not mark release accepted until CI and deploy evidence is collected from GitHub Actions.

## Current constraint
Connector endpoints in this chat allow GitHub file and commit writes, but do not list push-triggered workflow runs or operate an authenticated browser. `fetch_commit_workflow_runs` only reports pull-request-triggered runs, so an empty result is not proof of failure or success. Public unauthenticated browsing cannot substitute for private deployment logs.

## Recovery
Source of truth: GitHub branch and specific commit, then CI/deploy logs, then this checkpoint. Do not repeat already-completed infrastructure setup. Never call a revision released solely because it was committed.

## Bounded outcome persistence check — 2026-10-20

Base: `8f686ad35789d6623b9e8c72a7d2fdff6fc18a23`. This cycle addresses only the local outcome-persistence portion of the outstanding candidate-flow acceptance gate.

- Existing confirmation UI, timeout logic and tracking service: 19/19 tests PASS.
- Added one regression proving a user-confirmed rejection, closure timestamp, stage-event identity and verification evidence survive closing and reopening a synthetic SQLite database.
- Final focused run: 3 files, 20/20 tests PASS on Node 22.22.1 / Vitest 4.1.6. No application behavior changed.
- `npm --workspace orchestrator run check:types`: exit 0.
- `./orchestrator/node_modules/.bin/biome ci orchestrator/src/server/services/applicationTracking.test.ts`: exit 0. `git diff --check`: PASS.

Test command, from `orchestrator` (using the existing local Node 22 executable):

```powershell
../../qualification-tools/node.exe ../node_modules/vitest/vitest.mjs run src/client/lib/outcome-confirmation.test.ts src/client/pages/improve/OutcomeConfirmationCard.test.tsx src/server/services/applicationTracking.test.ts
```

Tests use temporary synthetic databases; no external applications or personal data. Dependencies were reused, not freshly installed. This proves local persistence across database reopening, not a process crash, hosted tenant isolation, deployed API behavior or the full candidate E2E flow. Those release gates remain open. No production, PDF, infrastructure changes or deploy validation were performed. The commit uses `[skip ci]` to prevent push-triggered deployment.

## Bounded outcome isolation check — 2026-10-20

Base: `700359a0f00a2dabdfdbf38904b0075287a116d3`. One focused hosted API regression uses two synthetic users in the same tenant, separate private jobs for the same vacancy URL, distinct verified rejection evidence, and temporary databases.

Both directions are checked: foreign job/result reads, event-history reads, outcome changes, stage creation, event editing and deletion. Event mutations use both the foreign job ID and the attacker's own job ID with the foreign event ID. Owner outcomes, closure timestamps and complete histories remain unchanged.

Node 22.22.1 / Vitest 4.1.6: one targeted test PASS, six unrelated tests deliberately skipped. Command from orchestrator:

```powershell
../../qualification-tools/node.exe ../node_modules/vitest/vitest.mjs run src/server/api/routes/tenant-isolation.test.ts -t 'isolates application outcomes and event mutations between hosted users'
```

The first run exposed an overly strict test assumption that every foreign request returns 404. Existing contract: foreign event collections return `200 []`; inaccessible event deletion returns `200 null` without mutation; foreign job/outcome access returns 404; unavailable stage/event mutations return 500 without data. Owner-state preservation passes. The 500 mapping remains a separate API-quality limitation, not a successful mutation; no application behavior was changed.

No complete E2E, PDF, production, real accounts or correspondence connectors. This is local hosted outcome-isolation evidence only, not release acceptance. The commit uses `[skip ci]` to prevent push-triggered deployment.
`npm --workspace orchestrator run check:types`, targeted `biome ci` on `tenant-isolation.test.ts`, and `git diff --check`: PASS.

## Bounded application reopening fix — 2026-10-21

Base: `fa8e5a44c6abbf365c62a29628ca6f9f08e61532`, verified against remote freeze3-dev. Prior authorization/travel, summary, outcome persistence/isolation and NOT_FOUND fixes were already present.

A real transition from closed/rejected to an active stage retained the stale outcome and closedAt. Clear those fields on a non-closing transition without a new outcome; keep notes/no_change and historical rejection events intact. Existing tenant/user-scoped reads and writes are unchanged.

Regression executed before fix: 1 failed, 15 skipped, asserting stale rejected/closedAt values. After fix: applicationTracking.test.ts and tenant-isolation.test.ts, 23/23 PASS on Node 22 / Vitest 4.1.6. Orchestrator check:types, targeted Biome ci and git diff --check PASS. Initial sandbox attempt ran zero tests due to temporary-file EPERM; actual runs succeeded outside that restriction using synthetic local data.

Full CI/E2E not run in this user-requested bounded cycle. GitHub connector returned no workflow runs for the base SHA, which does not prove green CI. Commit uses [skip ci] to avoid push-triggered deployment. No production or real applications touched. Next bounded lifecycle check: timeline date edits that move the latest event into the past and reconciliation of current application state.

## Bounded timeline date correction — 2026-10-21

Base and remote HEAD verified: `df8a40e9ae95ea2589d2c91fac174d0bb820f367`. Previous reopening fix already present. Reproduced stale rejected/closedAt after moving the latest rejection before an interview: focused regression failed before the patch.

Date edits now remember the previously latest event within the same transaction and private data scope, then reconcile from the new latest stage when that event is displaced. Regression covers moving backward, editing an older event without changing current outcome, moving forward again, and preserving history. Notes keep their existing behavior; reconciliation when a note is the newest remaining event is a separate follow-up.

Final actual execution: applicationTracking.test.ts + tenant-isolation.test.ts, 24/24 PASS (Node 22 / Vitest 4.1.6). Orchestrator check:types, targeted Biome ci and git diff --check PASS. Full CI/E2E not run, per bounded scope. [skip ci] prevents automatic deployment. No production, PDF, real applications or PII. Next: inspect stage reconciliation when a later note masks the latest substantive stage.

## Bounded note masking fix — 2026-10-21

Base/remote HEAD: `bfd210f389940388cfd00df621780ef1caf5f85a`. Previous reopening and date correction fixes already present. Three executed regressions failed before the patch: a later ordinary note masked stage edits, date corrections and deletion, retaining stale rejected/closedAt.

The three reconciliation queries now exclude ordinary notes before selecting the latest event, retaining private tenant/user scope and existing handling of notes with explicit outcomes. Notes remain in history; deleting the last substantive stage resets current state even when annotations remain. Added coverage for all three operations and preservation of explicit note outcomes. An intermediate run had 27 pass / 1 fail and prompted restoration of the existing explicit-outcome note guard.

Orchestrator check:types, targeted Biome ci and git diff --check passed. Full CI/E2E not run in this bounded cycle. [skip ci] prevents automatic deployment; no production, PDF, real applications or PII. Next bounded check: deterministic stage ordering when multiple events share the same second.
`Final execution: applicationTracking.test.ts + tenant-isolation.test.ts, 28/28 PASS on Node 22 / Vitest 4.1.6, exit 0.`

## Bounded same-second event ordering fix — 2026-10-21

Base and remote HEAD verified: `6847274e3e30ae8e918e06a69377e121ebf2fcb4`. Existing reopening, date correction and note masking fixes retained. Executed regression failed before patch: the third same-second transition incorrectly reported applied rather than recruiter_screen as its previous stage.

History reads and all four latest-event selections now break timestamp ties by SQLite rowid insertion order (ascending for history, descending for latest). This uses the existing SQLite rowid table without a migration; date edits do not change the tie-breaker. This is local database ordering, not a portable ordering guarantee across arbitrary export/reimport procedures.

Actual focused execution: applicationTracking.test.ts + tenant-isolation.test.ts, 29/29 PASS on Node 22 / Vitest 4.1.6. Coverage includes transition ancestry, history order, historical edits, moving an event out of and back into a tie, and deleting tied events. Targeted Biome ci and git diff --check PASS after fixing one formatting issue. Full CI/E2E not run in this bounded cycle. [skip ci] prevents deployment; no production, PDF, real applications or PII.

Next bounded lifecycle check: inserting a backdated stage must not overwrite the current state established by a newer event.
Orchestrator check:types: PASS, exit 0.

## Bounded backdated stage insertion fix — 2026-10-22

Base and remote HEAD verified: `1dd8c694a1e74b6c582dc81e9a085341522a1657`. Prior lifecycle fixes already present. Source inspection showed transitionStage unconditionally overwrote current status/outcome for historical inserts.

Compare the inserted timestamp with the latest state-bearing event in the existing scoped transaction. Historical inserts retain their history without updating current status, outcome, closedAt or appliedAt; ties still use the newer insertion. Ordinary annotations do not block a newer substantive transition. Tests cover preserving both active and closed current states and a later annotation.

The initial targeted run loaded the patched service after slow environment startup: 2 passed / 23 skipped. It is NOT pre-fix failure evidence. Targeted Biome ci and git diff --check passed. Full CI/E2E not run in this bounded cycle. [skip ci] prevents deployment. No production, PDF, real applications or PII.

Next bounded check: historical stage ancestry (fromStage) should reflect the chronological predecessor rather than a future stage.
Validation: first two-file run 30 passed / 2 failed after API setup timeout, mock error and temporary DB EBUSY. Unchanged code rerun with --no-file-parallelism: 32/32 PASS, exit 0 (Node 22 / Vitest 4.1.6). Orchestrator check:types PASS, exit 0.

## D finalization — 2026-10-28 (bounded, not accepted)

Remote baseline: `6f37b4a78ef8707c690b4537885ee90bc72c4699`. Transfer only the explicit wrong-requisition QA guard and synthetic regression from the preserved local candidate; import/profile/parser and unrelated experiments remain local.

Reproduced on baseline: wrong explicit target incorrectly passed QA (1 failed, 1 passed, 5 skipped). After guard: 16/16 focused QA, approval, export and private-isolation tests passed. Corrected an optional-basics typing issue in the regression fixture; final QA-only rerun and focused types/Biome/diff checks recorded in local evidence. No broad CI or deployment acceptance claimed.

The existing private test package was corrected in place with a backup: target corrected, unsupported travel wording removed, cover expanded from pinned source experience, candidate history/education/credentials unchanged. Separate-process reload retained CV, cover and review notes. Unapproved export rejected; no approval, submission, employer outcome, profile or job-state change. Private artifacts are not in GitHub.

Product PASS is not established: exact master/template comparisons still block editorial changes. Hard requirement gaps remain; eligibility UNKNOWN and real application NOT APPROVED. D FAIL; E not ready. No suitable substitute was proven or newly searched. This commit uses [skip ci]; production and running test UI remain untouched.

## D consolidation and deterministic editorial QA — 2026-10-28

Remote base verified: `ae7739daf0b7eeb0da080265cba4cb0c41ae3b8f`. Consolidates the three preserved D dependencies (mandatory-section parsing, confirmed-source profile versioning, detailed local document import), excluding unrelated scoring/UX/tracking work. Existing checkouts and uncommitted work are preserved.

QA now accepts inert prose formatting, complete cover-evidence bullet reordering and bounded salutation/sign-off changes. Explicit CV target paragraphs can be regenerated from the selected posting, without changing employment history. All other structured facts and prose assertions remain protected. Arbitrary paraphrases are deliberately not certified. Cover evidence must resolve to the exact pinned profile atom; a forged evidence map cannot authorize new claims. Unresolved hard gaps now block QA, approval and export instead of merely being counted. UNKNOWN vacancy state still requires acknowledgement and is never converted to ACTIVE.

Executed local validation: the dependency batch had 78 passing tests and one target-compatibility regression failure; that regression was corrected. Subsequent QA/editorial/generation/approval/export/private-isolation batch: 41/41 PASS. Final QA/approval/export plus a new synthetic lifecycle test: 34/34 PASS. The lifecycle proves review, rejection of unapproved export, explicit simulated approval/export, simulated outcome, exact package/note/history persistence across closing and reopening SQLite. These counts overlap; they are not an aggregate. Focused backend types and targeted Biome exit 0. Initial Windows sandbox runs executed zero tests; successful executions used the existing Node 22 dependencies. No full CI/build/deploy claim.

Real-data acceptance remains **NOT ACCEPTED / D FAIL**: one existing Ready alternative was selected for testing, but the server replay has not executed. Automatic safety review rejected transferring the full private database locally; no database was downloaded. A separate test snapshot was successfully created on the same server. Safety review then rejected uploading the isolated source/test runner pending explicit authorization. The running service and original database were not changed. Existing KONE six-hard-gap result is historical until replayed against this candidate. Synthetic hard-gap blocking is verified; real KONE negative replay and the real Ready positive package flow remain pending. Employer work-permit position is UNKNOWN, separately from product acceptance. No real approval, application, employer response, production deploy or tag. E remains gated.


## Authorized isolated D replay — 2026-10-28

Executed after explicit user authorization on source revision `fe79769589da0738fd3f82364a8e5ab4ab7a1e88` (local commit `20a9f2d3dc3c2e94ee564dbd1c65bbc05382aa25`, identical tree `83280fcad5050b9037f698841ca0616552cce0be`). Source archive SHA256: `d560db96a2b828190d2bb025926fd7d1ebace3150293f98e10324f735f5be9cc`. Source ran in an isolated directory with DATA_DIR pointing only to the same-server test snapshot; no service deployment.

- KONE negative control PASS: six hard gaps and eleven total gaps retained; QA rejects the package, approval rejects it, and the original package remains unchanged. Editorial differences in that historical package are still outside the deterministic proof allowed by this patch; no arbitrary paraphrase was approved.
- One existing Ready alternative, Techlift field service forklift technician, was generated and stored in review. CV/cover factual QA accepts the deterministic draft with editorial greeting/sign-off changes. Overall package QA FAIL: one mandatory requirement remains unsupported (at least one year repairing forklifts or similar equipment); French is only a warning. Existing source confirms industrial equipment maintenance, but does not explicitly establish forklift repair or the required equivalence. This is not a finding that the candidate lacks relevant experience. The conservative mapper does not adjudicate equipment equivalence; no unsupported positive evidence was inserted.
- Vacancy live state remained UNKNOWN with explicit acknowledgement only for this isolated test. Employer work-permit position remained UNKNOWN, independently of the product result. No new discovery or broad Ready audit.
- Unapproved export rejected. Since overall QA failed, no simulated approval/export or employer outcome was forced on this real-vacancy copy. Those success paths have only the previously recorded synthetic evidence.
- Separate process reload PASS: exact package, review note and history persisted. Server-side hash comparisons confirmed jobs, profile versions, strategy versions, market postings and stage events equal the live originals; KONE unchanged and the new simulated package absent from the live database. Only boolean checks left the server; private artifacts remain there.

**D FAIL / NOT ACCEPTED; E not ready.** The outstanding condition is a real suitable-vacancy positive flow with supported mandatory evidence, followed by simulated approval/export and outcome. This replay resolves the previous execution-permission blocker, but does not supply missing qualification evidence. No PII committed, real candidate approval, actual application, employer response, production deploy or release tag. Evidence-only commit uses [skip ci].
