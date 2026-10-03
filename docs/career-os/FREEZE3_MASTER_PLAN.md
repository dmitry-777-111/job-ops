# CAREER OS Freeze 3 — Product and Architecture Master Plan

Status: PLANNED / DESIGN FROZEN FOR IMPLEMENTATION
Date: 2026-10-03
Base production: Freeze 2 (`47b807e`)
Recovery branch head at planning time: `5b5855c`
Target scale: up to 5 active candidates in the foreseeable future

## 1. Product objective

CAREER OS v3 must evolve from a Dmitrii-specific job-search pipeline into a small, reliable, user-agnostic career operating system that can:

1. onboard a candidate without code changes;
2. ingest a master resume/profile and connected sources;
3. capture preferences, legal/work-authorization constraints and career goals;
4. search and normalize vacancies;
5. evaluate each vacancy against the whole candidate situation;
6. preserve recall while cheaply removing obvious noise before expensive AI scoring;
7. shortlist decision-worthy opportunities;
8. prepare truthful, vacancy-specific CV/CL/application packages from verified master facts;
9. track applications and inbound responses;
10. learn from outcomes without silently rewriting candidate facts or strategy;
11. remain international-ready while Canada is the only market that must be fully enabled now.

Principle: **simple for the candidate, explicit and auditable internally**.

## 2. Explicit non-goals for Freeze 3

Do not add complexity that is not justified by the next 5 users.

- No Kubernetes or distributed cluster.
- No premature 50+ user architecture.
- No fully autonomous job submission.
- No simultaneous implementation of every international market.
- No direct AI mutation of hard constraints or verified candidate facts.
- No reprocessing of historical inventory without a specific version/change reason.
- No production feature development in the live Freeze 2 container.

## 3. Architecture doctrine

### 3.1 Separate shared market facts from candidate-specific state

The current `jobs` model mixes a posting with one user's evaluation/state. V3 should move toward two layers:

**Shared Market Inventory**
- canonical vacancy/posting identity;
- source observations and source IDs;
- employer/title/location/description;
- posting dates/deadlines;
- canonical ATS URL;
- content fingerprint/version;
- live/closed/stale evidence;
- source provenance.

**Candidate Workspace**
- candidate/profile version;
- strategy version;
- run membership;
- hard-gate decisions;
- prefilter disposition;
- AI score/reason;
- candidate-specific immigration/work-authorization assessment;
- shortlist/application status;
- package versions and outcomes.

This allows one market discovery to serve several candidates while preserving strict candidate isolation.

### 3.2 Candidate as isolated workspace/tenant

For the expected scale (<=5), use the existing users/tenants/memberships foundation rather than introducing a new identity platform.

Recommended model:
- one candidate workspace = one tenant;
- candidate user owns their tenant;
- an operator/admin may be a member of several candidate tenants;
- candidate-sensitive documents/tokens/evaluations never live in shared market tables;
- shared market inventory contains only public vacancy/employer facts.

### 3.3 Versioned source of truth

Create versioned objects rather than overwriting history:

- `MasterCareerProfileVersion`
- `StrategyProfileVersion`
- `ResumeMasterVersion`
- `MarketPostingVersion` / content hash
- `CandidateEvaluationVersion` or evaluation keyed by profile+strategy+posting versions
- `ApplicationPackageVersion`

A change in one layer should invalidate only dependent outputs.

Example: adding Calgary to geography must not force parsing/scoring of unchanged Ontario history.

## 4. Candidate profile and strategy model

### 4.1 Master Career Profile

Built from:
- uploaded CV/DOCX/PDF;
- existing resume editor/profile;
- optional professional profile links;
- job-board data where legally and technically available;
- candidate answers;
- optional voice/text interview.

Store facts with provenance and confidence. AI may normalize wording but must not invent facts.

### 4.2 Candidate Preferences & Constraints Layer

Every preference must be typed, not left as free-form prompt text.

Constraint classes:

**HARD**
- current legal/work authorization;
- mandatory visa/travel inability;
- explicitly excluded geography;
- mandatory language missing;
- user-declared absolute exclusions.

**SOFT**
- preferred salary;
- preferred role family;
- commute preference;
- remote/hybrid preference;
- industry preference;
- desired seniority.

**CONTEXTUAL**
- lower salary acceptable if immigration support is strong;
- stretch role acceptable if training/onboarding is strong;
- relocation acceptable for materially better opportunity;
- temporary restrictions with expiry/recheck conditions.

