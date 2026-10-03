import { randomUUID } from "node:crypto";
import type {
  ApplicationEvidenceItem,
  ApplicationGapItem,
  ApplicationPackage,
  ApplicationPackageStatus,
} from "@shared/types";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { applicationPackages, marketPostingVersions } = schema;

function scopeFilter() {
  return privateDataScopeFilter(applicationPackages);
}

function mapRow(
  row: typeof applicationPackages.$inferSelect,
): ApplicationPackage {
  return {
    id: row.id,
    version: row.version,
    status: row.status as ApplicationPackageStatus,
    marketPostingId: row.marketPostingId,
    marketPostingVersionId: row.marketPostingVersionId,
    profileVersionId: row.profileVersionId,
    strategyVersionId: row.strategyVersionId,
    generationPolicyVersion: row.generationPolicyVersion,
    evidenceMap: (row.evidenceMap as ApplicationEvidenceItem[]) ?? [],
    gaps: (row.gaps as ApplicationGapItem[]) ?? [],
    targetedCvJson:
      (row.targetedCvJson as Record<string, unknown> | null) ?? null,
    coverLetter: row.coverLetter,
    formAnswers: (row.formAnswers as Record<string, string>) ?? {},
    approvedAt: row.approvedAt,
    exportedAt: row.exportedAt,
    staleReason: row.staleReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listApplicationPackagesForPosting(
  marketPostingId: string,
): Promise<ApplicationPackage[]> {
  const rows = await db
    .select()
    .from(applicationPackages)
    .where(
      and(
        scopeFilter(),
        eq(applicationPackages.marketPostingId, marketPostingId),
      ),
    )
    .orderBy(desc(applicationPackages.version));
  return rows.map(mapRow);
}

export async function getApplicationPackage(
  id: string,
): Promise<ApplicationPackage | null> {
  const [row] = await db
    .select()
    .from(applicationPackages)
    .where(and(scopeFilter(), eq(applicationPackages.id, id)))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function createApplicationPackageDraft(input: {
  marketPostingId: string;
  marketPostingVersionId: string;
  profileVersionId: string;
  strategyVersionId?: string | null;
  generationPolicyVersion: string;
  evidenceMap?: ApplicationEvidenceItem[];
  gaps?: ApplicationGapItem[];
  targetedCvJson?: Record<string, unknown> | null;
  coverLetter?: string | null;
  formAnswers?: Record<string, string>;
}): Promise<ApplicationPackage> {
  const [postingVersion] = await db
    .select({ marketPostingId: marketPostingVersions.marketPostingId })
    .from(marketPostingVersions)
    .where(eq(marketPostingVersions.id, input.marketPostingVersionId))
    .limit(1);
  if (
    !postingVersion ||
    postingVersion.marketPostingId !== input.marketPostingId
  ) {
    throw new Error("Application package posting/version mismatch.");
  }

  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  const id = randomUUID();

  db.transaction((tx) => {
    const [row] = tx
      .select({
        maxVersion: sql<number>`coalesce(max(${applicationPackages.version}), 0)`,
      })
      .from(applicationPackages)
      .where(
        and(
          scopeFilter(),
          eq(applicationPackages.marketPostingId, input.marketPostingId),
        ),
      )
      .all();
    const version = Number(row?.maxVersion ?? 0) + 1;

    tx.insert(applicationPackages)
      .values({
        id,
        tenantId: scope.tenantId,
        userId: scope.userId,
        version,
        status: "draft",
        marketPostingId: input.marketPostingId,
        marketPostingVersionId: input.marketPostingVersionId,
        profileVersionId: input.profileVersionId,
        strategyVersionId: input.strategyVersionId ?? null,
        generationPolicyVersion: input.generationPolicyVersion,
        evidenceMap: input.evidenceMap ?? [],
        gaps: input.gaps ?? [],
        targetedCvJson: input.targetedCvJson ?? null,
        coverLetter: input.coverLetter ?? null,
        formAnswers: input.formAnswers ?? {},
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  const created = await getApplicationPackage(id);
  if (!created) throw new Error("Failed to load application package draft.");
  return created;
}

export async function updateApplicationPackage(
  id: string,
  patch: Partial<{
    status: ApplicationPackageStatus;
    evidenceMap: ApplicationEvidenceItem[];
    gaps: ApplicationGapItem[];
    targetedCvJson: Record<string, unknown> | null;
    coverLetter: string | null;
    formAnswers: Record<string, string>;
    staleReason: string | null;
  }>,
): Promise<ApplicationPackage | null> {
  const existing = await getApplicationPackage(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  await db
    .update(applicationPackages)
    .set({
      ...patch,
      ...(patch.status === "approved" && !existing.approvedAt
        ? { approvedAt: now }
        : {}),
      ...(patch.status === "exported" && !existing.exportedAt
        ? { exportedAt: now }
        : {}),
      updatedAt: now,
    })
    .where(and(scopeFilter(), eq(applicationPackages.id, id)));
  return getApplicationPackage(id);
}
