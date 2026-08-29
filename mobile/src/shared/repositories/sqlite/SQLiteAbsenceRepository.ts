import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type { PersonnelAbsence } from '@/shared/types';
import type { AbsenceRepository } from '../interfaces';
import { generateId, nowIso } from '@/shared/utils/id';

function mapAbsence(row: Record<string, unknown>): PersonnelAbsence {
  return {
    id: row.id as string,
    personnelId: row.personnel_id as string,
    type: row.type as PersonnelAbsence['type'],
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export class SQLiteAbsenceRepository implements AbsenceRepository {
  constructor(private readonly db: SQLiteDatabaseAdapter) {}

  async getByPersonnel(personnelId: string): Promise<PersonnelAbsence[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM personnel_absences WHERE personnel_id = ? ORDER BY start_date DESC',
      personnelId,
    );
    return rows.map(mapAbsence);
  }

  async isAbsentOnDate(personnelId: string, date: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM personnel_absences
       WHERE personnel_id = ? AND start_date <= ? AND end_date >= ?`,
      personnelId,
      date,
      date,
    );
    return (row?.count ?? 0) > 0;
  }

  async create(input: Omit<PersonnelAbsence, 'id' | 'createdAt'>): Promise<PersonnelAbsence> {
    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      `INSERT INTO personnel_absences (id, personnel_id, type, start_date, end_date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.personnelId,
      input.type,
      input.startDate,
      input.endDate,
      input.notes ?? null,
      ts,
    );
    return { ...input, id, createdAt: ts };
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM personnel_absences WHERE id = ?', id);
  }
}
