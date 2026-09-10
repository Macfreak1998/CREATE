import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  FeedbackUpdateSchema,
  type FeedbackEntry,
  type FeedbackList,
  type FeedbackUpdateInput,
} from "@b2b/shared";
import { query } from "../../db/client.js";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";

export const adminFeedbackRouter = Router();

const ListQuerySchema = z.object({
  handled: z
    .union([z.literal("true"), z.literal("false"), z.literal("")])
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : null)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

interface FeedbackRow {
  id: string;
  email: string;
  message: string;
  handled: boolean;
  created_at: Date;
}

function rowToEntry(row: FeedbackRow): FeedbackEntry {
  return {
    id: row.id,
    email: row.email,
    message: row.message,
    handled: row.handled,
    created_at: row.created_at.toISOString(),
  };
}

adminFeedbackRouter.get(
  "/",
  validate(ListQuerySchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as z.infer<typeof ListQuerySchema>;
    const offset = (q.page - 1) * q.limit;
    const handled = q.handled;

    const items = await query<FeedbackRow>(
      `SELECT id, email, message, handled, created_at
         FROM feedback
        WHERE ($1::bool IS NULL OR handled = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [handled, q.limit, offset]
    );
    const total = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
         FROM feedback
        WHERE ($1::bool IS NULL OR handled = $1)`,
      [handled]
    );

    const payload: FeedbackList = {
      items: items.rows.map(rowToEntry),
      total: Number.parseInt(total.rows[0]?.total ?? "0", 10),
      page: q.page,
      limit: q.limit,
    };
    res.json(payload);
  })
);

adminFeedbackRouter.patch(
  "/:id",
  validate(FeedbackUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const input = req.body as FeedbackUpdateInput;
    const result = await query<FeedbackRow>(
      `UPDATE feedback
          SET handled = $2
        WHERE id = $1
        RETURNING id, email, message, handled, created_at`,
      [id, input.handled]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: "Feedback nicht gefunden." });
      return;
    }
    res.json(rowToEntry(row));
  })
);

adminFeedbackRouter.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const result = await query("DELETE FROM feedback WHERE id = $1", [
      req.params.id,
    ]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Feedback nicht gefunden." });
      return;
    }
    res.json({ ok: true });
  })
);
