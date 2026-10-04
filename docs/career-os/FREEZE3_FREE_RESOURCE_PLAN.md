# F3-7 zero-cost resource plan

2026-10-04. User preference: investigate existing/free resources before any paid VPS expansion. This is a plan, not a claim that resources have been provisioned or data moved.

## Preferred split

1. Existing public GitHub repository: run source tests and controlled synthetic acceptance on standard Linux GitHub-hosted runners. Existing CI already uses ubuntu-latest; existing ghcr.yml builds images remotely. Standard runner compute is free for public repositories. Avoid larger runners, unnecessary artifacts and expanded cache limits. Artifact/cache/package storage has separate rules and must not be assumed unlimited.
2. User's local computer: enough measured storage and RAM for isolated private-data acceptance and rollback archives. WSL is not installed and Docker executable was not found. A Linux/container runtime must be set up before equivalent container tests can run here; no installation or reboot was performed. Local work depends on the computer being on.
3. VPS: keep Freeze 2 production and its rollback evidence. Do not build/install dependencies while disk pressure is critical. Offloading tests reduces contention but does not itself change the 93% disk acceptance failure.
4. Google Drive: optional encrypted backup storage, not a runtime. Actual account free space is not checked. Default Google storage is up to 15 GB shared with Gmail/Photos; this may already be occupied. Do not upload live DBs, credentials or raw private data to the public GitHub repo or public Actions artifacts.
5. Google Cloud: not the default solution. The recurring Compute Engine free tier covers an e2-micro in selected US regions, 30 GB-month standard disk and 1 GB outbound transfer; a billing account is required. This is not a suitable capacity upgrade for the current storage-constrained runtime. Trial credit is temporary and eligibility has not been verified.

## Safe disk-recovery path to investigate next

- Inventory confirms two approximately 8.87 GB logical Docker images (layer sharing means this is not reclaimable-byte evidence).
- Older Freeze 1 image has a GHCR RepoDigest. This alone does not prove it can be downloaded/restored now. Freeze 2 image remains required and must stay intact.
- Before proposing removal of an older image/container: verify remote digest accessibility, export/copy needed restore metadata and data to protected off-host storage, verify hashes and a restore/load drill, inspect shared layers and actual reclaimable bytes, then make an explicit rollback-safe retention decision.
- Do not remove active swap: /root/career-os-next/swapfile is 4 GiB and substantially in use.
- No image deletion, transfer, cleanup, cloud provisioning, paid change or new workflow dispatch was performed during this planning step.

## Next development priority

Fix the F3-7 versioned-delta integration blocker first, using source-level focused checks on free standard GitHub Actions. Keep production-derived DB/data checks private. Then provision the local isolated runtime, complete new/changed daily acceptance, and resolve VPS disk retention based on verified restore evidence. Do not call F3-7 PASS merely because tests pass on a different machine.

## Sources checked

- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://docs.cloud.google.com/free/docs/free-cloud-features
- https://support.google.com/drive/answer/9312312?hl=en-GB

GitHub currently lists standard public Linux runners as 4 CPU / 16 GB RAM / 14 GB SSD. The SSD limit must be considered for large image builds; existing successful workflows are useful evidence but do not guarantee space for every future candidate image.
