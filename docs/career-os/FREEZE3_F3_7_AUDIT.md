# F3-7 acceptance audit

Recorded 2026-10-04. Status: IN PROGRESS; cutover NOT ACCEPTED.

## Verified baseline
- freeze3-dev local/origin: bf68d750d82fe2b711d879c291bc62b95077cc5d.
- Full CI 37222619720: completed/success, exact baseline SHA verified through GitHub.
- F3-6 PASS/CLOSED on that existing evidence; no repeat of F3-0..F3-6 tests.
- Existing checkpoint/acceptance prose lagged the completed regression commit.
- Inherited gates: F3-1 recovery/delta correctness; F3-3 false-negative audit; F3-4 isolation; F3-6 package truth. Reuse their recorded evidence.

## Remaining gates, in order
1. Protected isolated current production DB/data copy using SQLite backup API (never raw-copy a live WAL DB).
2. Apply exact Freeze 3 migrations to the working copy.
3. integrity_check, foreign_key_check, key counts, private-domain invariants; Freeze 3 startup/restart on isolated data with external integrations and schedulers disabled.
4. Backup/restore drill with logical equivalence checks.
5. Measured daily delta; unchanged historical evaluations must not be rescored.
6. Disk/resource acceptance with rollback-safe capacity decision.
7. Explicit Freeze 2 restore/startup drill on backup copy.
8. Only after all PASS: immutable Freeze 3 image/tag and final checkpoint. Master plan also requires 3–5 clean daily runs before runtime stability is claimed.

## Resource gate: FAIL / cutover blocked
- Initial root filesystem: 34G total, 30G used, 2.7G available, 92% utilization.
- RAM: 1967 MiB total, 254 MiB available; swap 4179/5119 MiB used.
- Production data: 53 MiB; a bounded copy is feasible but does NOT resolve resource acceptance.
- Docker lists 2 images, both associated with containers. Reclaimable labels do not establish rollback-safe deletion.
- No image build/pull, dependency installation, production schema change, cleanup or prefilter activation.
- Existing Freeze 2 container healthy; preserve image sha256:335efe1eff9b23e129cf5689cf25ae1dd9b92a5f588d0aa26124c53b78d8c40e and rollback backups.

## Series discipline
One substantial unit, durable checkpoint, stop new work near 18 minutes and report before 20 minutes. No duplicate CI dispatch. All later evidence must distinguish actual runtime checks from inherited regression coverage.

## Series 1 executed evidence (2026-10-04)

- Audit committed first as e95f749 before snapshot/migration.
- Protected evidence/data directory: /opt/career-os-next/f3-7-acceptance-20261004 (root-only). Contains baseline, working, startup, restored and rollback lanes. Do not publish raw data, env keys or logs.
- Current production snapshot: SQLite online backup via read-only source; 24 non-DB file hashes stable across copy. DB snapshot is transaction-consistent; no cross-file atomic transaction is claimed.
- Migration: exact bf68d75 Freeze 3 source, isolated network-none container, no production mounts, exit 0, no OOM. Reused existing image dependencies; no build/pull/install.
- Post-migration integrity_check=ok; foreign_key_check=0; all 44 legacy table counts preserved (jobs=1275, pipeline_runs=5, settings=24, users=1, tenants=1, post_application_messages=7).
- Private-domain schema and no-orphan checks pass, but new tables are empty. This is not fresh runtime isolation coverage; existing F3-4 evidence remains authoritative.
- Baseline SHA-256 unchanged. Foreign-key enforcement was enabled on verification connections; runtime-wide enforcement is not claimed.
- Freeze 3 startup: NOT PASS/INCONCLUSIVE. Isolated source-overlay runtime migrated one legacy integration into credential vault, but did not reach HTTP health during bounded observation. Stopped intentionally, no OOM observed. This was not the final immutable candidate image.
- Backup/restore: PASS. Actual Freeze 3 createBackup(manual), 807.92 ms. Added a sacrificial post-backup table, restored backup, confirmed full schema/data logical digest equality, integrity ok and no FK violations. Restore+validation 0.324 seconds.
- Explicit rollback: PASS: restored pre-migration DB and Freeze 2 image reached HTTP health in 60.03 seconds.
- Daily-delta performance: NOT RUN; no historical scoring/discovery invoked.
- Resource acceptance: FAIL. Disk increased from 92% to 93%; acceptance artifacts about 256 MiB before final logs. All test containers stopped; Freeze 2 production remains healthy. Both existing Docker images have container references and must not be treated as safely disposable based on reclaimable labels.
- No cutover, final acceptance tag, image freeze or stability claim. 3–5 clean daily runs remain required by master plan.

## Exact continuation

1. Read this audit, evidence/F3_7_SERIES1.json and current branch/origin. Reuse the existing protected snapshot and successful migration/restore results.
2. Resolve capacity with a rollback-safe plan (for example provision/expand storage or use a separate acceptance host). Do not delete either retained image or backup merely to lower utilization.
3. Diagnose/complete Freeze 3 startup under a suitable resource budget, then startup/restart and actual private credential checks on copy. Keep isolated master key with its encrypted copy.
4. Complete measured ordinary daily delta with before/after evaluation hashes and explicit AI-call/run-item accounting, no historical rescoring.
5. If rollback startup is not PASS, complete it from the already-restored rollback lane. Re-measure resource gate and only after all gates pass prepare immutable image/tag/checkpoint.

This series changes documentation/evidence only. Application CI bf68d75 remains the reused green evidence; no old F3-0..F3-6 test suite is manually rerun. Documentation push uses [skip ci] to honor the explicit no-repeat instruction.

