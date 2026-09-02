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

export const absencesRouter = Router();

absencesRouter.use(requireAuth);

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD biçiminde olmalı');

const createAbsenceSchema = z
  .object({
    personnelId: z.string().trim().min(1, 'personnelId zorunludur'),
    type: z.enum(['LEAVE', 'REPORT', 'TRAINING', 'TEMPORARY_DUTY']),
    startDate: DATE,
    endDate: DATE,
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: 'Bitiş tarihi başlangıçtan önce olamaz',
    path: ['endDate'],
  });

/** Belirli bir personelin tüm izin kayıtları. */
absencesRouter.get(
  '/personnel/:personnelId',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query(
      `SELECT * FROM personnel_absences
        WHERE personnel_id = $1
        ORDER BY start_date DESC`,
      [req.params.personnelId],
    );
    res.json(result.rows);
  }),
);

/** Personel verilen tarihte izinli mi? */
absencesRouter.get(
  '/personnel/:personnelId/check',
  asyncHandler(async (req: AuthedRequest, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : todayDateString();

    const result = await req.tenantPool!.query(
      `SELECT * FROM personnel_absences
        WHERE personnel_id = $1 AND start_date <= $2 AND end_date >= $2
        ORDER BY start_date
        LIMIT 1`,
      [req.params.personnelId, date],
    );

    res.json({
      personnelId: req.params.personnelId,
      date,
      isAbsent: Boolean(result.rowCount),
      absence: result.rows[0] ?? null,
    });
  }),
);

/** Verilen tarih aralığındaki tüm izinler (varsayılan: bugün). */
absencesRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : todayDateString();
    const to = typeof req.query.to === 'string' ? req.query.to : from;

    const result = await req.tenantPool!.query(
      `SELECT a.*, p.first_name, p.last_name, p.sicil_no
         FROM personnel_absences a
         INNER JOIN personnel p ON p.id = a.personnel_id
        WHERE a.start_date <= $2 AND a.end_date >= $1
        ORDER BY a.start_date DESC, p.last_name`,
      [from, to],
    );

    res.json(result.rows);
  }),
);

absencesRouter.post(
  '/',
  requirePermission('personnel.manage'),
  validateBody(createAbsenceSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = validated<z.infer<typeof createAbsenceSchema>>(req);
    const pool = req.tenantPool!;

    const person = await pool.query(`SELECT id FROM personnel WHERE id = $1`, [
      input.personnelId,
    ]);
    if (!person.rowCount) {
      res.status(404).json({ error: 'Personel bulunamadı' });
      return;
    }

    const overlap = await pool.query(
      `SELECT id FROM personnel_absences
        WHERE personnel_id = $1 AND start_date <= $3 AND end_date >= $2
        LIMIT 1`,
      [input.personnelId, input.startDate, input.endDate],
    );
    if (overlap.rowCount) {
      res.status(409).json({ error: 'Bu tarihlerde zaten bir izin kaydı var' });
      return;
    }

    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO personnel_absences (id, personnel_id, type, start_date, end_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        id,
        input.personnelId,
        input.type,
        input.startDate,
        input.endDate,
        input.notes?.trim() || null,
      ],
    );

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'absence.create',
      entityType: 'personnel_absence',
      entityId: id,
      details: {
        personnelId: input.personnelId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });

    res.status(201).json(result.rows[0]);
  }),
);

absencesRouter.delete(
  '/:id',
  requirePermission('personnel.manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const pool = req.tenantPool!;
    const result = await pool.query(
      `DELETE FROM personnel_absences WHERE id = $1 RETURNING *`,
      [req.params.id],
    );

    if (!result.rowCount) {
      res.status(404).json({ error: 'İzin kaydı bulunamadı' });
      return;
    }

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'absence.delete',
      entityType: 'personnel_absence',
      entityId: req.params.id,
      details: { personnelId: result.rows[0].personnel_id },
    });

    res.json({ ok: true, id: req.params.id });
  }),
);
