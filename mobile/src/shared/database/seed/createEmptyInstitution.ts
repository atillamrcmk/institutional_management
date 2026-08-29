import { getRepositories } from '@/shared/repositories';

export async function createEmptyInstitution(
  institutionName: string,
): Promise<{ institutionId: string }> {
  const repos = getRepositories();
  await repos.institution.clearAllData();

  const institution = await repos.institution.create(institutionName.trim());
  const adminPersonnel = await repos.personnel.create(institution.id, {
    firstName: 'Kurum',
    lastName: 'Yöneticisi',
    sicilNo: 'ADM-001',
    title: 'Kurum Müdürü',
  });

  await repos.auth.createUser({
    institutionId: institution.id,
    displayName: 'Kurum Müdürü',
    role: 'INSTITUTION_ADMIN',
    personnelId: adminPersonnel.id,
    pin: '1234',
  });

  await repos.institution.persist();
  return { institutionId: institution.id };
}
