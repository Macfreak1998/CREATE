import { Router, type Request, type Response } from "express";
import { query } from "../../db/client.js";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { listTechnologies, listTechnologyGroups } from "./technologies.js";
import { listIndustries, listIndustryGroups } from "./industries.js";

function makeSimpleRouter(table: "machines" | "knowhows"): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      const result = await query<{ id: number; slug: string; name: string }>(
        `SELECT id, slug, name FROM ${table} ORDER BY name`
      );
      res.json(result.rows);
    })
  );
  return router;
}

function makeCompanySizesRouter(): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      const result = await query<{
        id: number;
        slug: string;
        name: string;
        sort_order: number;
      }>(`SELECT id, slug, name, sort_order FROM company_sizes ORDER BY sort_order, name`);
      res.json(result.rows);
    })
  );
  return router;
}

function makeTechnologiesRouter(): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(await listTechnologies());
    })
  );
  return router;
}

function makeTechnologyGroupsRouter(): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(await listTechnologyGroups());
    })
  );
  return router;
}

function makeIndustriesRouter(): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(await listIndustries());
    })
  );
  return router;
}

function makeIndustryGroupsRouter(): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(await listIndustryGroups());
    })
  );
  return router;
}

export const taxonomiesRouter = {
  technologies: makeTechnologiesRouter(),
  technologyGroups: makeTechnologyGroupsRouter(),
  machines: makeSimpleRouter("machines"),
  industries: makeIndustriesRouter(),
  industryGroups: makeIndustryGroupsRouter(),
  knowhows: makeSimpleRouter("knowhows"),
  companySizes: makeCompanySizesRouter(),
};
