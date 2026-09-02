import type pg from 'pg';
import {
  calculateShiftForDate,
  getOfficeShiftForDate,
  isWorkingShift,
  todayDateString,
  type CalculatedShift,
  type PatternDayRow,
  type ShiftType,
} from './shiftCalculator.js';

/**
 * mobile/src/features/presence/services/presenceService.ts port'u.
 *
 * Kural özeti:
 *  1. Vardiya kaynağı: aktif vardiya grubu -> yoksa birim OFFICE ise mesai -> yoksa OFF
 *  2. Durum önceliği: ABSENT > ON_ASSIGNMENT > ON_DUTY
 *  3. Çalışmayan (OFF) ve izinli/görevli olmayan personel listede yer almaz
 */

export interface PersonnelRow {
  id: string;
  first_name: string;
  last_name: string;
  sicil_no: string;
  title: string | null;
  photo_uri: string | null;
  status: string;
}

export interface UnitRow {
  id: string;
  parent_id: string | null;
  name: string;
  minimum_staff: number;
  manager_personnel_id: string | null;
  work_schedule_type: string | null;
  office_start_time: string | null;
  office_end_time: string | null;
}

export interface ShiftGroupRow {
  id: string;
  unit_id: string;
  name: string;
  pattern_id: string;
  cycle_start_date: string | null;
  cycle_offset: number;
}

export type PresenceStatus = 'ON_DUTY' | 'ON_ASSIGNMENT' | 'ABSENT';

export interface PresenceEntry {
  personnel: PersonnelRow;
  unit: UnitRow | null;
  shiftGroup: ShiftGroupRow | null;
  shift: CalculatedShift;
  status: PresenceStatus;
  absenceType?: string;
  assignmentId?: string;
  assignmentTitle?: string;
  assignmentTime?: string;
}

export interface PresenceFilters {
  unitId?: string;
  shiftGroupId?: string;
  status?: 'all' | 'on_duty' | 'on_assignment' | 'absent';
}

export interface OfficeUnitSummary {
  unitId: string;
  unitName: string;
  startTime: string;
  endTime: string;
  personnel: PersonnelRow[];
}

export interface DashboardStats {
  date: string;
  totalOnDuty: number;
  activeShiftGroups: number;
  absentCount: number;
  onAssignment: number;
  available: number;
  activeUnits: Array<{ unit: UnitRow; count: number; shiftName?: string }>;
}

interface PresenceContext {
  date: string;
  personnel: PersonnelRow[];
  unitByPersonnelId: Map<string, UnitRow>;
  absenceByPersonnelId: Map<string, string>;
  shiftByPersonnelId: Map<string, { group: ShiftGroupRow; patternDays: PatternDayRow[] }>;
  assignmentByPersonnelId: Map<
    string,
    { id: string; title: string; start_time: string; end_time: string | null }
  >;
}

