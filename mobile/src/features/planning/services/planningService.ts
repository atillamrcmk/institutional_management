import { getRepositories } from '@/shared/repositories';
import type { Unit } from '@/shared/types';
import { todayDateString } from '@/shared/utils/id';
import { getPresenceForDate } from '@/features/presence/services/presenceService';

export interface StaffingAlert {
  unit: Unit;
  currentCount: number;
  minimumStaff: number;
  deficit: number;
}

export interface PlanningAlert {
  id: string;
  type: 'UNDERSTAFFED' | 'OVER_ASSIGNED';
  title: string;
  message: string;
  unitId?: string;
}

export async function getStaffingAlerts(
  institutionId: string,
  date: string = todayDateString(),
): Promise<StaffingAlert[]> {
  const repos = getRepositories();
  const units = await repos.units.getAll(institutionId);
  const presence = await getPresenceForDate(institutionId, date);
  const alerts: StaffingAlert[] = [];

  for (const unit of units) {
    if (unit.minimumStaff <= 0) continue;
    const onDutyInUnit = presence.filter(
      (p) => p.unit?.id === unit.id && (p.status === 'ON_DUTY' || p.status === 'ON_ASSIGNMENT'),
    ).length;
    if (onDutyInUnit < unit.minimumStaff) {
      alerts.push({
        unit,
        currentCount: onDutyInUnit,
        minimumStaff: unit.minimumStaff,
        deficit: unit.minimumStaff - onDutyInUnit,
      });
    }
  }

  return alerts.sort((a, b) => b.deficit - a.deficit);
}

export async function getPlanningAlerts(
  institutionId: string,
  date: string = todayDateString(),
): Promise<PlanningAlert[]> {
  const staffing = await getStaffingAlerts(institutionId, date);
  const alerts: PlanningAlert[] = staffing.map((item) => ({
    id: `understaffed-${item.unit.id}`,
    type: 'UNDERSTAFFED',
    title: item.unit.name,
    message: `${item.deficit} personel eksik (${item.currentCount}/${item.minimumStaff})`,
    unitId: item.unit.id,
  }));

  const repos = getRepositories();
  const assignments = await repos.assignments.getAll(institutionId, { date });
  for (const assignment of assignments) {
    const assigned = await repos.assignments.getAssignedPersonnelIds(assignment.id);
    if (assigned.length > assignment.requiredPersonnelCount) {
      alerts.push({
        id: `over-${assignment.id}`,
        type: 'OVER_ASSIGNED',
        title: assignment.title,
        message: `Gerekenden fazla personel atandı (${assigned.length}/${assignment.requiredPersonnelCount})`,
      });
    }
  }

  return alerts;
}
