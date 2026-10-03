import { randomUUID } from "node:crypto";
import type {
  CandidateConstraint,
  CandidateStrategyProfile,
} from "@shared/types";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { candidateStrategyVersions } = schema;

function scopeFilter() {
  return privateDataScopeFilter(candidateStrategyVersions);
}

function mapRow(
  row: typeof candidateStrategyVersions.$inferSelect,
): CandidateStrategyProfile {
  return {
    id: row.id,
    version: row.version,
    status: row.status as CandidateStrategyProfile["status"],
    targetMarkets: row.targetMarkets as string[],
    targetRoleFamilies: row.targetRoleFamilies as string[],
    excludedRoleFamilies: row.excludedRoleFamilies as string[],
    constraints: row.constraints as CandidateConstraint[],
    freeformNotes: row.freeformNotes,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
  };
}

export async function createCandidateStrategyDraft(input: {
  targetMarkets?: string[];
  targetRoleFamilies?: string[];
  excludedRoleFamilies?: string[];
  constraints?: CandidateConstraint[];
  freeformNotes?: string | null;
}): Promise<CandidateStrategyProfile> {
  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  const id = randomUUID();

  db.transaction((tx) => {
    const [row] = tx
      .select({
        maxVersion: sql<number>`coalesce(max(${candidateStrategyVersions.version}), 0)`,
      })
      .from(candidateStrategyVersions)
      .where(scopeFilter())
      .all();
    const version = Number(row?.maxVersion ?? 0) + 1;

    tx.insert(candidateStrategyVersions)
      .values({
        id,
        tenantId: scope.tenantId,
        userId: scope.userId,
        version,
        status: "draft",
        targetMarkets: input.targetMarkets ?? [],
        targetRoleFamilies: input.targetRoleFamilies ?? [],
        excludedRoleFamilies: input.excludedRoleFamilies ?? [],
        constraints: input.constraints ?? [],
        freeformNotes: input.freeformNotes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  const row = await getCandidateStrategyVersion(id);
  if (!row) throw new Error("Failed to load created candidate strategy version");
  return row;
}

export async function getCandidateStrategyVersion(
  id: string,
): Promise<CandidateStrategyProfile | null> {
  const [row] = await db
    .select()
    .from(candidateStrategyVersions)
    .where(and(scopeFilter(), eq(candidateStrategyVersions.id, id)))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function getActiveCandidateStrategy(): Promise<CandidateStrategyProfile | null> {
  const [row] = await db
    .select()
    .from(candidateStrategyVersions)
    .where(and(scopeFilter(), eq(candidateStrategyVersions.status, "active")))
    .orderBy(desc(candidateStrategyVersions.version))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function listCandidateStrategyVersions(): Promise<CandidateStrategyProfile[]> {
  const rows = await db
    .select()
    .from(candidateStrategyVersions)
    .where(scopeFilter())
    .orderBy(desc(candidateStrategyVersions.version));
  return rows.map(mapRow);
}

export async function activateCandidateStrategyVersion(
  id: string,
): Promise<CandidateStrategyProfile | null> {
  const now = new Date().toISOString();
  db.transaction((tx) => {
    const target = tx
      .select({ id: candidateStrategyVersions.id })
      .from(candidateStrategyVersions)
      .where(and(scopeFilter(), eq(candidateStrategyVersions.id, id)))
      .get();
    if (!target) return;

    tx.update(candidateStrategyVersions)
      .set({ status: "superseded", supersededAt: now, updatedAt: now })
      .where(and(scopeFilter(), eq(candidateStrategyVersions.status, "active")))
      .run();

    tx.update(candidateStrategyVersions)
      .set({
        status: "active",
        activatedAt: now,
        supersededAt: null,
        updatedAt: now,
      })
      .where(and(scopeFilter(), eq(candidateStrategyVersions.id, id)))
      .run();
  });
  return getCandidateStrategyVersion(id);
}
