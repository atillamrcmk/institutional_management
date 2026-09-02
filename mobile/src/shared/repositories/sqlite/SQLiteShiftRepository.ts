import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type {
  Personnel,
  PersonnelShiftAssignment,
  ShiftGroup,
  ShiftPattern,
  ShiftPatternDay,
  Unit,
} from '@/shared/types';
import type { ShiftRepository } from '../interfaces';
import { calculateShiftForDate } from '@/features/shifts/engine/shiftCalculator';
import { generateId, nowIso, addDaysToDateString, todayDateString } from '@/shared/utils/id';

function mapPattern(row: Record<string, unknown>): ShiftPattern {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    name: row.name as string,
    referenceDate: row.reference_date as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapPatternDay(row: Record<string, unknown>): ShiftPatternDay {
  return {
    id: row.id as string,
    patternId: row.pattern_id as string,
    dayIndex: row.day_index as number,
    shiftType: row.shift_type as ShiftPatternDay['shiftType'],
    startTime: (row.start_time as string) ?? null,
    endTime: (row.end_time as string) ?? null,
  };
}

function mapGroup(row: Record<string, unknown>): ShiftGroup {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    unitId: row.unit_id as string,
    name: row.name as string,
    patternId: row.pattern_id as string,
    cycleStartDate: (row.cycle_start_date as string) || todayDateString(),
    cycleOffset: (row.cycle_offset as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapPersonnel(row: Record<string, unknown>): Personnel {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    sicilNo: row.sicil_no as string,
    title: (row.title as string) ?? null,
    photoUri: (row.photo_uri as string) ?? null,
    status: row.status as Personnel['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapUnit(row: Record<string, unknown>): Unit {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    parentId: (row.parent_id as string) ?? null,
    name: row.name as string,
    minimumStaff: row.minimum_staff as number,
    managerPersonnelId: (row.manager_personnel_id as string) ?? null,
    workScheduleType: (row.work_schedule_type as Unit['workScheduleType']) ?? 'OFFICE',
    officeStartTime: (row.office_start_time as string) ?? '08:00',
    officeEndTime: (row.office_end_time as string) ?? '17:00',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class SQLiteShiftRepository implements ShiftRepository {
  constructor(private readonly db: SQLiteDatabaseAdapter) {}

  async getPatterns(institutionId: string): Promise<ShiftPattern[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM shift_patterns WHERE institution_id = ? ORDER BY name',
      institutionId,
    );
    return rows.map(mapPattern);
  }

  async getPatternById(id: string): Promise<ShiftPattern | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM shift_patterns WHERE id = ?',
      id,
    );
    return row ? mapPattern(row) : null;
  }

  async getAllGroups(institutionId: string): Promise<ShiftGroup[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM shift_groups WHERE institution_id = ? ORDER BY name',
      institutionId,
    );
    return rows.map(mapGroup);
  }

  async getPatternDays(patternId: string): Promise<ShiftPatternDay[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM shift_pattern_days WHERE pattern_id = ? ORDER BY day_index',
      patternId,
    );
    return rows.map(mapPatternDay);
  }

  async getGroupsByUnit(unitId: string): Promise<ShiftGroup[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM shift_groups WHERE unit_id = ? ORDER BY name',
      unitId,
    );
    return rows.map(mapGroup);
  }

  async getGroupById(id: string): Promise<ShiftGroup | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM shift_groups WHERE id = ?',
      id,
    );
    return row ? mapGroup(row) : null;
  }

  async createPattern(
    institutionId: string,
    name: string,
    referenceDate: string,
    days: Array<{ shiftType: ShiftPatternDay['shiftType']; startTime?: string; endTime?: string }>,
  ): Promise<ShiftPattern> {
    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      `INSERT INTO shift_patterns (id, institution_id, name, reference_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      institutionId,
      name,
      referenceDate,
      ts,
      ts,
    );

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      await this.db.runAsync(
        `INSERT INTO shift_pattern_days (id, pattern_id, day_index, shift_type, start_time, end_time)
         VALUES (?, ?, ?, ?, ?, ?)`,
        generateId(),
        id,
        i,
        day.shiftType,
        day.startTime ?? null,
        day.endTime ?? null,
      );
    }

    const pattern = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM shift_patterns WHERE id = ?',
      id,
    );
    if (!pattern) throw new Error('Pattern oluşturulamadı');
    return mapPattern(pattern);
  }

  async updatePattern(
    id: string,
    input: {
      name?: string;
      referenceDate?: string;
      days?: Array<{ shiftType: ShiftPatternDay['shiftType']; startTime?: string; endTime?: string }>;
    },
  ): Promise<ShiftPattern> {
    const existing = await this.getPatternById(id);
    if (!existing) throw new Error('Pattern bulunamadı');

    const ts = nowIso();
    await this.db.runAsync(
      `UPDATE shift_patterns SET name = ?, reference_date = ?, updated_at = ? WHERE id = ?`,
      input.name ?? existing.name,
      input.referenceDate ?? existing.referenceDate,
      ts,
      id,
    );

    if (input.days) {
      await this.db.runAsync('DELETE FROM shift_pattern_days WHERE pattern_id = ?', id);
      for (let i = 0; i < input.days.length; i++) {
        const day = input.days[i];
        await this.db.runAsync(
          `INSERT INTO shift_pattern_days (id, pattern_id, day_index, shift_type, start_time, end_time)
           VALUES (?, ?, ?, ?, ?, ?)`,
          generateId(),
          id,
          i,
          day.shiftType,
          day.startTime ?? null,
          day.endTime ?? null,
        );
      }
    }

    const updated = await this.getPatternById(id);
    if (!updated) throw new Error('Pattern güncellenemedi');
    return updated;
  }

  async deletePattern(id: string): Promise<void> {
    const groups = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM shift_groups WHERE pattern_id = ?',
      id,
    );
    if ((groups?.count ?? 0) > 0) {
      throw new Error('Bu döngü vardiya gruplarında kullanılıyor. Önce grupları silin.');
    }
    await this.db.runAsync('DELETE FROM shift_pattern_days WHERE pattern_id = ?', id);
    await this.db.runAsync('DELETE FROM shift_patterns WHERE id = ?', id);
  }

  async createGroup(
    unitId: string,
    name: string,
    patternId: string,
    cycleStartDate?: string,
  ): Promise<ShiftGroup> {
    const unit = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT institution_id FROM units WHERE id = ?',
      unitId,
    );
    if (!unit) throw new Error('Birim bulunamadı');

    const resolvedStartDate =
      cycleStartDate ?? (await this.getSuggestedCycleStartDate(unitId, patternId));

    const pattern = await this.getPatternById(patternId);
    const patternDays = await this.getPatternDays(patternId);
    const cycleLength = Math.max(patternDays.length, 1);
    const offset =
      pattern != null
        ? ((daysBetweenForRepo(pattern.referenceDate, resolvedStartDate) % cycleLength) +
            cycleLength) %
          cycleLength
        : 0;

    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      `INSERT INTO shift_groups (id, institution_id, unit_id, name, pattern_id, cycle_offset, cycle_start_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      unit.institution_id as string,
      unitId,
      name,
      patternId,
      offset,
      resolvedStartDate,
      ts,
      ts,
    );

    const group = await this.getGroupById(id);
    if (!group) throw new Error('Vardiya grubu oluşturulamadı');
    return group;
  }

  async getSuggestedCycleStartDate(unitId: string, patternId: string): Promise<string> {
    const pattern = await this.getPatternById(patternId);
    const patternDays = await this.getPatternDays(patternId);
    const cycleLength = Math.max(patternDays.length, 1);

    const row = await this.db.getFirstAsync<{ cycle_start_date: string }>(
      `SELECT cycle_start_date FROM shift_groups
       WHERE unit_id = ? AND pattern_id = ? AND cycle_start_date IS NOT NULL
       ORDER BY cycle_start_date DESC LIMIT 1`,
      unitId,
      patternId,
    );

    if (!row?.cycle_start_date) {
      return pattern?.referenceDate ?? todayDateString();
    }

    return addDaysToDateString(row.cycle_start_date, cycleLength);
  }

  async updateGroup(
    id: string,
    input: { name?: string; patternId?: string; cycleStartDate?: string },
  ): Promise<ShiftGroup> {
    const existing = await this.getGroupById(id);
    if (!existing) throw new Error('Vardiya grubu bulunamadı');

    const patternId = input.patternId ?? existing.patternId;
    const cycleStartDate = input.cycleStartDate ?? existing.cycleStartDate;
    const pattern = await this.getPatternById(patternId);
    const patternDays = await this.getPatternDays(patternId);
    const cycleLength = Math.max(patternDays.length, 1);
    const offset =
      pattern != null
        ? ((daysBetweenForRepo(pattern.referenceDate, cycleStartDate) % cycleLength) +
            cycleLength) %
          cycleLength
        : existing.cycleOffset;

    const ts = nowIso();
    await this.db.runAsync(
      `UPDATE shift_groups SET name = ?, pattern_id = ?, cycle_offset = ?, cycle_start_date = ?, updated_at = ? WHERE id = ?`,
      input.name ?? existing.name,
      patternId,
      offset,
      cycleStartDate,
      ts,
      id,
    );

    const updated = await this.getGroupById(id);
    if (!updated) throw new Error('Vardiya grubu güncellenemedi');
    return updated;
  }

  async deleteGroup(id: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM personnel_shift_assignments WHERE shift_group_id = ?',
      id,
    );
    await this.db.runAsync('DELETE FROM shift_groups WHERE id = ?', id);
  }

  async assignPersonnelToGroup(
    personnelId: string,
    shiftGroupId: string,
  ): Promise<PersonnelShiftAssignment> {
    const existing = await this.db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM personnel_shift_assignments WHERE personnel_id = ? AND ended_at IS NULL`,
      personnelId,
    );
    if (existing) {
      await this.db.runAsync(
        'UPDATE personnel_shift_assignments SET ended_at = ? WHERE id = ?',
        nowIso(),
        existing.id as string,
      );
    }

    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      `INSERT INTO personnel_shift_assignments (id, personnel_id, shift_group_id, started_at, ended_at, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
      id,
      personnelId,
      shiftGroupId,
      ts,
      ts,
    );

    return {
      id,
      personnelId,
      shiftGroupId,
      startedAt: ts,
      endedAt: null,
      createdAt: ts,
    };
  }

  async removePersonnelFromGroup(personnelId: string, shiftGroupId: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE personnel_shift_assignments SET ended_at = ? WHERE personnel_id = ? AND shift_group_id = ? AND ended_at IS NULL`,
      nowIso(),
      personnelId,
      shiftGroupId,
    );
  }

  async getPersonnelInGroup(shiftGroupId: string): Promise<Personnel[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT p.* FROM personnel p
       INNER JOIN personnel_shift_assignments psa ON psa.personnel_id = p.id
       WHERE psa.shift_group_id = ? AND psa.ended_at IS NULL AND p.status = 'ACTIVE'
       ORDER BY p.last_name, p.first_name`,
      shiftGroupId,
    );
    return rows.map(mapPersonnel);
  }

  async getActiveAssignmentForPersonnel(personnelId: string, _date: string) {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      `SELECT psa.*, sg.pattern_id, sp.reference_date
       FROM personnel_shift_assignments psa
       INNER JOIN shift_groups sg ON sg.id = psa.shift_group_id
       INNER JOIN shift_patterns sp ON sp.id = sg.pattern_id
       WHERE psa.personnel_id = ? AND psa.ended_at IS NULL`,
      personnelId,
    );
    if (!row) return null;

    const patternDays = await this.getPatternDays(row.pattern_id as string);
    const group = await this.getGroupById(row.shift_group_id as string);
    if (!group) return null;

    return {
      assignment: {
        id: row.id as string,
        personnelId: row.personnel_id as string,
        shiftGroupId: row.shift_group_id as string,
        startedAt: row.started_at as string,
        endedAt: (row.ended_at as string) ?? null,
        createdAt: row.created_at as string,
      },
      group,
      patternDays,
      referenceDate: row.reference_date as string,
    };
  }

  async getShiftsForDate(institutionId: string, date: string) {
    const groups = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT sg.*, u.name as unit_name FROM shift_groups sg
       INNER JOIN units u ON u.id = sg.unit_id
       WHERE sg.institution_id = ?`,
      institutionId,
    );

    const results: Array<{
      group: ShiftGroup;
      unit: Unit;
      personnel: Personnel[];
      shift: ReturnType<typeof calculateShiftForDate>;
    }> = [];

    for (const g of groups) {
      const group = mapGroup(g);
      const unit = await this.db.getFirstAsync<Record<string, unknown>>(
        'SELECT * FROM units WHERE id = ?',
        group.unitId,
      );
      if (!unit) continue;

      const pattern = await this.db.getFirstAsync<Record<string, unknown>>(
        'SELECT * FROM shift_patterns WHERE id = ?',
        group.patternId,
      );
      if (!pattern) continue;

      const patternDays = await this.getPatternDays(group.patternId);
      const shift = calculateShiftForDate(patternDays, group.cycleStartDate, date);
      const personnel = await this.getPersonnelInGroup(group.id);

      results.push({
        group,
        unit: mapUnit(unit),
        personnel,
        shift,
      });
    }

    return results;
  }
}

function daysBetweenForRepo(from: string, to: string): number {
  const fromParts = from.split('-').map(Number);
  const toParts = to.split('-').map(Number);
  const fromUtc = Date.UTC(fromParts[0], fromParts[1] - 1, fromParts[2]);
  const toUtc = Date.UTC(toParts[0], toParts[1] - 1, toParts[2]);
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}
