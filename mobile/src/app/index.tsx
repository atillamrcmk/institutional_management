import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore, isAdminRole } from '@/features/auth/store/authStore';
import { LoadingState } from '@/shared/components/ErrorState';

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return <LoadingState message="Yükleniyor..." />;
  }

  if (!isAuthenticated || !user) {
    return <Redirect href="/welcome" />;
  }

  if (isAdminRole(user.role)) {
    return <Redirect href="/(admin)/(tabs)" />;
  }

  return <Redirect href="/(personnel)/(tabs)" />;
}
