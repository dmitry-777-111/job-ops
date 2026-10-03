# CAREER OS NEXT — v1 Scope

Only these modification domains are allowed before v1.0 freeze:

1. Evidence Guardrails
2. Canada / Immigration Layer
3. Human Bridge
4. Minimal Migration from legacy CAREER OS

Everything else is out of scope and must go to BACKLOG — DO NOT IMPLEMENT.

## Change Constitution
A change may be implemented before v1.0 only when at least one condition is true:
- BLOCKER: current gate cannot be completed without it.
- DATA LOSS: there is a real risk of losing or corrupting data.
- SECURITY: there is a real security/privacy issue.
- ACCEPTANCE FAILURE: a pre-defined gate acceptance test fails.

Not valid reasons:
- while we are here
- this would be nicer
- found another useful feature
- we can optimize this too

One gate at a time. Do not begin the next gate before the current gate passes.

## Execution and Recovery Protocol

All long ChatGPT-driven implementation work in CAREER OS NEXT must follow
[RECOVERY_CHECKPOINT_PROTOCOL.md](./RECOVERY_CHECKPOINT_PROTOCOL.md).

This protocol is an execution-safety rule, not a new v1 feature domain. It may
be applied during any gate to prevent duplicate work, uncertain recovery, or
loss of verified progress after a client/stream interruption.
