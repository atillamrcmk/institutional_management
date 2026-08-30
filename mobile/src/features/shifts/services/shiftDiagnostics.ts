import { calculateShiftForDate, getShiftTypeLabel } from '@/features/shifts/engine/shiftCalculator';
import { getRepositories } from '@/shared/repositories';
import type { ShiftGroup } from '@/shared/types';
import { todayDateString } from '@/shared/utils/id';

export interface GroupDiagnostic {
  groupId: string;
  groupName: string;
  unitId: string;
  unitName: string;
  patternName: string;
  cycleStartDate: string;
  shiftType: string;
  cycleDayIndex: number;
  personnelCount: number;
}

export interface UnitDiagnostic {
  unitId: string;
  unitName: string;
  groupCount: number;
  dayGroups: string[];
  nightGroups: string[];
  fullGroups: string[];
  offGroups: string[];
  collisions: string[];
}

export interface ShiftDiagnosticReport {
  date: string;
  institutionId: string;
  totalGroups: number;
  totalUnitsWithGroups: number;
  units: UnitDiagnostic[];
  groups: GroupDiagnostic[];
}

export async function buildShiftDiagnosticReport(
  institutionId: string,
  date: string = todayDateString(),
): Promise<ShiftDiagnosticReport> {
  const repos = getRepositories();
  const units = await repos.units.getAll(institutionId);
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));
  const patterns = await repos.shifts.getPatterns(institutionId);
  const patternNameById = new Map(patterns.map((p) => [p.id, p.name]));

  const allGroups = await repos.shifts.getAllGroups(institutionId);
  const groups: GroupDiagnostic[] = [];

  for (const group of allGroups) {
    const patternDays = await repos.shifts.getPatternDays(group.patternId);
    const shift = calculateShiftForDate(patternDays, group.cycleStartDate, date);
    const personnel = await repos.shifts.getPersonnelInGroup(group.id);

    groups.push({
      groupId: group.id,
      groupName: group.name,
      unitId: group.unitId,
      unitName: unitNameById.get(group.unitId) ?? '?',
      patternName: patternNameById.get(group.patternId) ?? '?',
      cycleStartDate: group.cycleStartDate,
      shiftType: getShiftTypeLabel(shift.shiftType),
      cycleDayIndex: shift.cycleDayIndex,
      personnelCount: personnel.length,
    });
  }

  const unitMap = new Map<string, UnitDiagnostic>();

  for (const g of groups) {
    let unit = unitMap.get(g.unitId);
    if (!unit) {
      unit = {
        unitId: g.unitId,
        unitName: g.unitName,
        groupCount: 0,
        dayGroups: [],
        nightGroups: [],
        fullGroups: [],
        offGroups: [],
        collisions: [],
      };
      unitMap.set(g.unitId, unit);
    }
    unit.groupCount += 1;
    if (g.shiftType === 'Gündüz') unit.dayGroups.push(g.groupName);
    else if (g.shiftType === 'Gece') unit.nightGroups.push(g.groupName);
    else if (g.shiftType === '24 Saat') unit.fullGroups.push(g.groupName);
    else unit.offGroups.push(g.groupName);
  }

  for (const unit of unitMap.values()) {
    if (unit.dayGroups.length > 1) {
      unit.collisions.push(`Gündüz çakışması: ${unit.dayGroups.join(', ')}`);
    }
    if (unit.nightGroups.length > 1) {
      unit.collisions.push(`Gece çakışması: ${unit.nightGroups.join(', ')}`);
    }
    if (unit.fullGroups.length > 1) {
      unit.collisions.push(`24 saat çakışması: ${unit.fullGroups.join(', ')}`);
    }
  }

  return {
    date,
    institutionId,
    totalGroups: allGroups.length,
    totalUnitsWithGroups: unitMap.size,
    units: Array.from(unitMap.values()).sort((a, b) =>
      a.unitName.localeCompare(b.unitName, 'tr'),
    ),
    groups: groups.sort((a, b) => {
      const unitCmp = a.unitName.localeCompare(b.unitName, 'tr');
      if (unitCmp !== 0) return unitCmp;
      return a.groupName.localeCompare(b.groupName, 'tr');
    }),
  };
}

export function formatDiagnosticReport(report: ShiftDiagnosticReport): string {
  const lines: string[] = [
    `=== Vardiya Tanılama (${report.date}) ===`,
    `Toplam grup: ${report.totalGroups}`,
    `Vardiyalı birim: ${report.totalUnitsWithGroups}`,
    '',
  ];

  for (const unit of report.units) {
    lines.push(`[${unit.unitName}] ${unit.groupCount} grup`);
    lines.push(`  Gündüz: ${unit.dayGroups.join(', ') || '—'}`);
    lines.push(`  Gece: ${unit.nightGroups.join(', ') || '—'}`);
    lines.push(`  24 Saat: ${unit.fullGroups.join(', ') || '—'}`);
    lines.push(`  İzin: ${unit.offGroups.join(', ') || '—'}`);
    for (const c of unit.collisions) {
      lines.push(`  ⚠ ${c}`);
    }
    lines.push('');
  }

  for (const g of report.groups) {
    lines.push(
      `${g.unitName} · ${g.groupName}: ${g.shiftType} (gün ${g.cycleDayIndex + 1}, başlangıç ${g.cycleStartDate}, ${g.personnelCount} personel)`,
    );
  }

  return lines.join('\n');
}

export async function logShiftDiagnostics(
  institutionId: string,
  date: string = todayDateString(),
): Promise<ShiftDiagnosticReport> {
  const report = await buildShiftDiagnosticReport(institutionId, date);
  console.log(formatDiagnosticReport(report));
  return report;
}

export function findGroupsWithMissingStartDate(groups: ShiftGroup[]): ShiftGroup[] {
  return groups.filter((g) => !g.cycleStartDate?.trim());
}
