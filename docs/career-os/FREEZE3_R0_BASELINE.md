# Freeze 3 — R0 closure baseline

Captured: 2026-10-03/04 EDT
Pipeline run: `6d2e2bad-1322-47e6-bf7e-5d53b7956ad9`
Source DB: `/opt/career-os-next/g1-vanilla/data/jobs.db`

## Terminal run evidence

- Started: `2026-10-03T05:48:49.731Z`
- Completed: `2026-10-04T00:49:46.327Z`
- Terminal status: `completed`
- Error message: `null`
- Total wall-clock duration: about 19.02 hours
- Recovery container exit: `0`
- Recovery did not rediscover or restart the run; it resumed persisted scoring state.

## R0 loss / disposition funnel

| Stage | Count | Share of prior stage | Interpretation |
| --- | ---: | ---: | --- |
| Raw discovered reported by run | 1,453 | — | Pre-import discovery count |
| Unique persisted jobs in R0 time window | 1,274 | 87.681% of raw | 179 records (12.319%) were eliminated before unique persistence by import dedupe/merge/skip behavior; surviving logs do not provide a trustworthy exact split, so no finer attribution is claimed |
| Scored | 1,267 | 99.451% of persisted | Successfully obtained suitability score |
| Accounted unscored | 7 | 0.549% of persisted | All seven have explicit scoring-failure evidence; none is unexplained |
| Selected / processed | 10 | 0.789% of scored | Top-N selected and processed to `ready` |

The seven unscored jobs are not silent loss. Each has a recorded `Job scoring failed — leaving unscored and continuing` event caused by Codex app-server termination with `SIGKILL`. They remain persisted as `discovered`, so they are recoverable/auditable rather than missing.

## Database integrity

- `PRAGMA quick_check`: `ok`
- `PRAGMA foreign_key_check`: 0 violations
- R0 window rows: 1,274
- R0 window statuses: 1,264 `discovered`, 10 `ready`
- R0 source mix: 689 LinkedIn, 585 Indeed
- Current candidate DB total at capture: 1,275 jobs, including one pre-existing manual job outside the R0 window
- Stable source IDs are present for all 1,274 R0-window jobs; no duplicate `(source, source_job_id)` pairs were found.

## Accounted unscored set

1. `84527b04-6ac3-4746-9e79-6e602f789c9d` — Seasonal Customer Experience Representative — Indigo — LinkedIn
2. `dbaac9a2-483a-4161-9e98-bf64d2107b25` — Purchasing and Production Control Coordinator — Utility Structures — Indeed
3. `c63e128c-4619-4455-b8df-06a1be6f4127` — Project Manager — DXC Technology — Indeed
4. `5798f6a7-3eb2-4a36-b375-bf4069c494b8` — AV Technician, Technical Services (Toronto) — Shopify — LinkedIn
5. `eb84e04b-708b-4171-9b00-af14bcb95c32` — Maintenence Electrician — Phoenix Search Group Inc. — LinkedIn
6. `7e6e97d0-5795-41b9-bdb5-f7dfdf677a30` — Intermediate Structural Technologist - Construction Services — Stantec — Indeed
7. `124794fb-b571-4af3-b0ae-3e2896393435` — Solar Technician - Utility Sites — Spark Power — LinkedIn

## Baseline datasets

`docs/career-os/evidence/R0_PREFILTER_SHADOW.jsonl`
- 1,274 deterministic R0-window rows
- fields: identity/source, title/employer/location, score, status, discovery/processing timestamps
- SHA-256: `c18dfe087f6ffd5b3974e147dcfdeb3828544b8591500f62683d3d72697828d5`
- Purpose: shadow prefilter evaluation without re-running R0 scoring.

`docs/career-os/evidence/R0_REGRESSION_CORPUS.json`
- 37 deterministic examples
- includes all 10 selected `ready` jobs, all 7 accounted unscored jobs, and 20 scored jobs nearest the score-50 decision boundary
- SHA-256: `4cca540db379413ea8fbbbfeb09c53ec154d9d1e8c492b518352983ba9c3fc17`
- Purpose: known-value regression checks for future scoring/prefilter changes.

## F3-0 gate assessment

- Current scoring/recovery terminal: PASS
- R0 loss funnel captured: PASS
- DB integrity clean: PASS
- No unaccounted unfinished R0 items: PASS — seven unfinished scores are explicitly identified and preserved
- Prefilter shadow dataset captured: PASS
- Known-value regression corpus captured: PASS

F3-0 is therefore closed as a baseline. This does **not** authorize rerunning R0 or modifying Freeze 2 production.
