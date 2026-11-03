import { Router, type Request, type Response } from "express";
import {
  GraphFindQuerySchema,
  GraphScopeQuerySchema,
  type GraphFindQuery,
  type GraphScopeQuery,
} from "@b2b/shared";
import { requireAuth } from "../../middlewares/auth.js";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { requireRole } from "../../middlewares/require-role.js";
import { validate } from "../../middlewares/validate.js";
import {
  findCompanyPlacements,
  loadEdgeKinds,
  loadScope,
  resolveLayerPath,
} from "./repository.js";

export const graphRouter = Router();

graphRouter.use(requireAuth, requireRole("admin"));

export function splitLayerPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

graphRouter.get(
  "/scope",
  validate(GraphScopeQuerySchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { path, include_unpublished } = req.query as unknown as GraphScopeQuery;
    const segments = splitLayerPath(path);

    const breadcrumb = await resolveLayerPath(segments);
    if (breadcrumb === null) {
      res.status(404).json({ error: "Ebene nicht gefunden." });
      return;
    }

    const layerId = breadcrumb.at(-1)?.id ?? null;
    const scope = await loadScope(layerId, {
      publicOnly: !include_unpublished,
    });
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
    const { q, include_unpublished } = req.query as unknown as GraphFindQuery;
    res.json(
      await findCompanyPlacements(q, { publicOnly: !include_unpublished })
    );
  })
);
