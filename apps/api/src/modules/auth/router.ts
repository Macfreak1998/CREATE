import { randomInt } from "node:crypto";
import { Router, type Request, type Response } from "express";
import {
  LoginSchema,
  MeUserSchema,
  PasswordChangeSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  RegisterSchema,
} from "@b2b/shared";
import { query, withTransaction } from "../../db/client.js";
import { config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import { sendMail } from "../../lib/mailer.js";
import { passwordResetMail } from "../../lib/mail-templates.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  signSession,
} from "../../lib/jwt.js";
import { requireAuth } from "../../middlewares/auth.js";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { notifyAdminPendingCompany } from "../../lib/notifications.js";
import { createCompanyWithUser } from "../companies/repository.js";

// Gueltigkeit eines Einmal-Codes in Minuten.
const RESET_VALID_MINUTES = 30;

export const authRouter = Router();

authRouter.post(
  "/register",
  validate(RegisterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as import("@b2b/shared").RegisterInput;

    const existing = await query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [input.user.email]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(409).json({ error: "E-Mail ist bereits registriert." });
      return;
    }

    const passwordHash = await hashPassword(input.user.password);

    const { companyId, userId } = await withTransaction((client) =>
      createCompanyWithUser(client, {
        company: input.company,
        user: { email: input.user.email, password_hash: passwordHash },
        status: "pending",
      })
    );

    // Fire-and-forget: Mail-Versand soll Registrierung nicht blockieren.
    void notifyAdminPendingCompany({
      companyId,
      companyName: input.company.name,
      contactEmail: input.company.contact_email,
    });

    const token = signSession({
      sub: userId,
      role: "company",
      company_id: companyId,
      tv: 0,
    });
    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    res.status(201).json({ ok: true });
  })
);

authRouter.post(
  "/login",
  validate(LoginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as import("@b2b/shared").LoginInput;

    const result = await query<{
      id: string;
      company_id: string | null;
      password_hash: string;
      role: "company" | "admin";
      token_version: number;
    }>(
      `SELECT id, company_id, password_hash, role, token_version
         FROM users
        WHERE email = $1`,
      [input.email]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ error: "E-Mail oder Passwort ist ungültig." });
      return;
    }

    const ok = await verifyPassword(user.password_hash, input.password);
    if (!ok) {
      res.status(401).json({ error: "E-Mail oder Passwort ist ungültig." });
      return;
    }

    await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);

    const token = signSession({
      sub: user.id,
      role: user.role,
      company_id: user.company_id,
      tv: user.token_version,
    });
    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    res.json({ ok: true });
  })
);

authRouter.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  res.json({ ok: true });
});

authRouter.post(
  "/password/request",
  validate(PasswordResetRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as import("@b2b/shared").PasswordResetRequestInput;

    // Antwort ist immer dieselbe, um User-Enumeration zu verhindern.
    const userResult = await query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    const user = userResult.rows[0];

    if (user) {
      try {
        // Bestehende offene Tokens des Users invalidieren.
        await query(
          `UPDATE password_resets
              SET used_at = now()
            WHERE user_id = $1
              AND used_at IS NULL`,
          [user.id]
        );

        // 6-stelliger Code, fuehrende Nullen zugelassen.
        const codeNumber = randomInt(0, 1_000_000);
        const code = codeNumber.toString().padStart(6, "0");
        const codeHash = await hashPassword(code);

        await query(
          `INSERT INTO password_resets (user_id, code_hash, expires_at)
           VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
          [user.id, codeHash, RESET_VALID_MINUTES.toString()]
        );

        const link =
          `${config.APP_BASE_URL.replace(/\/$/, "")}/passwort-zuruecksetzen` +
          `?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;

        await sendMail(
          await passwordResetMail({
            to: email,
            code,
            link,
            validMinutes: RESET_VALID_MINUTES,
          })
        );
      } catch (err) {
        logger.error({ err }, "Passwort-Reset-Anfrage fehlgeschlagen");
      }
    }

    res.json({ ok: true });
  })
);

