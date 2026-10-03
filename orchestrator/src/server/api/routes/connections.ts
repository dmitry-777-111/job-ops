import { notFound } from "@server/infra/errors";
import { asyncHandler } from "@server/infra/http";
import {
  disconnectExternalConnection,
  listExternalConnections,
} from "@server/repositories/external-connections";
import { listExternalConnectionProviders } from "@server/services/external-connections";
import { Router } from "express";

export const connectionsRouter = Router();

connectionsRouter.get(
  "/providers",
  asyncHandler(async (_req, res) => {
    res.json({ providers: listExternalConnectionProviders() });
  }),
);

connectionsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const connections = await listExternalConnections();
    // Summaries deliberately contain no token/password/cookie fields.
    res.json({ connections });
  }),
);

connectionsRouter.delete(
  "/:connectionId",
  asyncHandler(async (req, res) => {
    const connection = await disconnectExternalConnection(
      String(req.params.connectionId),
    );
    if (!connection) throw notFound("Connection not found.");
    res.json({ connection });
  }),
);
