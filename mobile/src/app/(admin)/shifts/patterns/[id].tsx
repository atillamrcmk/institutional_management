import { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { ShiftPatternDayEditor, type PatternDayInput } from '@/shared/components/ShiftPatternDayEditor';
import { colors, spacing } from '@/shared/theme';

export default function EditShiftPatternScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [days, setDays] = useState<PatternDayInput[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['shift-pattern-edit', id],
    queryFn: async () => {
      const repos = getRepositories();
      const pattern = await repos.shifts.getPatternById(id);
      if (!pattern) return null;
      const patternDays = await repos.shifts.getPatternDays(id);
      return { pattern, patternDays };
    },
  });

  useEffect(() => {
    if (data?.pattern) {
      setName(data.pattern.name);
      setReferenceDate(data.pattern.referenceDate);
      setDays(
        data.patternDays
          .sort((a, b) => a.dayIndex - b.dayIndex)
          .map((d) => ({
            shiftType: d.shiftType,
            startTime: d.startTime ?? '',
            endTime: d.endTime ?? '',
          })),
      );
    }
  }, [data]);

  const handleSave = async () => {
    if (!name.trim() || days.length === 0) {
      Alert.alert('Eksik bilgi', 'Ad ve döngü günleri zorunludur.');
      return;
    }
    setSaving(true);
    try {
      await getRepositories().shifts.updatePattern(id, {
        name: name.trim(),
        referenceDate,
        days: days.map((d) => ({
          shiftType: d.shiftType,
          startTime: d.shiftType !== 'OFF' ? d.startTime : undefined,
          endTime: d.shiftType !== 'OFF' ? d.endTime : undefined,
        })),
      });
      await queryClient.invalidateQueries({ queryKey: ['shift-patterns'] });
      await queryClient.invalidateQueries({ queryKey: ['shifts-today'] });
      Alert.alert('Başarılı', 'Döngü güncellendi.', [{ text: 'Tamam', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Güncelleme başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Döngüyü Sil', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await getRepositories().shifts.deletePattern(id);
            await queryClient.invalidateQueries({ queryKey: ['shift-patterns'] });
            router.back();
          } catch (e) {
            Alert.alert('Hata', e instanceof Error ? e.message : 'Silinemedi.');
          }
        },
      },
    ]);
  };

  if (isLoading) return <LoadingState />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Döngü Adı *" value={name} onChangeText={setName} />
      <Input label="Referans Tarihi" value={referenceDate} onChangeText={setReferenceDate} />
      <ShiftPatternDayEditor days={days} onChange={setDays} />
      <Button title="Kaydet" onPress={handleSave} loading={saving} />
      <Button title="Döngüyü Sil" onPress={handleDelete} variant="danger" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
});
