# CAREER OS CI execution rules

Purpose: avoid duplicate manual CI dispatches, self-cancellation and repeated validation work during v3 development.

## Freeze3 development

- `freeze3-dev` is validated automatically on every push by `.github/workflows/ci.yml`.
- Do **not** manually dispatch CI for `freeze3-dev` after a push.
- GitHub concurrency remains `cancel-in-progress: true`: if a newer commit is pushed while an older commit is still validating, only the newer commit matters and the obsolete run may be cancelled.
- Never dispatch the same SHA twice just to "check whether CI started". Query the existing run status instead.
- A cancelled run is not treated as a code failure unless its own logs show a failing job before cancellation.
- Before changing code after CI failure, read the exact failing job/log and make only the delta required by that failure.
- Do not rerun a failed SHA unchanged unless the failure is proven transient/infrastructure-related.

## Production safety

- CI activity for `freeze3-dev` must not change Freeze2 production containers or the active R0 scoring process.
- No image build/deploy is implied by CI success.
- Production promotion remains a separate acceptance/cutover step.
