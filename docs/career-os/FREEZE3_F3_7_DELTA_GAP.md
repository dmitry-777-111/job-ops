# F3-7 changed-posting integration blocker

Status: reproducible FAIL on exact bf68d75 application sources, isolated production-derived copy. No production code/data changes.

## Trigger and expected behavior
An already scored, discovered vacancy appears again at the same URL with materially different requirements. A new market posting version should invalidate only its dependent candidate evaluation, using the current confirmed profile, strategy and scoring-policy versions. Unchanged tuples should remain reusable. Historical results must remain auditable.

## Observed behavior
The controlled probe appended a clearly labelled test requirement to one input description (copy only). Import skipped the existing legacy job, recorded one new market version (1267 -> 1268), attached the run item, but ordinary scoring selected zero jobs. candidate_evaluations stayed empty. No AI call was invoked by this probe.

Evidence: evidence/F3_7_SERIES2.json, changedPostingProbe. Reproducer: /opt/career-os-next/f3-7-acceptance-20261004/changed-posting.ts; output: working/changed-posting-result.json. This is a new acceptance probe, not a rerun of F3-1 unit tests.

## Verified integration path
- pipeline/steps/import-jobs.ts:40 calls createJobs; :56 records the market observation; :77 attaches legacy jobs to the run.
- repositories/jobs.ts:605 skips every existing URL without applying changed job content.
- repositories/jobs.ts:827-845 only selects discovered run jobs whose legacy suitabilityScore is NULL.
- repositories/candidate-evaluations.ts:91 implements immutable tuple ensure/reuse, but source search finds callers only in its repository test file, none in ordinary pipeline code.
- pipeline/orchestrator.ts:526 calls the legacy scoreJobsStep with profile and run id, without profile/strategy/posting/policy version context.

## Next implementation unit
Connect normal import/scoring to confirmed versioned candidate inputs and current posting versions, preserving tenant/run boundaries and immutable prior evaluations. Feed the current posting content to scoring; reuse unchanged completed tuples; select only invalidated/new tuples; persist the new evaluation and project it into candidate-facing state. Do not merely clear all legacy scores or bulk-rescore history.

Focused acceptance must prove: unchanged overlap reuses; one changed posting schedules only itself and uses new content; profile/strategy/policy changes invalidate the correct dependent work; other tenants and out-of-run historical unscored jobs remain untouched; an interrupted changed-tuple attempt resumes without duplicate AI work. Then measure a controlled new/changed daily run and relevant integration checks. Existing green evidence remains valid for its original scope; it did not prove this missing runtime wiring.
