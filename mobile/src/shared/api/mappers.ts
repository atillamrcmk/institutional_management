import type {
  Assignment,
  CalculatedShift,
  InboxMessage,
  Message,
  Personnel,
  PersonnelAbsence,
  PersonnelShiftAssignment,
  PersonnelUnitHistory,
  ShiftGroup,
  ShiftPattern,
  ShiftPatternDay,
  TaskType,
  Unit,
  User,
} from '@/shared/types';
import { nowIso, todayDateString } from '@/shared/utils/id';
import { getTenantId } from './session';

/**
 * Sunucu satırları PostgreSQL'den snake_case gelir ve tenant DB'si tek kuruma ait
 * olduğu için `institution_id` taşımaz. Eşleyiciler eksik kurum kimliğini oturumdaki
 * tenant'tan tamamlar.
 */
function resolveInstitutionId(institutionId?: string): string {
  return institutionId ?? getTenantId() ?? '';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function timestamp(value: unknown): string {
  return typeof value === 'string' ? value : nowIso();
}

// --- Satır tipleri ----------------------------------------------------------

export interface PersonnelRow {
  id: string;
  first_name: string;
  last_name: string;
  sicil_no: string;
  title?: string | null;
  photo_uri?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UnitRow {
  id: string;
  parent_id?: string | null;
  name: string;
  minimum_staff?: number | null;
  manager_personnel_id?: string | null;
  work_schedule_type?: string | null;
  office_start_time?: string | null;
  office_end_time?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserRow {
  id: string;
  personnel_id?: string | null;
  display_name: string;
  email?: string | null;
  role: string;
  can_message_admins?: boolean | null;
  is_active?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface ShiftPatternRow {
  id: string;
  name: string;
  reference_date: string;
  created_at?: string;
  updated_at?: string;
  days?: ShiftPatternDayRow[];
}

export interface ShiftPatternDayRow {
  id?: string;
  pattern_id?: string;
  day_index: number;
  shift_type: string;
  start_time?: string | null;
  end_time?: string | null;
}

export interface ShiftGroupRow {
  id: string;
  unit_id: string;
  name: string;
  pattern_id: string;
  cycle_start_date?: string | null;
  cycle_offset?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface PersonnelUnitHistoryRow {
  id: string;
  personnel_id: string;
  unit_id: string;
  started_at?: string;
  ended_at?: string | null;
  created_at?: string;
}

export interface PersonnelShiftAssignmentRow {
  id: string;
  personnel_id: string;
  shift_group_id: string;
  started_at?: string;
  ended_at?: string | null;
  created_at?: string;
}

export interface PersonnelAbsenceRow {
  id: string;
  personnel_id: string;
  type: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  created_at?: string;
}

export interface TaskTypeRow {
  id: string;
  name: string;
  code: string;
  created_at?: string;
}

export interface AssignmentRow {
  id: string;
  task_type_id: string;
  title: string;
  description?: string | null;
  date: string;
  start_time: string;
  end_time?: string | null;
  required_personnel_count?: number | null;
  manager_personnel_id?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MessageRow {
  id: string;
  sender_user_id: string;
  sender_display_name?: string | null;
  subject: string;
  body: string;
  audience_type: string;
  unit_id?: string | null;
  created_at?: string;
}

export interface InboxMessageRow extends MessageRow {
  recipient_id: string;
  read_at?: string | null;
}

export interface CalculatedShiftPayload {
  date?: string;
  shiftType?: string;
  startTime?: string | null;
  endTime?: string | null;
  cycleDayIndex?: number;
}

// --- Eşleyiciler ------------------------------------------------------------

export function mapPersonnel(row: PersonnelRow, institutionId?: string): Personnel {
  return {
    id: row.id,
    institutionId: resolveInstitutionId(institutionId),
    firstName: text(row.first_name),
    lastName: text(row.last_name),
    sicilNo: text(row.sicil_no),
    title: nullableText(row.title),
    photoUri: nullableText(row.photo_uri),
    status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at ?? row.created_at),
  };
}

export function mapUnit(row: UnitRow, institutionId?: string): Unit {
  return {
    id: row.id,
    institutionId: resolveInstitutionId(institutionId),
    parentId: nullableText(row.parent_id),
    name: text(row.name),
    minimumStaff: Number(row.minimum_staff ?? 0),
    managerPersonnelId: nullableText(row.manager_personnel_id),
    workScheduleType: row.work_schedule_type === 'SHIFT' ? 'SHIFT' : 'OFFICE',
    officeStartTime: nullableText(row.office_start_time) ?? '08:00',
    officeEndTime: nullableText(row.office_end_time) ?? '17:00',
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at ?? row.created_at),
  };
}

export function mapUser(row: UserRow, institutionId?: string): User {
  return {
    id: row.id,
    institutionId: resolveInstitutionId(institutionId),
    personnelId: nullableText(row.personnel_id),
    displayName: text(row.display_name),
    role: (row.role as User['role']) ?? 'PERSONNEL',
    // Sunucuda PIN yoktur; giriş e-posta + parola ile yapılır.
    pin: null,
    canMessageAdmins: Boolean(row.can_message_admins),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at ?? row.created_at),
  };
}

export function mapShiftPattern(row: ShiftPatternRow, institutionId?: string): ShiftPattern {
  return {
    id: row.id,
    institutionId: resolveInstitutionId(institutionId),
    name: text(row.name),
    referenceDate: text(row.reference_date) || todayDateString(),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at ?? row.created_at),
  };
}

/**
 * `/shifts/patterns/:id/days` dışındaki uçlar `pattern_id` taşımaz; çağıran taraf
 * bildiği deseni `fallbackPatternId` ile geçirir.
 */
export function mapShiftPatternDay(
  row: ShiftPatternDayRow,
  fallbackPatternId = '',
): ShiftPatternDay {
  const patternId = row.pattern_id ?? fallbackPatternId;
  return {
    id: row.id ?? `${patternId}-${row.day_index}`,
    patternId,
    dayIndex: Number(row.day_index ?? 0),
    shiftType: (row.shift_type as ShiftPatternDay['shiftType']) ?? 'OFF',
    startTime: nullableText(row.start_time),
    endTime: nullableText(row.end_time),
  };
}

/**
 * `cycle_start_date` eski kayıtlarda boş olabilir; desenin referans tarihi yedek olarak
 * kullanılır (sunucu vardiya hesabında da aynı yedeği uygular).
 */
export function mapShiftGroup(
  row: ShiftGroupRow,
  options: { institutionId?: string; referenceDate?: string | null } = {},
): ShiftGroup {
  return {
    id: row.id,
    institutionId: resolveInstitutionId(options.institutionId),
    unitId: text(row.unit_id),
    name: text(row.name),
    patternId: text(row.pattern_id),
    cycleStartDate:
      nullableText(row.cycle_start_date) ??
      nullableText(options.referenceDate) ??
      todayDateString(),
    cycleOffset: Number(row.cycle_offset ?? 0),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at ?? row.created_at),
  };
}

export function mapPersonnelUnitHistory(row: PersonnelUnitHistoryRow): PersonnelUnitHistory {
  return {
    id: row.id,
    personnelId: text(row.personnel_id),
    unitId: text(row.unit_id),
    startedAt: timestamp(row.started_at),
    endedAt: nullableText(row.ended_at),
    createdAt: timestamp(row.created_at ?? row.started_at),
  };
}

export function mapPersonnelShiftAssignment(
  row: PersonnelShiftAssignmentRow,
): PersonnelShiftAssignment {
  return {
    id: row.id,
    personnelId: text(row.personnel_id),
    shiftGroupId: text(row.shift_group_id),
    startedAt: timestamp(row.started_at),
    endedAt: nullableText(row.ended_at),
    createdAt: timestamp(row.created_at ?? row.started_at),
  };
}

export function mapPersonnelAbsence(row: PersonnelAbsenceRow): PersonnelAbsence {
  return {
    id: row.id,
    personnelId: text(row.personnel_id),
    type: (row.type as PersonnelAbsence['type']) ?? 'LEAVE',
    startDate: text(row.start_date),
    endDate: text(row.end_date),
    notes: nullableText(row.notes),
    createdAt: timestamp(row.created_at),
  };
}

export function mapTaskType(row: TaskTypeRow, institutionId?: string): TaskType {
  return {
    id: row.id,
    institutionId: resolveInstitutionId(institutionId),
    name: text(row.name),
    code: text(row.code),
    createdAt: timestamp(row.created_at),
  };
}

export function mapAssignment(row: AssignmentRow, institutionId?: string): Assignment {
  return {
    id: row.id,
    institutionId: resolveInstitutionId(institutionId),
    taskTypeId: text(row.task_type_id),
    title: text(row.title),
    description: nullableText(row.description),
    date: text(row.date),
    startTime: text(row.start_time),
    endTime: nullableText(row.end_time),
    requiredPersonnelCount: Number(row.required_personnel_count ?? 1),
    managerPersonnelId: nullableText(row.manager_personnel_id),
    status: (row.status as Assignment['status']) ?? 'PLANNED',
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at ?? row.created_at),
  };
}

