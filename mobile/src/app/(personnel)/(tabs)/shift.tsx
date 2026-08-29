import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/shared/theme';

export default function PersonnelShiftScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Vardiya detayları ana sayfada gösteriliyor.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  text: { ...typography.body, color: colors.textSecondary },
});
