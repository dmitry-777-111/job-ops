# CAREER OS — Adaptive Candidate Experience & Account UX Implementation Plan v1.0

Status: APPROVED FOR IMPLEMENTATION AFTER DOCUMENTATION GATE
Date: 2026-10-06
Branch: freeze3-dev
Production: Freeze 2 remains untouched
Primary review target: isolated Windows staging before any production cutover

## 1. Objective

Deliver a candidate-facing Pathfinder experience that is simple at the surface, adaptive to candidate behavior, evidence-driven underneath, and safe for a small multi-user system.

The visible journey is:

1. Tell us about yourself
2. Tell us what you want
3. Receive suitable jobs
4. Receive an application-ready package
5. Improve using application outcomes, profile analysis, and market feedback

Stage 5 is continuous. It must improve quality of fit, not merely increase application volume.

## 2. Product rules

1. Candidate facts and hard constraints are never silently rewritten.
2. Strategy changes are versioned and require explicit candidate confirmation.
3. Recommendations must show why they exist.
4. The system may select the most useful landing state automatically, but the user can always navigate manually.
5. Quality metrics take priority over raw application count.
6. Candidate calibration must avoid insulting labels. Use evidence-based states: supported, possibly conservative, possibly aggressive, insufficient evidence.
7. Cross-platform recommendations can cover Pathfinder, LinkedIn, Indeed, Job Bank, employer career sites and other supported channels.
8. The system never assumes an external profile change happened unless it is observed or confirmed.
9. AI is optional for explanation/writing. Cheap deterministic aggregation is the default.
10. Current Freeze 2 production remains unchanged until resource and cutover gates pass.

## 3. Existing assets to reuse

Do not rebuild capabilities that already exist.

Available:
- users / tenants / memberships foundation;
- candidate vs system-admin role distinction;
- hosted signup and first-admin setup;
- remembered usernames and account-switch entry points;
- admin workspace-user creation;
- admin reset-password API;
- self-service changeOwnPassword API;
- light/dark theme;
- voice input component;
- candidate onboarding profile / strategy / model / resume flow;
- candidate home / jobs / applications / profile pages;
- versioned candidate strategy;
- application package workflow;
- application outcome/stage events;
- pipeline run evidence and scoring infrastructure;
- shared-market / candidate-specific F3-7 architecture;
- deterministic analytics-capable data already stored in SQLite.

The implementation should integrate these pieces instead of creating parallel systems.

## 4. Resource constraints and execution model

Current VPS resource gate is FAIL:
- disk ~94% used;
- RAM ~2 GB;
- swap ~5 GB effectively exhausted;
- current production and rollback images must be preserved.

Therefore:
- no new production image load;
- no production deploy;
- no destructive VPS cleanup;
- no extra browser/AI background workers on VPS;
- development, type checks, tests and staging run on the Windows worker;
- GitHub CI validates source changes;
- production activation waits for RackNerd capacity resolution and the existing Freeze 3 cutover gates.

Runtime design:
- event-driven aggregation, not continuous polling;
- cached candidate insight snapshots;
- deterministic rules first;
- no per-login bulk LLM analysis;
- no continuous browser automation for improvement analysis;
- recompute only when relevant profile/strategy/application/market events change.

## 5. UX information architecture

Candidate navigation target:
- Today
- Opportunities
- Applications
- Improve
- Profile

System-admin navigation remains richer and role-specific.

### Today

Adaptive landing page. It chooses one primary state:
- setup — missing profile/strategy/resume;
- search — ready but little market evidence;
- apply — strong ready opportunities exist;
- review — package/application attention needed;
- learn — enough evidence exists for profile/strategy recommendations;
- recover — source/auth/profile problem blocks useful work.

The automatic choice must be explainable and not remove manual navigation.

### Opportunities

Candidate-quality shortlist, not raw inventory.

### Applications

Packages, submitted applications, current stages, responses and required actions.

### Improve

Recommendation cards with:
- evidence;
- confidence;
- expected benefit;
- proposed action;
- preview/delta;
- Accept / Edit / Dismiss.

### Profile

Career facts, resume, preferences, constraints, connected platforms and account controls.

## 6. Adaptive recommendation model

### 6.1 Snapshot

Create a cached CandidateInsightSnapshot keyed by:
- workspace/candidate;
- profile version;
- strategy version;
- relevant outcome/event watermark.

