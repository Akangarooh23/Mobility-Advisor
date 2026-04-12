-- MoveAdvisor – Inicialización de esquema para Neon / Vercel Postgres
-- Ejecutar una sola vez al conectar la base de datos en Vercel
-- (el código lo hace automáticamente en el primer arrange, pero este
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

CREATE INDEX IF NOT EXISTS ix_moveadvisor_sessions_user_id    ON moveadvisor_sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_sessions_expires_at ON moveadvisor_sessions (expires_at);
