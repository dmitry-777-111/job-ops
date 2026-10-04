import { logger } from "@infra/logger";
import { sanitizeUnknown } from "@infra/sanitize";
import { getExtractorRegistry } from "@server/extractors/registry";
import { getUserId } from "@server/infra/request-context";
import { getAllJobUrls } from "@server/repositories/jobs";
import {
  createSourceRun,
  getLatestIncompleteSourceRun,
  getSourceRun,
  recordPipelineIssue,
  updateSourceRun,
} from "@server/repositories/pipeline-reliability";
import * as settingsRepo from "@server/repositories/settings";
import { withHostedUsageReservation } from "@server/services/hosted-usage";
import { resolveNearbyPlaceNames } from "@server/services/proximity-search";
import {
  buildSharedDiscoveryFingerprint,
  runSharedDiscovery,
} from "@server/services/shared-discovery-coordinator";
import { asyncPool } from "@server/utils/async-pool";
import { listHydratedWatchlistSelectedSources } from "@server/watchlist/results";
import type { ExtractorSourceId } from "@shared/extractors";
import {
  deduplicateJobsByTitleAndEmployer,
  matchJobLocationIntent,
} from "@shared/job-matching.js";
import {
  buildLocationEvidence as buildSharedLocationEvidence,
  createLocationIntentFromLegacyInputs,
  getPrimaryLocationLabel,
  planLocationSource,
} from "@shared/location-domain.js";
import { formatCountryLabel } from "@shared/location-support.js";
import { normalizeStringArray } from "@shared/normalize-string-array.js";
import {
  type CreateJobInput,
  deriveExtractorLimits,
  type PipelineConfig,
} from "@shared/types";
import {
  type CrawlSource,
  type PendingChallenge,
  progressHelpers,
  updateProgress,
} from "../progress";
import { discoverWatchlistJobsForPipeline } from "./watchlist-jobs";

const DISCOVERY_CONCURRENCY = 3;
const DISCOVERY_SOURCE_TIMEOUT_MS = 10 * 60 * 1000;
const DISCOVERY_CANCEL_GRACE_MS = 5_000;
const DISCOVERY_MAX_ATTEMPTS = 2;
const DISCOVERY_RETRY_DELAY_MS = 1_000;

type DiscoveryTaskResult = {
  discoveredJobs: CreateJobInput[];
  sourceErrors: string[];
  challenge?: PendingChallenge;
  fatal?: boolean;
};

async function getSourceRunForSettle(
  pipelineRunId: string,
  source: string,
  outcome:
    | { status: "fulfilled"; result: DiscoveryTaskResult }
    | { status: "rejected"; error: unknown },
) {
  const row = await getSourceRun(pipelineRunId, source);
  if (!row) return;
  const failed =
    outcome.status === "rejected" ||
    (outcome.status === "fulfilled" && outcome.result.fatal === true);
  const errorMessage =
    outcome.status === "rejected"
      ? outcome.error instanceof Error
        ? outcome.error.message
        : "unknown error"
      : outcome.result.sourceErrors.join("; ") || null;
  await updateSourceRun(row.id, {
    status: failed ? "failed" : "complete",
    errorMessage,
  });
  if (failed)
    await recordPipelineIssue({
      issueSignature: `discovery:${source}:${errorMessage ?? "failed"}`,
      source,
      issueType: "discovery_failure",
      pipelineRunId,
      sourceRunId: row.id,
      stage: "discovery",
      errorMessage,
    });
}

type DiscoverySourceTask = {
  source: CrawlSource;
  channels: string[];
  termsTotal?: number;
  detail: string;
  run: () => Promise<DiscoveryTaskResult>;
};

