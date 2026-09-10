import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { FeedbackInputSchema, type FeedbackInput } from "@b2b/shared";
import { query } from "../../db/client.js";
import { logger } from "../../lib/logger.js";
import { notifyAdminFeedback } from "../../lib/notifications.js";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";

export const feedbackRouter = Router();

// Strenger Limiter: oeffentliches Endpoint, anfaellig fuer Spam.
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

feedbackRouter.post(
  "/",
  feedbackLimiter,
  validate(FeedbackInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as FeedbackInput;

    // Honeypot ausgefuellt: erfolgreich antworten, aber nichts speichern,
    // damit Bots keinen Hinweis auf Erkennung erhalten.
    if (input.website && input.website.trim().length > 0) {
      logger.warn({ ip: req.ip }, "Feedback Honeypot getriggert");
      res.json({ ok: true });
      return;
    }

    const userAgent =
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"].slice(0, 500)
        : null;
    const ip = req.ip ?? null;

    await query(
      `INSERT INTO feedback (email, message, user_agent, ip)
       VALUES ($1, $2, $3, $4::inet)`,
      [input.email, input.message, userAgent, ip]
    );

    void notifyAdminFeedback({
      email: input.email,
      message: input.message,
    });

    res.json({ ok: true });
  })
);
