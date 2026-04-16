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
