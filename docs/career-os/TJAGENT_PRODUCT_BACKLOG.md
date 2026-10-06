# TJAgent Product Backlog — Deferred but Agreed

This file records product decisions that are intentionally not implemented yet so they are not lost between development branches or Freeze checkpoints.

## User feedback channel

Status: **AGREED / NOT YET IMPLEMENTED**

TJAgent must provide a lightweight in-product feedback entry point for users who believe a function, recommendation, search result, score, workflow, or UI behaviour is wrong or unhelpful.

Requirements:
- Feedback can be typed or dictated by voice and converted to text.
- Voice capture is an input convenience; the stored canonical feedback is text plus minimal context.
- Capture the page/function/context that the user was using when feedback was submitted when possible.
- Do not interrupt onboarding or normal job-search flow; the entry point should be easy to find but visually secondary.
- Feedback must be tenant/user isolated.
- Feedback must not silently change scoring, profile, strategy, prompts, or system behaviour.
- Feedback should be reviewed in batches/periodically, grouped into recurring themes, severity, frequency and evidence quality.
- Product changes should be made only when feedback is material and survives normal engineering validation (reproduce -> root cause -> minimal fix -> tests -> acceptance).
- Keep raw user feedback distinct from inferred product conclusions.

## Future product-gap audit

Status: **AGREED / RECURRING MANUAL REVIEW, NOT A MONITORING JOB**

At a future request, review:
1. all agreed product ideas and requirements;
2. what was implemented;
3. what was partially implemented;
4. what remains deferred;
5. whether later architecture made any earlier idea obsolete;
6. whether any agreed requirement was lost across branches or Freeze stages.

The user may explicitly request this audit later. This backlog and the Career OS planning/checkpoint documents are source material for that review.

## Current learning-loop direction

The Career Learning Loop must remain evidence-first:
- Application -> Outcome -> Interview evidence/debrief -> Recommendation.
- Recommendation never silently mutates profile or strategy.
- User explicitly accepts or rejects a recommendation.
- Accepted recommendations may lead to a new versioned profile/strategy draft.
- Activation of a new profile/strategy version remains an explicit user decision.
- LinkedIn / Indeed / other job-platform changes are advice and wording suggestions only; the user edits those external profiles manually.
