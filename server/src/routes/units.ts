import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from '../middleware/auth.js';
import { asyncHandler, validateBody, validated } from '../middleware/validate.js';
import { writeAuditLog } from '../services/auditLog.js';

export const unitsRouter = Router();

unitsRouter.use(requireAuth);

const TIME = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm biçiminde olmalı');

const createUnitSchema = z.object({
  name: z.string().trim().min(1, 'Birim adı zorunludur').max(200),
  parentId: z.string().trim().min(1).nullable().optional(),
  minimumStaff: z.number().int().min(0).max(10_000).optional(),
  managerPersonnelId: z.string().trim().min(1).nullable().optional(),
  workScheduleType: z.enum(['OFFICE', 'SHIFT']).optional(),
  officeStartTime: TIME.nullable().optional(),
  officeEndTime: TIME.nullable().optional(),
});

const updateUnitSchema = createUnitSchema.partial();

const assignPersonnelSchema = z.object({
  personnelId: z.string().trim().min(1, 'personnelId zorunludur'),
  /** true ise personel önceki biriminden çıkarılıp bu birime taşınır */
  move: z.boolean().optional(),
});

// --- Özel yollar /:id'den ÖNCE tanımlanmalı --------------------------------

/** Hiçbir birime bağlı olmayan aktif personel. */
unitsRouter.get(
  '/unassigned',
  asyncHandler(async (req: AuthedRequest, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const params: unknown[] = [];
    let filter = '';

    if (q) {
      params.push(`%${q}%`);
      filter = `AND (
        p.first_name ILIKE $1 OR p.last_name ILIKE $1 OR p.sicil_no ILIKE $1
        OR (p.first_name || ' ' || p.last_name) ILIKE $1
      )`;
    }

    const result = await req.tenantPool!.query(
      `SELECT p.* FROM personnel p
        WHERE p.status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM personnel_unit_history puh
             WHERE puh.personnel_id = p.id AND puh.ended_at IS NULL
          )
          ${filter}
        ORDER BY p.last_name, p.first_name`,
      params,
    );

    res.json(result.rows);
  }),
);

/** Bir personelin hâlihazırda bağlı olduğu birim. */
unitsRouter.get(
  '/personnel/:personnelId/current',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query(
      `SELECT u.* FROM personnel_unit_history puh
         INNER JOIN units u ON u.id = puh.unit_id
        WHERE puh.personnel_id = $1 AND puh.ended_at IS NULL
        ORDER BY puh.started_at DESC
        LIMIT 1`,
      [req.params.personnelId],
    );
    res.json(result.rows[0] ?? null);
  }),
);

// --- CRUD -------------------------------------------------------------------

unitsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { parentId } = req.query;

    if (parentId === 'root' || parentId === 'null') {
      const result = await req.tenantPool!.query(
        `SELECT * FROM units WHERE parent_id IS NULL ORDER BY name`,
      );
      res.json(result.rows);
      return;
    }

    if (typeof parentId === 'string' && parentId) {
      const result = await req.tenantPool!.query(
        `SELECT * FROM units WHERE parent_id = $1 ORDER BY name`,
        [parentId],
      );
      res.json(result.rows);
      return;
    }

    const result = await req.tenantPool!.query(`SELECT * FROM units ORDER BY name`);
    res.json(result.rows);
  }),
);

unitsRouter.post(
  '/',
  requirePermission('units.manage'),
  validateBody(createUnitSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = validated<z.infer<typeof createUnitSchema>>(req);
    const pool = req.tenantPool!;
    const id = randomUUID();

    const result = await pool.query(
      `INSERT INTO units (
         id, parent_id, name, minimum_staff, manager_personnel_id,
         work_schedule_type, office_start_time, office_end_time
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        input.parentId ?? null,
        input.name,
        input.minimumStaff ?? 0,
        input.managerPersonnelId ?? null,
        input.workScheduleType ?? 'OFFICE',
        input.officeStartTime ?? '08:00',
        input.officeEndTime ?? '17:00',
      ],
    );

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'unit.create',
      entityType: 'unit',
      entityId: id,
      details: { name: input.name },
    });

    res.status(201).json(result.rows[0]);
  }),
);

unitsRouter.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query(`SELECT * FROM units WHERE id = $1`, [
      req.params.id,
    ]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Birim bulunamadı' });
      return;
    }
    res.json(result.rows[0]);
  }),
);

unitsRouter.patch(
  '/:id',
  requirePermission('units.manage'),
  validateBody(updateUnitSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = validated<z.infer<typeof updateUnitSchema>>(req);
    const pool = req.tenantPool!;

    const existing = await pool.query(`SELECT * FROM units WHERE id = $1`, [req.params.id]);
    if (!existing.rowCount) {
      res.status(404).json({ error: 'Birim bulunamadı' });
      return;
    }
    const current = existing.rows[0];

    if (input.parentId && input.parentId === req.params.id) {
      res.status(400).json({ error: 'Birim kendi üst birimi olamaz' });
      return;
    }

    const result = await pool.query(
      `UPDATE units SET
         parent_id = $1,
         name = $2,
         minimum_staff = $3,
         manager_personnel_id = $4,
         work_schedule_type = $5,
         office_start_time = $6,
         office_end_time = $7,
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        input.parentId === undefined ? current.parent_id : input.parentId,
        input.name ?? current.name,
        input.minimumStaff ?? current.minimum_staff,
        input.managerPersonnelId === undefined
          ? current.manager_personnel_id
          : input.managerPersonnelId,
        input.workScheduleType ?? current.work_schedule_type,
        input.officeStartTime === undefined
          ? current.office_start_time
          : input.officeStartTime,
        input.officeEndTime === undefined ? current.office_end_time : input.officeEndTime,
        req.params.id,
      ],
    );

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'unit.update',
      entityType: 'unit',
      entityId: req.params.id,
      details: input,
    });

    res.json(result.rows[0]);
  }),
);

