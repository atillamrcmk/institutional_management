import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import {
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from '../middleware/auth.js';
import { asyncHandler, validateBody, validated } from '../middleware/validate.js';
import { writeAuditLog } from '../services/auditLog.js';
import {
  addDaysToDateString,
  calculateShiftForDate,
  daysBetweenDates,
  todayDateString,
  type PatternDayRow,
} from '../services/shiftCalculator.js';

export const shiftsRouter = Router();

shiftsRouter.use(requireAuth);

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD biçiminde olmalı');
const TIME_OR_EMPTY = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, 'HH:mm biçiminde olmalı');

const patternDaySchema = z.object({
  shiftType: z.enum(['DAY', 'NIGHT', 'FULL', 'OFF']),
  startTime: TIME_OR_EMPTY.nullable().optional(),
  endTime: TIME_OR_EMPTY.nullable().optional(),
});

const createPatternSchema = z.object({
  name: z.string().trim().min(1, 'Desen adı zorunludur').max(200),
  referenceDate: DATE,
  days: z.array(patternDaySchema).min(1, 'En az bir döngü günü gerekir').max(60),
});

const updatePatternSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  referenceDate: DATE.optional(),
  days: z.array(patternDaySchema).min(1).max(60).optional(),
});

const createGroupSchema = z.object({
  unitId: z.string().trim().min(1, 'unitId zorunludur'),
  name: z.string().trim().min(1, 'Grup adı zorunludur').max(200),
  patternId: z.string().trim().min(1, 'patternId zorunludur'),
  cycleStartDate: DATE.optional(),
});

const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  patternId: z.string().trim().min(1).optional(),
  cycleStartDate: DATE.optional(),
});

const groupPersonnelSchema = z.object({
  personnelId: z.string().trim().min(1, 'personnelId zorunludur'),
});

function normalizeTime(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function replacePatternDays(
  client: pg.PoolClient,
  patternId: string,
  days: Array<z.infer<typeof patternDaySchema>>,
): Promise<void> {
  await client.query(`DELETE FROM shift_pattern_days WHERE pattern_id = $1`, [patternId]);
  for (const [index, day] of days.entries()) {
    await client.query(
      `INSERT INTO shift_pattern_days (id, pattern_id, day_index, shift_type, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        patternId,
        index,
        day.shiftType,
        normalizeTime(day.startTime),
        normalizeTime(day.endTime),
      ],
    );
  }
}

async function getPatternDays(pool: pg.Pool, patternId: string): Promise<PatternDayRow[]> {
  const result = await pool.query<PatternDayRow & { id: string }>(
    `SELECT id, day_index, shift_type, start_time, end_time
       FROM shift_pattern_days WHERE pattern_id = $1 ORDER BY day_index`,
    [patternId],
  );
  return result.rows;
}

/** Desen referans tarihine göre döngü ofseti (mobil ile uyum için saklanır). */
function cycleOffsetFor(
  referenceDate: string | null,
  cycleStartDate: string,
  cycleLength: number,
): number {
  if (!referenceDate || cycleLength <= 0) return 0;
  const diff = daysBetweenDates(referenceDate, cycleStartDate);
  return ((diff % cycleLength) + cycleLength) % cycleLength;
}

async function suggestCycleStartDate(
  pool: pg.Pool,
  unitId: string,
  patternId: string,
): Promise<string> {
  const pattern = await pool.query<{ reference_date: string }>(
    `SELECT reference_date FROM shift_patterns WHERE id = $1`,
    [patternId],
  );
  const days = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM shift_pattern_days WHERE pattern_id = $1`,
    [patternId],
  );
  const cycleLength = Math.max(Number(days.rows[0]?.count ?? 0), 1);

  const last = await pool.query<{ cycle_start_date: string }>(
    `SELECT cycle_start_date FROM shift_groups
      WHERE unit_id = $1 AND pattern_id = $2 AND cycle_start_date IS NOT NULL
      ORDER BY cycle_start_date DESC LIMIT 1`,
    [unitId, patternId],
  );

  if (!last.rows[0]?.cycle_start_date) {
    return pattern.rows[0]?.reference_date ?? todayDateString();
  }

  return addDaysToDateString(last.rows[0].cycle_start_date, cycleLength);
}

// --- Desenler ---------------------------------------------------------------

shiftsRouter.get(
  '/patterns',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query(
      `SELECT * FROM shift_patterns ORDER BY created_at DESC`,
    );
    res.json(result.rows);
  }),
);

