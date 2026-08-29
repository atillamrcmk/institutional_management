const FIRST_NAMES = [
  'Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'Hasan', 'İbrahim', 'İsmail', 'Osman', 'Yusuf',
  'Ayşe', 'Fatma', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Merve', 'Esra', 'Seda', 'Derya',
  'Burak', 'Emre', 'Serkan', 'Murat', 'Kemal', 'Cem', 'Tolga', 'Onur', 'Barış', 'Kaan',
  'Gizem', 'Büşra', 'Selin', 'Pınar', 'Ceren', 'Deniz', 'Ece', 'Melis', 'Tuğba', 'Yasemin',
];

const LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir',
  'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek',
  'Polat', 'Korkmaz', 'Çakır', 'Erdoğan', 'Güneş', 'Aksoy', 'Bulut', 'Taş', 'Acar', 'Tekin',
];

const TITLES = [
  'Güvenlik Görevlisi',
  'Kıdemli Görevli',
  'Amir Yardımcısı',
  'Operatör',
] as const;

const ABSENCE_TYPES = ['LEAVE', 'REPORT', 'TRAINING'] as const;

export function seedFirstName(index: number): string {
  return FIRST_NAMES[index % FIRST_NAMES.length];
}

export function seedLastName(index: number): string {
  return LAST_NAMES[(index * 7 + 3) % LAST_NAMES.length];
}

export function seedTitle(index: number): (typeof TITLES)[number] {
  return TITLES[index % TITLES.length];
}

export function seedAbsentIndices(total: number, count: number): number[] {
  const indices: number[] = [];
  let cursor = 0;
  while (indices.length < count && indices.length < total) {
    if (cursor % 3 !== 1) {
      indices.push(cursor % total);
    }
    cursor += 1;
  }
  return indices.slice(0, count);
}

export function seedInt(seed: number, min: number, max: number): number {
  const span = max - min + 1;
  return min + ((seed * 9301 + 49297) % span);
}

export function seedAbsenceType(index: number): (typeof ABSENCE_TYPES)[number] {
  return ABSENCE_TYPES[index % ABSENCE_TYPES.length];
}