Each constraint stores:
- normalized value;
- source (`candidate`, `resume`, `derived`, `admin`);
- confidence;
- effective date;
- optional expiry/recheck trigger;
- HARD/SOFT/CONTEXTUAL class;
- explanation.

AI interprets contextual trade-offs but cannot silently promote/demote HARD rules.

### 4.3 Adaptive onboarding interview

Onboarding should not ask a fixed long questionnaire.

Flow:
1. parse resume/profile;
2. identify missing decision-critical facts;
3. ask only the missing questions;
4. allow voice or text answers;
5. transform answers into structured candidate/strategy records;
6. show a human-readable confirmation screen;
7. activate search only after confirmation.

Candidate can later edit strategy by UI, text, or voice. Changes create a new strategy version and display the exact delta before activation.

## 5. International-ready, not international-enabled

Do not hardcode Canada as the universal model.

Introduce a `MarketAdapter` / `CountryAdapter` boundary containing:
- country/region normalization;
- supported sources;
- currency and salary normalization;
- occupational classification mapping;
- work-authorization/visa vocabulary and evidence model;
- immigration/employer-support evaluator;
- language/localization rules;
- country-specific source capabilities.

Canada remains the first fully enabled adapter.

Canada-specific concepts (`NOC`, `LMIA`, `OINP`, Canadian work permits, CAD-specific wage rules) must live behind the Canada adapter rather than in universal candidate/job entities.

Future adapters can be added for USA, Mexico, Brazil, Argentina, Australia, Russia, etc. without rewriting core pipeline logic.

The repository already contains broad country/location support for multiple sources; V3 should preserve and formalize that capability rather than replacing it.

## 6. Discovery, identity and run model

### 6.1 Run isolation

Every discovered/observed item must have explicit run membership.

Introduce a run-item/observation table such as:
- `pipeline_run_items`
  - run_id
  - market_posting_id / observation_id
  - source_run_id
  - stage
  - stage_status
  - timestamps
  - retry/error metadata

Scoring/recovery must query the run's items, never all globally unscored jobs.

### 6.2 Delta-only daily behavior

Normal daily operation:
- resume from source cursor/checkpoint;
- fetch only new/changed observations plus deliberate overlap;
- canonicalize identity;
- skip unchanged candidate evaluations;
- re-evaluate only when posting/profile/strategy/policy version materially changes.

Historical inventory remains available as evidence but is not a daily compute burden.

### 6.3 Vacancy identity hierarchy

Prefer, in order:
1. official ATS requisition ID;
2. stable source job ID;
3. canonical official ATS URL;
4. source canonical URL;
5. employer + title + location + evidence-backed fallback.

Fuzzy employer/title matching must become a **possible-duplicate signal**, not an irreversible merge unless corroborated.

Keep source observations even when multiple observations resolve to one canonical posting.

### 6.4 Freshness model

Distinguish:
- first observed;
- last observed;
- source posted date;
- source update date;
- official live check date;
- closed/expired evidence.

Do not infer closed solely from age. Old but live postings are permitted.

## 7. Safe deterministic prefilter

The prefilter is candidate-specific and runs before expensive LLM scoring.

Three outcomes only:
- `PASS_TO_AI`
- `SAFE_REJECT`
- `UNCERTAIN_TO_AI`

Rules:
- title alone is never sufficient for rejecting a plausible target-family role;
- missing salary/support data is UNKNOWN, not FAIL;
- one missing preferred skill is not a hard reject;
- hard rejection requires strong structured evidence;
- every reject stores reason/evidence/rule version.

Release process:
1. build rule set from R0 evidence;
2. run in shadow mode on already scored inventory;
3. compute savings and false-negative sample;
4. regression against all known A1-A3/decision-worthy examples and boundary roles;
5. enable only if no known valuable case is lost and sampled borderline loss is acceptable;
6. continue audit sampling after launch.

## 8. AI evaluation

AI evaluates the complete candidate context after deterministic gates.

Inputs are versioned:
- posting version;
- career profile version;
- strategy version;
- market/country adapter version;
- scoring policy version.

Outputs must separate:
- factual fit;
- career value;
- compensation;
- work authorization/immigration feasibility;
- location/travel feasibility;
- uncertainties needing verification;
- rationale.

Do not collapse UNKNOWN into negative evidence.

## 9. Application Package Builder

Freeze 3 includes the architecture and MVP for candidate-selected vacancies.

Flow:
`Selected vacancy -> authoritative live gate -> requirement extraction -> verified evidence map -> CV tailoring -> CL -> QA -> candidate approval -> export`

