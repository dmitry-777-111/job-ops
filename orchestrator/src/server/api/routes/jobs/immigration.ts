import { badRequest } from "@infra/errors";
import { fail, ok } from "@infra/http";
import * as profileRepo from "@server/repositories/job-immigration-profiles";
import * as factsRepo from "@server/repositories/job-verified-facts";
import { getEmployerLmiaHistory } from "@server/services/canada-immigration";
import {
  IMMIGRATION_EMPLOYER_SUPPORT_STATUSES,
  type ImmigrationEvidence,
} from "@shared/types";
import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { requireJob, toJobsRouteError } from "./shared";

export const jobsImmigrationRouter = Router();

const evidenceSchema = z.object({
  sourceType: z.enum([
    "manual_verified",
    "gmail_message",
    "calendar_event",
    "document",
    "url",
  ]),
  sourceId: z.string().trim().min(1).nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  note: z.string().trim().min(1),
  verifiedBy: z.literal("user"),
});

const bodySchema = z.object({
  nocCode: z.string().trim().max(20).nullable().optional(),
  employerSupportStatus: z
    .enum(IMMIGRATION_EMPLOYER_SUPPORT_STATUSES)
    .optional(),
  workPermitRequirement: z.string().trim().max(1000).nullable().optional(),
  usTravelRequired: z.boolean().nullable().optional(),
  wageHourlyCad: z.number().nonnegative().max(10000).nullable().optional(),
  wageAnnualCad: z.number().nonnegative().max(10000000).nullable().optional(),
  immigrationNotes: z.string().trim().max(10000).nullable().optional(),
  evidence: z.array(evidenceSchema).max(50).optional(),
});

function validateEvidence(evidence: ImmigrationEvidence[]) {
  for (const item of evidence) {
    if (item.verifiedBy !== "user") {
      throw badRequest("Immigration evidence must be user-verified");
    }
    if (!item.note.trim()) {
      throw badRequest("Immigration evidence requires a supporting note");
    }
    if (item.sourceType === "url" && !item.sourceUrl?.trim()) {
      throw badRequest("URL evidence requires sourceUrl");
    }
    if (
      ["gmail_message", "calendar_event", "document"].includes(
        item.sourceType,
      ) &&
      !item.sourceId?.trim()
    ) {
      throw badRequest(
        `Evidence source type ${item.sourceType} requires sourceId`,
      );
    }
  }
}

jobsImmigrationRouter.get(
  "/:id/immigration-profile",
  async (req: Request, res: Response) => {
    try {
      await requireJob(req.params.id);
      ok(res, {
        profile: await profileRepo.getJobImmigrationProfile(req.params.id),
        verifiedFacts: await factsRepo.listJobVerifiedFacts(req.params.id),
      });
    } catch (error) {
      fail(res, toJobsRouteError(error));
    }
  },
);

jobsImmigrationRouter.put(
  "/:id/immigration-profile",
  async (req: Request, res: Response) => {
    try {
      await requireJob(req.params.id);
      const input = bodySchema.parse(req.body);
      if (input.evidence) validateEvidence(input.evidence);

      const current = await profileRepo.getJobImmigrationProfile(req.params.id);
      const effectiveEvidence = input.evidence ?? current?.evidence ?? [];
      const effectiveSupport =
        input.employerSupportStatus ??
        current?.employerSupportStatus ??
        "unknown";
      const effectiveUsTravel =
        input.usTravelRequired !== undefined
          ? input.usTravelRequired
          : (current?.usTravelRequired ?? null);

      if (
        (effectiveSupport === "confirmed" ||
          effectiveSupport === "not_available") &&
        effectiveEvidence.length === 0
      ) {
        throw badRequest(
          "Confirmed or unavailable employer support requires user-verified evidence",
        );
      }
      if (effectiveUsTravel === true && effectiveEvidence.length === 0) {
        throw badRequest(
          "US travel requirement requires user-verified evidence",
        );
      }

      ok(
        res,
        await profileRepo.updateJobImmigrationProfile(req.params.id, input),
      );
    } catch (error) {
      fail(res, toJobsRouteError(error));
    }
  },
);

jobsImmigrationRouter.post(
  "/:id/immigration-profile/refresh-lmia",
  async (req: Request, res: Response) => {
    try {
      const job = await requireJob(req.params.id);
      const history = await getEmployerLmiaHistory(job.employer);
      ok(res, await profileRepo.updateLmiaHistory(req.params.id, history));
    } catch (error) {
      fail(res, toJobsRouteError(error));
    }
  },
);
