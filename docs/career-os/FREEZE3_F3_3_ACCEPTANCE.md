# Freeze 3 — F3-3 Safe Prefilter acceptance

Branch: `freeze3-dev`
Mode at acceptance: shadow/audit only; production enforcement disabled.

## Gate requirements

| Requirement | Evidence | Result |
| --- | --- | --- |
| Shadow implementation | `a6aa090`, repaired fixture `1cf2569` | PASS |
| Geography false-negative regression | `4752073`, corrected in `f612afb` | PASS |
| Measurable safe-reject savings | Canada hard-requirement evidence corpus + tightened parser | PASS |
| No known decision-worthy regression | 0 selected R0 rejects; 0 historical score >=50 rejects | PASS |
| Audit sample acceptable | entire final SAFE_REJECT set audited: 10/10 | PASS |
| Staged activation safety | rollout controller in `1fd1e23`; final false-positive repair `e19bb90`; active mode requires all gates + explicit approval | PASS |

## Final shadow metrics

Frozen R0 inventory: 1,274 persisted jobs.

Geography-only shadow after `f612afb`:
- SAFE_REJECT: 0
- UNCERTAIN_TO_AI: 13
- PASS_TO_AI: 1,261
- estimated AI-call savings: 0.0000%
- false reject among selected jobs: 0
- false reject among historical score >=50 jobs: 0

Canada explicit-hard-requirement shadow after the final work-authorization false-positive repair:
- SAFE_REJECT: 10 / 1,274
- estimated AI-call savings: 0.7849%
- audited SAFE_REJECT coverage: 10 / 10 = 100%
- audited false rejects: 0
- selected R0 jobs rejected: 0
- historical score >=50 jobs rejected: 0
- maximum historical rejected score: 38

## Final audited reject set

1. Black & McDonald Limited — Maintenance Mechanic — explicit citizen/PR clearance requirement.
2. ESAB Corporation — Field Service Engineer - Canada — explicit Canadian passport/eligibility requirement.
3. Black & McDonald Limited — Building Operator I (4th Class Stationary Engineer) — explicit citizen/PR clearance requirement.
4. Merrick & Company — Electrical Technician Co-op — client requires citizenship or PR status.
5. Merrick & Company — Intermediate Electrical Engineer — client requires citizenship or PR status.
6. DXC Technology — Service desk Analyst at Client site in Ottawa — applicant must be a Canadian citizen.
7. Myticas Consulting — Network Technologist NOC Technologist (35945) — must hold/be eligible for Canadian passport.
8. LRO Staffing — Senior Computer Application Support - Contract - 19497 — must be a Canadian citizen.
9. DXC Technology — Project Manager — applicant must be a Canadian citizen.
10. MacEwan University — Supervisor, Student Recruitment – International — must have valid Canadian passport.

Two TRI-GLOBAL postings whose text says applicants must merely be “authorized to work in Canada” with citizen/PR examples are explicitly **not** treated as irreversible citizenship/PR-only evidence.

## Activation boundary

The rollout controller supports `shadow`, `audit`, and `active` modes. Shadow and audit never enforce SAFE_REJECT. Active mode is blocked unless:
- measurable SAFE_REJECT savings exist;
- known decision-worthy false rejects = 0;
- current SAFE_REJECT audit coverage = 100%;
- audited false rejects = 0;
- explicit activation approval is supplied.

No explicit activation approval has been supplied in this phase. Therefore production enforcement remains disabled even when the F3-3 development gate passes.

## Acceptance decision

Final false-positive repair `e19bb90` passed full automatic CI `37174790740`.

F3-3 Safe Prefilter is therefore **PASS / CLOSED for shadow/audit readiness**. Production enforcement remains disabled because no explicit activation approval has been supplied.
