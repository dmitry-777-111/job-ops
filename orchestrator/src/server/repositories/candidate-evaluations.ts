import { randomUUID } from "node:crypto";
import type {
  CandidateEvaluation,
  CandidateEvaluationStatus,
  HardGateOutcome,
  PrefilterDisposition,
} from "@shared/types";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { candidateEvaluations, marketPostingVersions } = schema;

function scopeFilter() {
  return privateDataScopeFilter(candidateEvaluations);
}

function mapRow(
  row: typeof candidateEvaluations.$inferSelect,
): CandidateEvaluation {
  return {
    id: row.id,
    marketPostingId: row.marketPostingId,
    marketPostingVersionId: row.marketPostingVersionId,
    profileVersionId: row.profileVersionId,
    strategyVersionId: row.strategyVersionId,
    scoringPolicyVersion: row.scoringPolicyVersion,
    prefilterDisposition: row.prefilterDisposition as PrefilterDisposition,
    prefilterRuleVersion: row.prefilterRuleVersion,
    prefilterReason: row.prefilterReason,
    hardGateOutcome: row.hardGateOutcome as HardGateOutcome,
    status: row.status as CandidateEvaluationStatus,
    suitabilityScore: row.suitabilityScore,
    suitabilityReason: row.suitabilityReason,
    factualFit: row.factualFit,
    careerValue: row.careerValue,
    compensationAssessment: row.compensationAssessment,
    workAuthorizationAssessment: row.workAuthorizationAssessment,
    locationTravelAssessment: row.locationTravelAssessment,
    uncertainties: (row.uncertainties as string[]) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findCandidateEvaluation(input: {
  marketPostingVersionId: string;
  profileVersionId: string;
  strategyVersionId: string;
  scoringPolicyVersion: string;
}): Promise<CandidateEvaluation | null> {
  const [row] = await db
    .select()
    .from(candidateEvaluations)
    .where(
      and(
        scopeFilter(),
        eq(
          candidateEvaluations.marketPostingVersionId,
          input.marketPostingVersionId,
        ),
        eq(candidateEvaluations.profileVersionId, input.profileVersionId),
        eq(candidateEvaluations.strategyVersionId, input.strategyVersionId),
        eq(
          candidateEvaluations.scoringPolicyVersion,
          input.scoringPolicyVersion,
        ),
      ),
    )
    .limit(1);
  return row ? mapRow(row) : null;
}

/**
 * Return an existing evaluation for identical immutable inputs, or create one
 * pending evaluation. This is the v3 idempotency boundary that prevents an
 * unchanged posting/profile/strategy/policy tuple from consuming AI again.
 */
export async function ensureCandidateEvaluation(input: {
  marketPostingId: string;
  marketPostingVersionId: string;
  profileVersionId: string;
  strategyVersionId: string;
  scoringPolicyVersion: string;
}): Promise<{ evaluation: CandidateEvaluation; created: boolean }> {
  const existing = await findCandidateEvaluation(input);
  if (existing) return { evaluation: existing, created: false };

  const [postingVersion] = await db
    .select({ marketPostingId: marketPostingVersions.marketPostingId })
    .from(marketPostingVersions)
    .where(eq(marketPostingVersions.id, input.marketPostingVersionId))
    .limit(1);
  if (
    !postingVersion ||
    postingVersion.marketPostingId !== input.marketPostingId
  ) {
    throw new Error(
      "Candidate evaluation posting/version mismatch or unknown market posting version.",
    );
  }

  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  const id = randomUUID();
  await db.insert(candidateEvaluations).values({
    id,
    tenantId: scope.tenantId,
    userId: scope.userId,
    marketPostingId: input.marketPostingId,
    marketPostingVersionId: input.marketPostingVersionId,
    profileVersionId: input.profileVersionId,
    strategyVersionId: input.strategyVersionId,
    scoringPolicyVersion: input.scoringPolicyVersion,
    prefilterDisposition: "not_evaluated",
    hardGateOutcome: "unknown",
    status: "pending",
    uncertainties: [],
    createdAt: now,
    updatedAt: now,
  });

  const created = await findCandidateEvaluation(input);
  if (!created) throw new Error("Failed to load created candidate evaluation.");
  return { evaluation: created, created: true };
}

export async function updateCandidateEvaluation(
  id: string,
  patch: Partial<{
    prefilterDisposition: PrefilterDisposition;
    prefilterRuleVersion: string | null;
    prefilterReason: string | null;
    hardGateOutcome: HardGateOutcome;
    status: CandidateEvaluationStatus;
    suitabilityScore: number | null;
    suitabilityReason: string | null;
    factualFit: string | null;
    careerValue: string | null;
    compensationAssessment: string | null;
    workAuthorizationAssessment: string | null;
    locationTravelAssessment: string | null;
    uncertainties: string[];
  }>,
): Promise<CandidateEvaluation | null> {
  const now = new Date().toISOString();
  await db
    .update(candidateEvaluations)
    .set({ ...patch, updatedAt: now })
    .where(and(scopeFilter(), eq(candidateEvaluations.id, id)));

  const [row] = await db
    .select()
    .from(candidateEvaluations)
    .where(and(scopeFilter(), eq(candidateEvaluations.id, id)))
    .limit(1);
  return row ? mapRow(row) : null;
}
