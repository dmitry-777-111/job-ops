import { toAppError } from "@infra/errors";
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
import { getProfile } from "@server/services/profile";
import {
  CANDIDATE_CONSTRAINT_KINDS,
  CANDIDATE_CONSTRAINT_SOURCES,
} from "@shared/types";
import { type Request, type Response, Router } from "express";
import { z } from "zod";

export const candidateRouter = Router();

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
        source: "ai_normalized",
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
        res.status(404).json({ error: "Candidate profile version not found." });
        return;
      }
      ok(res, activated);
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
      ok(res, await createCandidateStrategyDraft(input), 201);
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
        res
          .status(404)
          .json({ error: "Candidate strategy version not found." });
        return;
      }
      ok(res, activated);
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);
