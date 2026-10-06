# VPS 6 GB / 100 GB Upgrade Runbook

Status: BLOCKED WAITING FOR RACKNERD RESOURCE ALLOCATION
Service: racknerd-af00191
Production mutation: NOT STARTED

## Confirmed commercial state

- Upgrade invoice paid: $48.08 USD.
- Order: 2 GB KVM VPS Special -> 6 GB KVM VPS Special.
- Recurring renewal confirmed separately by RackNerd: $89.99/year.
- RackNerd requires the customer to notify support after payment; support then updates the VPS allocation.
- Do not resize partitions until the guest actually sees the expanded virtual disk and new RAM.

## Current read-only baseline (2026-10-06)

- /dev/vda = 35 GiB (upgrade NOT visible yet)
- /dev/vda1 = 1 MiB BIOS boot
- /dev/vda2 = 34 GiB ext4 mounted at /
- /dev/vda3 = 1 GiB swap
- root usage = 94%, about 2.2 GiB free
- RAM = about 1.9 GiB
- swap = 5 GiB total and essentially full
  - /dev/vda3 = 1 GiB
  - /root/career-os-next/swapfile = 4 GiB
- production container healthy: career-os-v2-job-ops
- production image: ghcr.io/dmitry-777-111/job-ops:v2-candidate-20261003-03
- rollback image preserved: career-os-v1-freeze

## Non-negotiable safety gates

1. Wait for RackNerd to confirm the allocation has been updated.
2. Reboot only after the provider update, preferably using the RackNerd control panel as their official guide recommends.
3. Re-run read-only verification: lsblk, parted print free, free -h, swapon --show, df -hT, findmnt, docker ps/images/system df.
4. Require the virtual disk to show the upgraded size before any partition write.
5. Create an off-host production data backup and a partition-table backup before editing GPT.
6. Preserve both current production and rollback Docker images.
7. Never reinstall the OS.
8. Never delete/recreate the root partition unless an independently verified recovery plan requires it.

## Intended partition strategy after provider update

Current layout has the swap partition after root, so root cannot simply grow while /dev/vda3 exists.

Preferred low-risk strategy:
- after the 6 GB RAM upgrade/reboot, verify swap pressure is safe;
- keep the existing swapfile active while modifying the swap partition;
- swapoff /dev/vda3 only;
- save GPT/partition metadata off-host;
- remove only partition 3 (swap), preserving partition 2 start sector and filesystem;
- extend partition 2 to the new disk end;
- ask the kernel to reread the table; reboot if required;
- run resize2fs on /dev/vda2;
- replace the old swap-partition fstab entry with a persistent swapfile entry;
- verify filesystem size, swap, Docker health, application health, and reboot persistence.

Do not copy RackNerd's generic example blindly: their article deletes/recreates both root and swap partitions. Our GPT layout is known and preserving the existing root partition is safer.

## Post-expansion target

- root filesystem materially below 80% usage
- RAM approximately 6 GB
- persistent swapfile available
- production container healthy
- rollback image intact
- no production cutover to Freeze 3 until the existing resource/stability gates are satisfied
