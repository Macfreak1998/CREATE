import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, "API bereit");
});

let shuttingDown = false;

function shutdown(signal: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Server wird beendet");
  server.close(() => process.exit(exitCode));
  setTimeout(() => process.exit(exitCode || 1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Sicherheitsnetz: Async-Fehler aus Handlern landen seit Node 15 sonst als
// unhandledRejection -> Prozess crasht. Mit den Routen-Wrappern (asyncHandler)
// sollte das nicht mehr passieren; falls doch (z. B. fire-and-forget Promises),
// loggen wir und halten den Server am Leben.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandledRejection");
});

// uncaughtException kann den Prozess in einen inkonsistenten Zustand bringen.
// Wir loggen, fahren aber kontrolliert herunter, damit der Container-
// Orchestrator (oder im Dev tsx watch nach Dateiaenderung) sauber neu starten kann.
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaughtException - Server wird beendet");
  shutdown("uncaughtException", 1);
});
