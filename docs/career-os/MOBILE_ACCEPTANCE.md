# The JobAgent — Mobile Acceptance

Status: mandatory candidate-facing acceptance gate.

Candidate-facing The JobAgent must be responsive and usable on mobile, tablet, and desktop.

Required review widths:
- 390 px
- 768 px
- 1440 px

Rules:
- candidate navigation uses a drawer/sheet on small screens;
- Today, Matches, Applications, Improve, Profile, account/language controls, and application-package review must work without desktop-only hover, drag, or fixed-width assumptions;
- candidate routes must never fall through to the legacy desktop Orchestrator UI;
- Applications must provide a stacked/list mobile alternative rather than relying only on the wide Kanban board;
- admin workspace may remain desktop-first, but must keep The JobAgent branding and remain clearly marked System Admin;
- manual viewport review and focused responsive tests are required before production cutover.
