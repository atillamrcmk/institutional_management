import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { controlPool } from '../db.js';
import {
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from '../middleware/auth.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

/**
 * Yetkili veya personel hesabı oluştur / davet et.
 * INSTITUTION_ADMIN veya users.manage gerekir.
 */
usersRouter.post(
  '/invite',
  requirePermission('users.manage'),
  async (req: AuthedRequest, res) => {
    try {
      const {
        displayName,
        email,
        password,
        role = 'UNIT_MANAGER',
        personnelId,
        permissions = [],
        canMessageAdmins = false,
      } = req.body as {
        displayName?: string;
        email?: string;
        password?: string;
        role?: 'INSTITUTION_ADMIN' | 'UNIT_MANAGER' | 'PERSONNEL';
        personnelId?: string | null;
        permissions?: Array<{ permission: string; unitId?: string | null }>;
        canMessageAdmins?: boolean;
      };

      if (!displayName?.trim() || !email?.trim() || !password) {
        res.status(400).json({ error: 'displayName, email ve password zorunludur' });
        return;
      }

      if (role === 'INSTITUTION_ADMIN' && req.auth!.role !== 'INSTITUTION_ADMIN') {
        res.status(403).json({ error: 'Kurum yöneticisi yalnızca owner atayabilir' });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existing = await controlPool.query(
        'SELECT id FROM tenant_accounts WHERE email = $1',
        [normalizedEmail],
      );
      if (existing.rowCount) {
        res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = randomUUID();
      const accountId = randomUUID();
      const pool = req.tenantPool!;

      await pool.query(
        `INSERT INTO users (
          id, personnel_id, display_name, email, role, password_hash, can_message_admins
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          personnelId ?? null,
          displayName.trim(),
          normalizedEmail,
          role,
          passwordHash,
          canMessageAdmins,
        ],
      );

      for (const grant of permissions) {
        await pool.query(
          `INSERT INTO user_grants (id, user_id, permission, unit_id)
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), userId, grant.permission, grant.unitId ?? null],
        );
      }

      // Personel yöneticisine varsayılan grant'ler
      if (role === 'UNIT_MANAGER' && permissions.length === 0) {
        for (const permission of ['personnel.manage', 'presence.view']) {
          await pool.query(
            `INSERT INTO user_grants (id, user_id, permission, unit_id)
             VALUES ($1, $2, $3, NULL)`,
            [randomUUID(), userId, permission],
          );
        }
      }

      await controlPool.query(
        `INSERT INTO tenant_accounts (
          id, tenant_id, email, password_hash, display_name, role, tenant_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          accountId,
          req.auth!.tenantId,
          normalizedEmail,
          passwordHash,
          displayName.trim(),
          role,
          userId,
        ],
      );

      res.status(201).json({
        userId,
        accountId,
        email: normalizedEmail,
        role,
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Davet başarısız',
      });
    }
  },
);

usersRouter.get('/', requirePermission('users.manage'), async (req: AuthedRequest, res) => {
  const result = await req.tenantPool!.query(
    `SELECT id, personnel_id, display_name, email, role, can_message_admins, is_active, created_at
     FROM users
     ORDER BY display_name`,
  );
  res.json(result.rows);
});
