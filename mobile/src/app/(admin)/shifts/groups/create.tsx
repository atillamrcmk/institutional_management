import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { calculateShiftForDate, getShiftTypeLabel } from '@/features/shifts/engine/shiftCalculator';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import type { ShiftPattern, ShiftPatternDay } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';
import { formatDisplayDate } from '@/shared/utils/id';

export default function CreateShiftGroupScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const router = useRouter();
  const institutionId = useInstitutionId();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [patternId, setPatternId] = useState<string | null>(null);
  const [cycleOffset, setCycleOffset] = useState(0);
  const [saving, setSaving] = useState(false);

  const { data: patterns, isLoading } = useQuery({
    queryKey: ['shift-patterns', institutionId],
    queryFn: () => getRepositories().shifts.getPatterns(institutionId!),
    enabled: !!institutionId,
  });

  const { data: patternDays } = useQuery({
    queryKey: ['shift-pattern-days', patternId],
    queryFn: () => getRepositories().shifts.getPatternDays(patternId!),
    enabled: !!patternId,
  });

  const selectedPattern = patterns?.find((p: ShiftPattern) => p.id === patternId) ?? null;

  useEffect(() => {
    if (!patternId || !unitId) return;
    getRepositories()
      .shifts.getSuggestedCycleOffset(unitId, patternId)
      .then(setCycleOffset)
      .catch(() => setCycleOffset(0));
  }, [patternId, unitId]);

  const cycleLength = patternDays?.length ?? 1;

  const handleSave = async () => {
    if (!name.trim() || !patternId) {
      Alert.alert('Eksik bilgi', 'Grup adı ve döngü seçimi zorunludur.');
      return;
    }
    setSaving(true);
    try {
      const group = await getRepositories().shifts.createGroup(
        unitId,
        name.trim(),
        patternId,
        cycleOffset,
      );
      await queryClient.invalidateQueries({ queryKey: ['unit-detail', unitId] });
      await queryClient.invalidateQueries({ queryKey: ['shifts-today'] });
      Alert.alert('Başarılı', 'Vardiya grubu oluşturuldu.', [
        { text: 'Tamam', onPress: () => router.replace(`/(admin)/shifts/${group.id}`) },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState />;

  const previewShift =
    selectedPattern && patternDays?.length
      ? calculateShiftForDate(
          patternDays,
          selectedPattern.referenceDate,
          selectedPattern.referenceDate,
          cycleOffset,
        )
      : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Grup Adı *" value={name} onChangeText={setName} placeholder="A Vardiyası" />
      <Text style={styles.label}>Vardiya Döngüsü *</Text>
      {patterns?.length === 0 ? (
        <Text style={styles.hint}>Önce vardiya döngüsü oluşturun.</Text>
      ) : (
        patterns?.map((pattern: ShiftPattern) => (
          <Pressable
            key={pattern.id}
            onPress={() => setPatternId(pattern.id)}
            style={[styles.chip, patternId === pattern.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, patternId === pattern.id && styles.chipTextActive]}>
              {pattern.name}
            </Text>
          </Pressable>
        ))
      )}

      {selectedPattern && patternDays?.length ? (
        <View style={styles.offsetBox}>
          <Text style={styles.label}>Döngü Fazı (Kayma)</Text>
          <Text style={styles.hint}>
            Aynı döngüyü kullanan her yeni grup bir sonraki faza otomatik kayar. Böylece A gece
            çalışırken B gündüz çalışabilir.
          </Text>
          <View style={styles.offsetControls}>
            <Button
              title="−"
              onPress={() => setCycleOffset((v) => (v - 1 + cycleLength) % cycleLength)}
              variant="outline"
            />
            <Text style={styles.offsetValue}>
              Gün {cycleOffset + 1} / {cycleLength}
            </Text>
            <Button
              title="+"
              onPress={() => setCycleOffset((v) => (v + 1) % cycleLength)}
              variant="outline"
            />
          </View>
          <Text style={styles.previewLabel}>
            Referans tarihinde ({formatDisplayDate(selectedPattern.referenceDate)}):
          </Text>
          <Text style={styles.preview}>
            {previewShift
              ? `${getShiftTypeLabel(previewShift.shiftType)}${
                  previewShift.startTime
                    ? ` · ${previewShift.startTime} – ${previewShift.endTime}`
                    : ''
                }`
              : '—'}
          </Text>
          <View style={styles.cyclePreview}>
            {[...(patternDays as ShiftPatternDay[])]
              .sort((a, b) => a.dayIndex - b.dayIndex)
              .map((day, index) => (
                <View
                  key={day.id}
                  style={[styles.cycleDay, index === cycleOffset && styles.cycleDayActive]}
                >
                  <Text style={[styles.cycleDayText, index === cycleOffset && styles.cycleDayTextActive]}>
                    {getShiftTypeLabel(day.shiftType)}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      ) : null}

      <Button title="Kaydet" onPress={handleSave} loading={saving} disabled={!patterns?.length} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  label: { ...typography.label, color: colors.textSecondary },
  hint: { ...typography.bodySmall, color: colors.textMuted },
  chip: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { ...typography.body, color: colors.text },
  chipTextActive: { color: colors.primary, fontWeight: '600' },
  offsetBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  offsetControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  offsetValue: { ...typography.h3, color: colors.text, minWidth: 100, textAlign: 'center' },
  previewLabel: { ...typography.caption, color: colors.textMuted },
  preview: { ...typography.body, color: colors.text, fontWeight: '600' },
  cyclePreview: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cycleDay: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  cycleDayActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  cycleDayText: { ...typography.caption, color: colors.textSecondary },
  cycleDayTextActive: { color: colors.primary, fontWeight: '700' },
});
