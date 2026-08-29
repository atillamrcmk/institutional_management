import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type {
  CreatePersonnelInput,
  Personnel,
  UpdatePersonnelInput,
} from '@/shared/types';
import type { PersonnelRepository } from '../interfaces';
import { generateId, nowIso } from '@/shared/utils/id';

function mapRow(row: Record<string, unknown>): Personnel {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    sicilNo: row.sicil_no as string,
    title: (row.title as string) ?? null,
    status: row.status as Personnel['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class SQLitePersonnelRepository implements PersonnelRepository {
  constructor(private readonly db: SQLiteDatabaseAdapter) {}

  async getAll(institutionId: string): Promise<Personnel[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM personnel WHERE institution_id = ? AND status = 'ACTIVE' ORDER BY last_name, first_name`,
      institutionId,
    );
    return rows.map(mapRow);
  }

  async getById(id: string): Promise<Personnel | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM personnel WHERE id = ?',
      id,
    );
    return row ? mapRow(row) : null;
  }

  async search(institutionId: string, query: string): Promise<Personnel[]> {
    const q = `%${query.trim()}%`;
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM personnel
       WHERE institution_id = ? AND status = 'ACTIVE'
       AND (first_name LIKE ? OR last_name LIKE ? OR sicil_no LIKE ?)
       ORDER BY last_name, first_name`,
      institutionId,
      q,
      q,
      q,
    );
    return rows.map(mapRow);
  }

  async create(institutionId: string, input: CreatePersonnelInput): Promise<Personnel> {
    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      `INSERT INTO personnel (id, institution_id, first_name, last_name, sicil_no, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      id,
      institutionId,
      input.firstName,
      input.lastName,
      input.sicilNo,
      input.title ?? null,
      ts,
      ts,
    );
    const created = await this.getById(id);
    if (!created) throw new Error('Personel oluşturulamadı');
    return created;
  }

  async update(id: string, input: UpdatePersonnelInput): Promise<Personnel> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Personel bulunamadı');

    const updated: Personnel = {
      ...existing,
      firstName: input.firstName ?? existing.firstName,
      lastName: input.lastName ?? existing.lastName,
      sicilNo: input.sicilNo ?? existing.sicilNo,
      title: input.title !== undefined ? input.title ?? null : existing.title,
      status: input.status ?? existing.status,
      updatedAt: nowIso(),
    };

    await this.db.runAsync(
      `UPDATE personnel SET first_name = ?, last_name = ?, sicil_no = ?, title = ?, status = ?, updated_at = ? WHERE id = ?`,
      updated.firstName,
      updated.lastName,
      updated.sicilNo,
      updated.title,
      updated.status,
      updated.updatedAt,
      id,
    );
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.update(id, { status: 'INACTIVE' });
  }
}
