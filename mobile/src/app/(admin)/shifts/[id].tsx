import { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { calculateShiftForDate, formatShiftTime, getShiftTypeLabel } from '@/features/shifts/engine/shiftCalculator';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { ShiftBadge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/ErrorState';
import type { ShiftPattern, ShiftPatternDay, Personnel } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';
import { formatDisplayDate, getPersonnelFullName, todayDateString } from '@/shared/utils/id';

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [editing, setEditing] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [cycleOffset, setCycleOffset] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['shift-detail', id, selectedDate],
    queryFn: async () => {
      const repos = getRepositories();
      const group = await repos.shifts.getGroupById(id);
      if (!group) return null;

      const unit = await repos.units.getById(group.unitId);
      const personnel = await repos.shifts.getPersonnelInGroup(id);
      const patterns = await repos.shifts.getPatterns(group.institutionId);
      const pattern = patterns.find((p: ShiftPattern) => p.id === group.patternId);
      const patternDays = await repos.shifts.getPatternDays(group.patternId);

      const shift = pattern
        ? calculateShiftForDate(
            patternDays,
            pattern.referenceDate,
            selectedDate,
            group.cycleOffset,
          )
        : null;

      return { group, unit, personnel, pattern, patternDays, shift };
    },
  });

  useEffect(() => {
    if (data?.group) {
      setGroupName(data.group.name);
      setCycleOffset(data.group.cycleOffset ?? 0);
    }
  }, [data?.group]);

  const handleSaveGroup = async () => {
    if (!groupName.trim()) return;
    await getRepositories().shifts.updateGroup(id, {
      name: groupName.trim(),
      cycleOffset,
    });
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['shifts-today'] });
    await queryClient.invalidateQueries({ queryKey: ['presence'] });
    setEditing(false);
    Alert.alert('Güncellendi');
  };

  const handleCycleOffsetChange = async (next: number) => {
    const cycleLength = data?.patternDays.length ?? 1;
    const normalized = ((next % cycleLength) + cycleLength) % cycleLength;
    setCycleOffset(normalized);
    await getRepositories().shifts.updateGroup(id, { cycleOffset: normalized });
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['shifts-today'] });
    await queryClient.invalidateQueries({ queryKey: ['presence'] });
  };

  const handleRemovePersonnel = (personnel: Personnel) => {
    Alert.alert('Çıkar', `${getPersonnelFullName(personnel)} gruptan çıkarılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkar',
        style: 'destructive',
        onPress: async () => {
          await getRepositories().shifts.removePersonnelFromGroup(personnel.id, id);
          await refetch();
        },
      },
    ]);
  };

  const handleDeleteGroup = () => {
    Alert.alert('Grubu Sil', 'Vardiya grubu silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await getRepositories().shifts.deleteGroup(id);
          await queryClient.invalidateQueries({ queryKey: ['shifts-today'] });
          router.back();
        },
      },
    ]);
  };

  if (isLoading) return <LoadingState />;
  if (!data?.group) {
    return (
      <View style={styles.center}>
        <Text>Vardiya grubu bulunamadı</Text>
      </View>
    );
  }

  const { group, unit, personnel, pattern, patternDays, shift } = data;
  const patternLabel = patternDays
    .sort((a: ShiftPatternDay, b: ShiftPatternDay) => a.dayIndex - b.dayIndex)
    .map((d: ShiftPatternDay) => getShiftTypeLabel(d.shiftType))
    .join(' → ');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {editing ? (
        <Card>
          <Input label="Grup Adı" value={groupName} onChangeText={setGroupName} />
          <View style={styles.row}>
            <Button title="Kaydet" onPress={handleSaveGroup} />
            <Button title="İptal" onPress={() => setEditing(false)} variant="outline" />
          </View>
        </Card>
      ) : (
        <Text style={styles.title}>{unit?.name} · {group.name}</Text>
      )}

      <View style={styles.actions}>
        <Button title="Grubu Düzenle" onPress={() => setEditing(true)} variant="outline" />
        <Button title="+ Personel Ekle" onPress={() => router.push(`/(admin)/shifts/${id}/add-personnel`)} />
      </View>

      <View style={styles.tabs}>
        {['today', 'tomorrow'].map((tab) => {
          const date =
            tab === 'today'
              ? todayDateString()
              : (() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })();
          return (
            <Pressable
              key={tab}
              onPress={() => setSelectedDate(date)}
              style={[styles.tab, selectedDate === date && styles.tabActive]}
            >
              <Text style={[styles.tabText, selectedDate === date && styles.tabTextActive]}>
                {tab === 'today' ? 'Bugün' : 'Yarın'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {shift ? (
        <Card>
          <CardTitle>{formatDisplayDate(selectedDate)}</CardTitle>
          <View style={styles.shiftRow}>
            <ShiftBadge shiftType={shift.shiftType} />
            <CardSubtitle>{formatShiftTime(shift.startTime, shift.endTime)}</CardSubtitle>
          </View>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Döngü: {pattern?.name ?? '—'}</CardTitle>
        <CardSubtitle>{patternLabel}</CardSubtitle>
        <CardSubtitle>Referans: {pattern ? formatDisplayDate(pattern.referenceDate) : '—'}</CardSubtitle>
        <View style={styles.offsetRow}>
          <CardSubtitle>Döngü fazı: Gün {cycleOffset + 1}</CardSubtitle>
          <View style={styles.offsetButtons}>
            <Button title="−" variant="outline" onPress={() => handleCycleOffsetChange(cycleOffset - 1)} />
            <Button title="+" variant="outline" onPress={() => handleCycleOffsetChange(cycleOffset + 1)} />
          </View>
        </View>
        <Button
          title="Döngüyü Düzenle"
          variant="ghost"
          onPress={() => pattern && router.push(`/(admin)/shifts/patterns/${pattern.id}`)}
        />
      </Card>

      <Text style={styles.section}>Personel ({personnel.length})</Text>
      {personnel.map((p: Personnel) => (
        <Card key={p.id} style={styles.personCard}>
          <View style={styles.personRow}>
            <View style={styles.personInfo}>
              <CardTitle>{getPersonnelFullName(p)}</CardTitle>
              <CardSubtitle>{p.sicilNo}</CardSubtitle>
            </View>
            <Button title="Çıkar" variant="outline" onPress={() => handleRemovePersonnel(p)} />
          </View>
        </Card>
      ))}

      <Button title="Grubu Sil" onPress={handleDeleteGroup} variant="danger" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.label, color: colors.text },
  tabTextActive: { color: '#fff' },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  section: { ...typography.h3, color: colors.text },
  personCard: { marginBottom: spacing.xs },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  personInfo: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  offsetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  offsetButtons: { flexDirection: 'row', gap: spacing.xs },
});
