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
