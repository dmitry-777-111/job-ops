import { notFound, toAppError } from "@infra/errors";
import { fail, ok } from "@infra/http";
import {
  activateMasterCareerProfileVersion,
  createMasterCareerProfileDraft,
  getActiveMasterCareerProfile,
  listMasterCareerProfileVersions,
} from "@server/repositories/candidate-profile";
import {
  activateCandidateStrategyVersion,
  createCandidateStrategyDraft,
  getActiveCandidateStrategy,
  listCandidateStrategyVersions,
} from "@server/repositories/candidate-strategy";
import {
  decideCareerRecommendation,
  listCareerRecommendationDecisions,
} from "@server/repositories/career-recommendations";
import { listExternalConnections } from "@server/repositories/external-connections";
import { deriveCandidateReadiness } from "@server/services/candidate-readiness";
import { bootstrapCurrentCandidateStrategy } from "@server/services/candidate-strategy-bootstrap";
import { deriveCandidateStrategyDelta } from "@server/services/candidate-strategy-delta";
import { getProfile } from "@server/services/profile";
import {
  CANDIDATE_CONSTRAINT_KINDS,
  CANDIDATE_CONSTRAINT_SOURCES,
  type CandidateConstraint,
  type ResumeProfile,
} from "@shared/types";
import { type Request, type Response, Router } from "express";
import { z } from "zod";

export const candidateRouter = Router();

const recommendationDecisionSchema = z.object({
  key: z.string().trim().min(1).max(300),
  status: z.enum(["accepted", "rejected"]),
  snapshot: z.object({
    stage: z.enum(["market_entry", "screening", "interview", "final"]),
    confidence: z.enum(["emerging", "moderate", "strong"]),
    target: z.enum([
      "strategy",
      "profile",
      "interview_behavior",
      "job_platform_profile",
      "mixed",
    ]),
    title: z.string().trim().min(1).max(1000),
    evidence: z.string().trim().min(1).max(5000),
    recommendation: z.string().trim().min(1).max(5000),
  }),
});

candidateRouter.get(
  "/recommendations",
  async (_req: Request, res: Response) => {
    try {
      ok(res, await listCareerRecommendationDecisions());
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

candidateRouter.post(
  "/recommendations/decision",
  async (req: Request, res: Response) => {
    try {
      const input = recommendationDecisionSchema.parse(req.body ?? {});
      ok(res, await decideCareerRecommendation(input));
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

const constraintSchema = z.object({
  id: z.string().trim().min(1).max(200),
  key: z.string().trim().min(1).max(200),
  kind: z.enum(CANDIDATE_CONSTRAINT_KINDS),
  value: z.unknown(),
  source: z.enum(CANDIDATE_CONSTRAINT_SOURCES),
  confidence: z.number().min(0).max(1),
  explanation: z.string().trim().max(2000).nullable().optional(),
  effectiveAt: z.string().trim().min(1),
  expiresAt: z.string().trim().min(1).nullable().optional(),
  recheckTrigger: z.string().trim().max(1000).nullable().optional(),
});

const strategyDraftSchema = z.object({
  targetMarkets: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  targetRoleFamilies: z
    .array(z.string().trim().min(1).max(200))
    .max(100)
    .default([]),
  excludedRoleFamilies: z
    .array(z.string().trim().min(1).max(200))
    .max(100)
    .default([]),
  constraints: z.array(constraintSchema).max(300).default([]),
  freeformNotes: z.string().trim().max(20_000).nullable().optional(),
});

candidateRouter.get("/readiness", async (_req: Request, res: Response) => {
  try {
    const [profile, strategy, connections] = await Promise.all([
      getActiveMasterCareerProfile(),
      getActiveCandidateStrategy(),
      listExternalConnections(),
    ]);
    ok(res, deriveCandidateReadiness({ profile, strategy, connections }));
  } catch (error) {
    fail(res, toAppError(error));
  }
});

candidateRouter.get("/profile/active", async (_req: Request, res: Response) => {
  try {
    ok(res, await getActiveMasterCareerProfile());
  } catch (error) {
    fail(res, toAppError(error));
  }
});

candidateRouter.get(
  "/profile/versions",
  async (_req: Request, res: Response) => {
    try {
      ok(res, await listMasterCareerProfileVersions());
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

const profileDraftSchema = z.object({
  profile: z.record(z.string(), z.unknown()),
  sourceRef: z.string().trim().max(500).nullable().optional(),
  provenance: z.record(z.string(), z.unknown()).nullable().optional(),
});

candidateRouter.post(
  "/profile/versions",
  async (req: Request, res: Response) => {
    try {
      const input = profileDraftSchema.parse(req.body ?? {});
      ok(
        res,
        await createMasterCareerProfileDraft({
          profile: input.profile as ResumeProfile,
          source: "manual",
          sourceRef: input.sourceRef ?? null,
          provenance: input.provenance ?? null,
        }),
        201,
      );
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

candidateRouter.post(
  "/profile/bootstrap-current",
  async (_req: Request, res: Response) => {
    try {
      const active = await getActiveMasterCareerProfile();
      if (active) {
        ok(res, { profile: active, created: false });
        return;
      }

      const currentProfile = await getProfile();
      const draft = await createMasterCareerProfileDraft({
        profile: currentProfile,
        source: "legacy_current_profile",
        sourceRef: "legacy-current-profile",
        provenance: {
          migration: "freeze3-bootstrap-current-profile",
        },
      });
      const activated = await activateMasterCareerProfileVersion(draft.id);
      ok(res, { profile: activated, created: true });
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

candidateRouter.post(
  "/profile/versions/:versionId/activate",
  async (req: Request, res: Response) => {
    try {
      const activated = await activateMasterCareerProfileVersion(
        String(req.params.versionId),
      );
      if (!activated) {
        throw notFound("Candidate profile version not found.");
      }
      ok(res, activated);
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

candidateRouter.post(
  "/strategy/bootstrap-current",
  async (_req: Request, res: Response) => {
    try {
      ok(res, await bootstrapCurrentCandidateStrategy());
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

candidateRouter.get(
  "/strategy/active",
  async (_req: Request, res: Response) => {
    try {
      ok(res, await getActiveCandidateStrategy());
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

candidateRouter.get(
  "/strategy/versions",
  async (_req: Request, res: Response) => {
    try {
      ok(res, await listCandidateStrategyVersions());
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

candidateRouter.post(
  "/strategy/versions",
  async (req: Request, res: Response) => {
    try {
      const input = strategyDraftSchema.parse(req.body ?? {});
      const constraints = input.constraints.map((constraint) => ({
        ...constraint,
        value: constraint.value,
      })) as CandidateConstraint[];
      ok(
        res,
        await createCandidateStrategyDraft({ ...input, constraints }),
        201,
      );
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

candidateRouter.get(
  "/strategy/versions/:versionId/delta",
  async (req: Request, res: Response) => {
    try {
      const versions = await listCandidateStrategyVersions();
      const target = versions.find(
        (version) => version.id === String(req.params.versionId),
      );
      if (!target) {
        throw notFound("Candidate strategy version not found.");
      }
      const active = await getActiveCandidateStrategy();
      ok(res, deriveCandidateStrategyDelta(active, target));
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

candidateRouter.post(
  "/strategy/versions/:versionId/activate",
  async (req: Request, res: Response) => {
    try {
      const activated = await activateCandidateStrategyVersion(
        String(req.params.versionId),
      );
      if (!activated) {
        throw notFound("Candidate strategy version not found.");
      }
      ok(res, activated);
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);
