export type UserRole = 'INSTITUTION_ADMIN' | 'UNIT_MANAGER' | 'PERSONNEL';

export type Permission =
  | 'institution.manage'
  | 'personnel.manage'
  | 'shifts.manage'
  | 'units.manage'
  | 'assignments.manage'
  | 'users.manage'
  | 'presence.view'
  | 'messages.send';

export type MessageAudienceType = 'UNIT' | 'PERSONNEL' | 'ALL_PERSONNEL' | 'ADMINS';

export type PersonnelStatus = 'ACTIVE' | 'INACTIVE';

export type ShiftType = 'DAY' | 'NIGHT' | 'FULL' | 'OFF';

export type UnitWorkScheduleType = 'OFFICE' | 'SHIFT';

export type AbsenceType = 'LEAVE' | 'REPORT' | 'TRAINING' | 'TEMPORARY_DUTY';

export type AssignmentStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Institution {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  institutionId: string;
  personnelId: string | null;
  displayName: string;
  role: UserRole;
  pin: string | null;
  canMessageAdmins: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  institutionId: string;
  senderUserId: string;
  senderDisplayName: string;
  subject: string;
  body: string;
  audienceType: MessageAudienceType;
  unitId: string | null;
  createdAt: string;
}

export interface InboxMessage extends Message {
  recipientId: string;
  readAt: string | null;
}

export interface SendMessageInput {
  subject: string;
  body: string;
  audienceType: MessageAudienceType;
  unitId?: string | null;
  personnelIds?: string[];
}

export interface Personnel {
  id: string;
  institutionId: string;
  firstName: string;
  lastName: string;
  sicilNo: string;
  title: string | null;
  photoUri: string | null;
  status: PersonnelStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  institutionId: string;
  parentId: string | null;
  name: string;
  minimumStaff: number;
  managerPersonnelId: string | null;
  workScheduleType: UnitWorkScheduleType;
  officeStartTime: string;
  officeEndTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonnelUnitHistory {
  id: string;
  personnelId: string;
  unitId: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

export interface ShiftPattern {
  id: string;
  institutionId: string;
  name: string;
  referenceDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftPatternDay {
  id: string;
  patternId: string;
  dayIndex: number;
  shiftType: ShiftType;
  startTime: string | null;
  endTime: string | null;
}

export interface ShiftGroup {
  id: string;
  institutionId: string;
  unitId: string;
  name: string;
  patternId: string;
  /** First calendar day of this group's rotation (day index 0 of the pattern). */
  cycleStartDate: string;
  /** @deprecated Use cycleStartDate. Kept for migration compatibility. */
  cycleOffset: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonnelShiftAssignment {
  id: string;
  personnelId: string;
  shiftGroupId: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

export interface PersonnelAbsence {
  id: string;
  personnelId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  notes: string | null;
  createdAt: string;
}

export interface TaskType {
  id: string;
  institutionId: string;
  name: string;
  code: string;
  createdAt: string;
}

export interface Assignment {
  id: string;
  institutionId: string;
  taskTypeId: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  requiredPersonnelCount: number;
  managerPersonnelId: string | null;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentPersonnel {
  id: string;
  assignmentId: string;
  personnelId: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  institutionId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

export interface CalculatedShift {
  date: string;
  shiftType: ShiftType;
  startTime: string | null;
  endTime: string | null;
  cycleDayIndex: number;
}

export interface PersonnelPresence {
  personnel: Personnel;
  unit: Unit | null;
  shiftGroup: ShiftGroup | null;
  shift: CalculatedShift;
  status: 'ON_DUTY' | 'ON_ASSIGNMENT' | 'ABSENT';
  assignmentTitle?: string;
  assignmentTime?: string;
}

export interface CreatePersonnelInput {
  firstName: string;
  lastName: string;
  sicilNo: string;
  title?: string;
  photoUri?: string | null;
}

export interface UpdatePersonnelInput {
  firstName?: string;
  lastName?: string;
  sicilNo?: string;
  title?: string;
  photoUri?: string | null;
  status?: PersonnelStatus;
}

export interface CreateUnitInput {
  name: string;
  parentId?: string | null;
  minimumStaff?: number;
  managerPersonnelId?: string | null;
  workScheduleType?: UnitWorkScheduleType;
  officeStartTime?: string;
  officeEndTime?: string;
}

export interface UpdateUnitInput {
  name?: string;
  parentId?: string | null;
  minimumStaff?: number;
  managerPersonnelId?: string | null;
  workScheduleType?: UnitWorkScheduleType;
  officeStartTime?: string;
  officeEndTime?: string;
}
