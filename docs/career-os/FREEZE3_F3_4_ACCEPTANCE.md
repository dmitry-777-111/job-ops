# Freeze 3 — F3-4 Multi-user <=5 acceptance

Branch: `freeze3-dev`
Status: development acceptance only; no production multi-user cutover.

## Requirements and evidence

| Requirement | Evidence | Result |
| --- | --- | --- |
| Candidate tenant onboarding | hosted signup route + `createHostedTenantUser` + auth tests | PASS |
| Per-user credentials/settings | tenant/user-scoped settings, external connections, secrets, profile and strategy repositories | PASS |
| Queue/fairness | one outstanding pipeline request per owner; dispatcher drains at most one request per candidate and caps a pass at five candidates | PASS |
| Strict isolation | hosted API isolation regression + `candidate-private-isolation.test.ts` | PASS |
| Credential encryption | AES-256-GCM vault with tenant/user/owner authenticated-data binding | PASS |
| Admin view | Workspace Users settings UI + workspace-user list/create/disable/password-reset API | PASS |
| No duplicate heavy discovery when shareable | coordinator `932f07f` + safe public integration `7f7bf7f` | PASS |

## Two-candidate gate

`6936ca4` passed CI `37175486379`. Alice and Bob cannot read or activate each other's candidate profile/strategy, cannot see each other's connection status, and cannot retrieve each other's encrypted credentials. Existing hosted API isolation also covers private jobs, verified facts, immigration data, PDFs, chat/status state, and search presets.

`7f7bf7f` passed CI `37176478379`. For identical shareable public discovery, Alice and Bob receive independent cloned results while the heavy JobSpy extractor executes exactly once.

Reuse is conservative and opt-in. The exact opaque fingerprint includes extractor/channels, search terms, normalized location intent/source plan, effective settings, required environment credential context, and candidate existing-job URL state. Candidate Watchlist/custom sources, resume/recovery flows, and challenge retries are excluded. Failed, challenged, degraded, or cancelled results are not reusable.

Each candidate continues through its own private import/attachment, evaluation, scoring, selection, status, and document flows. Shared state contains public discovery output only.

## Rollout boundary

- Freeze 2 production remains unchanged and available as rollback.
- Shared discovery is disabled for extractors that do not explicitly opt in.
- F3-3 SAFE_REJECT production enforcement remains disabled pending separate explicit activation approval.

## Acceptance decision

F3-4 Multi-user <=5: **PASS / CLOSED** for the Freeze 3 development branch.

Next phase: F3-5 Product onboarding + UX.
