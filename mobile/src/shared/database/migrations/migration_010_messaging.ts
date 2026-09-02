import type { SQLiteDatabaseAdapter } from '@/shared/database/types';

export const version = 10;

export async function up(db: SQLiteDatabaseAdapter): Promise<void> {
  await db.execAsync(`
    ALTER TABLE users ADD COLUMN can_message_admins INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      institution_id TEXT NOT NULL,
      sender_user_id TEXT NOT NULL,
      sender_display_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      audience_type TEXT NOT NULL,
      unit_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (institution_id) REFERENCES institutions(id),
      FOREIGN KEY (sender_user_id) REFERENCES users(id),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_institution ON messages(institution_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

    CREATE TABLE IF NOT EXISTS message_recipients (
      id TEXT PRIMARY KEY NOT NULL,
      message_id TEXT NOT NULL,
      user_id TEXT,
      personnel_id TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (personnel_id) REFERENCES personnel(id)
    );

    CREATE INDEX IF NOT EXISTS idx_message_recipients_message ON message_recipients(message_id);
    CREATE INDEX IF NOT EXISTS idx_message_recipients_user ON message_recipients(user_id);
    CREATE INDEX IF NOT EXISTS idx_message_recipients_personnel ON message_recipients(personnel_id);

    CREATE TABLE IF NOT EXISTS device_push_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      platform TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, token)
    );

    CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user ON device_push_tokens(user_id);
  `);
}
