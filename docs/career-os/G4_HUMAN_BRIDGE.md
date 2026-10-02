---
id: career-os-g4-human-bridge
title: G4 Human Bridge
description: Minimal company/contact relationship layer for CAREER OS NEXT.
sidebar_position: 6
---

# G4 Human Bridge

## Purpose

G4 adds a small Human Bridge layer without turning CAREER OS into a CRM or a second scoring engine.

The model keeps three concepts separate:

- vacancy -> company;
- person/contact -> company;
- person/contact -> vacancy is optional.

This lets one verified contact remain useful across several vacancies at the same employer without copying the person into each vacancy.

## Data model

Company stores a stable employer identity for Human Bridge use.

Contact stores Name, Role, LinkedIn URL, Influence 0-3, Bridge B0-B3, Bridge evidence, Last contact, Outcome, and an optional vacancy link.

The existing hard facts and immigration evidence remain canonical in G2/G3. Human Bridge does not replace or duplicate them.

## Evidence rule

Neutral state is allowed without evidence: Influence = 0 and Bridge = B0.

Any positive relationship claim requires supporting evidence: Influence > 0 or Bridge > B0. The API rejects a positive Influence/Bridge value if bridgeEvidence is empty.

G4 deliberately does not invent unsupported meanings for B0-B3. The values are stored as the approved bounded scale; factual support remains explicit in the evidence field.

## Priority boundary

Human Bridge can support outreach sequencing and prioritization. It cannot override a hard exclusion, a verified work-authorization constraint, a mandatory licence, US authorization/travel requirements, or another canonical G2/G3 fact.

No automatic suitability-score mutation is connected to Human Bridge in G4.

## API and UI

Per-job API:

- GET /api/jobs/:id/human-bridge
- POST /api/jobs/:id/human-bridge/contacts
- PATCH /api/jobs/:id/human-bridge/contacts/:contactId

The Job page exposes the same fields through HumanBridgePanel.

All reads and mutations are protected by the existing private tenant/user job scope. A user cannot reach another user's Human Bridge data by supplying another job or contact id.

## Acceptance target

G4 must represent, for at least five known-company fixtures:

Vacancy -> Company -> Person -> evidence -> outreach state

without relying on an unbounded free-text CRM record.

The acceptance fixture uses disposable test databases only.

## Explicitly out of scope

G4 does not build a general CRM, create a broad contact-discovery crawler, add a new suitability/scoring machine, reinterpret G2/G3 hard gates, or migrate legacy CAREER OS data.

Legacy-state migration is the next gate, G5.
