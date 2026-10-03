import { randomUUID } from "node:crypto";
import { parseBamboohrUrl } from "@career-boards/bamboohr";
import { parseGreenhouseUrl } from "@career-boards/greenhouse";
import { parseWorkdayJobUrl, parseWorkdayUrl } from "@career-boards/workday";
import { getUserId } from "@server/infra/request-context";
import {
  ensureWatchlistSelectedSource,
  listWatchlistSelectedSources,
  removeWatchlistSelectedSourceByCareersUrl,
} from "@server/repositories/watchlist";
import { getWatchlistSourceAdapter } from "@server/watchlist/adapters";
import { normalizeCompanyName } from "@shared/job-matching.js";
import type {
  DynamicEmployer,
  DynamicEmployerEvent,
  DynamicEmployerEventType,
  DynamicEmployerStatus,
  Job,
  WatchedSourceType,
} from "@shared/types";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { getActiveTenantId } from "../tenancy/context";

const { dynamicEmployerEvents, dynamicEmployers } = schema;

type EmployerObservationJob = {
  employer: string;
  source: Job["source"];
  jobUrl: string;
  applicationLink?: string | null;
  employerUrl?: string | null;
  jobUrlDirect?: string | null;
  companyUrlDirect?: string | null;
};

type AtsDetection = {
  sourceType: WatchedSourceType;
  careersUrl: string;
  supported: boolean;
};

function requireUserId(): string {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User context is required for dynamic employer tracking.");
  }
  return userId;
}

