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

-- Datos relacionales del usuario vinculados a vehiculos
CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicles (
  id             VARCHAR(64)  PRIMARY KEY,
  user_email     VARCHAR(255) NOT NULL,
  title          VARCHAR(180) NOT NULL,
  brand          VARCHAR(100) NOT NULL,
  model          VARCHAR(120) NOT NULL,
  version        VARCHAR(160) NOT NULL DEFAULT '',
  transmission_type VARCHAR(40) NOT NULL DEFAULT '',
  cv             VARCHAR(20)  NOT NULL DEFAULT '',
  color          VARCHAR(60)  NOT NULL DEFAULT '',
  horsepower     VARCHAR(20)  NOT NULL DEFAULT '',
  seats          VARCHAR(10)  NOT NULL DEFAULT '',
  doors          VARCHAR(10)  NOT NULL DEFAULT '',
  vehicle_location VARCHAR(160) NOT NULL DEFAULT '',
  body_type      VARCHAR(60)  NOT NULL DEFAULT '',
  environmental_label VARCHAR(30) NOT NULL DEFAULT '',
  last_itv       VARCHAR(40)  NOT NULL DEFAULT '',
  next_itv       VARCHAR(40)  NOT NULL DEFAULT '',
  co2            VARCHAR(30)  NOT NULL DEFAULT '',
  price          VARCHAR(40)  NOT NULL DEFAULT '',
  marketplace_pricing_mode VARCHAR(30) NOT NULL DEFAULT 'manual',
  year           VARCHAR(20)  NOT NULL DEFAULT '',
  plate          VARCHAR(30)  NOT NULL DEFAULT '',
  mileage        VARCHAR(40)  NOT NULL DEFAULT '',
  fuel           VARCHAR(60)  NOT NULL DEFAULT '',
  policy_company VARCHAR(120) NOT NULL DEFAULT '',
  notes          TEXT         NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ  NOT NULL,
  updated_at     TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_vehicles_email
  ON moveadvisor_user_vehicles (user_email, created_at DESC);

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS version VARCHAR(160) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS transmission_type VARCHAR(40) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS cv VARCHAR(20) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS color VARCHAR(60) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS horsepower VARCHAR(20) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS seats VARCHAR(10) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS doors VARCHAR(10) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS vehicle_location VARCHAR(160) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS body_type VARCHAR(60) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS environmental_label VARCHAR(30) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS last_itv VARCHAR(40) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS next_itv VARCHAR(40) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS co2 VARCHAR(30) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS price VARCHAR(40) NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicles
  ADD COLUMN IF NOT EXISTS marketplace_pricing_mode VARCHAR(30) NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_files (
  id          BIGSERIAL    PRIMARY KEY,
  vehicle_id  VARCHAR(64)  NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
  file_type   VARCHAR(20)  NOT NULL CHECK (file_type IN ('photo', 'document')),
  file_name   VARCHAR(255) NOT NULL,
  file_size   BIGINT       NOT NULL DEFAULT 0,
  file_mime_type TEXT      NOT NULL DEFAULT '',
  file_content_base64 TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ  NOT NULL
);

ALTER TABLE moveadvisor_user_vehicle_files
  ADD COLUMN IF NOT EXISTS file_mime_type TEXT NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicle_files
  ADD COLUMN IF NOT EXISTS file_content_base64 TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_files_vehicle
  ON moveadvisor_user_vehicle_files (vehicle_id, file_type);

CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_characteristics (
  vehicle_id           VARCHAR(64) PRIMARY KEY REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
  transmission_type    VARCHAR(40) NOT NULL DEFAULT '',
  cv                   VARCHAR(20) NOT NULL DEFAULT '',
  color                VARCHAR(60) NOT NULL DEFAULT '',
  horsepower           VARCHAR(20) NOT NULL DEFAULT '',
  seats                VARCHAR(10) NOT NULL DEFAULT '',
  doors                VARCHAR(10) NOT NULL DEFAULT '',
  vehicle_location     VARCHAR(160) NOT NULL DEFAULT '',
  body_type            VARCHAR(60) NOT NULL DEFAULT '',
  environmental_label  VARCHAR(30) NOT NULL DEFAULT '',
  last_itv             VARCHAR(40) NOT NULL DEFAULT '',
  next_itv             VARCHAR(40) NOT NULL DEFAULT '',
  co2                  VARCHAR(30) NOT NULL DEFAULT '',
  price                VARCHAR(40) NOT NULL DEFAULT '',
  updated_at           TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_documents (
  id            BIGSERIAL PRIMARY KEY,
  vehicle_id     VARCHAR(64) NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
  document_type  VARCHAR(40) NOT NULL CHECK (document_type IN ('technical_sheet', 'circulation_permit', 'itv')),
  file_name      VARCHAR(255) NOT NULL,
  file_size      BIGINT NOT NULL DEFAULT 0,
  file_mime_type TEXT NOT NULL DEFAULT '',
  file_content_base64 TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL
);

ALTER TABLE moveadvisor_user_vehicle_documents
  ADD COLUMN IF NOT EXISTS file_mime_type TEXT NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_vehicle_documents
  ADD COLUMN IF NOT EXISTS file_content_base64 TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_documents_vehicle
  ON moveadvisor_user_vehicle_documents (vehicle_id, document_type);

CREATE TABLE IF NOT EXISTS moveadvisor_user_appointments (
  id                VARCHAR(64)  PRIMARY KEY,
  user_email        VARCHAR(255) NOT NULL,
  vehicle_id        VARCHAR(64)  NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
  appointment_type  VARCHAR(40)  NOT NULL,
  title             VARCHAR(180) NOT NULL,
  meta              TEXT         NOT NULL DEFAULT '',
  status            VARCHAR(80)  NOT NULL DEFAULT 'Pendiente',
  requested_at_text VARCHAR(60)  NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ  NOT NULL,
  updated_at        TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_appointments_email
  ON moveadvisor_user_appointments (user_email, created_at DESC);

CREATE TABLE IF NOT EXISTS moveadvisor_user_appointment_status_history (
  id              BIGSERIAL PRIMARY KEY,
  appointment_id  VARCHAR(64) NOT NULL REFERENCES moveadvisor_user_appointments(id) ON DELETE CASCADE,
  previous_status VARCHAR(80) NOT NULL DEFAULT '',
  next_status     VARCHAR(80) NOT NULL DEFAULT '',
  changed_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_appointment_status_history_appointment
  ON moveadvisor_user_appointment_status_history (appointment_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS moveadvisor_user_insurances (
  id               VARCHAR(64)  PRIMARY KEY,
  user_email       VARCHAR(255) NOT NULL,
  vehicle_id       VARCHAR(64)  NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
  provider         VARCHAR(140) NOT NULL DEFAULT '',
  policy_number    VARCHAR(80)  NOT NULL DEFAULT '',
  coverage_type    VARCHAR(80)  NOT NULL DEFAULT '',
  status           VARCHAR(40)  NOT NULL DEFAULT 'active',
  renewal_at_text  VARCHAR(60)  NOT NULL DEFAULT '',
  monthly_premium  NUMERIC(12,2),
  notes            TEXT         NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ  NOT NULL,
  updated_at       TIMESTAMPTZ  NOT NULL,
  UNIQUE (user_email, vehicle_id)
);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_insurances_email
  ON moveadvisor_user_insurances (user_email, updated_at DESC);

CREATE TABLE IF NOT EXISTS moveadvisor_user_insurance_documents (
  id            BIGSERIAL PRIMARY KEY,
  insurance_id  VARCHAR(64) NOT NULL REFERENCES moveadvisor_user_insurances(id) ON DELETE CASCADE,
  file_name     VARCHAR(255) NOT NULL,
  file_size     BIGINT NOT NULL DEFAULT 0,
  file_mime_type TEXT NOT NULL DEFAULT '',
  file_content_base64 TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL
);

ALTER TABLE moveadvisor_user_insurance_documents
  ADD COLUMN IF NOT EXISTS file_mime_type TEXT NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_insurance_documents
  ADD COLUMN IF NOT EXISTS file_content_base64 TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS ix_moveadvisor_insurance_documents_insurance
  ON moveadvisor_user_insurance_documents (insurance_id);

CREATE TABLE IF NOT EXISTS moveadvisor_user_maintenances (
  id                 VARCHAR(64)  PRIMARY KEY,
  user_email         VARCHAR(255) NOT NULL,
  vehicle_id         VARCHAR(64)  NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
  maintenance_type   VARCHAR(60)  NOT NULL DEFAULT 'maintenance',
  title              VARCHAR(180) NOT NULL,
  status             VARCHAR(80)  NOT NULL DEFAULT 'Pendiente',
  scheduled_at_text  VARCHAR(60)  NOT NULL DEFAULT '',
  workshop_name      VARCHAR(140) NOT NULL DEFAULT '',
  mileage_text       VARCHAR(40)  NOT NULL DEFAULT '',
  estimated_cost     NUMERIC(12,2),
  notes              TEXT         NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ  NOT NULL,
  updated_at         TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_maintenances_email
  ON moveadvisor_user_maintenances (user_email, created_at DESC);

CREATE TABLE IF NOT EXISTS moveadvisor_user_maintenance_invoices (
  id              BIGSERIAL PRIMARY KEY,
  maintenance_id  VARCHAR(64) NOT NULL REFERENCES moveadvisor_user_maintenances(id) ON DELETE CASCADE,
  file_name       VARCHAR(255) NOT NULL,
  file_size       BIGINT NOT NULL DEFAULT 0,
  file_mime_type TEXT NOT NULL DEFAULT '',
  file_content_base64 TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL
);

ALTER TABLE moveadvisor_user_maintenance_invoices
  ADD COLUMN IF NOT EXISTS file_mime_type TEXT NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_user_maintenance_invoices
  ADD COLUMN IF NOT EXISTS file_content_base64 TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS ix_moveadvisor_maintenance_invoices_maintenance
  ON moveadvisor_user_maintenance_invoices (maintenance_id);

CREATE TABLE IF NOT EXISTS moveadvisor_user_valuations (
  id             VARCHAR(64)  PRIMARY KEY,
  user_email     VARCHAR(255) NOT NULL,
  vehicle_id     VARCHAR(64)  NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
  title          VARCHAR(180) NOT NULL,
  meta           TEXT         NOT NULL DEFAULT '',
  status         VARCHAR(100) NOT NULL DEFAULT 'Ultima tasacion disponible',
  report         TEXT         NOT NULL DEFAULT '',
  estimate_value NUMERIC(12,2),
  created_at     TIMESTAMPTZ  NOT NULL,
  updated_at     TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_valuations_email
  ON moveadvisor_user_valuations (user_email, created_at DESC);

CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_states (
  id          BIGSERIAL    PRIMARY KEY,
  user_email  VARCHAR(255) NOT NULL,
  vehicle_id  VARCHAR(64)  NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
  state       VARCHAR(30)  NOT NULL CHECK (state IN ('owned', 'active_sale', 'sold')),
  listing_url TEXT         NOT NULL DEFAULT '',
  notes       TEXT         NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ  NOT NULL,
  UNIQUE (user_email, vehicle_id)
);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_states_email
  ON moveadvisor_user_vehicle_states (user_email, state, updated_at DESC);

CREATE TABLE IF NOT EXISTS moveadvisor_user_saved_offers (
  id            VARCHAR(80)  PRIMARY KEY,
  user_email    VARCHAR(255) NOT NULL,
  vehicle_id    VARCHAR(64) REFERENCES moveadvisor_user_vehicles(id) ON DELETE SET NULL,
  title         VARCHAR(180) NOT NULL DEFAULT '',
  offer_payload JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ  NOT NULL,
  updated_at    TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_saved_offers_email
  ON moveadvisor_user_saved_offers (user_email, created_at DESC);

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

-- BEGIN VEHICLE CATALOG SEED
-- Seed catalogo marcas/modelos (idempotente)
WITH brand_seed(name, sort_order) AS (
  VALUES
    ('Alfa Romeo', 1),
    ('Audi', 2),
    ('BMW', 3),
    ('BYD', 4),
    ('Citroen', 5),
    ('Cupra', 6),
    ('Toyota', 7),
    ('DS', 8),
    ('Dacia', 9),
    ('Fiat', 10),
    ('Ford', 11),
    ('Honda', 12),
    ('Hyundai', 13),
    ('Jaecoo', 14),
    ('Jaguar', 15),
    ('Jeep', 16),
    ('Kia', 17),
    ('Lexus', 18),
    ('Land Rover', 19),
    ('LynkCo', 20),
    ('Mazda', 21),
    ('Renault', 22),
    ('Mercedes', 23),
    ('MG', 24),
    ('Mini', 25),
    ('Mitsubishi', 26),
    ('Nissan', 27),
    ('Omoda', 28),
    ('Opel', 29),
    ('Peugeot', 30),
    ('Polestar', 31),
    ('Porsche', 32),
    ('Seat', 33),
    ('Skoda', 34),
    ('Smart', 35),
    ('Subaru', 36),
    ('Suzuki', 37),
    ('Tesla', 38),
    ('Volvo', 39),
    ('Volkswagen', 40),
    ('XPeng', 41)
)
INSERT INTO moveadvisor_vehicle_brands (name, sort_order, is_active)
SELECT name, sort_order, TRUE FROM brand_seed
ON CONFLICT (name) DO UPDATE
SET sort_order = EXCLUDED.sort_order, is_active = TRUE;

WITH model_seed(brand_name, model_name, sort_order) AS (
  VALUES
    ('Alfa Romeo', 'Giulia', 1),
    ('Alfa Romeo', 'Stelvio', 2),
    ('Alfa Romeo', 'Tonale', 3),
    ('Alfa Romeo', 'Junior', 4),
    ('Audi', 'A1', 1),
    ('Audi', 'A3', 2),
    ('Audi', 'Q2', 3),
    ('Audi', 'Q3', 4),
    ('BMW', 'Serie 1', 1),
    ('BMW', 'Serie 3', 2),
    ('BMW', 'X1', 3),
    ('BMW', 'X3', 4),
    ('BYD', 'Atto 3', 1),
    ('BYD', 'Dolphin', 2),
    ('BYD', 'Seal', 3),
    ('BYD', 'Seal U', 4),
    ('Citroen', 'C3', 1),
    ('Citroen', 'C4', 2),
    ('Citroen', 'C5 Aircross', 3),
    ('Citroen', 'Berlingo', 4),
    ('Cupra', 'Born', 1),
    ('Cupra', 'Formentor', 2),
    ('Cupra', 'Leon', 3),
    ('Cupra', 'Terramar', 4),
    ('Toyota', 'Corolla', 1),
    ('Toyota', 'C-HR', 2),
    ('Toyota', 'Yaris', 3),
    ('Toyota', 'RAV4', 4),
    ('DS', 'DS 3', 1),
    ('DS', 'DS 4', 2),
    ('DS', 'DS 7', 3),
    ('DS', 'DS 9', 4),
    ('Dacia', 'Sandero', 1),
    ('Dacia', 'Duster', 2),
    ('Dacia', 'Jogger', 3),
    ('Dacia', 'Spring', 4),
    ('Fiat', '500', 1),
    ('Fiat', '600', 2),
    ('Fiat', 'Tipo', 3),
    ('Fiat', 'Panda', 4),
    ('Ford', 'Fiesta', 1),
    ('Ford', 'Focus', 2),
    ('Ford', 'Kuga', 3),
    ('Ford', 'Puma', 4),
    ('Honda', 'Civic', 1),
    ('Honda', 'HR-V', 2),
    ('Honda', 'CR-V', 3),
    ('Honda', 'Jazz', 4),
    ('Hyundai', 'i20', 1),
    ('Hyundai', 'i30', 2),
    ('Hyundai', 'Kona', 3),
    ('Hyundai', 'Tucson', 4),
    ('Jaecoo', 'J7', 1),
    ('Jaecoo', 'J8', 2),
    ('Jaecoo', 'J7 PHEV', 3),
    ('Jaecoo', 'J8 PHEV', 4),
    ('Jaguar', 'E-Pace', 1),
    ('Jaguar', 'F-Pace', 2),
    ('Jaguar', 'XE', 3),
    ('Jaguar', 'I-Pace', 4),
    ('Jeep', 'Avenger', 1),
    ('Jeep', 'Compass', 2),
    ('Jeep', 'Renegade', 3),
    ('Jeep', 'Grand Cherokee', 4),
    ('Kia', 'Ceed', 1),
    ('Kia', 'Niro', 2),
    ('Kia', 'Sportage', 3),
    ('Kia', 'EV6', 4),
    ('Lexus', 'UX', 1),
    ('Lexus', 'NX', 2),
    ('Lexus', 'RX', 3),
    ('Lexus', 'LBX', 4),
    ('Land Rover', 'Range Rover Evoque', 1),
    ('Land Rover', 'Range Rover Velar', 2),
    ('Land Rover', 'Discovery Sport', 3),
    ('Land Rover', 'Defender', 4),
    ('LynkCo', '01', 1),
    ('LynkCo', '02', 2),
    ('LynkCo', '03', 3),
    ('LynkCo', '08', 4),
    ('Mazda', 'Mazda2', 1),
    ('Mazda', 'Mazda3', 2),
    ('Mazda', 'CX-30', 3),
    ('Mazda', 'CX-5', 4),
    ('Renault', 'Clio', 1),
    ('Renault', 'Captur', 2),
    ('Renault', 'Megane', 3),
    ('Renault', 'Austral', 4),
    ('Mercedes', 'Clase A', 1),
    ('Mercedes', 'Clase C', 2),
    ('Mercedes', 'GLA', 3),
    ('Mercedes', 'GLC', 4),
    ('MG', 'ZS', 1),
    ('MG', 'HS', 2),
    ('MG', 'MG4', 3),
    ('MG', 'Marvel R', 4),
    ('Mini', 'Cooper', 1),
    ('Mini', 'Countryman', 2),
    ('Mini', 'Aceman', 3),
    ('Mini', 'Clubman', 4),
    ('Mitsubishi', 'ASX', 1),
    ('Mitsubishi', 'Eclipse Cross', 2),
    ('Mitsubishi', 'Outlander', 3),
    ('Mitsubishi', 'Space Star', 4),
    ('Nissan', 'Micra', 1),
    ('Nissan', 'Qashqai', 2),
    ('Nissan', 'X-Trail', 3),
    ('Nissan', 'Juke', 4),
    ('Omoda', 'Omoda 5', 1),
    ('Omoda', 'Omoda 5 EV', 2),
    ('Omoda', 'Omoda 7', 3),
    ('Omoda', 'Omoda 9', 4),
    ('Opel', 'Corsa', 1),
    ('Opel', 'Astra', 2),
    ('Opel', 'Mokka', 3),
    ('Opel', 'Grandland', 4),
    ('Peugeot', '208', 1),
    ('Peugeot', '2008', 2),
    ('Peugeot', '308', 3),
    ('Peugeot', '3008', 4),
    ('Polestar', 'Polestar 2', 1),
    ('Polestar', 'Polestar 3', 2),
    ('Polestar', 'Polestar 4', 3),
    ('Polestar', 'Polestar 5', 4),
    ('Porsche', 'Macan', 1),
    ('Porsche', 'Cayenne', 2),
    ('Porsche', 'Taycan', 3),
    ('Porsche', 'Panamera', 4),
    ('Seat', 'Ibiza', 1),
    ('Seat', 'Leon', 2),
    ('Seat', 'Arona', 3),
    ('Seat', 'Ateca', 4),
    ('Skoda', 'Fabia', 1),
    ('Skoda', 'Octavia', 2),
    ('Skoda', 'Kamiq', 3),
    ('Skoda', 'Kodiaq', 4),
    ('Smart', 'fortwo', 1),
    ('Smart', 'forfour', 2),
    ('Smart', 'Smart 1', 3),
    ('Smart', 'Smart 3', 4),
    ('Subaru', 'Impreza', 1),
    ('Subaru', 'XV', 2),
    ('Subaru', 'Forester', 3),
    ('Subaru', 'Outback', 4),
    ('Suzuki', 'Swift', 1),
    ('Suzuki', 'Vitara', 2),
    ('Suzuki', 'S-Cross', 3),
    ('Suzuki', 'Across', 4),
    ('Tesla', 'Model 3', 1),
    ('Tesla', 'Model Y', 2),
    ('Tesla', 'Model S', 3),
    ('Tesla', 'Model X', 4),
    ('Volvo', 'XC40', 1),
    ('Volvo', 'XC60', 2),
    ('Volvo', 'S60', 3),
    ('Volvo', 'V60', 4),
    ('Volkswagen', 'Polo', 1),
    ('Volkswagen', 'Golf', 2),
    ('Volkswagen', 'T-Cross', 3),
    ('Volkswagen', 'T-Roc', 4),
    ('Volkswagen', 'Tiguan', 5),
    ('XPeng', 'G6', 1),
    ('XPeng', 'G9', 2),
    ('XPeng', 'P7', 3),
    ('XPeng', 'X9', 4)
)
INSERT INTO moveadvisor_vehicle_models (brand_id, name, sort_order, is_active)
SELECT b.id, m.model_name, m.sort_order, TRUE
FROM model_seed m
INNER JOIN moveadvisor_vehicle_brands b ON b.name = m.brand_name
ON CONFLICT (brand_id, name) DO UPDATE
SET sort_order = EXCLUDED.sort_order, is_active = TRUE;
-- END VEHICLE CATALOG SEED

-- BEGIN 3NF NORMALIZATION (compatible migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_moveadvisor_sessions_user_id'
  ) THEN
    ALTER TABLE moveadvisor_sessions
      ADD CONSTRAINT fk_moveadvisor_sessions_user_id
      FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
ALTER TABLE moveadvisor_user_appointments ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
ALTER TABLE moveadvisor_user_insurances ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
ALTER TABLE moveadvisor_user_maintenances ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
ALTER TABLE moveadvisor_user_valuations ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
ALTER TABLE moveadvisor_user_vehicle_states ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
ALTER TABLE moveadvisor_user_saved_offers ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);

UPDATE moveadvisor_user_vehicles t
SET user_id = u.id
FROM moveadvisor_users u
WHERE t.user_id IS NULL AND lower(u.email) = lower(t.user_email);

UPDATE moveadvisor_user_appointments t
SET user_id = u.id
FROM moveadvisor_users u
WHERE t.user_id IS NULL AND lower(u.email) = lower(t.user_email);

UPDATE moveadvisor_user_insurances t
SET user_id = u.id
FROM moveadvisor_users u
WHERE t.user_id IS NULL AND lower(u.email) = lower(t.user_email);

UPDATE moveadvisor_user_maintenances t
SET user_id = u.id
FROM moveadvisor_users u
WHERE t.user_id IS NULL AND lower(u.email) = lower(t.user_email);

UPDATE moveadvisor_user_valuations t
SET user_id = u.id
FROM moveadvisor_users u
WHERE t.user_id IS NULL AND lower(u.email) = lower(t.user_email);

UPDATE moveadvisor_user_vehicle_states t
SET user_id = u.id
FROM moveadvisor_users u
WHERE t.user_id IS NULL AND lower(u.email) = lower(t.user_email);

UPDATE moveadvisor_user_saved_offers t
SET user_id = u.id
FROM moveadvisor_users u
WHERE t.user_id IS NULL AND lower(u.email) = lower(t.user_email);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_vehicles_user_id ON moveadvisor_user_vehicles (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_appointments_user_id ON moveadvisor_user_appointments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_insurances_user_id ON moveadvisor_user_insurances (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_maintenances_user_id ON moveadvisor_user_maintenances (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_valuations_user_id ON moveadvisor_user_valuations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_vehicle_states_user_id ON moveadvisor_user_vehicle_states (user_id, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_saved_offers_user_id ON moveadvisor_user_saved_offers (user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_vehicles_user_id') THEN
    ALTER TABLE moveadvisor_user_vehicles
      ADD CONSTRAINT fk_moveadvisor_user_vehicles_user_id
      FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_appointments_user_id') THEN
    ALTER TABLE moveadvisor_user_appointments
      ADD CONSTRAINT fk_moveadvisor_user_appointments_user_id
      FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_insurances_user_id') THEN
    ALTER TABLE moveadvisor_user_insurances
      ADD CONSTRAINT fk_moveadvisor_user_insurances_user_id
      FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_maintenances_user_id') THEN
    ALTER TABLE moveadvisor_user_maintenances
      ADD CONSTRAINT fk_moveadvisor_user_maintenances_user_id
      FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_valuations_user_id') THEN
    ALTER TABLE moveadvisor_user_valuations
      ADD CONSTRAINT fk_moveadvisor_user_valuations_user_id
      FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_vehicle_states_user_id') THEN
    ALTER TABLE moveadvisor_user_vehicle_states
      ADD CONSTRAINT fk_moveadvisor_user_vehicle_states_user_id
      FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_saved_offers_user_id') THEN
    ALTER TABLE moveadvisor_user_saved_offers
      ADD CONSTRAINT fk_moveadvisor_user_saved_offers_user_id
      FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS year_int SMALLINT;
ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS mileage_km INTEGER;
ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS price_amount NUMERIC(12,2);
ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS co2_g_km NUMERIC(10,2);
ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS last_itv_date DATE;
ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS next_itv_date DATE;

UPDATE moveadvisor_user_vehicles
SET
  year_int = COALESCE(year_int, NULLIF(regexp_replace(year, '[^0-9]', '', 'g'), '')::SMALLINT),
  mileage_km = COALESCE(mileage_km, NULLIF(regexp_replace(mileage, '[^0-9]', '', 'g'), '')::INTEGER),
  price_amount = COALESCE(price_amount, NULLIF(replace(regexp_replace(price, '[^0-9,\.]', '', 'g'), ',', '.'), '')::NUMERIC(12,2)),
  co2_g_km = COALESCE(co2_g_km, NULLIF(replace(regexp_replace(co2, '[^0-9,\.]', '', 'g'), ',', '.'), '')::NUMERIC(10,2)),
  last_itv_date = COALESCE(last_itv_date,
    CASE
      WHEN last_itv ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(last_itv, 'DD/MM/YYYY')
      WHEN last_itv ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN last_itv::DATE
      ELSE NULL
    END),
  next_itv_date = COALESCE(next_itv_date,
    CASE
      WHEN next_itv ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(next_itv, 'DD/MM/YYYY')
      WHEN next_itv ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN next_itv::DATE
      ELSE NULL
    END);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_moveadvisor_user_vehicles_year_int_valid') THEN
    ALTER TABLE moveadvisor_user_vehicles
      ADD CONSTRAINT ck_moveadvisor_user_vehicles_year_int_valid
      CHECK (year_int IS NULL OR year_int BETWEEN 1950 AND 2100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_moveadvisor_user_vehicles_mileage_km_valid') THEN
    ALTER TABLE moveadvisor_user_vehicles
      ADD CONSTRAINT ck_moveadvisor_user_vehicles_mileage_km_valid
      CHECK (mileage_km IS NULL OR mileage_km >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_moveadvisor_user_vehicles_price_amount_valid') THEN
    ALTER TABLE moveadvisor_user_vehicles
      ADD CONSTRAINT ck_moveadvisor_user_vehicles_price_amount_valid
      CHECK (price_amount IS NULL OR price_amount >= 0);
  END IF;
END $$;
-- END 3NF NORMALIZATION

-- Allow sell-flow valuations without a garage vehicle (vehicle_id becomes optional)
DO $$
BEGIN
  -- Drop the NOT NULL constraint on vehicle_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'moveadvisor_user_valuations'
      AND column_name = 'vehicle_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE moveadvisor_user_valuations ALTER COLUMN vehicle_id DROP NOT NULL;
  END IF;

  -- Drop the FK constraint from vehicle_id to moveadvisor_user_vehicles
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'moveadvisor_user_valuations_vehicle_id_fkey'
  ) THEN
    ALTER TABLE moveadvisor_user_valuations
      DROP CONSTRAINT moveadvisor_user_valuations_vehicle_id_fkey;
  END IF;
END $$;