unitsRouter.delete(
  '/:id',
  requirePermission('units.manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const pool = req.tenantPool!;

    const children = await pool.query(`SELECT id FROM units WHERE parent_id = $1 LIMIT 1`, [
      req.params.id,
    ]);
    if (children.rowCount) {
      res.status(400).json({ error: 'Alt birimleri olan bir birim silinemez' });
      return;
    }

    const active = await pool.query(
      `SELECT id FROM personnel_unit_history
        WHERE unit_id = $1 AND ended_at IS NULL LIMIT 1`,
      [req.params.id],
    );
    if (active.rowCount) {
      res.status(400).json({ error: 'Birimde kayıtlı personel varken silinemez' });
      return;
    }

    const result = await pool.query(`DELETE FROM units WHERE id = $1 RETURNING id`, [
      req.params.id,
    ]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Birim bulunamadı' });
      return;
    }

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'unit.delete',
      entityType: 'unit',
      entityId: req.params.id,
    });

    res.json({ ok: true, id: req.params.id });
  }),
);

// --- Personel ilişkileri ----------------------------------------------------

/** Birime bağlı aktif personel. */
unitsRouter.get(
  '/:id/personnel',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query(
      `SELECT p.* FROM personnel_unit_history puh
         INNER JOIN personnel p ON p.id = puh.personnel_id
        WHERE puh.unit_id = $1 AND puh.ended_at IS NULL AND p.status = 'ACTIVE'
        ORDER BY p.last_name, p.first_name`,
      [req.params.id],
    );
    res.json(result.rows);
  }),
);

unitsRouter.get(
  '/:id/personnel/count',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM personnel_unit_history puh
         INNER JOIN personnel p ON p.id = puh.personnel_id
        WHERE puh.unit_id = $1 AND puh.ended_at IS NULL AND p.status = 'ACTIVE'`,
      [req.params.id],
    );
    res.json({ unitId: req.params.id, count: Number(result.rows[0]?.count ?? 0) });
  }),
);

unitsRouter.post(
  '/:id/personnel',
  requirePermission('units.manage'),
  validateBody(assignPersonnelSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { personnelId, move } = validated<z.infer<typeof assignPersonnelSchema>>(req);
    const unitId = req.params.id;
    const pool = req.tenantPool!;

    const unit = await pool.query(`SELECT id FROM units WHERE id = $1`, [unitId]);
    if (!unit.rowCount) {
      res.status(404).json({ error: 'Birim bulunamadı' });
      return;
    }

    const person = await pool.query(
      `SELECT id FROM personnel WHERE id = $1 AND status = 'ACTIVE'`,
      [personnelId],
    );
    if (!person.rowCount) {
      res.status(404).json({ error: 'Personel bulunamadı' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query<{ id: string; unit_id: string }>(
        `SELECT id, unit_id FROM personnel_unit_history
          WHERE personnel_id = $1 AND ended_at IS NULL
          FOR UPDATE`,
        [personnelId],
      );

      const existing = current.rows[0];
      if (existing?.unit_id === unitId) {
        await client.query('COMMIT');
        res.status(200).json({ ok: true, unitId, personnelId, alreadyAssigned: true });
        return;
      }

      if (existing && !move) {
        await client.query('ROLLBACK');
        res.status(409).json({
          error: 'Personel başka bir birime kayıtlı. Taşımak için move: true gönderin.',
          currentUnitId: existing.unit_id,
        });
        return;
      }

      if (existing) {
        await client.query(
          `UPDATE personnel_unit_history SET ended_at = NOW() WHERE id = $1`,
          [existing.id],
        );
      }

      const result = await client.query(
        `INSERT INTO personnel_unit_history (id, personnel_id, unit_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [randomUUID(), personnelId, unitId],
      );

      await client.query('COMMIT');

      await writeAuditLog(pool, {
        userId: req.auth!.userId,
        action: 'unit.assign_personnel',
        entityType: 'unit',
        entityId: unitId,
        details: { personnelId, movedFrom: existing?.unit_id ?? null },
      });

      res.status(201).json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }),
);

unitsRouter.delete(
  '/:id/personnel/:personnelId',
  requirePermission('units.manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const pool = req.tenantPool!;
    const result = await pool.query(
      `UPDATE personnel_unit_history SET ended_at = NOW()
        WHERE unit_id = $1 AND personnel_id = $2 AND ended_at IS NULL
        RETURNING *`,
      [req.params.id, req.params.personnelId],
    );

    if (!result.rowCount) {
      res.status(404).json({ error: 'Personel bu birime kayıtlı değil' });
      return;
    }

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'unit.remove_personnel',
      entityType: 'unit',
      entityId: req.params.id,
      details: { personnelId: req.params.personnelId },
    });

    res.json({ ok: true });
  }),
);
