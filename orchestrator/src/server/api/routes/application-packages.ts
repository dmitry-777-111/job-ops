import { notFound, toAppError } from "@infra/errors";
import { fail, ok } from "@infra/http";
import { getCandidateMarketPostingLiveContext } from "@server/repositories/market-inventory";
import {
  approveApplicationPackage,
  evaluateStoredApplicationPackageQa,
} from "@server/services/application-package-approval";
import { prepareApplicationPackageDraft } from "@server/services/application-package-draft";
import { exportApplicationPackage } from "@server/services/application-package-export";
import {
  getApplicationPackageJobFlow,
  prepareApplicationPackageForJob,
} from "@server/services/application-package-job-flow";
import { deriveApplicationVacancyLiveGate } from "@server/services/application-package-live-gate";
import { getApplicationPackageReview } from "@server/services/application-package-review";
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

applicationPackagesRouter.post(
  "/postings/:marketPostingId/prepare",
  async (req: Request, res: Response) => {
    try {
      const result = await prepareApplicationPackageDraft({
        marketPostingId: req.params.marketPostingId,
        acknowledgeUnknownLiveState:
          req.body?.acknowledgeUnknownLiveState === true,
      });
      ok(res, result, 201);
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

applicationPackagesRouter.get(
  "/:applicationPackageId/qa",
  async (req: Request, res: Response) => {
    try {
      const result = await evaluateStoredApplicationPackageQa({
        applicationPackageId: req.params.applicationPackageId,
        acknowledgeUnknownLiveState:
          req.query.acknowledgeUnknownLiveState === "true",
      });
      ok(res, result);
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

applicationPackagesRouter.post(
  "/:applicationPackageId/approve",
  async (req: Request, res: Response) => {
    try {
      const result = await approveApplicationPackage({
        applicationPackageId: req.params.applicationPackageId,
        acknowledgeUnknownLiveState:
          req.body?.acknowledgeUnknownLiveState === true,
      });
      ok(res, result);
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

applicationPackagesRouter.get(
  "/:applicationPackageId/review",
  async (req: Request, res: Response) => {
    try {
      const result = await getApplicationPackageReview({
        applicationPackageId: req.params.applicationPackageId,
        acknowledgeUnknownLiveState:
          req.query.acknowledgeUnknownLiveState === "true",
      });
      ok(res, result);
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

applicationPackagesRouter.get(
  "/jobs/:legacyJobId",
  async (req: Request, res: Response) => {
    try {
      ok(
        res,
        await getApplicationPackageJobFlow({
          legacyJobId: req.params.legacyJobId,
        }),
      );
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

applicationPackagesRouter.post(
  "/jobs/:legacyJobId/prepare",
  async (req: Request, res: Response) => {
    try {
      const result = await prepareApplicationPackageForJob({
        legacyJobId: req.params.legacyJobId,
        acknowledgeUnknownLiveState:
          req.body?.acknowledgeUnknownLiveState === true,
      });
      ok(res, result, 201);
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);

applicationPackagesRouter.post(
  "/:applicationPackageId/export",
  async (req: Request, res: Response) => {
    try {
      const result = await exportApplicationPackage({
        applicationPackageId: req.params.applicationPackageId,
        acknowledgeUnknownLiveState:
          req.body?.acknowledgeUnknownLiveState === true,
      });
      ok(res, result);
    } catch (error) {
      fail(res, toAppError(error));
    }
  },
);
