import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { getActiveTenantId } from "../tenancy/context";

const { pipelineSourceRuns, pipelineIssues, pipelineIssueOccurrences } = schema;
export type SourceRunStatus = typeof pipelineSourceRuns.$inferInsert.status;

export async function getSourceRun(
  pipelineRunId: string,
  source: string,
  scopeKey = "default",
) {
  const [row] = await db
    .select()
    .from(pipelineSourceRuns)
    .where(
      and(
        eq(pipelineSourceRuns.tenantId, getActiveTenantId()),
        eq(pipelineSourceRuns.pipelineRunId, pipelineRunId),
        eq(pipelineSourceRuns.source, source),
        eq(pipelineSourceRuns.scopeKey, scopeKey),
      ),
    );
  return row ?? null;
}

export async function createSourceRun(input: {
  pipelineRunId: string;
  source: string;
  scopeKey?: string;
  coverageExpected?: number | null;
}) {
  const existing = await getSourceRun(
    input.pipelineRunId,
    input.source,
    input.scopeKey,
  );
  if (existing) return existing;
  const now = new Date().toISOString();
  const id = randomUUID();
  await db.insert(pipelineSourceRuns).values({
    id,
    tenantId: getActiveTenantId(),
    pipelineRunId: input.pipelineRunId,
    source: input.source,
    scopeKey: input.scopeKey ?? "default",
    status: "pending",
    coverageExpected: input.coverageExpected ?? null,
    coverageCompleted: 0,
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return getSourceRun(input.pipelineRunId, input.source, input.scopeKey);
}

export async function updateSourceRun(
  id: string,
  patch: {
    status?: SourceRunStatus;
    checkpoint?: unknown;
    coverageCompleted?: number;
    errorMessage?: string | null;
    fallbackSource?: string | null;
    incrementAttempt?: boolean;
  },
) {
  const tenantId = getActiveTenantId();
  const [current] = await db
    .select()
    .from(pipelineSourceRuns)
    .where(
      and(
        eq(pipelineSourceRuns.tenantId, tenantId),
        eq(pipelineSourceRuns.id, id),
      ),
    );
  if (!current) throw new Error(`Pipeline source run not found: ${id}`);
  const now = new Date().toISOString();
  const terminal =
    patch.status &&
    ["complete", "complete_with_fallback", "degraded", "failed"].includes(
      patch.status,
    );
  await db
    .update(pipelineSourceRuns)
    .set({
      status: patch.status ?? current.status,
      checkpoint:
        patch.checkpoint === undefined ? current.checkpoint : patch.checkpoint,
      coverageCompleted: patch.coverageCompleted ?? current.coverageCompleted,
      errorMessage:
        patch.errorMessage === undefined
          ? current.errorMessage
          : patch.errorMessage,
      fallbackSource:
        patch.fallbackSource === undefined
          ? current.fallbackSource
          : patch.fallbackSource,
      attemptCount: current.attemptCount + (patch.incrementAttempt ? 1 : 0),
      startedAt: current.startedAt ?? (patch.status === "running" ? now : null),
      completedAt: terminal ? now : current.completedAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(pipelineSourceRuns.tenantId, tenantId),
        eq(pipelineSourceRuns.id, id),
      ),
    );
  const [row] = await db
    .select()
    .from(pipelineSourceRuns)
    .where(eq(pipelineSourceRuns.id, id));
  return row;
}

export async function recordPipelineIssue(input: {
  issueSignature: string;
  source: string;
  issueType: string;
  pipelineRunId?: string | null;
  sourceRunId?: string | null;
  stage?: string | null;
  errorMessage?: string | null;
  attemptCount?: number;
  fallbackUsed?: string | null;
  recovered?: boolean;
  recoveryTimeMs?: number | null;
  coverageImpact?: number | null;
  metadata?: unknown;
}) {
  const tenantId = getActiveTenantId();
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(pipelineIssues)
    .where(
      and(
        eq(pipelineIssues.tenantId, tenantId),
        eq(pipelineIssues.issueSignature, input.issueSignature),
      ),
    );
  const issueId = existing?.id ?? randomUUID();
  if (existing) {
    await db
      .update(pipelineIssues)
      .set({
        source: input.source,
        issueType: input.issueType,
        status: "recurring",
        lastSeenAt: now,
        occurrenceCount: existing.occurrenceCount + 1,
        lastError: input.errorMessage ?? existing.lastError,
        resolvedAt: null,
        updatedAt: now,
      })
      .where(eq(pipelineIssues.id, issueId));
  } else {
    await db.insert(pipelineIssues).values({
      id: issueId,
      tenantId,
      issueSignature: input.issueSignature,
      source: input.source,
      issueType: input.issueType,
      status: "new",
      firstSeenAt: now,
      lastSeenAt: now,
      occurrenceCount: 1,
      lastError: input.errorMessage ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }
  await db.insert(pipelineIssueOccurrences).values({
    id: randomUUID(),
    tenantId,
    issueId,
    pipelineRunId: input.pipelineRunId ?? null,
    sourceRunId: input.sourceRunId ?? null,
    occurredAt: now,
    stage: input.stage ?? null,
    errorMessage: input.errorMessage ?? null,
    attemptCount: input.attemptCount ?? 1,
    fallbackUsed: input.fallbackUsed ?? null,
    recovered: input.recovered ?? false,
    recoveryTimeMs: input.recoveryTimeMs ?? null,
    coverageImpact: input.coverageImpact ?? null,
    metadata: input.metadata ?? null,
    createdAt: now,
  });
  const [issue] = await db
    .select()
    .from(pipelineIssues)
    .where(eq(pipelineIssues.id, issueId));
  return issue;
}

export async function resolvePipelineIssue(
  issueSignature: string,
  resolution: string,
) {
  const tenantId = getActiveTenantId();
  const now = new Date().toISOString();
  await db
    .update(pipelineIssues)
    .set({ status: "resolved", resolution, resolvedAt: now, updatedAt: now })
    .where(
      and(
        eq(pipelineIssues.tenantId, tenantId),
        eq(pipelineIssues.issueSignature, issueSignature),
      ),
    );
}
