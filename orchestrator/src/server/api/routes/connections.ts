import { notFound } from "@server/infra/errors";
import { asyncRoute } from "@server/infra/http";
import {
  disconnectExternalConnection,
  listExternalConnections,
} from "@server/repositories/external-connections";
import { listExternalConnectionProviders } from "@server/services/external-connections";
import { type Request, type Response, Router } from "express";

export const connectionsRouter = Router();

connectionsRouter.get(
  "/providers",
  asyncRoute(async (_req: Request, res: Response) => {
    res.json({ providers: listExternalConnectionProviders() });
  }),
);

connectionsRouter.get(
  "/",
  asyncRoute(async (_req: Request, res: Response) => {
    const connections = await listExternalConnections();
    // Summaries deliberately contain no token/password/cookie fields.
    res.json({ connections });
  }),
);

connectionsRouter.delete(
  "/:connectionId",
  asyncRoute(async (req: Request, res: Response) => {
    const connection = await disconnectExternalConnection(
      String(req.params.connectionId),
    );
    if (!connection) throw notFound("Connection not found.");
    res.json({ connection });
  }),
);
