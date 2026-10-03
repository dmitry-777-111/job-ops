import { randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "../db";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { pipelineRunLeases, pipelineRuns } = schema;
const DEFAULT_LEASE_TTL_MS = 2 * 60 * 1000;

function scopeFilter() {
  return privateDataScopeFilter(pipelineRunLeases);
}

function expiryFrom(now: Date, ttlMs: number): string {
  return new Date(now.getTime() + ttlMs).toISOString();
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY/i.test(
      error.message,
    )
  );
}

export interface PipelineRunLease {
  id: string;
  pipelineRunId: string;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
}

function mapLease(
  row: typeof pipelineRunLeases.$inferSelect,
): PipelineRunLease {
  return {
    id: row.id,
    pipelineRunId: row.pipelineRunId,
    acquiredAt: row.acquiredAt,
    heartbeatAt: row.heartbeatAt,
    expiresAt: row.expiresAt,
  };
}

export async function acquirePipelineRunLease(args: {
  pipelineRunId: string;
  ttlMs?: number;
}): Promise<{ acquired: boolean; lease: PipelineRunLease | null }> {
  const scope = getPrivateDataScope();
  const now = new Date();
  const nowIso = now.toISOString();
  const ttlMs = Math.max(30_000, args.ttlMs ?? DEFAULT_LEASE_TTL_MS);

  const [run] = await db
    .select({ id: pipelineRuns.id })
    .from(pipelineRuns)
    .where(
      and(
        privateDataScopeFilter(pipelineRuns),
        eq(pipelineRuns.id, args.pipelineRunId),
      ),
    )
    .limit(1);
  if (!run)
    throw new Error("Pipeline run not found in active candidate scope.");

  // Delete only an expired lease for this owner. A live lease is the lock.
  await db
    .delete(pipelineRunLeases)
    .where(and(scopeFilter(), lt(pipelineRunLeases.expiresAt, nowIso)));

  const [existing] = await db
    .select()
    .from(pipelineRunLeases)
    .where(scopeFilter())
    .limit(1);
  if (existing) {
    if (existing.pipelineRunId === args.pipelineRunId) {
      const refreshed = await heartbeatPipelineRunLease({
        pipelineRunId: args.pipelineRunId,
        ttlMs,
      });
      return { acquired: true, lease: refreshed };
    }
    return { acquired: false, lease: mapLease(existing) };
  }

  const id = randomUUID();
  try {
    await db.insert(pipelineRunLeases).values({
      id,
      tenantId: scope.tenantId,
      userId: scope.userId,
      pipelineRunId: args.pipelineRunId,
      acquiredAt: nowIso,
      heartbeatAt: nowIso,
      expiresAt: expiryFrom(now, ttlMs),
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    // Another worker may have acquired the owner-unique lease concurrently.
    const [winner] = await db
      .select()
      .from(pipelineRunLeases)
      .where(scopeFilter())
      .limit(1);
    return { acquired: false, lease: winner ? mapLease(winner) : null };
  }

  const [created] = await db
    .select()
    .from(pipelineRunLeases)
    .where(and(scopeFilter(), eq(pipelineRunLeases.id, id)))
    .limit(1);
  return { acquired: true, lease: created ? mapLease(created) : null };
}

export async function heartbeatPipelineRunLease(args: {
  pipelineRunId: string;
  ttlMs?: number;
}): Promise<PipelineRunLease | null> {
  const now = new Date();
  const nowIso = now.toISOString();
  const ttlMs = Math.max(30_000, args.ttlMs ?? DEFAULT_LEASE_TTL_MS);
  await db
    .update(pipelineRunLeases)
    .set({
      heartbeatAt: nowIso,
      expiresAt: expiryFrom(now, ttlMs),
      updatedAt: nowIso,
    })
    .where(
      and(
        scopeFilter(),
        eq(pipelineRunLeases.pipelineRunId, args.pipelineRunId),
      ),
    );

  const [row] = await db
    .select()
    .from(pipelineRunLeases)
    .where(
      and(
        scopeFilter(),
        eq(pipelineRunLeases.pipelineRunId, args.pipelineRunId),
      ),
    )
    .limit(1);
  return row ? mapLease(row) : null;
}

export async function releasePipelineRunLease(
  pipelineRunId: string,
): Promise<void> {
  await db
    .delete(pipelineRunLeases)
    .where(
      and(scopeFilter(), eq(pipelineRunLeases.pipelineRunId, pipelineRunId)),
    );
}

export async function getActivePipelineRunLease(): Promise<PipelineRunLease | null> {
  const nowIso = new Date().toISOString();
  await db
    .delete(pipelineRunLeases)
    .where(and(scopeFilter(), lt(pipelineRunLeases.expiresAt, nowIso)));
  const [row] = await db
    .select()
    .from(pipelineRunLeases)
    .where(scopeFilter())
    .limit(1);
  return row ? mapLease(row) : null;
}
