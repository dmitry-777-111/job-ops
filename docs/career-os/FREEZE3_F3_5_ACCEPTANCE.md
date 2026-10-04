# Freeze 3 ??? F3-5 Product onboarding + UX acceptance

Status: acceptance candidate; no production cutover.

## Acceptance scope

F3-5 closes the candidate-facing onboarding and navigation gaps identified in `FREEZE3_F3_5_GAP_AUDIT.md`:

- hosted candidate strategy onboarding with explicit draft review and activation;
- deterministic/adaptive strategy questions that preserve UNKNOWN semantics;
- capability-gated browser voice input with text as the required fallback;
- simplified candidate navigation: Today / Matches / Applications / Profile / Connections;
- technical/admin surfaces removed from the default hosted-candidate navigation while retained for local/admin use;
- fresh hosted candidate can sign up and become search-ready through product APIs without editing source, env, or config files.

## Evidence

- `2eca0fc` ??? hosted strategy onboarding integration. Full CI `37179604406`: PASS.
- `161f9d1` ??? adaptive-question service/API with deterministic fallback. Full CI `37180466861`: PASS.
- `73a96e6` ??? adaptive prompts wired into candidate onboarding. Full CI `37180719512`: PASS.
- `50e34f1` ??? candidate navigation/admin-role scoping repair. Full CI `37182828222`: PASS.
- `2b26269` ??? capability-gated voice-input test repair. Full CI `37183727561`: PASS.
- `fbf8404` ??? first Master Career Profile is created/activated on confirmed resume. Full CI `37183950537`: PASS.
- `e760795` ??? fresh hosted candidate end-to-end API acceptance regression. Full CI `37187585818`: PASS.
- `59bcf7f` ??? additional fresh-hosted acceptance coverage including final candidate readiness/search-ready assertions. Full CI `37189610439`: PASS.

## Fresh-candidate gate

The regression creates a new non-admin hosted candidate, then uses only product APIs to:

1. sign up and obtain an authenticated tenant-scoped session;
2. save location/workplace/sponsorship preferences;
3. create and explicitly activate a Candidate Strategy Profile;
4. import a valid Reactive Resume JSON through the normal resume-import route;
5. explicitly confirm that resume;
6. verify onboarding completion;
7. verify an active Master Career Profile and active Candidate Strategy;
8. verify candidate readiness is search-ready and application-package-ready.

No test step mutates source files, environment variables, or configuration files after server startup.

## Safety boundary

- Freeze 2 production is untouched and remains rollback.
- No production deploy/migration is part of F3-5 acceptance.
- Safe-prefilter production enforcement remains disabled pending separate explicit approval.
- Voice is optional and capability-gated; lack of browser speech recognition cannot block onboarding.
- Candidate answers remain versioned and strategy activation remains explicit.

