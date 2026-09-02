import { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { messageQueryKeys } from '@/features/messaging/constants/messageQueryKeys';
import { markMessageRead } from '@/features/messaging/services/messageService';
import { Card } from '@/shared/components/Card';
import { LoadingState } from '@/shared/components/ErrorState';
import { Screen } from '@/shared/components/layout/Screen';
import { getRepositories } from '@/shared/repositories';
import { colors, spacing, typography } from '@/shared/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MessageDetailScreen() {
  const { id, recipientId } = useLocalSearchParams<{ id: string; recipientId?: string }>();
  const user = useAuthStore((s) => s.user)!;
  const queryClient = useQueryClient();

  const { data: message, isLoading } = useQuery({
    queryKey: messageQueryKeys.detail(id),
    queryFn: () => getRepositories().messages.getById(id),
  });

  useEffect(() => {
    if (!recipientId) return;
    void markMessageRead(recipientId).then(() => {
      queryClient.invalidateQueries({ queryKey: messageQueryKeys.inbox(user.id) });
      queryClient.invalidateQueries({ queryKey: messageQueryKeys.unread(user.id) });
    });
  }, [recipientId, queryClient, user.id]);

  if (isLoading || !message) {
    return <LoadingState message="Mesaj yükleniyor..." />;
  }

  return (
    <Screen scroll>
      <Card>
        <Text style={styles.subject}>{message.subject}</Text>
        <Text style={styles.meta}>
          {message.senderDisplayName} · {formatDate(message.createdAt)}
        </Text>
        <Text style={styles.body}>{message.body}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subject: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
});
