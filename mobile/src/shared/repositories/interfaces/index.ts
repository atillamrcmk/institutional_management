import type {
  CreatePersonnelInput,
  CreateUnitInput,
  Personnel,
  PersonnelAbsence,
  PersonnelShiftAssignment,
  PersonnelUnitHistory,
  ShiftGroup,
  ShiftPattern,
  ShiftPatternDay,
  Unit,
  UpdatePersonnelInput,
  UpdateUnitInput,
  User,
} from '@/shared/types';

export interface PersonnelRepository {
  getAll(institutionId: string): Promise<Personnel[]>;
  getById(id: string): Promise<Personnel | null>;
  findActiveBySicilNo(
    institutionId: string,
    sicilNo: string,
    excludeId?: string,
  ): Promise<Personnel | null>;
  search(institutionId: string, query: string): Promise<Personnel[]>;
  create(institutionId: string, input: CreatePersonnelInput): Promise<Personnel>;
  update(id: string, input: UpdatePersonnelInput): Promise<Personnel>;
  delete(id: string): Promise<void>;
}

export interface UnitRepository {
  getAll(institutionId: string): Promise<Unit[]>;
  getById(id: string): Promise<Unit | null>;
  getChildren(parentId: string | null, institutionId: string): Promise<Unit[]>;
  create(institutionId: string, input: CreateUnitInput): Promise<Unit>;
  update(id: string, input: UpdateUnitInput): Promise<Unit>;
  delete(id: string): Promise<void>;
  assignPersonnel(unitId: string, personnelId: string): Promise<PersonnelUnitHistory>;
  removePersonnel(unitId: string, personnelId: string): Promise<void>;
  getActivePersonnelForUnit(unitId: string): Promise<Personnel[]>;
  getUnassignedPersonnel(institutionId: string, query?: string): Promise<Personnel[]>;
  getCurrentUnitForPersonnel(personnelId: string): Promise<Unit | null>;
  getPersonnelCountForUnit(unitId: string, date?: string): Promise<number>;
}

export interface ShiftRepository {
  getPatterns(institutionId: string): Promise<ShiftPattern[]>;
  getPatternById(id: string): Promise<ShiftPattern | null>;
  getPatternDays(patternId: string): Promise<ShiftPatternDay[]>;
  getAllGroups(institutionId: string): Promise<ShiftGroup[]>;
  getGroupsByUnit(unitId: string): Promise<ShiftGroup[]>;
  getGroupById(id: string): Promise<ShiftGroup | null>;
  createPattern(
    institutionId: string,
    name: string,
    referenceDate: string,
    days: Array<{ shiftType: ShiftPatternDay['shiftType']; startTime?: string; endTime?: string }>,
  ): Promise<ShiftPattern>;
  updatePattern(
    id: string,
    input: {
      name?: string;
      referenceDate?: string;
      days?: Array<{ shiftType: ShiftPatternDay['shiftType']; startTime?: string; endTime?: string }>;
    },
  ): Promise<ShiftPattern>;
  deletePattern(id: string): Promise<void>;
  createGroup(
    unitId: string,
    name: string,
    patternId: string,
    cycleStartDate?: string,
  ): Promise<ShiftGroup>;
  getSuggestedCycleStartDate(unitId: string, patternId: string): Promise<string>;
  updateGroup(
    id: string,
    input: { name?: string; patternId?: string; cycleStartDate?: string },
  ): Promise<ShiftGroup>;
  deleteGroup(id: string): Promise<void>;
  assignPersonnelToGroup(personnelId: string, shiftGroupId: string): Promise<PersonnelShiftAssignment>;
  removePersonnelFromGroup(personnelId: string, shiftGroupId: string): Promise<void>;
  getPersonnelInGroup(shiftGroupId: string): Promise<Personnel[]>;
  getActiveAssignmentForPersonnel(personnelId: string, date: string): Promise<{
    assignment: PersonnelShiftAssignment;
    group: ShiftGroup;
    patternDays: ShiftPatternDay[];
    referenceDate: string;
  } | null>;
  getShiftsForDate(institutionId: string, date: string): Promise<Array<{
    group: ShiftGroup;
    unit: Unit;
    personnel: Personnel[];
    shift: import('@/shared/types').CalculatedShift;
  }>>;
}