function mapEmployer(
  row: typeof dynamicEmployers.$inferSelect,
): DynamicEmployer {
  return {
    id: row.id,
    normalizedName: row.normalizedName,
    displayName: row.displayName,
    status: row.status,
    sourceType: row.sourceType as WatchedSourceType | null,
    careersUrl: row.careersUrl,
    firstSeenSource: row.firstSeenSource as Job["source"] | null,
    firstSeenJobUrl: row.firstSeenJobUrl,
    lastSeenSource: row.lastSeenSource as Job["source"] | null,
    lastSeenJobUrl: row.lastSeenJobUrl,
    observationCount: row.observationCount,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    activatedAt: row.activatedAt,
    retiredAt: row.retiredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapEvent(
  row: typeof dynamicEmployerEvents.$inferSelect,
): DynamicEmployerEvent {
  return {
    id: row.id,
    employerId: row.employerId,
    eventType: row.eventType,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    discoverySource: row.discoverySource as Job["source"] | null,
    jobUrl: row.jobUrl,
    sourceType: row.sourceType as WatchedSourceType | null,
    careersUrl: row.careersUrl,
    note: row.note,
    createdAt: row.createdAt,
  };
}

function urlsForJob(job: EmployerObservationJob): string[] {
  return [
    job.applicationLink,
    job.jobUrlDirect,
    job.employerUrl,
    job.companyUrlDirect,
    job.jobUrl,
  ].filter((value): value is string => Boolean(value?.trim()));
}

function detectWorkday(url: string): AtsDetection | null {
  try {
    const parsed = parseWorkdayJobUrl(url);
    return {
      sourceType: "workday",
      careersUrl: parsed.canonicalCareersUrl,
      supported: true,
    };
  } catch {
    try {
      const parsed = parseWorkdayUrl(url);
      return {
        sourceType: "workday",
        careersUrl: parsed.canonicalCareersUrl,
        supported: true,
      };
    } catch {
      return null;
    }
  }
}

function detectGreenhouse(url: string): AtsDetection | null {
  try {
    const parsed = parseGreenhouseUrl(url);
    return {
      sourceType: "greenhouse",
      careersUrl: parsed.canonicalCareersUrl,
      supported: true,
    };
  } catch {
    return null;
  }
}

function detectBamboohr(url: string): AtsDetection | null {
  try {
    const parsed = parseBamboohrUrl(url);
    return {
      sourceType: "bamboohr",
      careersUrl: parsed.canonicalCareersUrl,
      supported: true,
    };
  } catch {
    return null;
  }
}

function detectKnownUnsupportedAts(url: string): AtsDetection | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);
    const company = segments[0];
    if (!company) return null;

    if (host === "jobs.lever.co") {
      return {
        sourceType: "lever",
        careersUrl: `${parsed.origin}/${company}`,
        supported: false,
      };
    }
    if (host === "jobs.ashbyhq.com") {
      return {
        sourceType: "ashby",
        careersUrl: `${parsed.origin}/${company}`,
        supported: false,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function detectEmployerAts(
  job: EmployerObservationJob,
): AtsDetection | null {
  for (const url of urlsForJob(job)) {
    const detection =
      detectWorkday(url) ??
      detectGreenhouse(url) ??
      detectBamboohr(url) ??
      detectKnownUnsupportedAts(url);
    if (detection) return detection;
  }
  return null;
}

async function getEmployerByNormalizedName(
  normalizedName: string,
): Promise<DynamicEmployer | null> {
  const tenantId = getActiveTenantId();
  const userId = requireUserId();
  const [row] = await db
    .select()
    .from(dynamicEmployers)
    .where(
      and(
        eq(dynamicEmployers.tenantId, tenantId),
        eq(dynamicEmployers.userId, userId),
        eq(dynamicEmployers.normalizedName, normalizedName),
      ),
    );
  return row ? mapEmployer(row) : null;
}

async function recordEvent(input: {
  employerId: string;
  eventType: DynamicEmployerEventType;
  fromStatus: DynamicEmployerStatus | null;
  toStatus: DynamicEmployerStatus;
  discoverySource?: Job["source"] | null;
  jobUrl?: string | null;
  sourceType?: WatchedSourceType | null;
  careersUrl?: string | null;
  note?: string | null;
}): Promise<void> {
  await db.insert(dynamicEmployerEvents).values({
    id: randomUUID(),
    tenantId: getActiveTenantId(),
    userId: requireUserId(),
    employerId: input.employerId,
    eventType: input.eventType,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    discoverySource: input.discoverySource ?? null,
    jobUrl: input.jobUrl ?? null,
    sourceType: input.sourceType ?? null,
    careersUrl: input.careersUrl ?? null,
    note: input.note ?? null,
  });
}

function statusFromDetection(
  detection: AtsDetection | null,
): DynamicEmployerStatus {
  if (!detection) return "discovered";
  return detection.supported ? "candidate" : "ats_detected";
}

function eventTypeForStatus(
  status: DynamicEmployerStatus,
): DynamicEmployerEventType {
  switch (status) {
    case "ats_detected":
    case "candidate":
    case "active":
    case "retired":
    case "source_changed":
      return status;
    default:
      return "observed";
  }
}

export async function observeDynamicEmployerFromJob(
  job: EmployerObservationJob,
): Promise<DynamicEmployer | null> {
  const normalizedName = normalizeCompanyName(job.employer);
  if (!normalizedName) return null;

  const detection = detectEmployerAts(job);
  const existing = await getEmployerByNormalizedName(normalizedName);
  const now = new Date().toISOString();
  const tenantId = getActiveTenantId();
  const userId = requireUserId();

  if (!existing) {
    const status = statusFromDetection(detection);
    const id = randomUUID();
    await db.insert(dynamicEmployers).values({
      id,
      tenantId,
      userId,
      normalizedName,
      displayName: job.employer.trim(),
      status,
      sourceType: detection?.sourceType ?? null,
      careersUrl: detection?.careersUrl ?? null,
      firstSeenSource: job.source,
      firstSeenJobUrl: job.jobUrl,
      lastSeenSource: job.source,
      lastSeenJobUrl: job.jobUrl,
      observationCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      activatedAt: null,
      retiredAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await recordEvent({
      employerId: id,
      eventType: eventTypeForStatus(status),
      fromStatus: null,
      toStatus: status,
      discoverySource: job.source,
      jobUrl: job.jobUrl,
      sourceType: detection?.sourceType ?? null,
      careersUrl: detection?.careersUrl ?? null,
      note: detection
        ? "ATS identified from discovered vacancy provenance."
        : "Employer discovered without an authoritative ATS URL yet.",
    });
    return getEmployerByNormalizedName(normalizedName);
  }

  let nextStatus = existing.status;
  let eventType: DynamicEmployerEventType | null = null;
  let note: string | null = null;
  const sourceChanged = Boolean(
    detection &&
      existing.careersUrl &&
      (existing.careersUrl !== detection.careersUrl ||
        existing.sourceType !== detection.sourceType),
  );

  if (sourceChanged) {
    nextStatus = "source_changed";
    eventType = "source_changed";
    note = "Observed ATS source differs from the previously tracked source.";
  } else if (
    existing.status !== "active" &&
    existing.status !== "retired" &&
    detection
  ) {
    const detectedStatus = statusFromDetection(detection);
    if (detectedStatus !== existing.status) {
      nextStatus = detectedStatus;
      eventType = eventTypeForStatus(detectedStatus);
      note = detection.supported
        ? "Supported ATS identified; employer is ready for strategic candidate evaluation."
        : "ATS identified but no direct watchlist adapter is available yet.";
    }
  }

  await db
    .update(dynamicEmployers)
    .set({
      displayName: job.employer.trim() || existing.displayName,
      status: nextStatus,
      sourceType: detection?.sourceType ?? existing.sourceType,
      careersUrl: detection?.careersUrl ?? existing.careersUrl,
      lastSeenSource: job.source,
      lastSeenJobUrl: job.jobUrl,
      observationCount: existing.observationCount + 1,
      lastSeenAt: now,
      updatedAt: now,
    })
    .where(eq(dynamicEmployers.id, existing.id));

  if (eventType) {
    await recordEvent({
      employerId: existing.id,
      eventType,
      fromStatus: existing.status,
      toStatus: nextStatus,
      discoverySource: job.source,
      jobUrl: job.jobUrl,
      sourceType: detection?.sourceType ?? existing.sourceType,
      careersUrl: detection?.careersUrl ?? existing.careersUrl,
      note,
    });
  }

  return getEmployerByNormalizedName(normalizedName);
}

export async function observeDynamicEmployersFromJobs(
  jobs: EmployerObservationJob[],
): Promise<void> {
  for (const job of jobs) {
    await observeDynamicEmployerFromJob(job);
  }
}

export async function activateDynamicEmployerFromJob(
  job: EmployerObservationJob,
): Promise<DynamicEmployer | null> {
  const observed = await observeDynamicEmployerFromJob(job);
  if (!observed) return null;
  if (observed.status === "active" || observed.status === "retired") {
    return observed;
  }
  if (observed.status === "source_changed") {
    return observed;
  }
  if (!observed.sourceType || !observed.careersUrl) return observed;
  if (!getWatchlistSourceAdapter(observed.sourceType)) return observed;

  await ensureWatchlistSelectedSource({
    sourceType: observed.sourceType,
    label: observed.displayName,
    careersUrl: observed.careersUrl,
  });

  const now = new Date().toISOString();
  await db
    .update(dynamicEmployers)
    .set({
      status: "active",
      activatedAt: observed.activatedAt ?? now,
      retiredAt: null,
      updatedAt: now,
    })
    .where(eq(dynamicEmployers.id, observed.id));
  await recordEvent({
    employerId: observed.id,
    eventType: "active",
    fromStatus: observed.status,
    toStatus: "active",
    discoverySource: job.source,
    jobUrl: job.jobUrl,
    sourceType: observed.sourceType,
    careersUrl: observed.careersUrl,
    note: "Strategically selected vacancy promoted employer into active direct ATS monitoring.",
  });
  return getEmployerByNormalizedName(observed.normalizedName);
}

export async function activateDynamicEmployersFromJobs(
  jobs: EmployerObservationJob[],
): Promise<void> {
  for (const job of jobs) {
    await activateDynamicEmployerFromJob(job);
  }
}

export async function syncWatchlistSeedsToDynamicEmployers(): Promise<void> {
  const selected = await listWatchlistSelectedSources();
  const tenantId = getActiveTenantId();
  const userId = requireUserId();
  const now = new Date().toISOString();

  for (const source of selected) {
    const normalizedName = normalizeCompanyName(source.label);
    if (!normalizedName) continue;
    const existing = await getEmployerByNormalizedName(normalizedName);
    if (existing) {
      if (
        existing.status !== "active" ||
        existing.sourceType !== source.sourceType ||
        existing.careersUrl !== source.careersUrl
      ) {
        await db
          .update(dynamicEmployers)
          .set({
            displayName: source.label,
            status: "active",
            sourceType: source.sourceType,
            careersUrl: source.careersUrl,
            activatedAt: existing.activatedAt ?? now,
            retiredAt: null,
            updatedAt: now,
          })
          .where(eq(dynamicEmployers.id, existing.id));
        await recordEvent({
          employerId: existing.id,
          eventType: "active",
          fromStatus: existing.status,
          toStatus: "active",
          sourceType: source.sourceType,
          careersUrl: source.careersUrl,
          note: "Existing Watchlist source synchronized into active dynamic monitoring.",
        });
      }
      continue;
    }

    const id = randomUUID();
    await db.insert(dynamicEmployers).values({
      id,
      tenantId,
      userId,
      normalizedName,
      displayName: source.label,
      status: "active",
      sourceType: source.sourceType,
      careersUrl: source.careersUrl,
      firstSeenSource: null,
      firstSeenJobUrl: null,
      lastSeenSource: null,
      lastSeenJobUrl: null,
      observationCount: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      activatedAt: now,
      retiredAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await recordEvent({
      employerId: id,
      eventType: "active",
      fromStatus: null,
      toStatus: "active",
      sourceType: source.sourceType,
      careersUrl: source.careersUrl,
      note: "Existing Watchlist source seeded into the dynamic employer registry.",
    });
  }
}

export async function listDynamicEmployers(): Promise<DynamicEmployer[]> {
  const rows = await db
    .select()
    .from(dynamicEmployers)
    .where(
      and(
        eq(dynamicEmployers.tenantId, getActiveTenantId()),
        eq(dynamicEmployers.userId, requireUserId()),
      ),
    )
    .orderBy(asc(dynamicEmployers.displayName));
  return rows.map(mapEmployer);
}

export async function listDynamicEmployerEvents(
  employerId: string,
): Promise<DynamicEmployerEvent[]> {
  const rows = await db
    .select()
    .from(dynamicEmployerEvents)
    .where(
      and(
        eq(dynamicEmployerEvents.tenantId, getActiveTenantId()),
        eq(dynamicEmployerEvents.userId, requireUserId()),
        eq(dynamicEmployerEvents.employerId, employerId),
      ),
    )
    .orderBy(asc(dynamicEmployerEvents.createdAt));
  return rows.map(mapEvent);
}

export async function retireDynamicEmployer(
  employerId: string,
  note = "Employer retired from dynamic monitoring.",
): Promise<DynamicEmployer | null> {
  const rows = await db
    .select()
    .from(dynamicEmployers)
    .where(
      and(
        eq(dynamicEmployers.tenantId, getActiveTenantId()),
        eq(dynamicEmployers.userId, requireUserId()),
        eq(dynamicEmployers.id, employerId),
      ),
    );
  const existing = rows[0] ? mapEmployer(rows[0]) : null;
  if (!existing) return null;
  if (existing.status === "retired") return existing;

  const now = new Date().toISOString();
  if (existing.careersUrl) {
    await removeWatchlistSelectedSourceByCareersUrl(existing.careersUrl);
  }
  await db
    .update(dynamicEmployers)
    .set({ status: "retired", retiredAt: now, updatedAt: now })
    .where(eq(dynamicEmployers.id, employerId));
  await recordEvent({
    employerId,
    eventType: "retired",
    fromStatus: existing.status,
    toStatus: "retired",
    sourceType: existing.sourceType,
    careersUrl: existing.careersUrl,
    note,
  });
  return getEmployerByNormalizedName(existing.normalizedName);
}
