# Freeze 3 current checkpoint

Updated: 2026-10-04 â€” F3-7 audit series

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
- `932f07f` passed full CI (`37175911187`): bounded shared-discovery coordinator is green with exact opaque fingerprinting, clean-result single-flight/cache reuse, bounded retention, cloned outputs, and no propagation/cache of challenged/degraded/failed source results.
- `7f7bf7f` passed full CI (`37176478379`): safe public discovery reuse is integrated behind explicit extractor opt-in (initially JobSpy), and the two-candidate regression proves one heavy extractor execution for identical shareable discovery.
- `06922d7` passed full CI (`37176824585`): F3-4 Multi-user <=5 acceptance and the anti-interruption protocol/tooling are durable. F3-4 is PASS/CLOSED.
- `f3342f0` passed full CI (`37177075551`): the F3-5 Product onboarding + UX gap audit is durable.
- `270dde2` passed full CI (`37178139713`): the strategy-onboarding domain foundation and focused tests are green.
- `bbd3b9b` passed full CI (`37178545823`): interruption forensics/protocol hardening is durable. The 29 stale blocked Desktop Commander session shells were removed only after Git/CI state was verified; no committed project work was lost.
- `2eca0fc` passed full CI (`37179604406`): F3-5B hosted strategy onboarding is green with draft preview and explicit activation.
- `161f9d1` passed full CI (`37180466861`): F3-5C adaptive-question service/API is green with deterministic fallback and UNKNOWN-preserving merge rules.
- `73a96e6` passed full CI (`37180719512`): adaptive prompts are wired into candidate strategy onboarding without allowing AI to infer answers or constraints.
- `50e34f1` passed full CI (`37182828222`): F3-5A simplified hosted candidate navigation is green after moving admin-role resolution out of ordinary PageHeader rendering.
- `2b26269` passed full CI (`37183727561`): optional browser voice input is capability-gated, hidden when unsupported, and text remains the required path.
- `fbf8404` passed full CI (`37183950537`): confirming the first resume creates/activates the first Master Career Profile without a hidden developer-only bootstrap step.
- `e760795` passed full CI (`37187585818`): fresh-candidate API acceptance is green.
- `59bcf7f` passed full CI (`37189610439`): fresh hosted candidate can sign up, configure profile/strategy, import+confirm resume, obtain active profile/strategy, and become search-ready/application-package-ready through product APIs.
- `50eca8d` passed full CI (`37190131324`): F3-5 acceptance record is durable. F3-5 Product onboarding + UX is PASS/CLOSED.
- `2451e0c` passed full CI (`37190348925`): F3-6 gap audit and refreshed anti-interruption checkpoint are durable.
- `e660de2` passed full CI (`37190741644`): F3-6A authoritative LIVE/CLOSED/UNKNOWN vacancy gate is green.
- `1a05e87` passed full CI (`37191002651`): candidate-facing live-gate API and cross-tenant isolation regression are green.
- `44e42b0` CI (`37191286628`) failed one new focused requirement/evidence test while 340 test files passed; root cause was an experience-with-years statement being classified as a skill because it contained PLC.
- `bb4785e` passed full CI (`37191562665`): the narrow experience-classification repair is green.
- `3295132` passed full CI (`37195192049`): live gate + requirement extraction + verified evidence/gap mapping composition is green.
- `ff58e9d` CI (`37195432886`) exposed one TypeScript-only import error in the new application-draft orchestration; feature logic was not accepted from that run.
- `10032b3` passed full CI (`37195666555`): F3-6 draft orchestration is green. `Prepare application` now pins posting/profile/strategy/generation-policy versions, persists verified evidence/gaps, enforces CLOSED/UNKNOWN rules, and has hosted API tenant-isolation/persistence acceptance coverage.
- `90c5cd6` CI (`37196037173`) failed only the new generation test typing; feature logic was not accepted from that run.
- `9e363b7` passed full CI (`37196231237`): truth-constrained targeted CV and evidence-bounded cover-letter generation are green.
- `5a5f949` passed full CI (`37196451850`): package QA truth/staleness gate is green.
- `d978abb` passed full CI (`37196858201`): QA evaluation and explicit approval orchestration are green.
- `b941a4d` passed full CI (`37221251524`): pinned-version candidate review API is green.
- `4ed8b9a` passed full CI (`37221487307`): job-facing package facade is green.
- `735db7f` passed full CI (`37221909072`): candidate Prepare application / review / approval UI is green.
- `2172a7d` passed full CI (`37222245114`): approved-package export re-runs QA, marks the package exported, and provides the candidate export artifact.
- bf68d75 full CI 37222619720 is verified completed/success. F3-6 truth regression and product API acceptance are PASS/CLOSED.
- Focused local Vitest cannot start in this VPS worktree because some frontend test dependencies are intentionally absent; no install is permitted while root disk remains under critical pressure. Full GitHub CI remains authoritative.
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

