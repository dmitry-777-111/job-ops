import {
  GLASSDOOR_SUPPORTED_COUNTRY_KEYS,
  JOBSPY_SUPPORTED_COUNTRY_KEYS,
} from "@shared/location-support.js";
import type {
  ExtractorManifest,
  ExtractorRuntimeContext,
} from "@shared/types/extractors";
import { runJobSpy } from "./src/run";

type JobSpySite = NonNullable<Parameters<typeof runJobSpy>[0]["sites"]>[number];

const JOBSPY_SOURCES = new Set<JobSpySite>(["indeed", "linkedin", "glassdoor"]);

function isJobSpySite(source: string): source is JobSpySite {
  return JOBSPY_SOURCES.has(source as JobSpySite);
}

export const manifest: ExtractorManifest = {
  id: "jobspy",
  displayName: "JobSpy",
  providesSources: ["indeed", "linkedin", "glassdoor"],
  capabilities: { locationEvidence: true },
  locationCapabilities: {
    indeed: { supportedCountryKeys: JOBSPY_SUPPORTED_COUNTRY_KEYS },
    linkedin: { supportedCountryKeys: JOBSPY_SUPPORTED_COUNTRY_KEYS },
    glassdoor: {
      supportedCountryKeys: GLASSDOOR_SUPPORTED_COUNTRY_KEYS,
      requiresCityLocations: true,
    },
  },
  async run(context: ExtractorRuntimeContext) {
    if (context.shouldCancel?.()) {
      return { success: true, jobs: [] };
    }

    const sites = context.selectedSources.filter(isJobSpySite);
    const locations = context.sourceLocationPlan?.requestedCities;
    const configuredResultsWanted = context.settings.jobspyResultsWanted
      ? parseInt(context.settings.jobspyResultsWanted, 10)
      : undefined;
    const resultsWanted =
      configuredResultsWanted && context.locationIntent?.proximity
        ? Math.max(
            1,
            Math.ceil(
              configuredResultsWanted / Math.max(1, locations?.length ?? 0),
            ),
          )
        : configuredResultsWanted;

    const planFingerprint = JSON.stringify({
      sites,
      searchTerms: context.searchTerms,
      locations: locations ?? [
        context.settings.searchCities ??
          context.settings.jobspyLocation ??
          null,
      ],
      countryIndeed: context.settings.jobspyCountryIndeed ?? null,
    });
    const resumeCheckpoint =
      context.resumeCheckpoint && typeof context.resumeCheckpoint === "object"
        ? (context.resumeCheckpoint as {
            planFingerprint?: unknown;
            completedUnitKeys?: unknown;
          })
        : undefined;
    const completedUnitKeys =
      resumeCheckpoint?.planFingerprint === planFingerprint &&
      Array.isArray(resumeCheckpoint.completedUnitKeys)
        ? resumeCheckpoint.completedUnitKeys.filter(
            (key): key is string => typeof key === "string",
          )
        : [];

    const result = await runJobSpy({
      sites,
      searchTerms: context.searchTerms,
      locations,
      location:
        context.settings.searchCities ?? context.settings.jobspyLocation,
      resultsWanted,
      countryIndeed: context.settings.jobspyCountryIndeed,
      workplaceTypes: context.settings.workplaceTypes
        ? JSON.parse(context.settings.workplaceTypes)
        : undefined,
      shouldCancel: context.shouldCancel,
      completedUnitKeys,
      onUnitComplete: async (unit) => {
        if (!completedUnitKeys.includes(unit.key))
          completedUnitKeys.push(unit.key);
        await context.onCheckpoint?.({
          version: 1,
          planFingerprint,
          completedUnitKeys: [...completedUnitKeys],
          coverageCompleted: unit.completed,
          coverageExpected: unit.total,
        });
      },
      onProgress: (event) => {
        if (context.shouldCancel?.()) return;

        if (event.type === "term_start") {
          context.onProgress?.({
            phase: "list",
            termsProcessed: Math.max(event.termIndex - 1, 0),
            termsTotal: event.termTotal,
            currentUrl: event.searchTerm,
            detail: `JobSpy: term ${event.termIndex}/${event.termTotal} (${event.searchTerm})`,
          });
          return;
        }

        if (event.type === "source_error") {
          context.onProgress?.({
            phase: "list",
            currentUrl: event.searchTerm,
            detail: `JobSpy: ${event.source} failed for ${event.searchTerm}`,
          });
          return;
        }

        context.onProgress?.({
          phase: "list",
          termsProcessed: event.termIndex,
          termsTotal: event.termTotal,
          currentUrl: event.searchTerm,
          detail: `JobSpy: completed ${event.termIndex}/${event.termTotal} (${event.searchTerm}) with ${event.jobsFoundTerm} jobs`,
        });
      },
    });

    if (!result.success) {
      return {
        success: false,
        jobs: [],
        error: result.error,
      };
    }

    return {
      success: true,
      jobs: result.jobs,
      sourceErrors: result.sourceErrors,
    };
  },
};

export default manifest;