async function withDiscoverySourceTimeout<T>(
  run: Promise<T>,
  onTimeout: () => void,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const guardedRun = run.then(
    (value) => ({ kind: "result" as const, value }),
    (error: unknown) => ({ kind: "error" as const, error }),
  );
  const timeoutPromise = new Promise<{ kind: "timeout" }>((resolve) => {
    timeout = setTimeout(() => {
      onTimeout();
      resolve({ kind: "timeout" });
    }, DISCOVERY_SOURCE_TIMEOUT_MS);
  });

  const outcome = await Promise.race([guardedRun, timeoutPromise]);
  if (timeout) clearTimeout(timeout);
  if (outcome.kind === "result") return outcome.value;
  if (outcome.kind === "error") throw outcome.error;

  await Promise.race([
    guardedRun,
    new Promise((resolve) => setTimeout(resolve, DISCOVERY_CANCEL_GRACE_MS)),
  ]);
  const error = new Error("timed out after 10 minutes");
  error.name = "DiscoveryTimeoutError";
  throw error;
}

function waitForDiscoveryRetry(): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, DISCOVERY_RETRY_DELAY_MS),
  );
}

function parseBlockedCompanyKeywords(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeStringArray(
      parsed.filter((value): value is string => typeof value === "string"),
    );
  } catch {
    return [];
  }
}

function parseWorkplaceTypes(
  raw: string | undefined,
): Array<"remote" | "hybrid" | "onsite"> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is "remote" | "hybrid" | "onsite" =>
        value === "remote" || value === "hybrid" || value === "onsite",
    );
  } catch {
    return [];
  }
}

function isBlockedEmployer(
  employer: string | null | undefined,
  blockedKeywordsLowerCase: string[],
): boolean {
  if (!employer) return false;
  if (blockedKeywordsLowerCase.length === 0) return false;
  const normalizedEmployer = employer.toLowerCase();
  return blockedKeywordsLowerCase.some((keyword) =>
    normalizedEmployer.includes(keyword),
  );
}

function getLegacyLocationSelection(
  intent: NonNullable<PipelineConfig["locationIntent"]>,
): string {
  return intent.selectedCountry ?? "";
}

function getSourceLocationPlan(
  source: CrawlSource,
  intent: NonNullable<PipelineConfig["locationIntent"]>,
  capabilities?: Parameters<typeof planLocationSource>[0]["capabilities"],
): ReturnType<typeof planLocationSource> & {
  canRun: boolean;
  warnings: string[];
} {
  const plan = planLocationSource({ source, intent, capabilities });
  return {
    ...plan,
    canRun: plan.isCompatible,
    warnings: plan.reasons,
  };
}

function buildLocationEvidence(args: {
  location?: string | null;
  isRemote?: boolean | null;
  sourceNotes?: readonly string[] | null;
}): CreateJobInput["locationEvidence"] {
  if (!args.location && args.isRemote !== true) return undefined;
  return buildSharedLocationEvidence({
    location: args.location ?? (args.isRemote ? "Remote" : null),
    isRemote: args.isRemote ?? null,
    source:
      args.sourceNotes?.find((note) => note.startsWith("source:"))?.slice(7) ??
      null,
  });
}

