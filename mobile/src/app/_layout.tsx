import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AppProviders } from '@/shared/providers/AppProviders';
import { PrivacyShield } from '@/shared/components/PrivacyShield';
import { colors, headerStyle } from '@/shared/theme';

export default function RootLayout() {
  return (
    <AppProviders>
      <PrivacyShield>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle,
            headerTintColor: colors.primary,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen
            name="create-institution"
            options={{ title: 'Yeni Kurum', headerBackTitle: 'Geri' }}
          />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
          <Stack.Screen name="(personnel)" options={{ headerShown: false }} />
        </Stack>
      </PrivacyShield>
    </AppProviders>
  );
}
