import { createHash } from "node:crypto";
import type { MarketPostingInput } from "@shared/types";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeUrl(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|trk$|tracking$)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch {
    return normalizeText(trimmed);
  }
}

function digest(parts: Array<string | null | undefined>): string {
  return createHash("sha256")
    .update(parts.map((part) => part ?? "").join("\u001f"), "utf8")
    .digest("hex");
}

/**
 * Stable public-market identity. Strong official/source identifiers are used
 * before a conservative employer/title/location fallback. The fallback is not
 * a fuzzy match and therefore cannot silently merge merely similar vacancies.
 */
export type MarketPostingIdentityCandidate = {
  kind: "requisition" | "source" | "canonical_url" | "source_url" | "fallback";
  key: string;
};

export function buildMarketPostingIdentityCandidates(
  input: MarketPostingInput,
): MarketPostingIdentityCandidate[] {
  const candidates: MarketPostingIdentityCandidate[] = [];
  const requisitionId = normalizeText(input.officialRequisitionId);
  if (requisitionId) {
    candidates.push({
      kind: "requisition",
      key: `requisition:${digest([normalizeText(input.employer), requisitionId])}`,
    });
  }

  const sourceJobId = normalizeText(input.sourceJobId);
  if (sourceJobId) {
    candidates.push({
      kind: "source",
      key: `source:${digest([normalizeText(input.source), sourceJobId])}`,
    });
  }

  const canonicalUrl = normalizeUrl(input.canonicalUrl);
  if (canonicalUrl) {
    candidates.push({
      kind: "canonical_url",
      key: `url:${digest([canonicalUrl])}`,
    });
  }

  const sourceUrl = normalizeUrl(input.sourceUrl);
  if (sourceUrl) {
    candidates.push({
      kind: "source_url",
      key: `source-url:${digest([normalizeText(input.source), sourceUrl])}`,
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      kind: "fallback",
      key: `fallback:${digest([
        normalizeText(input.employer),
        normalizeText(input.title),
        normalizeText(input.location),
      ])}`,
    });
  }

  return candidates;
}

export function buildMarketPostingIdentity(input: MarketPostingInput): string {
  return buildMarketPostingIdentityCandidates(input)[0].key;
}

export function buildMarketObservationKey(input: MarketPostingInput): string {
  const sourceJobId = normalizeText(input.sourceJobId);
  if (sourceJobId) {
    return `source:${digest([normalizeText(input.source), sourceJobId])}`;
  }
  return `url:${digest([
    normalizeText(input.source),
    normalizeUrl(input.sourceUrl),
  ])}`;
}

export function buildMarketPostingContentFingerprint(
  input: MarketPostingInput,
): string {
  return digest([
    normalizeText(input.employer),
    normalizeText(input.title),
    normalizeText(input.location),
    normalizeText(input.description),
    normalizeText(input.datePosted),
    normalizeText(input.deadline),
    normalizeText(input.salaryText),
    normalizeText(input.salaryCurrency),
  ]);
}
