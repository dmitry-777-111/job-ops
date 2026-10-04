# Freeze 3 — F3-3 Safe Prefilter shadow audit

Updated: 2026-10-03 EDT

## Safety principle

The prefilter may save AI calls only when a HARD candidate rule conflicts with strong, explicit vacancy evidence. Missing or ambiguous evidence is UNKNOWN and continues to AI. Title-only mismatch is never a safe-reject rule.

## Shadow pass 1 — hard geography

Frozen R0 inventory: 1,274 jobs.

After the multi-location false-reject regression was corrected in `f612afb`, CI `37170437988` passed with:

- SAFE_REJECT: 0
- UNCERTAIN_TO_AI: 13
- PASS_TO_AI: 1,261
- estimated AI-call savings: 0.000%
- selected R0 jobs falsely rejected: 0
- scored jobs >=50 falsely rejected: 0

Conclusion: geography-only logic is safe after the correction, but it has no measurable savings and therefore cannot justify activation by itself.

## Shadow pass 2 — Canada explicit hard requirements

Evidence corpus: `evidence/R0_CANADA_HARD_REQUIREMENT_CANDIDATES.json`

- broad candidate set: 25 R0 postings containing Canadian citizenship/passport language;
- corpus SHA-256: `5c678f1762922e7682a6bec72f8a8fdb31a75cd06abd08fba9e9667a2753d9d4`;
- source R0 run: `6d2e2bad-1322-47e6-bf7e-5d53b7956ad9`.

The first conservative parser revision in `a6e3356` passed CI and reported 13 SAFE_REJECT candidates, 1.0204% estimated savings, max rejected score 38, no selected job and no score>=50 rejection. A subsequent semantic audit found that three phrases were still too broad for an irreversible reject (preference language / authorization wording). No production action had been enabled.

The tightened rule set therefore excludes preference statements and authorization clauses that may still admit a work permit. Final deterministic audit result before rollout-controller validation:

- SAFE_REJECT: 10 / 1,274 = 0.7849% estimated AI-call savings;
- selected R0 jobs rejected: 0;
- score >=50 jobs rejected: 0;
- maximum rejected historical score: 38;
- all 10 current SAFE_REJECT cases manually inspected from their vacancy text.

The 10 current cases are:

1. Black & McDonald — Maintenance Mechanic — explicit citizen/PR clearance requirement.
2. ESAB — Field Service Engineer - Canada — explicit Canadian passport/eligibility requirement.
3. Black & McDonald — Building Operator I — explicit citizen/PR clearance requirement.
4. Merrick — Electrical Technician Co-op — client requires citizenship or PR status.
5. Merrick — Intermediate Electrical Engineer — client requires citizenship or PR status.
6. DXC Technology — Service desk Analyst — applicant must be a Canadian citizen.
7. Myticas Consulting — Network Technologist — must hold/be eligible for Canadian passport.
8. LRO Staffing — Senior Computer Application Support — must be a Canadian citizen.
9. DXC Technology — Project Manager — applicant must be a Canadian citizen.
10. MacEwan University — Supervisor, Student Recruitment – International — must have valid Canadian passport.

## Staged activation policy

Prepared rollout control has three modes:

- `shadow`: observe only, never enforce;
- `audit`: observe + review, never enforce;
- `active`: enforcement allowed only when all data gates pass **and** explicit activation approval is supplied.

Activation gate requires:

- measurable SAFE_REJECT savings;
- zero known decision-worthy false rejects;
- the entire current SAFE_REJECT set audited;
- zero audited false rejects;
- explicit activation approval.

Until that controller and tightened parser both pass full CI, F3-3 remains shadow/audit only.