async function loadContext(pool: pg.Pool, date: string): Promise<PresenceContext> {
  const [personnelResult, unitsResult, absencesResult, shiftsResult, assignmentsResult] =
    await Promise.all([
      pool.query<PersonnelRow>(
        `SELECT * FROM personnel WHERE status = 'ACTIVE' ORDER BY last_name, first_name`,
      ),
      pool.query<UnitRow & { personnel_id: string }>(
        `SELECT u.*, puh.personnel_id
           FROM personnel_unit_history puh
           INNER JOIN units u ON u.id = puh.unit_id
          WHERE puh.ended_at IS NULL`,
      ),
      pool.query<{ personnel_id: string; type: string }>(
        `SELECT personnel_id, type FROM personnel_absences
          WHERE start_date <= $1 AND end_date >= $1`,
        [date],
      ),
      pool.query<
        ShiftGroupRow & {
          personnel_id: string;
          day_index: number | null;
          shift_type: string | null;
          start_time: string | null;
          end_time: string | null;
        }
      >(
        `SELECT g.id, g.unit_id, g.name, g.pattern_id, g.cycle_start_date, g.cycle_offset,
                psa.personnel_id,
                d.day_index, d.shift_type, d.start_time, d.end_time
           FROM personnel_shift_assignments psa
           INNER JOIN shift_groups g ON g.id = psa.shift_group_id
           LEFT JOIN shift_pattern_days d ON d.pattern_id = g.pattern_id
          WHERE psa.ended_at IS NULL
          ORDER BY psa.personnel_id, d.day_index`,
      ),
      pool.query<{
        personnel_id: string;
        id: string;
        title: string;
        start_time: string;
        end_time: string | null;
      }>(
        `SELECT ap.personnel_id, a.id, a.title, a.start_time, a.end_time
           FROM assignment_personnel ap
           INNER JOIN assignments a ON a.id = ap.assignment_id
          WHERE a.date = $1 AND a.status IN ('PLANNED', 'ACTIVE')
          ORDER BY a.start_time`,
        [date],
      ),
    ]);

  const unitByPersonnelId = new Map<string, UnitRow>();
  for (const row of unitsResult.rows) {
    const { personnel_id: personnelId, ...unit } = row;
    unitByPersonnelId.set(personnelId, unit as UnitRow);
  }

  const absenceByPersonnelId = new Map<string, string>();
  for (const row of absencesResult.rows) {
    if (!absenceByPersonnelId.has(row.personnel_id)) {
      absenceByPersonnelId.set(row.personnel_id, row.type);
    }
  }

  const shiftByPersonnelId = new Map<
    string,
    { group: ShiftGroupRow; patternDays: PatternDayRow[] }
  >();
  for (const row of shiftsResult.rows) {
    const existing = shiftByPersonnelId.get(row.personnel_id);
    const group: ShiftGroupRow = {
      id: row.id,
      unit_id: row.unit_id,
      name: row.name,
      pattern_id: row.pattern_id,
      cycle_start_date: row.cycle_start_date,
      cycle_offset: row.cycle_offset,
    };
    const entry = existing ?? { group, patternDays: [] };
    if (row.day_index !== null && row.shift_type !== null) {
      entry.patternDays.push({
        day_index: row.day_index,
        shift_type: row.shift_type,
        start_time: row.start_time,
        end_time: row.end_time,
      });
    }
    shiftByPersonnelId.set(row.personnel_id, entry);
  }

  const assignmentByPersonnelId = new Map<
    string,
    { id: string; title: string; start_time: string; end_time: string | null }
  >();
  for (const row of assignmentsResult.rows) {
    if (!assignmentByPersonnelId.has(row.personnel_id)) {
      assignmentByPersonnelId.set(row.personnel_id, {
        id: row.id,
        title: row.title,
        start_time: row.start_time,
        end_time: row.end_time,
      });
    }
  }

  return {
    date,
    personnel: personnelResult.rows,
    unitByPersonnelId,
    absenceByPersonnelId,
    shiftByPersonnelId,
    assignmentByPersonnelId,
  };
}

function resolveShift(
  context: PresenceContext,
  personnelId: string,
): { shift: CalculatedShift; group: ShiftGroupRow | null } {
  const shiftData = context.shiftByPersonnelId.get(personnelId);

  if (shiftData && shiftData.group.cycle_start_date) {
    return {
      shift: calculateShiftForDate(
        shiftData.patternDays,
        shiftData.group.cycle_start_date,
        context.date,
      ),
      group: shiftData.group,
    };
  }

  const unit = context.unitByPersonnelId.get(personnelId);
  if (unit?.work_schedule_type === 'OFFICE') {
    return { shift: getOfficeShiftForDate(unit, context.date), group: null };
  }

  return {
    shift: {
      date: context.date,
      shiftType: 'OFF' as ShiftType,
      startTime: null,
      endTime: null,
      cycleDayIndex: 0,
    },
    group: shiftData?.group ?? null,
  };
}

function buildEntries(context: PresenceContext): PresenceEntry[] {
  const entries: PresenceEntry[] = [];

  for (const person of context.personnel) {
    const absenceType = context.absenceByPersonnelId.get(person.id);
    const assignment = context.assignmentByPersonnelId.get(person.id);
    const { shift, group } = resolveShift(context, person.id);

    let status: PresenceStatus;
    if (absenceType) {
      status = 'ABSENT';
    } else if (assignment) {
      status = 'ON_ASSIGNMENT';
    } else if (!isWorkingShift(shift.shiftType)) {
      continue;
    } else {
      status = 'ON_DUTY';
    }

    entries.push({
      personnel: person,
      unit: context.unitByPersonnelId.get(person.id) ?? null,
      shiftGroup: group,
      shift,
      status,
      ...(absenceType ? { absenceType } : {}),
      ...(status === 'ON_ASSIGNMENT' && assignment
        ? {
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            assignmentTime: assignment.end_time
              ? `${assignment.start_time} – ${assignment.end_time}`
              : assignment.start_time,
          }
        : {}),
    });
  }

  entries.sort((a, b) =>
    a.personnel.last_name.localeCompare(b.personnel.last_name, 'tr'),
  );

  return entries;
}

