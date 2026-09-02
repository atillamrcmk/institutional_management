import { useState } from 'react';
import { ScrollView, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { messageQueryKeys } from '@/features/messaging/constants/messageQueryKeys';
import { sendMessage } from '@/features/messaging/services/messageService';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { Screen } from '@/shared/components/layout/Screen';
import { spacing } from '@/shared/theme';

export default function PersonnelComposeMessageScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user)!;
  const institutionId = useAuthStore((s) => s.institutionId)!;
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      Alert.alert('Eksik bilgi', 'Konu ve mesaj metni zorunludur.');
      return;
    }

    setSaving(true);
    try {
      await sendMessage(institutionId, user, {
        subject: subject.trim(),
        body: body.trim(),
        audienceType: 'ADMINS',
      });
      await queryClient.invalidateQueries({ queryKey: messageQueryKeys.sent(user.id) });
      Alert.alert('Gönderildi', 'Mesajınız yöneticilere iletildi.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Mesaj gönderilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Input label="Konu" value={subject} onChangeText={setSubject} placeholder="Mesaj konusu" />
        <Input
          label="Mesaj"
          value={body}
          onChangeText={setBody}
          placeholder="Yöneticilere iletmek istediğiniz mesaj..."
          multiline
          numberOfLines={6}
          style={styles.bodyInput}
        />
        <Button title="Yöneticilere Gönder" onPress={handleSend} loading={saving} fullWidth />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  bodyInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
