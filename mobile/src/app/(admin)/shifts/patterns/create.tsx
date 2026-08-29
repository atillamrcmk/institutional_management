import { useState } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { PRESET_CYCLE_4_DAY } from '@/features/shifts/constants/shiftDefaults';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { ShiftPatternDayEditor, type PatternDayInput } from '@/shared/components/ShiftPatternDayEditor';
import { colors, spacing } from '@/shared/theme';
import { todayDateString } from '@/shared/utils/id';

export default function CreateShiftPatternScreen() {
  const router = useRouter();
  const institutionId = useInstitutionId();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [referenceDate, setReferenceDate] = useState(todayDateString());
  const [days, setDays] = useState<PatternDayInput[]>([...PRESET_CYCLE_4_DAY]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!institutionId || !name.trim() || days.length === 0) {
      Alert.alert('Eksik bilgi', 'Ad ve en az bir döngü günü zorunludur.');
      return;
    }
    setSaving(true);
    try {
      await getRepositories().shifts.createPattern(
        institutionId,
        name.trim(),
        referenceDate,
        days.map((d) => ({
          shiftType: d.shiftType,
          startTime: d.shiftType !== 'OFF' ? d.startTime : undefined,
          endTime: d.shiftType !== 'OFF' ? d.endTime : undefined,
        })),
      );
      await queryClient.invalidateQueries({ queryKey: ['shift-patterns'] });
      Alert.alert('Başarılı', 'Vardiya döngüsü oluşturuldu.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Döngü Adı *" value={name} onChangeText={setName} placeholder="Malta 4 Günlük" />
      <Input label="Referans Tarihi" value={referenceDate} onChangeText={setReferenceDate} />
      <ShiftPatternDayEditor days={days} onChange={setDays} />
      <Button title="Kaydet" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
});
