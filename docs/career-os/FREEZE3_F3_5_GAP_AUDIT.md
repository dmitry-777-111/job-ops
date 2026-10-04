# Freeze 3 — F3-5 Product onboarding + UX gap audit

Status: development audit; no production cutover.

## Existing foundation

- Hosted/local sign-in and onboarding gate already exist.
- Current onboarding has `profile`, optional `model`, and `resume` requirements.
- Resume step already supports local PDF/DOCX/Reactive Resume JSON upload/import and Reactive Resume selection/confirmation.
- Current search setup captures country/market, cities/regions, workplace styles, and sponsorship need.
- Candidate profile/strategy versioned domain and candidate readiness API already exist from F3-2.
- Candidate connections API and per-user connection storage already exist.
- Workspace-user administration already exists.

## Gaps against F3-5

1. **Adaptive strategy questions — missing.** Current onboarding does not create/activate a Candidate Strategy Profile and does not ask follow-up questions based on missing strategy dimensions.
2. **Voice/text strategy input — text not yet productized; voice absent.** No candidate-facing strategy input screen currently uses the Candidate Strategy API. Voice is optional by the master plan and should remain capability-gated rather than block the phase.
3. **Confirmation screen — partial only.** Resume has confirmation, but there is no final candidate-facing summary of market/role families/hard-soft-contextual constraints before activation/start.
4. **Simplified navigation — missing.** Current primary navigation exposes Overview, Jobs, In Progress, Resume Studio, Tracking Inbox, Tracer Links, Visa Sponsors, Watchlist, Settings. F3-5 requires candidate-facing Today / Matches / Applications / Profile / Connections.
5. **Advanced diagnostics hidden by default — missing.** Tracer Links, Visa Sponsors, Watchlist and broad Settings remain first-level navigation instead of an advanced/admin surface.
6. **Fresh-candidate gate not proven.** Existing onboarding can establish basic search/model/resume state, but the F3-5 gate requires a fresh candidate to become runnable without source/config edits using the new Candidate Profile/Strategy domain.

## Minimal safe implementation sequence

A. Extend onboarding domain with a `strategy` requirement backed by active Candidate Strategy Profile, without deleting legacy settings during development.

B. Add a deterministic adaptive-question service that asks only for missing decision-critical dimensions. First MVP dimensions:
- target role families;
- compensation target/floor when supplied;
- travel constraints;
- work-authorization/sponsorship constraint;
- freeform career priority/context.
Unknown answers remain unknown; no invented hard constraints.

C. Add candidate-facing text strategy step + final confirmation summary. Voice remains optional/capability-gated and cannot block completion.

D. Add candidate navigation mode: Today / Matches / Applications / Profile / Connections. Preserve current technical screens under an Advanced/Admin entry rather than deleting routes.

E. Add a fresh hosted-candidate regression that signs up, completes onboarding through API/UI state, activates profile+strategy, and reaches the candidate workspace without editing files/env/source.

## Safety boundary

- Freeze 2 production remains untouched.
- Legacy settings remain available as rollback/migration evidence until F3-7 cutover.
- Candidate answers create versioned strategy data; they do not silently rewrite an active strategy without explicit confirmation/activation.
- Voice must not be required where the client/runtime does not expose it.
