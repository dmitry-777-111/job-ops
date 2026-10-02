import { randomUUID } from "node:crypto";
import type {
  JobVerifiedFact,
  StageEvidence,
  VerifiedJobFactKey,
} from "@shared/types";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { jobVerifiedFacts } = schema;

function scopeFilter() {
  return privateDataScopeFilter(jobVerifiedFacts);
}

function mapRow(row: typeof jobVerifiedFacts.$inferSelect): JobVerifiedFact {
  return {
    id: row.id,
    jobId: row.jobId,
    factKey: row.factKey,
    evidence: row.evidence as StageEvidence,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listJobVerifiedFacts(
  jobId: string,
): Promise<JobVerifiedFact[]> {
  const rows = await db
    .select()
    .from(jobVerifiedFacts)
    .where(and(scopeFilter(), eq(jobVerifiedFacts.jobId, jobId)));
  return rows.map(mapRow);
}

export async function upsertJobVerifiedFact(input: {
  jobId: string;
  factKey: VerifiedJobFactKey;
  evidence: StageEvidence;
}): Promise<JobVerifiedFact> {
  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(jobVerifiedFacts)
    .where(
      and(
        scopeFilter(),
        eq(jobVerifiedFacts.jobId, input.jobId),
        eq(jobVerifiedFacts.factKey, input.factKey),
      ),
    );

  if (existing) {
    const [updated] = await db
      .update(jobVerifiedFacts)
      .set({ evidence: input.evidence, updatedAt: now })
      .where(and(scopeFilter(), eq(jobVerifiedFacts.id, existing.id)))
      .returning();
    if (!updated) throw new Error("Verified job fact update failed");
    return mapRow(updated);
  }

  const [created] = await db
    .insert(jobVerifiedFacts)
    .values({
      id: randomUUID(),
      tenantId: scope.tenantId,
      userId: scope.enforceUserIsolation ? scope.userId : null,
      jobId: input.jobId,
      factKey: input.factKey,
      evidence: input.evidence,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!created) throw new Error("Verified job fact creation failed");
  return mapRow(created);
}

export async function deleteJobVerifiedFact(
  jobId: string,
  factKey: VerifiedJobFactKey,
): Promise<boolean> {
  const deleted = await db
    .delete(jobVerifiedFacts)
    .where(
      and(
        scopeFilter(),
        eq(jobVerifiedFacts.jobId, jobId),
        eq(jobVerifiedFacts.factKey, factKey),
      ),
    )
    .returning({ id: jobVerifiedFacts.id });
  return deleted.length > 0;
}
