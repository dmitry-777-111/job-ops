import type { ExtractorRunResult } from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSharedDiscoveryFingerprint,
  resetSharedDiscoveryCoordinatorForTests,
  runSharedDiscovery,
} from "./shared-discovery-coordinator";

const cleanResult = (): ExtractorRunResult => ({
  success: true,
  jobs: [
    {
      source: "indeed",
      title: "Field Service Technician",
      employer: "Acme",
      jobUrl: "https://example.com/job/1",
    },
  ],
});

beforeEach(() => {
  resetSharedDiscoveryCoordinatorForTests();
});

describe("shared discovery coordinator", () => {
  it("builds the same opaque fingerprint for equivalent object key order", () => {
    const a = buildSharedDiscoveryFingerprint({
      source: "indeed",
      settings: { b: 2, a: 1 },
    });
    const b = buildSharedDiscoveryFingerprint({
      settings: { a: 1, b: 2 },
      source: "indeed",
    });

    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).not.toContain("indeed");
  });

  it("reuses one clean heavy result for a sequential shareable caller", async () => {
    const run = vi.fn(async () => cleanResult());

    const first = await runSharedDiscovery({ fingerprint: "same", run });
    const second = await runSharedDiscovery({ fingerprint: "same", run });

    expect(run).toHaveBeenCalledTimes(1);
    expect(first.reuse).toBe("fresh");
    expect(second.reuse).toBe("cached");
    expect(second.result).toEqual(first.result);
  });

  it("coalesces concurrent clean work but returns independent result objects", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = vi.fn(async () => {
      await gate;
      return cleanResult();
    });

    const firstPromise = runSharedDiscovery({ fingerprint: "same", run });
    const secondPromise = runSharedDiscovery({ fingerprint: "same", run });
    release?.();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(run).toHaveBeenCalledTimes(1);
    expect(first.reuse).toBe("fresh");
    expect(second.reuse).toBe("joined");
    expect(first.result).toEqual(second.result);
    expect(first.result).not.toBe(second.result);
    expect(first.result.jobs).not.toBe(second.result.jobs);
  });

  it("never caches a degraded or challenged result", async () => {
    const degraded = vi.fn(async () => ({
      success: true,
      jobs: [],
      sourceErrors: ["private account error"],
    }));
    const challenged = vi.fn(async () => ({
      success: false,
      jobs: [],
      challengeRequired: "https://example.com/challenge",
    }));

    await runSharedDiscovery({ fingerprint: "degraded", run: degraded });
    await runSharedDiscovery({ fingerprint: "degraded", run: degraded });
    await runSharedDiscovery({ fingerprint: "challenged", run: challenged });
    await runSharedDiscovery({ fingerprint: "challenged", run: challenged });

    expect(degraded).toHaveBeenCalledTimes(2);
    expect(challenged).toHaveBeenCalledTimes(2);
  });

  it("does not propagate a joined caller's failed owner result", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const run = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        await gate;
        return {
          success: false,
          jobs: [],
          error: "candidate-a private failure",
        };
      }
      return cleanResult();
    });

    const firstPromise = runSharedDiscovery({ fingerprint: "same", run });
    const secondPromise = runSharedDiscovery({ fingerprint: "same", run });
    release?.();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(run).toHaveBeenCalledTimes(2);
    expect(first.result.success).toBe(false);
    expect(second.result.success).toBe(true);
    expect(second.result.error).toBeUndefined();
  });

  it("allows the caller to veto reuse when candidate cancellation state changed", async () => {
    let cancelled = false;
    const run = vi.fn(async () => ({ success: true, jobs: [] }));
    const first = await runSharedDiscovery({
      fingerprint: "cancel-veto",
      run,
      isReusable: () => !cancelled,
    });
    expect(first.reuse).toBe("fresh");

    cancelled = true;
    const second = await runSharedDiscovery({
      fingerprint: "cancel-veto",
      run,
      isReusable: () => !cancelled,
    });
    expect(second.reuse).toBe("fresh");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not share different exact fingerprints", async () => {
    const run = vi.fn(async () => cleanResult());
    await runSharedDiscovery({ fingerprint: "candidate-a", run });
    await runSharedDiscovery({ fingerprint: "candidate-b", run });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("keeps the reusable cache bounded and evicts least-recently-used entries", async () => {
    let clock = 0;
    const now = () => clock;
    const run = vi.fn(async () => cleanResult());

    await runSharedDiscovery({ fingerprint: "a", run, maxEntries: 2, now });
    clock += 1;
    await runSharedDiscovery({ fingerprint: "b", run, maxEntries: 2, now });
    clock += 1;
    await runSharedDiscovery({ fingerprint: "c", run, maxEntries: 2, now });
    clock += 1;
    await runSharedDiscovery({ fingerprint: "a", run, maxEntries: 2, now });

    expect(run).toHaveBeenCalledTimes(4);
  });
});
