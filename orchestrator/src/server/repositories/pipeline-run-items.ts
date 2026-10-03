import { randomUUID } from "node:crypto";
import type {
  PipelineRunItem,
  PipelineRunItemStage,
  PipelineRunItemStatus,
} from "@shared/types";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db/index";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { pipelineRunItems } = schema;

function scopeFilter() {
  return privateDataScopeFilter(pipelineRunItems);
}

function mapRow(row: typeof pipelineRunItems.$inferSelect): PipelineRunItem {
  return {
    id: row.id,
    pipelineRunId: row.pipelineRunId,
    jobId: row.jobId,
    sourceRunId: row.sourceRunId,
    stage: row.stage as PipelineRunItemStage,
    status: row.status as PipelineRunItemStatus,
    attemptCount: row.attemptCount,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Idempotently attach jobs to a single pipeline run. Existing membership rows
 * are preserved so retries never reset progress that has already been saved.
 */
export async function ensurePipelineRunItems(args: {
  pipelineRunId: string;
  jobIds: string[];
  sourceRunId?: string | null;
}): Promise<number> {
  const scope = getPrivateDataScope();
  const uniqueJobIds = [...new Set(args.jobIds)].filter(Boolean);
  if (uniqueJobIds.length === 0) return 0;

  const existing = await db
    .select({ jobId: pipelineRunItems.jobId })
    .from(pipelineRunItems)
    .where(
      and(
        scopeFilter(),
        eq(pipelineRunItems.pipelineRunId, args.pipelineRunId),
        inArray(pipelineRunItems.jobId, uniqueJobIds),
      ),
    );
  const existingIds = new Set(existing.map((row) => row.jobId));
  const missing = uniqueJobIds.filter((jobId) => !existingIds.has(jobId));
  if (missing.length === 0) return 0;

  const now = new Date().toISOString();
  await db.insert(pipelineRunItems).values(
    missing.map((jobId) => ({
      id: randomUUID(),
      tenantId: scope.tenantId,
      userId: scope.userId,
      pipelineRunId: args.pipelineRunId,
      jobId,
      sourceRunId: args.sourceRunId ?? null,
      stage: "discovered" as const,
      status: "pending" as const,
      createdAt: now,
      updatedAt: now,
    })),
  );
  return missing.length;
}

export async function listPipelineRunItems(args: {
  pipelineRunId: string;
  stages?: PipelineRunItemStage[];
  statuses?: PipelineRunItemStatus[];
}): Promise<PipelineRunItem[]> {
  const predicates = [
    scopeFilter(),
    eq(pipelineRunItems.pipelineRunId, args.pipelineRunId),
  ];
  if (args.stages?.length) {
    predicates.push(inArray(pipelineRunItems.stage, args.stages));
  }
  if (args.statuses?.length) {
    predicates.push(inArray(pipelineRunItems.status, args.statuses));
  }
  const rows = await db
    .select()
    .from(pipelineRunItems)
    .where(and(...predicates));
  return rows.map(mapRow);
}

export async function updatePipelineRunItem(
  id: string,
  patch: Partial<{
    sourceRunId: string | null;
    stage: PipelineRunItemStage;
    status: PipelineRunItemStatus;
    incrementAttempt: boolean;
    errorMessage: string | null;
  }>,
): Promise<PipelineRunItem | null> {
  const [current] = await db
    .select()
    .from(pipelineRunItems)
    .where(and(scopeFilter(), eq(pipelineRunItems.id, id)))
    .limit(1);
  if (!current) return null;

  const now = new Date().toISOString();
  await db
    .update(pipelineRunItems)
    .set({
      ...(patch.sourceRunId !== undefined
        ? { sourceRunId: patch.sourceRunId }
        : {}),
      ...(patch.stage !== undefined ? { stage: patch.stage } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.errorMessage !== undefined
        ? { errorMessage: patch.errorMessage }
        : {}),
      ...(patch.incrementAttempt
        ? { attemptCount: current.attemptCount + 1 }
        : {}),
      updatedAt: now,
    })
    .where(and(scopeFilter(), eq(pipelineRunItems.id, id)));

  const [updated] = await db
    .select()
    .from(pipelineRunItems)
    .where(and(scopeFilter(), eq(pipelineRunItems.id, id)))
    .limit(1);
  return updated ? mapRow(updated) : null;
}