shiftsRouter.post(
  '/patterns',
  requirePermission('shifts.manage'),
  validateBody(createPatternSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = validated<z.infer<typeof createPatternSchema>>(req);
    const pool = req.tenantPool!;
    const id = randomUUID();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO shift_patterns (id, name, reference_date) VALUES ($1, $2, $3)`,
        [id, input.name, input.referenceDate],
      );
      await replacePatternDays(client, id, input.days);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'shift_pattern.create',
      entityType: 'shift_pattern',
      entityId: id,
      details: { name: input.name, cycleLength: input.days.length },
    });

    const pattern = await pool.query(`SELECT * FROM shift_patterns WHERE id = $1`, [id]);
    res.status(201).json({ ...pattern.rows[0], days: await getPatternDays(pool, id) });
  }),
);

shiftsRouter.get(
  '/patterns/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const pool = req.tenantPool!;
    const pattern = await pool.query(`SELECT * FROM shift_patterns WHERE id = $1`, [
      req.params.id,
    ]);
    if (!pattern.rowCount) {
      res.status(404).json({ error: 'Vardiya deseni bulunamadı' });
      return;
    }
    res.json({ ...pattern.rows[0], days: await getPatternDays(pool, req.params.id) });
  }),
);

shiftsRouter.get(
  '/patterns/:id/days',
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await getPatternDays(req.tenantPool!, req.params.id));
  }),
);

shiftsRouter.patch(
  '/patterns/:id',
  requirePermission('shifts.manage'),
  validateBody(updatePatternSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = validated<z.infer<typeof updatePatternSchema>>(req);
    const pool = req.tenantPool!;

    const existing = await pool.query<{ name: string; reference_date: string }>(
      `SELECT * FROM shift_patterns WHERE id = $1`,
      [req.params.id],
    );
    if (!existing.rowCount) {
      res.status(404).json({ error: 'Vardiya deseni bulunamadı' });
      return;
    }
    const current = existing.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE shift_patterns SET name = $1, reference_date = $2, updated_at = NOW()
          WHERE id = $3`,
        [input.name ?? current.name, input.referenceDate ?? current.reference_date, req.params.id],
      );
      if (input.days) {
        await replacePatternDays(client, req.params.id, input.days);
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
      action: 'shift_pattern.update',
      entityType: 'shift_pattern',
      entityId: req.params.id,
    });

    const pattern = await pool.query(`SELECT * FROM shift_patterns WHERE id = $1`, [
      req.params.id,
    ]);
    res.json({ ...pattern.rows[0], days: await getPatternDays(pool, req.params.id) });
  }),
);

shiftsRouter.delete(
  '/patterns/:id',
  requirePermission('shifts.manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const pool = req.tenantPool!;

    const inUse = await pool.query(`SELECT id FROM shift_groups WHERE pattern_id = $1 LIMIT 1`, [
      req.params.id,
    ]);
    if (inUse.rowCount) {
      res.status(400).json({ error: 'Bu desen bir vardiya grubunda kullanılıyor' });
      return;
    }

    const result = await pool.query(`DELETE FROM shift_patterns WHERE id = $1 RETURNING id`, [
      req.params.id,
    ]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Vardiya deseni bulunamadı' });
      return;
    }

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'shift_pattern.delete',
      entityType: 'shift_pattern',
      entityId: req.params.id,
    });

    res.json({ ok: true, id: req.params.id });
  }),
);

// --- Gruplar ----------------------------------------------------------------

/** /groups/:id'den ÖNCE tanımlanmalı. */
shiftsRouter.get(
  '/groups/suggested-cycle-start',
  asyncHandler(async (req: AuthedRequest, res) => {
    const unitId = typeof req.query.unitId === 'string' ? req.query.unitId : '';
    const patternId = typeof req.query.patternId === 'string' ? req.query.patternId : '';

    if (!unitId || !patternId) {
      res.status(400).json({ error: 'unitId ve patternId zorunludur' });
      return;
    }

    res.json({
      unitId,
      patternId,
      cycleStartDate: await suggestCycleStartDate(req.tenantPool!, unitId, patternId),
    });
  }),
);

