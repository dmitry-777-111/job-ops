import { randomUUID } from "node:crypto";
import type {
  CareerRecommendationDecision,
  CareerRecommendationSnapshot,
  CareerRecommendationStatus,
} from "@shared/types";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { careerRecommendationDecisions } = schema;

function scopeFilter() {
  return privateDataScopeFilter(careerRecommendationDecisions);
}

function mapRow(
  row: typeof careerRecommendationDecisions.$inferSelect,
): CareerRecommendationDecision {
  return {
    id: row.id,
    key: row.recommendationKey,
    snapshot: row.snapshot as CareerRecommendationSnapshot,
    status: row.status as CareerRecommendationStatus,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    updatedAt: row.updatedAt,
  };
}

export async function listCareerRecommendationDecisions(): Promise<
  CareerRecommendationDecision[]
> {
  const rows = await db
    .select()
    .from(careerRecommendationDecisions)
    .where(scopeFilter())
    .orderBy(desc(careerRecommendationDecisions.updatedAt));
  return rows.map(mapRow);
}

export async function decideCareerRecommendation(input: {
  key: string;
  snapshot: CareerRecommendationSnapshot;
  status: Exclude<CareerRecommendationStatus, "proposed">;
}): Promise<CareerRecommendationDecision> {
  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(careerRecommendationDecisions)
    .where(
      and(
        scopeFilter(),
        eq(careerRecommendationDecisions.recommendationKey, input.key),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(careerRecommendationDecisions)
      .set({
        snapshot: input.snapshot,
        status: input.status,
        decidedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          scopeFilter(),
          eq(careerRecommendationDecisions.id, existing[0].id),
        ),
      );
  } else {
    await db.insert(careerRecommendationDecisions).values({
      id: randomUUID(),
      tenantId: scope.tenantId,
      userId: scope.userId,
      recommendationKey: input.key,
      snapshot: input.snapshot,
      status: input.status,
      decidedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  const [row] = await db
    .select()
    .from(careerRecommendationDecisions)
    .where(
      and(
        scopeFilter(),
        eq(careerRecommendationDecisions.recommendationKey, input.key),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Failed to persist career recommendation decision");
  return mapRow(row);
}
