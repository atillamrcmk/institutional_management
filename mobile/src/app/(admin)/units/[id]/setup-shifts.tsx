import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { getRepositories } from '@/shared/repositories';
import {
  buildDefaultGroupDrafts,
  setupUnitShiftRotation,
  type GroupSetupInput,
} from '@/features/shifts/services/unitSetupService';
import { calculateShiftForDate, getShiftTypeLabel } from '@/features/shifts/engine/shiftCalculator';
import { invalidateShiftQueries } from '@/features/shifts/utils/invalidateShiftQueries';
import { formatCycleSummary } from '@/features/shifts/constants/shiftDefaults';
import {
  ShiftPatternDayEditor,
  type PatternDayInput,
} from '@/shared/components/ShiftPatternDayEditor';
import { PRESET_CYCLE_MERKEZ } from '@/features/shifts/constants/shiftDefaults';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { colors, spacing, typography } from '@/shared/theme';
import { formatDisplayDate, todayDateString } from '@/shared/utils/id';

function resolveRouteId(id: string | string[] | undefined): string | undefined {
  if (Array.isArray(id)) return id[0];
  return id;
}

export default function UnitSetupShiftsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const unitId = resolveRouteId(params.id);
  const router = useRouter();
  const institutionId = useInstitutionId()!;
  const queryClient = useQueryClient();
  const [days, setDays] = useState<PatternDayInput[]>([...PRESET_CYCLE_MERKEZ]);
  const [groupCount, setGroupCount] = useState('4');
  const [groupDrafts, setGroupDrafts] = useState<GroupSetupInput[]>(buildDefaultGroupDrafts(4));
  const [saving, setSaving] = useState(false);

  const { data: unit, isLoading } = useQuery({
    queryKey: ['unit-name', unitId],
    queryFn: () => getRepositories().units.getById(unitId!),
    enabled: !!unitId,
  });

  useEffect(() => {
    const count = parseInt(groupCount, 10);
    if (isNaN(count) || count < 1 || count > 8) return;
    setGroupDrafts((prev) => {
      const defaults = buildDefaultGroupDrafts(count);
      return defaults.map((d, i) => ({
        name: prev[i]?.name || d.name,
        referenceDate: prev[i]?.referenceDate ?? '',
      }));
    });
  }, [groupCount]);

  const updateGroupDraft = (index: number, patch: Partial<GroupSetupInput>) => {
    setGroupDrafts((prev) =>
      prev.map((g, i) => (i === index ? { ...g, ...patch } : g)),
    );
  };

  const handleCreate = async () => {
    if (!unitId) {
      Alert.alert('Hata', 'Birim bulunamadı. Geri dönüp tekrar deneyin.');
      return;
    }
    if (days.length === 0) {
      Alert.alert('Eksik bilgi', 'Döngüye en az bir gün ekleyin.');
      return;
    }

    setSaving(true);
    try {
      await setupUnitShiftRotation(unitId, institutionId, { days, groups: groupDrafts });
      await invalidateShiftQueries(queryClient, unitId);
      Alert.alert('Tamam', 'Vardiyalar oluşturuldu.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  if (!unitId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Birim bulunamadı.</Text>
        <Button title="Geri" onPress={() => router.back()} />
      </View>
    );
  }

  if (isLoading) return <LoadingState />;

  if (!unit) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Birim veritabanında bulunamadı.</Text>
        <Button title="Geri" onPress={() => router.back()} />
      </View>
    );
  }

  const todayPreview = todayDateString();
  const parsedCount = parseInt(groupCount, 10);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{unit.name} — Vardiya Kurulumu</Text>
      <Text style={styles.hint}>
        Önce döngüyü tanımlayın (ör. 2 gündüz, 2 gece, 4 izin). Sonra her vardiya için kendi
        referans tarihini girin — sistem otomatik hesaplamaz.
      </Text>

      <Text style={styles.label}>1. Döngü (tüm vardiyalar için ortak)</Text>
      <ShiftPatternDayEditor days={days} onChange={setDays} />
      <Text style={styles.summary}>
        {formatCycleSummary(days)} · {days.length} günlük döngü
      </Text>

      <Text style={styles.label}>2. Vardiyalar ve referans tarihleri</Text>
      <Input
        label="Kaç vardiya?"
        value={groupCount}
        onChangeText={setGroupCount}
        keyboardType="number-pad"
      />

      {groupDrafts.map((group, index) => {
        const previewShift =
          group.referenceDate.trim() && days.length > 0
            ? calculateShiftForDate(
                days.map((d, i) => ({
                  id: String(i),
                  patternId: 'preview',
                  dayIndex: i,
                  shiftType: d.shiftType,
                  startTime: d.startTime ?? null,
                  endTime: d.endTime ?? null,
                })),
                group.referenceDate.trim(),
                todayPreview,
              )
            : null;

        return (
          <View key={index} style={styles.groupCard}>
            <Input
              label={`Vardiya ${index + 1} adı`}
              value={group.name}
              onChangeText={(v) => updateGroupDraft(index, { name: v })}
              placeholder="A Vardiyası"
            />
            <Input
              label="Referans tarihi *"
              value={group.referenceDate}
              onChangeText={(v) => updateGroupDraft(index, { referenceDate: v })}
              placeholder="2026-08-27"
              hint="Bu vardiyanın döngüsünün 1. günü hangi tarihte başlıyor?"
            />
            {previewShift ? (
              <Text style={styles.preview}>
                Bugün ({formatDisplayDate(todayPreview)}): {getShiftTypeLabel(previewShift.shiftType)}
                {previewShift.startTime ? ` · ${previewShift.startTime}–${previewShift.endTime}` : ''}
              </Text>
            ) : null}
          </View>
        );
      })}

      <Button
        title={!isNaN(parsedCount) ? `${parsedCount} Vardiya Oluştur` : 'Vardiya Oluştur'}
        onPress={handleCreate}
        loading={saving}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, gap: spacing.md },
  errorText: { ...typography.body, color: colors.danger, textAlign: 'center' },
  title: { ...typography.h2, color: colors.text },
  hint: { ...typography.bodySmall, color: colors.textMuted },
  label: { ...typography.h3, color: colors.text, marginTop: spacing.sm },
  summary: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  groupCard: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  preview: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
