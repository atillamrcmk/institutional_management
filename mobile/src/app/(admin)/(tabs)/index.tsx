import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getDashboardAnalytics } from '@/features/dashboard/services/dashboardAnalytics';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { LoadingState } from '@/shared/components/ErrorState';
import { Screen } from '@/shared/components/layout/Screen';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { StatCard } from '@/shared/components/layout/StatCard';
import { Section } from '@/shared/components/layout/Section';
import { StatsGrid } from '@/shared/components/layout/StatsGrid';
import { ModuleCard } from '@/shared/components/layout/ModuleCard';
import { HeroMetric } from '@/shared/components/charts/HeroMetric';
import { DistributionBar } from '@/shared/components/charts/DistributionBar';
import { HorizontalBarChart } from '@/shared/components/charts/HorizontalBarChart';
import { TrendBars } from '@/shared/components/charts/TrendBars';
import { colors, modules, radius, shadows, spacing, typography } from '@/shared/theme';
import { formatDisplayDate, todayDateString } from '@/shared/utils/id';

export default function AdminDashboard() {
  const router = useRouter();
  const institutionId = useInstitutionId();
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const today = todayDateString();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-analytics', institutionId, user?.id, today],
    queryFn: () =>
      getDashboardAnalytics(institutionId!, user!.id, user?.personnelId ?? null, today),
    enabled: !!institutionId && !!user,
  });

  if (!institutionId || isLoading || !data) {
    return <LoadingState message="Kurum analitikleri hazırlanıyor..." />;
  }

  const delta = data.deltaVsYesterday;
  const deltaLabel =
    delta === null
      ? 'Günlük karşılaştırma'
      : delta === 0
        ? 'Düne göre değişim yok'
        : delta > 0
          ? `Düne göre +${delta} personel`
          : `Düne göre ${delta} personel`;

  return (
    <Screen scroll>
      <PageHeader
        title={tenant?.name ?? 'Kurum Durumu'}
        subtitle={formatDisplayDate(today)}
        module="dashboard"
      />

      <HeroMetric
        label="Bugün kurumda"
        value={data.totalOnDuty}
        hint={`${data.occupancyRate}% doluluk · ${deltaLabel}`}
        module="presence"
      />

      <Section title="Hızlı metrikler">
        <StatsGrid>
          <StatCard label="Aktif personel" value={data.totalPersonnel} module="personnel" />
          <StatCard label="Birim" value={data.unitCount} module="units" />
          <StatCard label="Aktif vardiya" value={data.activeShiftGroups} module="shifts" />
          <StatCard label="İzin / rapor" value={data.absentCount} module="personnel" />
          <StatCard label="Görevlendirme" value={data.onAssignment} module="assignments" />
          <StatCard label="Okunmamış mesaj" value={data.unreadMessages} module="planning" />
        </StatsGrid>
      </Section>

      <Section title="Personel dağılımı" subtitle="Bugünkü durum kırılımı">
        <Card variant="elevated">
          <DistributionBar segments={data.statusSegments} />
        </Card>
      </Section>

      <Section title="Birim yoğunluğu" subtitle="Görevdeki personel">
        <Card variant="elevated">
          <HorizontalBarChart
            items={data.unitBars}
            emptyLabel="Bugün aktif birim personeli yok"
          />
        </Card>
      </Section>

      <Section title="Trend" subtitle={data.weekTrend.length > 2 ? 'Son 7 gün' : 'Dün / bugün'}>
        <Card variant="elevated">
          <TrendBars points={data.weekTrend} />
        </Card>
      </Section>

      <Section title="Kısayollar">
        <View style={styles.shortcuts}>
          <Shortcut
            icon="people-outline"
            label="Kurumda"
            color={modules.presence.main}
            onPress={() => router.push('/(admin)/presence')}
          />
          <Shortcut
            icon="business-outline"
            label="Birimler"
            color={modules.units.main}
            onPress={() => router.push('/(admin)/units')}
          />
          <Shortcut
            icon="mail-outline"
            label="Mesajlar"
            color={modules.dashboard.main}
            onPress={() => router.push('/(admin)/messages')}
          />
          <Shortcut
            icon="person-add-outline"
            label="Davet"
            color={modules.auth.main}
            onPress={() => router.push('/(admin)/users/invite' as never)}
          />
        </View>
      </Section>

      <ModuleCard
        title="Şu An Kurumda"
        subtitle="Detaylı personel listesini görüntüle"
        module="presence"
        onPress={() => router.push('/(admin)/presence')}
      />

      <Section title="Aktif birimler" subtitle={`${data.activeUnits.length} birim`}>
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
              <View style={styles.unitRow}>
                <View style={{ flex: 1 }}>
                  <CardTitle>{item.unit.name}</CardTitle>
                  <CardSubtitle>
                    {item.shiftName ? `${item.shiftName} · ` : ''}
                    {item.count} personel
                  </CardSubtitle>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.count}</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </Section>

      <View style={styles.securityNote}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
        <Text style={styles.securityText}>
          Veriler şifreli oturum (JWT) ile sunucuda tutulur. Oturum SecureStore’da saklanır.
        </Text>
      </View>
    </Screen>
  );
}

function Shortcut({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.shortcut, shadows.sm]}>
      <View style={[styles.shortcutIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  shortcut: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: { ...typography.label, color: colors.text },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    minWidth: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: modules.units.main,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  badgeText: { ...typography.label, color: colors.textInverse },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  securityText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
});
