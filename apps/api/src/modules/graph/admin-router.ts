import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  GraphAdminScopeQuerySchema,
  GraphCompanyNodeInputSchema,
  GraphCompanySearchQuerySchema,
  GraphEdgeInputSchema,
  GraphEdgeKindInputSchema,
  GraphEdgeUpdateSchema,
  GraphFindQuerySchema,
  GraphLayerInputSchema,
  GraphLayerUpdateSchema,
  GraphNodeMoveSchema,
  GraphNodeReorderSchema,
  GraphRootLayoutUpdateSchema,
  GraphSeedIndustriesInputSchema,
  type GraphAdminScopeQuery,
  type GraphCompanyNodeInput,
  type GraphCompanySearchQuery,
  type GraphEdgeInput,
  type GraphEdgeKindInput,
  type GraphEdgeUpdate,
  type GraphFindQuery,
  type GraphLayerInput,
  type GraphLayerUpdate,
  type GraphNodeMove,
  type GraphNodeReorder,
  type GraphRootLayoutUpdate,
  type GraphSeedIndustriesInput,
} from "@b2b/shared";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import {
  addCompanyNode,
  createEdge,
  createEdgeKind,
  createLayer,
  deleteEdge,
  deleteEdgeKind,
  deleteNode,
  findCompanyPlacements,
  loadEdgeKinds,
  loadLayerImpact,
  loadScope,
  moveNode,
  reorderNodes,
  searchCompanyOptions,
  seedIndustryLayers,
  updateEdge,
  updateEdgeKind,
  updateLayer,
  updateRootLayout,
} from "./repository.js";

export const adminGraphRouter = Router();

// Admin sieht den vollstaendigen Graphen, auch nicht freigegebene Firmen.
const ADMIN_OPTIONS = { publicOnly: false } as const;

const IdParam = z.object({ id: z.string().uuid() });
const NumericIdParam = z.object({ id: z.coerce.number().int().positive() });

adminGraphRouter.get(
  "/scope",
  validate(GraphAdminScopeQuerySchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { parent_id } = req.query as unknown as GraphAdminScopeQuery;
    const scope = await loadScope(parent_id ?? null, ADMIN_OPTIONS);
    if (!scope) {
      res.status(404).json({ error: "Ebene nicht gefunden." });
      return;
    }
    res.json(scope);
  })
);

adminGraphRouter.get(
  "/find",
  validate(GraphFindQuerySchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query as unknown as GraphFindQuery;
    res.json(await findCompanyPlacements(q, ADMIN_OPTIONS));
  })
);

adminGraphRouter.get(
  "/companies",
  validate(GraphCompanySearchQuerySchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, parent_id } = req.query as unknown as GraphCompanySearchQuery;
    res.json(await searchCompanyOptions(q, parent_id ?? null));
  })
);

adminGraphRouter.patch(
  "/root-layout",
  validate(GraphRootLayoutUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { layout, radial_industry_group_id } = req.body as GraphRootLayoutUpdate;
    res.json({
      layout: await updateRootLayout(layout, radial_industry_group_id),
    });
  })
);

adminGraphRouter.post(
  "/seed-industries",
  validate(GraphSeedIndustriesInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { parent_id } = req.body as GraphSeedIndustriesInput;
    res.json(await seedIndustryLayers(parent_id));
  })
);

adminGraphRouter.post(
  "/layers",
  validate(GraphLayerInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as GraphLayerInput;
    res.status(201).json(await createLayer(input));
  })
);

adminGraphRouter.patch(
  "/layers/:id",
  validate(IdParam, "params"),
  validate(GraphLayerUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const layer = await updateLayer(
      req.params.id as string,
      req.body as GraphLayerUpdate
    );
    if (!layer) {
      res.status(404).json({ error: "Ebene nicht gefunden." });
      return;
    }
    res.json(layer);
  })
);

adminGraphRouter.get(
  "/layers/:id/impact",
  validate(IdParam, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const impact = await loadLayerImpact(req.params.id as string);
    if (!impact) {
      res.status(404).json({ error: "Ebene nicht gefunden." });
      return;
    }
    res.json(impact);
  })
);

adminGraphRouter.post(
  "/nodes",
  validate(GraphCompanyNodeInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as GraphCompanyNodeInput;
    res.status(201).json(await addCompanyNode(input.parent_id, input.company_id));
  })
);

adminGraphRouter.post(
  "/nodes/:id/move",
  validate(IdParam, "params"),
  validate(GraphNodeMoveSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as GraphNodeMove;
    await moveNode(req.params.id as string, input.parent_id, input.sort_order);
    res.json({ ok: true });
  })
);

adminGraphRouter.post(
  "/nodes/reorder",
  validate(GraphNodeReorderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { node_ids } = req.body as GraphNodeReorder;
    await reorderNodes(node_ids);
    res.json({ ok: true });
  })
);

adminGraphRouter.delete(
  "/nodes/:id",
  validate(IdParam, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await deleteNode(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ error: "Knoten nicht gefunden." });
      return;
    }
    res.json({ ok: true });
  })
);

adminGraphRouter.post(
  "/edges",
  validate(GraphEdgeInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as GraphEdgeInput;
    res.status(201).json(await createEdge(input));
  })
);

adminGraphRouter.patch(
  "/edges/:id",
  validate(IdParam, "params"),
  validate(GraphEdgeUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const edge = await updateEdge(
      req.params.id as string,
      req.body as GraphEdgeUpdate
    );
    if (!edge) {
      res.status(404).json({ error: "Verbindung nicht gefunden." });
      return;
    }
    res.json(edge);
  })
);

adminGraphRouter.delete(
  "/edges/:id",
  validate(IdParam, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await deleteEdge(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ error: "Verbindung nicht gefunden." });
      return;
    }
    res.json({ ok: true });
  })
);

adminGraphRouter.get(
  "/edge-kinds",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await loadEdgeKinds());
  })
);

adminGraphRouter.post(
  "/edge-kinds",
  validate(GraphEdgeKindInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await createEdgeKind(req.body as GraphEdgeKindInput));
  })
);

adminGraphRouter.patch(
  "/edge-kinds/:id",
  validate(NumericIdParam, "params"),
  validate(GraphEdgeKindInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const kind = await updateEdgeKind(
      Number(req.params.id),
      req.body as GraphEdgeKindInput
    );
    if (!kind) {
      res.status(404).json({ error: "Verbindungstyp nicht gefunden." });
      return;
    }
    res.json(kind);
  })
);

adminGraphRouter.delete(
  "/edge-kinds/:id",
  validate(NumericIdParam, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await deleteEdgeKind(Number(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: "Verbindungstyp nicht gefunden." });
      return;
    }
    res.json({ ok: true });
  })
);
