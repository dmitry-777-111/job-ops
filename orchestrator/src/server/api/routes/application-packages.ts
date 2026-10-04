import { notFound, toAppError } from "@infra/errors";
import { fail, ok } from "@infra/http";
import { getCandidateMarketPostingLiveContext } from "@server/repositories/market-inventory";
import { deriveApplicationVacancyLiveGate } from "@server/services/application-package-live-gate";
import { type Request, type Response, Router } from "express";

export const applicationPackagesRouter = Router();

applicationPackagesRouter.get(
  "/postings/:marketPostingId/live-gate",
  async (req: Request, res: Response) => {
    try {
      const context = await getCandidateMarketPostingLiveContext(
        req.params.marketPostingId,
      );
      if (!context) throw notFound("Candidate market posting not found.");

      ok(res, deriveApplicationVacancyLiveGate(context));
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);