Snapshot metrics should include, when enough evidence exists:
- viable match count;
- score distribution;
- salary distribution;
- application count;
- response/screen/interview/rejection rates;
- rates by role family;
- rates by source/platform;
- rates by geography;
- rates by salary band;
- time-to-response;
- ignored high-fit opportunities;
- profile/resume freshness;
- thin/missing experience descriptions.

### 6.2 Deterministic recommendation rules first

Examples:
- salary target appears conservative/aggressive relative to viable matches and outcomes;
- a role family outperforms the declared target;
- a source/platform outperforms or is missing;
- an experience entry lacks decision-useful detail;
- repeated pre-screen rejections suggest profile/role mismatch;
- strong jobs are repeatedly skipped;
- a profile is stale after meaningful career changes.

Each rule has minimum evidence thresholds. No strong claim from tiny samples.

### 6.3 AI use

AI may:
- summarize evidence;
- explain trade-offs;
- draft improved work-history descriptions;
- suggest LinkedIn/Indeed wording;
- generate a human-readable recommendation.

AI may not:
- change verified facts;
- lower/raise salary targets automatically;
- activate new strategy versions without confirmation;
- invent experience, equipment, credentials or results.

## 7. Account and authentication UX

Goal: the current system-admin account and personal candidate account must both be understandable and usable.

Required UI:
- current identity visible in the account menu;
- role badge: System Admin / Candidate;
- workspace name visible;
- Switch account;
- remembered-user chooser;
- Sign out;
- Change my password;
- admin-only user-management entry;
- admin reset candidate password;
- clear confirmation after password changes.

Security:
- passwords never displayed or stored in plaintext;
- reset/change sets a new known password rather than recovering an old one;
- existing password hashes remain authoritative;
- no credentials committed to git or evidence files.

Current installation target:
- preserve existing system-admin account;
- preserve or create the personal candidate account in the intended workspace model;
- assign known passwords interactively through reset/change APIs;
- verify login, logout, account switch and role-specific navigation for both accounts.

## 8. Implementation work packages

### UX-0 — Documentation and acceptance contract

Deliver:
- this plan;
- acceptance checklist;
- explicit no-production rule.

Acceptance:
- plan committed before implementation source changes.

### UX-1 — Account identity and switching

Deliver:
- show current user + role + workspace in account menu;
- make Switch account explicit;
- expose Change password to all authenticated users;
- keep admin user-management/reset capability;
- fix any redirect/account-switch issues.

Acceptance:
- admin -> candidate -> admin switch works;
- no stale privileged navigation after switching;
- passwords can be deliberately reset/changed;
- tests cover both roles.

### UX-2 — Five-stage journey shell

Deliver:
- candidate-facing 1–5 journey on Today/Profile onboarding surfaces;
- preserve existing underlying onboarding steps;
- translate technical setup language into candidate language;
- keep advanced details accessible.

Acceptance:
- first-time candidate can understand what to do without knowing JobOps internals.

### UX-3 — Adaptive Today controller

Deliver:
- deterministic state resolver: setup/search/apply/review/learn/recover;
- selected state becomes default landing content;
- manual tabs remain always available;
- reason for selected state available in UI/debug metadata.

Acceptance:
- fixtures/tests prove each state and manual override behavior.

### UX-4 — Improve page v1

Deliver:
- cached insight model;
- low-cost aggregate metrics;
- first deterministic recommendation set;
- evidence/confidence/action UI;
- Accept/Edit/Dismiss state;
- no automatic strategy mutation.

Initial recommendation rules:
1. salary calibration;
2. role-family response;
3. thin work-history detail;
4. strong-match avoidance;
5. source/platform gap.

Acceptance:
- recommendations do not appear below evidence thresholds;
- proposed profile/strategy changes show preview before activation.

### UX-5 — Application-quality feedback

Deliver:
- outcome metrics by role/source/geography/salary band;
- distinguish application count from response quality;
- feed metrics into Improve and Today.

Acceptance:
- same number of applications with different outcomes produces different recommendations.

### UX-6 — Cross-platform profile improvements

Deliver:
- actionable recommendations for LinkedIn / Indeed / Job Bank / employer portals where evidence exists;
- action state: suggested / reviewed / completed / dismissed;
- manual confirmation if external change cannot be observed.

Acceptance:
- system never claims an external change was made without evidence.

### UX-7 — Windows staging review

