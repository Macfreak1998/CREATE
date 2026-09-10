import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { AnalyticsDwellSchema, AnalyticsPageviewSchema } from "@b2b/shared";
import { query } from "../../db/client.js";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";

export const analyticsRouter = Router();

const analyticsLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

analyticsRouter.use(analyticsLimiter);

analyticsRouter.post(
  "/pageview",
  validate(AnalyticsPageviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as import("@b2b/shared").AnalyticsPageviewInput;
    const path = input.path.trim();
    if (!path || path.startsWith("/admin")) {
      res.json({ ok: true });
      return;
    }

    let companyId: string | null = input.company_id ?? null;
    if (!companyId && input.company_slug) {
      const found = await query<{ id: string }>(
        `SELECT id FROM companies
          WHERE slug = $1 AND status = 'approved'
          LIMIT 1`,
        [input.company_slug]
      );
      companyId = found.rows[0]?.id ?? null;
    }

    await query(
      `INSERT INTO analytics_pageviews (path, company_id)
       VALUES ($1, $2)`,
      [path.slice(0, 500), companyId]
    );
    res.json({ ok: true });
  })
);

analyticsRouter.post(
  "/dwell",
  validate(AnalyticsDwellSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as import("@b2b/shared").AnalyticsDwellInput;
    const seconds = Math.floor(input.seconds);
    if (seconds < 1) {
      res.json({ ok: true });
      return;
    }
    await query(
      `INSERT INTO analytics_dwell (seconds) VALUES ($1)`,
      [Math.min(seconds, 3600)]
    );
    res.json({ ok: true });
  })
);
