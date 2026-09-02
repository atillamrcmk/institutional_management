import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getPersonnelProfileSummary } from '@/features/personnel/services/personnelPortalService';
import { Button } from '@/shared/components/Button';
import { Card, CardSubtitle, CardTitle } from '@/shared/components/Card';
import { LoadingState } from '@/shared/components/ErrorState';
import { Screen } from '@/shared/components/layout/Screen';
import { colors, spacing, typography } from '@/shared/theme';

export default function PersonnelProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const personnelId = user?.personnelId;

  const { data, isLoading } = useQuery({
    queryKey: ['personnel-profile-summary', personnelId],
    queryFn: () => getPersonnelProfileSummary(personnelId!),
    enabled: !!personnelId,
  });

  const handleLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  if (isLoading && personnelId) return <LoadingState />;

  return (
    <Screen scroll>
      <Text style={styles.name}>{user?.displayName}</Text>
      <Text style={styles.role}>Personel</Text>

      {data ? (
        <Card module="personnel">
          <CardTitle>{data.fullName}</CardTitle>
          <CardSubtitle>Sicil: {data.sicilNo}</CardSubtitle>
          <Text style={styles.line}>Ünvan: {data.title ?? '—'}</Text>
          <Text style={styles.line}>Birim: {data.unitName ?? '—'}</Text>
          <Text style={styles.line}>Vardiya: {data.shiftGroupName ?? '—'}</Text>
        </Card>
      ) : (
        <Text style={styles.empty}>Personel kaydı bulunamadı.</Text>
      )}

      <Button title="Çıkış Yap" onPress={handleLogout} variant="outline" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  role: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  line: { ...typography.body, color: colors.text, marginTop: spacing.xs },
  empty: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
});
