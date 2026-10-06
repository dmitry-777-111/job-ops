import { Router } from "express";
import { jobsActionsRouter } from "./actions";
import { jobsApplicationRouter } from "./application";
import { jobsDocumentsRouter } from "./documents";
import { jobsEvidenceRouter } from "./evidence";
import { jobsHumanBridgeRouter } from "./human-bridge";
import { jobsImmigrationRouter } from "./immigration";
import { jobsInterviewAdviceRouter } from "./interview-advice";
import { jobsMaintenanceRouter } from "./maintenance";
import { jobsMutationsRouter } from "./mutations";
import { jobsNotesRouter } from "./notes";
import { jobsReadRouter } from "./read";
import { jobsStagesRouter } from "./stages";

export const jobsRouter = Router();

jobsRouter.use(jobsReadRouter);
jobsRouter.use(jobsActionsRouter);
jobsRouter.use(jobsNotesRouter);
jobsRouter.use(jobsStagesRouter);
jobsRouter.use(jobsDocumentsRouter);
jobsRouter.use(jobsEvidenceRouter);
jobsRouter.use(jobsHumanBridgeRouter);
jobsRouter.use(jobsImmigrationRouter);
jobsRouter.use(jobsInterviewAdviceRouter);
jobsRouter.use(jobsApplicationRouter);
jobsRouter.use(jobsMaintenanceRouter);
jobsRouter.use(jobsMutationsRouter);