Deliver:
- isolated staging instance on Windows;
- separate port/data directory;
- no production mutation;
- two usable review accounts: system admin and personal candidate;
- candidate-facing and admin-facing navigation review.

Acceptance:
- user can open the staging URL in the browser;
- log into both accounts;
- switch between them;
- inspect Today, Opportunities, Applications, Improve, Profile and admin controls.

### UX-8 — Production-readiness gate

Only after RackNerd capacity is resolved:
- rerun resource gate;
- 3–5 real daily stability runs;
- final cutover checklist;
- explicit user approval before production switch.

## 9. Testing strategy

For every work package:
- targeted Vitest tests;
- TypeScript noEmit;
- Biome check;
- role-isolation tests where relevant;
- no tests that need production mutation.

Before staging review:
- sign-in tests;
- onboarding tests;
- account-switch tests;
- password-change/reset tests;
- adaptive-state tests;
- Improve recommendation threshold tests;
- candidate/admin navigation tests.

## 10. Data and migration policy

Prefer additive schema changes.
No destructive migration during UI development.

If CandidateInsightSnapshot needs persistence:
- create a new table with tenant/candidate scoping;
- store derived metrics only;
- treat it as rebuildable cache;
- profile/strategy/applications remain source of truth.

Recommendation decisions may be persistent because Dismiss/Accept history is user state.

## 11. Rollback

Source rollback:
- every UX work package gets a separate commit or tightly scoped commit series;
- no unrelated refactors.

Staging rollback:
- stop isolated Windows staging process;
- discard staging data directory if needed.

Production rollback remains the existing Freeze 2/Freeze 3 cutover procedure and is not exercised during this UI phase.

## 12. Definition of done for the user's requested review

The review milestone is reached when all are true:
- plan was committed first;
- admin and candidate accounts exist and have known reset/change-password paths;
- both accounts can sign in to isolated staging;
- Switch account works;
- candidate sees the 1–5 journey;
- Today adapts automatically but manual navigation remains available;
- Improve page contains at least the first evidence-based recommendations or clear insufficient-evidence states;
- system admin sees admin controls without leaking them to candidate;
- production VPS remains unchanged.



## 13. Language model — interface and application output are independent

Candidate language has two separate settings:

- `interfaceLanguage`: English, Spanish, French, Russian, German.
- `applicationLanguage`: `auto` or a specific supported language for resume, cover letter and package text.

Rules:
- changing the interface language must never change the resume/application language;
- `applicationLanguage=auto` follows the vacancy/job-market language when it can be determined, otherwise falls back to English;
- candidate can override application language globally and, later, per vacancy/package;
- language settings are candidate preferences, not admin/system AI settings;
- UI strings must be translated through one dictionary/provider rather than duplicated ad hoc;
- document generation must receive the resolved application language explicitly.

Initial supported interface languages:
English (`en`), Spanish (`es`), French (`fr`), Russian (`ru`), German (`de`).

Acceptance:
- language switcher is available without entering technical settings;
- interface can change while application language stays unchanged;
- application language is visible separately in Profile/Settings;
- generated-package request can carry the resolved document language without changing candidate facts.

## 14. AI positioning and product identity

Pathfinder remains a career/job-search product first. AI is a capability, not the primary product category.

UX/marketing rule:
- use a persistent but low-noise `AI-assisted` cue near the Pathfinder identity/header;
- label AI-generated or AI-explained recommendations contextually where they appear;
- do not make provider/model/CLI configuration part of candidate onboarding;
- candidate onboarding may say that Pathfinder uses AI to analyze fit, tailor documents and explain recommendations, without exposing implementation details;
- technical provider/model controls belong in System Admin / Advanced settings;
- the visual mark should communicate career/professional assistance first, with AI as a secondary cue.

Brand mark direction:
- replace the generic sparkle/Gemini-like mark with a minimal professional-clerk mark;
- line-art silhouette: brimmed hat/head, jacket lapels and tie;
- compact enough for 32–40 px UI use;
- monochrome/currentColor SVG so it works in light/dark themes;
- avoid copying another vendor's recognizable AI mark.

Acceptance:
- candidate onboarding contains no blocking AI-provider step;
- no Codex CLI/model/provider errors are shown to candidates;
- Pathfinder identity includes a subtle AI-assisted message;
- technical AI settings remain accessible to admins;
- no visible `JobOps` brand leakage in candidate-facing onboarding text.
