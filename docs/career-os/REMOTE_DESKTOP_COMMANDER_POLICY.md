# Remote Desktop Commander — Mandatory Economy Policy

Status: NON-NEGOTIABLE project rule
Applies to: all CAREER OS / The JobAgent work, all future branches/chats/agents
Reason: free Remote Desktop Commander quota is 10,000 tool calls/month and must not become a project bottleneck.

## Default rule

Remote Desktop Commander is a scarce execution bridge, not the default development environment.

Use it only when work truly requires the authorized Windows machine, such as:
- starting/stopping the local staging app;
- opening the local browser for user review;
- Windows-only environment checks;
- one bundled PowerShell operation that cannot be done more efficiently through GitHub/CI or another available tool.

Do NOT use it for routine repository reading, repeated file inspection, fine-grained edits, polling, or CI work when another tool/environment can do the job.

## Mandatory call-economy rules

1. Batch operations. Prefer one PowerShell script/tool call that performs inspect -> edit -> validate -> report over many small calls.
2. No tight polling. Long-running processes are started once; poll sparsely and only when needed.
3. Do not repeatedly reread unchanged files. Keep context/checkpoints and use git diff/status.
4. Prefer GitHub/CI for repository work, test validation, branch/commit inspection, and source review when available.
5. Prefer local bulk search/edit commands inside one invocation over one remote call per file.
6. Before each Remote Desktop Commander call ask: "Does this need the Windows machine?" If no, do not spend a call.
7. If monthly remaining quota approaches 10%, stop nonessential Remote Desktop Commander work and switch to alternative workflows.
8. Never pay for Pro automatically. Paid upgrade requires explicit user approval after a cost/benefit review.
9. Record durable checkpoints before any long operation so interruptions do not cause repeated work.
10. Production/VPS work is separate; do not use Remote Desktop Commander merely as a relay when SSH/GitHub/other direct tools are available.

## Working target

Normal development should consume no more than a few bundled Remote Desktop Commander calls per work package.
A single UI work package should normally need:
- 0–1 call for local environment inspection,
- 1 bundled call for local staging/test actions if needed,
- 0–1 call to open/restart the review environment.

Any workflow requiring dozens of calls must be redesigned before continuing.

## Persistence

This policy must remain in:
- repo-root AGENTS.md;
- docs/career-os/REMOTE_DESKTOP_COMMANDER_POLICY.md;
- active implementation/checkpoint plans when they are updated.

Future branches and agents must treat this as an operational constraint, not a suggestion.
