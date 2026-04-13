-- sqlfluff:dialect:postgres
-- dialect: postgresql
-- MoveAdvisor – Inicialización de esquema para Neon / Vercel Postgres
-- Ejecutar una sola vez al conectar la base de datos en Vercel
-- (el código lo hace automáticamente en el primer arranque, pero este
--  fichero sirve como referencia y para provisioning manual)

CREATE TABLE IF NOT EXISTS moveadvisor_users (
  id            VARCHAR(64)  PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_salt VARCHAR(64)  NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL,
  last_login_at TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_sessions (
  id           VARCHAR(64)  PRIMARY KEY,
  user_id      VARCHAR(64)  NOT NULL,
  token_hash   VARCHAR(200) NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL,
  expires_at   TIMESTAMPTZ  NOT NULL,
  last_seen_at TIMESTAMPTZ  NOT NULL,
  user_agent   VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_sessions_user_id ON moveadvisor_sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_sessions_expires_at ON moveadvisor_sessions (expires_at);

-- Catálogo de vehículos (marcas y modelos)
CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_brands (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order INT          NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_brands_name
  ON moveadvisor_vehicle_brands (name);

CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_models (
  id         SERIAL       PRIMARY KEY,
  brand_id   INT          NOT NULL REFERENCES moveadvisor_vehicle_brands(id),
  name       VARCHAR(120) NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order INT          NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_models_brand_name
  ON moveadvisor_vehicle_models (brand_id, name);
