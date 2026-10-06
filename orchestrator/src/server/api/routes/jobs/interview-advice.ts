import { badRequest, toAppError } from "@infra/errors";
import { fail, ok } from "@infra/http";
import { analyzeInterviewEvent } from "@server/services/interview-advice";
import { type Request, type Response, Router } from "express";
import { z } from "zod";

export const jobsInterviewAdviceRouter = Router();

const inputSchema = z.object({
  eventId: z.string().min(1),
});

jobsInterviewAdviceRouter.post(
  "/:id/interview-advice",
  async (req: Request, res: Response) => {
    try {
      const input = inputSchema.parse(req.body);
      ok(res, await analyzeInterviewEvent(req.params.id, input.eventId));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return fail(res, badRequest(error.message, error.flatten()));
      }
      fail(res, toAppError(error));
    }
  },
);
