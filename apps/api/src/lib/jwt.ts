import jwt from "jsonwebtoken";
import { config } from "./config.js";

export interface SessionPayload {
  sub: string;
  role: "company" | "admin";
  company_id: string | null;
  // Token-Version: wird beim Passwort-Reset hochgezaehlt, sodass alle alten
  // JWTs verworfen werden. Bei aelteren Tokens ohne Feld nehmen wir 0 an.
  tv: number;
}

const EXPIRES_IN = "7d";

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;
    if (
      typeof decoded.sub !== "string" ||
      (decoded.role !== "company" && decoded.role !== "admin")
    ) {
      return null;
    }
    return {
      sub: decoded.sub,
      role: decoded.role,
      company_id:
        typeof decoded.company_id === "string" ? decoded.company_id : null,
      tv: typeof decoded.tv === "number" ? decoded.tv : 0,
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "b2b_session";

export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  domain?: string;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.COOKIE_SECURE,
    domain: config.COOKIE_DOMAIN,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}