export async function discoverJobsStep(args: {
  pipelineRunId?: string;
  mergedConfig: PipelineConfig;
  includeWatchlist?: boolean;
  preserveFanout?: boolean;
  fanoutSeedJobs?: CreateJobInput[];
  watchlistSelectedSourceIds?: string[] | null;
  shouldCancel?: () => boolean;
}): Promise<{
  discoveredJobs: CreateJobInput[];
  sourceErrors: string[];
  pendingChallenges: PendingChallenge[];
}> {
  logger.info("Running discovery step");

  const discoveredJobs: CreateJobInput[] = [];
  const sourceErrors: string[] = [];
  const includeWatchlist = args.includeWatchlist !== false;
  const watchlistFilterIds = args.watchlistSelectedSourceIds ?? null;
  // [] explicitly disables Watchlist for this run; treat as "no Watchlist
  // sources" without short-circuiting includeWatchlist (so the explicit
  // disable still emits accurate progress totals).
  const watchlistExplicitlyDisabled =
    Array.isArray(watchlistFilterIds) && watchlistFilterIds.length === 0;

  const settings = await settingsRepo.getAllSettings();
  const registry = await getExtractorRegistry();

  const searchTermsSetting = settings.searchTerms;
  let searchTerms: string[] = [];

  if (searchTermsSetting) {
    searchTerms = JSON.parse(searchTermsSetting) as string[];
  } else {
    const defaultSearchTermsEnv =
      process.env.JOBSPY_SEARCH_TERMS || "web developer";
    searchTerms = defaultSearchTermsEnv
      .split("|")
      .map((term) => term.trim())
      .filter(Boolean);
  }

  let locationIntent =
    args.mergedConfig.locationIntent ??
    createLocationIntentFromLegacyInputs({
      selectedCountry: settings.jobspyCountryIndeed ?? "",
      searchCities: settings.searchCities ?? settings.jobspyLocation ?? "",
      workplaceTypes: parseWorkplaceTypes(settings.workplaceTypes),
      searchScope: settings.locationSearchScope,
      matchStrictness: settings.locationMatchStrictness,
      proximity:
        settings.locationSearchMode === "radius" &&
        settings.locationLatitude != null &&
        settings.locationLongitude != null
          ? {
              latitude: Number(settings.locationLatitude),
              longitude: Number(settings.locationLongitude),
              radiusMiles: Number(settings.locationRadiusMiles ?? 50),
            }
          : null,
    });
  if (locationIntent.proximity) {
    locationIntent = {
      ...locationIntent,
      cityLocations: await resolveNearbyPlaceNames(locationIntent.proximity),
    };
  }
  const sourcePlans = args.mergedConfig.sources.map((source) => ({
    source,
    plan: getSourceLocationPlan(
      source,
      locationIntent,
      registry.locationCapabilitiesBySource?.[source],
    ),
  }));
  const sourcePlanBySource = new Map(
    sourcePlans.map(({ source, plan }) => [source, plan]),
  );
  const compatibleSources = sourcePlans
    .filter(({ plan }) => plan.canRun)
    .map(({ source }) => source);
  const runSettings =
    args.mergedConfig.runBudget !== undefined
      ? Object.fromEntries(
          Object.entries(
            deriveExtractorLimits({
              budget: args.mergedConfig.runBudget,
              searchTerms,
              sources: compatibleSources,
            }),
          ).map(([key, value]) => [key, String(value)]),
        )
      : {};
  let existingJobUrlsPromise: Promise<string[]> | null = null;
  const getExistingJobUrls = (): Promise<string[]> => {
    if (!existingJobUrlsPromise) {
      existingJobUrlsPromise = getAllJobUrls();
    }
    return existingJobUrlsPromise;
  };
  const skippedSources = sourcePlans.filter(({ plan }) => !plan.canRun);

  if (skippedSources.length > 0) {
    logger.info("Skipping incompatible sources for requested location intent", {
      step: "discover-jobs",
      locationIntent: {
        selectedCountry: locationIntent.selectedCountry,
        cityCount: locationIntent.cityLocations.length,
        radiusMiles: locationIntent.proximity?.radiusMiles ?? null,
      },
      primaryLocation: getPrimaryLocationLabel(locationIntent),
      requestedSources: args.mergedConfig.sources,
      skippedSources: skippedSources.map(({ source }) => source),
      warnings: skippedSources.flatMap(({ plan }) => plan.warnings),
    });
  }

  if (args.mergedConfig.sources.length > 0 && compatibleSources.length === 0) {
    throw new Error(
      locationIntent.selectedCountry
        ? `No compatible sources for selected country: ${formatCountryLabel(locationIntent.selectedCountry)}`
        : `No compatible sources for requested location: ${getPrimaryLocationLabel(locationIntent)}`,
    );
  }

  const groupedByManifest = new Map<
    string,
    { sources: string[]; detail: string; termsTotal?: number }
  >();

  for (const source of compatibleSources) {
    const manifest = registry.manifestBySource.get(source);
    if (!manifest) {
      sourceErrors.push(`${source}: extractor manifest not registered`);
      continue;
    }

    const existing = groupedByManifest.get(manifest.id);
    if (existing) {
      existing.sources.push(source);
      continue;
    }

    groupedByManifest.set(manifest.id, {
      sources: [source],
      termsTotal: searchTerms.length,
      detail: `${manifest.displayName}: fetching jobs...`,
    });
  }

  const sourceTasks: DiscoverySourceTask[] = [];

  for (const [manifestId, grouped] of groupedByManifest) {
    const manifest = registry.manifests.get(manifestId);
    if (!manifest) continue;

    sourceTasks.push({
      source: manifest.id,
      channels: [...grouped.sources],
      termsTotal: grouped.termsTotal,
      detail:
        grouped.sources.length > 1
          ? `${manifest.displayName}: ${grouped.sources.join(", ")}...`
          : grouped.detail,
      run: async () => {
        const filteredSettings = Object.fromEntries(
          Object.entries({ ...settings, ...runSettings }).filter(
            ([, value]) =>
              typeof value === "string" || typeof value === "undefined",
          ),
        ) as Record<string, string | undefined>;

        let timedOut = false;
        const shouldCancel = () => timedOut || args.shouldCancel?.() === true;
        const sourceRun = args.pipelineRunId
          ? await getSourceRun(args.pipelineRunId, manifest.id)
          : null;
        const recoverySourceRun =
          args.pipelineRunId && !sourceRun?.checkpoint
            ? await getLatestIncompleteSourceRun(
                manifest.id,
                "default",
                args.pipelineRunId,
              )
            : null;
        const sourceLocationPlan = getSourceLocationPlan(
          grouped.sources[0] as CrawlSource,
          locationIntent,
          registry.locationCapabilitiesBySource?.[
            grouped.sources[0] as ExtractorSourceId
          ],
        );
        const resumeCheckpoint =
          sourceRun?.checkpoint ?? recoverySourceRun?.checkpoint ?? undefined;
        const executeManifest = () =>
          manifest.run({
            source: grouped.sources[0],
            selectedSources: grouped.sources,
            settings: filteredSettings,
            searchTerms,
            selectedCountry: getLegacyLocationSelection(locationIntent),
            locationIntent,
            sourceLocationPlan,
            getExistingJobUrls,
            shouldCancel,
            resumeCheckpoint,
            onCheckpoint: async (checkpoint) => {
              if (!sourceRun) return;
              const coverage =
                checkpoint && typeof checkpoint === "object"
                  ? (checkpoint as { coverageCompleted?: unknown })
                      .coverageCompleted
                  : undefined;
              await updateSourceRun(sourceRun.id, {
                checkpoint,
                coverageCompleted:
                  typeof coverage === "number" ? coverage : undefined,
              });
            },
            onProgress: (event) => {
              if (shouldCancel()) return;
              const role =
                searchTerms.find((term) => event.currentUrl === term) ??
                searchTerms.find((term) =>
                  event.currentUrl?.startsWith(`${term} @`),
                );
              if (event.termsProcessed !== undefined && role) {
                progressHelpers.updateFanoutTaskTerms(
                  manifest.id,
                  role,
                  event.termsProcessed,
                  event.termsTotal,
                );
              }
              progressHelpers.crawlingUpdate({
                source: manifest.id,
                termsProcessed: event.termsProcessed,
                termsTotal: event.termsTotal,
                listPagesProcessed: event.listPagesProcessed,
                listPagesTotal: event.listPagesTotal,
                jobCardsFound: event.jobCardsFound,
                jobPagesEnqueued: event.jobPagesEnqueued,
                jobPagesSkipped: event.jobPagesSkipped,
                jobPagesProcessed: event.jobPagesProcessed,
                phase: event.phase,
                currentUrl: event.currentUrl,
              });

              if (event.detail) {
                updateProgress({
                  step: "crawling",
                  detail: event.detail,
                });
              }
            },
          });

        const shareable =
          manifest.capabilities?.shareablePublicDiscovery === true &&
          args.preserveFanout !== true &&
          resumeCheckpoint === undefined &&
          !shouldCancel();
        const run = shareable
          ? (async () => {
              const existingJobUrls = [...(await getExistingJobUrls())].sort();
              const requiredEnv = Object.fromEntries(
                (manifest.requiredEnvVars ?? []).map((name) => [
                  name,
                  process.env[name] ?? null,
                ]),
              );
              const fingerprint = buildSharedDiscoveryFingerprint({
                version: "freeze3-public-discovery-v1",
                manifestId: manifest.id,
                channels: grouped.sources,
                searchTerms,
                locationIntent,
                sourceLocationPlan,
                settings: filteredSettings,
                requiredEnv,
                existingJobUrls,
              });
              const { result, reuse } = await runSharedDiscovery({
                fingerprint,
                run: executeManifest,
                isReusable: () => !shouldCancel(),
              });
              if (reuse !== "fresh") {
                logger.info("Reused shareable public discovery result", {
                  source: manifest.id,
                  reuse,
                });
              }
              return result;
            })()
          : executeManifest();
        const result = await withDiscoverySourceTimeout(run, () => {
          timedOut = true;
        });

        if (!result.success) {
          return {
            discoveredJobs: [],
            sourceErrors: [
              `${manifest.displayName || manifest.id}: ${result.error ?? "unknown error"} (sources: ${grouped.sources.join(",")})`,
            ],
            fatal: true,
            challenge: result.challengeRequired
              ? {
                  extractorId: manifest.id,
                  extractorName: manifest.displayName || manifest.id,
                  url: result.challengeRequired,
                  sources: grouped.sources as ExtractorSourceId[],
                }
              : undefined,
          };
        }

        return {
          discoveredJobs: result.jobs,
          sourceErrors: result.sourceErrors ?? [],
        };
      },
    });
  }

  let watchlistSelectedSources: Awaited<
    ReturnType<typeof listHydratedWatchlistSelectedSources>
  > = [];
  if (includeWatchlist && !watchlistExplicitlyDisabled && getUserId()) {
    try {
      watchlistSelectedSources = await listHydratedWatchlistSelectedSources();
    } catch (error) {
      logger.warn("Failed to load Watchlist sources for pipeline discovery", {
        step: "discover-jobs",
        error: sanitizeUnknown(error),
      });
      sourceErrors.push("Watchlist: failed to load selected sources");
    }

    // When the caller passed an explicit subset, intersect by ID and drop
    // anything the current user does not own. Never trust the client to
    // scope across tenants — IDs always re-resolve through the user-scoped
    // listHydratedWatchlistSelectedSources() call above.
    if (
      Array.isArray(watchlistFilterIds) &&
      watchlistFilterIds.length > 0 &&
      watchlistSelectedSources.length > 0
    ) {
      const ownedIds = new Set(
        watchlistSelectedSources.map((source) => source.id),
      );
      const requestedIds = new Set(watchlistFilterIds);
      const unknownIds = watchlistFilterIds.filter((id) => !ownedIds.has(id));
      if (unknownIds.length > 0) {
        logger.warn(
          "Ignoring unknown Watchlist source IDs in pipeline discovery",
          {
            step: "discover-jobs",
            unknownIdCount: unknownIds.length,
            requestedIdCount: watchlistFilterIds.length,
          },
        );
      }
      watchlistSelectedSources = watchlistSelectedSources.filter((source) =>
        requestedIds.has(source.id),
      );
    }
  }

  const totalSources =
    sourceTasks.length + (watchlistSelectedSources.length > 0 ? 1 : 0);
  let completedSources = 0;
  let successfulSearchUnits = 0;

  progressHelpers.startCrawling(totalSources, args.preserveFanout);
  if (!args.preserveFanout) {
    const locationCount = Math.max(1, locationIntent.cityLocations.length);
    progressHelpers.initializeFanout({
      roles: searchTerms,
      tasks: [
        ...sourceTasks.map((task) => ({
          id: task.source,
          unitsPerRole:
            (groupedByManifest.get(task.source)?.sources.length ?? 1) *
            locationCount,
        })),
        ...(watchlistSelectedSources.length > 0
          ? [{ id: "watchlist", unitsPerRole: locationCount }]
          : []),
      ],
      locations:
        locationIntent.cityLocations.length > 0
          ? locationIntent.cityLocations
          : [getPrimaryLocationLabel(locationIntent)],
      sources: [
        ...compatibleSources,
        ...(watchlistSelectedSources.length > 0 ? ["watchlist"] : []),
      ],
      locationCount,
      sourceCount:
        compatibleSources.length +
        (watchlistSelectedSources.length > 0 ? 1 : 0),
      capacity: DISCOVERY_CONCURRENCY,
    });
  }

  if (args.shouldCancel?.()) {
    return { discoveredJobs, sourceErrors, pendingChallenges: [] };
  }
  if (totalSources === 0) {
    return { discoveredJobs, sourceErrors, pendingChallenges: [] };
  }

  return withHostedUsageReservation(
    {
      action: "job_search",
      units: totalSources,
    },
    async () => {
      const settledJobs: CreateJobInput[] = [...(args.fanoutSeedJobs ?? [])];
      const liveBlockedKeywordsLowerCase = parseBlockedCompanyKeywords(
        settings.blockedCompanyKeywords,
      ).map((value) => value.toLowerCase());
      const filterForFanout = (jobs: CreateJobInput[]) =>
        jobs
          .filter((job) => {
            const evidence =
              job.locationEvidence ??
              buildLocationEvidence({
                location: job.location,
                isRemote: job.isRemote,
                sourceNotes: [`source:${job.source}`],
              });
            job.locationEvidence = evidence;
            return matchJobLocationIntent(job, locationIntent).matched;
          })
          .filter(
            (job) =>
              !isBlockedEmployer(job.employer, liveBlockedKeywordsLowerCase),
          );
      const updateFanoutResults = () => {
        progressHelpers.updateFanoutResults(
          settledJobs.length,
          deduplicateJobsByTitleAndEmployer(filterForFanout(settledJobs))
            .length,
        );
      };
      const sourceResults = await asyncPool<
        DiscoverySourceTask,
        DiscoveryTaskResult
      >({
        items: sourceTasks,
        concurrency: DISCOVERY_CONCURRENCY,
        shouldStop: args.shouldCancel,
        onTaskStarted: (sourceTask) => {
          progressHelpers.startFanoutTask(sourceTask.source);
          progressHelpers.startSource(
            sourceTask.source,
            completedSources,
            totalSources,
            {
              termsTotal: sourceTask.termsTotal,
              detail: sourceTask.detail,
            },
          );
        },
        onTaskSettled: (sourceTask, _index, outcome) => {
          completedSources += 1;
          progressHelpers.completeSource(completedSources, totalSources);
          if (outcome.status === "fulfilled") {
            settledJobs.push(...outcome.result.discoveredJobs);
            progressHelpers.settleFanoutTask(
              sourceTask.source,
              outcome.result.challenge ? "check" : "complete",
            );
            updateFanoutResults();
          } else {
            progressHelpers.settleFanoutTask(sourceTask.source, "complete");
          }
        },
        task: async (sourceTask) => {
          let sourceRunId: string | null = null;
          const channelRunIds = new Map<string, string>();
          if (args.pipelineRunId) {
            const row = await createSourceRun({
              pipelineRunId: args.pipelineRunId,
              source: sourceTask.source,
            });
            sourceRunId = row?.id ?? null;
            for (const channel of sourceTask.channels) {
              const channelRow = await createSourceRun({
                pipelineRunId: args.pipelineRunId,
                source: channel,
                scopeKey: "channel",
              });
              if (channelRow?.id) channelRunIds.set(channel, channelRow.id);
            }
          }
          let lastError: unknown = null;
          for (
            let attempt = 1;
            attempt <= DISCOVERY_MAX_ATTEMPTS;
            attempt += 1
          ) {
            if (sourceRunId)
              await updateSourceRun(sourceRunId, {
                status: attempt === 1 ? "running" : "retry",
                incrementAttempt: true,
              });
            for (const channelRunId of channelRunIds.values()) {
              await updateSourceRun(channelRunId, {
                status: attempt === 1 ? "running" : "retry",
                incrementAttempt: true,
              });
            }
            try {
              const result = await sourceTask.run();
              const shouldRetry =
                result.fatal &&
                !result.challenge &&
                attempt < DISCOVERY_MAX_ATTEMPTS;
              if (shouldRetry) {
                lastError = new Error(
                  result.sourceErrors.join("; ") || "source failed",
                );
                await waitForDiscoveryRetry();
              } else {
                if (args.pipelineRunId && sourceRunId)
                  await getSourceRunForSettle(
                    args.pipelineRunId,
                    sourceTask.source,
                    { status: "fulfilled", result },
                  );
                for (const [channel, channelRunId] of channelRunIds) {
                  const channelErrors = result.sourceErrors.filter((error) =>
                    error.toLowerCase().startsWith(`${channel.toLowerCase()}:`),
                  );
                  await updateSourceRun(channelRunId, {
                    status: result.fatal
                      ? "failed"
                      : channelErrors.length > 0
                        ? "degraded"
                        : "complete",
                    errorMessage: channelErrors.join("; ") || null,
                  });
                }
                return result;
              }
            } catch (error) {
              lastError = error;
              const retryable =
                !(
                  error instanceof Error &&
                  error.name === "DiscoveryTimeoutError"
                ) && attempt < DISCOVERY_MAX_ATTEMPTS;
              if (retryable) {
                await waitForDiscoveryRetry();
              } else {
                break;
              }
            }
          }

          if (args.pipelineRunId && sourceRunId)
            await getSourceRunForSettle(args.pipelineRunId, sourceTask.source, {
              status: "rejected",
              error: lastError,
            });
          for (const channelRunId of channelRunIds.values()) {
            await updateSourceRun(channelRunId, {
              status: "failed",
              errorMessage:
                lastError instanceof Error
                  ? lastError.message
                  : "unknown error",
            });
          }
          logger.warn("Discovery source task failed after bounded retry", {
            sourceTask: sourceTask.source,
            error: sanitizeUnknown(lastError),
          });

          return {
            discoveredJobs: [],
            sourceErrors: [
              `${sourceTask.source}: ${lastError instanceof Error ? lastError.message : "unknown error"}`,
            ],
            fatal: true,
          };
        },
      });

      // Collect challenges after ALL extractors finish, not on first failure.
      // This way the user sees every challenged site at once and can solve them
      // in a single batch, rather than solve-one → re-run → hit-next → solve-again.
      const pendingChallenges: PendingChallenge[] = [];
      for (const sourceResult of sourceResults) {
        discoveredJobs.push(...sourceResult.discoveredJobs);
        sourceErrors.push(...sourceResult.sourceErrors);
        if (sourceResult.challenge) {
          pendingChallenges.push(sourceResult.challenge);
        } else if (!sourceResult.fatal) {
          successfulSearchUnits += 1;
        }
      }

      if (watchlistSelectedSources.length > 0 && !args.shouldCancel?.()) {
        progressHelpers.startFanoutTask("watchlist");
        progressHelpers.startSource(
          "watchlist",
          completedSources,
          totalSources,
          {
            detail: "Watchlist: fetching saved sources...",
          },
        );
        const watchlistResult = await discoverWatchlistJobsForPipeline({
          selectedSources: watchlistSelectedSources,
          searchTerms,
          shouldCancel: args.shouldCancel,
        });
        completedSources += 1;
        progressHelpers.completeSource(completedSources, totalSources);

        discoveredJobs.push(...watchlistResult.discoveredJobs);
        settledJobs.push(...watchlistResult.discoveredJobs);
        progressHelpers.settleFanoutTask("watchlist", "complete");
        updateFanoutResults();
        sourceErrors.push(...watchlistResult.sourceErrors);
        if (
          watchlistResult.failedSourceCount <
          watchlistResult.selectedSourceCount
        ) {
          successfulSearchUnits += 1;
        }

        if (
          sourceTasks.length === 0 &&
          watchlistResult.selectedSourceCount > 0 &&
          watchlistResult.failedSourceCount ===
            watchlistResult.selectedSourceCount
        ) {
          throw new Error(`All sources failed: ${sourceErrors.join("; ")}`);
        }
      }

      const locationFilterReasonCounts: Record<string, number> = {};
      const locationFilteredJobs = discoveredJobs.filter((job) => {
        const evidence =
          job.locationEvidence ??
          buildLocationEvidence({
            location: job.location,
            isRemote: job.isRemote,
            sourceNotes: [`source:${job.source}`],
          });
        job.locationEvidence = evidence;
        const match = matchJobLocationIntent(job, locationIntent, {
          nativeRadiusApplied:
            sourcePlanBySource.get(job.source as ExtractorSourceId)
              ?.usesNativeRadius ?? false,
        });
        if (match.matched) {
          return true;
        }
        const reasonCode = match.reasonCode;
        locationFilterReasonCounts[reasonCode] =
          (locationFilterReasonCounts[reasonCode] ?? 0) + 1;
        return false;
      });
      const locationFilteredOutCount =
        discoveredJobs.length - locationFilteredJobs.length;

      if (locationFilteredOutCount > 0) {
        logger.info(
          "Dropped discovered jobs that did not satisfy location preferences",
          {
            step: "discover-jobs",
            droppedCount: locationFilteredOutCount,
            locationIntent: {
              selectedCountry: locationIntent.selectedCountry,
              cityCount: locationIntent.cityLocations.length,
              radiusMiles: locationIntent.proximity?.radiusMiles ?? null,
            },
            primaryLocation: getPrimaryLocationLabel(locationIntent),
            reasonCounts: locationFilterReasonCounts,
          },
        );
      }

      const blockedCompanyKeywords = parseBlockedCompanyKeywords(
        settings.blockedCompanyKeywords,
      );
      const blockedKeywordsLowerCase = blockedCompanyKeywords.map((value) =>
        value.toLowerCase(),
      );
      const filteredDiscoveredJobs = locationFilteredJobs.filter(
        (job) => !isBlockedEmployer(job.employer, blockedKeywordsLowerCase),
      );
      const droppedCount =
        locationFilteredJobs.length - filteredDiscoveredJobs.length;

      if (droppedCount > 0) {
        const blockedCompanyKeywordsPreview = blockedCompanyKeywords.slice(
          0,
          10,
        );
        const blockedCompanyKeywordsTruncated =
          blockedCompanyKeywordsPreview.length < blockedCompanyKeywords.length;

        logger.info(
          "Dropped discovered jobs matching blocked company keywords",
          {
            step: "discover-jobs",
            droppedCount,
            blockedKeywordCount: blockedCompanyKeywords.length,
            blockedCompanyKeywordsPreview,
            blockedCompanyKeywordsTruncated,
          },
        );

        logger.debug("Full blocked company keywords used for filtering", {
          step: "discover-jobs",
          blockedCompanyKeywords,
        });
      }

      if (args.shouldCancel?.()) {
        return {
          result: {
            discoveredJobs: filteredDiscoveredJobs,
            sourceErrors,
            pendingChallenges,
          },
          usedUnits: successfulSearchUnits,
        };
      }

      // Don't throw "all sources failed" when challenges are pending — the
      // orchestrator will pause, let the user solve them, then re-run those
      // extractors.  Jobs from non-challenged extractors (if any) are kept.
      const fatalSourceFailures = sourceResults.filter(
        (sourceResult) => sourceResult.fatal,
      ).length;
      if (
        filteredDiscoveredJobs.length === 0 &&
        sourceResults.length > 0 &&
        fatalSourceFailures === sourceResults.length &&
        pendingChallenges.length === 0
      ) {
        throw new Error(`All sources failed: ${sourceErrors.join("; ")}`);
      }

      if (sourceErrors.length > 0) {
        if (pendingChallenges.length > 0) {
          logger.info(
            "Some discovery sources hit challenges and will be retried",
            {
              sourceErrors,
              pendingChallenges,
            },
          );
        } else {
          logger.warn("Some discovery sources failed", { sourceErrors });
        }
      }

      // Don't transition to "importing" yet if there are challenges to solve —
      // the orchestrator will pause and re-run after challenges are resolved.
      if (pendingChallenges.length === 0) {
        progressHelpers.crawlingComplete(filteredDiscoveredJobs.length);
      }

      return {
        result: {
          discoveredJobs: filteredDiscoveredJobs,
          sourceErrors,
          pendingChallenges,
        },
        usedUnits: successfulSearchUnits,
      };
    },
  );
}
