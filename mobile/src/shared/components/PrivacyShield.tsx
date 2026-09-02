import { AppState, StyleSheet, View, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { colors, typography } from '@/shared/theme';

/**
 * Uygulama arka plana geçince hassas ekranı örter (ekran kaydı / multitasking önizleme).
 */
export function PrivacyShield({ children }: { children: React.ReactNode }) {
  const [obscured, setObscured] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setObscured(state !== 'active');
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.root}>
      {children}
      {obscured ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.title}>Personel Planla</Text>
          <Text style={styles.subtitle}>Oturum korumalı</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 999,
  },
  title: { ...typography.h1, color: colors.textInverse },
  subtitle: { ...typography.bodySmall, color: colors.primaryMuted },
});
