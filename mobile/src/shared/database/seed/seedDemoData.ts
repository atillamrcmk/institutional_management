import { getRepositories } from '@/shared/repositories';
import {
  PRESET_CYCLE_4_DAY,
  PRESET_CYCLE_MERKEZ,
} from '@/features/shifts/constants/shiftDefaults';
import {
  setupUnitShiftRotation,
} from '@/features/shifts/services/unitSetupService';
import {
  addDaysToDateString,
  todayDateString,
} from '@/shared/utils/id';
import {
  seedAbsentIndices,
  seedAbsenceType,
  seedFirstName,
  seedInt,
  seedLastName,
  seedTitle,
} from './seedRandom';

const PERSONNEL_COUNT = 90;

async function assignPersonnelToGroupsEvenly(
  personnelIds: string[],
  groupIds: string[],
): Promise<void> {
  const repos = getRepositories();
  for (let i = 0; i < personnelIds.length; i++) {
    const groupId = groupIds[i % groupIds.length];
    await repos.shifts.assignPersonnelToGroup(personnelIds[i], groupId);
  }
}

export async function seedDemoData(): Promise<{ institutionId: string }> {
  const repos = getRepositories();
  const today = todayDateString();
  await repos.institution.clearAllData();

  const institution = await repos.institution.create('Kuzey Kampüs Kurumu');
  const institutionId = institution.id;

  const guvenlik = await repos.units.create(institutionId, { name: 'Güvenlik' });
  const malta = await repos.units.create(institutionId, {
    name: 'Malta',
    parentId: guvenlik.id,
    minimumStaff: 18,
  });
  const merkezKontrol = await repos.units.create(institutionId, {
    name: 'Merkez Kontrol',
    parentId: guvenlik.id,
    minimumStaff: 6,
  });
  const nizamiye = await repos.units.create(institutionId, {
    name: 'Nizamiye',
    parentId: guvenlik.id,
    minimumStaff: 4,
  });
  await repos.units.create(institutionId, { name: 'Ziyaret', parentId: guvenlik.id, minimumStaff: 2 });
  await repos.units.create(institutionId, { name: 'İdari Birim' });

  const maltaGroups = await setupUnitShiftRotation(malta.id, institutionId, {
    days: PRESET_CYCLE_4_DAY,
    groups: [
      { name: 'A Vardiyası', referenceDate: today },
      { name: 'B Vardiyası', referenceDate: addDaysToDateString(today, 1) },
      { name: 'C Vardiyası', referenceDate: addDaysToDateString(today, 2) },
      { name: 'D Vardiyası', referenceDate: addDaysToDateString(today, 3) },
    ],
  });

  const merkezGroups = await setupUnitShiftRotation(merkezKontrol.id, institutionId, {
    days: PRESET_CYCLE_MERKEZ,
    groups: [
      { name: 'A Vardiyası', referenceDate: '2026-08-27' },
      { name: 'B Vardiyası', referenceDate: '2026-08-31' },
      { name: 'C Vardiyası', referenceDate: '2026-09-04' },
      { name: 'D Vardiyası', referenceDate: '2026-08-29' },
    ],
  });

  const maltaPersonnelIds: string[] = [];
  const merkezPersonnelIds: string[] = [];
  const createdPersonnel: string[] = [];

  for (let i = 0; i < PERSONNEL_COUNT; i++) {
    const personnel = await repos.personnel.create(institutionId, {
      firstName: seedFirstName(i),
      lastName: seedLastName(i),
      sicilNo: `KP-${String(i + 1).padStart(4, '0')}`,
      title: seedTitle(i),
    });
    createdPersonnel.push(personnel.id);

    if (i < 50) {
      await repos.units.assignPersonnel(malta.id, personnel.id);
      maltaPersonnelIds.push(personnel.id);
    } else if (i < 70) {
      await repos.units.assignPersonnel(merkezKontrol.id, personnel.id);
      merkezPersonnelIds.push(personnel.id);
    } else {
      await repos.units.assignPersonnel(nizamiye.id, personnel.id);
    }
  }

  await assignPersonnelToGroupsEvenly(
    maltaPersonnelIds,
    maltaGroups.map((g) => g.id),
  );
  await assignPersonnelToGroupsEvenly(
    merkezPersonnelIds,
    merkezGroups.map((g) => g.id),
  );

  const absentIndices = seedAbsentIndices(PERSONNEL_COUNT, 8);
  for (const idx of absentIndices) {
    const startOffset = -seedInt(idx, 0, 2);
    const startDate = addDaysToDateString(today, startOffset);
    const endDate = addDaysToDateString(startDate, seedInt(idx + 11, 1, 3));
    await repos.absences.create({
      personnelId: createdPersonnel[idx],
      type: seedAbsenceType(idx),
      startDate,
      endDate,
      notes: null,
    });
  }

  const adminPersonnel = await repos.personnel.create(institutionId, {
    firstName: 'Ayşe',
    lastName: 'Yönetici',
    sicilNo: 'ADM-001',
    title: 'Kurum Müdürü',
  });
  await repos.units.assignPersonnel(malta.id, adminPersonnel.id);

  const managerPersonnel = await repos.personnel.create(institutionId, {
    firstName: 'Mehmet',
    lastName: 'Birim Amiri',
    sicilNo: 'MGR-001',
    title: 'Birim Yöneticisi',
  });
  await repos.units.assignPersonnel(malta.id, managerPersonnel.id);
  await repos.units.update(malta.id, { managerPersonnelId: managerPersonnel.id });

  const staffPersonnel = createdPersonnel[0];

  await repos.auth.createUser({
    institutionId,
    displayName: 'Kurum Müdürü',
    role: 'INSTITUTION_ADMIN',
    personnelId: adminPersonnel.id,
    pin: '1234',
  });
  await repos.auth.createUser({
    institutionId,
    displayName: 'Birim Yöneticisi',
    role: 'UNIT_MANAGER',
    personnelId: managerPersonnel.id,
    pin: '1234',
  });
  const staff = await repos.personnel.getById(staffPersonnel);
  await repos.auth.createUser({
    institutionId,
    displayName: staff ? `${staff.firstName} ${staff.lastName}` : 'Personel',
    role: 'PERSONNEL',
    personnelId: staffPersonnel,
    pin: null,
  });

  const taskNobet = await repos.taskTypes.create(institutionId, 'Nöbet', 'NOBET');
  const taskEmir = await repos.taskTypes.create(institutionId, 'Emir', 'EMIR');
  const taskGorev = await repos.taskTypes.create(institutionId, 'Görev', 'GOREV');
  await repos.taskTypes.create(institutionId, 'Eğitim', 'EGITIM');

  await repos.assignments.create(institutionId, {
    taskTypeId: taskNobet.id,
    title: 'Merkez Kontrol Nöbeti',
    description: 'Ana giriş kontrol noktası',
    date: today,
    startTime: '08:00',
    endTime: '16:00',
    requiredPersonnelCount: 2,
    managerPersonnelId: managerPersonnel.id,
    personnelIds: [createdPersonnel[50], createdPersonnel[51]],
  });
  await repos.assignments.create(institutionId, {
    taskTypeId: taskEmir.id,
    title: 'Nizamiye Emir Görevi',
    date: today,
    startTime: '10:00',
    endTime: '14:00',
    requiredPersonnelCount: 1,
    personnelIds: [createdPersonnel[70]],
  });
  await repos.assignments.create(institutionId, {
    taskTypeId: taskGorev.id,
    title: 'Malta Devriye',
    date: today,
    startTime: '19:00',
    endTime: '23:00',
    requiredPersonnelCount: 3,
    personnelIds: [createdPersonnel[0], createdPersonnel[1], createdPersonnel[2]],
  });

  await repos.institution.persist();

  return { institutionId };
}
