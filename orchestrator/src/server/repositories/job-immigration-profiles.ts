import { randomUUID } from "node:crypto";
import type {
  ImmigrationEvidence,
  JobImmigrationProfile,
  UpdateJobImmigrationProfileInput,
} from "@shared/types";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { jobImmigrationProfiles } = schema;

function scopeFilter() {
  return privateDataScopeFilter(jobImmigrationProfiles);
}

function mapRow(
  row: typeof jobImmigrationProfiles.$inferSelect,
): JobImmigrationProfile {
  return {
    jobId: row.jobId,
    nocCode: row.nocCode,
    lmiaHistoricalSignal: row.lmiaHistoricalSignal,
    lmiaLatestQuarter: row.lmiaLatestQuarter,
    lmiaStreams: (row.lmiaStreams ?? []) as string[],
    lmiaMatchedEmployerNames: (row.lmiaMatchedEmployerNames ?? []) as string[],
    lmiaMatchedRows: row.lmiaMatchedRows,
    lmiaSourceUrl: row.lmiaSourceUrl,
    lmiaSourceDate: row.lmiaSourceDate,
    lmiaLastCheckedAt: row.lmiaLastCheckedAt,
    employerSupportStatus: row.employerSupportStatus,
    workPermitRequirement: row.workPermitRequirement,
    usTravelRequired: row.usTravelRequired,
    wageHourlyCad: row.wageHourlyCad,
    wageAnnualCad: row.wageAnnualCad,
    immigrationNotes: row.immigrationNotes,
    evidence: (row.evidence ?? []) as ImmigrationEvidence[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getJobImmigrationProfile(
  jobId: string,
): Promise<JobImmigrationProfile | null> {
  const [row] = await db
    .select()
    .from(jobImmigrationProfiles)
    .where(and(scopeFilter(), eq(jobImmigrationProfiles.jobId, jobId)));
  return row ? mapRow(row) : null;
}

async function ensureProfile(jobId: string) {
  const existing = await getJobImmigrationProfile(jobId);
  if (existing) return;
  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  await db.insert(jobImmigrationProfiles).values({
    id: randomUUID(),
    tenantId: scope.tenantId,
    userId: scope.enforceUserIsolation ? scope.userId : null,
    jobId,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateJobImmigrationProfile(
  jobId: string,
  input: UpdateJobImmigrationProfileInput,
): Promise<JobImmigrationProfile> {
  await ensureProfile(jobId);
  const [updated] = await db
    .update(jobImmigrationProfiles)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(scopeFilter(), eq(jobImmigrationProfiles.jobId, jobId)))
    .returning();
  if (!updated) throw new Error("Immigration profile update failed");

  return mapRow(updated);
}

export async function updateLmiaHistory(
  jobId: string,
  input: Pick<
    JobImmigrationProfile,
    | "lmiaHistoricalSignal"
    | "lmiaLatestQuarter"
    | "lmiaStreams"
    | "lmiaMatchedEmployerNames"
    | "lmiaMatchedRows"
    | "lmiaSourceUrl"
    | "lmiaSourceDate"
    | "lmiaLastCheckedAt"
  >,
): Promise<JobImmigrationProfile> {
  await ensureProfile(jobId);
  const [updated] = await db
    .update(jobImmigrationProfiles)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(and(scopeFilter(), eq(jobImmigrationProfiles.jobId, jobId)))
    .returning();
  if (!updated) throw new Error("LMIA history update failed");
  return mapRow(updated);
}
