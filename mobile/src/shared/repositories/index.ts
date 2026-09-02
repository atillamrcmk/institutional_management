import { isServerApiConfigured } from '@/shared/api/config';
import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type {
  AbsenceRepository,
  AssignmentRepository,
  AuthRepository,
  InstitutionRepository,
  MessageRepository,
  PersonnelRepository,
  ShiftRepository,
  TaskTypeRepository,
  UnitRepository,
} from './interfaces';
import { createApiRepositories } from './api';
import { SQLiteAbsenceRepository } from './sqlite/SQLiteAbsenceRepository';
import { SQLiteAssignmentRepository } from './sqlite/SQLiteAssignmentRepository';
import { SQLiteAuthRepository } from './sqlite/SQLiteAuthRepository';
import { SQLiteInstitutionRepository } from './sqlite/SQLiteInstitutionRepository';
import { SQLiteMessageRepository } from './sqlite/SQLiteMessageRepository';
import { SQLitePersonnelRepository } from './sqlite/SQLitePersonnelRepository';
import { SQLiteShiftRepository } from './sqlite/SQLiteShiftRepository';
import { SQLiteTaskTypeRepository } from './sqlite/SQLiteTaskTypeRepository';
import { SQLiteUnitRepository } from './sqlite/SQLiteUnitRepository';

export interface Repositories {
  personnel: PersonnelRepository;
  units: UnitRepository;
  shifts: ShiftRepository;
  absences: AbsenceRepository;
  auth: AuthRepository;
  institution: InstitutionRepository;
  taskTypes: TaskTypeRepository;
  assignments: AssignmentRepository;
  messages: MessageRepository;
}

let repositories: Repositories | null = null;
let usingApi = false;

export function createSqliteRepositories(db: SQLiteDatabaseAdapter): Repositories {
  return {
    personnel: new SQLitePersonnelRepository(db),
    units: new SQLiteUnitRepository(db),
    shifts: new SQLiteShiftRepository(db),
    absences: new SQLiteAbsenceRepository(db),
    auth: new SQLiteAuthRepository(db),
    institution: new SQLiteInstitutionRepository(db),
    taskTypes: new SQLiteTaskTypeRepository(db),
    assignments: new SQLiteAssignmentRepository(db),
    messages: new SQLiteMessageRepository(db),
  };
}

/**
 * EXPO_PUBLIC_API_URL tanımlıysa tüm alan verisi canlı sunucudan okunur;
 * aksi hâlde yerel SQLite deposu kullanılır.
 */
export function initRepositories(db: SQLiteDatabaseAdapter): Repositories {
  if (isServerApiConfigured()) {
    usingApi = true;
    repositories = createApiRepositories();
  } else {
    usingApi = false;
    repositories = createSqliteRepositories(db);
  }
  return repositories;
}

export function getRepositories(): Repositories {
  if (!repositories) {
    throw new Error('Repositories henüz başlatılmadı');
  }
  return repositories;
}

export function isUsingApiRepositories(): boolean {
  return usingApi;
}