const STATUS_FILTER: Record<string, PresenceStatus> = {
  on_duty: 'ON_DUTY',
  on_assignment: 'ON_ASSIGNMENT',
  absent: 'ABSENT',
};

export async function getPresenceForDate(
  pool: pg.Pool,
  date: string = todayDateString(),
  filters: PresenceFilters = {},
): Promise<PresenceEntry[]> {
  const context = await loadContext(pool, date);
  let entries = buildEntries(context);

  if (filters.unitId) {
    entries = entries.filter((entry) => entry.unit?.id === filters.unitId);
  }
  if (filters.shiftGroupId) {
    entries = entries.filter((entry) => entry.shiftGroup?.id === filters.shiftGroupId);
  }
  if (filters.status && filters.status !== 'all') {
    const wanted = STATUS_FILTER[filters.status];
    entries = entries.filter((entry) => entry.status === wanted);
  }

  return entries;
}

export async function getOfficeUnitsSummary(
  pool: pg.Pool,
  date: string = todayDateString(),
): Promise<OfficeUnitSummary[]> {
  const unitsResult = await pool.query<UnitRow>(
    `SELECT * FROM units WHERE work_schedule_type = 'OFFICE' ORDER BY name`,
  );

  const working = unitsResult.rows.filter(
    (unit) => getOfficeShiftForDate(unit, date).shiftType !== 'OFF',
  );
  if (working.length === 0) return [];

  const personnelResult = await pool.query<PersonnelRow & { unit_id: string }>(
    `SELECT p.*, puh.unit_id
       FROM personnel_unit_history puh
       INNER JOIN personnel p ON p.id = puh.personnel_id
      WHERE puh.ended_at IS NULL
        AND p.status = 'ACTIVE'
        AND puh.unit_id = ANY($1::text[])
      ORDER BY p.last_name, p.first_name`,
    [working.map((unit) => unit.id)],
  );

  const byUnit = new Map<string, PersonnelRow[]>();
  for (const row of personnelResult.rows) {
    const { unit_id: unitId, ...person } = row;
    const list = byUnit.get(unitId) ?? [];
    list.push(person as PersonnelRow);
    byUnit.set(unitId, list);
  }

  return working.map((unit) => {
    const shift = getOfficeShiftForDate(unit, date);
    return {
      unitId: unit.id,
      unitName: unit.name,
      startTime: shift.startTime ?? '08:00',
      endTime: shift.endTime ?? '17:00',
      personnel: byUnit.get(unit.id) ?? [],
    };
  });
}

export async function getDashboardStats(
  pool: pg.Pool,
  date: string = todayDateString(),
): Promise<DashboardStats> {
  const context = await loadContext(pool, date);
  const entries = buildEntries(context);

  const onDuty = entries.filter((entry) => entry.status === 'ON_DUTY');
  const onAssignment = entries.filter((entry) => entry.status === 'ON_ASSIGNMENT');
  const absent = entries.filter((entry) => entry.status === 'ABSENT');

  const activeGroupIds = new Set<string>();
  const unitCounts = new Map<string, { unit: UnitRow; count: number; shiftName?: string }>();

  for (const entry of [...onDuty, ...onAssignment]) {
    if (entry.shiftGroup) activeGroupIds.add(entry.shiftGroup.id);
    if (!entry.unit) continue;
    const existing = unitCounts.get(entry.unit.id);
    if (existing) {
      existing.count += 1;
      existing.shiftName ??= entry.shiftGroup?.name;
    } else {
      unitCounts.set(entry.unit.id, {
        unit: entry.unit,
        count: 1,
        shiftName: entry.shiftGroup?.name,
      });
    }
  }

  return {
    date,
    totalOnDuty: onDuty.length + onAssignment.length,
    activeShiftGroups: activeGroupIds.size,
    absentCount: absent.length,
    onAssignment: onAssignment.length,
    available: onDuty.length,
    activeUnits: [...unitCounts.values()].sort((a, b) =>
      a.unit.name.localeCompare(b.unit.name, 'tr'),
    ),
  };
}
