# Freeze 3 — F3-4 Multi-user gap audit

Status: development audit; no production multi-user cutover.

## Existing foundation already present

- Users, tenants, and memberships are first-class database entities.
- Hosted mode enforces user isolation inside a tenant through `privateDataScopeFilter`.
- Existing API regression covers two hosted users for private jobs, verified facts, immigration data, PDFs, chat/status data, and search presets.
- Candidate profile, strategy, evaluations, application packages, settings, connections, and credential secrets are tenant/user scoped in schema/repositories.
- Credential vault uses AES-256-GCM and binds ciphertext through authenticated data to tenant, user, owner type/id, and secret name.
- Pipeline request queue permits one outstanding request per owner.
- Dispatcher processes at most one request per candidate per pass and caps a pass at five candidates.
- Canonical `market_postings` / observations are shared public inventory; `candidate_market_postings` is private candidate attachment state.

## Current F3-4 first regression

Commit under validation: `348d656`.

It adds an explicit hosted two-candidate test proving:
- Alice and Bob cannot read each other's active profile or strategy;
- cross-user profile/strategy activation attempts return no object;
- connection summaries are private;
- encrypted external-account credentials cannot be fetched through another user's scope;
- Alice and Bob retain their own credentials independently;
- raw stored credential rows are owner-scoped and plaintext tokens are not stored.

## Remaining gate gap

The master-plan gate also requires **no duplicate heavy discovery when shareable**.

Current architecture already canonicalizes duplicate public vacancy observations into shared market inventory, but the expensive extractor stage still runs inside each candidate pipeline. Therefore canonicalization prevents duplicate storage, not duplicate extractor work.

A safe sharing boundary must preserve these rules:
- only public extractor results may be shared; candidate documents, strategy, scores, statuses, credentials, errors, and private watchlists never cross users;
- sharing is allowed only for an identical discovery fingerprint (source/channel set, search terms, normalized location intent, run budget/extractor limits, and discovery-relevant settings/credential context);
- Watchlist/custom candidate sources are not shareable by default;
- runs with recovery checkpoints/challenges are not reused across candidates;
- successful clean source results may be coalesced/reused; private/account-specific errors must not be propagated to another candidate;
- each candidate still imports/attaches the shared public postings and performs its own prefilter/scoring/selection/status flow;
- unchanged shared discovery must not create a second heavy extractor call.

## Next implementation unit

After `348d656` CI is green:
1. introduce a bounded in-process shared discovery coordinator keyed by a deterministic discovery fingerprint;
2. integrate only the safe public extractor path, with candidate Watchlist excluded;
3. add a two-candidate test proving one heavy source execution but separate candidate-private downstream state;
4. keep fallback behavior unchanged when inputs are not shareable.
