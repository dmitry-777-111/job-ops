# Freeze 3 — F3-2 Candidate/Strategy acceptance

Branch: `freeze3-dev`

## Domain requirements

| F3-2 requirement | Evidence | Result |
| --- | --- | --- |
| Versioned Master Career Profile | schema/repository foundation `1d1715f`, candidate API `7721b47`, repository version/activation tests `e1f87df` | PASS |
| Versioned Strategy Profile | schema/repository foundation `1d1715f`, candidate API `7721b47`, delta preview `3966621`, repository version/activation tests `e1f87df` | PASS |
| HARD / SOFT / CONTEXTUAL constraints | typed constraint contract in `shared/src/types/candidate-strategy.ts`; migration tests in `f46d896`; lifecycle metadata persistence test in `e1f87df` | PASS |
| effective / expiry / recheck metadata | typed constraint contract plus repository round-trip coverage in `e1f87df` | PASS |
| Canada-specific logic behind adapter boundary | generic `MarketAdapter` contract and Canada adapter from `405fee0`; registry tests run in full CI | PASS |
| Migration from current settings without reinterpretation | bootstrap service/API `f46d896`; live migration preview `e1f87df`; behavior projection `b8ca148` | PASS |

## Current-candidate migration evidence

The read-only migration preview records the active legacy search configuration:
- Canada market;
- 12 current search terms preserved exactly;
- nine Ontario/Alberta target cities preserved;
- remote/hybrid/onsite preserved;
- `selected_only` geography scope and `flexible` matching preserved;
- current scoring-instruction string preserved verbatim, with SHA-256 `d2e392b24e6b149ef10d6a3170a9941eaa1de345fd8cdf4bf91e649b89ccb97e`.

The bootstrap does not semantically rewrite the existing scoring instructions. It first represents them as a versioned contextual constraint/notes payload so later restructuring can be reviewed as an explicit strategy delta.

## Behavior-equivalence gate

Configuration-level equivalence is proven in `b8ca148`: the legacy snapshot and migrated strategy are projected back to the same decision-relevant search/scoring configuration.

R0 output-level gate is `8ffab66`: the current legacy and migrated search/location configuration is applied to the frozen 1,274-row R0 corpus. Acceptance requires:
- identical current search terms;
- identical normalized location intent;
- identical accepted R0 job IDs;
- the full 1,274-row corpus to be consumed by the test.

Automatic CI for `8ffab66`: `37169232837` — PASS. The full F3-2 behavior-equivalence gate therefore passes without a live re-search or mutation of production settings.

## Deployment boundary

F3-2 acceptance changes the Freeze 3 development branch only. It does not activate the new strategy domain in Freeze 2 production and does not mutate the current live candidate settings.

## Acceptance decision

F3-2 Candidate/Strategy Domain: **PASS / CLOSED**.

The next phase is F3-3 Safe Prefilter in shadow mode only.
