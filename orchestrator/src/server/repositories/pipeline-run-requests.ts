import { randomUUID } from "node:crypto";
import type { PipelineConfig } from "@shared/types";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { db, schema } from "../db";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { pipelineRunRequests } = schema;

export type PipelineRunRequestStatus =
  | "queued"
  | "claimed"
  | "completed"
  | "failed"
  | "cancelled";

export interface PipelineRunRequest {
  id: string;
  status: PipelineRunRequestStatus;
  trigger: string;
  requestedConfig: Partial<PipelineConfig>;
  priority: number;
  availableAt: string;
  claimedAt: string | null;
  pipelineRunId: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

function scopeFilter() {
  return privateDataScopeFilter(pipelineRunRequests);
}

function mapRow(
  row: typeof pipelineRunRequests.$inferSelect,
): PipelineRunRequest {
  return {
    id: row.id,
    status: row.status as PipelineRunRequestStatus,
    trigger: row.trigger,
    requestedConfig: (row.requestedConfig as Partial<PipelineConfig>) ?? {},
    priority: row.priority,
    availableAt: row.availableAt,
    claimedAt: row.claimedAt,
    pipelineRunId: row.pipelineRunId,
    completedAt: row.completedAt,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY/i.test(
      error.message,
    )
  );
}

/**
 * Coalescing enqueue: each candidate may have at most one queued/claimed run.
 * A scheduler tick arriving while one is outstanding reuses that request instead
 * of building an unbounded backlog of identical daily work.
 */
export async function enqueuePipelineRunRequest(input: {
  trigger: string;
  requestedConfig: Partial<PipelineConfig>;
  priority?: number;
  availableAt?: string;
}): Promise<{ request: PipelineRunRequest; created: boolean }> {
  const [existing] = await db
    .select()
    .from(pipelineRunRequests)
    .where(scopeFilter())
    .orderBy(desc(pipelineRunRequests.createdAt))
    .limit(1);
  if (
    existing &&
    (existing.status === "queued" || existing.status === "claimed")
  ) {
    return { request: mapRow(existing), created: false };
  }

  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  const id = randomUUID();
  try {
    await db.insert(pipelineRunRequests).values({
      id,
      tenantId: scope.tenantId,
      userId: scope.userId,
      status: "queued",
      trigger: input.trigger.trim() || "manual",
      requestedConfig: input.requestedConfig,
      priority: input.priority ?? 0,
      availableAt: input.availableAt ?? now,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const [winner] = await db
      .select()
      .from(pipelineRunRequests)
      .where(scopeFilter())
      .orderBy(desc(pipelineRunRequests.createdAt))
      .limit(1);
    if (!winner) throw error;
    return { request: mapRow(winner), created: false };
  }

  const [created] = await db
    .select()
    .from(pipelineRunRequests)
    .where(and(scopeFilter(), eq(pipelineRunRequests.id, id)))
    .limit(1);
  if (!created) throw new Error("Failed to load queued pipeline request.");
  return { request: mapRow(created), created: true };
}

export interface PipelineRunRequestOwner {
  tenantId: string;
  userId: string | null;
}

/**
 * System-internal fairness view: list candidate owners with ready queued work,
 * at most once per owner, ordered by priority and age. The returned owner IDs
 * are used only to establish explicit request context before touching private
 * candidate data.
 */
export async function listReadyPipelineRunRequestOwners(
  limit = 5,
): Promise<PipelineRunRequestOwner[]> {
  const now = new Date().toISOString();
  const rows = await db
    .select({
      tenantId: pipelineRunRequests.tenantId,
      userId: pipelineRunRequests.userId,
    })
    .from(pipelineRunRequests)
    .where(
      and(
        eq(pipelineRunRequests.status, "queued"),
        lte(pipelineRunRequests.availableAt, now),
      ),
    )
    .orderBy(
      desc(pipelineRunRequests.priority),
      asc(pipelineRunRequests.availableAt),
      asc(pipelineRunRequests.createdAt),
    );

  const seen = new Set<string>();
  const owners: PipelineRunRequestOwner[] = [];
  for (const row of rows) {
    const key = `${row.tenantId}\u001f${row.userId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    owners.push({ tenantId: row.tenantId, userId: row.userId });
    if (owners.length >= Math.max(1, limit)) break;
  }
  return owners;
}

export async function getOutstandingPipelineRunRequest(): Promise<PipelineRunRequest | null> {
  const rows = await db
    .select()
    .from(pipelineRunRequests)
    .where(scopeFilter())
    .orderBy(desc(pipelineRunRequests.createdAt));
  const row = rows.find(
    (candidate) =>
      candidate.status === "queued" || candidate.status === "claimed",
  );
  return row ? mapRow(row) : null;
}

/** Claim the candidate's ready queued request. */
export async function claimPipelineRunRequest(
  requestId: string,
): Promise<PipelineRunRequest | null> {
  const now = new Date().toISOString();
  const [claimed] = await db
    .update(pipelineRunRequests)
    .set({ status: "claimed", claimedAt: now, updatedAt: now })
    .where(
      and(
        scopeFilter(),
        eq(pipelineRunRequests.id, requestId),
        eq(pipelineRunRequests.status, "queued"),
        lte(pipelineRunRequests.availableAt, now),
      ),
    )
    .returning();
  return claimed ? mapRow(claimed) : null;
}

export async function finishPipelineRunRequest(input: {
  requestId: string;
  pipelineRunId?: string | null;
  status: "completed" | "failed" | "cancelled";
  errorMessage?: string | null;
}): Promise<PipelineRunRequest | null> {
  const now = new Date().toISOString();
  await db
    .update(pipelineRunRequests)
    .set({
      status: input.status,
      pipelineRunId: input.pipelineRunId ?? null,
      completedAt: now,
      errorMessage: input.errorMessage ?? null,
      updatedAt: now,
    })
    .where(and(scopeFilter(), eq(pipelineRunRequests.id, input.requestId)));

  const [row] = await db
    .select()
    .from(pipelineRunRequests)
    .where(and(scopeFilter(), eq(pipelineRunRequests.id, input.requestId)))
    .limit(1);
  return row ? mapRow(row) : null;
}
