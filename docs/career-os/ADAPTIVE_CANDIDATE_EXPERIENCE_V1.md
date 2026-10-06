# CAREER OS Adaptive Candidate Experience — v1

## Product journey

1. Tell us about yourself
2. Tell us what you want
3. Receive suitable jobs
4. Receive an application-ready package
5. Learn from application outcomes and improve the candidate profile

The fifth stage is a continuous feedback loop, not a terminal page.

## Core principle

CAREER OS optimizes for quality of opportunity and realistic candidate-market fit, not raw application count.

The system should compare three views continuously:
- Candidate-stated profile: experience, skills, compensation target, geography, work authorization, preferences.
- Market response: application-to-response rate, screening rate, interview rate, rejection timing, salary bands, role families, employers, sources.
- Opportunity evidence: jobs discovered, scored, shortlisted, applied, ignored, and outcomes by segment.

Recommendations must be evidence-backed, reversible, and never silently rewrite profile constraints.

## Adaptive home

The default landing view is selected automatically from current state, but the user can always switch manually.

Candidate states:
- setup: incomplete profile / resume / strategy
- search: ready but too little market evidence
- apply: strong ready-to-apply opportunities exist
- review: application package preparation or active applications need attention
- learn: enough outcome evidence exists to suggest changes
- recover: degraded source, authentication, stale resume, or missing critical data

Manual tabs remain available:
Today | Opportunities | Applications | Improve | Profile

## Recommendation engine v1

Start deterministic and cheap. Do not require an LLM for every login.

Signals:
- target salary vs salary distribution of plausible matches
- score distribution for target roles
- apply -> screening / interview / rejection rates
- response by role family
- response by source/platform
- response by geography
- response by compensation band
- resume/profile freshness
- missing or thin work-history descriptions
- repeated rejection before screening
- strong matches not applied to
- roles with better response than the stated target
- source/platform gaps (LinkedIn, Indeed, Job Bank, employer careers, etc.)

Examples:
- "Your target salary is above most roles that currently match your evidence. Review the floor?"
- "Field Service roles are producing more screens than maintenance-only roles. Expand this family?"
- "Your 2019–2024 role has little detail compared with jobs you are targeting. Add equipment/results?"
- "LinkedIn inbound activity is weak. Review headline, skills and searchable keywords?"
- "You are receiving interviews at a higher salary band than your current floor. Consider raising it."

Each recommendation has:
- evidence
- confidence
- expected benefit
- proposed change
- preview
- Accept / Edit / Dismiss
- never auto-apply strategic changes

## Candidate calibration

Avoid simplistic "overvalued / undervalued" labels.

Use calibration states:
- evidence supports current target
- market response suggests target may be conservative
- market response suggests target may be aggressive
- insufficient evidence

Minimum evidence thresholds must be enforced before recommendations affect strategy.

## Cross-platform improvement

Profile quality recommendations may target:
- CAREER OS profile/resume
- LinkedIn
- Indeed
- Job Bank
- employer career portals
- other supported channels

The system records recommended action and completion state, but does not assume a platform change occurred unless observed or confirmed.

## Resource model

Low-cost path:
- compute aggregate metrics after pipeline/application events
- cache candidate insight snapshots
- deterministic rules first
- invoke AI only for explanation, synthesis, or profile wording when needed
- no continuous browser or LLM loop

This is compatible with the current architecture and modest VPS resources after the capacity upgrade.

## Authentication and account UX

Required:
- clear current-user identity everywhere
- explicit role badge: Candidate / System Admin
- one-click "Switch account" that logs out and returns to remembered users
- self-service Change password for authenticated users
- system-admin reset password for candidate accounts
- no plaintext password storage
- no email notifications by default
- consistent Pathfinder branding across sign-in, onboarding, settings, candidate and admin views

For the current installation:
- preserve the system-admin account
- preserve/create the personal candidate account
- make both selectable in the account switcher
- establish a known password through a password-change/reset flow rather than exposing stored credentials

## Implementation order

A. Adaptive-home state model and five-stage journey shell.
B. Candidate insight snapshot schema + deterministic rules.
C. Improve page and recommendation cards.
D. Outcome analytics segmentation.
E. Account switcher + password-management UX.
F. Cross-platform profile-improvement channels.
G. Optional AI explanation/writing layer.

Production deployment remains blocked by the VPS resource gate; development and tests run on the Windows worker / CI.
