# Anti-interruption protocol

Purpose: keep long Freeze 3 work resumable while preventing chat/tool-output limits from becoming a false project interruption.

## Root causes separated

1. **Remote command soft timeout is not a job failure.** Remote Desktop Commander frequently returns `Response may be incomplete (timeout reached)` after a short wait even when the remote shell/process is healthy. Treat this as transport/UI timeout, then read durable state instead of restarting work.
2. **Oversized stdout is avoidable.** Full CI logs, broad recursive grep output, and large `sed` ranges can consume tool/output limits without adding evidence.
3. **High-frequency polling is wasteful.** GitHub test jobs can take several minutes; repeated status calls add messages/context but do not make CI finish sooner.
4. **Long work must survive chat interruption.** Repository SHA, origin SHA, checkpoint, CI run id, DB state, and resilience runtime files are authoritative recovery points.
5. **Stale terminal sessions can accumulate.** A forensic check found dozens of blocked Desktop Commander PowerShell/SSH sessions surviving for hours. They consumed memory/process slots and could replay delayed stdout. Stale session shells were terminated; active project state was preserved in Git/CI/checkpoints.
6. **Nested multiline SSH quoting is fragile.** PowerShell -> SSH -> Bash heredocs/pipes can be reinterpreted by the wrong shell. Multiline code is now edited/written as files first, then transferred or executed with simple bounded commands.

## Mandatory operating rules

- Use `tools/jobops-resilience/compact-ci.sh <run-id>` for ordinary CI status. It emits only SHA, terminal state, failed jobs, and still-running jobs.
- Never dump a full Actions log. First identify one failed job, then filter for the failing test/error; cap the returned window.
- Wrap potentially noisy diagnostics with `tools/jobops-resilience/bounded-output.sh <lines> ...`.
- Default diagnostic output budget: 80 lines per command; raise only for a specific reason.
- Prefer one status read after a meaningful wait over repeated polling.
- Keep one pushed unit under CI and at most one prepared unpushed unit.
- Never rerun a passed/active CI merely because the chat or remote-command transport timed out.
- Do not keep a long-lived interactive terminal as the main work channel; use short-lived bounded commands. If blocked sessions survive longer than the work they launched, verify durable state and terminate only the stale session shells.
- Do not send multiline Python/heredoc bodies through nested PowerShell -> SSH -> Bash quoting. Write/edit the file first, then run a simple command against it.
- Before continuing after any interruption: `git status --short --branch`, local/origin SHA, latest checkpoint, latest CI. Do not reconstruct from chat narrative alone.

## Recovery invariant

A transport timeout may interrupt observation, but must not interrupt the actual project. No destructive action or duplicate long-running job is allowed until durable state has been checked.
