import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { LoadingState } from '@/shared/components/ErrorState';
import type { ShiftGroup, Unit, Personnel } from '@/shared/types';
import { colors, spacing, typography } from '@/shared/theme';
import { getPersonnelFullName, todayDateString } from '@/shared/utils/id';
import { getUnitScheduleForDate } from '@/features/shifts/services/scheduleService';
import { UnitShiftScheduleCard } from '@/shared/components/UnitShiftSchedule';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';

export default function UnitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const institutionId = useInstitutionId()!;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [minStaff, setMinStaff] = useState('');

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
      const todayCount =
        (todaySchedule?.daySlot?.personnel.length ?? 0) +
        (todaySchedule?.nightSlot?.personnel.length ?? 0);

      return { unit, children, personnel, groups, todaySchedule, todayCount };
    },
    enabled: !!institutionId,
  });

  const startEdit = () => {
    if (!data?.unit) return;
    setName(data.unit.name);
    setMinStaff(String(data.unit.minimumStaff));
    setEditing(true);
  };

  const handleSave = async () => {
    const value = parseInt(minStaff, 10);
    if (!name.trim() || isNaN(value) || value < 0) {
      Alert.alert('Geçersiz değer');
      return;
    }
    await getRepositories().units.update(id, { name: name.trim(), minimumStaff: value });
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
            await queryClient.invalidateQueries({ queryKey: ['units'] });
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

  const { unit, children, personnel, groups, todaySchedule, todayCount } = data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {editing ? (
        <Card>
          <Input label="Birim Adı" value={name} onChangeText={setName} />
          <Input label="Minimum Kadro" value={minStaff} onChangeText={setMinStaff} keyboardType="number-pad" />
          <View style={styles.row}>
            <Button title="Kaydet" onPress={handleSave} />
            <Button title="İptal" onPress={() => setEditing(false)} variant="outline" />
          </View>
        </Card>
      ) : (
        <>
          <Text style={styles.title}>{unit.name}</Text>
          <View style={styles.statsRow}>
            <StatBox label="Personel" value={personnel.length} />
            <StatBox label="Bugün" value={todayCount} />
            <StatBox label="Minimum" value={unit.minimumStaff} />
          </View>
          <Button title="Birimi Düzenle" onPress={startEdit} variant="outline" />
          <Button
            title="Vardiya Planı (7 Gün)"
            onPress={() => router.push(`/(admin)/units/${id}/schedule`)}
          />
        </>
      )}

      {todaySchedule ? (
        <>
          <Text style={styles.section}>Bugünkü Vardiya Planı</Text>
          <UnitShiftScheduleCard schedule={todaySchedule} />
        </>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.section}>Vardiya Grupları</Text>
        <Button
          title="+ Grup"
          variant="ghost"
          onPress={() => router.push({ pathname: '/(admin)/shifts/groups/create', params: { unitId: id } })}
        />
      </View>
      {groups.length === 0 ? (
        <Text style={styles.empty}>Vardiya grubu yok</Text>
      ) : (
        groups.map((g: ShiftGroup) => (
          <Pressable key={g.id} onPress={() => router.push(`/(admin)/shifts/${g.id}`)}>
            <Card style={styles.itemCard}>
              <CardTitle>{g.name}</CardTitle>
            </Card>
          </Pressable>
        ))
      )}

      {children.length > 0 ? (
        <>
          <Text style={styles.section}>Alt Birimler</Text>
          {children.map((c: Unit) => (
            <Pressable key={c.id} onPress={() => router.push(`/(admin)/units/${c.id}`)}>
              <Card style={styles.itemCard}>
                <CardTitle>{c.name}</CardTitle>
                <CardSubtitle>Min: {c.minimumStaff}</CardSubtitle>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.section}>Personel ({personnel.length})</Text>
        <Button
          title="+ Ekle"
          variant="ghost"
          onPress={() => router.push(`/(admin)/units/${id}/add-personnel`)}
        />
      </View>
      {personnel.map((p: Personnel) => (
        <Card key={p.id} style={styles.itemCard}>
          <View style={styles.personRow}>
            <Pressable style={styles.personInfo} onPress={() => router.push(`/(admin)/personnel/${p.id}`)}>
              <CardTitle>{getPersonnelFullName(p)}</CardTitle>
              <CardSubtitle>{p.sicilNo}</CardSubtitle>
            </Pressable>
            <Button title="Çıkar" variant="outline" onPress={() => handleRemovePersonnel(p)} />
          </View>
        </Card>
      ))}

      <Button title="Birimi Sil" onPress={handleDeleteUnit} variant="danger" />
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h1, color: colors.text },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statValue: { ...typography.h2, color: colors.primary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { ...typography.h3, color: colors.text },
  itemCard: { marginBottom: spacing.xs },
  empty: { ...typography.bodySmall, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.sm },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  personInfo: { flex: 1 },
});
