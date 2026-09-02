import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/ErrorState';
import { UnitSetupGuide } from '@/shared/components/UnitSetupGuide';
import { PersonnelListSection } from '@/shared/components/PersonnelListSection';
import { UnitShiftScheduleCard } from '@/shared/components/UnitShiftSchedule';
import { getUnitSetupStatus } from '@/features/shifts/services/unitSetupService';
import { getUnitScheduleForDate } from '@/features/shifts/services/scheduleService';
import { getUnitWorkScheduleLabel } from '@/features/units/services/officeSchedule';
import { invalidateShiftQueries } from '@/features/shifts/utils/invalidateShiftQueries';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import type { Unit, Personnel, UnitWorkScheduleType } from '@/shared/types';
import { colors, modules, spacing, typography } from '@/shared/theme';
import { formatDisplayDate, getPersonnelFullName, todayDateString } from '@/shared/utils/id';

export default function UnitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const institutionId = useInstitutionId()!;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [minStaff, setMinStaff] = useState('');
  const [workScheduleType, setWorkScheduleType] = useState<UnitWorkScheduleType>('OFFICE');
  const [officeStartTime, setOfficeStartTime] = useState('08:00');
  const [officeEndTime, setOfficeEndTime] = useState('17:00');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['unit-detail', id],
    queryFn: async () => {
      const repos = getRepositories();
      const unit = await repos.units.getById(id);
      if (!unit) return null;

      const children = await repos.units.getChildren(id, unit.institutionId);
      const personnel = await repos.units.getActivePersonnelForUnit(id);
      const groups = await repos.shifts.getGroupsByUnit(id);
      const todaySchedule = await getUnitScheduleForDate(id, todayDateString());
      const setupStatus = await getUnitSetupStatus(id);

      const groupsWithCounts = await Promise.all(
        groups.map(async (g) => ({
          group: g,
          personnel: await repos.shifts.getPersonnelInGroup(g.id),
        })),
      );

      return { unit, children, personnel, groups, groupsWithCounts, todaySchedule, setupStatus };
    },
    enabled: !!institutionId,
  });

  const startEdit = () => {
    if (!data?.unit) return;
    setName(data.unit.name);
    setMinStaff(String(data.unit.minimumStaff));
    setWorkScheduleType(data.unit.workScheduleType);
    setOfficeStartTime(data.unit.officeStartTime);
    setOfficeEndTime(data.unit.officeEndTime);
    setEditing(true);
  };

  const handleSave = async () => {
    const value = parseInt(minStaff, 10);
    if (!name.trim() || isNaN(value) || value < 0) {
      Alert.alert('Geçersiz değer');
      return;
    }
    await getRepositories().units.update(id, {
      name: name.trim(),
      minimumStaff: value,
      workScheduleType,
      officeStartTime: workScheduleType === 'OFFICE' ? officeStartTime : undefined,
      officeEndTime: workScheduleType === 'OFFICE' ? officeEndTime : undefined,
    });
    await queryClient.invalidateQueries({ queryKey: ['unit-detail', id] });
    await queryClient.invalidateQueries({ queryKey: ['units'] });
    setEditing(false);
    Alert.alert('Güncellendi');
  };

  const handleRemovePersonnel = (personnel: Personnel) => {
    Alert.alert('Personeli Çıkar', `${getPersonnelFullName(personnel)} birimden çıkarılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkar',
        style: 'destructive',
        onPress: async () => {
          await getRepositories().units.removePersonnel(id, personnel.id);
          await refetch();
          await queryClient.invalidateQueries({ queryKey: ['presence'] });
        },
      },
    ]);
  };

  const handleDeleteUnit = () => {
    Alert.alert('Birimi Sil', 'Bu birim kalıcı olarak silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await getRepositories().units.delete(id);
            await invalidateShiftQueries(queryClient);
            await queryClient.invalidateQueries({ queryKey: ['units'] });
            await queryClient.invalidateQueries({ queryKey: ['units-all'] });
            router.replace('/(admin)/units');
          } catch (e) {
            Alert.alert('Hata', e instanceof Error ? e.message : 'Silinemedi.');
          }
        },
      },
    ]);
  };

  if (isLoading) return <LoadingState />;
  if (!data?.unit) {
    return (
      <View style={styles.center}>
        <Text>Birim bulunamadı</Text>
      </View>
    );
  }

  const { unit, children, personnel, groupsWithCounts, todaySchedule, setupStatus } = data;
  const isOffice = unit.workScheduleType === 'OFFICE';
  const firstGroupWithoutPersonnel = groupsWithCounts.find((g) => g.personnel.length === 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {editing ? (
        <Card>
          <Input label="Birim Adı" value={name} onChangeText={setName} />
          <Input label="Minimum Kadro" value={minStaff} onChangeText={setMinStaff} keyboardType="number-pad" />

          <Text style={styles.editLabel}>Çalışma Şekli</Text>
          <View style={styles.scheduleRow}>
            <Pressable
              onPress={() => setWorkScheduleType('OFFICE')}
              style={[styles.scheduleChip, workScheduleType === 'OFFICE' && styles.scheduleChipActive]}
            >
              <Text
                style={[
                  styles.scheduleChipText,
                  workScheduleType === 'OFFICE' && styles.scheduleChipTextActive,
                ]}
              >
                Mesai
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setWorkScheduleType('SHIFT')}
              style={[styles.scheduleChip, workScheduleType === 'SHIFT' && styles.scheduleChipActive]}
            >
              <Text
                style={[
                  styles.scheduleChipText,
                  workScheduleType === 'SHIFT' && styles.scheduleChipTextActive,
                ]}
              >
                Vardiyalı
              </Text>
            </Pressable>
          </View>

          {workScheduleType === 'OFFICE' ? (
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Input label="Mesai Başlangıç" value={officeStartTime} onChangeText={setOfficeStartTime} />
              </View>
              <View style={styles.timeField}>
                <Input label="Mesai Bitiş" value={officeEndTime} onChangeText={setOfficeEndTime} />
              </View>
            </View>
          ) : null}

          <View style={styles.row}>
            <Button title="Kaydet" onPress={handleSave} />
            <Button title="İptal" onPress={() => setEditing(false)} variant="outline" />
          </View>
        </Card>
      ) : (
        <>
          <Text style={styles.title}>{unit.name}</Text>
          <Text style={styles.scheduleBadge}>{getUnitWorkScheduleLabel(unit)}</Text>
          <Button title="Birimi Düzenle" onPress={startEdit} variant="outline" />
        </>
      )}

      <UnitSetupGuide
        status={setupStatus}
        onCreateShifts={() => router.push(`/(admin)/units/${id}/setup-shifts`)}
        onAddPersonnel={() => router.push(`/(admin)/units/${id}/add-personnel`)}
        onAssignShifts={() => {
          if (firstGroupWithoutPersonnel) {
            router.push(`/(admin)/shifts/${firstGroupWithoutPersonnel.group.id}/add-personnel`);
          } else if (groupsWithCounts[0]) {
            router.push(`/(admin)/shifts/${groupsWithCounts[0].group.id}`);
          }
        }}
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.section}>
          Vardiyalar{isOffice ? ' (opsiyonel)' : ''}
        </Text>
        <View style={styles.sectionActions}>
          {setupStatus.patternId ? (
            <Button
              title="Düzeni Düzenle"
              variant="ghost"
              onPress={() => router.push(`/(admin)/shifts/patterns/${setupStatus.patternId}`)}
            />
          ) : null}
          {groupsWithCounts.length === 0 ? (
            <Button
              title="Kur"
              variant="ghost"
              onPress={() => router.push(`/(admin)/units/${id}/setup-shifts`)}
            />
          ) : (
            <Button
              title="+ Vardiya"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: '/(admin)/shifts/groups/create',
                  params: { unitId: id },
                })
              }
            />
          )}
        </View>
      </View>
      {groupsWithCounts.length === 0 ? (
        <Text style={styles.empty}>
          {isOffice
            ? 'Mesai birimi — vardiya kurmanız gerekmez. İsterseniz vardiya ekleyebilirsiniz.'
            : 'Henüz vardiya yok. "Vardiya Kur" ile oluşturun.'}
        </Text>
      ) : (
        groupsWithCounts.map(({ group, personnel: groupPersonnel }) => (
          <Pressable key={group.id} onPress={() => router.push(`/(admin)/shifts/${group.id}`)}>
            <Card style={styles.itemCard} module="shifts">
              <View style={styles.shiftRow}>
                <View style={styles.shiftInfo}>
                  <CardTitle>{group.name}</CardTitle>
                  <CardSubtitle>
                    Referans: {formatDisplayDate(group.cycleStartDate)} · {groupPersonnel.length}{' '}
                    personel
                  </CardSubtitle>
                </View>
                <Button
                  title="+"
                  variant="outline"
                  onPress={() => router.push(`/(admin)/shifts/${group.id}/add-personnel`)}
                />
              </View>
            </Card>
          </Pressable>
        ))
      )}

      <PersonnelListSection
        personnel={personnel}
        title={`Personel (${personnel.length})`}
        emptyMessage="Birime henüz personel eklenmedi."
        module="units"
        onPressPersonnel={(person) => router.push(`/(admin)/personnel/${person.id}`)}
        renderTrailing={(person) => (
          <Button title="Çıkar" variant="outline" onPress={() => handleRemovePersonnel(person)} />
        )}
        headerAction={
          <Button
            title="+ Ekle"
            variant="ghost"
            onPress={() => router.push(`/(admin)/units/${id}/add-personnel`)}
          />
        }
      />

      {todaySchedule && setupStatus.hasShifts ? (
        <>
          <Text style={styles.section}>Bugün Kim Görevde?</Text>
          <UnitShiftScheduleCard
            schedule={todaySchedule}
            onPressDate={() => router.push(`/(admin)/units/${id}/schedule`)}
          />
          <Button
            title="7 Günlük Plan"
            variant="ghost"
            onPress={() => router.push(`/(admin)/units/${id}/schedule`)}
          />
        </>
      ) : isOffice && personnel.length > 0 ? (
        <Card style={styles.itemCard} module="units">
          <CardTitle>Bugün Mesai</CardTitle>
          <CardSubtitle>
            Hafta içi {unit.officeStartTime}–{unit.officeEndTime} · {personnel.length} personel
          </CardSubtitle>
        </Card>
      ) : null}

      {children.length > 0 ? (
        <>
          <Text style={styles.section}>Alt Birimler</Text>
          {children.map((c: Unit) => (
            <Pressable key={c.id} onPress={() => router.push(`/(admin)/units/${c.id}`)}>
              <Card style={styles.itemCard}>
                <CardTitle>{c.name}</CardTitle>
                <CardSubtitle>
                  {getUnitWorkScheduleLabel(c)} · Min: {c.minimumStaff}
                </CardSubtitle>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}

      <Button title="Birimi Sil" onPress={handleDeleteUnit} variant="danger" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h1, color: colors.text },
  scheduleBadge: { ...typography.bodySmall, color: modules.units.main, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { ...typography.h3, color: colors.text },
  itemCard: { marginBottom: spacing.xs },
  empty: { ...typography.bodySmall, color: colors.textMuted, fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: spacing.sm },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  personInfo: { flex: 1 },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shiftInfo: { flex: 1 },
  editLabel: { ...typography.label, color: colors.textSecondary },
  scheduleRow: { flexDirection: 'row', gap: spacing.sm },
  scheduleChip: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  scheduleChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  scheduleChipText: { ...typography.body, color: colors.text },
  scheduleChipTextActive: { color: colors.primary, fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeField: { flex: 1 },
});
