import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

// Express 4 leitet Promise-Rejections aus async-Handlern nicht automatisch
// an den Error-Handler weiter; ohne Wrapper crasht der Node-Prozess als
// unhandledRejection. Dieser Helper faengt Rejections ein und reicht sie
// per next(err) an den globalen Error-Handler in app.ts weiter.
export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