Master resume/profile is immutable evidence; vacancy-specific documents are derivatives.

Required artifacts:
- ATS-friendly targeted CV;
- optional longer Workday/SAP-style CV/application dataset;
- cover letter;
- prepared answers for common application form questions;
- evidence/gap report;
- DOCX/PDF export where supported.

Truth constraints:
- generated claim must map to verified candidate evidence;
- unsupported requirement stays a gap;
- no invented licence, diploma, work authorization, language, experience, software or achievement;
- package stores profile version + posting version + generation policy version;
- if underlying vacancy/profile materially changes, package becomes stale and requires regeneration/review.

Existing Resume Studio, tailoring services and PDF pipeline should be reused rather than replaced.

## 10. Post-application learning loop

Keep search, package creation and outcomes connected:
- applied;
- recruiter response;
- interview;
- rejection reason if known;
- offer/outcome.

Learning can suggest strategy changes but cannot silently apply them.

The system should distinguish candidate-market feedback from source/pipeline defects.

## 11. UX / interface doctrine

The product should feel like a simple consumer workflow, not an engineering dashboard.

### Candidate-facing primary navigation

Keep the primary model to roughly five destinations:
1. **Today** — what needs attention now;
2. **Matches** — ranked/filtered vacancies;
3. **Applications** — prepared/submitted/status;
4. **Profile & Strategy** — resume, goals, constraints;
5. **Connections** — Gmail/job-board/source status.

Advanced pipeline/source/debug controls move behind an Admin/Diagnostics view.

### Onboarding

Use progressive disclosure:
1. Add resume/profile
2. Tell us what you want (voice/text supported)
3. Connect accounts/sources
4. Review "What CAREER OS understood"
5. Start

Do not expose NOC/adapter/checkpoint/scoring implementation language to ordinary candidates unless requested.

### Strategy editor

Two synchronized views:
- natural-language/voice edit;
- structured summary cards for geography, compensation, work authorization, travel, role targets, exclusions and conditional preferences.

Before activation show a delta summary: `old -> new` and likely search impact.

### Vacancy card

Show only decision-relevant signals first:
- fit;
- location;
- pay;
- work authorization/support;
- freshness/live state;
- key risk/unknown;
- action: Save / Prepare application / Reject.

Technical evidence and source provenance are expandable, not primary.

### Application package UI

One action: `Prepare application`.
Then a review screen with:
- requirements coverage;
- unsupported gaps;
- CV preview;
- CL preview;
- changed-from-master highlights;
- explicit candidate approval/export.

## 12. Security and privacy requirements

Multi-user mode raises the security bar.

Mandatory before real external users:
- strict tenant isolation tests for every candidate-sensitive repository/API;
- OAuth/job-board credentials must not be returned to clients/logs;
- encrypt stored integration credentials/tokens at rest with a server-held key or external secret store;
- rotate/remove secrets from inspectable runtime configuration where feasible;
- redact secrets in diagnostic logs and exports;
- least-privilege OAuth scopes;
- CSRF/state validation for OAuth;
- session/JWT expiry and revocation behavior tested;
- per-user/tenant rate limits and usage quotas;
- uploaded resumes and generated documents scoped to tenant/user;
- admin impersonation, if ever added, must be explicit and audited;
- backups containing candidate data must be protected and retention-limited.

Current stored integration credentials are a design area requiring hardening before onboarding unrelated users.

## 13. Reliability and operational design

### Worker model

Use one bounded queue on the current VPS for <=5 candidates.
Do not run all candidate heavy pipelines concurrently.

Per-job worker state:
- queued;
- running;
- checkpointed;
- waiting_external;
- completed;
- failed_retryable;
- failed_terminal.

### Checkpoints

Checkpoint at source/discovery and expensive processing boundaries.
Restart must resume exact unfinished items.

### Health

Separate:
- web/API health;
- worker heartbeat;
- queue progress;
- source health.

A non-HTTP worker must not be labelled failed merely because it does not answer the web-container health probe.

Detect true stall from `last_progress_at`, queue depth and item progress.

### Scheduling

One scheduler owns automatic candidate runs.
One lock prevents overlapping runs for the same candidate.
A failed run does not trigger a full historical restart.

### Resource controls

Current small VPS remains sufficient for <=5 users after optimization, but enforce:
- disk warning ~80%;
- block optional image/build work >=85%;
- cleanup action >=90%;
- log rotation;
- image retention policy;
- worker concurrency limits;
- queue backpressure.

Do not build/pull large images during a critical production run unless required for recovery.

