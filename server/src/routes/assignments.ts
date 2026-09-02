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
import { todayDateString } from '../services/shiftCalculator.js';

export const assignmentsRouter = Router();

assignmentsRouter.use(requireAuth);

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD biçiminde olmalı');
const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm biçiminde olmalı');

const ASSIGNMENT_STATUSES = ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
const OPEN_STATUSES = ['PLANNED', 'ACTIVE'];

const createAssignmentSchema = z.object({
  taskTypeId: z.string().trim().min(1, 'taskTypeId zorunludur'),
  title: z.string().trim().min(1, 'Başlık zorunludur').max(300),
  description: z.string().trim().max(4000).nullable().optional(),
  date: DATE,
  startTime: TIME,
  endTime: TIME.nullable().optional(),
  requiredPersonnelCount: z.number().int().min(1).max(1000).optional(),
  managerPersonnelId: z.string().trim().min(1).nullable().optional(),
  personnelIds: z.array(z.string().trim().min(1)).max(500).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(ASSIGNMENT_STATUSES),
});

/** Görevlendirme listesi. ?date=, ?from=&to=, ?status= ile filtrelenir. */
assignmentsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { date, from, to, status } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (typeof date === 'string' && date) {
      params.push(date);
      conditions.push(`a.date = $${params.length}`);
    } else if (typeof from === 'string' && from) {
      params.push(from);
      conditions.push(`a.date >= $${params.length}`);
      if (typeof to === 'string' && to) {
        params.push(to);
        conditions.push(`a.date <= $${params.length}`);
      }
    }

    if (typeof status === 'string' && status) {
      params.push(status.toUpperCase());
      conditions.push(`a.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await req.tenantPool!.query(
      `SELECT a.*, t.name AS task_type_name, t.code AS task_type_code,
              (SELECT COUNT(*)::int FROM assignment_personnel ap WHERE ap.assignment_id = a.id)
                AS assigned_personnel_count
         FROM assignments a
         INNER JOIN task_types t ON t.id = a.task_type_id
         ${where}
        ORDER BY a.date DESC, a.start_time`,
      params,
    );

    res.json(result.rows);
  }),
);

/** Bir personelin görevlendirmeleri. ?from= verilmezse tümü döner. */
assignmentsRouter.get(
  '/personnel/:personnelId',
  asyncHandler(async (req: AuthedRequest, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : null;

    const result = await req.tenantPool!.query(
      `SELECT a.*, t.name AS task_type_name, t.code AS task_type_code
         FROM assignment_personnel ap
         INNER JOIN assignments a ON a.id = ap.assignment_id
         INNER JOIN task_types t ON t.id = a.task_type_id
        WHERE ap.personnel_id = $1
          AND ($2::text IS NULL OR a.date >= $2::text)
        ORDER BY a.date DESC, a.start_time`,
      [req.params.personnelId, from],
    );

    res.json(result.rows);
  }),
);

/** Personelin verilen tarihte açık (PLANNED/ACTIVE) görevlendirmesi. */
assignmentsRouter.get(
  '/personnel/:personnelId/active',
  asyncHandler(async (req: AuthedRequest, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : todayDateString();

    const result = await req.tenantPool!.query(
      `SELECT a.*, t.name AS task_type_name, t.code AS task_type_code
         FROM assignment_personnel ap
         INNER JOIN assignments a ON a.id = ap.assignment_id
         INNER JOIN task_types t ON t.id = a.task_type_id
        WHERE ap.personnel_id = $1 AND a.date = $2 AND a.status = ANY($3::text[])
        ORDER BY a.start_time
        LIMIT 1`,
      [req.params.personnelId, date, OPEN_STATUSES],
    );

    res.json(result.rows[0] ?? null);
  }),
);

assignmentsRouter.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query(`SELECT * FROM assignments WHERE id = $1`, [
      req.params.id,
    ]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Görevlendirme bulunamadı' });
      return;
    }
    res.json(result.rows[0]);
  }),
);

/** Görevlendirme + görev tipi + atanmış personel. */
assignmentsRouter.get(
  '/:id/detail',
  asyncHandler(async (req: AuthedRequest, res) => {
    const pool = req.tenantPool!;

    const assignment = await pool.query(
      `SELECT a.*, row_to_json(t) AS task_type
         FROM assignments a
         INNER JOIN task_types t ON t.id = a.task_type_id
        WHERE a.id = $1`,
      [req.params.id],
    );
    if (!assignment.rowCount) {
      res.status(404).json({ error: 'Görevlendirme bulunamadı' });
      return;
    }

    const personnel = await pool.query(
      `SELECT p.* FROM assignment_personnel ap
         INNER JOIN personnel p ON p.id = ap.personnel_id
        WHERE ap.assignment_id = $1
        ORDER BY p.last_name, p.first_name`,
      [req.params.id],
    );

    const { task_type: taskType, ...rest } = assignment.rows[0];
    res.json({ assignment: rest, taskType, personnel: personnel.rows });
  }),
);

assignmentsRouter.post(
  '/',
  requirePermission('assignments.manage'),
  validateBody(createAssignmentSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = validated<z.infer<typeof createAssignmentSchema>>(req);
    const pool = req.tenantPool!;

    const taskType = await pool.query(`SELECT id FROM task_types WHERE id = $1`, [
      input.taskTypeId,
    ]);
    if (!taskType.rowCount) {
      res.status(404).json({ error: 'Görev tipi bulunamadı' });
      return;
    }

    const personnelIds = [...new Set(input.personnelIds ?? [])];
    if (personnelIds.length > 0) {
      const known = await pool.query<{ id: string }>(
        `SELECT id FROM personnel WHERE id = ANY($1::text[]) AND status = 'ACTIVE'`,
        [personnelIds],
      );
      if (known.rowCount !== personnelIds.length) {
        res.status(400).json({ error: 'Bazı personel kayıtları bulunamadı veya pasif' });
        return;
      }
    }

    const id = randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO assignments (
           id, task_type_id, title, description, date, start_time, end_time,
           required_personnel_count, manager_personnel_id, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PLANNED')`,
        [
          id,
          input.taskTypeId,
          input.title,
          input.description?.trim() || null,
          input.date,
          input.startTime,
          input.endTime ?? null,
          input.requiredPersonnelCount ?? Math.max(personnelIds.length, 1),
          input.managerPersonnelId ?? null,
        ],
      );

      for (const personnelId of personnelIds) {
        await client.query(
          `INSERT INTO assignment_personnel (id, assignment_id, personnel_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (assignment_id, personnel_id) DO NOTHING`,
          [randomUUID(), id, personnelId],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'assignment.create',
      entityType: 'assignment',
      entityId: id,
      details: { title: input.title, date: input.date, personnelCount: personnelIds.length },
    });

    const created = await pool.query(`SELECT * FROM assignments WHERE id = $1`, [id]);
    res.status(201).json({ ...created.rows[0], personnel_ids: personnelIds });
  }),
);

assignmentsRouter.patch(
  '/:id/status',
  requirePermission('assignments.manage'),
  validateBody(updateStatusSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { status } = validated<z.infer<typeof updateStatusSchema>>(req);
    const pool = req.tenantPool!;

    const result = await pool.query(
      `UPDATE assignments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id],
    );

    if (!result.rowCount) {
      res.status(404).json({ error: 'Görevlendirme bulunamadı' });
      return;
    }

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'assignment.update_status',
      entityType: 'assignment',
      entityId: req.params.id,
      details: { status },
    });

    res.json(result.rows[0]);
  }),
);
