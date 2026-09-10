import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { attachSession } from "./middlewares/auth.js";
import { authRouter } from "./modules/auth/router.js";
import { companiesRouter } from "./modules/companies/router.js";
import { feedbackRouter } from "./modules/feedback/router.js";
import { meRouter } from "./modules/me/router.js";
import { taxonomiesRouter } from "./modules/taxonomies/router.js";
import { sectionDescriptionsRouter } from "./modules/section-descriptions/router.js";
import { graphRouter } from "./modules/graph/router.js";
import { adminRouter } from "./modules/admin/router.js";
import { analyticsRouter } from "./modules/analytics/router.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser(config.COOKIE_SECRET));
  app.use(pinoHttp({ logger }));
  app.use(attachSession);

  app.use("/uploads", express.static(path.resolve(config.UPLOADS_DIR), {
    fallthrough: false,
    maxAge: "7d",
  }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Limiter nur fuer sensitive Auth-Aktionen. /me wird durch das Frontend
  // permanent gepollt und /logout ist harmlos -> beide ausgenommen, sonst
  // schlaegt der Limiter nach wenigen Page-Loads zu.
  // skipSuccessfulRequests: erfolgreiche Logins/Resets/Registrierungen
  // verbrauchen das Budget nicht; nur fehlgeschlagene Versuche zaehlen.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });
  const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Limiter pfadspezifisch anwenden, damit /me und /logout nicht limitiert sind.
  const RATE_LIMITED_AUTH_PATHS = new Set([
    "/login",
    "/register",
    "/password/request",
    "/password/reset",
  ]);
  app.use(
    "/api/auth",
    (req, res, next) => {
      if (RATE_LIMITED_AUTH_PATHS.has(req.path)) {
        return authLimiter(req, res, next);
      }
      return next();
    },
    authRouter
  );
  app.use("/api/companies", (req, res, next) => {
    if (req.path === "/search") {
      return searchLimiter(req, res, next);
    }
    return next();
  }, companiesRouter);
  app.use("/api/me", meRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use("/api/technologies", taxonomiesRouter.technologies);
  app.use("/api/technology-groups", taxonomiesRouter.technologyGroups);
  app.use("/api/machines", taxonomiesRouter.machines);
  app.use("/api/industries", taxonomiesRouter.industries);
  app.use("/api/industry-groups", taxonomiesRouter.industryGroups);
  app.use("/api/knowhows", taxonomiesRouter.knowhows);
  app.use("/api/company-sizes", taxonomiesRouter.companySizes);
  app.use("/api/section-descriptions", sectionDescriptionsRouter);
  app.use("/api/graph", graphRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/admin", adminRouter);

  app.use((req, res) => {
    res.status(404).json({ error: `Route nicht gefunden: ${req.method} ${req.path}` });
  });

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    req.log.error({ err }, "Unbehandelter Fehler");
    if (res.headersSent) return;
    const status = typeof err?.status === "number" ? err.status : 500;
    res.status(status).json({
      error: err?.message ?? "Interner Serverfehler.",
    });
  };
  app.use(errorHandler);

  return app;
}
