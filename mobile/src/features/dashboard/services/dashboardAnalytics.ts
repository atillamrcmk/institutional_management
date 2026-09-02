import { getDashboardStats, getPresenceForDate } from '@/features/presence/services/presenceService';
import { getRepositories, isUsingApiRepositories } from '@/shared/repositories';
import { modules } from '@/shared/theme';
import { todayDateString, addDaysToDateString } from '@/shared/utils/id';
import type { BarItem } from '@/shared/components/charts/HorizontalBarChart';
import type { Segment } from '@/shared/components/charts/DistributionBar';

export interface DashboardAnalytics {
  date: string;
  totalOnDuty: number;
  activeShiftGroups: number;
  absentCount: number;
  onAssignment: number;
  available: number;
  totalPersonnel: number;
  unitCount: number;
  unreadMessages: number;
  occupancyRate: number;
  deltaVsYesterday: number | null;
  statusSegments: Segment[];
  unitBars: BarItem[];
  weekTrend: Array<{ date: string; label: string; onDuty: number }>;
  activeUnits: Awaited<ReturnType<typeof getDashboardStats>>['activeUnits'];
}

export async function getDashboardAnalytics(
  institutionId: string,
  userId: string,
  personnelId: string | null,
  date: string = todayDateString(),
): Promise<DashboardAnalytics> {
  const repos = getRepositories();
  const [base, personnel, units, unreadMessages] = await Promise.all([
    getDashboardStats(institutionId, date),
    repos.personnel.getAll(institutionId),
    repos.units.getAll(institutionId),
    repos.messages.getUnreadCount(institutionId, userId, personnelId).catch(() => 0),
  ]);

  const totalPersonnel = personnel.filter((p) => p.status === 'ACTIVE').length;
  const present = base.available + base.onAssignment;
  const occupancyRate =
    totalPersonnel === 0 ? 0 : Math.round((present / totalPersonnel) * 100);

  const statusSegments: Segment[] = [
    {
      key: 'duty',
      label: 'Görevde',
      value: base.available,
      color: modules.presence.main,
    },
    {
      key: 'assignment',
      label: 'Görevlendirme',
      value: base.onAssignment,
      color: modules.assignments.main,
    },
    {
      key: 'absent',
      label: 'İzin/Rapor',
      value: base.absentCount,
      color: modules.shifts.main,
    },
    {
      key: 'other',
      label: 'Kapalı / Diğer',
      value: Math.max(0, totalPersonnel - present - base.absentCount),
      color: '#94A3B8',
    },
  ];

  const unitBars: BarItem[] = base.activeUnits.slice(0, 8).map((item, index) => ({
    label: item.unit.name,
    value: item.count,
    color: unitColor(index),
  }));

  const weekTrend: DashboardAnalytics['weekTrend'] = [];
  let deltaVsYesterday: number | null = null;

  // API modunda 7 gün × presence pahalı; dün + bugün yeter.
  const daysBack = isUsingApiRepositories() ? 1 : 6;
  for (let i = daysBack; i >= 0; i--) {
    const d = addDaysToDateString(date, -i);
    if (i === 0) {
      weekTrend.push({ date: d, label: i === 0 && daysBack === 1 ? 'Bugün' : d.slice(8), onDuty: present });
      continue;
    }
    try {
      const presence = await getPresenceForDate(institutionId, d);
      const onDuty = presence.filter(
        (p) => p.status === 'ON_DUTY' || p.status === 'ON_ASSIGNMENT',
      ).length;
      weekTrend.push({
        date: d,
        label: daysBack === 1 ? 'Dün' : d.slice(8),
        onDuty,
      });
      if (i === 1) deltaVsYesterday = present - onDuty;
    } catch {
      weekTrend.push({ date: d, label: daysBack === 1 ? 'Dün' : d.slice(8), onDuty: 0 });
    }
  }

  return {
    date,
    totalOnDuty: base.totalOnDuty,
    activeShiftGroups: base.activeShiftGroups,
    absentCount: base.absentCount,
    onAssignment: base.onAssignment,
    available: base.available,
    totalPersonnel,
    unitCount: units.length,
    unreadMessages,
    occupancyRate,
    deltaVsYesterday,
    statusSegments,
    unitBars,
    weekTrend,
    activeUnits: base.activeUnits,
  };
}

function unitColor(index: number): string {
  const palette = [
    modules.units.main,
    modules.presence.main,
    modules.dashboard.main,
    modules.shifts.main,
    modules.personnel.main,
    modules.planning.main,
  ];
  return palette[index % palette.length];
}
