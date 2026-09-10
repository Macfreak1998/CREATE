import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";

type Source = "body" | "query" | "params";

export function validate<S extends z.ZodTypeAny>(schema: S, source: Source = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(400).json({
        error: "Validierungsfehler.",
        details: result.error.flatten(),
      });
      return;
    }
    req[source] = result.data as unknown as Request[typeof source];
    next();
  };
}
