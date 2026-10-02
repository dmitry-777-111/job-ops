---
id: career-os-g3-canada-immigration-layer
title: G3 Canada / Immigration Layer
description: Scope and invariants for CAREER OS NEXT Canada and immigration context.
sidebar_position: 4
---

## Purpose

G3 adds a minimal Canada / immigration context to each job without turning inferred or historical signals into present-day employer commitments.

## Stored context

- NOC code.
- Historical LMIA signal, latest quarter, streams, matched employer names/rows, source URL/date and last check time.
- Current employer-support status: unknown, possible, confirmed, or not available.
- Work-permit requirement.
- US travel requirement.
- Hourly and annual CAD wage.
- Immigration notes.
- User-verified evidence supporting critical conclusions.

G2 remains the canonical store for the hard facts `no_sponsorship`, `mandatory_license`, and `us_authorization_required`. G3 consumes those facts in job context rather than duplicating them.

## LMIA invariant

The Canada provider is a historical signal only. A historical LMIA match never means that an employer currently sponsors, supports a work permit, or will support this applicant.

When multiple ESDC rows match an employer, G3 aggregates the rows rather than taking the first hit. The profile records the latest quarter, all observed streams, matched employer names, row count, and source metadata.

Refreshing LMIA history updates only historical LMIA fields. It never changes `employerSupportStatus`.

## Evidence guardrails

G2 evidence rules carry forward into G3:

- `employerSupportStatus=confirmed` requires user-verified evidence.
- `employerSupportStatus=not_available` requires user-verified evidence.
- `usTravelRequired=true` requires user-verified evidence.
- `possible` is allowed as a hypothesis and is not promoted to confirmed fact.
- Persisted verified evidence can support later edits without being re-entered.
- Evidence cannot be cleared while an evidence-gated critical conclusion remains active.
- AI/model output by itself is not evidence.

## Isolation

Immigration profiles are scoped to the owning user/workspace. Another hosted user cannot read or mutate a job's immigration profile.

## Explicit non-goals

G3 does not implement Human Bridge contacts, migration from the legacy tracker, G4 scoring/relationship logic, or any automatic PR-path recommendation. Those remain later gates.
