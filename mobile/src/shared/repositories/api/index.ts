import type { Repositories } from '../index';
import { ApiAbsenceRepository } from './ApiAbsenceRepository';
import { ApiAssignmentRepository } from './ApiAssignmentRepository';
import { ApiAuthRepository } from './ApiAuthRepository';
import { ApiInstitutionRepository } from './ApiInstitutionRepository';
import { ApiMessageRepository } from './ApiMessageRepository';
import { ApiPersonnelRepository } from './ApiPersonnelRepository';
import { ApiShiftRepository } from './ApiShiftRepository';
import { ApiTaskTypeRepository } from './ApiTaskTypeRepository';
import { ApiUnitRepository } from './ApiUnitRepository';

export { ApiAbsenceRepository } from './ApiAbsenceRepository';
export { ApiAssignmentRepository } from './ApiAssignmentRepository';
export { ApiAuthRepository } from './ApiAuthRepository';
export { ApiInstitutionRepository } from './ApiInstitutionRepository';
export { ApiMessageRepository } from './ApiMessageRepository';
export { ApiPersonnelRepository } from './ApiPersonnelRepository';
export { ApiShiftRepository } from './ApiShiftRepository';
export { ApiTaskTypeRepository } from './ApiTaskTypeRepository';
export { ApiUnitRepository } from './ApiUnitRepository';

export function createApiRepositories(): Repositories {
  return {
    personnel: new ApiPersonnelRepository(),
    units: new ApiUnitRepository(),
    shifts: new ApiShiftRepository(),
    absences: new ApiAbsenceRepository(),
    auth: new ApiAuthRepository(),
    institution: new ApiInstitutionRepository(),
    taskTypes: new ApiTaskTypeRepository(),
    assignments: new ApiAssignmentRepository(),
    messages: new ApiMessageRepository(),
  };
}