authRouter.post(
  "/password/reset",
  validate(PasswordResetConfirmSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as import("@b2b/shared").PasswordResetConfirmInput;

    const userResult = await query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [input.email]
    );
    const user = userResult.rows[0];

    const respondInvalid = () => {
      res.status(400).json({ error: "Code ist ungültig oder abgelaufen." });
    };

    if (!user) {
      respondInvalid();
      return;
    }

    const tokensResult = await query<{ id: string; code_hash: string }>(
      `SELECT id, code_hash
         FROM password_resets
        WHERE user_id = $1
          AND used_at IS NULL
          AND expires_at > now()
        ORDER BY created_at DESC`,
      [user.id]
    );

    let matchedTokenId: string | null = null;
    for (const row of tokensResult.rows) {
      const ok = await verifyPassword(row.code_hash, input.code);
      if (ok) {
        matchedTokenId = row.id;
        break;
      }
    }

    if (!matchedTokenId) {
      respondInvalid();
      return;
    }

    const newHash = await hashPassword(input.password);

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE users
            SET password_hash = $2,
                token_version = token_version + 1
          WHERE id = $1`,
        [user.id, newHash]
      );
      // Genutzten Code als verbraucht markieren und alle anderen offenen
      // Tokens dieses Users in einem Schritt invalidieren.
      await client.query(
        `UPDATE password_resets
            SET used_at = now()
          WHERE user_id = $1
            AND used_at IS NULL`,
        [user.id]
      );
    });

    // Aktuelle Session (falls vorhanden) sicherheitshalber abmelden.
    res.clearCookie(SESSION_COOKIE_NAME, {
      ...sessionCookieOptions(),
      maxAge: 0,
    });

    res.json({ ok: true });
  })
);

authRouter.post(
  "/password/change",
  requireAuth,
  validate(PasswordChangeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as import("@b2b/shared").PasswordChangeInput;
    const session = req.session!;

    const userResult = await query<{
      id: string;
      password_hash: string;
      role: "company" | "admin";
      company_id: string | null;
      token_version: number;
    }>(
      `SELECT id, password_hash, role, company_id, token_version
         FROM users
        WHERE id = $1`,
      [session.sub]
    );
    const user = userResult.rows[0];
    if (!user) {
      res.status(401).json({ error: "Benutzer existiert nicht mehr." });
      return;
    }

    const ok = await verifyPassword(user.password_hash, input.current_password);
    if (!ok) {
      res.status(400).json({ error: "Aktuelles Passwort ist ungültig." });
      return;
    }

    const newHash = await hashPassword(input.new_password);
    const updated = await query<{ token_version: number }>(
      `UPDATE users
          SET password_hash = $2,
              token_version = token_version + 1
        WHERE id = $1
      RETURNING token_version`,
      [user.id, newHash]
    );

    const token = signSession({
      sub: user.id,
      role: user.role,
      company_id: user.company_id,
      tv: updated.rows[0].token_version,
    });
    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    res.json({ ok: true });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const session = req.session!;
    const userResult = await query<{ id: string; email: string; role: "company" | "admin" }>(
      "SELECT id, email, role FROM users WHERE id = $1",
      [session.sub]
    );
    const user = userResult.rows[0];
    if (!user) {
      res.status(401).json({ error: "Benutzer existiert nicht mehr." });
      return;
    }

    let company: {
      id: string;
      slug: string;
      name: string;
      status: "pending" | "approved" | "rejected" | "suspended";
    } | null = null;
    if (session.company_id) {
      const companyResult = await query<{
        id: string;
        slug: string;
        name: string;
        status: "pending" | "approved" | "rejected" | "suspended";
      }>(
        "SELECT id, slug, name, status FROM companies WHERE id = $1",
        [session.company_id]
      );
      company = companyResult.rows[0] ?? null;
    }

    const payload = MeUserSchema.parse({ user, company });
    res.json(payload);
  })
);
