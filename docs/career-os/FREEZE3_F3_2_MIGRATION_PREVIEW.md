# Freeze 3 — F3-2 current-strategy migration preview

Evidence source: current candidate settings in the live Freeze 2 data DB. This is a read-only migration preview; no Freeze 2 settings were changed.

## Legacy inputs that must survive migration

- Market/country: `canada`
- Search terms: 12
  - field service technician
  - field service engineer
  - commissioning technician
  - electromechanical technician
  - industrial electrician
  - industrial maintenance technician
  - installation technician
  - technical support specialist
  - service coordinator
  - maintenance supervisor
  - service supervisor
  - product specialist
- Workplace types: remote, hybrid, onsite
- Search cities: Toronto, Mississauga, Hamilton, Ottawa, Sudbury, Thunder Bay, Calgary, Edmonton, Red Deer
- Location mode: `cities`
- Radius: 50 miles
- Search scope: `selected_only`
- Match strictness: `flexible`
- Explicit blocked-company override: none currently stored
- Explicit missing-salary penalty override: none currently stored
- Explicit auto-skip score threshold override: none currently stored
- Current scoring instructions: 1,423 UTF-8 characters; SHA-256 `d2e392b24e6b149ef10d6a3170a9941eaa1de345fd8cdf4bf91e649b89ccb97e`

## Freeze 3 representation

The migration unit maps the existing state without trying to reinterpret the free-form career logic:

- `targetMarkets = ["canada"]`
- current search terms are copied deterministically into the initial `targetRoleFamilies` migration field so no discovery intent disappears during bootstrap;
- geography becomes an explicit versioned constraint including country, cities, workplace types, search mode, radius, scope, and match strictness;
- because the current scope is `selected_only`, the migrated geography constraint is `hard`;
- existing scoring instructions are preserved verbatim both as strategy notes and a `contextual` migration constraint;
- any legacy blocked-company filter becomes a `hard` constraint;
- any enabled missing-salary penalty becomes a `soft` constraint;
- any existing auto-skip threshold becomes a `hard` constraint;
- migrated constraints carry `effectiveAt` and `recheckTrigger` metadata.

## Behavior-equivalence rule

Bootstrap is allowed to **represent** legacy behavior, not silently improve or reinterpret it. The initial migration therefore preserves the original scoring instruction string byte-for-byte. Semantic restructuring of those instructions into richer typed constraints must happen only in later reviewed strategy versions.

The bootstrap is idempotent at the strategy level: if an active Candidate Strategy already exists, it is reused and the legacy settings are not imported again.
