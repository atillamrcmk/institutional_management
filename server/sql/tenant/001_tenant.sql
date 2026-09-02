-- Tenant DB şeması — her kurum için ayrı veritabanında çalışır
-- Örnek DB adı: pp_t_kuzey_kampus

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personnel (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  sicil_no TEXT NOT NULL,
  title TEXT,
  photo_uri TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_sicil_active
  ON personnel (sicil_no)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES units(id),
  name TEXT NOT NULL,
  minimum_staff INTEGER NOT NULL DEFAULT 0,
  manager_personnel_id TEXT REFERENCES personnel(id),
  work_schedule_type TEXT NOT NULL DEFAULT 'SHIFT', -- OFFICE | SHIFT
  office_start_time TEXT,
  office_end_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  personnel_id TEXT REFERENCES personnel(id),
  display_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL, -- INSTITUTION_ADMIN | UNIT_MANAGER | PERSONNEL
  pin_hash TEXT,
  password_hash TEXT,
  can_message_admins BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users (email)
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  unit_id TEXT REFERENCES units(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_grants_unique
  ON user_grants (user_id, permission, COALESCE(unit_id, ''));

CREATE TABLE IF NOT EXISTS personnel_unit_history (
  id TEXT PRIMARY KEY,
  personnel_id TEXT NOT NULL REFERENCES personnel(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_puh_personnel ON personnel_unit_history(personnel_id);
CREATE INDEX IF NOT EXISTS idx_puh_unit ON personnel_unit_history(unit_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL REFERENCES users(id),
  sender_display_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  audience_type TEXT NOT NULL,
  unit_id TEXT REFERENCES units(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

CREATE TABLE IF NOT EXISTS message_recipients (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  personnel_id TEXT REFERENCES personnel(id),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_recipients_user ON message_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_personnel ON message_recipients(personnel_id);

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user ON device_push_tokens(user_id);
