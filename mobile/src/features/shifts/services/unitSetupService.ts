import { getRepositories } from '@/shared/repositories';
import type { ShiftGroup, ShiftType, UnitWorkScheduleType } from '@/shared/types';
import { todayDateString } from '@/shared/utils/id';

export const DEFAULT_GROUP_NAMES = ['A', 'B', 'C', 'D'];

export interface PatternDayInput {
  shiftType: ShiftType;
  startTime?: string;
  endTime?: string;
}

export interface GroupSetupInput {
  name: string;
  referenceDate: string;
}

export function buildGroupNames(count: number): string[] {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length: count }, (_, i) => letters[i] ?? `G${i + 1}`);
}

export function buildDefaultGroupDrafts(count: number): GroupSetupInput[] {
  return buildGroupNames(count).map((letter) => ({
    name: `${letter} Vardiyası`,
    referenceDate: '',
  }));
}

export async function getUnitPatternId(unitId: string): Promise<string | null> {
  const repos = getRepositories();
  const groups = await repos.shifts.getGroupsByUnit(unitId);
  return groups[0]?.patternId ?? null;
}

/** Birim için döngü + vardiyaları kurar. Her vardiyanın referans tarihi ayrı girilir. */
export async function setupUnitShiftRotation(
  unitId: string,
  institutionId: string,
  options: {
    days: PatternDayInput[];
    groups: GroupSetupInput[];
  },
): Promise<ShiftGroup[]> {
  if (!unitId?.trim()) {
    throw new Error('Birim kimliği eksik. Birim detayından tekrar deneyin.');
  }

  const repos = getRepositories();
  const unit = await repos.units.getById(unitId);
  if (!unit) throw new Error('Birim bulunamadı. Sayfayı yenileyip tekrar deneyin.');

  if (!options.days.length) {
    throw new Error('En az bir döngü günü tanımlayın.');
  }

  if (!options.groups.length) {
    throw new Error('En az bir vardiya tanımlayın.');
  }

  for (const g of options.groups) {
    if (!g.name.trim()) throw new Error('Tüm vardiya adları zorunludur.');
    if (!g.referenceDate.trim()) {
      throw new Error(`${g.name} için referans tarihi girin.`);
    }
  }

  const existing = await repos.shifts.getGroupsByUnit(unitId);
  if (existing.length > 0) {
    throw new Error('Bu birimde zaten vardiya var. Yeni vardiya için "+ Vardiya Ekle" kullanın.');
  }

  await repos.units.update(unitId, { workScheduleType: 'SHIFT' });

  const patternDays = options.days.map((day) => ({
    shiftType: day.shiftType,
    startTime: day.shiftType !== 'OFF' ? day.startTime : undefined,
    endTime: day.shiftType !== 'OFF' ? day.endTime : undefined,
  }));

  const firstReference = options.groups[0].referenceDate;

  const pattern = await repos.shifts.createPattern(
    institutionId,
    `${unit.name} Döngüsü`,
    firstReference,
    patternDays,
  );

  const groups: ShiftGroup[] = [];
  for (const input of options.groups) {
    const group = await repos.shifts.createGroup(
      unitId,
      input.name.trim(),
      pattern.id,
      input.referenceDate.trim(),
    );
    groups.push(group);
  }

  return groups;
}

/** Mevcut birime tek vardiya ekler (aynı döngüyü kullanır). */
export async function addShiftGroupToUnit(
  unitId: string,
  input: GroupSetupInput,
): Promise<ShiftGroup> {
  if (!input.name.trim() || !input.referenceDate.trim()) {
    throw new Error('Vardiya adı ve referans tarihi zorunludur.');
  }

  const repos = getRepositories();
  const patternId = await getUnitPatternId(unitId);
  if (!patternId) {
    throw new Error('Önce birim için döngü ve ilk vardiyayı oluşturun.');
  }

  await repos.units.update(unitId, { workScheduleType: 'SHIFT' });

  return repos.shifts.createGroup(
    unitId,
    input.name.trim(),
    patternId,
    input.referenceDate.trim(),
  );
}

export interface UnitSetupStatus {
  workScheduleType: UnitWorkScheduleType;
  hasShifts: boolean;
  shiftCount: number;
  hasPersonnel: boolean;
  personnelCount: number;
  shiftsWithPersonnel: number;
  allShiftsHavePersonnel: boolean;
  isComplete: boolean;
  patternId: string | null;
}

export async function getUnitSetupStatus(unitId: string): Promise<UnitSetupStatus> {
  const repos = getRepositories();
  const unit = await repos.units.getById(unitId);
  const groups = await repos.shifts.getGroupsByUnit(unitId);
  const personnel = await repos.units.getActivePersonnelForUnit(unitId);

  let shiftsWithPersonnel = 0;
  for (const group of groups) {
    const inGroup = await repos.shifts.getPersonnelInGroup(group.id);
    if (inGroup.length > 0) shiftsWithPersonnel += 1;
  }

  const hasShifts = groups.length > 0;
  const hasPersonnel = personnel.length > 0;
  const allShiftsHavePersonnel = hasShifts && shiftsWithPersonnel === groups.length;
  const workScheduleType = unit?.workScheduleType ?? 'OFFICE';

  const isComplete =
    workScheduleType === 'OFFICE'
      ? hasPersonnel
      : hasPersonnel && (!hasShifts || allShiftsHavePersonnel);

  return {
    workScheduleType,
    hasShifts,
    shiftCount: groups.length,
    hasPersonnel,
    personnelCount: personnel.length,
    shiftsWithPersonnel,
    allShiftsHavePersonnel,
    isComplete,
    patternId: groups[0]?.patternId ?? null,
  };
}
