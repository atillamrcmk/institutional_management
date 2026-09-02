import { randomUUID } from 'node:crypto';
import type { CorsOptions } from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit, type Options as RateLimitOptions } from 'express-rate-limit';

export type RequestWithId = Request & { requestId?: string };

/** Her isteğe izlenebilir bir kimlik ekler ve X-Request-Id başlığıyla döner. */
export function requestId(req: RequestWithId, res: Response, next: NextFunction): void {
  const incoming = req.header('X-Request-Id');
  const id = incoming && incoming.length <= 100 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/**
 * CORS_ORIGINS virgülle ayrılmış liste. Tanımlı değilse veya "*" ise
 * tüm origin'lere izin verilir (geliştirme kolaylığı).
 */
export function corsOptionsFromEnv(): CorsOptions {
  const raw = (process.env.CORS_ORIGINS ?? '*').trim();

  if (!raw || raw === '*') {
    return { origin: true, credentials: true };
  }

  const allowed = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    credentials: true,
    origin(origin, callback) {
      // Origin yoksa (curl, mobil native fetch, server-to-server) izin ver.
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS: ${origin} izinli değil`));
    },
  };
}

const limiterDefaults: Partial<RateLimitOptions> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
};

/** Genel API limiti: dakikada 200 istek / IP. */
export const generalLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60_000,
  limit: Number(process.env.RATE_LIMIT_GENERAL ?? 200),
  message: { error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.' },
});

/** Kimlik doğrulama uçları: 15 dakikada 20 istek / IP. */
export const authLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60_000,
  limit: Number(process.env.RATE_LIMIT_AUTH ?? 20),
  skipSuccessfulRequests: false,
  message: { error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
});

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Kaynak bulunamadı: ${req.method} ${req.path}` });
}

/**
 * Tek hata noktası — stack trace'i asla istemciye sızdırmaz, yalnızca loglar.
 * İstemciye requestId döndürerek log ile eşleştirmeyi mümkün kılar.
 */
export function errorHandler(
  error: unknown,
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const id = req.requestId ?? '-';
  console.error(`[${id}] ${req.method} ${req.originalUrl}`, error);

  if (error instanceof Error && error.message.startsWith('CORS:')) {
    res.status(403).json({ error: 'Bu origin için erişim engellendi', requestId: id });
    return;
  }

  const status =
    typeof (error as { status?: unknown })?.status === 'number'
      ? ((error as { status: number }).status)
      : 500;

  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: status === 500 ? 'Sunucu hatası' : (error as Error).message,
    requestId: id,
  });
}
