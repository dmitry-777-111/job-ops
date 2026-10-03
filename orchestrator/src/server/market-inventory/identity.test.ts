import type { MarketPostingInput } from "@shared/types";
import { describe, expect, it } from "vitest";
import {
  buildMarketObservationKey,
  buildMarketPostingContentFingerprint,
  buildMarketPostingIdentity,
} from "./identity";

const base: MarketPostingInput = {
  source: "indeed",
  sourceJobId: "abc-123",
  sourceUrl: "https://example.com/job?id=abc-123&utm_source=test",
  employer: "Acme Foods",
  title: "Maintenance Supervisor",
  location: "Toronto, ON",
  description: "Lead the maintenance team.",
};

describe("market inventory identity", () => {
  it("prefers official requisition identity over source identity", () => {
    const a = buildMarketPostingIdentity({
      ...base,
      officialRequisitionId: "REQ-42",
      source: "indeed",
      sourceJobId: "indeed-1",
    });
    const b = buildMarketPostingIdentity({
      ...base,
      officialRequisitionId: "REQ-42",
      source: "workday:acme",
      sourceJobId: "workday-99",
    });
    expect(a).toBe(b);
    expect(a.startsWith("requisition:")).toBe(true);
  });

  it("does not fuzzy-merge two source jobs with different stable ids", () => {
    const a = buildMarketPostingIdentity({ ...base, sourceJobId: "job-a" });
    const b = buildMarketPostingIdentity({ ...base, sourceJobId: "job-b" });
    expect(a).not.toBe(b);
  });

  it("normalizes tracking parameters in observation urls", () => {
    const a = buildMarketObservationKey({
      ...base,
      sourceJobId: null,
      sourceUrl: "https://example.com/job/42?utm_source=a",
    });
    const b = buildMarketObservationKey({
      ...base,
      sourceJobId: null,
      sourceUrl: "https://example.com/job/42?utm_source=b",
    });
    expect(a).toBe(b);
  });

  it("changes content fingerprint when decision-relevant content changes", () => {
    const a = buildMarketPostingContentFingerprint(base);
    const b = buildMarketPostingContentFingerprint({
      ...base,
      salaryText: "$95,000",
    });
    expect(a).not.toBe(b);
  });
});