F3-6 PASS/CLOSED at bf68d75 (full CI 37222619720 success). Application code unchanged.
F3-7 remains OPEN / NOT ACCEPTED. Snapshot/migration/integrity/counts/backup-restore/Freeze 2 rollback PASS from Series 1. Source-overlay Freeze 3 startup+restart and migrated credential invariants PASS from Series 2.
Measured unchanged-overlap replay PASS within stated scope: 1267 rows, second pass 46.461s, 0 scoring, historical jobs hash unchanged. Full daily-delta gate FAILS on a new integration finding: material same-URL posting change creates a new version but schedules no reevaluation. Resource gate still FAIL (~93% disk).
Read FREEZE3_F3_7_DELTA_GAP.md and evidence/F3_7_SERIES2.json. Next unit is versioned-delta runtime integration with focused acceptance. Preserve /opt/career-os-next/f3-7-acceptance-20261004. Working lane now contains two overlap runs and one labelled changed-posting probe; baseline lane remains unchanged. No new production snapshot needed for reproducing this gap.
No final tag/cutover or production prefilter activation. No destructive cleanup; 4GiB /root/career-os-next/swapfile is active. Capacity question sent to user; no answer assumed. Final immutable image, live daily performance and stability evidence remain outstanding.

## Compact diagnostics / anti-limit rules

- Never emit a full GitHub Actions job log into chat/tool output. Query run -> failed job -> steps first; if log text is required, filter it inside the tool call and emit only the focused failure window.
- Keep shell reads bounded (`head`/`tail`/targeted `grep`/small `sed` ranges); do not dump whole large files or recursive results.
- Long commands run via the resilience wrapper or background process; status checks return compact state only.
- Work proceeds in small committed series with a durable checkpoint after each validated unit, so a chat/tool interruption cannot erase completed work.

## Safety / no-repeat rules

- Repo/CI/DB evidence outranks chat narrative.
- One pushed SHA under CI validation at a time.
- One substantial unpushed unit maximum.
- No production migration/deploy while Freeze 3 validation is incomplete.
- No duplicate R0 scoring or discovery.
- No blind CI reruns.
- No Docker image/container deletion without inspected rollback safety.

## Latest checkpoint — 2026-10-05 Series 3

- Source tree `6d9d61c2fe5b37c12b5a0e7d3aa29521c9f6561d` is validated by CI run `37389730244` SUCCESS through source-equivalent commit `5454f371fe3a0e48a623dbd65b1f1d0e588a9c3d`.
- Immutable image `career-os-freeze3:7e5a411` passed startup/restart, focused versioned-delta acceptance, ordinary-path 1,257-job bulk acceptance, and duplicate-legacy fallback acceptance.
- F3-7 versioned-delta/runtime integration blocker is CLOSED.
- Production is still untouched. F3-7 overall cutover remains OPEN only for resource/capacity acceptance, 3-5 clean daily stability runs, and final explicit cutover approval.
- Evidence: `evidence/F3_7_SERIES3.json`.
- Do not repeat F3-0..F3-6 or Series 1/2 acceptance. Next unit is resource/capacity gate on the actual runtime host, then controlled daily-run stability evidence.
