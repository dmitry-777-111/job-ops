# CAREER OS NEXT ??? G1 Acceptance PASS

Date: 2026-10-01 America/Toronto

## Result

G1 VANILLA JOBOPS: PASS after one narrowly scoped ACCEPTANCE FAILURE fix.

Pinned upstream remains JobOps v0.13.1 / c28b90a.
CAREER OS branch: career-os-v1.

## Acceptance failure and fix

Vanilla startup migration rewrote existing post_application_messages.message_type from classification_label on every startup.

Fix commit: aab9f9c ??? fix-preserve-post-application-message-type-on-restart

The migration now runs the legacy message_type backfill only when the column did not already exist before migration startup. Existing stored message_type values are preserved on later startups.

Regression:
- orchestrator/src/server/db/migrate.test.ts
- 8/8 migration tests PASS
- explicit repeated-startup preservation test PASS
- orchestrator typecheck PASS

## Runtime acceptance

Runtime:
- container: career-os-g1-job-ops
- image base: ghcr.io/dakheera47/job-ops:v0.13.1
- patched migrate.ts mounted read-only from career-os-v1 for G1 acceptance
- persistent data: /opt/career-os-next/g1-vanilla/data
- HTTP bound only to 127.0.0.1:3005
- Gmail OAuth scope: gmail.readonly only

Controlled database state before restart:
- 7 post-application messages
- 1 job
- 1 stage event
- 1 Gmail integration
- 3 historical sync runs
- 0 duplicate Gmail message groups
- 0 message errors
- 7 pending_user
- 0 matched_job_id
- message_type: 1 rejection, 6 update
- PRAGMA quick_check = ok

Fresh pre-restart snapshot:
- /opt/career-os-next/g1-secrets/g1-final-before-restart.json

Fresh post-restart snapshot:
- /opt/career-os-next/g1-secrets/g1-final-after-restart.json

Both complete snapshots have identical SHA-256:
e76f7917f27c8977cbd9429584fcfbcbf38c3d6f2bb3047725d0b2bcbf8cca4d

Therefore restart preserved the monitored jobs, stage_events, settings, users, tenant_memberships, Gmail integration, sync-run history, all seven messages, and every stored message_type.

## Gmail post-restart acceptance

A final constrained Gmail sync was run with:
- searchDays = 7
- maxMessages = 20

Latest sync run:
- status: completed
- messages_discovered: 7
- messages_classified: 7
- error_message: null

Post-sync database:
- 7 stored messages
- 0 duplicate groups
- 0 message errors
- 7 pending_user
- 0 matched jobs
- message_type unchanged: 1 rejection, 6 update
- PRAGMA quick_check = ok

The Gmail classifications remain model suggestions and are not treated as verified evidence.

## Search acceptance

Discovery lifecycle was exercised:
- Hiring Cafe external challenge page was detected and the run paused instead of being falsely reported successful.
- A Working Nomads single-source run completed through the normal pipeline.
- Historical empty-result runs prove the completed zero-result path, not positive market coverage.

## Recovery note

One diagnostic sync accidentally used the JobOps default 90-day Gmail window and ingested 83 historical messages into the disposable G1 test database. That state was preserved separately for audit at:
- /opt/career-os-next/g1-secrets/g1-broad-sync-83-before-restore.db

The controlled G1 database was restored from the previously validated 7-message raw snapshot:
- /opt/career-os-next/g1-fixed-acceptance/jobs.db

Stale WAL/SHM files were removed before restoring the standalone SQLite snapshot. The restored database passed PRAGMA quick_check before the final acceptance sequence.

## Gate decision

G1 PASS.

Do not alter the G2 WIP stash until G2 begins:
- stash@{0}: g2-wip-before-g1-pass-20261001

