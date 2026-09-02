import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { calculateShiftForDate, formatShiftTime, getShiftTypeLabel } from '@/features/shifts/engine/shiftCalculator';
import { Avatar } from '@/shared/components/Avatar';
import { StatusBadge, ShiftBadge } from '@/shared/components/Badge';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/ErrorState';
import type { AbsenceType, PersonnelAbsence } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';
import { getPersonnelFullName, todayDateString } from '@/shared/utils/id';
import { getAbsenceTypeLabel } from '@/shared/utils/labels';

const ABSENCE_TYPES: AbsenceType[] = ['LEAVE', 'REPORT', 'TRAINING', 'TEMPORARY_DUTY'];

export default function PersonnelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [absenceType, setAbsenceType] = useState<AbsenceType>('LEAVE');
  const [startDate, setStartDate] = useState(todayDateString());
  const [endDate, setEndDate] = useState(todayDateString());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['personnel-detail', id],
    queryFn: async () => {
      const repos = getRepositories();
      const personnel = await repos.personnel.getById(id);
      if (!personnel) return null;

      const unit = await repos.units.getCurrentUnitForPersonnel(id);
      const linkedUser = await repos.auth.getUserByPersonnelId(id);
      const shiftData = await repos.shifts.getActiveAssignmentForPersonnel(id, todayDateString());
      const absences = await repos.absences.getByPersonnel(id);
      const isAbsent = await repos.absences.isAbsentOnDate(id, todayDateString());
      const taskAssignment = await repos.assignments.getActiveForPersonnelOnDate(id, todayDateString());

      let shift = null;
      if (shiftData) {
        shift = calculateShiftForDate(
          shiftData.patternDays,
          shiftData.group.cycleStartDate,
          todayDateString(),
        );
      }

      return { personnel, unit, linkedUser, shiftData, shift, absences, isAbsent, taskAssignment };
    },
  });

  const handleAddAbsence = async () => {
    if (startDate > endDate) {
      Alert.alert('Geçersiz tarih', 'Bitiş tarihi başlangıçtan önce olamaz.');
      return;
    }
    setSaving(true);
    try {
      await getRepositories().absences.create({
        personnelId: id,
        type: absenceType,
        startDate,
        endDate,
        notes: notes.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['personnel-detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['presence'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowForm(false);
      setNotes('');
      await refetch();
      Alert.alert('Başarılı', 'İzin kaydı eklendi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAbsence = async (absenceId: string) => {
    Alert.alert('Sil', 'Bu izin kaydını silmek istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await getRepositories().absences.delete(absenceId);
          await refetch();
          await queryClient.invalidateQueries({ queryKey: ['presence'] });
        },
      },
    ]);
  };

  if (isLoading) return <LoadingState />;
  if (!data?.personnel) {
    return (
      <View style={styles.center}>
        <Text>Personel bulunamadı</Text>
      </View>
    );
  }

  const { personnel, unit, linkedUser, shiftData, shift, isAbsent, taskAssignment } = data;
  const name = getPersonnelFullName(personnel);
  const status = isAbsent ? 'ABSENT' : taskAssignment ? 'ON_ASSIGNMENT' : shift && shift.shiftType !== 'OFF' ? 'ON_DUTY' : 'OFF';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Avatar name={name} size={64} photoUri={personnel.photoUri} />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>{personnel.sicilNo} · {personnel.title ?? '—'}</Text>
        <StatusBadge status={status} />
        <Button title="Düzenle" onPress={() => router.push(`/(admin)/personnel/${id}/edit`)} variant="outline" />
      </View>

      <Card>
        <CardTitle>Özet</CardTitle>
        <InfoRow label="Asıl Birim" value={unit?.name ?? '—'} />
        <InfoRow label="Vardiya" value={shiftData?.group.name ?? '—'} />
        <InfoRow
          label="Bugün"
          value={shift ? formatShiftTime(shift.startTime, shift.endTime) : '—'}
        />
        {taskAssignment ? (
          <InfoRow label="Ek Görev" value={taskAssignment.title} />
        ) : null}
        {shift ? (
          <View style={styles.shiftBadge}>
            <ShiftBadge shiftType={shift.shiftType} />
            <Text style={styles.shiftLabel}>{getShiftTypeLabel(shift.shiftType)}</Text>
          </View>
        ) : null}
      </Card>

      {linkedUser ? (
        <Card>
          <CardTitle>Mesajlaşma</CardTitle>
          <InfoRow
            label="Yöneticilere mesaj"
            value={linkedUser.canMessageAdmins ? 'Açık' : 'Kapalı'}
          />
          <Button
            title={
              linkedUser.canMessageAdmins
                ? 'Yönetici mesajını kapat'
                : 'Yöneticilere mesaj izni ver'
            }
            variant="outline"
            onPress={async () => {
              await getRepositories().auth.updateUser(linkedUser.id, {
                canMessageAdmins: !linkedUser.canMessageAdmins,
              });
              await refetch();
            }}
          />
        </Card>
      ) : null}

      <Card>
        <View style={styles.absenceHeader}>
          <CardTitle>İzinler</CardTitle>
          <Button
            title={showForm ? 'İptal' : '+ Ekle'}
            onPress={() => setShowForm((v) => !v)}
            variant="outline"
          />
        </View>

        {showForm ? (
          <View style={styles.form}>
            <Text style={styles.formLabel}>Tür</Text>
            <View style={styles.chips}>
              {ABSENCE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setAbsenceType(type)}
                  style={[styles.chip, absenceType === type && styles.chipActive]}
                >
                  <Text style={[styles.chipText, absenceType === type && styles.chipTextActive]}>
                    {getAbsenceTypeLabel(type)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Input label="Başlangıç" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
            <Input label="Bitiş" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
            <Input label="Not" value={notes} onChangeText={setNotes} placeholder="Opsiyonel" />
            <Button title="Kaydet" onPress={handleAddAbsence} loading={saving} />
          </View>
        ) : null}

        {data.absences.length === 0 ? (
          <CardSubtitle>Kayıt yok</CardSubtitle>
        ) : (
          data.absences.map((a: PersonnelAbsence) => (
            <Pressable key={a.id} onLongPress={() => handleDeleteAbsence(a.id)}>
              <Text style={styles.absenceRow}>
                {a.startDate} – {a.endDate} · {getAbsenceTypeLabel(a.type)}
              </Text>
            </Pressable>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  name: { ...typography.h2, color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  infoLabel: { ...typography.bodySmall, color: colors.textSecondary },
  infoValue: { ...typography.body, color: colors.text },
  shiftBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  shiftLabel: { ...typography.bodySmall, color: colors.textSecondary },
  absenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  absenceRow: { ...typography.bodySmall, color: colors.text, marginTop: spacing.xs },
  form: { gap: spacing.sm, marginTop: spacing.sm },
  formLabel: { ...typography.label, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.bodySmall, color: colors.text },
  chipTextActive: { color: '#fff' },
});
