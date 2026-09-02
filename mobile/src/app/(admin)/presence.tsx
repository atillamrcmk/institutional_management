import { useState, useMemo } from 'react';
import { FlatList, View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getPresenceForDate, getOfficeUnitsSummary } from '@/features/presence/services/presenceService';
import { getInstitutionShiftOverview, getScheduleActiveSlots } from '@/features/shifts/services/scheduleService';
import { shiftQueryKeys } from '@/features/shifts/constants/shiftQueryKeys';
import { formatSlotLabel } from '@/features/shifts/constants/shiftDefaults';
import { getRepositories } from '@/shared/repositories';
import { PersonnelCard } from '@/shared/components/PersonnelCard';
import { ShiftBadge } from '@/shared/components/Badge';
import { CardTitle, CardSubtitle } from '@/shared/components/Card';
import { LoadingState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { Chip } from '@/shared/components/layout/Chip';
import { Input } from '@/shared/components/Input';
import { colors, modules, radius, spacing, typography } from '@/shared/theme';
import type { Unit } from '@/shared/types';
import { formatDisplayDate, getPersonnelFullName, todayDateString } from '@/shared/utils/id';

export default function PresenceScreen() {
  const router = useRouter();
  const institutionId = useAuthStore((s) => s.institutionId)!;
  const today = todayDateString();
  const [unitFilter, setUnitFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [personnelExpanded, setPersonnelExpanded] = useState(false);

  const { data: units } = useQuery({
    queryKey: ['units', institutionId],
    queryFn: () => getRepositories().units.getAll(institutionId),
  });

  const { data: overview, isLoading: shiftsLoading } = useQuery({
    queryKey: shiftQueryKeys.overview(institutionId, today),
    queryFn: () => getInstitutionShiftOverview(institutionId, today),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['presence', institutionId, unitFilter],
    queryFn: () =>
      getPresenceForDate(institutionId, today, {
        unitId: unitFilter,
      }),
  });

  const filteredOverview = unitFilter
    ? overview?.filter((item) => item.unitId === unitFilter)
    : overview;

  const { data: officeUnits } = useQuery({
    queryKey: ['office-units', institutionId, today, unitFilter],
    queryFn: () => getOfficeUnitsSummary(institutionId, today),
  });

  const filteredOfficeUnits = unitFilter
    ? officeUnits?.filter((item) => item.unitId === unitFilter)
    : officeUnits;

  const filteredPresence = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((item) => {
      const name = getPersonnelFullName(item.personnel).toLowerCase();
      return (
        name.includes(q) ||
        item.personnel.sicilNo.toLowerCase().includes(q) ||
        (item.unit?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [data, search]);

  const presencePreview = filteredPresence
    .slice(0, 3)
    .map((item) => getPersonnelFullName(item.personnel))
    .join(', ');

  const hasShiftOverview = (filteredOverview?.length ?? 0) > 0;
  const hasOfficeOverview = (filteredOfficeUnits?.length ?? 0) > 0;

  if (isLoading || shiftsLoading) {
    return <LoadingState message="Personel durumu yükleniyor..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filterContent}>
        <Chip
          label="Tümü"
          selected={!unitFilter}
          onPress={() => setUnitFilter(undefined)}
          color={modules.presence.main}
        />
        {units?.map((unit: Unit) => (
          <Chip
            key={unit.id}
            label={unit.name}
            selected={unitFilter === unit.id}
            onPress={() => setUnitFilter(unit.id)}
            color={modules.presence.main}
          />
        ))}
      </ScrollView>

      <View style={styles.searchBar}>
        <Input placeholder="Personel ara..." value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={personnelExpanded ? filteredPresence : []}
        keyExtractor={(item) => item.personnel.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <Text style={styles.sectionTitle}>{formatDisplayDate(today)} · Aktif Görevler</Text>

            {!hasShiftOverview && !hasOfficeOverview ? (
              <Text style={styles.emptyShifts}>
                Bugün görevde personel yok. Mesai birimlerine personel ekleyin veya vardiyalı
                birimlerde döngü başlangıç tarihlerini kontrol edin.
              </Text>
            ) : null}

            {filteredOfficeUnits?.map((officeItem) => (
              <View key={officeItem.unitId} style={styles.unitSection}>
                <Text style={styles.unitLabel}>{officeItem.unitName} · Mesai</Text>
                <Pressable
                  onPress={() => router.push(`/(admin)/units/${officeItem.unitId}`)}
                  style={({ pressed }) => [styles.shiftCard, pressed && styles.shiftCardPressed]}
                >
                  <View style={styles.shiftCardTop}>
                    <View style={styles.shiftCardTitles}>
                      <CardTitle>Mesai</CardTitle>
                      <CardSubtitle>
                        {officeItem.startTime} – {officeItem.endTime}
                      </CardSubtitle>
                    </View>
                    <ShiftBadge shiftType="DAY" />
                  </View>
                  <Text style={styles.personnelCount}>
                    {officeItem.personnel.length} personel
                    {officeItem.personnel.length > 0
                      ? ` · ${officeItem.personnel
                          .slice(0, 3)
                          .map((p) => getPersonnelFullName(p))
                          .join(', ')}${officeItem.personnel.length > 3 ? '…' : ''}`
                      : ''}
                  </Text>
                  <Text style={styles.tapHint}>Birim detayı için dokunun →</Text>
                </Pressable>
              </View>
            ))}

            {filteredOverview?.map((unitItem) => (
                <View key={unitItem.unitId} style={styles.unitSection}>
                  <Text style={styles.unitLabel}>{unitItem.unitName}</Text>

                  {unitItem.schedule.collisions.map((msg) => (
                    <Text key={msg} style={styles.collision}>
                      ⚠ {msg}
                    </Text>
                  ))}

                  {getScheduleActiveSlots(unitItem.schedule).length === 0 ? (
                    <Text style={styles.emptyShifts}>Bu birimde bugün görevde vardiya yok</Text>
                  ) : (
                    getScheduleActiveSlots(unitItem.schedule).map((slot) => (
                      <Pressable
                        key={`${unitItem.unitId}-${slot.group.id}-${slot.shiftType}`}
                        onPress={() => router.push(`/(admin)/shifts/${slot.group.id}`)}
                        style={({ pressed }) => [styles.shiftCard, pressed && styles.shiftCardPressed]}
                      >
                        <View style={styles.shiftCardTop}>
                          <View style={styles.shiftCardTitles}>
                            <CardTitle>{slot.group.name}</CardTitle>
                            <CardSubtitle>
                              {formatSlotLabel(slot.startTime, slot.endTime, slot.shiftType)}
                            </CardSubtitle>
                          </View>
                          <ShiftBadge shiftType={slot.shiftType} />
                        </View>
                        <Text style={styles.personnelCount}>
                          {slot.personnel.length} personel
                          {slot.personnel.length > 0
                            ? ` · ${slot.personnel
                                .slice(0, 3)
                                .map((p) => getPersonnelFullName(p))
                                .join(', ')}${slot.personnel.length > 3 ? '…' : ''}`
                            : ''}
                        </Text>
                        <Text style={styles.tapHint}>Personeli görmek için dokunun →</Text>
                      </Pressable>
                    ))
                  )}
                </View>
              ))}

            {filteredPresence.length === 0 ? (
              <EmptyState title="Kurumda personel yok" module="presence" />
            ) : (
              <Pressable
                onPress={() => setPersonnelExpanded((value) => !value)}
                style={({ pressed }) => [
                  styles.personnelToggle,
                  pressed && styles.shiftCardPressed,
                ]}
              >
                <View style={styles.personnelToggleText}>
                  <Text style={styles.sectionTitle}>
                    Görevdeki Personel ({filteredPresence.length})
                  </Text>
                  {!personnelExpanded && presencePreview ? (
                    <Text style={styles.personnelPreview} numberOfLines={2}>
                      {presencePreview}
                      {filteredPresence.length > 3 ? '…' : ''}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.toggleLabel}>
                  {personnelExpanded ? 'Gizle ▴' : 'Tümünü görüntüle ▾'}
                </Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <PersonnelCard
            item={item}
            onPress={() => router.push(`/(admin)/personnel/${item.personnel.id}`)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { maxHeight: 52 },
  filterContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  searchBar: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  headerSection: { gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text },
  personnelToggle: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  personnelToggleText: { flex: 1, gap: 2 },
  personnelPreview: { ...typography.bodySmall, color: colors.textMuted },
  toggleLabel: { ...typography.caption, color: modules.presence.main, fontWeight: '700' },
  unitSection: { gap: spacing.sm, marginBottom: spacing.sm },
  unitLabel: { ...typography.label, color: modules.presence.main, fontWeight: '700' },
  collision: { ...typography.caption, color: colors.warning },
  emptyShifts: { ...typography.bodySmall, color: colors.textMuted, fontStyle: 'italic' },
  shiftCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  shiftCardPressed: { opacity: 0.92, backgroundColor: colors.primaryMuted },
  shiftCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  shiftCardTitles: { flex: 1 },
  personnelCount: { ...typography.bodySmall, color: colors.text },
  tapHint: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
});
