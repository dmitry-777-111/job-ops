# CAREER OS NEXT — G0 Baseline

Baseline: JobOps v0.13.1
Pinned commit: c28b90a5fba75f298cb1d6a49460ddf009808715
Target runtime: Linux VPS
Development/admin: Windows via SSH
Mobile: browser client only

Validated on Ubuntu 24.04.4 LTS with Node 22.22.1.

Because this VPS has about 2 GB RAM, heavy TypeScript/build/test commands require:
NODE_OPTIONS=--max-old-space-size=1536

Passed:
- npm ci
- biome ci .
- shared typecheck
- orchestrator typecheck
- gradcracker extractor typecheck
- ukvisajobs extractor typecheck
- production client build
- full orchestrator test suite: 295/295 files, 2079 passed, 3 skipped, 0 failed

No upstream auto-update is permitted during v1.
