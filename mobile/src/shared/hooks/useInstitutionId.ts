import { useAuthStore } from '@/features/auth/store/authStore';
import { useQuery } from '@tanstack/react-query';
import { getRepositories } from '@/shared/repositories';

export function useInstitutionId(): string | null {
  const storedId = useAuthStore((s) => s.institutionId);
  const authMode = useAuthStore((s) => s.authMode);

  const { data } = useQuery({
    queryKey: ['institution-id', authMode, storedId],
    enabled: authMode === 'local',
    queryFn: async () => {
      const institution = await getRepositories().institution.getFirst();
      if (!institution) return null;
      if (storedId !== institution.id) {
        useAuthStore.setState({ institutionId: institution.id });
      }
      return institution.id;
    },
  });

  if (authMode === 'server') {
    return storedId;
  }

  return data ?? storedId;
}
