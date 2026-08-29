import type { SQLiteDatabaseAdapter } from '@/shared/database/types';
import type {
  AbsenceRepository,
  AssignmentRepository,
  AuthRepository,
  InstitutionRepository,
  PersonnelRepository,
  ShiftRepository,
  TaskTypeRepository,
  UnitRepository,
} from './interfaces';
import { SQLiteAbsenceRepository } from './sqlite/SQLiteAbsenceRepository';
import { SQLiteAssignmentRepository } from './sqlite/SQLiteAssignmentRepository';
import { SQLiteAuthRepository } from './sqlite/SQLiteAuthRepository';
import { SQLiteInstitutionRepository } from './sqlite/SQLiteInstitutionRepository';
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
}

let repositories: Repositories | null = null;

export function initRepositories(db: SQLiteDatabaseAdapter): Repositories {
  repositories = {
    personnel: new SQLitePersonnelRepository(db),
    units: new SQLiteUnitRepository(db),
    shifts: new SQLiteShiftRepository(db),
    absences: new SQLiteAbsenceRepository(db),
    auth: new SQLiteAuthRepository(db),
    institution: new SQLiteInstitutionRepository(db),
    taskTypes: new SQLiteTaskTypeRepository(db),
    assignments: new SQLiteAssignmentRepository(db),
  };
  return repositories;
}

export function getRepositories(): Repositories {
  if (!repositories) {
    throw new Error('Repositories henüz başlatılmadı');
  }
  return repositories;
}
