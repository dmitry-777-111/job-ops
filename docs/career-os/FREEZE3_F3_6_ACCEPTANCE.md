# Freeze 3 ??? F3-6 Application Package Builder acceptance

Status: PASS/CLOSED. Exact commit bf68d75 full CI 37222619720 verified completed/success on 2026-10-04; no production cutover.

## Acceptance scope

F3-6 implements the candidate-selected application-package flow:

`Selected vacancy -> authoritative live gate -> requirement extraction -> verified evidence map -> targeted CV -> cover letter -> QA/truth gate -> candidate review -> explicit approval -> export`

The package is version-pinned to vacancy/profile/strategy/generation-policy inputs. Candidate facts are not invented to satisfy a vacancy.

## Implemented product gates

- authoritative vacancy state is `LIVE | CLOSED | UNKNOWN`;
- CLOSED blocks package creation;
- UNKNOWN requires explicit candidate acknowledgement rather than being silently treated as live;
- requirements are extracted from the pinned vacancy version;
- requirement evidence is mapped only to verified candidate evidence;
- unsupported requirements remain visible gaps;
- targeted CV is a derivative of the pinned Master Career Profile and only reorders verified skills;
- cover-letter content is evidence-bounded;
- unsupported application-form answers are not fabricated;
- QA blocks approval/export for changed candidate facts, unbounded cover-letter content, unsupported form answers, CLOSED/unknown-unacknowledged vacancy, or stale package versions;
- candidate review exposes live state, requirement coverage, gaps, targeted-CV preview, cover-letter preview and changed-from-master highlights;
- approval is explicit;
- export re-runs QA and is blocked until approval;
- candidate/job/package APIs remain tenant scoped.

## Evidence

- `e660de2` ??? authoritative live gate. Full CI `37190741644`: PASS.
- `1a05e87` ??? candidate-facing live-gate API + tenant isolation. Full CI `37191002651`: PASS.
- `bb4785e` ??? conservative experience classification repair. Full CI `37191562665`: PASS.
- `3295132` ??? live gate + requirements + verified evidence/gaps composition. Full CI `37195192049`: PASS.
- `10032b3` ??? version-pinned Prepare application draft API and hosted persistence/isolation acceptance. Full CI `37195666555`: PASS.
- `9e363b7` ??? truth-constrained targeted CV / cover-letter generation repair. Full CI `37196231237`: PASS.
- `5a5f949` ??? package QA truth gate + staleness checks. Full CI `37196451850`: PASS.
- `d978abb` ??? QA/approval orchestration. Full CI `37196858201`: PASS.
- `b941a4d` ??? candidate review API using pinned vacancy requirements. Full CI `37221251524`: PASS.
- `4ed8b9a` ??? job-facing package facade. Full CI `37221487307`: PASS.
- `735db7f` ??? candidate Prepare application + review/approval UI. Full CI `37221909072`: PASS.
- `2172a7d` ??? approved-package export with fresh QA recheck and candidate download action. Full CI `37222245114`: PASS.

## Final acceptance regressions

The final regression at bf68d75, covered by successful full CI 37222619720, closes these gates:

1. high-risk unsupported facts (licence, citizenship/work authorization, language, years of experience, software and achievements) remain gaps and never appear in generated documents;
2. fresh product API flow completes prepare -> review -> approve -> export;
3. tenant isolation still prevents another candidate from preparing/reading the package;
4. CLOSED blocks generation and UNKNOWN requires explicit acknowledgement;
5. profile/posting/strategy/policy changes make an existing package stale and block approval/export;
6. full repository CI is green after the acceptance regression and acceptance record.

## Safety boundary

- Freeze 2 production remains untouched and remains rollback.
- No production deploy/migration is part of F3-6 acceptance.
- Safe-prefilter production enforcement remains disabled pending separate explicit approval.
- AI output is never evidence for a candidate fact.
- Master candidate evidence remains immutable input; vacancy-specific documents are derivatives.
