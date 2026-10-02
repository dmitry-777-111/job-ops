import { describe, expect, it } from "vitest";
import { aggregateCanadaLmiaRows } from "./canada-immigration";

describe("Canada LMIA aggregation", () => {
  it("preserves multiple LMIA rows for one employer and aggregates streams", () => {
    const result = aggregateCanadaLmiaRows({
      matchedNames: ["Example Industries Inc.", "Example Industries Inc."],
      sourceDate: "2026-09-30T12:00:00.000Z",
      checkedAt: "2026-10-02T12:00:00.000Z",
      rows: [
        {
          organisationName: "Example Industries Inc.",
          townCity: "Toronto",
          county: "ON",
          typeRating: "LMIA positive employer (2026Q2: 2 approved positions)",
          route: "High-wage",
        },
        {
          organisationName: "Example Industries Inc.",
          townCity: "Toronto",
          county: "ON",
          typeRating: "LMIA positive employer (2026Q2: 1 approved positions)",
          route: "Global Talent Stream",
        },
        {
          organisationName: "Example Industries Inc.",
          townCity: "Toronto",
          county: "ON",
          typeRating: "LMIA positive employer (2026Q1)",
          route: "High-wage",
        },
      ],
    });

    expect(result.lmiaHistoricalSignal).toBe("matched");
    expect(result.lmiaMatchedRows).toBe(3);
    expect(result.lmiaLatestQuarter).toBe("2026Q2");
    expect(result.lmiaStreams).toEqual(["Global Talent Stream", "High-wage"]);
    expect(result.lmiaMatchedEmployerNames).toEqual([
      "Example Industries Inc.",
    ]);
    expect(result.lmiaSourceUrl).toContain("open.canada.ca");
  });
});
