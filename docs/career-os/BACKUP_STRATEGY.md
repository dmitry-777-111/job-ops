# CAREER OS NEXT — Backup Strategy v1

Principles:
- Runtime data is more important than rebuildable application code.
- Code is recoverable from the pinned fork/commit.
- Runtime data must survive restart, deployment and rollback.

For G1+ runtime:
- Keep persistent JobOps data outside ephemeral containers.
- Before each gate-changing deployment or database migration, create a timestamped backup of the JobOps persistent data directory.
- Retain at least the latest 5 pre-change backups.
- Test restore before G6 PASS.
- Never delete the legacy Google Sheet during v1; it remains a read-only archive until v1 acceptance/freeze.
- Backup operations must not modify the existing visa scheduler data or processes on this VPS.
