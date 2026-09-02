import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';
import { useInstitutionId } from '@/shared/hooks/useInstitutionId';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { LoadingState } from '@/shared/components/ErrorState';
import { Avatar } from '@/shared/components/Avatar';
import { Card, CardTitle, CardSubtitle } from '@/shared/components/Card';
import { ScreenToolbar } from '@/shared/components/layout/ScreenToolbar';
import { colors, spacing } from '@/shared/theme';
import { getPersonnelFullName } from '@/shared/utils/id';

export default function PersonnelListScreen() {
  const router = useRouter();
  const institutionId = useInstitutionId();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['personnel', institutionId, debouncedSearch],
    queryFn: async () => {
      const repos = getRepositories();
      if (debouncedSearch.trim()) {
        return repos.personnel.search(institutionId!, debouncedSearch);
      }
      return repos.personnel.getAll(institutionId!);
    },
    enabled: !!institutionId,
    placeholderData: keepPreviousData,
  });

  const showInitialLoading = isLoading && !data;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ScreenToolbar>
          <Input
            placeholder="Personel ara..."
            value={search}
            onChangeText={setSearch}
          />
          <Button
            title="+ Yeni Personel"
            onPress={() => router.push('/(admin)/personnel/create')}
            fullWidth
          />
        </ScreenToolbar>
      </View>

      {showInitialLoading ? (
        <LoadingState message="Personel listesi yükleniyor..." />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              title={isFetching ? 'Aranıyor...' : 'Personel bulunamadı'}
              message={isFetching ? undefined : 'Yeni personel ekleyin.'}
              module="personnel"
              actionLabel={isFetching ? undefined : 'Personel Ekle'}
              onAction={
                isFetching ? undefined : () => router.push('/(admin)/personnel/create')
              }
            />
          }
          renderItem={({ item }) => (
            <Card
              onPress={() => router.push(`/(admin)/personnel/${item.id}`)}
              module="personnel"
              variant="elevated"
              style={styles.card}
            >
              <View style={styles.row}>
                <Avatar name={getPersonnelFullName(item)} size={44} photoUri={item.photoUri} />
                <View style={styles.info}>
                  <CardTitle>{getPersonnelFullName(item)}</CardTitle>
                  <CardSubtitle>
                    {item.sicilNo} · {item.title ?? '—'}
                  </CardSubtitle>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, paddingBottom: 0 },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  info: { flex: 1 },
});
