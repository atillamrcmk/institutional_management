import { Stack } from 'expo-router';

export default function PersonnelLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="messages/compose" options={{ headerShown: true, title: 'Yöneticilere Yaz' }} />
      <Stack.Screen name="messages/[id]" options={{ headerShown: true, title: 'Mesaj' }} />
    </Stack>
  );
}
