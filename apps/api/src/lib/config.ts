import "dotenv/config";
import { z } from "zod";

// Leere Strings (z. B. SMTP_PORT= in einer .env) sind technisch "gesetzt" und
// verhindern dadurch das Greifen von .default(). Wir behandeln sie als
// undefined, damit numerische Defaults zuverlaessig greifen.
const optionalPort = (fallback: number) =>
  z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.coerce.number().int().positive().optional()
    )
    .transform((v) => v ?? fallback);

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: optionalPort(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  COOKIE_SECRET: z.string().min(16),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  UPLOADS_DIR: z.string().default("/app/uploads"),
  PUBLIC_UPLOADS_BASE_URL: z.string().default("http://localhost:4000/uploads"),
  APP_BASE_URL: z.string().url().default("http://localhost:5173"),
  SMTP_HOST: z.string().default("mailpit"),
  SMTP_PORT: optionalPort(1025),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  SMTP_PASSWORD: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  MAIL_FROM: z
    .string()
    .default("CREATE <noreply@create-cluster.local>"),
});

const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Ungültige Konfiguration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type AppConfig = typeof config;