shiftsRouter.get(
  '/groups',
  asyncHandler(async (req: AuthedRequest, res) => {
    const unitId = typeof req.query.unitId === 'string' ? req.query.unitId : '';

    const result = unitId
      ? await req.tenantPool!.query(
          `SELECT * FROM shift_groups WHERE unit_id = $1 ORDER BY name`,
          [unitId],
        )
      : await req.tenantPool!.query(`SELECT * FROM shift_groups ORDER BY name`);

    res.json(result.rows);
  }),
);

shiftsRouter.post(
  '/groups',
  requirePermission('shifts.manage'),
  validateBody(createGroupSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = validated<z.infer<typeof createGroupSchema>>(req);
    const pool = req.tenantPool!;

    const unit = await pool.query(`SELECT id FROM units WHERE id = $1`, [input.unitId]);
    if (!unit.rowCount) {
      res.status(404).json({ error: 'Birim bulunamadı' });
      return;
    }

    const pattern = await pool.query<{ reference_date: string }>(
      `SELECT reference_date FROM shift_patterns WHERE id = $1`,
      [input.patternId],
    );
    if (!pattern.rowCount) {
      res.status(404).json({ error: 'Vardiya deseni bulunamadı' });
      return;
    }

    const cycleStartDate =
      input.cycleStartDate ?? (await suggestCycleStartDate(pool, input.unitId, input.patternId));
    const days = await getPatternDays(pool, input.patternId);
    const offset = cycleOffsetFor(
      pattern.rows[0].reference_date,
      cycleStartDate,
      Math.max(days.length, 1),
    );

    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO shift_groups (id, unit_id, name, pattern_id, cycle_offset, cycle_start_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, input.unitId, input.name, input.patternId, offset, cycleStartDate],
    );

    // Vardiya grubu olan birim artık mesai değil vardiya düzenindedir.
    await pool.query(
      `UPDATE units SET work_schedule_type = 'SHIFT', updated_at = NOW() WHERE id = $1`,
      [input.unitId],
    );

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'shift_group.create',
      entityType: 'shift_group',
      entityId: id,
      details: { unitId: input.unitId, name: input.name, cycleStartDate },
    });

    res.status(201).json(result.rows[0]);
  }),
);

shiftsRouter.get(
  '/groups/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query(`SELECT * FROM shift_groups WHERE id = $1`, [
      req.params.id,
    ]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Vardiya grubu bulunamadı' });
      return;
    }
    res.json(result.rows[0]);
  }),
);