export function mapMessage(row: MessageRow, institutionId?: string): Message {
  return {
    id: row.id,
    institutionId: resolveInstitutionId(institutionId),
    senderUserId: text(row.sender_user_id),
    senderDisplayName: nullableText(row.sender_display_name) ?? 'Kullanıcı',
    subject: text(row.subject),
    body: text(row.body),
    audienceType: (row.audience_type as Message['audienceType']) ?? 'PERSONNEL',
    unitId: nullableText(row.unit_id),
    createdAt: timestamp(row.created_at),
  };
}

export function mapInboxMessage(row: InboxMessageRow, institutionId?: string): InboxMessage {
  return {
    ...mapMessage(row, institutionId),
    recipientId: text(row.recipient_id),
    readAt: nullableText(row.read_at),
  };
}

/** Hesaplanmış vardiya sunucudan zaten camelCase gelir; yalnızca normalize edilir. */
export function mapCalculatedShift(
  payload: CalculatedShiftPayload | null | undefined,
  date: string,
): CalculatedShift {
  return {
    date: payload?.date ?? date,
    shiftType: (payload?.shiftType as CalculatedShift['shiftType']) ?? 'OFF',
    startTime: nullableText(payload?.startTime),
    endTime: nullableText(payload?.endTime),
    cycleDayIndex: Number(payload?.cycleDayIndex ?? 0),
  };
}
