import type { Request, Response, NextFunction } from 'express';
import { getTenantPool } from '../db.js';
import {
  hydrateAuthUser,
  hasPermission,
  verifyToken,
  type AuthUser,
} from '../services/authService.js';

/**
 * Rota parametreleri her zaman tekil string'tir; Express 5 tiplerindeki
 * `string | string[]` birleşimi rotalarımızda geçerli değildir.
 */
export type AuthedRequest = Request<Record<string, string>> & {
  auth?: AuthUser;
  tenantPool?: ReturnType<typeof getTenantPool>;
};

/** Opsiyonel servis anahtarı (sunucu-sunucu / eski push uçları) */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = process.env.API_KEY;
  if (!configuredKey) {
    next();
    return;
  }

  const provided = req.header('X-API-Key');
  if (provided !== configuredKey) {
    res.status(401).json({ error: 'Geçersiz API anahtarı' });
    return;
  }

  next();
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Oturum gerekli' });
      return;
    }

    const token = header.slice('Bearer '.length);
    const partial = verifyToken(token);
    const auth = await hydrateAuthUser(partial);
    req.auth = auth;
    req.tenantPool = getTenantPool(auth.dbName);
    next();
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Oturum geçersiz',
    });
  }
}

export function requirePermission(permission: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Oturum gerekli' });
      return;
    }
    if (!hasPermission(req.auth, permission)) {
      res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
      return;
    }
    next();
  };
}
