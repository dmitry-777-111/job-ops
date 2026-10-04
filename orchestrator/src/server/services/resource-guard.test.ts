import { describe, expect, it } from "vitest";
import {
  assertOptionalHeavyWorkAllowed,
  type DiskPressureSnapshot,
  RESOURCE_DISK_THRESHOLDS,
} from "./resource-guard";

function snapshot(usedPercent: number): DiskPressureSnapshot {
  const level =
    usedPercent >= RESOURCE_DISK_THRESHOLDS.criticalPercent
      ? "critical"
      : usedPercent >= RESOURCE_DISK_THRESHOLDS.blockOptionalHeavyWorkPercent
        ? "blocked"
        : usedPercent >= RESOURCE_DISK_THRESHOLDS.warningPercent
          ? "warning"
          : "ok";
  return {
    path: "/data",
    totalBytes: 100,
    freeBytes: 100 - usedPercent,
    usedBytes: usedPercent,
    usedPercent,
    level,
    optionalHeavyWorkAllowed:
      usedPercent < RESOURCE_DISK_THRESHOLDS.blockOptionalHeavyWorkPercent,
  };
}

describe("resource guard", () => {
  it("allows optional heavy work below 85 percent", () => {
    expect(() =>
      assertOptionalHeavyWorkAllowed(snapshot(84.9), "image build"),
    ).not.toThrow();
  });

  it("blocks optional heavy work at 85 percent and above", () => {
    expect(() =>
      assertOptionalHeavyWorkAllowed(snapshot(85), "image build"),
    ).toThrow(/image build is blocked/);
    expect(() =>
      assertOptionalHeavyWorkAllowed(snapshot(91), "image build"),
    ).toThrow(/critical/);
  });
});