shiftsRouter.patch(
  '/groups/:id',
  requirePermission('shifts.manage'),
  validateBody(updateGroupSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = validated<z.infer<typeof updateGroupSchema>>(req);
    const pool = req.tenantPool!;

    const existing = await pool.query<{
      name: string;
      pattern_id: string;
      cycle_start_date: string | null;
      cycle_offset: number;
    }>(`SELECT * FROM shift_groups WHERE id = $1`, [req.params.id]);
    if (!existing.rowCount) {
      res.status(404).json({ error: 'Vardiya grubu bulunamadı' });
      return;
    }
    const current = existing.rows[0];

    const patternId = input.patternId ?? current.pattern_id;
    const cycleStartDate =
      input.cycleStartDate ?? current.cycle_start_date ?? todayDateString();

    const pattern = await pool.query<{ reference_date: string }>(
      `SELECT reference_date FROM shift_patterns WHERE id = $1`,
      [patternId],
    );
    if (!pattern.rowCount) {
      res.status(404).json({ error: 'Vardiya deseni bulunamadı' });
      return;
    }

    const days = await getPatternDays(pool, patternId);
    const offset = cycleOffsetFor(
      pattern.rows[0].reference_date,
      cycleStartDate,
      Math.max(days.length, 1),
    );

    const result = await pool.query(
      `UPDATE shift_groups SET
         name = $1, pattern_id = $2, cycle_offset = $3, cycle_start_date = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [input.name ?? current.name, patternId, offset, cycleStartDate, req.params.id],
    );

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'shift_group.update',
      entityType: 'shift_group',
      entityId: req.params.id,
      details: input,
    });

    res.json(result.rows[0]);
  }),
);

shiftsRouter.delete(
  '/groups/:id',
  requirePermission('shifts.manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const pool = req.tenantPool!;
    const result = await pool.query(`DELETE FROM shift_groups WHERE id = $1 RETURNING id`, [
      req.params.id,
    ]);
    if (!result.rowCount) {
      res.status(404).json({ error: 'Vardiya grubu bulunamadı' });
      return;
    }

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'shift_group.delete',
      entityType: 'shift_group',
      entityId: req.params.id,
    });

    res.json({ ok: true, id: req.params.id });
  }),
);

shiftsRouter.get(
  '/groups/:id/personnel',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await req.tenantPool!.query(
      `SELECT p.* FROM personnel_shift_assignments psa
         INNER JOIN personnel p ON p.id = psa.personnel_id
        WHERE psa.shift_group_id = $1 AND psa.ended_at IS NULL AND p.status = 'ACTIVE'
        ORDER BY p.last_name, p.first_name`,
      [req.params.id],
    );
    res.json(result.rows);
  }),
);

shiftsRouter.post(
  '/groups/:id/personnel',
  requirePermission('shifts.manage'),
  validateBody(groupPersonnelSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { personnelId } = validated<z.infer<typeof groupPersonnelSchema>>(req);
    const groupId = req.params.id;
    const pool = req.tenantPool!;

    const group = await pool.query(`SELECT id FROM shift_groups WHERE id = $1`, [groupId]);
    if (!group.rowCount) {
      res.status(404).json({ error: 'Vardiya grubu bulunamadı' });
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

      const current = await client.query<{ id: string; shift_group_id: string }>(
        `SELECT id, shift_group_id FROM personnel_shift_assignments
          WHERE personnel_id = $1 AND ended_at IS NULL
          FOR UPDATE`,
        [personnelId],
      );

      const existing = current.rows[0];
      if (existing?.shift_group_id === groupId) {
        await client.query('COMMIT');
        res.json({ ok: true, alreadyAssigned: true, shiftGroupId: groupId, personnelId });
        return;
      }

      if (existing) {
        await client.query(
          `UPDATE personnel_shift_assignments SET ended_at = NOW() WHERE id = $1`,
          [existing.id],
        );
      }

      const result = await client.query(
        `INSERT INTO personnel_shift_assignments (id, personnel_id, shift_group_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [randomUUID(), personnelId, groupId],
      );

      await client.query('COMMIT');

      await writeAuditLog(pool, {
        userId: req.auth!.userId,
        action: 'shift_group.assign_personnel',
        entityType: 'shift_group',
        entityId: groupId,
        details: { personnelId, movedFrom: existing?.shift_group_id ?? null },
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

shiftsRouter.delete(
  '/groups/:id/personnel/:personnelId',
  requirePermission('shifts.manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const pool = req.tenantPool!;
    const result = await pool.query(
      `UPDATE personnel_shift_assignments SET ended_at = NOW()
        WHERE shift_group_id = $1 AND personnel_id = $2 AND ended_at IS NULL
        RETURNING *`,
      [req.params.id, req.params.personnelId],
    );

    if (!result.rowCount) {
      res.status(404).json({ error: 'Personel bu vardiya grubunda değil' });
      return;
    }

    await writeAuditLog(pool, {
      userId: req.auth!.userId,
      action: 'shift_group.remove_personnel',
      entityType: 'shift_group',
      entityId: req.params.id,
      details: { personnelId: req.params.personnelId },
    });

    res.json({ ok: true });
  }),
);

// --- Hesaplanmış vardiyalar -------------------------------------------------

/** Bir personelin verilen tarihteki aktif vardiya ataması + hesaplanan vardiyası. */
shiftsRouter.get(
  '/personnel/:personnelId/active',
  asyncHandler(async (req: AuthedRequest, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : todayDateString();
    const pool = req.tenantPool!;

    const result = await pool.query(
      `SELECT psa.id AS assignment_id, psa.personnel_id, psa.started_at, psa.ended_at,
              g.id AS group_id, g.unit_id, g.name AS group_name, g.pattern_id,
              g.cycle_start_date, g.cycle_offset,
              pat.reference_date
         FROM personnel_shift_assignments psa
         INNER JOIN shift_groups g ON g.id = psa.shift_group_id
         INNER JOIN shift_patterns pat ON pat.id = g.pattern_id
        WHERE psa.personnel_id = $1 AND psa.ended_at IS NULL
        LIMIT 1`,
      [req.params.personnelId],
    );

    if (!result.rowCount) {
      res.json(null);
      return;
    }

    const row = result.rows[0];
    const patternDays = await getPatternDays(pool, row.pattern_id);
    const cycleStartDate: string = row.cycle_start_date ?? row.reference_date;

    res.json({
      assignment: {
        id: row.assignment_id,
        personnel_id: row.personnel_id,
        shift_group_id: row.group_id,
        started_at: row.started_at,
        ended_at: row.ended_at,
      },
      group: {
        id: row.group_id,
        unit_id: row.unit_id,
        name: row.group_name,
        pattern_id: row.pattern_id,
        cycle_start_date: row.cycle_start_date,
        cycle_offset: row.cycle_offset,
      },
      patternDays,
      referenceDate: row.reference_date,
      shift: calculateShiftForDate(patternDays, cycleStartDate, date),
    });
  }),
);

/** Verilen tarihte tüm vardiya gruplarının durumu (grup + birim + personel + vardiya). */
shiftsRouter.get(
  '/by-date',
  asyncHandler(async (req: AuthedRequest, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : todayDateString();
    const pool = req.tenantPool!;

    const [groupsResult, daysResult, personnelResult] = await Promise.all([
      pool.query(
        `SELECT g.*, pat.reference_date,
                u.id AS u_id, u.parent_id AS u_parent_id, u.name AS u_name,
                u.minimum_staff AS u_minimum_staff,
                u.manager_personnel_id AS u_manager_personnel_id,
                u.work_schedule_type AS u_work_schedule_type,
                u.office_start_time AS u_office_start_time,
                u.office_end_time AS u_office_end_time
           FROM shift_groups g
           INNER JOIN units u ON u.id = g.unit_id
           INNER JOIN shift_patterns pat ON pat.id = g.pattern_id
          ORDER BY u.name, g.name`,
      ),
      pool.query<PatternDayRow & { pattern_id: string }>(
        `SELECT pattern_id, day_index, shift_type, start_time, end_time
           FROM shift_pattern_days ORDER BY pattern_id, day_index`,
      ),
      pool.query(
        `SELECT psa.shift_group_id, p.*
           FROM personnel_shift_assignments psa
           INNER JOIN personnel p ON p.id = psa.personnel_id
          WHERE psa.ended_at IS NULL AND p.status = 'ACTIVE'
          ORDER BY p.last_name, p.first_name`,
      ),
    ]);

    const daysByPattern = new Map<string, PatternDayRow[]>();
    for (const row of daysResult.rows) {
      const list = daysByPattern.get(row.pattern_id) ?? [];
      list.push(row);
      daysByPattern.set(row.pattern_id, list);
    }

    const personnelByGroup = new Map<string, unknown[]>();
    for (const row of personnelResult.rows) {
      const { shift_group_id: groupId, ...person } = row;
      const list = personnelByGroup.get(groupId) ?? [];
      list.push(person);
      personnelByGroup.set(groupId, list);
    }

    const payload = groupsResult.rows.map((row) => {
      const patternDays = daysByPattern.get(row.pattern_id) ?? [];
      const cycleStartDate: string = row.cycle_start_date ?? row.reference_date;

      return {
        group: {
          id: row.id,
          unit_id: row.unit_id,
          name: row.name,
          pattern_id: row.pattern_id,
          cycle_start_date: row.cycle_start_date,
          cycle_offset: row.cycle_offset,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
        unit: {
          id: row.u_id,
          parent_id: row.u_parent_id,
          name: row.u_name,
          minimum_staff: row.u_minimum_staff,
          manager_personnel_id: row.u_manager_personnel_id,
          work_schedule_type: row.u_work_schedule_type,
          office_start_time: row.u_office_start_time,
          office_end_time: row.u_office_end_time,
        },
        personnel: personnelByGroup.get(row.id) ?? [],
        shift: calculateShiftForDate(patternDays, cycleStartDate, date),
      };
    });

    res.json({ date, groups: payload });
  }),
);
