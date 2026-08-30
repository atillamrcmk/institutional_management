import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Geri' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="presence" options={{ title: 'Şu An Kurumda' }} />
      <Stack.Screen name="personnel/create" options={{ title: 'Yeni Personel' }} />
      <Stack.Screen name="personnel/[id]" options={{ title: 'Personel Detay' }} />
      <Stack.Screen name="personnel/[id]/edit" options={{ title: 'Personel Düzenle' }} />
      <Stack.Screen name="units/index" options={{ title: 'Birimler' }} />
      <Stack.Screen name="units/create" options={{ title: 'Yeni Birim' }} />
      <Stack.Screen name="units/[id]" options={{ title: 'Birim Detay' }} />
      <Stack.Screen name="units/[id]/schedule" options={{ title: 'Vardiya Planı' }} />
      <Stack.Screen name="units/[id]/setup-shifts" options={{ title: 'Vardiya Kurulumu' }} />
      <Stack.Screen name="units/[id]/add-personnel" options={{ title: 'Personel Ekle' }} />
      <Stack.Screen name="shifts/index" options={{ title: 'Bugünkü Vardiyalar' }} />
      <Stack.Screen name="shifts/patterns/index" options={{ title: 'Vardiya Döngüleri' }} />
      <Stack.Screen name="shifts/patterns/create" options={{ title: 'Yeni Döngü' }} />
      <Stack.Screen name="shifts/patterns/[id]" options={{ title: 'Döngü Düzenle' }} />
      <Stack.Screen name="shifts/groups/create" options={{ title: 'Yeni Vardiya Grubu' }} />
      <Stack.Screen name="shifts/[id]" options={{ title: 'Vardiya Detay' }} />
      <Stack.Screen name="shifts/[id]/add-personnel" options={{ title: 'Vardiyaya Personel Ekle' }} />
      <Stack.Screen name="assignments/create" options={{ title: 'Yeni Görev' }} />
      <Stack.Screen name="assignments/[id]" options={{ title: 'Görev Detay' }} />
    </Stack>
  );
}
