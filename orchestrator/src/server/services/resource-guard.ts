import { statfs } from "node:fs/promises";
import { getDataDir } from "@server/config/dataDir";

export const RESOURCE_DISK_THRESHOLDS = {
  warningPercent: 80,
  blockOptionalHeavyWorkPercent: 85,
  criticalPercent: 90,
} as const;

export type DiskPressureLevel = "ok" | "warning" | "blocked" | "critical";

export interface DiskPressureSnapshot {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
  level: DiskPressureLevel;
  optionalHeavyWorkAllowed: boolean;
}

function classifyDiskPressure(usedPercent: number): DiskPressureLevel {
  if (usedPercent >= RESOURCE_DISK_THRESHOLDS.criticalPercent)
    return "critical";
  if (usedPercent >= RESOURCE_DISK_THRESHOLDS.blockOptionalHeavyWorkPercent) {
    return "blocked";
  }
  if (usedPercent >= RESOURCE_DISK_THRESHOLDS.warningPercent) return "warning";
  return "ok";
}

export async function getDiskPressureSnapshot(
  path = getDataDir(),
): Promise<DiskPressureSnapshot> {
  const stats = await statfs(path);
  const blockSize = Number(stats.bsize);
  const totalBytes = Number(stats.blocks) * blockSize;
  const freeBytes = Number(stats.bavail) * blockSize;
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const usedPercent =
    totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 10_000) / 100 : 0;
  const level = classifyDiskPressure(usedPercent);

  return {
    path,
    totalBytes,
    freeBytes,
    usedBytes,
    usedPercent,
    level,
    optionalHeavyWorkAllowed:
      usedPercent < RESOURCE_DISK_THRESHOLDS.blockOptionalHeavyWorkPercent,
  };
}

export function assertOptionalHeavyWorkAllowed(
  snapshot: DiskPressureSnapshot,
  operation: string,
): void {
  if (snapshot.optionalHeavyWorkAllowed) return;
  throw new Error(
    `${operation} is blocked because disk usage is ${snapshot.usedPercent}% (${snapshot.level}).`,
  );
}
