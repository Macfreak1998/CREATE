import type { NextFunction, Request, Response } from "express";
import { query } from "../db/client.js";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  type SessionPayload,
  verifySession,
} from "../lib/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    session?: SessionPayload;
  }
}

export async function attachSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token: string | undefined = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    next();
    return;
  }
  const session = verifySession(token);
  if (!session) {
    next();
    return;
  }

  // Token gegen aktuelle token_version pruefen, damit Sessions nach
  // Passwort-Reset zuverlaessig invalidiert werden.
  try {
    const result = await query<{ token_version: number }>(
      "SELECT token_version FROM users WHERE id = $1",
      [session.sub]
    );
    const row = result.rows[0];
    if (!row || row.token_version !== session.tv) {
      res.clearCookie(SESSION_COOKIE_NAME, {
        ...sessionCookieOptions(),
        maxAge: 0,
      });
      next();
      return;
    }
    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session) {
    res.status(401).json({ error: "Nicht angemeldet." });
    return;
  }
  next();
}