## Series 2 executed evidence (2026-10-04)

- Reused existing snapshot; no migrations/backup/rollback drills or green F3-0..F3-6 suites repeated.
- Freeze 3 source-overlay startup/restart: PASS, health in 63.753s and 55.453s. Earlier short observation was inconclusive. No immutable Freeze 3 image validation is claimed.
- Copied credential-vault migration: 1 payload exactly matches original after decryption, 0 plaintext credentials remain, wrong-tenant authenticated decryption rejected. This is a migrated-record invariant check; inherited F3-4 API isolation coverage was not repeated.
- Measured unchanged overlap: 1267 previously scored jobs out of 1275 total; 8 historical unscored rows excluded deliberately. Actual importJobsStep + scoreJobsStep invoked on copy, network disabled, 0.5 CPU / 320MiB cap.
- First import (empty market inventory): 51.876s; full measured pass 53.238s. Second unchanged import: 44.961s; full pass 46.461s; scoring 4.346ms, 0 eligible/scored jobs. Historical jobs hash exactly unchanged; second pass created no posting versions. No source-fetch or new/changed AI latency measured.
- NEW BLOCKER: changed-posting acceptance FAIL. Same-URL material requirement change creates new posting version (1267 -> 1268), but ordinary scoring selects 0 jobs because a legacy score already exists. See FREEZE3_F3_7_DELTA_GAP.md. Do not mark full daily-delta acceptance PASS based on unchanged-overlap performance.
- Post-drill working/startup DB integrity ok, FK violations 0; protected baseline hash unchanged.
- Resource gate still FAIL (~93% disk). /root/career-os-next's 4GiB is active swap, not obsolete source files. Existing Freeze 1 and Freeze 2 images/containers preserved. No cleanup or paid capacity changes.
- All acceptance containers stopped/exited; production Freeze 2 healthy. No final acceptance tag/cutover. Live daily end-to-end performance and 3–5 clean daily stability runs remain unproven.

## Revised exact continuation after Series 2

1. Read current checkpoint, F3_7_SERIES2.json and FREEZE3_F3_7_DELTA_GAP.md. Application code is still bf68d75; later commits are docs/evidence only.
2. Implement one bounded versioned-delta integration unit from the gap document, with focused regression and relevant CI. Do not rerun passed drills unless the change affects them.
3. Resolve resource capacity without sacrificing rollback; user was asked about VPS expansion/another server, no response or approval assumed.
4. Complete new/changed measured daily path and immutable candidate image acceptance once feasible; retain Freeze 2 until all remaining gates pass.

## Series 3 executed evidence (2026-10-05)

- Versioned-delta blocker is resolved in source tree `6d9d61c2fe5b37c12b5a0e7d3aa29521c9f6561d`; fix commit `7e5a41125092981b41b81425fc287b74c652b5eb`.
- GitHub Actions run `37365892290` for the fix was cancelled before any runner acquired work (all jobs `runner_id=0`, no steps). Because the connector lacks Actions rerun permission, source-equivalent empty commit `5454f371fe3a0e48a623dbd65b1f1d0e588a9c3d` was pushed only to trigger CI; its tree SHA is exactly the same as `7e5a411`. CI run `37389730244` completed SUCCESS.
- Immutable image `career-os-freeze3:7e5a411` exists locally, image ID `sha256:3fe9ae0d22df53510a7535f23cf40ab939861fa02b7c506a15e4b1ea5e83678d`.
- Immutable startup health PASS; restart->health PASS.
- Immutable focused versioned-delta acceptance PASS: unchanged tuple reuse, one changed tuple only, dependent policy/profile/strategy invalidation, stale legacy score cleared, historical jobs hash unchanged, zero AI calls in the controlled acceptance.
- Immutable ordinary-path bulk acceptance PASS on 1,257 scored discovered legacy jobs: 1,257 run items attached, 1,257 market observations recorded, 0 market inventory errors, 0 unmapped legacy jobs after normal `importJobsStep`, unchanged historical jobs hash, zero AI calls.
- Duplicate legacy posting fallback PASS: both Bradken legacy IDs resolve to the same canonical market posting.
- Evidence: `evidence/F3_7_SERIES3.json`.
- No production deploy or cutover performed.

### Remaining before cutover

1. Resource/capacity gate must PASS on the actual runtime host without sacrificing rollback.
2. Master-plan runtime stability requirement remains: 3-5 clean daily runs before stability is claimed.
3. Final explicit cutover decision only after the above; Freeze 2 remains rollback until then.

## Resource gate measurement � 2026-10-05

- Actual VPS root filesystem: 34G root partition, 30G used, 2.2G available, 94% utilization.
- `/dev/vda` is 35G total and fully partitioned (34G root + 1G swap); there is no unallocated disk space to grow into locally.
- RAM is 1.9GiB total with roughly 56MiB available at measurement time. Swap is effectively exhausted: 5.0GiB total, ~508KiB free. vmstat showed active swap churn and CPU saturation during the sample.
- Production `career-os-v2-job-ops` remains healthy. Docker currently retains two required images totaling 17.43GB; rollback/current production assets were not deleted.
- Resource gate = FAIL. No deploy/cutover/image deletion/cleanup performed.
- Safe capacity target before cutover: at least 60GB total disk; at least 4GB RAM, preferably 6-8GB if browser/visa workloads remain on the same VPS.
- Evidence: `evidence/F3_7_RESOURCE_GATE.json`.
