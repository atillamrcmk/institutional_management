-- Tenant DB şeması — operasyonel tablolar (vardiya, izin, görev, denetim)
-- 001_tenant.sql'den SONRA çalışır. Tamamen idempotent olmalıdır:
-- hem yeni tenant provisioning'inde hem de mevcut tenant'ları migrate ederken çalışır.
--
-- Not: institution_id yoktur — her tenant zaten kendi veritabanındadır.

-- ---------------------------------------------------------------------------
-- units: mesai tipi varsayılanları
-- ---------------------------------------------------------------------------

ALTER TABLE units ADD COLUMN IF NOT EXISTS work_schedule_type TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS office_start_time TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS office_end_time TEXT;

UPDATE units SET work_schedule_type = 'OFFICE' WHERE work_schedule_type IS NULL;
UPDATE units SET office_start_time = '08:00' WHERE office_start_time IS NULL;
UPDATE units SET office_end_time = '17:00' WHERE office_end_time IS NULL;

-- Yeni birimler varsayılan olarak mesai (OFFICE) düzenindedir; vardiya grubu
-- eklendiğinde uygulama tarafında SHIFT'e çevrilir.
ALTER TABLE units ALTER COLUMN work_schedule_type SET DEFAULT 'OFFICE';
ALTER TABLE units ALTER COLUMN office_start_time SET DEFAULT '08:00';
ALTER TABLE units ALTER COLUMN office_end_time SET DEFAULT '17:00';
ALTER TABLE units ALTER COLUMN work_schedule_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_units_parent ON units(parent_id);
CREATE INDEX IF NOT EXISTS idx_units_schedule_type ON units(work_schedule_type);

-- ---------------------------------------------------------------------------
-- Vardiya motoru
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shift_patterns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  reference_date TEXT NOT NULL, -- YYYY-MM-DD, döngü gün 0'ının referansı
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_pattern_days (
  id TEXT PRIMARY KEY,
  pattern_id TEXT NOT NULL REFERENCES shift_patterns(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  shift_type TEXT NOT NULL, -- DAY | NIGHT | FULL | OFF
  start_time TEXT,
  end_time TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_pattern_days_unique
  ON shift_pattern_days(pattern_id, day_index);

CREATE TABLE IF NOT EXISTS shift_groups (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pattern_id TEXT NOT NULL REFERENCES shift_patterns(id),
  cycle_offset INTEGER NOT NULL DEFAULT 0, -- deprecated, cycle_start_date kullanın
  cycle_start_date TEXT, -- YYYY-MM-DD, bu grup için döngü gün 0'ı
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_groups_unit ON shift_groups(unit_id);
CREATE INDEX IF NOT EXISTS idx_shift_groups_pattern ON shift_groups(pattern_id);

CREATE TABLE IF NOT EXISTS personnel_shift_assignments (
  id TEXT PRIMARY KEY,
  personnel_id TEXT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  shift_group_id TEXT NOT NULL REFERENCES shift_groups(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psa_personnel ON personnel_shift_assignments(personnel_id);
CREATE INDEX IF NOT EXISTS idx_psa_group ON personnel_shift_assignments(shift_group_id);

-- Bir personel aynı anda yalnızca tek bir aktif vardiya grubunda olabilir
CREATE UNIQUE INDEX IF NOT EXISTS idx_psa_active_personnel
  ON personnel_shift_assignments(personnel_id)
  WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------------
-- İzin / rapor / eğitim / geçici görev
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS personnel_absences (
  id TEXT PRIMARY KEY,
  personnel_id TEXT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- LEAVE | REPORT | TRAINING | TEMPORARY_DUTY
  start_date TEXT NOT NULL, -- YYYY-MM-DD
  end_date TEXT NOT NULL,   -- YYYY-MM-DD (dahil)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absences_personnel
  ON personnel_absences(personnel_id);
CREATE INDEX IF NOT EXISTS idx_absences_range
  ON personnel_absences(start_date, end_date);

-- ---------------------------------------------------------------------------
-- Görev tipleri ve görevlendirmeler
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS task_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_types_code ON task_types(code);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  task_type_id TEXT NOT NULL REFERENCES task_types(id),
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,       -- YYYY-MM-DD
  start_time TEXT NOT NULL, -- HH:mm
  end_time TEXT,            -- HH:mm
  required_personnel_count INTEGER NOT NULL DEFAULT 1,
  manager_personnel_id TEXT REFERENCES personnel(id),
  status TEXT NOT NULL DEFAULT 'PLANNED', -- PLANNED | ACTIVE | COMPLETED | CANCELLED
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_task_type ON assignments(task_type_id);

CREATE TABLE IF NOT EXISTS assignment_personnel (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  personnel_id TEXT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_personnel_assignment
  ON assignment_personnel(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_personnel_personnel
  ON assignment_personnel(personnel_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_personnel_unique
  ON assignment_personnel(assignment_id, personnel_id);

-- ---------------------------------------------------------------------------
-- Denetim kayıtları
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- ---------------------------------------------------------------------------
-- Şema sürümü
-- ---------------------------------------------------------------------------

INSERT INTO meta (key, value) VALUES ('schema_version', '002')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
