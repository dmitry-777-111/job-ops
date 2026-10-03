# JobOps Recovery & Checkpoint Protocol

Status: mandatory execution rule for long ChatGPT-driven JobOps sessions.

## Purpose
Prevent loss, duplicate work, and uncertain recovery when the ChatGPT response stream or client session is interrupted.

## Mandatory execution model
1. Work in bounded atomic steps, not one long opaque pass.
2. Before each step, state the exact input state and intended output.
3. After each meaningful step, persist durable results to the VPS/repository before continuing.
4. Record a checkpoint only after the step has been verified.
5. Never treat chat prose alone as a checkpoint.

## Checkpoint contents
Each checkpoint must identify:
- phase/subphase (for example G5.2);
- last completed action;
- files/artifacts changed;
- verification performed and result;
- current git status or relevant file state;
- next exact action;
- blockers/errors that remain unresolved.

## Recovery rule after interruption
On any ChatGPT stream/client interruption:
1. Do not rerun the failed response blindly.
2. Inspect durable state first: files, git status/diff, running processes, test outputs, logs.
3. Compare durable state with the last confirmed checkpoint.
4. Reuse all completed work.
5. Resume only from the first unverified or incomplete action.
6. Rerun a completed step only when verification shows its output is missing, corrupt, or inconsistent.

## Checkpoint frequency
Create a checkpoint after:
- every code/file modification batch;
- every successful test/typecheck/build gate;
- every migration or data-changing operation;
- every phase/subphase completion;
- before launching a long-running command likely to outlive the chat stream.

For work expected to take more than ~10 minutes, no more than one substantial uncheckpointed unit should be in flight.

## Long-running commands
Long tests/builds/migrations must:
- run in a persistent terminal/session when possible;
- write output to a durable log or have retrievable terminal output;
- be distinguishable from chat-stream state;
- be checked independently after a ChatGPT interruption.

## Idempotency
Where practical, migration/recovery steps must be safe to resume. Re-running the same verified input must not create duplicate records, duplicate applications, duplicate contacts, or repeated irreversible side effects.

## Chat behavior
If the ChatGPT client shows stream recovery timeout, network recovery, Retry, or similar:
- do not use Retry as the first action;
- inspect project state first;
- continue with a fresh instruction from the last verified checkpoint.

## Source of truth
Priority after interruption:
1. VPS/repository durable state;
2. test/build/log evidence;
3. explicit checkpoint record;
4. chat narrative.

Chat narrative alone is never sufficient to declare work completed.

## Current adoption
This protocol applies immediately from the next JobOps action after creation. Existing completed G0-G4 work is not to be repeated merely to conform retroactively.

## Automatic resilient runner

JobOps includes `tools/jobops-resilience/` for commands that may outlive a ChatGPT stream.

- `run.sh <job-id> <retry-safe:0|1> <command...>` launches a durable background job.
- `status.sh` reports running/finished/abnormal-stop state from VPS state files.
- `watchdog.sh` runs every minute via cron.
- Each managed job stores PID, heartbeat, log, exit code, and restart metadata under `.jobops-runtime/` and `.jobops-logs/`.
- A command marked `retry_safe=1` is automatically restarted at most once after an abnormal process death.
- A command marked `retry_safe=0` is never automatically repeated; recovery stops for inspection.
- Tests, typechecks, builds, reads, and other idempotent verification commands may be marked retry-safe.
- Migrations, writes to external systems, application submissions, emails, destructive actions, or other side-effecting operations default to non-retry-safe unless idempotency is explicitly proven.

This mechanism protects task execution from chat-stream failure. It does not attempt to restart or emulate the ChatGPT client itself.
