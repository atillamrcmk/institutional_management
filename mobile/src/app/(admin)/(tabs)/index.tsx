import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '@/features/presence/services/presenceService';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { LoadingState } from '@/shared/components/ErrorState';
import { Screen } from '@/shared/components/layout/Screen';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { StatCard } from '@/shared/components/layout/StatCard';
import { Section } from '@/shared/components/layout/Section';
import { StatsGrid } from '@/shared/components/layout/StatsGrid';
import { ModuleCard } from '@/shared/components/layout/ModuleCard';
import { formatDisplayDate, todayDateString } from '@/shared/utils/id';

export default function AdminDashboard() {
  const router = useRouter();
  const institutionId = useInstitutionId();
  const today = todayDateString();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', institutionId, today],
    queryFn: () => getDashboardStats(institutionId!, today),
    enabled: !!institutionId,
  });

  if (!institutionId || isLoading || !data) {
    return <LoadingState message="Kurum durumu yükleniyor..." />;
  }

  return (
    <Screen scroll>
      <PageHeader
        title="Kurum Durumu"
        subtitle={formatDisplayDate(today)}
        module="dashboard"
      />

      <Section title="Özet">
        <StatsGrid>
          <StatCard label="Bugün Kurumda" value={data.totalOnDuty} module="presence" />
          <StatCard label="Aktif Vardiya" value={data.activeShiftGroups} module="shifts" />
          <StatCard label="İzin / Rapor" value={data.absentCount} module="personnel" />
          <StatCard label="Görevlendirilmiş" value={data.onAssignment} module="assignments" />
          <StatCard label="Uygun Personel" value={data.available} module="planning" wide />
        </StatsGrid>
      </Section>

      <ModuleCard
        title="Şu An Kurumda"
        subtitle="Detaylı personel listesini görüntüle"
        module="presence"
        onPress={() => router.push('/(admin)/presence')}
      />

      <Section title="Aktif Birimler" subtitle={`${data.activeUnits.length} birim`}>
        {data.activeUnits.length === 0 ? (
          <Card variant="outline">
            <CardSubtitle>Aktif birim bulunamadı</CardSubtitle>
          </Card>
        ) : (
          data.activeUnits.map((item) => (
            <Card
              key={item.unit.id}
              onPress={() => router.push(`/(admin)/units/${item.unit.id}`)}
              module="units"
              variant="tinted"
            >
              <CardTitle>{item.unit.name}</CardTitle>
              <CardSubtitle>
                {item.shiftName ? `${item.shiftName} · ` : ''}
                {item.count} personel
              </CardSubtitle>
            </Card>
          ))
        )}
      </Section>
    </Screen>
  );
}
