# Cintas evidence linkage — 2026-11-07

Base: 002d0c2ad8680992b0baf6ef338f37978f2ab09a, verified remote freeze3-dev and test runtime. User authorized diagnosis and correction of the confirmed mapping defect; production and Freeze2 remain protected.

Read-only inspection of the existing v3 package proved its pinned, owner-scoped profile exists and its experience equals the CV experience. Stored evidence map has zero entries. Root cause: the mapper builds experience atoms but only searches skill atoms in skill-category requirements. The evidence-bounded cover consequently receives no substantive facts.

Bounded fix: link a completed industrial repair role to the explicit numeric industrial processing/production repair-tenure requirement, using a stable dated-summary source atom. Require affirmative manufacturing context, production equipment, maintenance and repair duties in the same role. Count only fully enclosed months; do not aggregate jobs or assume ongoing/year-only dates. No equipment equivalence, education, language, physical capacity, licence or authorization inference. Existing QA logic is unchanged. Generation policy v2 uses existing staleness handling; stored packages are not rewritten.

Executed before patch: synthetic regression 2 failed / 19 passed. After patch: eight targeted files, 81/81 passed, including QA, approval/export and private candidate isolation. Additional draft/staleness run: 6/6 passed. Node 22.22.1 / Vitest 4.1.6. Targeted Biome ci and full orchestrator TypeScript check exit 0. Test data is synthetic; no private candidate facts added to the repository.

Read-only replay of the new mapper against the real pinned Cintas v3 source: evidence 0 -> 1, mandatory gaps 6 -> 5, total gaps 9 -> 8. Matched only industrial equipment repair tenure. Package unchanged confirmed. This was an in-memory diagnostic, not a deployed browser acceptance test; no database write, approval or export.

D remains NOT ACCEPTED. 309A remains in progress; employer-specific work authorization is not transferable by inference. Pending: exact new-SHA CI, test deployment, then browser verification of a newly generated package version. No production cutover, tag or real application. Commit uses [skip ci] to avoid deploying before CI; dispatch existing CI once, then deploy only on success.
