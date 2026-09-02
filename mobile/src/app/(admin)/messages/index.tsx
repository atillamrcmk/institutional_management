import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { messageQueryKeys } from '@/features/messaging/constants/messageQueryKeys';
import { getInbox, getSentMessages } from '@/features/messaging/services/messageService';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { LoadingState } from '@/shared/components/ErrorState';
import { Screen } from '@/shared/components/layout/Screen';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { colors, spacing, typography } from '@/shared/theme';

type Tab = 'inbox' | 'sent';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminMessagesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user)!;
  const institutionId = useAuthStore((s) => s.institutionId)!;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('inbox');

  const { data: inbox, isLoading: inboxLoading } = useQuery({
    queryKey: messageQueryKeys.inbox(user.id),
    queryFn: () => getInbox(institutionId, user),
  });

  const { data: sent, isLoading: sentLoading } = useQuery({
    queryKey: messageQueryKeys.sent(user.id),
    queryFn: () => getSentMessages(user.id),
  });

  const isLoading = tab === 'inbox' ? inboxLoading : sentLoading;

  const openCompose = () => router.push('/(admin)/messages/compose');

  return (
    <Screen scroll>
      <PageHeader
        title="Mesajlar"
        subtitle="Personel ve birimlere duyuru gönderin"
        module="dashboard"
        action={<Button title="+ Yeni" onPress={openCompose} />}
      />

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'inbox' && styles.tabActive]}
          onPress={() => setTab('inbox')}
        >
          <Text style={[styles.tabText, tab === 'inbox' && styles.tabTextActive]}>Gelen</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'sent' && styles.tabActive]}
          onPress={() => setTab('sent')}
        >
          <Text style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>Gönderilen</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingState message="Mesajlar yükleniyor..." />
      ) : tab === 'inbox' ? (
        !inbox?.length ? (
          <Card>
            <Text style={styles.preview}>Gelen mesaj yok. Personelden gelen mesajlar burada görünür.</Text>
          </Card>
        ) : (
          inbox.map((item) => (
            <Pressable
              key={item.recipientId}
              onPress={() => {
                queryClient.invalidateQueries({ queryKey: messageQueryKeys.inbox(user.id) });
                router.push({
                  pathname: '/(admin)/messages/[id]',
                  params: { id: item.id, recipientId: item.recipientId },
                });
              }}
            >
              <Card style={!item.readAt ? styles.unreadCard : undefined}>
                <View style={styles.row}>
                  <Text style={styles.subject} numberOfLines={1}>
                    {item.subject}
                  </Text>
                  {!item.readAt ? <View style={styles.dot} /> : null}
                </View>
                <Text style={styles.meta}>
                  {item.senderDisplayName} · {formatDate(item.createdAt)}
                </Text>
                <Text style={styles.preview} numberOfLines={2}>
                  {item.body}
                </Text>
              </Card>
            </Pressable>
          ))
        )
      ) : !sent?.length ? (
        <Card>
          <Text style={styles.preview}>Henüz gönderilmiş mesaj yok.</Text>
          <Button title="Mesaj Gönder" onPress={openCompose} variant="outline" fullWidth />
        </Card>
      ) : (
        sent.map((item) => (
          <Pressable
            key={item.id}
            onPress={() =>
              router.push({
                pathname: '/(admin)/messages/[id]',
                params: { id: item.id },
              })
            }
          >
            <Card>
              <Text style={styles.subject} numberOfLines={1}>
                {item.subject}
              </Text>
              <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
              <Text style={styles.preview} numberOfLines={2}>
                {item.body}
              </Text>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.offLight,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textInverse,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  subject: {
    ...typography.h3,
    flex: 1,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  preview: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  unreadCard: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
