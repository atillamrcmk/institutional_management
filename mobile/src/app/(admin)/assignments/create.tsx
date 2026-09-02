import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getRepositories } from '@/shared/repositories';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { PersonnelListSection } from '@/shared/components/PersonnelListSection';
import { LoadingState } from '@/shared/components/ErrorState';
import type { TaskType } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';
import { todayDateString } from '@/shared/utils/id';

export default function CreateAssignmentScreen() {
  const router = useRouter();
  const institutionId = useAuthStore((s) => s.institutionId)!;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [requiredCount, setRequiredCount] = useState('1');
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState<string | null>(null);
  const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['assignment-create-data', institutionId],
    queryFn: async () => {
      const repos = getRepositories();
      const [taskTypes, personnel] = await Promise.all([
        repos.taskTypes.getAll(institutionId),
        repos.personnel.getAll(institutionId),
      ]);
      return { taskTypes, personnel };
    },
  });

  const togglePersonnel = (id: string) => {
    setSelectedPersonnel((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!title.trim() || !selectedTaskTypeId) {
      Alert.alert('Eksik bilgi', 'Başlık ve görev türü zorunludur.');
      return;
    }
    const count = parseInt(requiredCount, 10);
    if (isNaN(count) || count < 1) {
      Alert.alert('Geçersiz değer', 'Personel sayısı en az 1 olmalı.');
      return;
    }

    setSaving(true);
    try {
      await getRepositories().assignments.create(institutionId, {
        taskTypeId: selectedTaskTypeId,
        title: title.trim(),
        description: description.trim() || null,
        date,
        startTime,
        endTime: endTime || null,
        requiredPersonnelCount: count,
        personnelIds: selectedPersonnel,
      });
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      Alert.alert('Başarılı', 'Görevlendirme oluşturuldu.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !data) return <LoadingState />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Başlık" value={title} onChangeText={setTitle} placeholder="Görev başlığı" />
      <Input
        label="Açıklama"
        value={description}
        onChangeText={setDescription}
        placeholder="Opsiyonel"
      />
      <Input label="Tarih" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      <View style={styles.row}>
        <View style={styles.half}>
          <Input label="Başlangıç" value={startTime} onChangeText={setStartTime} placeholder="08:00" />
        </View>
        <View style={styles.half}>
          <Input label="Bitiş" value={endTime} onChangeText={setEndTime} placeholder="16:00" />
        </View>
      </View>
      <Input
        label="Gerekli Personel"
        value={requiredCount}
        onChangeText={setRequiredCount}
        keyboardType="number-pad"
      />

      <Text style={styles.section}>Görev Türü</Text>
      <View style={styles.chips}>
        {data.taskTypes.map((type: TaskType) => (
          <Chip
            key={type.id}
            label={type.name}
            active={selectedTaskTypeId === type.id}
            onPress={() => setSelectedTaskTypeId(type.id)}
          />
        ))}
      </View>

      <PersonnelListSection
        personnel={data.personnel}
        title={`Personel Seç (${selectedPersonnel.length})`}
        module="assignments"
        defaultExpanded
        selectionMode
        selectedIds={selectedPersonnel}
        onToggleSelect={togglePersonnel}
      />

      <Button title="Kaydet" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  section: { ...typography.label, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.bodySmall, color: colors.text },
  chipTextActive: { color: '#fff' },
});
