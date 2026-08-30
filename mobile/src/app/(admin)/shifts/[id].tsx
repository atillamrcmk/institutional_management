import { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { getUnitScheduleForDate } from '@/features/shifts/services/scheduleService';
import {
  calculateShiftForDate,
  formatShiftTime,
  getShiftTypeLabel,
} from '@/features/shifts/engine/shiftCalculator';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { ShiftBadge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/ErrorState';
import type { ShiftPattern, ShiftPatternDay, Personnel } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';
import {
  addDaysToDateString,
  formatDisplayDate,
  getPersonnelFullName,
  todayDateString,
} from '@/shared/utils/id';
import { invalidateShiftQueries } from '@/features/shifts/utils/invalidateShiftQueries';

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [editing, setEditing] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState(todayDateString());

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
      const unitSchedule = await getUnitScheduleForDate(group.unitId, selectedDate);

      const shift = calculateShiftForDate(patternDays, group.cycleStartDate, selectedDate);

      return { group, unit, personnel, pattern, patternDays, shift, unitSchedule };
    },
  });

  useEffect(() => {
    if (data?.group) {
      setGroupName(data.group.name);
      setCycleStartDate(data.group.cycleStartDate);
    }
  }, [data?.group]);

  const handleSaveGroup = async () => {
    if (!groupName.trim() || !cycleStartDate.trim()) return;
    await getRepositories().shifts.updateGroup(id, {
      name: groupName.trim(),
      cycleStartDate: cycleStartDate.trim(),
    });
    await refetch();
    await invalidateShiftQueries(queryClient, data?.group.unitId);
    setEditing(false);
    Alert.alert('Güncellendi');
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
          await invalidateShiftQueries(queryClient);
          router.back();
        },
      },
    ]);
  };

  if (isLoading) return <LoadingState />;
  if (!data?.group) {
    return (
      <View style={styles.center}>
        <Text>Vardiya bulunamadı</Text>
      </View>
    );
  }

  const { group, unit, personnel, pattern, patternDays, shift, unitSchedule } = data;
  const patternLabel = patternDays
    .sort((a: ShiftPatternDay, b: ShiftPatternDay) => a.dayIndex - b.dayIndex)
    .map((d: ShiftPatternDay) => getShiftTypeLabel(d.shiftType))
    .join(' → ');

  const previewDates = Array.from({ length: 14 }, (_, i) =>
    addDaysToDateString(group.cycleStartDate, i),
  );

  const handoverGroup =
    shift?.shiftType === 'NIGHT'
      ? unitSchedule?.daySlot?.group
      : shift?.shiftType === 'DAY'
        ? unitSchedule?.nightSlot?.group
        : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {editing ? (
        <Card>
          <Input label="Vardiya Adı" value={groupName} onChangeText={setGroupName} />
          <Input
            label="Referans Tarihi"
            value={cycleStartDate}
            onChangeText={setCycleStartDate}
            hint="Bu vardiyanın döngüsünün 1. günü hangi tarihte başlıyor?"
          />
          <View style={styles.row}>
            <Button title="Kaydet" onPress={handleSaveGroup} />
            <Button title="İptal" onPress={() => setEditing(false)} variant="outline" />
          </View>
        </Card>
      ) : (
        <Text style={styles.title}>
          {unit?.name} · {group.name}
        </Text>
      )}

      <View style={styles.actions}>
        <Button title="Düzenle" onPress={() => setEditing(true)} variant="outline" />
        <Button
          title="Birim Planı"
          onPress={() => router.push(`/(admin)/units/${group.unitId}/schedule`)}
          variant="outline"
        />
        <Button title="+ Personel Ekle" onPress={() => router.push(`/(admin)/shifts/${id}/add-personnel`)} />
      </View>

      <View style={styles.tabs}>
        {['today', 'tomorrow'].map((tab) => {
          const date =
            tab === 'today'
              ? todayDateString()
              : addDaysToDateString(todayDateString(), 1);
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

      <Card module="shifts" variant="tinted">
        <CardTitle>{formatDisplayDate(selectedDate)}</CardTitle>
        <View style={styles.shiftRow}>
          <ShiftBadge shiftType={shift.shiftType} />
          <CardSubtitle>{formatShiftTime(shift.startTime, shift.endTime)}</CardSubtitle>
        </View>
        {handoverGroup && handoverGroup.id !== group.id ? (
          <Text style={styles.handover}>
            {shift.shiftType === 'NIGHT' ? 'Gündüz devri: ' : 'Gece devri: '}
            {handoverGroup.name}
          </Text>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Döngü: {patternLabel}</CardTitle>
        <CardSubtitle>Referans tarihi: {formatDisplayDate(group.cycleStartDate)}</CardSubtitle>
      </Card>

      <Text style={styles.section}>14 Günlük Plan</Text>
      {previewDates.map((date) => {
        const dayShift = calculateShiftForDate(patternDays, group.cycleStartDate, date);
        const isSelected = date === selectedDate;
        return (
          <Pressable key={date} onPress={() => setSelectedDate(date)}>
            <View style={[styles.planRow, isSelected && styles.planRowActive]}>
              <Text style={styles.planDate}>{formatDisplayDate(date)}</Text>
              <Text style={styles.planShift}>
                {getShiftTypeLabel(dayShift.shiftType)}
                {dayShift.startTime ? ` · ${dayShift.startTime}–${dayShift.endTime}` : ''}
              </Text>
            </View>
          </Pressable>
        );
      })}

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

      <Button title="Vardiyayı Sil" onPress={handleDeleteGroup} variant="danger" />
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
  handover: { marginTop: spacing.sm, color: colors.textSecondary },
  section: { ...typography.h3, color: colors.text },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  planRowActive: { backgroundColor: colors.primaryMuted },
  planDate: { ...typography.bodySmall, color: colors.text },
  planShift: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  personCard: { marginBottom: spacing.xs },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  personInfo: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
});
