import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodError, ZodType, output as ZodOutput } from 'zod';

export type ValidatedRequest<T> = Request & { valid?: T };

function firstIssue(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Geçersiz istek';
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

/**
 * Body'yi zod ile doğrular ve sonucu req.valid'e yazar.
 * Rota içinde `validated<T>(req)` ile tipli olarak okunur.
 */
export function validateBody<S extends ZodType>(schema: S): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: firstIssue(result.error) });
      return;
    }
    (req as ValidatedRequest<ZodOutput<S>>).valid = result.data;
    next();
  };
}

/** Query string doğrulaması — doğrulanmış değer req.valid'e yazılır. */
export function validateQuery<S extends ZodType>(schema: S): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({ error: firstIssue(result.error) });
      return;
    }
    (req as ValidatedRequest<ZodOutput<S>>).valid = result.data;
    next();
  };
}

export function validated<T>(req: Request): T {
  return (req as ValidatedRequest<T>).valid as T;
}

/**
 * Async rota hatalarını merkezî error handler'a aktarır;
 * aksi halde Express 4'te yakalanmamış promise reddi olurdu.
 */
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };
}
