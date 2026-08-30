import { useState } from 'react';
import { ScrollView, StyleSheet, Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { calculateShiftForDate, getShiftTypeLabel } from '@/features/shifts/engine/shiftCalculator';
import {
  addShiftGroupToUnit,
  getUnitPatternId,
} from '@/features/shifts/services/unitSetupService';
import { invalidateShiftQueries } from '@/features/shifts/utils/invalidateShiftQueries';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import type { ShiftPatternDay } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';
import { formatDisplayDate, todayDateString } from '@/shared/utils/id';

function resolveUnitId(unitId: string | string[] | undefined): string | undefined {
  if (Array.isArray(unitId)) return unitId[0];
  return unitId;
}

export default function CreateShiftGroupScreen() {
  const params = useLocalSearchParams<{ unitId?: string | string[] }>();
  const unitId = resolveUnitId(params.unitId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['shift-add-group', unitId],
    queryFn: async () => {
      const repos = getRepositories();
      const unit = unitId ? await repos.units.getById(unitId) : null;
      const patternId = unitId ? await getUnitPatternId(unitId) : null;
      const patternDays = patternId ? await repos.shifts.getPatternDays(patternId) : [];
      return { unit, patternId, patternDays };
    },
    enabled: !!unitId,
  });

  const handleSave = async () => {
    if (!unitId || !name.trim() || !referenceDate.trim()) {
      Alert.alert('Eksik bilgi', 'Vardiya adı ve referans tarihi zorunludur.');
      return;
    }
    setSaving(true);
    try {
      const group = await addShiftGroupToUnit(unitId, {
        name: name.trim(),
        referenceDate: referenceDate.trim(),
      });
      await invalidateShiftQueries(queryClient, unitId);
      Alert.alert('Başarılı', 'Vardiya eklendi.', [
        { text: 'Tamam', onPress: () => router.replace(`/(admin)/shifts/${group.id}`) },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  };

  if (!unitId) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Birim bulunamadı.</Text>
        <Button title="Geri" onPress={() => router.back()} />
      </View>
    );
  }

  if (isLoading) return <LoadingState />;

  if (!data?.patternId) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Önce "Vardiya Kur" ile döngü ve ilk vardiyaları oluşturun.</Text>
        <Button title="Geri" onPress={() => router.back()} />
      </View>
    );
  }

  const today = todayDateString();
  const previewShift =
    referenceDate.trim() && data.patternDays.length > 0
      ? calculateShiftForDate(data.patternDays as ShiftPatternDay[], referenceDate.trim(), today)
      : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>{data.unit?.name} birimine yeni vardiya</Text>
      <Input label="Vardiya Adı *" value={name} onChangeText={setName} placeholder="E Vardiyası" />
      <Input
        label="Referans Tarihi *"
        value={referenceDate}
        onChangeText={setReferenceDate}
        placeholder="2026-08-31"
        hint="Bu vardiyanın döngüsünün 1. günü hangi tarihte başlıyor?"
      />

      {previewShift ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>Bugün önizleme ({formatDisplayDate(today)})</Text>
          <Text style={styles.previewShift}>
            {getShiftTypeLabel(previewShift.shiftType)}
            {previewShift.startTime ? ` · ${previewShift.startTime}–${previewShift.endTime}` : ''}
          </Text>
        </View>
      ) : null}

      <Button title="Kaydet" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, gap: spacing.md },
  error: { ...typography.body, color: colors.danger, textAlign: 'center' },
  subtitle: { ...typography.bodySmall, color: colors.textMuted },
  previewBox: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primaryMuted,
    gap: spacing.xs,
  },
  previewTitle: { ...typography.caption, color: colors.textSecondary },
  previewShift: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