## 14. Continuous monitoring while Freeze 3 is developed

Freeze 3 development must not stop Dmitrii's vacancy monitoring.

Use blue/green separation:

**Production lane**
- Freeze 2 remains on the production port/database;
- after R0, deploy only the already validated recovery/stability patch needed for normal daily operation;
- no Freeze 3 feature work directly in production;
- daily monitoring continues on the stable production configuration.

**Freeze 3 development lane**
- separate branch/worktree;
- separate dev/test database copied or synthesized from production evidence;
- different local port/container names;
- no write access to production DB;
- CI and isolated candidate image before any cutover.

Critical production bugs may be fixed in a small maintenance branch and then forward-merged into Freeze 3. Avoid reverse cherry-pick chaos.

Cutover only after Freeze 3 acceptance passes. Preserve Freeze 2 as rollback.

## 15. Freeze 3 implementation phases

### F3-0 — R0 closure and baseline
Gate:
- current scoring/recovery terminal;
- R0 loss funnel captured;
- DB integrity clean;
- no unaccounted unfinished R0 items.

Outputs:
- final bottleneck metrics;
- prefilter shadow dataset;
- known-value regression corpus.

### F3-1 — Reliability foundation
- run-item membership/isolation;
- exact scoring recovery semantics;
- worker heartbeat/progress;
- scheduler ownership/lock;
- disk/log safeguards;
- identity/dedupe hardening;
- delta/idempotency rules.

Gate: interrupted and uninterrupted controlled runs produce equivalent terminal results.

### F3-2 — Candidate/strategy domain
- versioned Master Career Profile;
- versioned Strategy Profile;
- HARD/SOFT/CONTEXTUAL constraints;
- effective/expiry/recheck metadata;
- Canada-specific logic moved behind adapter boundaries;
- migration from current Dmitrii settings without behavior regression.

Gate: current Dmitrii search output remains functionally equivalent under the new configuration model.

### F3-3 — Safe prefilter
- shadow implementation;
- false-negative regression;
- staged activation;
- measurable AI-call savings.

Gate: no known decision-worthy regression; audit sample acceptable.

### F3-4 — Multi-user <=5
- candidate tenant onboarding;
- per-user credentials/settings;
- queue/fairness;
- strict isolation tests;
- credential encryption;
- admin view for multiple candidate workspaces.

Gate: two-candidate test proves no data/token/status leakage and no duplicate heavy discovery when shareable.

### F3-5 — Product onboarding + UX
- resume/profile upload/import;
- adaptive AI questions;
- voice/text strategy input if available in client environment;
- confirmation screen;
- simplified Today/Matches/Applications/Profile/Connections navigation;
- advanced diagnostics hidden from candidate default UI.

Gate: a fresh test candidate can start without editing source/config files.

### F3-6 — Application Package Builder MVP
- authoritative live vacancy gate;
- requirement/evidence mapping;
- targeted CV;
- cover letter;
- QA/truth gate;
- preview/export;
- version/staleness tracking.

Gate: package cannot introduce unsupported candidate facts in regression corpus.

### F3-7 — Freeze 3 acceptance/cutover
- full CI;
- DB migration on copy;
- backup/restore;
- restart/recovery;
- multi-user isolation tests;
- prefilter false-negative regression;
- daily delta performance test;
- package truth regression;
- resource/disk test;
- rollback from migrated DB to Freeze 2 where schema compatibility permits, otherwise explicit restore rollback drill.

Then tag and freeze an immutable Freeze 3 image and checkpoint.

## 16. Acceptance metrics

Freeze 3 is not accepted merely because the UI works.

Operational targets for <=5 users:
- no historical full rescoring during ordinary daily run;
- no overlapping run for the same candidate;
- exact resume after controlled interruption;
- unchanged posting + unchanged profile/strategy => no repeated AI scoring;
- source/run progress measurable;
- prefilter savings measured with false-negative audit;
- candidate isolation regression PASS;
- credentials never exposed by candidate-facing APIs/logs;
- production monitoring continues during development;
- 3–5 consecutive clean daily runs before calling the new runtime stable.

Do not claim literal 100% market recall. Continue measured forward coverage and documented blind spots.

## 17. Change discipline

- Delta-first.
- Evidence-first.
- One architectural problem per change set where practical.
- Tests before production cutover.
- No speculative fixes without a demonstrated failure mode.
- Preserve known-good Freeze 2 rollback until Freeze 3 proves stable.
- Never modify live production schema/code just to accelerate feature development.
- Keep product configuration separate from source code so future candidates do not require code edits.

