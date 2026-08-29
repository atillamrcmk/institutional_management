import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type {
  CreateUnitInput,
  Personnel,
  PersonnelUnitHistory,
  Unit,
  UpdateUnitInput,
} from '@/shared/types';
import type { UnitRepository } from '../interfaces';
import { generateId, nowIso } from '@/shared/utils/id';

function mapUnit(row: Record<string, unknown>): Unit {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    parentId: (row.parent_id as string) ?? null,
    name: row.name as string,
    minimumStaff: row.minimum_staff as number,
    managerPersonnelId: (row.manager_personnel_id as string) ?? null,
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
    status: row.status as Personnel['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class SQLiteUnitRepository implements UnitRepository {
  constructor(private readonly db: SQLiteDatabaseAdapter) {}

  async getAll(institutionId: string): Promise<Unit[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM units WHERE institution_id = ? ORDER BY name',
      institutionId,
    );
    return rows.map(mapUnit);
  }

  async getById(id: string): Promise<Unit | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM units WHERE id = ?',
      id,
    );
    return row ? mapUnit(row) : null;
  }

  async getChildren(parentId: string | null, institutionId: string): Promise<Unit[]> {
    if (parentId === null) {
      const rows = await this.db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM units WHERE institution_id = ? AND parent_id IS NULL ORDER BY name',
        institutionId,
      );
      return rows.map(mapUnit);
    }
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM units WHERE parent_id = ? ORDER BY name',
      parentId,
    );
    return rows.map(mapUnit);
  }

  async create(institutionId: string, input: CreateUnitInput): Promise<Unit> {
    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      `INSERT INTO units (id, institution_id, parent_id, name, minimum_staff, manager_personnel_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      institutionId,
      input.parentId ?? null,
      input.name,
      input.minimumStaff ?? 0,
      input.managerPersonnelId ?? null,
      ts,
      ts,
    );
    const unit = await this.getById(id);
    if (!unit) throw new Error('Birim oluşturulamadı');
    return unit;
  }

  async update(id: string, input: UpdateUnitInput): Promise<Unit> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Birim bulunamadı');

    const updated: Unit = {
      ...existing,
      name: input.name ?? existing.name,
      parentId: input.parentId !== undefined ? input.parentId : existing.parentId,
      minimumStaff: input.minimumStaff ?? existing.minimumStaff,
      managerPersonnelId:
        input.managerPersonnelId !== undefined
          ? input.managerPersonnelId
          : existing.managerPersonnelId,
      updatedAt: nowIso(),
    };

    await this.db.runAsync(
      `UPDATE units SET name = ?, parent_id = ?, minimum_staff = ?, manager_personnel_id = ?, updated_at = ? WHERE id = ?`,
      updated.name,
      updated.parentId,
      updated.minimumStaff,
      updated.managerPersonnelId,
      updated.updatedAt,
      id,
    );
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM units WHERE id = ?', id);
  }

  async assignPersonnel(unitId: string, personnelId: string): Promise<PersonnelUnitHistory> {
    const current = await this.db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM personnel_unit_history WHERE personnel_id = ? AND ended_at IS NULL`,
      personnelId,
    );
    if (current) {
      await this.db.runAsync(
        'UPDATE personnel_unit_history SET ended_at = ? WHERE id = ?',
        nowIso(),
        current.id as string,
      );
    }

    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      `INSERT INTO personnel_unit_history (id, personnel_id, unit_id, started_at, ended_at, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
      id,
      personnelId,
      unitId,
      ts,
      ts,
    );

    return {
      id,
      personnelId,
      unitId,
      startedAt: ts,
      endedAt: null,
      createdAt: ts,
    };
  }

  async removePersonnel(unitId: string, personnelId: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE personnel_unit_history SET ended_at = ? WHERE personnel_id = ? AND unit_id = ? AND ended_at IS NULL`,
      nowIso(),
      personnelId,
      unitId,
    );
  }

  async getActivePersonnelForUnit(unitId: string): Promise<Personnel[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT p.* FROM personnel p
       INNER JOIN personnel_unit_history puh ON puh.personnel_id = p.id
       WHERE puh.unit_id = ? AND puh.ended_at IS NULL AND p.status = 'ACTIVE'
       ORDER BY p.last_name, p.first_name`,
      unitId,
    );
    return rows.map(mapPersonnel);
  }

  async getCurrentUnitForPersonnel(personnelId: string): Promise<Unit | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      `SELECT u.* FROM units u
       INNER JOIN personnel_unit_history puh ON puh.unit_id = u.id
       WHERE puh.personnel_id = ? AND puh.ended_at IS NULL`,
      personnelId,
    );
    return row ? mapUnit(row) : null;
  }

  async getPersonnelCountForUnit(unitId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM personnel_unit_history
       WHERE unit_id = ? AND ended_at IS NULL`,
      unitId,
    );
    return row?.count ?? 0;
  }
}
