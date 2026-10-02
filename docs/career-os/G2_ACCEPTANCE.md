---
id: career-os-g2-acceptance
title: G2 Acceptance
description: Acceptance record for CAREER OS NEXT Evidence Guardrails.
sidebar_position: 3
---

## What it is

This records the acceptance result for G2 Evidence Guardrails on CAREER OS NEXT, based on JobOps v0.13.1 pinned baseline plus the completed G1 fixes.

## Why it exists

G2 prevents critical application state and hard-exclusion facts from being promoted by AI inference alone. Critical facts require explicit user-verified provenance.

## Acceptance result

**PASS ??? 2026-10-02 (UTC).**

Validated rules:

- Applied requires submission evidence.
- Interview stages require interview evidence.
- Rejected requires rejection evidence.
- NO SPONSORSHIP requires a verified source.
- MANDATORY LICENSE requires a verified source.
- US AUTHORIZATION REQUIRED requires a verified source.
- Model/system actors cannot manufacture critical evidence.
- AI Gmail classification does not auto-create evidence-required stage events.
- Existing evidence cannot be silently removed or replaced with the wrong kind.
- Verified facts and critical event evidence survive a fresh-process restart.
- Tenant isolation remains enforced.

## Verification

Targeted G2 regression:

- 13/13 test files passed.
- 168/168 tests passed.

Full CI parity on pinned Node 22.22.1 with TZ=UTC:

- Biome: PASS.
- shared typecheck: PASS.
- orchestrator typecheck: PASS.
- gradcracker extractor typecheck: PASS.
- ukvisajobs extractor typecheck: PASS.
- production client build: PASS.
- full orchestrator suite: 298/298 test files passed; 2099 passed; 3 skipped; 0 failed.

Disposable real HTTP acceptance:

- Phase 1: PASS, 60 assertions, 3 critical events, 3 verified facts, 1 synthetic Gmail message.
- Phase 2 fresh-process restart: PASS, 9 assertions; evidence and verified facts persisted.

The acceptance harness used only a disposable /tmp database and made no external requests.

## G1 regression guard

The existing G1 runtime database remained unchanged by G2 acceptance:

- SQLite quick_check: ok.
- 7 post-application messages.
- 0 duplicates.
- 7 pending_user.
- 0 matched.
- latest Gmail sync: completed, 7 discovered, 7 classified, no error.

## Scope

No G3 Canada/immigration fields, Human Bridge, or migration work was implemented in G2.

