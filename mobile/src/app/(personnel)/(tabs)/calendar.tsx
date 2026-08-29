import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/shared/theme';

export default function PersonnelCalendarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Takvim Phase 4'te genişletilecek.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  text: { ...typography.body, color: colors.textSecondary },
});
