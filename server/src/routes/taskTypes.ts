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

export const taskTypesRouter = Router();

taskTypesRouter.use(requireAuth);

const createTaskTypeSchema = z.object({
  name: z.string().trim().min(1, 'Görev tipi adı zorunludur').max(200),
  code: z.string().trim().min(1, 'Kod zorunludur').max(50),
});

taskTypesRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query(`SELECT * FROM task_types ORDER BY name`);
    res.json(result.rows);
  }),
);

taskTypesRouter.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query(`SELECT * FROM task_types WHERE id = $1`, [
      req.params.id,
    ]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Görev tipi bulunamadı' });
      return;
    }
    res.json(result.rows[0]);
  }),
);

taskTypesRouter.post(
  '/',
  requirePermission('assignments.manage'),
  validateBody(createTaskTypeSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = validated<z.infer<typeof createTaskTypeSchema>>(req);
    const pool = req.tenantPool!;
    const code = input.code.toUpperCase();

    const dup = await pool.query(`SELECT id FROM task_types WHERE code = $1`, [code]);
    if (dup.rowCount) {
      res.status(409).json({ error: 'Bu kod zaten kullanılıyor' });
      return;
    }

    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO task_types (id, name, code) VALUES ($1, $2, $3) RETURNING *`,
      [id, input.name, code],
    );

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'task_type.create',
      entityType: 'task_type',
      entityId: id,
      details: { name: input.name, code },
    });

    res.status(201).json(result.rows[0]);
  }),
);
