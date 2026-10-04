# Freeze 3 ??? F3-6 Application Package Builder gap audit

Status: implementation plan; no production cutover.

## Required gate

F3-6 must implement the product flow:

`Selected vacancy -> authoritative live gate -> requirement extraction -> verified evidence map -> targeted CV -> cover letter -> QA/truth gate -> candidate approval -> export`

Acceptance gate: no generated package may introduce unsupported candidate facts in the regression corpus.

## Existing foundation that must be reused

- `ApplicationPackage` already models package version/status, posting version, profile version, strategy version, generation-policy version, evidence map, gaps, targeted CV JSON, cover letter, form answers, approval/export timestamps and staleness reason.
- Tenant/user-scoped persistence already exists in `repositories/application-packages.ts`.
- Posting/version consistency is checked when a draft is created.
- Package staleness comparison already exists for posting/profile/strategy/generation-policy changes.
- Existing Resume Studio / Reactive Resume pipeline remains the source for resume rendering/export.
- Existing Ghostwriter functionality may be reused only as a drafting component; it is not evidence and cannot bypass the truth gate.
- Existing Canada hard-requirement/evidence extraction and job evidence guardrails are reusable signals, but they do not by themselves constitute a full package requirement/evidence engine.

## Confirmed gaps

1. **No product orchestration service/API.** The package repository is currently a storage foundation; no candidate-facing flow coordinates live check, requirements, evidence, generation, review and export.
2. **No authoritative live vacancy gate for package creation.** A candidate can not yet request `Prepare application` and receive a durable LIVE / CLOSED / UNKNOWN gate backed by current source evidence before generation.
3. **No general requirement extractor for application packages.** Package generation needs normalized requirements with stable keys and evidence locations; existing hard-requirement parsing covers only selected gate signals.
4. **No verified evidence mapper.** Every positive generated claim must resolve to Master Career Profile / resume / explicit candidate-confirmed evidence. UNKNOWN must remain a gap rather than be promoted to a fact.
5. **No truth-constrained targeted CV generator.** Existing resume editing/rendering exists, but F3-6 needs a derivative targeted document tied to immutable profile evidence and package versions.
6. **No truth-constrained cover-letter/form-answer generator.** Drafting must consume only verified evidence and must preserve unsupported requirements as gaps.
7. **No package QA gate.** Approval/export must be blocked when generated claims cannot be traced to allowed evidence or when the posting/package is stale.
8. **No candidate review/approval/export product flow.** Required review surface must expose requirement coverage, unsupported gaps, CV/CL preview and changed-from-master highlights before explicit approval/export.
9. **No F3-6 truth regression corpus.** There is no dedicated regression proving that licences, diplomas, work authorization, language, experience, software or achievements cannot be invented.
10. **No dedicated package API isolation regression.** Repository scoping exists, but F3-6 needs candidate-facing API tests proving cross-tenant package reads/updates/exports are impossible.

## Implementation sequence

### F3-6A ??? Live vacancy gate
- Define durable `LIVE | CLOSED | UNKNOWN` result plus evidence/provenance/timestamp.
- Resolve the selected market posting/version to the best official/ATS evidence available.
- CLOSED blocks package generation; UNKNOWN requires explicit user review rather than pretending the vacancy is live.

### F3-6B ??? Requirement + evidence engine
- Extract normalized requirement items from the selected posting version.
- Map each requirement to verified candidate evidence or a gap.
- Preserve source references/confidence and prohibit inference from absence.

### F3-6C ??? Truth-constrained generation
- Produce targeted CV JSON as a derivative of the active master resume/profile.
- Produce cover letter and common application answers from the same verified evidence map.
- Reuse existing Resume Studio/Ghostwriter components only behind the evidence boundary.

### F3-6D ??? QA, staleness and approval
- Validate every generated factual claim against allowed evidence.
- Detect package staleness from posting/profile/strategy/policy versions.
- Block approval/export on unsupported claims, stale package or CLOSED vacancy.

### F3-6E ??? Candidate product flow
- One candidate action: `Prepare application`.
- Review screen: live state, requirement coverage, gaps, CV preview, CL preview, changed-from-master highlights.
- Explicit candidate approval before export.

### F3-6F ??? Acceptance
- Tenant-isolation API regression.
- Truth regression corpus including false-positive traps.
- Staleness regression.
- Closed/unknown vacancy gate regression.
- End-to-end fresh package flow through product APIs.
- Full CI before F3-6 is marked PASS/CLOSED.

## Safety boundary

- Freeze 2 production remains untouched and remains rollback.
- No production schema/code cutover is part of this audit.
- Safe-prefilter production enforcement remains disabled until separately approved.
- Master candidate evidence is immutable input to a package; vacancy-specific documents are derivatives.
- AI output is never accepted as evidence for a candidate fact.
