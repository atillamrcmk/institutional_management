import { useState } from 'react';
import { FlatList, StyleSheet, View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { Input } from '@/shared/components/Input';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/ErrorState';
import { colors, spacing } from '@/shared/theme';
import { getPersonnelFullName } from '@/shared/utils/id';

export default function AddPersonnelToShiftGroupScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const institutionId = useInstitutionId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['shift-add-personnel', groupId, search],
    queryFn: async () => {
      const repos = getRepositories();
      const inGroup = await repos.shifts.getPersonnelInGroup(groupId);
      const inGroupIds = new Set(inGroup.map((p) => p.id));
      const all = search.trim()
        ? await repos.personnel.search(institutionId!, search)
        : await repos.personnel.getAll(institutionId!);
      return all.filter((p) => !inGroupIds.has(p.id));
    },
    enabled: !!institutionId && !!groupId,
  });

  const handleAssign = async (personnelId: string) => {
    try {
      await getRepositories().shifts.assignPersonnelToGroup(personnelId, groupId);
      await queryClient.invalidateQueries({ queryKey: ['shift-detail', groupId] });
      Alert.alert('Başarılı', 'Personel vardiya grubuna eklendi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Atama başarısız.');
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <View style={styles.container}>
      <Input placeholder="Personel ara..." value={search} onChangeText={setSearch} style={styles.search} />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <CardTitle>{getPersonnelFullName(item)}</CardTitle>
            <CardSubtitle>{item.sicilNo}</CardSubtitle>
            <Button title="Gruba Ekle" onPress={() => handleAssign(item.id)} />
          </Card>
        )}
      />
      <Button title="Geri" onPress={() => router.back()} variant="ghost" style={styles.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: { margin: spacing.md },
  list: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  back: { margin: spacing.md },
});
