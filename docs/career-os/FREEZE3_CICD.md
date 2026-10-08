---
id: freeze3-cicd
title: Freeze3 GitHub Actions deployment
description: Build and deploy the test service on RackNerd without a Windows machine.
sidebar_position: 90
---

## What it is

Pushes to `freeze3-dev` build a Linux amd64 image on GitHub-hosted runners and deploy its immutable digest to the RackNerd test service on `127.0.0.1:3006`. The workflow is `.github/workflows/freeze3-deploy.yml`. Windows and Desktop Commander are not involved.

## Why it exists

Deployment must continue when the developer's PC is off. GitHub builds and publishes `ghcr.io/dmitry-777-111/job-ops-freeze3`; a restricted SSH command pulls it on the VPS. The existing GitHub CLI authentication on the VPS permits repository writes, including workflows.

## How to use it

1. Commit and push to `freeze3-dev`, or edit that branch on GitHub.
2. Open Actions → Freeze3 build and deploy. Wait for both build and deploy to succeed.
3. The deploy prints `DEPLOY_OK` only after Docker health checks succeed.

Manual commands, from any machine with authenticated GitHub CLI:

```sh
gh workflow run freeze3-deploy.yml --repo dmitry-777-111/job-ops --ref freeze3-dev -f operation=status
gh workflow run freeze3-deploy.yml --repo dmitry-777-111/job-ops --ref freeze3-dev -f operation=deploy
gh workflow run freeze3-deploy.yml --repo dmitry-777-111/job-ops --ref freeze3-dev -f operation=rollback
```

Rollback stops the new container, retains its data separately, restores the pre-deploy data snapshot, and starts the previous container. Data written since deployment is therefore not included in the restored database. Health failures trigger this recovery automatically. Old containers and snapshots are retained; cleanup is an operator action.

The root-only VPS directory `/opt/career-os-ci` contains deployment state and backups. `deploy.py` is installed there from `scripts/deploy/freeze3-deploy.py`. Changes to that script require a deliberate operator installation; ordinary deploys cannot replace the SSH handler. The original container and its settings are captured before replacement. Existing mounts, runtime environment, restart policy and loopback port are preserved. Only `/app/data` is snapshotted; shared Codex and Tectonic volumes remain attached.

GitHub Actions secrets: `FREEZE3_SSH_KEY` and `FREEZE3_KNOWN_HOSTS`. The key allows only deploy, rollback and status, with forwarding and PTY disabled. The server host key is pinned from the VPS host key file. The temporary job token authenticates registry pulls and is removed after use. No application credentials are copied into the repository or Actions secrets.

## Common problems

- A failed image build leaves the current service running.
- A pull failure leaves the current service running. Check package access and available disk space.
- A failed health check restores the previous container and data. Inspect application logs privately; they may contain sensitive data.
- Rollback is available only for the last successful deployment and runs once. For older snapshots use an operator recovery session.
- First builds may take longer because the build cache is empty. Concurrent deploys are serialized.
- Do not prune retained rollback images or containers before their rollback window ends.

## Related pages

- [GitHub Actions](https://github.com/dmitry-777-111/job-ops/actions/workflows/freeze3-deploy.yml)
- `docs/career-os/REMOTE_DESKTOP_COMMANDER_POLICY.md`
