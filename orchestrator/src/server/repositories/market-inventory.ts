import { randomUUID } from "node:crypto";
import {
  buildMarketObservationKey,
  buildMarketPostingContentFingerprint,
  buildMarketPostingIdentityCandidates,
} from "@server/market-inventory/identity";
import type {
  MarketObservationAuthority,
  MarketPosting,
  MarketPostingInput,
  MarketPostingObservation,
  MarketPostingStatus,
} from "@shared/types";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const {
  candidateMarketPostings,
  marketPostingIdentities,
  marketPostingObservations,
  marketPostings,
  marketPostingVersions,
} = schema;

const AUTHORITY_RANK: Record<MarketObservationAuthority, number> = {
  unknown: 0,
  aggregator: 1,
  board: 2,
  manual: 3,
  official: 4,
};

export class MarketIdentityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketIdentityConflictError";
  }
}

function mapPosting(row: typeof marketPostings.$inferSelect): MarketPosting {
  return {
    id: row.id,
    identityKey: row.identityKey,
    canonicalUrl: row.canonicalUrl,
    officialRequisitionId: row.officialRequisitionId,
    employer: row.employer,
    title: row.title,
    location: row.location,
    description: row.description,
    datePosted: row.datePosted,
    deadline: row.deadline,
    salaryText: row.salaryText,
    salaryCurrency: row.salaryCurrency,
    contentFingerprint: row.contentFingerprint,
    canonicalAuthority: row.canonicalAuthority as MarketObservationAuthority,
    status: row.status as MarketPostingStatus,
    firstObservedAt: row.firstObservedAt,
    lastObservedAt: row.lastObservedAt,
    lastLiveCheckedAt: row.lastLiveCheckedAt,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizedAuthority(
  value: MarketObservationAuthority | undefined,
): MarketObservationAuthority {
  return value ?? "unknown";
}

async function findPostingIdByInput(
  input: MarketPostingInput,
  observationKey: string,
): Promise<string | null> {
  const [existingObservation] = await db
    .select({ marketPostingId: marketPostingObservations.marketPostingId })
    .from(marketPostingObservations)
    .where(eq(marketPostingObservations.observationKey, observationKey))
    .limit(1);

  const identityCandidates = buildMarketPostingIdentityCandidates(input);
  const identityRows = await db
    .select({ marketPostingId: marketPostingIdentities.marketPostingId })
    .from(marketPostingIdentities)
    .where(
      inArray(
        marketPostingIdentities.identityKey,
        identityCandidates.map((candidate) => candidate.key),
      ),
    );

  const postingIds = new Set(identityRows.map((row) => row.marketPostingId));
  if (existingObservation) postingIds.add(existingObservation.marketPostingId);

  if (postingIds.size > 1) {
    throw new MarketIdentityConflictError(
      `Incoming market observation matches multiple canonical postings: ${[
        ...postingIds,
      ].join(", ")}.`,
    );
  }
  return postingIds.values().next().value ?? null;
}

function createPostingVersion(args: {
  marketPostingId: string;
  input: MarketPostingInput;
  contentFingerprint: string;
  now: string;
}): void {
  const existing = db
    .select({ id: marketPostingVersions.id })
    .from(marketPostingVersions)
    .where(
      and(
        eq(marketPostingVersions.marketPostingId, args.marketPostingId),
        eq(marketPostingVersions.contentFingerprint, args.contentFingerprint),
      ),
    )
    .get();
  if (existing) return;

  const [versionRow] = db
    .select({
      maxVersion: sql<number>`coalesce(max(${marketPostingVersions.version}), 0)`,
    })
    .from(marketPostingVersions)
    .where(eq(marketPostingVersions.marketPostingId, args.marketPostingId))
    .all();

  db.insert(marketPostingVersions)
    .values({
      id: randomUUID(),
      marketPostingId: args.marketPostingId,
      version: Number(versionRow?.maxVersion ?? 0) + 1,
      contentFingerprint: args.contentFingerprint,
      snapshot: args.input,
      createdAt: args.now,
    })
    .run();
}

function ensurePostingIdentities(args: {
  marketPostingId: string;
  input: MarketPostingInput;
  now: string;
}): void {
  for (const candidate of buildMarketPostingIdentityCandidates(args.input)) {
    const existing = db
      .select({ marketPostingId: marketPostingIdentities.marketPostingId })
      .from(marketPostingIdentities)
      .where(eq(marketPostingIdentities.identityKey, candidate.key))
      .get();
    if (existing) {
      if (existing.marketPostingId !== args.marketPostingId) {
        throw new MarketIdentityConflictError(
          `Identity '${candidate.kind}' is already assigned to another posting.`,
        );
      }
      continue;
    }
    db.insert(marketPostingIdentities)
      .values({
        id: randomUUID(),
        marketPostingId: args.marketPostingId,
        kind: candidate.kind,
        identityKey: candidate.key,
        createdAt: args.now,
      })
      .run();
  }
}

export async function recordMarketPostingObservation(
  input: MarketPostingInput,
): Promise<{ posting: MarketPosting; canonicalContentChanged: boolean }> {
  const now = new Date().toISOString();
  const authority = normalizedAuthority(input.authority);
  const observationKey = buildMarketObservationKey(input);
  const contentFingerprint = buildMarketPostingContentFingerprint(input);
  const identityCandidates = buildMarketPostingIdentityCandidates(input);
  const postingId = await findPostingIdByInput(input, observationKey);
  let canonicalContentChanged = false;
  let resolvedPostingId = postingId;

  db.transaction((tx) => {
    if (!resolvedPostingId) {
      resolvedPostingId = randomUUID();
      tx.insert(marketPostings)
        .values({
          id: resolvedPostingId,
          identityKey: identityCandidates[0].key,
          canonicalUrl: input.canonicalUrl?.trim() || null,
          officialRequisitionId: input.officialRequisitionId?.trim() || null,
          employer: input.employer.trim(),
          title: input.title.trim(),
          location: input.location?.trim() || null,
          description: input.description?.trim() || null,
          datePosted: input.datePosted?.trim() || null,
          deadline: input.deadline?.trim() || null,
          salaryText: input.salaryText?.trim() || null,
          salaryCurrency: input.salaryCurrency?.trim() || null,
          contentFingerprint,
          canonicalAuthority: authority,
          status: input.isLive === true ? "live" : "unknown",
          firstObservedAt: now,
          lastObservedAt: now,
          lastLiveCheckedAt: input.isLive === true ? now : null,
          closedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      canonicalContentChanged = true;
    } else {
      const current = tx
        .select()
        .from(marketPostings)
        .where(eq(marketPostings.id, resolvedPostingId))
        .get();
      if (!current) {
        throw new Error(`Market posting ${resolvedPostingId} disappeared.`);
      }

      const incomingCanReplaceCanonical =
        AUTHORITY_RANK[authority] >=
        AUTHORITY_RANK[
          current.canonicalAuthority as MarketObservationAuthority
        ];
      canonicalContentChanged =
        incomingCanReplaceCanonical &&
        contentFingerprint !== current.contentFingerprint;

      tx.update(marketPostings)
        .set({
          ...(canonicalContentChanged
            ? {
                canonicalUrl:
                  input.canonicalUrl?.trim() || current.canonicalUrl,
                officialRequisitionId:
                  input.officialRequisitionId?.trim() ||
                  current.officialRequisitionId,
                employer: input.employer.trim(),
                title: input.title.trim(),
                location: input.location?.trim() || null,
                description: input.description?.trim() || null,
                datePosted: input.datePosted?.trim() || null,
                deadline: input.deadline?.trim() || null,
                salaryText: input.salaryText?.trim() || null,
                salaryCurrency: input.salaryCurrency?.trim() || null,
                contentFingerprint,
                canonicalAuthority: authority,
              }
            : {
                canonicalUrl:
                  current.canonicalUrl ?? input.canonicalUrl?.trim() ?? null,
                officialRequisitionId:
                  current.officialRequisitionId ??
                  input.officialRequisitionId?.trim() ??
                  null,
              }),
          ...(input.isLive === true
            ? {
                status: "live" as const,
                lastLiveCheckedAt: now,
                closedAt: null,
              }
            : {}),
          lastObservedAt: now,
          updatedAt: now,
        })
        .where(eq(marketPostings.id, resolvedPostingId))
        .run();
    }

    ensurePostingIdentities({
      marketPostingId: resolvedPostingId,
      input,
      now,
    });
    if (canonicalContentChanged) {
      createPostingVersion({
        marketPostingId: resolvedPostingId,
        input,
        contentFingerprint,
        now,
      });
    }

    const observation = tx
      .select({ id: marketPostingObservations.id })
      .from(marketPostingObservations)
      .where(eq(marketPostingObservations.observationKey, observationKey))
      .get();
    if (observation) {
      tx.update(marketPostingObservations)
        .set({
          marketPostingId: resolvedPostingId,
          source: input.source.trim(),
          authority,
          sourceJobId: input.sourceJobId?.trim() || null,
          sourceUrl: input.sourceUrl.trim(),
          observedAt: now,
          sourceUpdatedAt: input.sourceUpdatedAt?.trim() || null,
          isLive: input.isLive ?? null,
          payloadFingerprint: contentFingerprint,
          updatedAt: now,
        })
        .where(eq(marketPostingObservations.id, observation.id))
        .run();
    } else {
      tx.insert(marketPostingObservations)
        .values({
          id: randomUUID(),
          marketPostingId: resolvedPostingId,
          source: input.source.trim(),
          authority,
          sourceJobId: input.sourceJobId?.trim() || null,
          sourceUrl: input.sourceUrl.trim(),
          observationKey,
          observedAt: now,
          sourceUpdatedAt: input.sourceUpdatedAt?.trim() || null,
          isLive: input.isLive ?? null,
          payloadFingerprint: contentFingerprint,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });

  if (!resolvedPostingId)
    throw new Error("Failed to resolve market posting id.");
  const [row] = await db
    .select()
    .from(marketPostings)
    .where(eq(marketPostings.id, resolvedPostingId))
    .limit(1);
  if (!row) throw new Error("Failed to load recorded market posting.");
  return { posting: mapPosting(row), canonicalContentChanged };
}

export async function attachMarketPostingToCandidate(args: {
  marketPostingId: string;
  legacyJobId?: string | null;
}): Promise<string> {
  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(candidateMarketPostings)
    .where(
      and(
        privateDataScopeFilter(candidateMarketPostings),
        eq(candidateMarketPostings.marketPostingId, args.marketPostingId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(candidateMarketPostings)
      .set({
        legacyJobId: args.legacyJobId ?? existing.legacyJobId,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(candidateMarketPostings.id, existing.id));
    return existing.id;
  }

  const id = randomUUID();
  await db.insert(candidateMarketPostings).values({
    id,
    tenantId: scope.tenantId,
    userId: scope.userId,
    marketPostingId: args.marketPostingId,
    legacyJobId: args.legacyJobId ?? null,
    firstSeenAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

function mapObservation(
  row: typeof marketPostingObservations.$inferSelect,
): MarketPostingObservation {
  return {
    id: row.id,
    marketPostingId: row.marketPostingId,
    source: row.source,
    authority: row.authority as MarketObservationAuthority,
    sourceJobId: row.sourceJobId,
    sourceUrl: row.sourceUrl,
    observationKey: row.observationKey,
    observedAt: row.observedAt,
    sourceUpdatedAt: row.sourceUpdatedAt,
    isLive: row.isLive,
    payloadFingerprint: row.payloadFingerprint,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getCandidateMarketPostingLiveContext(
  marketPostingId: string,
): Promise<{
  posting: MarketPosting;
  observations: MarketPostingObservation[];
} | null> {
  const [candidatePosting] = await db
    .select({ id: candidateMarketPostings.id })
    .from(candidateMarketPostings)
    .where(
      and(
        privateDataScopeFilter(candidateMarketPostings),
        eq(candidateMarketPostings.marketPostingId, marketPostingId),
      ),
    )
    .limit(1);

  if (!candidatePosting) return null;

  const [postingRow] = await db
    .select()
    .from(marketPostings)
    .where(eq(marketPostings.id, marketPostingId))
    .limit(1);
  if (!postingRow) return null;

  const observations = await db
    .select()
    .from(marketPostingObservations)
    .where(eq(marketPostingObservations.marketPostingId, marketPostingId));

  return {
    posting: mapPosting(postingRow),
    observations: observations.map(mapObservation),
  };
}

export async function getLatestMarketPostingVersionId(
  marketPostingId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: marketPostingVersions.id })
    .from(marketPostingVersions)
    .where(eq(marketPostingVersions.marketPostingId, marketPostingId))
    .orderBy(desc(marketPostingVersions.version))
    .limit(1);

  return row?.id ?? null;
}
