import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getRepositories } from '@/shared/repositories';

export function useInstitutionId(): string | null {
  const storedId = useAuthStore((s) => s.institutionId);

  const { data } = useQuery({
    queryKey: ['institution-id', storedId],
    queryFn: async () => {
      const institution = await getRepositories().institution.getFirst();
      if (!institution) return null;
      if (storedId !== institution.id) {
        useAuthStore.setState({ institutionId: institution.id });
      }
      return institution.id;
    },
  });

  return data ?? storedId;
}
