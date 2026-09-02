import { useState } from 'react';
import { ScrollView, StyleSheet, Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import type { Unit, UnitWorkScheduleType } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';

export default function CreateUnitScreen() {
  const router = useRouter();
  const institutionId = useInstitutionId();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [minimumStaff, setMinimumStaff] = useState('0');
  const [parentId, setParentId] = useState<string | null>(null);
  const [workScheduleType, setWorkScheduleType] = useState<UnitWorkScheduleType>('OFFICE');
  const [officeStartTime, setOfficeStartTime] = useState('08:00');
  const [officeEndTime, setOfficeEndTime] = useState('17:00');
  const [saving, setSaving] = useState(false);

  const { data: units, isLoading } = useQuery({
    queryKey: ['units-all', institutionId],
    queryFn: () => getRepositories().units.getAll(institutionId!),
    enabled: !!institutionId,
  });

  const handleSave = async () => {
    if (!institutionId || !name.trim()) {
      Alert.alert('Eksik bilgi', 'Birim adı zorunludur.');
      return;
    }
    const min = parseInt(minimumStaff, 10);
    if (isNaN(min) || min < 0) {
      Alert.alert('Geçersiz değer', 'Minimum kadro 0 veya üzeri olmalı.');
      return;
    }
    setSaving(true);
    try {
      const unit = await getRepositories().units.create(institutionId, {
        name: name.trim(),
        parentId,
        minimumStaff: min,
        workScheduleType,
        officeStartTime: workScheduleType === 'OFFICE' ? officeStartTime : undefined,
        officeEndTime: workScheduleType === 'OFFICE' ? officeEndTime : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['units'] });
      Alert.alert('Başarılı', 'Birim oluşturuldu.', [
        { text: 'Tamam', onPress: () => router.replace(`/(admin)/units/${unit.id}`) },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Birim Adı *" value={name} onChangeText={setName} placeholder="İdari Birim" />

      <Text style={styles.label}>Çalışma Şekli *</Text>
      <View style={styles.scheduleRow}>
        <Pressable
          onPress={() => setWorkScheduleType('OFFICE')}
          style={[styles.scheduleChip, workScheduleType === 'OFFICE' && styles.chipActive]}
        >
          <Text style={[styles.chipText, workScheduleType === 'OFFICE' && styles.chipTextActive]}>
            Mesai (8–5)
          </Text>
          <Text style={styles.chipHint}>Vardiya gerekmez</Text>
        </Pressable>
        <Pressable
          onPress={() => setWorkScheduleType('SHIFT')}
          style={[styles.scheduleChip, workScheduleType === 'SHIFT' && styles.chipActive]}
        >
          <Text style={[styles.chipText, workScheduleType === 'SHIFT' && styles.chipTextActive]}>
            Vardiyalı
          </Text>
          <Text style={styles.chipHint}>Döngü + vardiya grubu</Text>
        </Pressable>
      </View>

      {workScheduleType === 'OFFICE' ? (
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Input
              label="Mesai Başlangıç"
              value={officeStartTime}
              onChangeText={setOfficeStartTime}
              placeholder="08:00"
            />
          </View>
          <View style={styles.timeField}>
            <Input
              label="Mesai Bitiş"
              value={officeEndTime}
              onChangeText={setOfficeEndTime}
              placeholder="17:00"
            />
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>
          Birim oluşturduktan sonra vardiyaları kurup personel ekleyebilirsiniz.
        </Text>
      )}

      <Input
        label="Minimum Kadro"
        value={minimumStaff}
        onChangeText={setMinimumStaff}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Üst Birim (opsiyonel)</Text>
      <Pressable
        onPress={() => setParentId(null)}
        style={[styles.chip, parentId === null && styles.chipActive]}
      >
        <Text style={[styles.chipText, parentId === null && styles.chipTextActive]}>Yok (Ana birim)</Text>
      </Pressable>
      {units?.map((unit: Unit) => (
        <Pressable
          key={unit.id}
          onPress={() => setParentId(unit.id)}
          style={[styles.chip, parentId === unit.id && styles.chipActive]}
        >
          <Text style={[styles.chipText, parentId === unit.id && styles.chipTextActive]}>{unit.name}</Text>
        </Pressable>
      ))}

      <Button title="Kaydet" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  label: { ...typography.label, color: colors.textSecondary },
  hint: { ...typography.bodySmall, color: colors.textMuted },
  scheduleRow: { flexDirection: 'row', gap: spacing.sm },
  scheduleChip: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 2,
  },
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
  chipHint: { ...typography.caption, color: colors.textMuted },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeField: { flex: 1 },
});
