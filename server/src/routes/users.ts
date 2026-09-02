import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { controlPool } from '../db.js';
import {
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from '../middleware/auth.js';
import { asyncHandler, validateBody, validated } from '../middleware/validate.js';
import { writeAuditLog } from '../services/auditLog.js';

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

      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        res.status(400).json({
          error: 'Şifre en az 8 karakter olmalı; en az bir harf ve bir rakam içermelidir',
        });
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

const updateUserSchema = z.object({
  displayName: z.string().trim().min(1, 'displayName boş olamaz').max(200).optional(),
  canMessageAdmins: z.boolean().optional(),
  isActive: z.boolean().optional(),
  personnelId: z.string().trim().min(1).nullable().optional(),
});

usersRouter.patch(
  '/:id',
  requirePermission('users.manage'),
  validateBody(updateUserSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = validated<z.infer<typeof updateUserSchema>>(req);
    const pool = req.tenantPool!;

    const existing = await pool.query(`SELECT * FROM users WHERE id = $1`, [req.params.id]);
    if (!existing.rowCount) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }
    const current = existing.rows[0];

    // Son kurum yöneticisi pasife alınamaz — kuruma erişim tamamen kaybolur.
    if (input.isActive === false && current.role === 'INSTITUTION_ADMIN') {
      const remaining = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users
          WHERE role = 'INSTITUTION_ADMIN' AND is_active = TRUE AND id <> $1`,
        [req.params.id],
      );
      if (Number(remaining.rows[0]?.count ?? 0) === 0) {
        res.status(400).json({ error: 'Son kurum yöneticisi pasife alınamaz' });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE users SET
         display_name = $1,
         can_message_admins = $2,
         is_active = $3,
         personnel_id = $4,
         updated_at = NOW()
       WHERE id = $5
       RETURNING id, personnel_id, display_name, email, role, can_message_admins, is_active, created_at`,
      [
        input.displayName ?? current.display_name,
        input.canMessageAdmins ?? current.can_message_admins,
        input.isActive ?? current.is_active,
        input.personnelId === undefined ? current.personnel_id : input.personnelId,
        req.params.id,
      ],
    );

    // Control DB'deki hesap kaydı ile senkron tut (login bilgileri oradan okunur).
    if (input.displayName !== undefined || input.isActive !== undefined) {
      await controlPool.query(
        `UPDATE tenant_accounts SET
           display_name = COALESCE($1, display_name),
           is_active = COALESCE($2, is_active),
           updated_at = NOW()
         WHERE tenant_id = $3 AND tenant_user_id = $4`,
        [
          input.displayName ?? null,
          input.isActive ?? null,
          req.auth!.tenantId,
          req.params.id,
        ],
      );
    }

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'user.update',
      entityType: 'user',
      entityId: req.params.id,
      details: input,
    });

    res.json(result.rows[0]);
  }),
);

usersRouter.get(
  '/:id/grants',
  requirePermission('users.manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query(
      `SELECT g.*, u.name AS unit_name
         FROM user_grants g
         LEFT JOIN units u ON u.id = g.unit_id
        WHERE g.user_id = $1
        ORDER BY g.permission`,
      [req.params.id],
    );
    res.json(result.rows);
  }),
);

const grantSchema = z.object({
  permission: z.string().trim().min(1, 'permission zorunludur').max(100),
  unitId: z.string().trim().min(1).nullable().optional(),
});

usersRouter.post(
  '/:id/grants',
  requirePermission('users.manage'),
  validateBody(grantSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = validated<z.infer<typeof grantSchema>>(req);
    const pool = req.tenantPool!;

    const user = await pool.query(`SELECT id FROM users WHERE id = $1`, [req.params.id]);
    if (!user.rowCount) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }

    if (input.unitId) {
      const unit = await pool.query(`SELECT id FROM units WHERE id = $1`, [input.unitId]);
      if (!unit.rowCount) {
        res.status(404).json({ error: 'Birim bulunamadı' });
        return;
      }
    }

    const existing = await pool.query(
      `SELECT * FROM user_grants
        WHERE user_id = $1 AND permission = $2 AND COALESCE(unit_id, '') = COALESCE($3, '')`,
      [req.params.id, input.permission, input.unitId ?? null],
    );
    if (existing.rowCount) {
      res.json(existing.rows[0]);
      return;
    }

    const result = await pool.query(
      `INSERT INTO user_grants (id, user_id, permission, unit_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [randomUUID(), req.params.id, input.permission, input.unitId ?? null],
    );

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'user.grant_add',
      entityType: 'user',
      entityId: req.params.id,
      details: input,
    });

    res.status(201).json(result.rows[0]);
  }),
);

usersRouter.delete(
  '/:id/grants/:grantId',
  requirePermission('users.manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const pool = req.tenantPool!;
    const result = await pool.query(
      `DELETE FROM user_grants WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.grantId, req.params.id],
    );

    if (!result.rowCount) {
      res.status(404).json({ error: 'Yetki kaydı bulunamadı' });
      return;
    }

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'user.grant_remove',
      entityType: 'user',
      entityId: req.params.id,
      details: { permission: result.rows[0].permission, unitId: result.rows[0].unit_id },
    });

    res.json({ ok: true, id: req.params.grantId });
  }),
);
