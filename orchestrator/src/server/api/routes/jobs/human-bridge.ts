import { badRequest } from "@infra/errors";
import { fail, ok } from "@infra/http";
import * as humanBridgeRepo from "@server/repositories/human-bridge";
import { HUMAN_BRIDGE_LEVELS } from "@shared/types";
import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { requireJob, toJobsRouteError } from "./shared";

export const jobsHumanBridgeRouter = Router();

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const contactFieldsSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  role: nullableText(500),
  linkedinUrl: z.string().trim().url().max(2000).nullable().optional(),
  influenceScore: z.number().int().min(0).max(3).optional(),
  bridgeLevel: z.enum(HUMAN_BRIDGE_LEVELS).optional(),
  bridgeEvidence: nullableText(4000),
  lastContactAt: z.number().int().nonnegative().nullable().optional(),
  outcome: nullableText(2000),
  linkToJob: z.boolean().optional(),
});

const createContactSchema = contactFieldsSchema.extend({
  name: z.string().trim().min(1).max(300),
});

const updateContactSchema = contactFieldsSchema;

function requireBridgeEvidence(input: {
  influenceScore: number;
  bridgeLevel: (typeof HUMAN_BRIDGE_LEVELS)[number];
  bridgeEvidence: string | null;
}) {
  if (
    (input.influenceScore > 0 || input.bridgeLevel !== "B0") &&
    !input.bridgeEvidence?.trim()
  ) {
    throw badRequest(
      "Influence above 0 or Bridge above B0 requires supporting evidence",
    );
  }
}

jobsHumanBridgeRouter.get(
  "/:id/human-bridge",
  async (req: Request, res: Response) => {
    try {
      const job = await requireJob(req.params.id);
      ok(
        res,
        await humanBridgeRepo.getJobHumanBridgeContext(job.id, job.employer),
      );
    } catch (error) {
      fail(res, toJobsRouteError(error));
    }
  },
);

jobsHumanBridgeRouter.post(
  "/:id/human-bridge/contacts",
  async (req: Request, res: Response) => {
    try {
      const job = await requireJob(req.params.id);
      const input = createContactSchema.parse(req.body);
      requireBridgeEvidence({
        influenceScore: input.influenceScore ?? 0,
        bridgeLevel: input.bridgeLevel ?? "B0",
        bridgeEvidence: input.bridgeEvidence ?? null,
      });
      ok(
        res,
        await humanBridgeRepo.createHumanBridgeContact(
          job.id,
          job.employer,
          input,
        ),
      );
    } catch (error) {
      fail(res, toJobsRouteError(error));
    }
  },
);

jobsHumanBridgeRouter.patch(
  "/:id/human-bridge/contacts/:contactId",
  async (req: Request, res: Response) => {
    try {
      const job = await requireJob(req.params.id);
      const input = updateContactSchema.parse(req.body);
      const context = await humanBridgeRepo.getJobHumanBridgeContext(
        job.id,
        job.employer,
      );
      const current = context.contacts.find(
        (contact) => contact.id === req.params.contactId,
      );
      if (!current) throw badRequest("Human Bridge contact not found");

      requireBridgeEvidence({
        influenceScore: input.influenceScore ?? current.influenceScore,
        bridgeLevel: input.bridgeLevel ?? current.bridgeLevel,
        bridgeEvidence:
          input.bridgeEvidence === undefined
            ? current.bridgeEvidence
            : input.bridgeEvidence,
      });

      const updated = await humanBridgeRepo.updateHumanBridgeContact(
        job.id,
        job.employer,
        current.id,
        input,
      );
      if (!updated) throw badRequest("Human Bridge contact update failed");
      ok(res, updated);
    } catch (error) {
      fail(res, toJobsRouteError(error));
    }
  },
);
