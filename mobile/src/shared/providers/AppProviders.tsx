import React, { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getDatabase } from '@/shared/database/database';
import { runMigrations } from '@/shared/database/migrations';
import { initRepositories } from '@/shared/repositories';
import { useAuthStore } from '@/features/auth/store/authStore';
import { registerPushNotifications } from '@/features/messaging/services/pushNotificationService';
import { LoadingState } from '@/shared/components/ErrorState';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

interface AppInitContextValue {
  isReady: boolean;
}

const AppInitContext = createContext<AppInitContextValue>({ isReady: false });

export function useAppReady() {
  return useContext(AppInitContext);
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    async function init() {
      const db = await getDatabase();
      await runMigrations(db);
      initRepositories(db);
      await initializeAuth();
      setIsReady(true);
    }
    init();
  }, [initializeAuth]);

  useEffect(() => {
    if (!isReady || !user) return;
    void registerPushNotifications(user.id);
  }, [isReady, user?.id]);

  if (!isReady) {
    return <LoadingState message="Uygulama hazırlanıyor..." />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppInitContext.Provider value={{ isReady }}>{children}</AppInitContext.Provider>
    </QueryClientProvider>
  );
}
