import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getRepositories } from '@/shared/repositories';
import type { Permission } from '@/shared/types';

const INSTITUTION_ADMIN_PERMISSIONS: Permission[] = [
  'institution.manage',
  'personnel.manage',
  'shifts.manage',
  'units.manage',
  'assignments.manage',
  'users.manage',
  'presence.view',
];

export function usePermissions() {
  const user = useAuthStore((state) => state.user);

  const { data: grants = [] } = useQuery({
    queryKey: ['user-grants', user?.id],
    queryFn: () => getRepositories().auth.getUserGrants(user!.id),
    enabled: !!user && user.role !== 'INSTITUTION_ADMIN',
  });

  const hasPermission = (permission: Permission, unitId?: string | null): boolean => {
    if (!user) return false;
    if (user.role === 'INSTITUTION_ADMIN') return true;

    return grants.some((grant) => {
      if (grant.permission !== permission) return false;
      if (!grant.unitId) return true;
      if (!unitId) return false;
      return grant.unitId === unitId;
    });
  };

  return {
    user,
    grants,
    hasPermission,
    isInstitutionAdmin: user?.role === 'INSTITUTION_ADMIN',
    isPersonnel: user?.role === 'PERSONNEL',
    allPermissions: user?.role === 'INSTITUTION_ADMIN' ? INSTITUTION_ADMIN_PERMISSIONS : grants.map((g) => g.permission),
  };
}
