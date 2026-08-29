import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type { Assignment, AssignmentStatus, Personnel, TaskType } from '@/shared/types';
import type { AssignmentRepository, CreateAssignmentInput } from '../interfaces';
import { generateId, nowIso } from '@/shared/utils/id';

function mapAssignment(row: Record<string, unknown>): Assignment {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    taskTypeId: row.task_type_id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    date: row.date as string,
    startTime: row.start_time as string,
    endTime: (row.end_time as string) ?? null,
    requiredPersonnelCount: row.required_personnel_count as number,
    managerPersonnelId: (row.manager_personnel_id as string) ?? null,
    status: row.status as AssignmentStatus,
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

function mapTaskType(row: Record<string, unknown>): TaskType {
  return {
    id: row.id as string,
    institutionId: row.institution_id as string,
    name: row.name as string,
    code: row.code as string,
    createdAt: row.created_at as string,
  };
}

export class SQLiteAssignmentRepository implements AssignmentRepository {
  constructor(private readonly db: SQLiteDatabaseAdapter) {}

  async getAll(institutionId: string, options?: { date?: string }): Promise<Assignment[]> {
    if (options?.date) {
      const rows = await this.db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM assignments WHERE institution_id = ? AND date = ? ORDER BY start_time`,
        institutionId,
        options.date,
      );
      return rows.map(mapAssignment);
    }
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM assignments WHERE institution_id = ? ORDER BY date DESC, start_time',
      institutionId,
    );
    return rows.map(mapAssignment);
  }

  async getById(id: string): Promise<Assignment | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM assignments WHERE id = ?',
      id,
    );
    return row ? mapAssignment(row) : null;
  }

  async getDetail(id: string) {
    const assignment = await this.getById(id);
    if (!assignment) return null;

    const taskType = await this.db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM task_types WHERE id = ?',
      assignment.taskTypeId,
    );
    if (!taskType) return null;

    const personnel = await this.getAssignedPersonnel(id);
    return { assignment, taskType: mapTaskType(taskType), personnel };
  }

  async getByPersonnel(personnelId: string, fromDate?: string): Promise<Assignment[]> {
    if (fromDate) {
      const rows = await this.db.getAllAsync<Record<string, unknown>>(
        `SELECT a.* FROM assignments a
         INNER JOIN assignment_personnel ap ON ap.assignment_id = a.id
         WHERE ap.personnel_id = ? AND a.date >= ?
         ORDER BY a.date, a.start_time`,
        personnelId,
        fromDate,
      );
      return rows.map(mapAssignment);
    }
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT a.* FROM assignments a
       INNER JOIN assignment_personnel ap ON ap.assignment_id = a.id
       WHERE ap.personnel_id = ?
       ORDER BY a.date DESC, a.start_time`,
      personnelId,
    );
    return rows.map(mapAssignment);
  }

  async getActiveForPersonnelOnDate(personnelId: string, date: string): Promise<Assignment | null> {
    const row = await this.db.getFirstAsync<Record<string, unknown>>(
      `SELECT a.* FROM assignments a
       INNER JOIN assignment_personnel ap ON ap.assignment_id = a.id
       WHERE ap.personnel_id = ? AND a.date = ? AND a.status IN ('PLANNED', 'ACTIVE')
       ORDER BY a.start_time
       LIMIT 1`,
      personnelId,
      date,
    );
    return row ? mapAssignment(row) : null;
  }

  async create(institutionId: string, input: CreateAssignmentInput): Promise<Assignment> {
    const id = generateId();
    const ts = nowIso();
    await this.db.runAsync(
      `INSERT INTO assignments (
        id, institution_id, task_type_id, title, description, date,
        start_time, end_time, required_personnel_count, manager_personnel_id,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', ?, ?)`,
      id,
      institutionId,
      input.taskTypeId,
      input.title,
      input.description ?? null,
      input.date,
      input.startTime,
      input.endTime ?? null,
      input.requiredPersonnelCount,
      input.managerPersonnelId ?? null,
      ts,
      ts,
    );

    for (const personnelId of input.personnelIds) {
      await this.db.runAsync(
        'INSERT INTO assignment_personnel (id, assignment_id, personnel_id, created_at) VALUES (?, ?, ?, ?)',
        generateId(),
        id,
        personnelId,
        ts,
      );
    }

    const created = await this.getById(id);
    if (!created) throw new Error('Görevlendirme oluşturulamadı');
    return created;
  }

  async updateStatus(id: string, status: AssignmentStatus): Promise<Assignment> {
    const ts = nowIso();
    await this.db.runAsync('UPDATE assignments SET status = ?, updated_at = ? WHERE id = ?', status, ts, id);
    const updated = await this.getById(id);
    if (!updated) throw new Error('Görevlendirme bulunamadı');
    return updated;
  }

  async getAssignedPersonnelIds(assignmentId: string): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ personnel_id: string }>(
      'SELECT personnel_id FROM assignment_personnel WHERE assignment_id = ?',
      assignmentId,
    );
    return rows.map((r) => r.personnel_id);
  }

  private async getAssignedPersonnel(assignmentId: string): Promise<Personnel[]> {
    const rows = await this.db.getAllAsync<Record<string, unknown>>(
      `SELECT p.* FROM personnel p
       INNER JOIN assignment_personnel ap ON ap.personnel_id = p.id
       WHERE ap.assignment_id = ?
       ORDER BY p.last_name, p.first_name`,
      assignmentId,
    );
    return rows.map(mapPersonnel);
  }
}
