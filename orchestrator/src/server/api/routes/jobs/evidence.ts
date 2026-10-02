import { badRequest } from "@infra/errors";
import { fail, ok } from "@infra/http";
import * as factsRepo from "@server/repositories/job-verified-facts";
import {
  stageEvidenceSchema,
  validateEvidenceSource,
} from "@server/services/applicationTracking";
import { VERIFIED_JOB_FACT_KEYS, type VerifiedJobFactKey } from "@shared/types";
import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { requireJob, toJobsRouteError } from "./shared";

export const jobsEvidenceRouter = Router();

const paramsSchema = z.object({
  factKey: z.enum(VERIFIED_JOB_FACT_KEYS),
});

const bodySchema = z.object({
  evidence: stageEvidenceSchema,
});

function validateCriticalFactEvidence(
  factKey: VerifiedJobFactKey,
  evidence: z.infer<typeof stageEvidenceSchema>,
) {
  if (evidence.kind !== factKey) {
    throw badRequest(`Evidence kind must match critical fact: ${factKey}`);
  }
  if (evidence.verifiedBy !== "user") {
    throw badRequest("Critical job facts require user-verified evidence");
  }
}

jobsEvidenceRouter.get(
  "/:id/verified-facts",
  async (req: Request, res: Response) => {
    try {
      await requireJob(req.params.id);
      ok(res, await factsRepo.listJobVerifiedFacts(req.params.id));
    } catch (error) {
      fail(res, toJobsRouteError(error));
    }
  },
);

jobsEvidenceRouter.put(
  "/:id/verified-facts/:factKey",
  async (req: Request, res: Response) => {
    try {
      await requireJob(req.params.id);
      const { factKey } = paramsSchema.parse(req.params);
      const { evidence } = bodySchema.parse(req.body);
      validateCriticalFactEvidence(factKey, evidence);
      validateEvidenceSource(evidence);
      ok(
        res,
        await factsRepo.upsertJobVerifiedFact({
          jobId: req.params.id,
          factKey,
          evidence,
        }),
      );
    } catch (error) {
      fail(res, toJobsRouteError(error));
    }
  },
);

jobsEvidenceRouter.delete(
  "/:id/verified-facts/:factKey",
  async (req: Request, res: Response) => {
    try {
      await requireJob(req.params.id);
      const { factKey } = paramsSchema.parse(req.params);
      ok(res, {
        deleted: await factsRepo.deleteJobVerifiedFact(req.params.id, factKey),
      });
    } catch (error) {
      fail(res, toJobsRouteError(error));
    }
  },
);
