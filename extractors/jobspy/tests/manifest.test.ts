import type { ExtractorRuntimeContext } from "@shared/types/extractors";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runJobSpyMock } = vi.hoisted(() => ({
  runJobSpyMock: vi.fn(),
}));

vi.mock("../src/run", () => ({ runJobSpy: runJobSpyMock }));

import manifest from "../manifest";

describe("JobSpy manifest map-radius planning", () => {
  beforeEach(() => {
    runJobSpyMock.mockReset();
    runJobSpyMock.mockResolvedValue({ success: true, jobs: [] });
  });

  it("polyfills the radius with every place and shares the result allowance", async () => {
    const locations = ["Leeds", "Bradford", "Wakefield"];
    await manifest.run({
      source: "indeed",
      selectedSources: ["indeed", "linkedin"],
      settings: { jobspyResultsWanted: "50" },
      searchTerms: ["developer"],
      selectedCountry: "united kingdom",
      locationIntent: {
        selectedCountry: "united kingdom",
        country: "united kingdom",
        cityLocations: locations,
        workplaceTypes: ["onsite"],
        geoScope: "selected_only",
        searchScope: "selected_only",
        matchStrictness: "exact_only",
        proximity: { latitude: 53.8, longitude: -1.55, radiusMiles: 25 },
      },
      sourceLocationPlan: { requestedCities: locations },
    } as ExtractorRuntimeContext);

    expect(runJobSpyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locations,
        resultsWanted: 17,
      }),
    );
    expect(
      manifest.locationCapabilities?.indeed?.supportsNativeRadius,
    ).not.toBe(true);
    expect(
      manifest.locationCapabilities?.linkedin?.supportsNativeRadius,
    ).not.toBe(true);
    expect(
      manifest.locationCapabilities?.glassdoor?.supportsNativeRadius,
    ).not.toBe(true);
  });

  it("passes persisted checkpoint units and writes completed units back", async () => {
    const onCheckpoint = vi.fn();
    runJobSpyMock.mockImplementation(async (options) => {
      expect(options.completedUnitKeys).toEqual(["engineer\u0000Toronto, ON"]);
      await options.onUnitComplete({
        key: "engineer\u0000Calgary, AB",
        completed: 2,
        total: 3,
      });
      return { success: true, jobs: [] };
    });

    await manifest.run({
      source: "indeed",
      selectedSources: ["indeed", "linkedin"],
      settings: {},
      searchTerms: ["engineer"],
      selectedCountry: "canada",
      resumeCheckpoint: {
        version: 1,
        planFingerprint: JSON.stringify({
          sites: ["indeed", "linkedin"],
          searchTerms: ["engineer"],
          locations: [null],
          countryIndeed: null,
        }),
        completedUnitKeys: ["engineer\u0000Toronto, ON"],
      },
      onCheckpoint,
    } as ExtractorRuntimeContext);

    expect(onCheckpoint).toHaveBeenCalledWith({
      version: 1,
      planFingerprint: expect.any(String),
      completedUnitKeys: [
        "engineer\u0000Toronto, ON",
        "engineer\u0000Calgary, AB",
      ],
      coverageCompleted: 2,
      coverageExpected: 3,
    });
  });

  it("passes cancellation through to the JobSpy child runner", async () => {
    const shouldCancel = vi.fn(() => false);
    await manifest.run({
      source: "indeed",
      selectedSources: ["indeed", "linkedin"],
      settings: {},
      searchTerms: ["engineer"],
      selectedCountry: "canada",
      shouldCancel,
    } as ExtractorRuntimeContext);

    expect(runJobSpyMock).toHaveBeenCalledWith(
      expect.objectContaining({ shouldCancel }),
    );
  });

  it("keeps the configured allowance for manual cities", async () => {
    const locations = ["Leeds", "Bradford"];
    await manifest.run({
      source: "indeed",
      selectedSources: ["indeed"],
      settings: { jobspyResultsWanted: "50" },
      searchTerms: ["developer"],
      selectedCountry: "united kingdom",
      sourceLocationPlan: { requestedCities: locations },
    } as ExtractorRuntimeContext);

    expect(runJobSpyMock).toHaveBeenCalledWith(
      expect.objectContaining({ locations, resultsWanted: 50 }),
    );
  });
});
