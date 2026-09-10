import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@b2b/shared";

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session) {
      res.status(401).json({ error: "Nicht angemeldet." });
      return;
    }
    if (req.session.role !== role) {
      res.status(403).json({ error: "Zugriff verweigert." });
      return;
    }
    next();
  };
}
