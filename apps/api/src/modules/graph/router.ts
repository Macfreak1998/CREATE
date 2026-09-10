import { Router, type Request, type Response } from "express";
import {
  GraphFindQuerySchema,
  GraphScopeQuerySchema,
  type GraphFindQuery,
  type GraphScopeQuery,
} from "@b2b/shared";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import {
  findCompanyPlacements,
  loadEdgeKinds,
  loadScope,
  resolveLayerPath,
} from "./repository.js";

export const graphRouter = Router();

export function splitLayerPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

// Oeffentliche Sicht: nur freigegebene Firmen, deren Kanten werden in
// loadScope zusammen mit ihnen ausgefiltert.
const PUBLIC_OPTIONS = { publicOnly: true } as const;

graphRouter.get(
  "/scope",
  validate(GraphScopeQuerySchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { path } = req.query as unknown as GraphScopeQuery;
    const segments = splitLayerPath(path);

    const breadcrumb = await resolveLayerPath(segments);
    if (breadcrumb === null) {
      res.status(404).json({ error: "Ebene nicht gefunden." });
      return;
    }

    const layerId = breadcrumb.at(-1)?.id ?? null;
    const scope = await loadScope(layerId, PUBLIC_OPTIONS);
    if (!scope) {
      res.status(404).json({ error: "Ebene nicht gefunden." });
      return;
    }
    res.json(scope);
  })
);

graphRouter.get(
  "/edge-kinds",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await loadEdgeKinds());
  })
);

graphRouter.get(
  "/find",
  validate(GraphFindQuerySchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query as unknown as GraphFindQuery;
    res.json(await findCompanyPlacements(q, PUBLIC_OPTIONS));
  })
);
