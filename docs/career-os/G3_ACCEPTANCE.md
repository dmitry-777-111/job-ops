---
id: career-os-g3-acceptance
title: G3 Acceptance
description: Acceptance record for CAREER OS NEXT Canada / Immigration Layer.
sidebar_position: 5
---

## Result

**PASS — 2026-10-02 (UTC).**

## Functional acceptance

Disposable real HTTP acceptance used the real app factory, authentication, migrations, routes, and a dedicated `/tmp` database.

- Real HTTP API phase: PASS, 17 assertions, 1 verified G2 fact.
- Fresh-process restart phase: PASS, 11 assertions, 1 verified G2 fact.
- State and evidence persisted across the fresh process.
- Acceptance made no external network request and did not touch the G1 runtime database.

## Regression coverage

Targeted G3/G2 regression after evidence gating:

- 5/5 targeted test files passed, 25/25 tests passed.
- G3 + hosted tenant-isolation regression: 2/2 test files passed, 8/8 tests passed.
- Final ImmigrationProfilePanel test after UI cleanup: 1/1 passed.

Covered behavior includes:

- aggregation of multiple historical LMIA rows;
- LMIA history never promoting current employer support;
- evidence gating for confirmed/unavailable employer support and required US travel;
- preservation of G2 hard facts as separate canonical evidence;
- user/workspace isolation for immigration profiles;
- migration persistence and restart behavior.

## CI parity

Pinned Node.js 22.22.1, `NODE_OPTIONS=--max-old-space-size=1536`, `TZ=UTC`:

- Biome: PASS; only non-blocking informational `useTemplate` hints remained.
- shared typecheck: PASS.
- orchestrator typecheck: PASS.
- gradcracker extractor typecheck: PASS.
- ukvisajobs extractor typecheck: PASS.
- production client build: PASS.
- full orchestrator suite: **301/301 test files passed; 2104 tests passed; 3 skipped; 0 failed**.

## G1/G2 regression guard

After G3 acceptance, the existing G1 runtime database remained healthy and unchanged:

- SQLite `quick_check`: ok.
- 7 post-application messages.
- 0 duplicates.
- 7 `pending_user`.
- 0 matched.
- latest Gmail sync: completed, 7 discovered, 7 classified, no error.
- G1 before/after restart snapshot hashes remained identical.

## Scope check

No Human Bridge / G4 data or logic was introduced. No G5 migration was started.