export interface AbsenceRepository {
  getByPersonnel(personnelId: string): Promise<PersonnelAbsence[]>;
  isAbsentOnDate(personnelId: string, date: string): Promise<boolean>;
  create(input: Omit<PersonnelAbsence, 'id' | 'createdAt'>): Promise<PersonnelAbsence>;
  delete(id: string): Promise<void>;
}

export interface TaskTypeRepository {
  getAll(institutionId: string): Promise<import('@/shared/types').TaskType[]>;
  getById(id: string): Promise<import('@/shared/types').TaskType | null>;
  create(institutionId: string, name: string, code: string): Promise<import('@/shared/types').TaskType>;
}

export interface CreateAssignmentInput {
  taskTypeId: string;
  title: string;
  description?: string | null;
  date: string;
  startTime: string;
  endTime?: string | null;
  requiredPersonnelCount: number;
  managerPersonnelId?: string | null;
  personnelIds: string[];
}

export interface AssignmentRepository {
  getAll(institutionId: string, options?: { date?: string }): Promise<import('@/shared/types').Assignment[]>;
  getById(id: string): Promise<import('@/shared/types').Assignment | null>;
  getDetail(id: string): Promise<{
    assignment: import('@/shared/types').Assignment;
    taskType: import('@/shared/types').TaskType;
    personnel: Personnel[];
  } | null>;
  getByPersonnel(personnelId: string, fromDate?: string): Promise<import('@/shared/types').Assignment[]>;
  getActiveForPersonnelOnDate(
    personnelId: string,
    date: string,
  ): Promise<import('@/shared/types').Assignment | null>;
  create(institutionId: string, input: CreateAssignmentInput): Promise<import('@/shared/types').Assignment>;
  updateStatus(id: string, status: import('@/shared/types').AssignmentStatus): Promise<import('@/shared/types').Assignment>;
  getAssignedPersonnelIds(assignmentId: string): Promise<string[]>;
}

export interface AuthRepository {
  getDemoUsers(institutionId: string): Promise<User[]>;
  getById(id: string): Promise<User | null>;
  login(userId: string, pin?: string): Promise<User | null>;
  getUserGrants(userId: string): Promise<Array<{ permission: import('@/shared/types').Permission; unitId: string | null }>>;
  grantPermission(
    userId: string,
    permission: import('@/shared/types').Permission,
    unitId?: string | null,
  ): Promise<void>;
  createUser(input: {
    institutionId: string;
    displayName: string;
    role: User['role'];
    personnelId?: string | null;
    pin?: string | null;
    canMessageAdmins?: boolean;
    /** Sunucu modunda hesap davetinde kullanılır; verilmezse geçici kimlik üretilir. */
    email?: string | null;
    password?: string | null;
  }): Promise<User>;
  updateUser(
    id: string,
    input: { canMessageAdmins?: boolean; displayName?: string },
  ): Promise<User>;
  getUsersByRole(institutionId: string, roles: User['role'][]): Promise<User[]>;
  getUserByPersonnelId(personnelId: string): Promise<User | null>;
}

export interface MessageRepository {
  create(
    institutionId: string,
    sender: { userId: string; displayName: string },
    input: import('@/shared/types').SendMessageInput,
    recipients: Array<{ userId?: string | null; personnelId?: string | null }>,
  ): Promise<import('@/shared/types').Message>;
  getInbox(
    institutionId: string,
    userId: string,
    personnelId: string | null,
  ): Promise<import('@/shared/types').InboxMessage[]>;
  getSent(userId: string): Promise<import('@/shared/types').Message[]>;
  getById(id: string): Promise<import('@/shared/types').Message | null>;
  markRead(recipientId: string): Promise<void>;
  getUnreadCount(
    institutionId: string,
    userId: string,
    personnelId: string | null,
  ): Promise<number>;
  savePushToken(userId: string, token: string, platform: string): Promise<void>;
  getPushTokensForUsers(userIds: string[]): Promise<string[]>;
}

export interface InstitutionRepository {
  getFirst(): Promise<{ id: string; name: string } | null>;
  create(name: string): Promise<{ id: string; name: string }>;
  clearAllData(): Promise<void>;
  persist(): Promise<void>;
}
