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
