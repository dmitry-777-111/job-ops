import { createHash } from "node:crypto";
import type { ExtractorRunResult } from "@shared/types";

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 32;

type CoordinatedResult = {
  result: ExtractorRunResult;
  reusable: boolean;
};

type CacheEntry = {
  promise: Promise<CoordinatedResult> | null;
  value: ExtractorRunResult | null;
  expiresAt: number;
  lastAccessedAt: number;
};

const entries = new Map<string, CacheEntry>();

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

/**
 * Build a non-reversible cache key without retaining raw candidate settings,
 * credentials, URLs, or other fingerprint inputs in coordinator state.
 */
export function buildSharedDiscoveryFingerprint(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function isCleanReusableResult(result: ExtractorRunResult): boolean {
  return (
    result.success === true &&
    !result.challengeRequired &&
    (result.sourceErrors?.length ?? 0) === 0
  );
}

function cloneResult(result: ExtractorRunResult): ExtractorRunResult {
  return structuredClone(result);
}

function prune(now: number, maxEntries: number): void {
  for (const [key, entry] of entries) {
    if (!entry.promise && entry.expiresAt <= now) entries.delete(key);
  }
  if (entries.size <= maxEntries) return;
  const evictable = [...entries.entries()]
    .filter(([, entry]) => !entry.promise)
    .sort(([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt);
  for (const [key] of evictable) {
    if (entries.size <= maxEntries) break;
    entries.delete(key);
  }
}

export type SharedDiscoveryResult = {
  result: ExtractorRunResult;
  reuse: "fresh" | "cached" | "joined";
};

/**
 * Reuse only clean public extractor results. A joined caller never inherits a
 * failed/challenged/degraded result: if the owner result is not reusable, the
 * caller executes its own run instead. This prevents account-specific failures
 * from becoming cross-candidate state while still coalescing successful work.
 */
export async function runSharedDiscovery(args: {
  fingerprint: string;
  run: () => Promise<ExtractorRunResult>;
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
  isReusable?: (result: ExtractorRunResult) => boolean;
}): Promise<SharedDiscoveryResult> {
  const nowFn = args.now ?? Date.now;
  const ttlMs = Math.max(0, args.ttlMs ?? DEFAULT_TTL_MS);
  const maxEntries = Math.max(1, args.maxEntries ?? DEFAULT_MAX_ENTRIES);
  const now = nowFn();
  const canReuse = (result: ExtractorRunResult) =>
    isCleanReusableResult(result) && (args.isReusable?.(result) ?? true);
  prune(now, maxEntries);

  const existing = entries.get(args.fingerprint);
  if (existing?.value && existing.expiresAt > now && canReuse(existing.value)) {
    existing.lastAccessedAt = now;
    return { result: cloneResult(existing.value), reuse: "cached" };
  }

  if (existing?.promise) {
    try {
      const joined = await existing.promise;
      if (joined.reusable && canReuse(joined.result)) {
        const current = entries.get(args.fingerprint);
        if (current) current.lastAccessedAt = nowFn();
        return { result: cloneResult(joined.result), reuse: "joined" };
      }
    } catch {
      // Do not propagate another candidate's extractor failure. Fall through
      // and execute this caller's own run after the failed owner is cleared.
    }
  }

  const promise = args.run().then((result) => ({
    result,
    reusable: canReuse(result),
  }));
  entries.set(args.fingerprint, {
    promise,
    value: null,
    expiresAt: 0,
    lastAccessedAt: nowFn(),
  });

  try {
    const coordinated = await promise;
    if (coordinated.reusable) {
      const stored = cloneResult(coordinated.result);
      entries.set(args.fingerprint, {
        promise: null,
        value: stored,
        expiresAt: nowFn() + ttlMs,
        lastAccessedAt: nowFn(),
      });
      prune(nowFn(), maxEntries);
    } else {
      entries.delete(args.fingerprint);
    }
    return { result: cloneResult(coordinated.result), reuse: "fresh" };
  } catch (error) {
    entries.delete(args.fingerprint);
    throw error;
  }
}

export function resetSharedDiscoveryCoordinatorForTests(): void {
  entries.clear();
}
