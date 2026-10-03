import { randomUUID } from "node:crypto";
import type {
  CandidateProfileSource,
  CandidateProfileVersionStatus,
  MasterCareerProfileVersion,
  ResumeProfile,
} from "@shared/types";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { candidateProfileVersions } = schema;

function scopeFilter() {
  return privateDataScopeFilter(candidateProfileVersions);
}

function mapRow(
  row: typeof candidateProfileVersions.$inferSelect,
): MasterCareerProfileVersion {
  return {
    id: row.id,
    version: row.version,
    status: row.status as CandidateProfileVersionStatus,
    profile: row.profileJson as ResumeProfile,
    source: row.source as CandidateProfileSource,
    sourceRef: row.sourceRef,
    provenance: (row.provenance as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
    supersededAt: row.supersededAt,
  };
}

export async function createMasterCareerProfileDraft(input: {
  profile: ResumeProfile;
  source: CandidateProfileSource;
  sourceRef?: string | null;
  provenance?: Record<string, unknown> | null;
}): Promise<MasterCareerProfileVersion> {
  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  const id = randomUUID();

  db.transaction((tx) => {
    const [row] = tx
      .select({
        maxVersion: sql<number>`coalesce(max(${candidateProfileVersions.version}), 0)`,
      })
      .from(candidateProfileVersions)
      .where(scopeFilter())
      .all();
    const version = Number(row?.maxVersion ?? 0) + 1;

    tx.insert(candidateProfileVersions)
      .values({
        id,
        tenantId: scope.tenantId,
        userId: scope.userId,
        version,
        status: "draft",
        profileJson: input.profile,
        source: input.source,
        sourceRef: input.sourceRef ?? null,
        provenance: input.provenance ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  const row = await getMasterCareerProfileVersion(id);
  if (!row) throw new Error("Failed to load created candidate profile version");
  return row;
}

export async function getMasterCareerProfileVersion(
  id: string,
): Promise<MasterCareerProfileVersion | null> {
  const [row] = await db
    .select()
    .from(candidateProfileVersions)
    .where(and(scopeFilter(), eq(candidateProfileVersions.id, id)))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function getActiveMasterCareerProfile(): Promise<MasterCareerProfileVersion | null> {
  const [row] = await db
    .select()
    .from(candidateProfileVersions)
    .where(and(scopeFilter(), eq(candidateProfileVersions.status, "active")))
    .orderBy(desc(candidateProfileVersions.version))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function listMasterCareerProfileVersions(): Promise<
  MasterCareerProfileVersion[]
> {
  const rows = await db
    .select()
    .from(candidateProfileVersions)
    .where(scopeFilter())
    .orderBy(desc(candidateProfileVersions.version));
  return rows.map(mapRow);
}

export async function activateMasterCareerProfileVersion(
  id: string,
): Promise<MasterCareerProfileVersion | null> {
  const now = new Date().toISOString();
  db.transaction((tx) => {
    const target = tx
      .select({ id: candidateProfileVersions.id })
      .from(candidateProfileVersions)
      .where(and(scopeFilter(), eq(candidateProfileVersions.id, id)))
      .get();
    if (!target) return;

    tx.update(candidateProfileVersions)
      .set({
        status: "superseded",
        supersededAt: now,
        updatedAt: now,
      })
      .where(and(scopeFilter(), eq(candidateProfileVersions.status, "active")))
      .run();

    tx.update(candidateProfileVersions)
      .set({
        status: "active",
        activatedAt: now,
        supersededAt: null,
        updatedAt: now,
      })
      .where(and(scopeFilter(), eq(candidateProfileVersions.id, id)))
      .run();
  });
  return getMasterCareerProfileVersion(id);
}
