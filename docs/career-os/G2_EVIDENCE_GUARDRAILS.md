---
id: career-os-g2-evidence
title: G2 Evidence Guardrails
description: Verified sources for critical application transitions and job requirements.
sidebar_position: 2
---

## What it is

G2 requires evidence before Applied, interview stages, or Rejected can be recorded. It also stores sourced facts for NO SPONSORSHIP, MANDATORY LICENSE and US AUTHORIZATION REQUIRED. No G3 fields or immigration/scoring logic are added.

## Why it exists

AI classifications, confidence, scores and summaries are suggestions, not evidence. Gmail ingestion leaves critical suggestions pending human review even at high confidence. Existing historical records are not backfilled with invented evidence.

## How to use it

- Mark Applied: describe the submission confirmation you personally checked, including source/date. Cancelling or entering nothing does not submit the transition.
- Log Event: provide the verified evidence description for Applied, recruiter/assessment/interview stages and Rejected. The timeline displays saved provenance. Editing ordinary notes preserves evidence.
- Moving a board card to a critical stage requests the same personal verification.
- Tracking Inbox: inspect the original email and proposed stage before approving. Approval records that stored message ID as user-verified evidence. Automatic AI routing cannot create critical stage events.
- In the job timeline, Verified job requirements lets you add the source URL and supporting statement for the three G2 facts. A personal-verification checkbox is required. Without a URL, identify the original source in the manual verification statement. Removing a fact returns it to unknown/unverified.

API evidence contains `kind`, `sourceType`, `sourceId` or `sourceUrl` as applicable, optional `note`, and `verifiedBy: "user"`. Manual verification requires a nonblank note. Interview evidence accepts stored Gmail messages, calendar event references, or manual verification. Other evidence accepts those sources plus document references and HTTP(S) URLs. Calendar/document references are user-attested external identifiers, not connector-validated records. Stored Gmail references must be accessible within the current data scope.

Example body for POST `/api/jobs/:id/apply`:

```json
{"evidence":{"kind":"submission","sourceType":"manual_verified","note":"Checked employer portal confirmation dated 2026-10-01, reference TEST-123","verifiedBy":"user"}}
```

Stage APIs accept evidence inside `metadata.evidence`; the outcome endpoint accepts `evidence` at top level. GET `/api/jobs/:id/verified-facts` lists verified facts; PUT `/api/jobs/:id/verified-facts/:factKey` accepts `{ "evidence": ... }`; DELETE removes the fact. Reads/writes are tenant/user scoped. AI source types and system verification are rejected. Ordinary PATCH job updates cannot set Applied or Rejected; use evidence-aware routes.

## Common problems

- A missing/wrong-kind source returns 409; malformed evidence returns 400. Supply original evidence, not a model explanation.
- Evidence cannot be cleared or replaced with the wrong kind while retaining a critical stage.
- G1 historical events remain historical; no assertion that they were newly verified is made.
- A closed event's reason alone does not imply Rejected.

## Related pages

- [G1 acceptance](./G1_ACCEPTANCE.md)
