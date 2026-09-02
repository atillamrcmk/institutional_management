-- Control plane: kurum kaydı ve provisioning
-- Veritabanı: personel_planla_control

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  org_type TEXT NOT NULL DEFAULT 'INSTITUTION', -- INSTITUTION | BUSINESS
  db_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- PROVISIONING | ACTIVE | SUSPENDED | DELETED
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Control-plane login (owner / platform). Tenant DB users da JWT alabilir.
CREATE TABLE IF NOT EXISTS tenant_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'INSTITUTION_ADMIN',
  tenant_user_id TEXT, -- tenant DB users.id ile eşleşir
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_tenant_accounts_tenant ON tenant_accounts(tenant_id);

CREATE TABLE IF NOT EXISTS provisioning_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL, -- OK | ERROR
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
