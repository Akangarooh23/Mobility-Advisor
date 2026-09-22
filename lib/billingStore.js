const fs = require("fs");
const path = require("path");
const {
  uploadBase64ToSupabase, safeName, urlPrivada, caminoPrivado, BUCKET_PRIVADO,
} = require("./supabaseStorage");

/**
 * Sube un papel del coche al cajón privado y devuelve su dirección.
 *
 * Los papeles iban al mismo sitio que las fotos, `vehicle-files`, que es
 * **público**: el permiso de circulación, la ficha técnica y la ITV de un coche
 * se abrían con la dirección a pelo, sin sesión. Y la dirección viaja: sale en
 * la respuesta del panel y de la app.
 *
 * Las fotos se quedan donde están —son el escaparate—. Esto es solo para lo que
 * lleva matrícula, bastidor y nombre de una persona.
 */
/**
 * Con qué enlace se abre un papel, o cadena vacía si se abre con el suyo.
 *
 * Los papeles nuevos están en el cajón privado: su dirección no abre nada, así
 * que lo que va a la pantalla es una dirección nuestra, que comprueba la sesión
 * y firma la bajada. Las fotos y los papeles de antes siguen con la suya.
 *
 * **El `url` se deja como está a propósito.** El panel devuelve la lista de
 * adjuntos tal como la recibió, y `garage_add` la usa para saber cuáles ya
 * estaban: si aquí se cambiara `url` por el enlace, al guardar no cuadraría
 * ninguno y se borrarían los papeles del coche. El enlace va aparte.
 */
function comoSeAbre(vehicleId, fileUrl) {
  if (!fileUrl || fileUrl.includes("/object/public/")) return "";
  const camino = caminoPrivado(fileUrl);
  if (!camino || !camino.startsWith(`vehicles/${vehicleId}/`)) return "";
  return `/api/papel-del-coche?coche=${encodeURIComponent(vehicleId)}&camino=${encodeURIComponent(camino)}`;
}

async function subeUnPapel(b64, mimeType, storagePath) {
  const guardado = await uploadBase64ToSupabase(b64, mimeType, storagePath, BUCKET_PRIVADO);
  // Para el cajón privado devuelve el camino, no una URL: aquí se guarda la
  // dirección entera, que es lo que sabe leer `papel-del-coche`.
  return guardado ? urlPrivada(guardado) : '';
}
const { comoSeLlamaElPapel } = require("./como-se-llama-el-papel");
const { loQueSeSabe: loQueSeSabeDelMantenimiento } = require("./lo-que-se-sabe-del-mantenimiento");
const { estadoDeReserva } = require("./citas");
const { SSL_POSTGRES } = require("./postgres-ssl");
const {
  lasPuertas: lasPuertasDelEncargo,
  loQueHayDe: loQueHayDelCoche,
} = require("./puertas-del-encargo");
const {
  shouldUseSqlServerMobility,
  listGarageVehicleSummariesSqlServer,
  listGarageVehiclesSqlServer,
  addGarageVehicleSqlServer,
  removeGarageVehicleSqlServer,
  listAppointmentsSqlServer,
  addAppointmentSqlServer,
  listMaintenancesSqlServer,
  addMaintenanceSqlServer,
  listInsurancesSqlServer,
  upsertInsuranceSqlServer,
  listValuationsSqlServer,
  addValuationSqlServer,
  listVehicleStatesSqlServer,
  upsertVehicleStateSqlServer,
  listSavedOffersSqlServer,
  addSavedOfferSqlServer,
  removeSavedOfferSqlServer,
  getUserMobilityDataSqlServer,
} = require("./sqlserverMobilityStore");

/**
 * El almacén de facturación, que es un fichero del repositorio.
 *
 * Se puede apuntar a otro sitio con `BILLING_STORE_PATH`, y eso es lo que hacen
 * las pruebas: emitir una factura escribe aquí, y varias pruebas a la vez —que
 * es como corren— se pisaban la copia de seguridad entre ellas y acababan
 * dejando un cliente inventado dentro del repositorio.
 */
const BILLING_STORE_PATH = process.env.BILLING_STORE_PATH
  || path.join(__dirname, "..", "db", "billing-data.json");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

const VEHICLE_DOCUMENT_TYPES = {
  technicalSheet: "technical_sheet",
  circulationPermit: "circulation_permit",
  itv: "itv",
};

const MAX_ATTACHMENT_CONTENT_LENGTH = 2_800_000;

function sanitizeAttachment(input = {}) {
  let safeInput = input;

  if (typeof safeInput === "string") {
    try {
      safeInput = JSON.parse(safeInput);
    } catch {
      safeInput = { name: safeInput };
    }
  }

  if (!safeInput || typeof safeInput !== "object" || Array.isArray(safeInput)) {
    safeInput = {};
  }

  return {
    name: normalizeText(safeInput?.name),
    size: Number(safeInput?.size || 0),
    mimeType: normalizeText(safeInput?.mimeType),
    contentBase64: normalizeText(safeInput?.contentBase64).slice(0, MAX_ATTACHMENT_CONTENT_LENGTH),
    url: normalizeText(safeInput?.url || safeInput?.imageUrl || safeInput?.src || safeInput?.previewUrl),
  };
}

function sanitizeAttachmentArray(input, limit = 30) {
  let safeInput = input;

  if (typeof safeInput === "string") {
    try {
      safeInput = JSON.parse(safeInput);
    } catch {
      safeInput = [];
    }
  }

  if (!Array.isArray(safeInput)) {
    if (safeInput && typeof safeInput === "object") {
      safeInput = [safeInput];
    } else {
      safeInput = [];
    }
  }

  return safeInput
    .map((item) => sanitizeAttachment(item))
    .filter((item) => item.name)
    .slice(0, limit);
}

function hasPostgresConnection() {
  return Boolean(normalizeText(process.env.DATABASE_URL || process.env.POSTGRES_URL));
}

let _pgPool = null;
let _pgMobilitySchemaEnsured = false;

function getPgPool() {
  if (!_pgPool) {
    const { Pool } = require("pg");
    const connectionString = normalizeText(process.env.DATABASE_URL || process.env.POSTGRES_URL);

    if (!connectionString) {
      throw new Error("No DATABASE_URL o POSTGRES_URL configurados para movilidad relacional.");
    }

    _pgPool = new Pool({
      connectionString,
      ssl: SSL_POSTGRES,
    });
  }

  return _pgPool;
}

async function ensureMobilitySchemaPostgres() {
  if (_pgMobilitySchemaEnsured || !hasPostgresConnection()) {
    return;
  }

  const pool = getPgPool();

  /*
   * Atajo: si existe la última columna añadida, el esquema está al día.
   *
   * Quien añada una columna nueva tiene que cambiar **también** esta consulta.
   * Si no, el atajo salta con la columna vieja, se salta todos los ALTER de
   * abajo y la columna nueva no se crea nunca en producción — y el fallo no se
   * ve al arrancar, se ve al guardar. Por eso se prueba la última: aquí está
   * `pdf_path`, de las tasaciones. Hay un test que lo comprueba solo.
   */
  try {
    await pool.query("SELECT pdf_path FROM moveadvisor_user_valuations LIMIT 0");
    _pgMobilitySchemaEnsured = true;
    return;
  } catch {
    // Schema migration needed — fall through to DDL block below
  }

  await pool.query(`
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
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_vehicles_email ON moveadvisor_user_vehicles (user_email, created_at DESC)"
  );

  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS version VARCHAR(160) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS transmission_type VARCHAR(40) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS cv VARCHAR(20) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS color VARCHAR(60) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS horsepower VARCHAR(20) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS seats VARCHAR(10) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS doors VARCHAR(10) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS vehicle_location VARCHAR(160) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS body_type VARCHAR(60) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS environmental_label VARCHAR(30) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS last_itv VARCHAR(40) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS next_itv VARCHAR(40) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS co2 VARCHAR(30) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS price VARCHAR(40) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS marketplace_pricing_mode VARCHAR(30) NOT NULL DEFAULT 'manual'"
  );

  /*
   * Lo que se sabe del mantenimiento, en el coche y no en un registro aparte.
   *
   * Es una propiedad del coche —«tiene libro», «las revisiones son oficiales»—,
   * no un suceso con fecha como lo es una revisión concreta. Metido en la tabla
   * de mantenimientos habría que inventarse un registro para poder guardarlo,
   * que es justo lo que hacía el «Mantenimiento» automático de antes.
   */
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS service_book VARCHAR(16) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS official_service VARCHAR(16) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS last_service_date VARCHAR(40) NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS last_service_km VARCHAR(40) NOT NULL DEFAULT ''"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_files (
      id          BIGSERIAL    PRIMARY KEY,
      vehicle_id  VARCHAR(64)  NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
      file_type   VARCHAR(20)  NOT NULL CHECK (file_type IN ('photo', 'document')),
      file_name   VARCHAR(255) NOT NULL,
      file_size   BIGINT       NOT NULL DEFAULT 0,
      file_mime_type TEXT      NOT NULL DEFAULT '',
      file_content_base64 TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ  NOT NULL
    )
  `);

  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicle_files ADD COLUMN IF NOT EXISTS file_mime_type TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicle_files ADD COLUMN IF NOT EXISTS file_content_base64 TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicle_files ADD COLUMN IF NOT EXISTS file_url TEXT NOT NULL DEFAULT ''"
  );

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_files_vehicle ON moveadvisor_user_vehicle_files (vehicle_id, file_type)"
  );

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_documents (
      id             BIGSERIAL PRIMARY KEY,
      vehicle_id      VARCHAR(64) NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
      document_type   VARCHAR(40) NOT NULL CHECK (document_type IN ('technical_sheet', 'circulation_permit', 'itv')),
      file_name       VARCHAR(255) NOT NULL,
      file_size       BIGINT NOT NULL DEFAULT 0,
      file_mime_type  TEXT NOT NULL DEFAULT '',
      file_content_base64 TEXT NOT NULL DEFAULT '',
      created_at      TIMESTAMPTZ NOT NULL
    )
  `);

  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicle_documents ADD COLUMN IF NOT EXISTS file_mime_type TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicle_documents ADD COLUMN IF NOT EXISTS file_content_base64 TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_vehicle_documents ADD COLUMN IF NOT EXISTS file_url TEXT NOT NULL DEFAULT ''"
  );

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_documents_vehicle ON moveadvisor_user_vehicle_documents (vehicle_id, document_type)"
  );

  await pool.query(`
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
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_appointments_email ON moveadvisor_user_appointments (user_email, created_at DESC)"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_user_appointment_status_history (
      id              BIGSERIAL PRIMARY KEY,
      appointment_id  VARCHAR(64) NOT NULL REFERENCES moveadvisor_user_appointments(id) ON DELETE CASCADE,
      previous_status VARCHAR(80) NOT NULL DEFAULT '',
      next_status     VARCHAR(80) NOT NULL DEFAULT '',
      changed_at      TIMESTAMPTZ NOT NULL
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_appointment_status_history_appointment ON moveadvisor_user_appointment_status_history (appointment_id, changed_at DESC)"
  );

  await pool.query(`
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
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_insurances_email ON moveadvisor_user_insurances (user_email, updated_at DESC)"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_user_insurance_documents (
      id            BIGSERIAL PRIMARY KEY,
      insurance_id  VARCHAR(64) NOT NULL REFERENCES moveadvisor_user_insurances(id) ON DELETE CASCADE,
      file_name     VARCHAR(255) NOT NULL,
      file_size     BIGINT NOT NULL DEFAULT 0,
      file_mime_type TEXT NOT NULL DEFAULT '',
      file_content_base64 TEXT NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ NOT NULL
    )
  `);

  await pool.query(
    "ALTER TABLE moveadvisor_user_insurance_documents ADD COLUMN IF NOT EXISTS file_mime_type TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_insurance_documents ADD COLUMN IF NOT EXISTS file_content_base64 TEXT NOT NULL DEFAULT ''"
  );

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_insurance_documents_insurance ON moveadvisor_user_insurance_documents (insurance_id)"
  );

  await pool.query(`
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
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_maintenances_email ON moveadvisor_user_maintenances (user_email, created_at DESC)"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_user_maintenance_invoices (
      id              BIGSERIAL PRIMARY KEY,
      maintenance_id  VARCHAR(64) NOT NULL REFERENCES moveadvisor_user_maintenances(id) ON DELETE CASCADE,
      file_name       VARCHAR(255) NOT NULL,
      file_size       BIGINT NOT NULL DEFAULT 0,
      file_mime_type  TEXT NOT NULL DEFAULT '',
      file_content_base64 TEXT NOT NULL DEFAULT '',
      created_at      TIMESTAMPTZ NOT NULL
    )
  `);

  await pool.query(
    "ALTER TABLE moveadvisor_user_maintenance_invoices ADD COLUMN IF NOT EXISTS file_mime_type TEXT NOT NULL DEFAULT ''"
  );
  await pool.query(
    "ALTER TABLE moveadvisor_user_maintenance_invoices ADD COLUMN IF NOT EXISTS file_content_base64 TEXT NOT NULL DEFAULT ''"
  );

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_maintenance_invoices_maintenance ON moveadvisor_user_maintenance_invoices (maintenance_id)"
  );

  await pool.query(`
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
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_valuations_email ON moveadvisor_user_valuations (user_email, created_at DESC)"
  );


  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_states (
      id          BIGSERIAL    PRIMARY KEY,
      user_email  VARCHAR(255) NOT NULL,
      vehicle_id  VARCHAR(64)  NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
      state       VARCHAR(30)  NOT NULL CHECK (state IN ('owned', 'active_sale', 'sold')),
      listing_url TEXT         NOT NULL DEFAULT '',
      notes       TEXT         NOT NULL DEFAULT '',
      updated_at  TIMESTAMPTZ  NOT NULL,
      UNIQUE (user_email, vehicle_id)
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_states_email ON moveadvisor_user_vehicle_states (user_email, state, updated_at DESC)"
  );
  // Add is_listed column if not yet present (vehicles can be owned AND listed simultaneously)
  await pool.query("ALTER TABLE moveadvisor_user_vehicle_states ADD COLUMN IF NOT EXISTS is_listed BOOLEAN NOT NULL DEFAULT false");
  // Backfill: existing active_sale rows become owned + is_listed=true
  await pool.query("UPDATE moveadvisor_user_vehicle_states SET is_listed = true WHERE state = 'active_sale' AND is_listed = false");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_user_saved_offers (
      id            VARCHAR(80)  PRIMARY KEY,
      user_email    VARCHAR(255) NOT NULL,
      vehicle_id    VARCHAR(64) REFERENCES moveadvisor_user_vehicles(id) ON DELETE SET NULL,
      title         VARCHAR(180) NOT NULL DEFAULT '',
      offer_payload JSONB        NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ  NOT NULL,
      updated_at    TIMESTAMPTZ  NOT NULL
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_saved_offers_email ON moveadvisor_user_saved_offers (user_email, created_at DESC)"
  );

  await pool.query("ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)");
  await pool.query("ALTER TABLE moveadvisor_user_appointments ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)");
  await pool.query("ALTER TABLE moveadvisor_user_insurances ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)");
  await pool.query("ALTER TABLE moveadvisor_user_maintenances ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)");
  await pool.query("ALTER TABLE moveadvisor_user_valuations ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)");
  await pool.query("ALTER TABLE moveadvisor_user_vehicle_states ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)");
  await pool.query("ALTER TABLE moveadvisor_user_saved_offers ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)");

  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('moveadvisor_users') IS NOT NULL THEN
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
      END IF;
    END $$;
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_vehicles_user_id ON moveadvisor_user_vehicles (user_id, created_at DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_appointments_user_id ON moveadvisor_user_appointments (user_id, created_at DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_insurances_user_id ON moveadvisor_user_insurances (user_id, updated_at DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_maintenances_user_id ON moveadvisor_user_maintenances (user_id, created_at DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_valuations_user_id ON moveadvisor_user_valuations (user_id, created_at DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_vehicle_states_user_id ON moveadvisor_user_vehicle_states (user_id, state, updated_at DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_saved_offers_user_id ON moveadvisor_user_saved_offers (user_id, created_at DESC)");

  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('moveadvisor_users') IS NOT NULL THEN
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
      END IF;
    END $$;
  `);

  await pool.query("ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS year_int SMALLINT");
  await pool.query("ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS mileage_km INTEGER");
  await pool.query("ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS price_amount NUMERIC(12,2)");
  await pool.query("ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS co2_g_km NUMERIC(10,2)");
  await pool.query("ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS last_itv_date DATE");
  await pool.query("ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS next_itv_date DATE");

  /*
   * Dónde quedó guardado el PDF del informe, en el cajón privado.
   *
   * Antes el informe solo existía en el correo del cliente: se generaba, se
   * mandaba adjunto y se tiraba. Quien perdía ese correo se quedaba sin él, y
   * desde su panel no había manera de volver a bajarlo.
   *
   * Se guarda el camino y no la URL: el cajón es privado y la dirección se
   * firma en cada descarga, después de comprobar que el informe es suyo.
   */
  await pool.query(
    "ALTER TABLE moveadvisor_user_valuations ADD COLUMN IF NOT EXISTS pdf_path VARCHAR(400) NOT NULL DEFAULT ''"
  );

  await pool.query(`
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
        END)
  `);

  _pgMobilitySchemaEnsured = true;
}

function toEsDateTimeText(value) {
  try {
    return new Date(value || Date.now()).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

async function resolvePostgresUserIdentity(pool, email = "") {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return { normalizedEmail: "", userId: null };
  }

  try {
    const userResult = await pool.query(
      "SELECT id FROM moveadvisor_users WHERE lower(email) = lower($1) LIMIT 1",
      [normalizedEmail]
    );
    const userId = normalizeText(userResult.rows?.[0]?.id) || null;
    return { normalizedEmail, userId };
  } catch {
    return { normalizedEmail, userId: null };
  }
}

async function listGarageVehiclesByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const vehiclesResult = await pool.query(
    `
      SELECT id, title, brand, model, version, transmission_type, cv, color, horsepower, seats, doors, vehicle_location, body_type, environmental_label, last_itv, next_itv, co2, price, marketplace_pricing_mode, year, plate, mileage, fuel, policy_company, service_book, official_service, last_service_date, last_service_km, notes, created_at
      FROM moveadvisor_user_vehicles
      WHERE (user_id = $1 OR lower(user_email) = $2)
      ORDER BY created_at DESC
      LIMIT 20
    `,
    [userId, normalizedEmail]
  );

  const vehicles = vehiclesResult.rows || [];

  if (vehicles.length === 0) {
    return [];
  }

  const vehicleIds = vehicles.map((item) => item.id);
  // Fetch all vehicle-related data in parallel (states, files, docs, insurances, maintenances, marketplace status)
  const [statesResult, filesResult, documentsResult, insurancesResult, maintenancesResult, marketplaceStatusResult] = await Promise.all([
    pool.query(
      `SELECT vehicle_id, state, COALESCE(is_listed, false) AS is_listed FROM moveadvisor_user_vehicle_states WHERE vehicle_id = ANY($1::varchar[])`,
      [vehicleIds]
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT vehicle_id, file_type, file_name, file_size, file_mime_type, file_content_base64, file_url
       FROM moveadvisor_user_vehicle_files WHERE vehicle_id = ANY($1::varchar[]) ORDER BY id ASC`,
      [vehicleIds]
    ),
    pool.query(
      `SELECT vehicle_id, document_type, file_name, file_size, file_mime_type, file_content_base64, file_url
       FROM moveadvisor_user_vehicle_documents WHERE vehicle_id = ANY($1::varchar[]) ORDER BY id ASC`,
      [vehicleIds]
    ),
    pool.query(
      `SELECT id, vehicle_id, provider, policy_number, coverage_type
       FROM moveadvisor_user_insurances
       WHERE (user_id = $1 OR (user_id IS NULL AND user_email = $2)) AND vehicle_id = ANY($3::varchar[])
       ORDER BY updated_at DESC`,
      [userId, normalizedEmail, vehicleIds]
    ),
    pool.query(
      `SELECT id, vehicle_id, maintenance_type, title, notes, created_at
       FROM moveadvisor_user_maintenances
       WHERE (user_id = $1 OR (user_id IS NULL AND user_email = $2)) AND vehicle_id = ANY($3::varchar[])
       ORDER BY created_at DESC`,
      [userId, normalizedEmail, vehicleIds]
    ),
    // Check real marketplace is_active — source of truth for publish button state
    pool.query(
      `SELECT id, is_active FROM moveadvisor_marketplace_vo_offers WHERE id = ANY($1::text[])`,
      [vehicleIds.map((id) => `idcar-${id}`)]
    ).catch(() => ({ rows: [] })),
  ]);

  // Map marketplace is_active keyed by vehicleId (strip 'idcar-' prefix)
  const marketplaceActiveByVehicleId = {};
  (marketplaceStatusResult.rows || []).forEach((row) => {
    const vid = String(row.id).replace(/^idcar-/, '');
    marketplaceActiveByVehicleId[vid] = Boolean(row.is_active);
  });

  const stateByVehicleId = (statesResult.rows || []).reduce((acc, row) => {
    if (row.vehicle_id) {
      const vid = String(row.vehicle_id);
      // A vehicle is truly in the marketplace only if its idcar-* record exists AND is_active=true.
      // is_listed alone is not enough — it can be true while is_active=false (state inconsistency).
      const isReallyListed = row.is_listed === true && marketplaceActiveByVehicleId[vid] === true;
      acc[vid] = isReallyListed ? 'active_sale' : (row.state === 'sold' ? 'sold' : 'owned');
    }
    return acc;
  }, {});

  const insuranceIds = (insurancesResult.rows || []).map((row) => normalizeText(row?.id)).filter(Boolean);
  const maintenanceIds = (maintenancesResult.rows || []).map((row) => normalizeText(row?.id)).filter(Boolean);

  // Fetch sub-documents in parallel once we have the parent IDs
  const [insuranceDocsResult, maintenanceInvoicesResult] = await Promise.all([
    insuranceIds.length
      ? pool.query(
          `SELECT insurance_id, file_name, file_size, file_mime_type, file_content_base64
           FROM moveadvisor_user_insurance_documents WHERE insurance_id = ANY($1::varchar[]) ORDER BY id ASC`,
          [insuranceIds]
        )
      : Promise.resolve({ rows: [] }),
    maintenanceIds.length
      ? pool.query(
          `SELECT maintenance_id, file_name, file_size, file_mime_type, file_content_base64
           FROM moveadvisor_user_maintenance_invoices WHERE maintenance_id = ANY($1::varchar[]) ORDER BY id ASC`,
          [maintenanceIds]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const filesByVehicleId = (filesResult.rows || []).reduce((acc, row) => {
    const key = normalizeText(row?.vehicle_id);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = { photos: [], documents: [] };
    }

    const fileData = {
      name: normalizeText(row?.file_name),
      size: Number(row?.file_size || 0),
      mimeType: normalizeText(row?.file_mime_type),
      contentBase64: normalizeText(row?.file_content_base64),
      url: normalizeText(row?.file_url),
      enlace: comoSeAbre(key, normalizeText(row?.file_url)),
    };

    if (!fileData.name) {
      return acc;
    }

    if (normalizeText(row?.file_type) === "photo") {
      acc[key].photos.push(fileData);
    } else {
      acc[key].documents.push(fileData);
    }

    return acc;
  }, {});

  const typedDocumentsByVehicleId = (documentsResult.rows || []).reduce((acc, row) => {
    const key = normalizeText(row?.vehicle_id);
    const type = normalizeText(row?.document_type);

    if (!key || !type) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = {
        [VEHICLE_DOCUMENT_TYPES.technicalSheet]: [],
        [VEHICLE_DOCUMENT_TYPES.circulationPermit]: [],
        [VEHICLE_DOCUMENT_TYPES.itv]: [],
      };
    }

    const fileData = {
      name: normalizeText(row?.file_name),
      size: Number(row?.file_size || 0),
      mimeType: normalizeText(row?.file_mime_type),
      contentBase64: normalizeText(row?.file_content_base64),
      url: normalizeText(row?.file_url),
      enlace: comoSeAbre(key, normalizeText(row?.file_url)),
    };

    if (!fileData.name) {
      return acc;
    }

    if (acc[key][type]) {
      acc[key][type].push(fileData);
    }

    return acc;
  }, {});

  const insuranceByVehicleId = (insurancesResult.rows || []).reduce((acc, row) => {
    const key = normalizeText(row?.vehicle_id);
    if (!key || acc[key]) {
      return acc;
    }

    acc[key] = {
      id: normalizeText(row?.id),
      provider: normalizeText(row?.provider),
      policyNumber: normalizeText(row?.policy_number),
      coverageType: normalizeText(row?.coverage_type),
    };

    return acc;
  }, {});

  const insuranceDocumentsByInsuranceId = (insuranceDocsResult.rows || []).reduce((acc, row) => {
    const key = normalizeText(row?.insurance_id);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = [];
    }

    const doc = {
      name: normalizeText(row?.file_name),
      size: Number(row?.file_size || 0),
      mimeType: normalizeText(row?.file_mime_type),
      contentBase64: normalizeText(row?.file_content_base64),
    };

    if (doc.name) {
      acc[key].push(doc);
    }

    return acc;
  }, {});

  const maintenanceByVehicleId = (maintenancesResult.rows || []).reduce((acc, row) => {
    const key = normalizeText(row?.vehicle_id);
    if (!key || acc[key]) {
      return acc;
    }

    acc[key] = {
      id: normalizeText(row?.id),
      type: normalizeText(row?.maintenance_type),
      title: normalizeText(row?.title),
      notes: normalizeText(row?.notes),
    };

    return acc;
  }, {});

  const maintenanceInvoicesByMaintenanceId = (maintenanceInvoicesResult.rows || []).reduce((acc, row) => {
    const key = normalizeText(row?.maintenance_id);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = [];
    }

    const doc = {
      name: normalizeText(row?.file_name),
      size: Number(row?.file_size || 0),
      mimeType: normalizeText(row?.file_mime_type),
      contentBase64: normalizeText(row?.file_content_base64),
    };

    if (doc.name) {
      acc[key].push(doc);
    }

    return acc;
  }, {});

  return vehicles.map((row) => {
    const files = filesByVehicleId[row.id] || { photos: [], documents: [] };
    const typedDocuments = typedDocumentsByVehicleId[row.id] || {
      [VEHICLE_DOCUMENT_TYPES.technicalSheet]: [],
      [VEHICLE_DOCUMENT_TYPES.circulationPermit]: [],
      [VEHICLE_DOCUMENT_TYPES.itv]: [],
    };
    const insurance = insuranceByVehicleId[row.id] || {};
    const insuranceDocuments = insurance.id ? insuranceDocumentsByInsuranceId[insurance.id] || [] : [];
    const maintenance = maintenanceByVehicleId[row.id] || {};
    const maintenanceInvoices = maintenance.id ? maintenanceInvoicesByMaintenanceId[maintenance.id] || [] : [];

    return sanitizeGarageVehicle({
      id: row.id,
      marketplaceState: stateByVehicleId[row.id] || 'owned',
      title: row.title,
      brand: row.brand,
      model: row.model,
      version: row.version,
      transmissionType: row.transmission_type,
      cv: row.cv,
      color: row.color,
      horsepower: row.horsepower,
      seats: row.seats,
      doors: row.doors,
      location: row.vehicle_location,
      bodyType: row.body_type,
      environmentalLabel: row.environmental_label,
      lastIvt: row.last_itv,
      nextIvt: row.next_itv,
      co2: row.co2,
      price: row.price,
      marketplacePricingMode: normalizeText(row.marketplace_pricing_mode) || "manual",
      year: row.year,
      plate: row.plate,
      mileage: row.mileage,
      fuel: row.fuel,
      policyCompany: insurance.provider || row.policy_company,
      policyNumber: insurance.policyNumber || "",
      coverageType: insurance.coverageType || "",
      libroMantenimiento: row.service_book || "",
      revisionesOficiales: row.official_service || "",
      ultimaRevisionFecha: row.last_service_date || "",
      ultimaRevisionKm: row.last_service_km || "",
      maintenanceType: maintenance.type || "",
      maintenanceTitle: maintenance.title || "",
      maintenanceNotes: maintenance.notes || "",
      notes: row.notes,
      photos: files.photos,
      documents: files.documents,
      technicalSheetDocuments: typedDocuments[VEHICLE_DOCUMENT_TYPES.technicalSheet],
      circulationPermitDocuments: typedDocuments[VEHICLE_DOCUMENT_TYPES.circulationPermit],
      itvDocuments: typedDocuments[VEHICLE_DOCUMENT_TYPES.itv],
      insuranceDocuments,
      maintenanceInvoices,
      initialMaintenance: {
        type: maintenance.type || "",
        title: maintenance.title || "",
        notes: maintenance.notes || "",
        invoices: maintenanceInvoices,
      },
      createdAt: row.created_at,
    });
  });
}

async function listGarageVehicleSummariesByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const result = await pool.query(
    `
      SELECT id, title, brand, model, version, year, plate, mileage, fuel, vehicle_location, created_at
      FROM moveadvisor_user_vehicles
      WHERE (user_id = $1 OR lower(user_email) = $2)
      ORDER BY created_at DESC
      LIMIT 20
    `,
    [userId, normalizedEmail]
  );

  return (result.rows || [])
    .map((row) => ({
      id: normalizeText(row?.id),
      title: normalizeText(row?.title),
      brand: normalizeText(row?.brand),
      model: normalizeText(row?.model),
      version: normalizeText(row?.version),
      year: normalizeText(row?.year),
      plate: normalizeText(row?.plate),
      mileage: normalizeText(row?.mileage),
      fuel: normalizeText(row?.fuel),
      location: normalizeText(row?.vehicle_location),
      createdAt: normalizeText(row?.created_at),
    }))
    .filter((row) => row.id);
}

async function addGarageVehicleByEmailPostgres(email = "", vehicle = {}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedVehicle = sanitizeGarageVehicle(vehicle);

  if (!normalizedEmail || !normalizedVehicle.brand || !normalizedVehicle.model) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const vehicleId = normalizedVehicle.id || `garage-${Date.now()}`;
  const nowIso = new Date().toISOString();

  await pool.query(
    `
      INSERT INTO moveadvisor_user_vehicles (
        id, user_email, user_id, title, brand, model, version, transmission_type, cv, color, horsepower, seats, doors, vehicle_location, body_type, environmental_label, last_itv, next_itv, co2, price, marketplace_pricing_mode, year, plate, mileage, fuel, policy_company, service_book, official_service, last_service_date, last_service_km, notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $32
      )
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
        user_id = EXCLUDED.user_id,
        title = EXCLUDED.title,
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        version = EXCLUDED.version,
        transmission_type = EXCLUDED.transmission_type,
        cv = EXCLUDED.cv,
        color = EXCLUDED.color,
        horsepower = EXCLUDED.horsepower,
        seats = EXCLUDED.seats,
        doors = EXCLUDED.doors,
        vehicle_location = EXCLUDED.vehicle_location,
        body_type = EXCLUDED.body_type,
        environmental_label = EXCLUDED.environmental_label,
        last_itv = EXCLUDED.last_itv,
        next_itv = EXCLUDED.next_itv,
        co2 = EXCLUDED.co2,
        price = EXCLUDED.price,
        marketplace_pricing_mode = EXCLUDED.marketplace_pricing_mode,
        year = EXCLUDED.year,
        plate = EXCLUDED.plate,
        mileage = EXCLUDED.mileage,
        fuel = EXCLUDED.fuel,
        policy_company = EXCLUDED.policy_company,
        service_book = EXCLUDED.service_book,
        official_service = EXCLUDED.official_service,
        last_service_date = EXCLUDED.last_service_date,
        last_service_km = EXCLUDED.last_service_km,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at
    `,
    [
      vehicleId,
      normalizedEmail,
      userId,
      normalizedVehicle.title,
      normalizedVehicle.brand,
      normalizedVehicle.model,
      normalizedVehicle.version,
      normalizedVehicle.transmissionType,
      normalizedVehicle.cv,
      normalizedVehicle.color,
      normalizedVehicle.horsepower,
      normalizedVehicle.seats,
      normalizedVehicle.doors,
      normalizedVehicle.location,
      normalizedVehicle.bodyType,
      normalizedVehicle.environmentalLabel,
      normalizedVehicle.lastIvt,
      normalizedVehicle.nextIvt,
      normalizedVehicle.co2,
      normalizedVehicle.price,
      normalizedVehicle.marketplacePricingMode,
      normalizedVehicle.year,
      normalizedVehicle.plate,
      normalizedVehicle.mileage,
      normalizedVehicle.fuel,
      normalizedVehicle.policyCompany,
      normalizedVehicle.libroMantenimiento,
      normalizedVehicle.revisionesOficiales,
      normalizedVehicle.ultimaRevisionFecha,
      normalizedVehicle.ultimaRevisionKm,
      normalizedVehicle.notes,
      nowIso,
    ]
  );

  const photoRows = Array.isArray(normalizedVehicle.photos) ? normalizedVehicle.photos : [];
  const docRows = Array.isArray(normalizedVehicle.documents) ? normalizedVehicle.documents : [];
  const technicalSheetDocs = sanitizeAttachmentArray(normalizedVehicle.technicalSheetDocuments);
  const circulationPermitDocs = sanitizeAttachmentArray(normalizedVehicle.circulationPermitDocuments);
  const itvDocs = sanitizeAttachmentArray(normalizedVehicle.itvDocuments);

  /*
   * Con que coche es, para poder nombrar los papeles.
   *
   * El cliente sube lo que le dio el taller —«02384u723.pdf»— y en la ficha
   * salen cinco papeles asi, que no se distinguen sin abrirlos uno a uno. Con
   * el tipo y la matricula delante la lista se lee de un vistazo.
   */
  const laPlaca = normalizedVehicle.plate;

  // Load current DB records so we only delete what the user explicitly removed
  const [existingVFResult, existingVDResult] = await Promise.all([
    pool.query(`SELECT id, file_type, file_url FROM moveadvisor_user_vehicle_files WHERE vehicle_id = $1`, [vehicleId]),
    pool.query(`SELECT id, document_type, file_url FROM moveadvisor_user_vehicle_documents WHERE vehicle_id = $1`, [vehicleId]),
  ]);
  const existingVF = existingVFResult.rows;
  const existingVD = existingVDResult.rows;

  function pickUrl(item) {
    return normalizeText(item?.file_url || item?.url || item?.previewUrl || item?.src) || '';
  }

  // URLs present in the incoming payload (by file category)
  const incomingPhotoUrls    = new Set(photoRows.map(pickUrl).filter(Boolean));
  const incomingDocUrls      = new Set(docRows.map(pickUrl).filter(Boolean));
  const incomingTechUrls     = new Set(technicalSheetDocs.map(pickUrl).filter(Boolean));
  const incomingCircUrls     = new Set(circulationPermitDocs.map(pickUrl).filter(Boolean));
  const incomingItvUrls      = new Set(itvDocs.map(pickUrl).filter(Boolean));

  // Delete from vehicle_files only records the user removed:
  //   - has a URL that is NOT in the incoming payload  → user removed it
  //   - has no URL (base64-only)                       → re-insert below (no stable ID to match)
  const vfIdsToDelete = existingVF
    .filter(r => {
      if (!r.file_url) return true; // base64-only: always re-insert from payload
      return r.file_type === 'photo' ? !incomingPhotoUrls.has(r.file_url) : !incomingDocUrls.has(r.file_url);
    })
    .map(r => r.id);
  if (vfIdsToDelete.length) {
    await pool.query(`DELETE FROM moveadvisor_user_vehicle_files WHERE id = ANY($1::int[])`, [vfIdsToDelete]);
  }

  // Delete from vehicle_documents only records the user removed
  const vdIdsToDelete = existingVD
    .filter(r => {
      if (!r.file_url) return true;
      if (r.document_type === VEHICLE_DOCUMENT_TYPES.technicalSheet)    return !incomingTechUrls.has(r.file_url);
      if (r.document_type === VEHICLE_DOCUMENT_TYPES.circulationPermit) return !incomingCircUrls.has(r.file_url);
      if (r.document_type === VEHICLE_DOCUMENT_TYPES.itv)               return !incomingItvUrls.has(r.file_url);
      return false;
    })
    .map(r => r.id);
  if (vdIdsToDelete.length) {
    await pool.query(`DELETE FROM moveadvisor_user_vehicle_documents WHERE id = ANY($1::int[])`, [vdIdsToDelete]);
  }

  // URL sets already saved in DB — skip re-inserting these
  const savedPhotoUrls = new Set(existingVF.filter(r => r.file_type === 'photo'    && r.file_url).map(r => r.file_url));
  const savedDocUrls   = new Set(existingVF.filter(r => r.file_type === 'document' && r.file_url).map(r => r.file_url));
  const savedTechUrls  = new Set(existingVD.filter(r => r.document_type === VEHICLE_DOCUMENT_TYPES.technicalSheet    && r.file_url).map(r => r.file_url));
  const savedCircUrls  = new Set(existingVD.filter(r => r.document_type === VEHICLE_DOCUMENT_TYPES.circulationPermit && r.file_url).map(r => r.file_url));
  const savedItvUrls   = new Set(existingVD.filter(r => r.document_type === VEHICLE_DOCUMENT_TYPES.itv               && r.file_url).map(r => r.file_url));

  for (const photo of photoRows) {
    const fileName = normalizeText(photo?.name);
    if (!fileName) continue;
    const mimeType    = normalizeText(photo.mimeType) || 'image/jpeg';
    const b64         = normalizeText(photo.contentBase64);
    const existingUrl = pickUrl(photo);
    if (existingUrl && savedPhotoUrls.has(existingUrl)) continue; // already in DB, keep as-is
    const storagePath = `vehicles/${vehicleId}/photos/${Date.now()}_${safeName(fileName)}`;
    const fileUrl = existingUrl || (b64 ? (await uploadBase64ToSupabase(b64, mimeType, storagePath) || '') : '');
    if (!fileUrl && !b64) continue;
    await pool.query(
      `INSERT INTO moveadvisor_user_vehicle_files (vehicle_id, file_type, file_name, file_size, file_mime_type, file_content_base64, file_url, created_at)
       VALUES ($1, 'photo', $2, $3, $4, $5, $6, $7)`,
      [vehicleId, fileName, Number(photo.size || 0), mimeType, fileUrl ? '' : b64, fileUrl, nowIso]
    );
  }

  let cuantosSueltos = 0;
  for (const doc of docRows) {
    const fileName = normalizeText(doc?.name);
    if (!fileName) continue;
    const mimeType    = normalizeText(doc.mimeType) || 'application/octet-stream';
    const b64         = normalizeText(doc.contentBase64);
    const existingUrl = pickUrl(doc);
    if (existingUrl && savedDocUrls.has(existingUrl)) continue;
    const storagePath = `vehicles/${vehicleId}/documents/${Date.now()}_${safeName(fileName)}`;
    const fileUrl = existingUrl || (b64 ? await subeUnPapel(b64, mimeType, storagePath) : '');
    if (!fileUrl && !b64) continue;
    await pool.query(
      `INSERT INTO moveadvisor_user_vehicle_files (vehicle_id, file_type, file_name, file_size, file_mime_type, file_content_base64, file_url, created_at)
       VALUES ($1, 'document', $2, $3, $4, $5, $6, $7)`,
      [vehicleId, comoSeLlamaElPapel("document", laPlaca, fileName, ++cuantosSueltos), Number(doc.size || 0), mimeType, fileUrl ? '' : b64, fileUrl, nowIso]
    );
  }

  let cuantasFichas = 0;
  for (const technicalSheetDoc of technicalSheetDocs) {
    const fileName = normalizeText(technicalSheetDoc?.name);
    if (!fileName) continue;
    const mimeType    = normalizeText(technicalSheetDoc.mimeType) || 'application/octet-stream';
    const b64         = normalizeText(technicalSheetDoc.contentBase64);
    const existingUrl = pickUrl(technicalSheetDoc);
    if (existingUrl && savedTechUrls.has(existingUrl)) continue;
    const storagePath = `vehicles/${vehicleId}/technical-sheet/${Date.now()}_${safeName(fileName)}`;
    const fileUrl = existingUrl || (b64 ? await subeUnPapel(b64, mimeType, storagePath) : '');
    if (!fileUrl && !b64) continue;
    await pool.query(
      `INSERT INTO moveadvisor_user_vehicle_documents (vehicle_id, document_type, file_name, file_size, file_mime_type, file_content_base64, file_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [vehicleId, VEHICLE_DOCUMENT_TYPES.technicalSheet, comoSeLlamaElPapel(VEHICLE_DOCUMENT_TYPES.technicalSheet, laPlaca, fileName, ++cuantasFichas), Number(technicalSheetDoc.size || 0), mimeType, fileUrl ? '' : b64, fileUrl, nowIso]
    );
  }

  let cuantosPermisos = 0;
  for (const circulationPermitDoc of circulationPermitDocs) {
    const fileName = normalizeText(circulationPermitDoc?.name);
    if (!fileName) continue;
    const mimeType    = normalizeText(circulationPermitDoc.mimeType) || 'application/octet-stream';
    const b64         = normalizeText(circulationPermitDoc.contentBase64);
    const existingUrl = pickUrl(circulationPermitDoc);
    if (existingUrl && savedCircUrls.has(existingUrl)) continue;
    const storagePath = `vehicles/${vehicleId}/circulation-permit/${Date.now()}_${safeName(fileName)}`;
    const fileUrl = existingUrl || (b64 ? await subeUnPapel(b64, mimeType, storagePath) : '');
    if (!fileUrl && !b64) continue;
    await pool.query(
      `INSERT INTO moveadvisor_user_vehicle_documents (vehicle_id, document_type, file_name, file_size, file_mime_type, file_content_base64, file_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [vehicleId, VEHICLE_DOCUMENT_TYPES.circulationPermit, comoSeLlamaElPapel(VEHICLE_DOCUMENT_TYPES.circulationPermit, laPlaca, fileName, ++cuantosPermisos), Number(circulationPermitDoc.size || 0), mimeType, fileUrl ? '' : b64, fileUrl, nowIso]
    );
  }

  let cuantasItv = 0;
  for (const itvDoc of itvDocs) {
    const fileName = normalizeText(itvDoc?.name);
    if (!fileName) continue;
    const mimeType    = normalizeText(itvDoc.mimeType) || 'application/octet-stream';
    const b64         = normalizeText(itvDoc.contentBase64);
    const existingUrl = pickUrl(itvDoc);
    if (existingUrl && savedItvUrls.has(existingUrl)) continue;
    const storagePath = `vehicles/${vehicleId}/itv/${Date.now()}_${safeName(fileName)}`;
    const fileUrl = existingUrl || (b64 ? await subeUnPapel(b64, mimeType, storagePath) : '');
    if (!fileUrl && !b64) continue;
    await pool.query(
      `INSERT INTO moveadvisor_user_vehicle_documents (vehicle_id, document_type, file_name, file_size, file_mime_type, file_content_base64, file_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [vehicleId, VEHICLE_DOCUMENT_TYPES.itv, comoSeLlamaElPapel(VEHICLE_DOCUMENT_TYPES.itv, laPlaca, fileName, ++cuantasItv), Number(itvDoc.size || 0), mimeType, fileUrl ? '' : b64, fileUrl, nowIso]
    );
  }

  if (normalizedVehicle.policyCompany || normalizedVehicle.policyNumber || normalizedVehicle.coverageType || (normalizedVehicle.insuranceDocuments || []).length) {
    await upsertInsuranceByEmailPostgres(normalizedEmail, {
      id: `ins-${vehicleId}`,
      vehicleId,
      provider: normalizedVehicle.policyCompany,
      policyNumber: normalizedVehicle.policyNumber,
      coverageType: normalizedVehicle.coverageType,
      documents: normalizedVehicle.insuranceDocuments,
      status: "active",
    });
  }

  /*
   * Un mantenimiento solo si el cliente ha dicho algo.
   *
   * Esto miraba también el `type`, y el formulario manda siempre
   * `type: "maintenance"` aunque no se toque nada. Resultado: cada guardado de
   * cualquier campo del coche creaba un mantenimiento titulado «Mantenimiento»
   * que no había dicho nadie. Con eso en la base no se puede distinguir «este
   * coche no tiene historial» de «no se lo hemos preguntado», que son dos
   * llamadas distintas — y encima el aviso de guardado fallaba por él.
   *
   * El tipo no es una respuesta: es cómo se llama la casilla. Cuenta lo que
   * escribió él.
   */
  const hasMaintenanceData =
    normalizeText(normalizedVehicle.initialMaintenance?.title) ||
    normalizeText(normalizedVehicle.initialMaintenance?.notes) ||
    (normalizedVehicle.initialMaintenance?.invoices || []).length;

  if (hasMaintenanceData) {
    await addMaintenanceByEmailPostgres(normalizedEmail, {
      id: `mnt-${vehicleId}-initial`,
      vehicleId,
      type: normalizeText(normalizedVehicle.initialMaintenance?.type || "maintenance"),
      title: normalizeText(normalizedVehicle.initialMaintenance?.title || "Mantenimiento"),
      notes: normalizeText(normalizedVehicle.initialMaintenance?.notes),
      invoices: normalizedVehicle.initialMaintenance?.invoices,
      status: "Pendiente",
    });
  }

  return listGarageVehiclesByEmailPostgres(normalizedEmail);
}

async function removeGarageVehicleByEmailPostgres(email = "", vehicleId = "") {
  const normalizedEmail = normalizeEmail(email);
  const normalizedVehicleId = normalizeText(vehicleId);

  if (!normalizedEmail || !normalizedVehicleId) {
    return listGarageVehiclesByEmailPostgres(normalizedEmail);
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  await pool.query(
    "DELETE FROM moveadvisor_user_vehicles WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND user_email = $3))",
    [normalizedVehicleId, userId, normalizedEmail]
  );
  return listGarageVehiclesByEmailPostgres(normalizedEmail);
}

async function listAppointmentsByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const result = await pool.query(
    `
      SELECT a.id, a.appointment_type, a.title, a.meta, a.status, a.requested_at_text,
             a.vehicle_id, v.title AS vehicle_title, v.plate AS vehicle_plate
      FROM moveadvisor_user_appointments a
      INNER JOIN moveadvisor_user_vehicles v ON v.id = a.vehicle_id
      WHERE (a.user_id = $1 OR (a.user_id IS NULL AND a.user_email = $2))
      ORDER BY a.created_at DESC
      LIMIT 30
    `,
    [userId, normalizedEmail]
  );

  const insuranceIds = (result.rows || []).map((row) => normalizeText(row?.id)).filter(Boolean);
  const docsResult = insuranceIds.length
    ? await pool.query(
        `
          SELECT insurance_id, file_name, file_size, file_mime_type, file_content_base64
          FROM moveadvisor_user_insurance_documents
          WHERE insurance_id = ANY($1::varchar[])
          ORDER BY id ASC
        `,
        [insuranceIds]
      )
    : { rows: [] };

  const docsByInsuranceId = (docsResult.rows || []).reduce((acc, row) => {
    const key = normalizeText(row?.insurance_id);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = [];
    }

    const doc = {
      name: normalizeText(row?.file_name),
      size: Number(row?.file_size || 0),
      mimeType: normalizeText(row?.file_mime_type),
      contentBase64: normalizeText(row?.file_content_base64),
    };

    if (doc.name) {
      acc[key].push(doc);
    }

    return acc;
  }, {});

  const appointmentIds = (result.rows || []).map((row) => normalizeText(row?.id)).filter(Boolean);
  const historyResult = appointmentIds.length
    ? await pool.query(
        `
          SELECT appointment_id, previous_status, next_status, changed_at
          FROM moveadvisor_user_appointment_status_history
          WHERE appointment_id = ANY($1::varchar[])
          ORDER BY changed_at DESC
        `,
        [appointmentIds]
      )
    : { rows: [] };

  const historyByAppointmentId = (historyResult.rows || []).reduce((acc, row) => {
    const key = normalizeText(row?.appointment_id);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push({
      previousStatus: normalizeText(row?.previous_status),
      nextStatus: normalizeText(row?.next_status),
      changedAt: normalizeText(row?.changed_at),
    });

    return acc;
  }, {});

  return (result.rows || []).map((row) => ({
    id: normalizeText(row.id),
    type: normalizeText(row.appointment_type),
    title: normalizeText(row.title),
    meta: normalizeText(row.meta),
    status: normalizeText(row.status),
    requestedAt: normalizeText(row.requested_at_text),
    vehicleId: normalizeText(row.vehicle_id),
    vehicleTitle: normalizeText(row.vehicle_title),
    vehiclePlate: normalizeText(row.vehicle_plate),
    statusHistory: historyByAppointmentId[normalizeText(row.id)] || [],
  }));
}

async function addAppointmentByEmailPostgres(email = "", appointment = {}) {
  const normalizedEmail = normalizeEmail(email);
  const vehicleId = normalizeText(appointment?.vehicleId);

  if (!normalizedEmail || !vehicleId) {
    return listAppointmentsByEmailPostgres(normalizedEmail);
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const vehicleCheck = await pool.query(
    "SELECT id FROM moveadvisor_user_vehicles WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND user_email = $3)) LIMIT 1",
    [vehicleId, userId, normalizedEmail]
  );

  if ((vehicleCheck.rows || []).length === 0) {
    return listAppointmentsByEmailPostgres(normalizedEmail);
  }

  const id = normalizeText(appointment?.id) || `appt-${Date.now()}`;
  const appointmentType = normalizeText(appointment?.type || "workshop") || "workshop";
  const nowIso = new Date().toISOString();
  const nextStatus = normalizeText(appointment?.status || "Pendiente");
  const previousStatusResult = await pool.query(
    "SELECT status FROM moveadvisor_user_appointments WHERE id = $1 LIMIT 1",
    [id]
  );
  const previousStatus = normalizeText(previousStatusResult.rows?.[0]?.status);

  await pool.query(
    `
      INSERT INTO moveadvisor_user_appointments (
        id, user_email, user_id, vehicle_id, appointment_type, title, meta, status, requested_at_text, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10
      )
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
        user_id = EXCLUDED.user_id,
        vehicle_id = EXCLUDED.vehicle_id,
        appointment_type = EXCLUDED.appointment_type,
        title = EXCLUDED.title,
        meta = EXCLUDED.meta,
        status = EXCLUDED.status,
        requested_at_text = EXCLUDED.requested_at_text,
        updated_at = EXCLUDED.updated_at
    `,
    [
      id,
      normalizedEmail,
      userId,
      vehicleId,
      appointmentType,
      normalizeText(appointment?.title || "Cita"),
      normalizeText(appointment?.meta),
      nextStatus,
      normalizeText(appointment?.requestedAt) || toEsDateTimeText(nowIso),
      nowIso,
    ]
  );

  if (previousStatus && previousStatus !== nextStatus) {
    await pool.query(
      `
        INSERT INTO moveadvisor_user_appointment_status_history (appointment_id, previous_status, next_status, changed_at)
        VALUES ($1, $2, $3, $4)
      `,
      [id, previousStatus, nextStatus, nowIso]
    );
  }

  if (appointmentType === "maintenance") {
    await addMaintenanceByEmailPostgres(normalizedEmail, {
      id: `mnt-${id}`,
      vehicleId,
      type: "maintenance",
      title: normalizeText(appointment?.title || "Mantenimiento"),
      status: nextStatus,
      scheduledAt: normalizeText(appointment?.requestedAt) || toEsDateTimeText(nowIso),
      notes: normalizeText(appointment?.meta),
    });
  }

  if (appointmentType === "insurance") {
    await upsertInsuranceByEmailPostgres(normalizedEmail, {
      id: `ins-${vehicleId}`,
      vehicleId,
      status: "active",
      renewalAt: normalizeText(appointment?.requestedAt) || toEsDateTimeText(nowIso),
      notes: normalizeText(appointment?.meta),
    });
  }

  return listAppointmentsByEmailPostgres(normalizedEmail);
}

async function deleteAppointmentByEmailPostgres(email = "", appointmentId = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !appointmentId) return false;
  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const result = await pool.query(
    `DELETE FROM moveadvisor_user_appointments
     WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND user_email = $3))`,
    [appointmentId, userId, normalizedEmail]
  );
  return (result.rowCount || 0) > 0;
}

async function listInsurancesByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const result = await pool.query(
    `
      SELECT ins.id, ins.vehicle_id, ins.provider, ins.policy_number, ins.coverage_type,
             ins.status, ins.renewal_at_text, ins.monthly_premium, ins.notes,
             v.title AS vehicle_title, v.plate AS vehicle_plate
      FROM moveadvisor_user_insurances ins
      INNER JOIN moveadvisor_user_vehicles v ON v.id = ins.vehicle_id
      WHERE (ins.user_id = $1 OR (ins.user_id IS NULL AND ins.user_email = $2))
      ORDER BY ins.updated_at DESC
      LIMIT 30
    `,
    [userId, normalizedEmail]
  );

  const insuranceIds = (result.rows || []).map((row) => normalizeText(row?.id)).filter(Boolean);
  const docsResult = insuranceIds.length
    ? await pool.query(
        `
          SELECT insurance_id, file_name, file_size, file_mime_type, file_content_base64
          FROM moveadvisor_user_insurance_documents
          WHERE insurance_id = ANY($1::varchar[])
          ORDER BY id ASC
        `,
        [insuranceIds]
      )
    : { rows: [] };

  const docsByInsuranceId = (docsResult.rows || []).reduce((acc, row) => {
    const key = normalizeText(row?.insurance_id);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = [];
    }

    const doc = {
      name: normalizeText(row?.file_name),
      size: Number(row?.file_size || 0),
      mimeType: normalizeText(row?.file_mime_type),
      contentBase64: normalizeText(row?.file_content_base64),
    };

    if (doc.name) {
      acc[key].push(doc);
    }

    return acc;
  }, {});

  return (result.rows || []).map((row) => ({
    id: normalizeText(row.id),
    vehicleId: normalizeText(row.vehicle_id),
    vehicleTitle: normalizeText(row.vehicle_title),
    vehiclePlate: normalizeText(row.vehicle_plate),
    provider: normalizeText(row.provider),
    policyNumber: normalizeText(row.policy_number),
    coverageType: normalizeText(row.coverage_type),
    status: normalizeText(row.status) || "active",
    renewalAt: normalizeText(row.renewal_at_text),
    monthlyPremium: Number(row.monthly_premium || 0),
    notes: normalizeText(row.notes),
    documents: docsByInsuranceId[normalizeText(row.id)] || [],
  }));
}

async function upsertInsuranceByEmailPostgres(email = "", payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  const vehicleId = normalizeText(payload?.vehicleId);

  if (!normalizedEmail || !vehicleId) {
    return listInsurancesByEmailPostgres(normalizedEmail);
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const vehicleCheck = await pool.query(
    "SELECT id, plate FROM moveadvisor_user_vehicles WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND user_email = $3)) LIMIT 1",
    [vehicleId, userId, normalizedEmail]
  );

  if ((vehicleCheck.rows || []).length === 0) {
    return listInsurancesByEmailPostgres(normalizedEmail);
  }

  const nowIso = new Date().toISOString();
  const id = normalizeText(payload?.id) || `ins-${vehicleId}`;

  await pool.query(
    `
      INSERT INTO moveadvisor_user_insurances (
        id, user_email, user_id, vehicle_id, provider, policy_number, coverage_type, status,
        renewal_at_text, monthly_premium, notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12
      )
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
        user_id = EXCLUDED.user_id,
        vehicle_id = EXCLUDED.vehicle_id,
        provider = EXCLUDED.provider,
        policy_number = EXCLUDED.policy_number,
        coverage_type = EXCLUDED.coverage_type,
        status = EXCLUDED.status,
        renewal_at_text = EXCLUDED.renewal_at_text,
        monthly_premium = EXCLUDED.monthly_premium,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at
    `,
    [
      id,
      normalizedEmail,
      userId,
      vehicleId,
      normalizeText(payload?.provider),
      normalizeText(payload?.policyNumber),
      normalizeText(payload?.coverageType),
      normalizeText(payload?.status || "active"),
      normalizeText(payload?.renewalAt),
      Number(payload?.monthlyPremium || 0) || null,
      normalizeText(payload?.notes),
      nowIso,
    ]
  );

  await pool.query("DELETE FROM moveadvisor_user_insurance_documents WHERE insurance_id = $1", [id]);

  // La matricula, para que el papel se llame «Seguro · 8888LXR.pdf» y no como
  // el fichero del movil. Misma regla que los documentos del coche.
  const laPlaca = (vehicleCheck.rows[0] || {}).plate;

  const insuranceDocs = sanitizeAttachmentArray(payload?.documents);
  let cuantosSeguros = 0;
  for (const insuranceDoc of insuranceDocs) {
    await pool.query(
      `
        INSERT INTO moveadvisor_user_insurance_documents (insurance_id, file_name, file_size, file_mime_type, file_content_base64, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [id, comoSeLlamaElPapel("insurance", laPlaca, insuranceDoc.name, ++cuantosSeguros), Number(insuranceDoc.size || 0), normalizeText(insuranceDoc.mimeType), normalizeText(insuranceDoc.contentBase64), nowIso]
    );
  }

  await pool.query(
    `
      UPDATE moveadvisor_user_insurances
      SET id = $1,
          provider = $4,
          policy_number = $5,
          coverage_type = $6,
          status = $7,
          renewal_at_text = $8,
          monthly_premium = $9,
          notes = $10,
          updated_at = $11
      WHERE (user_id = $12 OR (user_id IS NULL AND user_email = $2)) AND vehicle_id = $3 AND id <> $1
    `,
    [
      id,
      normalizedEmail,
      vehicleId,
      normalizeText(payload?.provider),
      normalizeText(payload?.policyNumber),
      normalizeText(payload?.coverageType),
      normalizeText(payload?.status || "active"),
      normalizeText(payload?.renewalAt),
      Number(payload?.monthlyPremium || 0) || null,
      normalizeText(payload?.notes),
      nowIso,
      userId,
    ]
  );

  return listInsurancesByEmailPostgres(normalizedEmail);
}

async function listMaintenancesByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const result = await pool.query(
    `
      SELECT m.id, m.vehicle_id, m.maintenance_type, m.title, m.status, m.scheduled_at_text,
             m.workshop_name, m.mileage_text, m.estimated_cost, m.notes,
             v.title AS vehicle_title, v.plate AS vehicle_plate
      FROM moveadvisor_user_maintenances m
      INNER JOIN moveadvisor_user_vehicles v ON v.id = m.vehicle_id
      WHERE (m.user_id = $1 OR (m.user_id IS NULL AND m.user_email = $2))
      ORDER BY m.created_at DESC
      LIMIT 50
    `,
    [userId, normalizedEmail]
  );

  const maintenanceIds = (result.rows || []).map((row) => normalizeText(row?.id)).filter(Boolean);
  const invoiceResult = maintenanceIds.length
    ? await pool.query(
        `
          SELECT maintenance_id, file_name, file_size, file_mime_type, file_content_base64
          FROM moveadvisor_user_maintenance_invoices
          WHERE maintenance_id = ANY($1::varchar[])
          ORDER BY id ASC
        `,
        [maintenanceIds]
      )
    : { rows: [] };

  const invoicesByMaintenanceId = (invoiceResult.rows || []).reduce((acc, row) => {
    const key = normalizeText(row?.maintenance_id);
    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = [];
    }

    const invoice = {
      name: normalizeText(row?.file_name),
      size: Number(row?.file_size || 0),
      mimeType: normalizeText(row?.file_mime_type),
      contentBase64: normalizeText(row?.file_content_base64),
    };

    if (invoice.name) {
      acc[key].push(invoice);
    }

    return acc;
  }, {});

  return (result.rows || []).map((row) => ({
    id: normalizeText(row.id),
    vehicleId: normalizeText(row.vehicle_id),
    vehicleTitle: normalizeText(row.vehicle_title),
    vehiclePlate: normalizeText(row.vehicle_plate),
    type: normalizeText(row.maintenance_type),
    title: normalizeText(row.title),
    status: normalizeText(row.status) || "Pendiente",
    scheduledAt: normalizeText(row.scheduled_at_text),
    workshopName: normalizeText(row.workshop_name),
    mileage: normalizeText(row.mileage_text),
    estimatedCost: Number(row.estimated_cost || 0),
    notes: normalizeText(row.notes),
    invoices: invoicesByMaintenanceId[normalizeText(row.id)] || [],
  }));
}

async function addMaintenanceByEmailPostgres(email = "", payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  const vehicleId = normalizeText(payload?.vehicleId);

  if (!normalizedEmail || !vehicleId) {
    return listMaintenancesByEmailPostgres(normalizedEmail);
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const vehicleCheck = await pool.query(
    "SELECT id, title, plate FROM moveadvisor_user_vehicles WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND user_email = $3)) LIMIT 1",
    [vehicleId, userId, normalizedEmail]
  );

  const vehicle = (vehicleCheck.rows || [])[0];
  if (!vehicle) {
    return listMaintenancesByEmailPostgres(normalizedEmail);
  }

  const nowIso = new Date().toISOString();
  const id = normalizeText(payload?.id) || `mnt-${Date.now()}`;

  await pool.query(
    `
      INSERT INTO moveadvisor_user_maintenances (
        id, user_email, user_id, vehicle_id, maintenance_type, title, status,
        scheduled_at_text, workshop_name, mileage_text, estimated_cost, notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $13
      )
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
        user_id = EXCLUDED.user_id,
        vehicle_id = EXCLUDED.vehicle_id,
        maintenance_type = EXCLUDED.maintenance_type,
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        scheduled_at_text = EXCLUDED.scheduled_at_text,
        workshop_name = EXCLUDED.workshop_name,
        mileage_text = EXCLUDED.mileage_text,
        estimated_cost = EXCLUDED.estimated_cost,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at
    `,
    [
      id,
      normalizedEmail,
      userId,
      vehicleId,
      normalizeText(payload?.type || "maintenance") || "maintenance",
      normalizeText(payload?.title || `Mantenimiento ${normalizeText(vehicle.title) || "vehículo"}`),
      normalizeText(payload?.status || "Pendiente"),
      normalizeText(payload?.scheduledAt),
      normalizeText(payload?.workshopName),
      normalizeText(payload?.mileage),
      Number(payload?.estimatedCost || 0) || null,
      normalizeText(payload?.notes),
      nowIso,
    ]
  );

  await pool.query("DELETE FROM moveadvisor_user_maintenance_invoices WHERE maintenance_id = $1", [id]);
  const invoices = sanitizeAttachmentArray(payload?.invoices);

  // Igual que los demas papeles: «Factura de mantenimiento · 8888LXR.pdf». En la
  // lista de un coche con cinco revisiones, los nombres del movil no dicen cual
  // es cual.
  let cuantasFacturas = 0;
  for (const invoice of invoices) {
    await pool.query(
      `
        INSERT INTO moveadvisor_user_maintenance_invoices (maintenance_id, file_name, file_size, file_mime_type, file_content_base64, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [id, comoSeLlamaElPapel("maintenance", vehicle.plate, invoice.name, ++cuantasFacturas), Number(invoice.size || 0), normalizeText(invoice.mimeType), normalizeText(invoice.contentBase64), nowIso]
    );
  }

  return listMaintenancesByEmailPostgres(normalizedEmail);
}

async function listValuationsByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const result = await pool.query(
    `
      SELECT val.id, val.title, val.meta, val.status, val.report, val.estimate_value,
             val.vehicle_id, val.pdf_path, val.created_at, v.title AS vehicle_title
      FROM moveadvisor_user_valuations val
      -- LEFT y no INNER: una tasacion sin coche existe —se tasa un coche que no
      -- esta en el garaje, o se guardo suelta por el fallo del nombre de campo—
      -- y con INNER desaparecia del panel entero. El cliente pagaba o gastaba su
      -- gratuita y no veia ni rastro.
      LEFT JOIN moveadvisor_user_vehicles v ON v.id = val.vehicle_id
      WHERE (val.user_id = $1 OR (val.user_id IS NULL AND val.user_email = $2))
      ORDER BY val.created_at DESC
      LIMIT 30
    `,
    [userId, normalizedEmail]
  );

  return (result.rows || []).map((row) => ({
    id: normalizeText(row.id),
    title: normalizeText(row.title),
    meta: normalizeText(row.meta),
    status: normalizeText(row.status),
    report: normalizeText(row.report),
    estimateValue: Number(row.estimate_value || 0),
    vehicleId: normalizeText(row.vehicle_id),
    vehicleTitle: normalizeText(row.vehicle_title),
    // El dia en que se hizo y donde quedo el PDF. Sin la fecha, «la ultima» no
    // se puede saber cual es; sin el camino, el informe no se puede volver a bajar.
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
    pdfPath: normalizeText(row.pdf_path),
  }));
}

async function addValuationByEmailPostgres(email = "", valuation = {}) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return listValuationsByEmailPostgres(normalizedEmail);
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);

  const vehicleId = normalizeText(valuation?.vehicleId) || null;
  let vehicleTitle = normalizeText(valuation?.title) || "Vehiculo en valoracion";

  // If a vehicleId is provided, verify ownership and use its stored title as fallback
  if (vehicleId) {
    const vehicleCheck = await pool.query(
      "SELECT id, title FROM moveadvisor_user_vehicles WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND user_email = $3)) LIMIT 1",
      [vehicleId, userId, normalizedEmail]
    );
    const vehicle = (vehicleCheck.rows || [])[0];
    if (!vehicle) {
      // vehicleId was given but doesn't belong to user — reject to avoid orphan FK
      return listValuationsByEmailPostgres(normalizedEmail);
    }
    vehicleTitle = normalizeText(valuation?.title || vehicle.title || "Vehiculo en valoracion");
  }

  const id = normalizeText(valuation?.id) || `valuation-${Date.now()}`;
  const nowIso = new Date().toISOString();

  await pool.query(
    `
      INSERT INTO moveadvisor_user_valuations (
        id, user_email, user_id, vehicle_id, title, meta, status, report, estimate_value, pdf_path, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11
      )
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
        user_id = EXCLUDED.user_id,
        vehicle_id = EXCLUDED.vehicle_id,
        title = EXCLUDED.title,
        meta = EXCLUDED.meta,
        status = EXCLUDED.status,
        report = EXCLUDED.report,
        estimate_value = EXCLUDED.estimate_value,
        -- Solo si la nueva trae uno: una actualizacion sin PDF no puede borrar
        -- el que ya estaba guardado.
        pdf_path = CASE WHEN EXCLUDED.pdf_path <> '' THEN EXCLUDED.pdf_path ELSE moveadvisor_user_valuations.pdf_path END,
        updated_at = EXCLUDED.updated_at
    `,
    [
      id,
      normalizedEmail,
      userId,
      vehicleId,
      vehicleTitle,
      normalizeText(valuation?.meta),
      normalizeText(valuation?.status || "Ultima tasacion disponible"),
      normalizeText(valuation?.report),
      Number(valuation?.estimateValue || 0) || null,
      normalizeText(valuation?.pdfPath),
      nowIso,
    ]
  );

  return listValuationsByEmailPostgres(normalizedEmail);
}

async function listVehicleStatesByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const result = await pool.query(
    `
      SELECT
        v.id AS vehicle_id,
        COALESCE(s.state, 'owned') AS state,
        CASE
          WHEN mp.is_active = FALSE THEN false
          WHEN mp.is_active = TRUE  THEN true
          ELSE COALESCE(s.is_listed, false)
        END AS is_listed,
        s.listing_url, s.notes, s.updated_at,
        v.title, v.brand, v.model, v.year
      FROM moveadvisor_user_vehicles v
      LEFT JOIN moveadvisor_user_vehicle_states s
        ON s.vehicle_id = v.id
        AND (s.user_id = $1 OR lower(s.user_email) = lower($2))
      LEFT JOIN moveadvisor_marketplace_vo_offers mp ON mp.id = 'idcar-' || v.id
      WHERE (v.user_id = $1 OR lower(v.user_email) = lower($2))
      ORDER BY COALESCE(s.updated_at, v.created_at) DESC
    `,
    [userId, normalizedEmail]
  );

  return (result.rows || []).map((row) => ({
    vehicleId: normalizeText(row.vehicle_id),
    state: normalizeText(row.state),
    isListed: row.is_listed === true,
    listingUrl: normalizeText(row.listing_url),
    notes: normalizeText(row.notes),
    updatedAt: normalizeText(row.updated_at),
    title: normalizeText(row.title),
    brand: normalizeText(row.brand),
    model: normalizeText(row.model),
    year: normalizeText(row.year),
  }));
}

async function upsertVehicleStateByEmailPostgres(email = "", payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  const vehicleId = normalizeText(payload?.vehicleId);
  const state = normalizeText(payload?.state).toLowerCase();
  const isListedProvided = typeof payload?.isListed === "boolean";
  // isListed=true means published to marketplace; isListed=false means unpublished.
  // This is independent of the ownership state (owned/sold).
  const isListed = isListedProvided ? payload.isListed : null;

  const validState = ["owned", "active_sale", "sold"].includes(state);
  if (!normalizedEmail || !vehicleId || (!validState && !isListedProvided)) {
    return listVehicleStatesByEmailPostgres(normalizedEmail);
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const vehicleCheck = await pool.query(
    "SELECT id FROM moveadvisor_user_vehicles WHERE id = $1 AND (user_id = $2 OR lower(user_email) = lower($3)) LIMIT 1",
    [vehicleId, userId, normalizedEmail]
  );

  if ((vehicleCheck.rows || []).length === 0) {
    return listVehicleStatesByEmailPostgres(normalizedEmail);
  }

  const nowIso = new Date().toISOString();
  // Resolve effective state: if only is_listed is being toggled, keep existing state or default to "owned"
  const effectiveState = validState ? state : "owned";

  await pool.query(
    `
      INSERT INTO moveadvisor_user_vehicle_states (user_email, user_id, vehicle_id, state, is_listed, listing_url, notes, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_email, vehicle_id) DO UPDATE SET
        user_id     = EXCLUDED.user_id,
        state       = CASE WHEN $9 THEN moveadvisor_user_vehicle_states.state ELSE EXCLUDED.state END,
        is_listed   = CASE WHEN $10 THEN EXCLUDED.is_listed ELSE moveadvisor_user_vehicle_states.is_listed END,
        listing_url = EXCLUDED.listing_url,
        notes       = EXCLUDED.notes,
        updated_at  = EXCLUDED.updated_at
    `,
    [
      normalizedEmail, userId, vehicleId,
      effectiveState,
      isListed !== null ? isListed : false,
      normalizeText(payload?.listingUrl), normalizeText(payload?.notes), nowIso,
      !validState,       // $9: true = only updating is_listed, keep existing state
      isListedProvided,  // $10: true = update is_listed column
    ]
  );

  return listVehicleStatesByEmailPostgres(normalizedEmail);
}

async function listSavedOffersByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const result = await pool.query(
    `
      SELECT id, vehicle_id, title, offer_payload
      FROM moveadvisor_user_saved_offers
      WHERE (user_id = $1 OR (user_id IS NULL AND user_email = $2))
      ORDER BY created_at DESC
      LIMIT 40
    `,
    [userId, normalizedEmail]
  );

  return (result.rows || []).map((row) => {
    const payload = row?.offer_payload && typeof row.offer_payload === "object" ? row.offer_payload : {};
    return {
      ...payload,
      id: normalizeText(row?.id) || normalizeText(payload?.id),
      vehicleId: normalizeText(row?.vehicle_id) || normalizeText(payload?.vehicleId),
      title: normalizeText(row?.title) || normalizeText(payload?.title),
    };
  });
}

async function addSavedOfferByEmailPostgres(email = "", payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  const id = normalizeText(payload?.id);

  if (!normalizedEmail || !id) {
    return listSavedOffersByEmailPostgres(normalizedEmail);
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  const nowIso = new Date().toISOString();
  const vehicleId = normalizeText(payload?.vehicleId) || null;

  await pool.query(
    `
      INSERT INTO moveadvisor_user_saved_offers (id, user_email, user_id, vehicle_id, title, offer_payload, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $7)
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
        user_id = EXCLUDED.user_id,
        vehicle_id = EXCLUDED.vehicle_id,
        title = EXCLUDED.title,
        offer_payload = EXCLUDED.offer_payload,
        updated_at = EXCLUDED.updated_at
    `,
    [id, normalizedEmail, userId, vehicleId, normalizeText(payload?.title), JSON.stringify(payload || {}), nowIso]
  );

  return listSavedOffersByEmailPostgres(normalizedEmail);
}

async function removeSavedOfferByEmailPostgres(email = "", offerId = "") {
  const normalizedEmail = normalizeEmail(email);
  const id = normalizeText(offerId);

  if (!normalizedEmail || !id) {
    return listSavedOffersByEmailPostgres(normalizedEmail);
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
  await pool.query(
    "DELETE FROM moveadvisor_user_saved_offers WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND user_email = $3))",
    [id, userId, normalizedEmail]
  );
  return listSavedOffersByEmailPostgres(normalizedEmail);
}

async function listSolicitudesByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];

  const pool = getPgPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS moveadvisor_market_leads (
        id             VARCHAR(64)  PRIMARY KEY,
        user_email     VARCHAR(255) NOT NULL,
        lead_type      VARCHAR(40)  NOT NULL DEFAULT 'info',
        vehicle_id     VARCHAR(255),
        vehicle_title  VARCHAR(255) NOT NULL DEFAULT '',
        vehicle_url    TEXT         NOT NULL DEFAULT '',
        portal         VARCHAR(100) NOT NULL DEFAULT '',
        contact_name   VARCHAR(255) NOT NULL DEFAULT '',
        contact_phone  VARCHAR(80)  NOT NULL DEFAULT '',
        contact_when   VARCHAR(80)  NOT NULL DEFAULT '',
        status         VARCHAR(80)  NOT NULL DEFAULT 'Pendiente',
        erp_notes      TEXT         NOT NULL DEFAULT '',
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
  } catch { /* table may already exist */ }

  const result = await pool.query(
    `SELECT id, lead_type, vehicle_title, vehicle_url, portal, status, created_at,
            erp_response, appointment_date, appointment_time, appointment_address,
            appointment_contact, notified_at, reschedule_proposals, deposit_quoted, deposit_paid_at, delivery_estimate,
                 entrega_direccion, entrega_ciudad, entrega_provincia, entrega_cp,
                 -- El impuesto que puso a cuenta y lo que ha salido de verdad.
                 -- Si le vamos a pedir otros seiscientos euros, tiene que verlo
                 -- escrito antes de que se lo pidan por teléfono.
                 escrow_impuesto, liquidacion_at,
                 -- El impuesto es una **partida** del expediente de gestoría, no un
                 -- trámite suyo: los tres papeleos se juntaron en uno. Buscarlo por un
                 -- tipo que ya no existe devolvía nulo siempre, y el cliente no veía la
                 -- liquidación de lo que puso a cuenta.
                 --
                 -- Como texto: de un Excel pegado llega «1.420,00 €», y convertirlo aquí
                 -- a número daría 1,42.
                 (SELECT p->>'importe'
                    FROM erp_tramites t, LATERAL jsonb_array_elements(t.partidas) p
                   WHERE (t.lead_id = moveadvisor_market_leads.id
                      OR t.pedido_id IN (SELECT pe.id FROM erp_pedidos pe
                                          WHERE pe.lead_id = moveadvisor_market_leads.id))
                     AND lower(btrim(p->>'concepto')) LIKE 'impuesto de matriculaci%'
                     AND COALESCE(p->>'importe', '') <> ''
                   ORDER BY t.created_at DESC LIMIT 1) AS impuesto_real,
                   -- La matrícula española, que sale de la gestoría. Hasta que no se
                   -- matricula el coche no tiene ninguna, y en cuanto la tiene es la
                   -- noticia que el cliente estaba esperando.
                   (SELECT t.matricula FROM erp_tramites t
                     WHERE t.lead_id = moveadvisor_market_leads.id
                       AND COALESCE(t.matricula, '') <> ''
                     ORDER BY t.created_at DESC LIMIT 1) AS matricula,
                   -- Una importación pasa dos veces por «En transporte»: de Alemania a
                   -- Zaragoza, y de Zaragoza a su casa. Sin distinguirlas, el panel le
                   -- dice «está de camino a España» con el coche ya matriculado y
                   -- entrando en su calle.
                   EXISTS (SELECT 1 FROM erp_transportes tr
                            WHERE tr.lead_id = moveadvisor_market_leads.id
                              AND tr.tramo > 1
                              AND tr.fecha_recogida IS NOT NULL) AS viaje_a_casa,
                   (SELECT tr.entrega_prevista FROM erp_transportes tr
                     WHERE tr.lead_id = moveadvisor_market_leads.id AND tr.tramo > 1
                     ORDER BY tr.tramo DESC LIMIT 1) AS llegada_a_casa
     FROM moveadvisor_market_leads
     WHERE lower(user_email) = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [normalizedEmail]
  );
  const leads = (result.rows || []).map((row) => ({
    id: normalizeText(row.id),
    vehicle_id: normalizeText(row.vehicle_id),
    type: normalizeText(row.lead_type),
    title: normalizeText(row.vehicle_title),
    meta: JSON.stringify({
      vehicle_url: normalizeText(row.vehicle_url),
      portal: normalizeText(row.portal),
      erp_response: normalizeText(row.erp_response),
      appointment_date: row.appointment_date ? (row.appointment_date instanceof Date ? row.appointment_date.toISOString() : String(row.appointment_date)).slice(0, 10) : "",
      appointment_time: normalizeText(row.appointment_time),
      appointment_address: normalizeText(row.appointment_address),
      appointment_contact: normalizeText(row.appointment_contact),
      notified_at: row.notified_at ? new Date(row.notified_at).toISOString() : "",
      reschedule_proposals: Array.isArray(row.reschedule_proposals) ? row.reschedule_proposals : [],
      deposit_quoted: row.deposit_quoted != null ? Number(row.deposit_quoted) : null,
      escrow_impuesto: row.escrow_impuesto != null ? Number(row.escrow_impuesto) : null,
      impuesto_real:   row.impuesto_real   != null ? importeDeLaPartida(row.impuesto_real) : null,
      liquidacion_at:  row.liquidacion_at ?? null,
      // Dónde quiere que se lo llevemos. Se pone desde su panel, después.
      entrega_direccion: row.entrega_direccion || "",
      entrega_ciudad: row.entrega_ciudad || "",
      entrega_provincia: row.entrega_provincia || "",
      entrega_cp: row.entrega_cp || "",
      deposit_paid_at: row.deposit_paid_at ? new Date(row.deposit_paid_at).toISOString() : "",
      delivery_estimate: row.delivery_estimate ? String(row.delivery_estimate).slice(0, 10) : "",
      // De qué viaje va, que el estado por sí solo no lo dice.
      matricula: normalizeText(row.matricula),
      viaje_a_casa: Boolean(row.viaje_a_casa),
      llegada_a_casa: row.llegada_a_casa
        ? String(row.llegada_a_casa instanceof Date ? row.llegada_a_casa.toISOString() : row.llegada_a_casa).slice(0, 10)
        : "",
    }),
    status: normalizeText(row.status),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
  }));

  // Viewing appointments where this user is the seller (their IDCar is published and someone requested a visit)
  let viewingLeads = [];
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS moveadvisor_viewing_appointments (
        id VARCHAR(64) PRIMARY KEY, offer_id VARCHAR(255) NOT NULL,
        vehicle_title VARCHAR(255) NOT NULL DEFAULT '', vehicle_image TEXT NOT NULL DEFAULT '',
        buyer_email VARCHAR(255) NOT NULL, buyer_name VARCHAR(255) NOT NULL DEFAULT '',
        buyer_message TEXT NOT NULL DEFAULT '', seller_email VARCHAR(255) NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'pending_seller', proposed_slots JSONB NOT NULL DEFAULT '[]',
        confirmed_slot TIMESTAMPTZ, token_seller VARCHAR(64), token_buyer VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch(() => {});
    const vResult = await pool.query(
      `SELECT id, offer_id, vehicle_title, buyer_name, buyer_message, status, proposed_slots, confirmed_slot, token_seller, created_at
       FROM moveadvisor_viewing_appointments
       WHERE seller_email = $1
       ORDER BY created_at DESC LIMIT 10`,
      [normalizedEmail]
    );
    viewingLeads = (vResult.rows || []).map((row) => ({
      id: `viewing-${normalizeText(row.id)}`,
      vehicle_id: normalizeText(row.offer_id),
      type: "viewing_seller",
      title: normalizeText(row.vehicle_title),
      meta: JSON.stringify({
        buyer_name: normalizeText(row.buyer_name),
        buyer_message: normalizeText(row.buyer_message),
        proposed_slots: Array.isArray(row.proposed_slots) ? row.proposed_slots : [],
        confirmed_slot: row.confirmed_slot ? new Date(row.confirmed_slot).toISOString() : "",
        token_seller: normalizeText(row.token_seller),
      }),
      status: normalizeText(row.status),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
    }));
  } catch { /* table may not exist yet */ }

  return [...leads, ...viewingLeads];
}

async function countGarageVehiclesByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return 0;
  try {
    await ensureMobilitySchemaPostgres();
    const pool = getPgPool();
    const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
    const r = await pool.query(
      `SELECT COUNT(*) AS n FROM moveadvisor_user_vehicles WHERE (user_id = $1 OR lower(user_email) = $2)`,
      [userId, normalizedEmail]
    );
    return parseInt(r.rows[0]?.n || "0", 10);
  } catch {
    return 0;
  }
}

/**
 * Lo que vale una partida de la gestoría, venga como venga.
 *
 * Sale de un Excel pegado en el ERP: «1.420,00 €» son mil cuatrocientos veinte,
 * no uno con cuatro. Number() de eso es NaN, y un NaN aquí apaga el bloque de
 * la liquidación en el panel del cliente sin decir nada.
 *
 * Es el mismo criterio que importeQueVale en el ERP, escrito aquí porque los
 * dos repositorios no comparten código.
 */
function importeDeLaPartida(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const limpio = s.replace(/[€\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

async function getUserMobilityDataByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { vehicles: [], appointments: [], maintenances: [], insurances: [], valuations: [], vehicleStates: [], savedOffers: [], solicitudes: [], garageVehicleCount: 0, planId: "free" };
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();

  try {
    const result = await pool.query(`
      WITH
        usr AS (
          SELECT id, plan_id FROM moveadvisor_users WHERE lower(email) = $1 LIMIT 1
        ),
        uid AS (SELECT id FROM usr),
        vehicles AS (
          SELECT id, title, brand, model, version, transmission_type, cv, color,
                 horsepower, seats, doors, vehicle_location, body_type, environmental_label,
                 last_itv, next_itv, co2, price, marketplace_pricing_mode, year, plate,
                 mileage, fuel, policy_company, notes, created_at
          FROM moveadvisor_user_vehicles
          WHERE (user_id = (SELECT id FROM uid) OR lower(user_email) = $1)
          ORDER BY created_at DESC LIMIT 20
        ),
        appts AS (
          SELECT a.id, a.appointment_type, a.title, a.meta, a.status, a.requested_at_text,
                 a.vehicle_id, v.title AS vehicle_title, v.plate AS vehicle_plate
          FROM moveadvisor_user_appointments a
          JOIN moveadvisor_user_vehicles v ON v.id = a.vehicle_id
          WHERE (a.user_id = (SELECT id FROM uid) OR lower(a.user_email) = $1)
          ORDER BY a.created_at DESC LIMIT 30
        ),
        maints AS (
          SELECT m.id, m.vehicle_id, m.maintenance_type, m.title, m.status,
                 m.scheduled_at_text, m.workshop_name, m.mileage_text, m.estimated_cost,
                 m.notes, v.title AS vehicle_title, v.plate AS vehicle_plate
          FROM moveadvisor_user_maintenances m
          JOIN moveadvisor_user_vehicles v ON v.id = m.vehicle_id
          WHERE (m.user_id = (SELECT id FROM uid) OR lower(m.user_email) = $1)
          ORDER BY m.created_at DESC LIMIT 50
        ),
        insurs AS (
          SELECT ins.id, ins.vehicle_id, ins.provider, ins.policy_number, ins.coverage_type,
                 ins.status, ins.renewal_at_text, ins.monthly_premium, ins.notes,
                 v.title AS vehicle_title, v.plate AS vehicle_plate
          FROM moveadvisor_user_insurances ins
          JOIN moveadvisor_user_vehicles v ON v.id = ins.vehicle_id
          WHERE (ins.user_id = (SELECT id FROM uid) OR lower(ins.user_email) = $1)
          ORDER BY ins.updated_at DESC LIMIT 30
        ),
        vals AS (
          SELECT val.id, val.title, val.meta, val.status, val.report, val.estimate_value,
                 val.vehicle_id, v.title AS vehicle_title
          FROM moveadvisor_user_valuations val
          JOIN moveadvisor_user_vehicles v ON v.id = val.vehicle_id
          WHERE (val.user_id = (SELECT id FROM uid) OR lower(val.user_email) = $1)
          ORDER BY val.created_at DESC LIMIT 30
        ),
        vstates AS (
          SELECT
            v.id AS vehicle_id,
            COALESCE(s.state, 'owned') AS state,
            CASE
              WHEN mp.is_active = FALSE THEN false
              WHEN mp.is_active = TRUE  THEN true
              ELSE COALESCE(s.is_listed, false)
            END AS is_listed,
            s.listing_url, s.notes, s.updated_at,
            v.title, v.brand, v.model, v.year
          FROM moveadvisor_user_vehicles v
          LEFT JOIN moveadvisor_user_vehicle_states s
            ON s.vehicle_id = v.id
            AND (s.user_id = (SELECT id FROM uid) OR lower(s.user_email) = $1)
          LEFT JOIN moveadvisor_marketplace_vo_offers mp ON mp.id = 'idcar-' || v.id
          WHERE (v.user_id = (SELECT id FROM uid) OR lower(v.user_email) = $1)
          ORDER BY COALESCE(s.updated_at, v.created_at) DESC
        ),
        saved AS (
          SELECT id, vehicle_id, title, offer_payload
          FROM moveadvisor_user_saved_offers
          WHERE (user_id = (SELECT id FROM uid) OR lower(user_email) = $1)
          ORDER BY created_at DESC LIMIT 40
        ),
        leads AS (
          -- vehicle_id y plate hacen falta para las puertas del encargo: son las
          -- dos maneras de llegar a su coche. Si eligió el coche de su lista
          -- viene el identificador; si escribió la matrícula a mano, solo la
          -- matrícula, y entonces hay que buscarlo por ella.
          SELECT id, vehicle_id, plate, lead_type, vehicle_title, vehicle_url, portal, status, created_at,
                 erp_response, appointment_date, appointment_time, appointment_address,
                 appointment_contact, notified_at, reschedule_proposals, deposit_quoted, deposit_paid_at, delivery_estimate,
                 entrega_direccion, entrega_ciudad, entrega_provincia, entrega_cp,
                 -- El impuesto que puso a cuenta y lo que ha salido de verdad.
                 -- Si le vamos a pedir otros seiscientos euros, tiene que verlo
                 -- escrito antes de que se lo pidan por teléfono.
                 escrow_impuesto, liquidacion_at,
                 -- El impuesto es una **partida** del expediente de gestoría, no un
                 -- trámite suyo: los tres papeleos se juntaron en uno. Buscarlo por un
                 -- tipo que ya no existe devolvía nulo siempre, y el cliente no veía la
                 -- liquidación de lo que puso a cuenta.
                 --
                 -- Como texto: de un Excel pegado llega «1.420,00 €», y convertirlo aquí
                 -- a número daría 1,42.
                 (SELECT p->>'importe'
                    FROM erp_tramites t, LATERAL jsonb_array_elements(t.partidas) p
                   WHERE (t.lead_id = moveadvisor_market_leads.id
                      OR t.pedido_id IN (SELECT pe.id FROM erp_pedidos pe
                                          WHERE pe.lead_id = moveadvisor_market_leads.id))
                     AND lower(btrim(p->>'concepto')) LIKE 'impuesto de matriculaci%'
                     AND COALESCE(p->>'importe', '') <> ''
                   ORDER BY t.created_at DESC LIMIT 1) AS impuesto_real,
                   -- La matrícula española, que sale de la gestoría. Hasta que no se
                   -- matricula el coche no tiene ninguna, y en cuanto la tiene es la
                   -- noticia que el cliente estaba esperando.
                   (SELECT t.matricula FROM erp_tramites t
                     WHERE t.lead_id = moveadvisor_market_leads.id
                       AND COALESCE(t.matricula, '') <> ''
                     ORDER BY t.created_at DESC LIMIT 1) AS matricula,
                   -- Una importación pasa dos veces por «En transporte»: de Alemania a
                   -- Zaragoza, y de Zaragoza a su casa. Sin distinguirlas, el panel le
                   -- dice «está de camino a España» con el coche ya matriculado y
                   -- entrando en su calle.
                   EXISTS (SELECT 1 FROM erp_transportes tr
                            WHERE tr.lead_id = moveadvisor_market_leads.id
                              AND tr.tramo > 1
                              AND tr.fecha_recogida IS NOT NULL) AS viaje_a_casa,
                   (SELECT tr.entrega_prevista FROM erp_transportes tr
                     WHERE tr.lead_id = moveadvisor_market_leads.id AND tr.tramo > 1
                     ORDER BY tr.tramo DESC LIMIT 1) AS llegada_a_casa
          FROM moveadvisor_market_leads
          WHERE lower(user_email) = $1
          ORDER BY created_at DESC LIMIT 20
        ),
        views AS (
          SELECT id, offer_id, vehicle_title, buyer_name, buyer_message, status,
                 proposed_slots, confirmed_slot, token_seller, created_at
          FROM moveadvisor_viewing_appointments
          WHERE lower(seller_email) = $1
          ORDER BY created_at DESC LIMIT 10
        ),
        -- Las visitas que ha reservado con el calendario del marketplace. Viven
        -- en su propia tabla y no son leads, asi que hasta ahora no llegaban al
        -- panel: el cliente solo las veia desde el enlace de su correo. Va el
        -- testigo porque es lo que le deja abrir su cita sin contrasena, y es
        -- suya.
        citas AS (
          SELECT b.id, b.offer_id, b.vehicle_title, b.starts_at, b.ends_at, b.status,
                 b.token_buyer, b.notes, b.created_at,
                 -- Como acabo la visita, si ya lo dijo: «no_fue», «fue» o
                 -- «compro». Vale para no preguntarle dos veces lo mismo, y
                 -- para que el movil sepa que hay algo por contestar.
                 b.resultado,
                 -- Si el coche es de un particular con encargo: entonces la
                 -- compra se empieza desde aqui. Va como si o no —nunca el
                 -- correo del vendedor—, que es lo unico que hace falta para
                 -- saber si se le puede ofrecer «quiero comprarlo».
                 (COALESCE(b.seller_email, '') <> '' AND b.offer_id LIKE 'idcar-%') AS se_puede_comprar,
                 -- Donde es y por quien preguntar, que los escribe el vendedor
                 -- al confirmar. Iban en el correo y en el panel, pero no aqui:
                 -- la app ensenaba la cita sin direccion y sin «como llegar».
                 b.meeting_place, b.meeting_contact,
                 -- Si el concesionario no pudo a su hora y le hemos propuesto
                 -- otras. Estaban solo en el correo: quien lo pierde no tenia
                 -- forma de verlas, y la cita se quedaba esperando una respuesta
                 -- que ya no podia dar.
                 (SELECT e.created_at FROM visit_booking_events e
                   WHERE e.booking_id = b.id AND e.evento = 'horas_propuestas'
                   ORDER BY e.created_at DESC LIMIT 1) AS propuesta_at
          FROM vehicle_visit_bookings b
          WHERE lower(b.buyer_email) = $1
          ORDER BY b.starts_at DESC LIMIT 20
        ),
        -- Y las reservas del calendario sobre un coche suyo: las mismas, del
        -- otro lado. Solo el nombre de quien viene, nunca su correo ni su
        -- telefono. Si se reserva a si mismo, sale aqui y en citas: es las dos
        -- cosas.
        citas_vendedor AS (
          SELECT b.id, b.offer_id, b.vehicle_title, b.starts_at, b.ends_at, b.status,
                 b.buyer_name, b.token_seller, b.created_at,
                 b.meeting_place, b.meeting_contact
          FROM vehicle_visit_bookings b
          WHERE lower(COALESCE(b.seller_email, '')) = $1
          ORDER BY b.starts_at DESC LIMIT 20
        )
      SELECT
        COALESCE((SELECT json_agg(v) FROM vehicles v), '[]'::json) AS vehicles,
        COALESCE((SELECT json_agg(a) FROM appts a), '[]'::json)    AS appointments,
        COALESCE((SELECT json_agg(m) FROM maints m), '[]'::json)   AS maintenances,
        COALESCE((SELECT json_agg(i) FROM insurs i), '[]'::json)   AS insurances,
        COALESCE((SELECT json_agg(vl) FROM vals vl), '[]'::json)   AS valuations,
        COALESCE((SELECT json_agg(s) FROM vstates s), '[]'::json)  AS vehicle_states,
        COALESCE((SELECT json_agg(so) FROM saved so), '[]'::json)  AS saved_offers,
        COALESCE((SELECT json_agg(l) FROM leads l), '[]'::json)    AS leads,
        COALESCE((SELECT json_agg(vw) FROM views vw), '[]'::json)  AS views,
        COALESCE((SELECT json_agg(c) FROM citas c), '[]'::json)    AS citas,
        COALESCE((SELECT json_agg(cv) FROM citas_vendedor cv), '[]'::json) AS citas_vendedor,
        (SELECT plan_id FROM usr)                                   AS plan_id
    `, [normalizedEmail]);

    const row = result.rows[0] || {};
    const s = (v) => String(v || "");
    const n = (v) => Number(v || 0);

    const vehicles = Array.isArray(row.vehicles) ? row.vehicles : [];

    const appointments = (Array.isArray(row.appointments) ? row.appointments : []).map((r) => ({
      id: s(r.id),
      type: s(r.appointment_type),
      title: s(r.title),
      meta: s(r.meta),
      status: s(r.status),
      requestedAt: s(r.requested_at_text),
      vehicleId: s(r.vehicle_id),
      vehicleTitle: s(r.vehicle_title),
      vehiclePlate: s(r.vehicle_plate),
      statusHistory: [],
    }));

    const maintenances = (Array.isArray(row.maintenances) ? row.maintenances : []).map((r) => ({
      id: s(r.id),
      vehicleId: s(r.vehicle_id),
      vehicleTitle: s(r.vehicle_title),
      vehiclePlate: s(r.vehicle_plate),
      type: s(r.maintenance_type),
      title: s(r.title),
      status: s(r.status) || "Pendiente",
      scheduledAt: s(r.scheduled_at_text),
      workshopName: s(r.workshop_name),
      mileage: s(r.mileage_text),
      estimatedCost: n(r.estimated_cost),
      notes: s(r.notes),
      invoices: [],
    }));

    const insurances = (Array.isArray(row.insurances) ? row.insurances : []).map((r) => ({
      id: s(r.id),
      vehicleId: s(r.vehicle_id),
      vehicleTitle: s(r.vehicle_title),
      vehiclePlate: s(r.vehicle_plate),
      provider: s(r.provider),
      policyNumber: s(r.policy_number),
      coverageType: s(r.coverage_type),
      status: s(r.status) || "active",
      renewalAt: s(r.renewal_at_text),
      monthlyPremium: n(r.monthly_premium),
      notes: s(r.notes),
      documents: [],
    }));

    const valuations = (Array.isArray(row.valuations) ? row.valuations : []).map((r) => ({
      id: s(r.id),
      title: s(r.title),
      meta: s(r.meta),
      status: s(r.status),
      report: s(r.report),
      estimateValue: n(r.estimate_value),
      vehicleId: s(r.vehicle_id),
      vehicleTitle: s(r.vehicle_title),
    }));

    const vehicleStates = (Array.isArray(row.vehicle_states) ? row.vehicle_states : []).map((r) => ({
      vehicleId: s(r.vehicle_id),
      state: s(r.state),
      isListed: r.is_listed === true,
      listingUrl: s(r.listing_url),
      notes: s(r.notes),
      updatedAt: s(r.updated_at),
      title: s(r.title),
      brand: s(r.brand),
      model: s(r.model),
      year: s(r.year),
    }));

    const savedOffers = (Array.isArray(row.saved_offers) ? row.saved_offers : []).map((r) => {
      const payload = r?.offer_payload && typeof r.offer_payload === "object" ? r.offer_payload : {};
      return { ...payload, id: s(r.id) || s(payload.id), vehicleId: s(r.vehicle_id) || s(payload.vehicleId), title: s(r.title) || s(payload.title) };
    });

    /*
     * Las puertas del encargo, para quien nos ha encargado vender su coche.
     *
     * El ERP ya las sabía y él no veía nada: se enteraba de lo que le faltaba
     * cuando le llamábamos, que es tarde y es caro — la llamada se gastaba en
     * leerle una lista que podía haber leído él.
     *
     * Se calculan aquí y no en el SQL de arriba porque las reglas son las del
     * ERP —seis fotos, seis franjas, catorce días— y reescribirlas en SQL sería
     * tener dos versiones que el día que cambie una dirían cosas distintas.
     *
     * Es una consulta más por encargo, y de esos hay cero o uno.
     */
    const puertasPorLead = {};
    /** Y su mandato pendiente de firma, para que pueda subirlo desde el panel. */
    const mandatoPorLead = {};
    /**
     * Y la cita del taller, cuando ya se le ha dicho.
     *
     * La revisión mecánica es lo único de las seis puertas que ponemos nosotros,
     * y el cliente no la veía en ninguna parte: le llegaba un correo con el día
     * y ahí se acababa. Un correo se entierra en una bandeja; el panel es donde
     * vuelve a mirar cuando no se acuerda de si era el jueves o el viernes.
     *
     * **Solo si consta que se le ha dicho** (`avisado_at`). Se apunta una cita
     * muchas veces antes de tenerla cerrada con el taller, y enseñarle aquí una
     * fecha que aún puede cambiar es peor que no enseñarle nada: se organiza el
     * día para llevarlo y luego le llamamos para moverla.
     */
    const tallerPorLead = {};
    /**
     * Y por dónde va el encargo cuando ya lo ha traído todo.
     *
     * Desde que cierra la lista hasta que ve su anuncio pasan días en los que,
     * para él, no se mueve nada: el coche va al taller, se prepara el anuncio y
     * se publica, y la pantalla le seguía diciendo lo mismo que el primer día.
     */
    const estadoPorLead = {};
    /** Y el precio de salida, que es el último papel y el único que le conviene. */
    const precioPorLead = {};
    /**
     * Y las visitas a su coche, que las contesta él.
     *
     * En el panel solo salían las que él había pedido como comprador. Las que
     * le piden a él —que tiene que confirmar o mover— no estaban en ninguna
     * parte salvo en el correo, y confundía la suya propia con una de compra.
     */
    const visitasPorLead = {};
    /**
     * Y su venta, cuando alguien ya ha dicho que lo compra.
     *
     * De todo lo que se guarda de esa compra sale solo lo que es suyo: que hay
     * comprador, quien es de nombre, por cuanto y que falta. Su DNI, su
     * domicilio, su correo y su telefono se quedan en el encargo: el vendedor
     * no los necesita para saber por donde va lo suyo, y esto lo pide una app.
     */
    const ventaPorLead = {};
    for (const r of (Array.isArray(row.leads) ? row.leads : [])) {
      if (s(r.lead_type) !== "venta_gestionada") continue;
      try {
        // Por identificador si eligió el coche de su lista; por matrícula si la
        // escribió a mano, que es el caso en que ni nosotros sabemos cuál es.
        let cocheId = s(r.vehicle_id);
        if (!cocheId && s(r.plate)) {
          const porMatricula = await pool.query(
            `SELECT id FROM moveadvisor_user_vehicles
              WHERE lower(user_email) = $1 AND upper(replace(COALESCE(plate,''), ' ', '')) = upper(replace($2, ' ', ''))
              ORDER BY created_at DESC LIMIT 1`,
            [normalizedEmail, s(r.plate)]
          );
          cocheId = s(porMatricula.rows[0]?.id);
        }
        // Sin coche no hay puertas que enseñar: lo que le falta es crearlo, y
        // eso ya se lo dice la pantalla con la guía.
        if (!cocheId) continue;
        puertasPorLead[s(r.id)] = lasPuertasDelEncargo(await loQueHayDelCoche(pool, cocheId));

        try {
          const vis = await pool.query(
            `SELECT b.id, b.starts_at, b.ends_at, b.status, b.buyer_name, b.token_seller,
                    (SELECT e.actor FROM visit_booking_events e
                      WHERE e.booking_id = b.id AND e.evento = 'horas_propuestas'
                      ORDER BY e.created_at DESC LIMIT 1) AS propuso
               FROM vehicle_visit_bookings b
              WHERE b.offer_id = $1
                AND lower(COALESCE(b.seller_email, '')) = $2
                AND b.status IN ('pending', 'confirmed')
                AND b.ends_at > NOW()
              ORDER BY b.starts_at ASC LIMIT 10`,
            [`idcar-${cocheId}`, normalizedEmail]
          );
          if (vis.rows.length) {
            visitasPorLead[s(r.id)] = vis.rows.map((v) => ({
              id: s(v.id),
              starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : "",
              ends_at: v.ends_at ? new Date(v.ends_at).toISOString() : "",
              status: s(v.status),
              quien: s(v.buyer_name),
              // Si ya le propuso otras horas y está esperando a que elija.
              esperando_al_comprador: s(v.propuso) === "vendedor" && s(v.status) === "pending",
              // Su llave: es suyo, y es lo que abre la página donde contesta.
              enlace: v.token_seller ? `/cita-vendedor?id=${encodeURIComponent(s(v.id))}&token=${encodeURIComponent(s(v.token_seller))}` : "",
            }));
          }
        } catch (e) {
          console.error("[panel] visitas a su coche:", e.message);
        }

        /*
         * Y su mandato, si se lo hemos mandado y no consta firmado.
         *
         * Es lo que le permite subirlo desde aquí. Antes se le pedía que
         * contestara al correo, y entonces el papel se quedaba en una bandeja
         * de entrada mientras el encargo seguía diciendo «sin firmar» — y sin
         * mandato firmado no se le puede facturar nada.
         *
         * Solo si ya se le mandó (`mandato_id`): pedirle que suba un papel que
         * no tiene sería pedirle algo imposible.
         */
        const mand = await pool.query(
          `SELECT e.id, e.mandato_id, e.firmado_at,
                  e.clausula_id, e.clausula_enviada_at, e.clausula_firmada_at, e.precio_referencia,
                  e.clausula_precio,
                  /*
                   * Y la venta, si ya hay comprador.
                   *
                   * Por to_jsonb y no por su nombre: estas columnas las crea
                   * «quiero comprarlo» la primera vez que alguien compra, asi
                   * que en una base donde eso no ha pasado todavia no existen y
                   * nombrarlas tumbaria la consulta entera —y con ella las
                   * puertas del encargo, que es lo que mas se mira—.
                   */
                  to_jsonb(e)->>'venta_estado'        AS venta_estado,
                  to_jsonb(e)->>'venta_iniciada_at'   AS venta_iniciada_at,
                  to_jsonb(e)->>'venta_financia'      AS venta_financia,
                  to_jsonb(e)->>'financiacion_estado' AS financiacion_estado,
                  to_jsonb(e)->>'precio_venta'        AS precio_venta,
                  to_jsonb(e)->>'comprador_nombre'    AS comprador_nombre
             FROM erp_encargos_venta e
            WHERE e.vehicle_id = $1 AND e.cerrado_at IS NULL
            ORDER BY e.created_at DESC LIMIT 1`,
          [cocheId]
        );
        /*
         * Se manda también cuando ya está firmado.
         *
         * El mandato es una fila más de la lista, y las filas hechas se
         * enseñan igual que las que faltan: una lista que esconde lo hecho
         * convierte cada avance en una lista que se acorta sin decir hacia
         * dónde. Y el contador de arriba tiene que poder contarlo.
         */
        const enc = mand.rows[0];
        if (enc && enc.mandato_id) {
          mandatoPorLead[s(r.id)] = {
            encargo_id: enc.id,
            mandato_id: enc.mandato_id,
            firmado: Boolean(enc.firmado_at),
          };
        }

        /*
         * La cita del taller que ya se le ha contado.
         *
         * La más reciente y solo si no está hecha: cuando el taller contesta,
         * la cita deja de ser algo que él tenga que hacer y enseñarla sería
         * pedirle que lleve un coche que ya llevó.
         *
         * Con `catch`: esta tabla es del ERP y puede no existir en un entorno.
         * Que falte no puede dejarle sin las puertas, que es lo que de verdad
         * tiene que ver.
         */
        const tal = await pool.query(
          `SELECT estado, resultado, taller, direccion, cita_at, avisado_at, cliente_pidio
             FROM erp_revisiones_taller
            WHERE vehicle_id = $1
            ORDER BY created_at DESC LIMIT 1`,
          [cocheId]
        ).catch(() => ({ rows: [] }));
        const rev = tal.rows[0];
        const tallerHecho = s(rev?.estado) === "Hecha";

        /*
         * La cita, solo mientras sea algo que él tenga que hacer.
         *
         * Con la revisión hecha, enseñársela sería pedirle que lleve un coche
         * que ya llevó. Y solo si se le ha contado (`avisado_at`): se apunta una
         * cita muchas veces antes de tenerla cerrada con el taller.
         */
        if (rev && rev.cita_at && !tallerHecho && rev.avisado_at) {
          tallerPorLead[s(r.id)] = {
            taller: s(rev.taller),
            direccion: s(rev.direccion),
            cita_at: new Date(rev.cita_at).toISOString(),
            /*
             * Y lo que ya haya pedido sobre ella.
             *
             * Sin esto, el que pide el cambio y vuelve mañana se encuentra los
             * botones como si no hubiera dicho nada, y lo pide otra vez.
             */
            cliente_pidio: s(rev.cliente_pidio),
          };
        }

        /*
         * Y por dónde va su encargo cuando ya lo ha traído todo.
         *
         * Con las ocho puertas hechas, la pantalla le decía «ya está todo, nos
         * ponemos con la venta» y ahí se acababa: por dentro el coche pasaba por
         * el taller, se preparaba el anuncio y se publicaba, y él no veía
         * moverse nada. El que no ve moverse nada llama para preguntar, y la
         * llamada se gasta en leerle un estado que podía haber leído.
         *
         * El resultado del taller no se le cuenta aquí. Si salió mal hay que
         * llamarle —es la única de las seis puertas que se resuelve hablando— y
         * enterarse por una línea del panel antes de esa llamada es la peor
         * manera. Lo que se dice es que está hecha.
         */
        let publicado = null;
        try {
          const ofe = await pool.query(
            `SELECT id, is_active FROM moveadvisor_marketplace_vo_offers WHERE id = $1`,
            [`idcar-${cocheId}`]
          );
          publicado = ofe.rows[0] || null;
        } catch {
          // Sin escaparate legible se dice lo que sí se sabe y nada más.
        }

        /*
         * Y el precio de salida, cuando ya se le ha mandado el papel.
         *
         * Solo si se le ha mandado (`clausula_enviada_at`): la fila le pide que
         * suba un documento, y enseñársela antes sería pedirle un papel que no
         * tiene. Quien decide cuándo mandarlo es quien lleva el encargo, y no
         * puede hacerlo hasta que el coche vuelve del taller.
         *
         * Se sigue enseñando después de firmada, en verde: la lista enseña lo
         * hecho igual que lo que falta, que es lo que permite ver cuánto se
         * lleva andado.
         */
        /*
         * El importe es el del papel que se le mandó, no el guardado: es el que
         * tiene delante. Y si después se acordó otro y todavía no se le ha
         * mandado el nuevo, la fila no sale: pedirle que suba un papel que ya no
         * vale es pedirle algo que se le va a rechazar.
         */
        const papel = Number(enc?.clausula_precio) > 0 ? Number(enc.clausula_precio) : Number(enc?.precio_referencia);
        const papelDeAhora = Math.round(papel * 100) === Math.round(Number(enc?.precio_referencia) * 100);
        if (enc && enc.clausula_enviada_at && (enc.clausula_firmada_at || papelDeAhora)) {
          precioPorLead[s(r.id)] = {
            encargo_id: enc.id,
            aceptada: Boolean(enc.clausula_firmada_at),
            // El importe, ya escrito: el panel no hace cuentas con dinero.
            importe: papel > 0
              ? `${Math.round(papel).toLocaleString("es-ES")} €`
              : "",
          };
        }

        if (enc && s(enc.venta_estado) === "en_curso") {
          const financia = s(enc.venta_financia) === "true";
          const importe = Number(enc.precio_venta);
          ventaPorLead[s(r.id)] = {
            desde: enc.venta_iniciada_at ? new Date(enc.venta_iniciada_at).toISOString() : "",
            comprador: s(enc.comprador_nombre),
            importe: importe > 0 ? `${Math.round(importe).toLocaleString("es-ES")} €` : "",
            financia,
            // `en_estudio` mientras la entidad no conteste. Es lo que decide si
            // lo siguiente es esperar o es el ingreso.
            financiacion: s(enc.financiacion_estado),
          };
        }

        estadoPorLead[s(r.id)] = {
          taller_hecho: tallerHecho,
          // Si el taller cerró la puerta, lo que toca es una llamada, no un
          // «estamos preparando tu anuncio» que ya no va a pasar.
          taller_ok: tallerHecho && s(rev?.resultado) !== "no_se_puede_vender",
          tiene_cita: Boolean(rev?.cita_at) && !tallerHecho,
          publicado: Boolean(publicado?.is_active),
          anuncio_url: publicado?.is_active ? `/marketplace-vo/${s(publicado.id)}` : "",
        };
      } catch (e) {
        // Que esto falle no puede dejarle sin panel.
        console.error("[panel] puertas del encargo:", e.message);
      }
    }

    const mappedLeads = (Array.isArray(row.leads) ? row.leads : []).map((r) => ({
      id: s(r.id),
      vehicle_id: s(r.vehicle_id),
      type: s(r.lead_type),
      title: s(r.vehicle_title),
      meta: JSON.stringify({
        // Lo que le falta para que podamos vender su coche, y dónde se hace.
        puertas: puertasPorLead[s(r.id)] || null,
        // Su mandato, si está sin firmar: es lo que le deja subirlo aquí.
        mandato: mandatoPorLead[s(r.id)] || null,
        // Y la cita del taller, si ya se le ha dicho cuál es.
        taller: tallerPorLead[s(r.id)] || null,
        // Por dónde va, para cuando ya no le falta nada por traer.
        estado_encargo: estadoPorLead[s(r.id)] || null,
        // Y el precio de salida, cuando ya se le ha mandado el papel.
        precio_de_salida: precioPorLead[s(r.id)] || null,
        // Las visitas a su coche, que contesta él como vendedor.
        visitas_a_tu_coche: visitasPorLead[s(r.id)] || null,
        // Y su venta, si ya hay comprador: sin datos de contacto de nadie.
        venta: ventaPorLead[s(r.id)] || null,
        /*
         * La matrícula del encargo, suelta.
         *
         * `title` trae el coche entero —«Volkswagen T-Roc 2022 · 8888LXR»— y de
         * ahí no se saca la matrícula sin adivinar. El panel la necesita tal
         * cual para saber de qué coche del garaje se trata.
         */
        matricula_encargo: s(r.plate),
        vehicle_url: s(r.vehicle_url),
        portal: s(r.portal),
        erp_response: s(r.erp_response),
        appointment_date: r.appointment_date ? String(r.appointment_date).slice(0, 10) : "",
        appointment_time: s(r.appointment_time),
        appointment_address: s(r.appointment_address),
        appointment_contact: s(r.appointment_contact),
        notified_at: r.notified_at ? new Date(r.notified_at).toISOString() : "",
        reschedule_proposals: Array.isArray(r.reschedule_proposals) ? r.reschedule_proposals : [],
        deposit_quoted: r.deposit_quoted != null ? Number(r.deposit_quoted) : null,
        escrow_impuesto: r.escrow_impuesto != null ? Number(r.escrow_impuesto) : null,
        impuesto_real:   r.impuesto_real   != null ? importeDeLaPartida(r.impuesto_real) : null,
        liquidacion_at:  r.liquidacion_at ?? null,
        entrega_direccion: r.entrega_direccion || "",
        entrega_ciudad: r.entrega_ciudad || "",
        entrega_provincia: r.entrega_provincia || "",
        entrega_cp: r.entrega_cp || "",
        deposit_paid_at: r.deposit_paid_at ? new Date(r.deposit_paid_at).toISOString() : "",
        delivery_estimate: r.delivery_estimate ? String(r.delivery_estimate).slice(0, 10) : "",
      // De qué viaje va, que el estado por sí solo no lo dice.
      matricula: normalizeText(r.matricula),
      viaje_a_casa: Boolean(r.viaje_a_casa),
      llegada_a_casa: r.llegada_a_casa
        ? String(r.llegada_a_casa instanceof Date ? r.llegada_a_casa.toISOString() : r.llegada_a_casa).slice(0, 10)
        : "",
      }),
      status: s(r.status),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
    }));

    /*
     * Las que no se pueden caer de la lista por el corte de abajo: las que
     * estan por delante, y las que acabaron hace poco y esperan respuesta.
     */
    const noSePierden = new Set();
    const AHORA = Date.now();
    const PLAZO_PARA_CONTESTAR = 14 * 86400000;

    const mappedViews = (Array.isArray(row.views) ? row.views : []).map((r) => {
      const cuando = r.confirmed_slot ? new Date(r.confirmed_slot).getTime() : 0;
      if (cuando > AHORA) noSePierden.add(`viewing-${s(r.id)}`);
      return {
        id: `viewing-${s(r.id)}`,
        vehicle_id: s(r.offer_id),
        type: "viewing_seller",
        title: s(r.vehicle_title),
        meta: JSON.stringify({
          buyer_name: s(r.buyer_name),
          buyer_message: s(r.buyer_message),
          proposed_slots: Array.isArray(r.proposed_slots) ? r.proposed_slots : [],
          confirmed_slot: r.confirmed_slot ? new Date(r.confirmed_slot).toISOString() : "",
          token_seller: s(r.token_seller),
        }),
        status: s(r.status),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
      };
    });

    // Las visitas del calendario, contadas como una solicitud mas.
    //
    // Para quien lo mira, pedir visita, pedir informacion y pedir renting son
    // lo mismo: cosas que ha pedido sobre coches que quiere. Que unas sean
    // leads y otra una reserva es un detalle de implementacion, y un detalle de
    // implementacion no tiene por que asomar en su pantalla.
    const mappedCitas = (Array.isArray(row.citas) ? row.citas : []).map((r) => {
      const empieza = r.starts_at ? new Date(r.starts_at).getTime() : 0;
      if (empieza && (empieza > AHORA || (!s(r.resultado) && AHORA - empieza < PLAZO_PARA_CONTESTAR))) {
        noSePierden.add(`cita-${s(r.id)}`);
      }
      return {
        id: `cita-${s(r.id)}`,
        vehicle_id: s(r.offer_id),
        type: "visita_marketplace",
        title: s(r.vehicle_title),
        meta: JSON.stringify({
          starts_at: r.starts_at ? new Date(r.starts_at).toISOString() : "",
          ends_at: r.ends_at ? new Date(r.ends_at).toISOString() : "",
          notes: s(r.notes),
          // Lo que escribio el vendedor al confirmar: donde es y por quien
          // preguntar. Es lo que hace util una cita en el movil.
          meeting_place: s(r.meeting_place),
          meeting_contact: s(r.meeting_contact),
          resultado: s(r.resultado),
          se_puede_comprar: r.se_puede_comprar === true,
          // Con esto se arma el enlace a su cita, que es donde puede moverla o
          // anularla sin contrasena.
          token_buyer: s(r.token_buyer),
          booking_id: s(r.id),
          // Solo hace falta saber que las hay: cuando elija una, la cita pasa a
          // confirmada y deja de estar pendiente, asi que el aviso se apaga solo.
          propuesta: Boolean(r.propuesta_at),
        }),
        status: estadoDeReserva(r.status),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
      };
    });

    /*
     * Treinta, pero sin tirar una cita que todavia pide algo.
     *
     * Se cortaba por fecha de creacion: quien pide muchas cosas en unos dias
     * perdia de la lista la visita que tiene el jueves, o la que acabo ayer y
     * espera respuesta —y de esa respuesta sale una compra—. Esas se quedan
     * siempre, y el resto rellena hasta treinta.
     */
    const porFecha = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    const todas = [...mappedLeads, ...mappedViews, ...mappedCitas].sort(porFecha);
    const imprescindibles = todas.filter((x) => noSePierden.has(x.id));
    const relleno = todas.filter((x) => !noSePierden.has(x.id));
    const solicitudes = [
      // Con tope tambien ellas: cincuenta visitas vivas es un caso que no
      // existe, y una lista sin techo es una respuesta sin techo.
      ...imprescindibles.slice(0, 30),
      ...relleno.slice(0, Math.max(0, 30 - imprescindibles.length)),
    ].sort(porFecha);

    /*
     * Las visitas a sus coches, aparte y no dentro de solicitudes.
     *
     * No son algo que él haya pedido, y el panel de la web ya las enseña a su
     * manera dentro del encargo. Van sueltas para la agenda de la app, que las
     * pone en «Venta». Con su llave, que es suya y abre la página donde las
     * contesta.
     */
    const visitasATuCoche = (Array.isArray(row.citas_vendedor) ? row.citas_vendedor : []).map((r) => ({
      id: `cita-vendedor-${s(r.id)}`,
      vehicle_id: s(r.offer_id),
      type: "visita_a_tu_coche",
      title: s(r.vehicle_title),
      meta: JSON.stringify({
        starts_at: r.starts_at ? new Date(r.starts_at).toISOString() : "",
        ends_at: r.ends_at ? new Date(r.ends_at).toISOString() : "",
        buyer_name: s(r.buyer_name),
        meeting_place: s(r.meeting_place),
        booking_id: s(r.id),
        token_seller: s(r.token_seller),
      }),
      status: estadoDeReserva(r.status),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
    }));

    const garageVehicleCount = vehicles.length;
    const planId = normalizeText(row.plan_id) || "free";

    return { vehicles, appointments, maintenances, insurances, valuations, vehicleStates, savedOffers, solicitudes, visitasATuCoche, garageVehicleCount, planId };
  } catch {
    // Fallback a queries secuenciales si falla la CTE
    const vehicles      = await listGarageVehiclesByEmailPostgres(email);
    const appointments  = await listAppointmentsByEmailPostgres(email);
    const maintenances  = await listMaintenancesByEmailPostgres(email);
    const insurances    = await listInsurancesByEmailPostgres(email);
    const valuations    = await listValuationsByEmailPostgres(email);
    const vehicleStates = await listVehicleStatesByEmailPostgres(email);
    const savedOffers   = await listSavedOffersByEmailPostgres(email);
    const solicitudes   = await listSolicitudesByEmailPostgres(email);
    let planId = "free";
    try {
      const r = await getPgPool().query(
        "SELECT plan_id FROM moveadvisor_users WHERE lower(email) = $1 LIMIT 1",
        [normalizedEmail]
      );
      planId = normalizeText(r.rows?.[0]?.plan_id) || "free";
    } catch { /* keep default */ }
    return { vehicles, appointments, maintenances, insurances, valuations, vehicleStates, savedOffers, solicitudes, garageVehicleCount: vehicles.length, planId };
  }
}

function sanitizeGarageAttachment(input = {}) {
  return sanitizeAttachment(input);
}

function sanitizeGarageVehicle(input = {}) {
  const brand = normalizeText(input?.brand);
  const model = normalizeText(input?.model);
  const version = normalizeText(input?.version);
  const title = normalizeText(input?.title) || `${brand} ${model} ${version}`.trim();
  const photos = sanitizeAttachmentArray(input?.photos, 30);
  const documents = sanitizeAttachmentArray(input?.documents, 30);

  return {
    id: normalizeText(input?.id),
    marketplaceState: ['active_sale', 'owned', 'sold'].includes(normalizeText(input?.marketplaceState)) ? normalizeText(input?.marketplaceState) : 'owned',
    title,
    brand,
    model,
    version,
    transmissionType: normalizeText(input?.transmissionType),
    cv: normalizeText(input?.cv),
    color: normalizeText(input?.color),
    horsepower: normalizeText(input?.horsepower),
    seats: normalizeText(input?.seats),
    doors: normalizeText(input?.doors),
    location: normalizeText(input?.location),
    bodyType: normalizeText(input?.bodyType),
    environmentalLabel: normalizeText(input?.environmentalLabel),
    lastIvt: normalizeText(input?.lastIvt),
    nextIvt: normalizeText(input?.nextIvt),
    co2: normalizeText(input?.co2),
    price: normalizeText(input?.price),
    marketplacePricingMode: ["manual", "valuation"].includes(normalizeText(input?.marketplacePricingMode).toLowerCase())
      ? normalizeText(input?.marketplacePricingMode).toLowerCase()
      : "manual",
    year: normalizeText(input?.year),
    plate: normalizeText(input?.plate),
    mileage: normalizeText(input?.mileage),
    fuel: normalizeText(input?.fuel),
    policyCompany: normalizeText(input?.policyCompany),
    policyNumber: normalizeText(input?.policyNumber),
    coverageType: normalizeText(input?.coverageType),
    /*
     * Lo que dijo del mantenimiento, con los valores cerrados.
     *
     * Pasa por el filtro aunque venga de nuestra propia base: esto acaba en el
     * anuncio, y ahí un valor que el vendedor no dijo lo firma él.
     */
    ...loQueSeSabeDelMantenimiento(input),
    notes: normalizeText(input?.notes),
    photos: photos.slice(0, 30),
    documents: documents.slice(0, 30),
    technicalSheetDocuments: sanitizeAttachmentArray(input?.technicalSheetDocuments),
    circulationPermitDocuments: sanitizeAttachmentArray(input?.circulationPermitDocuments),
    itvDocuments: sanitizeAttachmentArray(input?.itvDocuments),
    insuranceDocuments: sanitizeAttachmentArray(input?.insuranceDocuments),
    maintenanceInvoices: sanitizeAttachmentArray(input?.maintenanceInvoices || input?.initialMaintenance?.invoices),
    initialMaintenance: {
      type: normalizeText(input?.initialMaintenance?.type || "maintenance"),
      title: normalizeText(input?.initialMaintenance?.title),
      notes: normalizeText(input?.initialMaintenance?.notes),
      invoices: sanitizeAttachmentArray(input?.maintenanceInvoices || input?.initialMaintenance?.invoices),
    },
    createdAt: normalizeText(input?.createdAt) || new Date().toISOString(),
  };
}

function getSeedGarageVehicles(email = "") {
  // Garaje de demostracion. Va por variable porque es la cuenta concreta de
  // una persona y esto es un repositorio publico; sin variable, nadie lo ve.
  const demo = String(process.env.DEMO_GARAGE_EMAIL || "").trim().toLowerCase();
  if (!demo || normalizeEmail(email) !== demo) {
    return [];
  }

  return [
    {
      id: "garage-seed-audi-a3-sportback-s-line",
      title: "Audi A3 Sportback S line",
      brand: "Audi",
      model: "A3 Sportback",
      version: "S line",
      transmissionType: "automatico",
      cv: "150",
      color: "Negro",
      horsepower: "150",
      seats: "5",
      doors: "5",
      location: "Madrid",
      bodyType: "compacto",
      environmentalLabel: "C",
      lastIvt: "",
      nextIvt: "",
      co2: "",
      price: "",
      marketplacePricingMode: "manual",
      year: "",
      plate: "",
      mileage: "",
      fuel: "",
      policyCompany: "",
      notes: "Vehiculo asignado desde marketplace.",
      photos: [],
      documents: [],
      createdAt: "2026-04-17T00:00:00.000Z",
    },
  ];
}

let _memoryStore = null; // fallback when filesystem is read-only (e.g. Vercel)

function ensureStoreDirectory() {
  try {
    const dirPath = path.dirname(BILLING_STORE_PATH);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch {
    // read-only filesystem — skip
  }
}

function createDefaultStore() {
  return {
    customersByEmail: {},
    stripeCustomerToEmail: {},
    stripeSubscriptionToEmail: {},
    updatedAt: new Date().toISOString(),
  };
}

function writeStore(nextStore) {
  const safeStore = {
    customersByEmail: nextStore?.customersByEmail || {},
    stripeCustomerToEmail: nextStore?.stripeCustomerToEmail || {},
    stripeSubscriptionToEmail: nextStore?.stripeSubscriptionToEmail || {},
    updatedAt: new Date().toISOString(),
  };

  try {
    ensureStoreDirectory();
    fs.writeFileSync(BILLING_STORE_PATH, JSON.stringify(safeStore, null, 2));
  } catch {
    // read-only filesystem (Vercel serverless) — keep in memory for this invocation
    _memoryStore = safeStore;
  }

  return safeStore;
}

function readStore() {
  if (_memoryStore) return _memoryStore;

  // On Vercel/production, never read from the static file — it may contain
  // stale dev/test data. Rely on PostgreSQL as the source of truth.
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return createDefaultStore();
  }

  ensureStoreDirectory();

  if (!fs.existsSync(BILLING_STORE_PATH)) {
    return createDefaultStore();
  }

  try {
    const raw = fs.readFileSync(BILLING_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");

    return {
      customersByEmail: parsed && typeof parsed.customersByEmail === "object" ? parsed.customersByEmail : {},
      stripeCustomerToEmail:
        parsed && typeof parsed.stripeCustomerToEmail === "object" ? parsed.stripeCustomerToEmail : {},
      stripeSubscriptionToEmail:
        parsed && typeof parsed.stripeSubscriptionToEmail === "object" ? parsed.stripeSubscriptionToEmail : {},
      updatedAt: normalizeText(parsed?.updatedAt) || "",
    };
  } catch {
    return createDefaultStore();
  }
}

function getDefaultAccount(email = "") {
  return {
    email,
    profile: {
      fullName: "",
      email,
      phone: "",
      companyName: "",
      taxId: "",
      billingAddress: "",
      iban: "",
      updatedAt: "",
    },
    billingState: {
      planId: "free",
      planLabel: "Free",
      status: "inactivo",
      nextBillingDate: "",
      stripeCustomerId: "",
      stripeSubscriptionId: "",
      cancelAtPeriodEnd: false,
      invoices: [],
    },
    garageVehicles: getSeedGarageVehicles(email),
    updatedAt: "",
  };
}

function resolveAccountByEmail(email = "") {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const store = readStore();
  const existing = store.customersByEmail[normalizedEmail];

  if (!existing || typeof existing !== "object") {
    return getDefaultAccount(normalizedEmail);
  }

  const fallback = getDefaultAccount(normalizedEmail);
  const safeInvoices = Array.isArray(existing?.billingState?.invoices)
    ? existing.billingState.invoices
        .map((invoice) => ({
          id: normalizeText(invoice?.id),
          number: normalizeText(invoice?.number),
          date: normalizeText(invoice?.date),
          amount: Number(invoice?.amount || 0),
          status: normalizeText(invoice?.status),
          pdfUrl: normalizeText(invoice?.pdfUrl),
        }))
        .filter((invoice) => invoice.id || invoice.number)
    : [];
  const safeGarageVehicles = Array.isArray(existing?.garageVehicles)
    ? existing.garageVehicles
        .map((vehicle) => sanitizeGarageVehicle(vehicle))
        .filter((vehicle) => vehicle.id && vehicle.brand && vehicle.model)
        .slice(0, 20)
    : fallback.garageVehicles;

  return {
    email: normalizedEmail,
    profile: {
      ...fallback.profile,
      ...(existing.profile && typeof existing.profile === "object" ? existing.profile : {}),
      email: normalizedEmail,
    },
    billingState: {
      ...fallback.billingState,
      ...(existing.billingState && typeof existing.billingState === "object" ? existing.billingState : {}),
      invoices: safeInvoices.length > 0 ? safeInvoices.slice(0, 40) : fallback.billingState.invoices,
    },
    garageVehicles: safeGarageVehicles,
    updatedAt: normalizeText(existing.updatedAt),
  };
}

function upsertAccount(email = "", updater) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const store = readStore();
  const current = resolveAccountByEmail(normalizedEmail);
  const updated = typeof updater === "function" ? updater(current) : current;

  if (!updated || typeof updated !== "object") {
    return current;
  }

  const nextAccount = {
    ...current,
    ...updated,
    email: normalizedEmail,
    profile: {
      ...(current?.profile || {}),
      ...(updated?.profile || {}),
      email: normalizedEmail,
    },
    billingState: {
      ...(current?.billingState || {}),
      ...(updated?.billingState || {}),
      invoices: Array.isArray(updated?.billingState?.invoices)
        ? updated.billingState.invoices.slice(0, 40)
        : Array.isArray(current?.billingState?.invoices)
        ? current.billingState.invoices.slice(0, 40)
        : [],
    },
    garageVehicles: Array.isArray(updated?.garageVehicles)
      ? updated.garageVehicles
          .map((vehicle) => sanitizeGarageVehicle(vehicle))
          .filter((vehicle) => vehicle.id && vehicle.brand && vehicle.model)
          .slice(0, 20)
      : Array.isArray(current?.garageVehicles)
      ? current.garageVehicles
          .map((vehicle) => sanitizeGarageVehicle(vehicle))
          .filter((vehicle) => vehicle.id && vehicle.brand && vehicle.model)
          .slice(0, 20)
      : [],
    updatedAt: new Date().toISOString(),
  };

  store.customersByEmail[normalizedEmail] = nextAccount;

  const stripeCustomerId = normalizeText(nextAccount?.billingState?.stripeCustomerId);
  if (stripeCustomerId) {
    store.stripeCustomerToEmail[stripeCustomerId] = normalizedEmail;
  }

  const stripeSubscriptionId = normalizeText(nextAccount?.billingState?.stripeSubscriptionId);
  if (stripeSubscriptionId) {
    store.stripeSubscriptionToEmail[stripeSubscriptionId] = normalizedEmail;
  }

  writeStore(store);
  return nextAccount;
}

function updateProfile(email = "", profile = {}) {
  return upsertAccount(email, (current) => ({
    ...current,
    profile: {
      ...(current?.profile || {}),
      fullName: normalizeText(profile?.fullName),
      phone: normalizeText(profile?.phone),
      companyName: normalizeText(profile?.companyName),
      taxId: normalizeText(profile?.taxId),
      billingAddress: normalizeText(profile?.billingAddress),
      iban: normalizeText(profile?.iban),
      updatedAt: new Date().toISOString(),
    },
  }));
}

function updateBillingState(email = "", patch = {}) {
  return upsertAccount(email, (current) => ({
    ...current,
    billingState: {
      ...(current?.billingState || {}),
      ...patch,
    },
  }));
}

function appendOrUpdateInvoice(email = "", invoice = {}) {
  return upsertAccount(email, (current) => {
    const existingInvoices = Array.isArray(current?.billingState?.invoices)
      ? current.billingState.invoices.slice(0, 40)
      : [];
    const invoiceId = normalizeText(invoice?.id) || normalizeText(invoice?.number);

    const safeInvoice = {
      id: normalizeText(invoice?.id),
      number: normalizeText(invoice?.number),
      date: normalizeText(invoice?.date),
      amount: Number(invoice?.amount || 0),
      status: normalizeText(invoice?.status),
      pdfUrl: normalizeText(invoice?.pdfUrl),
    };

    let nextInvoices = existingInvoices;

    if (invoiceId) {
      const idx = existingInvoices.findIndex(
        (item) => normalizeText(item?.id) === invoiceId || normalizeText(item?.number) === invoiceId
      );

      if (idx >= 0) {
        nextInvoices = existingInvoices.map((item, index) => (index === idx ? { ...item, ...safeInvoice } : item));
      } else {
        nextInvoices = [safeInvoice, ...existingInvoices].slice(0, 40);
      }
    }

    return {
      ...current,
      billingState: {
        ...(current?.billingState || {}),
        invoices: nextInvoices,
      },
    };
  });
}

async function listGarageVehiclesByEmail(email = "") {
  if (shouldUseSqlServerMobility()) {
    return listGarageVehiclesSqlServer(email);
  }

  if (hasPostgresConnection()) {
    try {
      return await listGarageVehiclesByEmailPostgres(email);
    } catch {
      // Fallback to local JSON store.
    }
  }

  return resolveAccountByEmail(email)?.garageVehicles || [];
}

async function listGarageVehicleSummariesByEmail(email = "") {
  if (shouldUseSqlServerMobility()) {
    return listGarageVehicleSummariesSqlServer(email);
  }

  if (hasPostgresConnection()) {
    try {
      return await listGarageVehicleSummariesByEmailPostgres(email);
    } catch {
      // Fallback to local JSON store.
    }
  }

  const vehicles = resolveAccountByEmail(email)?.garageVehicles || [];
  return vehicles
    .map((vehicle) => sanitizeGarageVehicle(vehicle))
    .map((vehicle) => ({
      id: normalizeText(vehicle?.id),
      title: normalizeText(vehicle?.title),
      brand: normalizeText(vehicle?.brand),
      model: normalizeText(vehicle?.model),
      version: normalizeText(vehicle?.version),
      year: normalizeText(vehicle?.year),
      plate: normalizeText(vehicle?.plate),
      mileage: normalizeText(vehicle?.mileage),
      fuel: normalizeText(vehicle?.fuel),
      location: normalizeText(vehicle?.location),
      createdAt: normalizeText(vehicle?.createdAt),
    }))
    .filter((vehicle) => vehicle.id);
}

async function addGarageVehicleByEmail(email = "", vehicle = {}) {
  if (shouldUseSqlServerMobility()) {
    return addGarageVehicleSqlServer(email, vehicle);
  }

  if (hasPostgresConnection()) {
    try {
      return await addGarageVehicleByEmailPostgres(email, vehicle);
    } catch {
      // Fallback to local JSON store.
    }
  }

  const normalizedVehicle = sanitizeGarageVehicle(vehicle);

  if (!normalizedVehicle.brand || !normalizedVehicle.model) {
    return resolveAccountByEmail(email)?.garageVehicles || [];
  }

  const nextVehicle = {
    ...normalizedVehicle,
    id: normalizedVehicle.id || `garage-${Date.now()}`,
  };

  const account = upsertAccount(email, (current) => {
    const currentVehicles = Array.isArray(current?.garageVehicles) ? current.garageVehicles : [];
    const deduped = currentVehicles
      .map((item) => sanitizeGarageVehicle(item))
      .filter((item) => item.id !== nextVehicle.id);

    return {
      ...current,
      garageVehicles: [nextVehicle, ...deduped].slice(0, 20),
    };
  });

  return account?.garageVehicles || [];
}

async function removeGarageVehicleByEmail(email = "", vehicleId = "") {
  if (shouldUseSqlServerMobility()) {
    return removeGarageVehicleSqlServer(email, vehicleId);
  }

  if (hasPostgresConnection()) {
    try {
      return await removeGarageVehicleByEmailPostgres(email, vehicleId);
    } catch {
      // Fallback to local JSON store.
    }
  }

  const normalizedVehicleId = normalizeText(vehicleId);

  if (!normalizedVehicleId) {
    return resolveAccountByEmail(email)?.garageVehicles || [];
  }

  const account = upsertAccount(email, (current) => {
    const currentVehicles = Array.isArray(current?.garageVehicles) ? current.garageVehicles : [];

    return {
      ...current,
      garageVehicles: currentVehicles
        .map((item) => sanitizeGarageVehicle(item))
        .filter((item) => item.id !== normalizedVehicleId)
        .slice(0, 20),
    };
  });

  return account?.garageVehicles || [];
}

async function listAppointmentsByEmail(email = "") {
  if (shouldUseSqlServerMobility()) {
    try {
      return listAppointmentsSqlServer(email);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await listAppointmentsByEmailPostgres(email);
    } catch {
      return [];
    }
  }

  return [];
}

async function addAppointmentByEmail(email = "", appointment = {}) {
  if (shouldUseSqlServerMobility()) {
    try {
      return addAppointmentSqlServer(email, appointment);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await addAppointmentByEmailPostgres(email, appointment);
    } catch {
      return [];
    }
  }

  return [];
}

async function deleteAppointmentByEmail(email = "", appointmentId = "") {
  if (hasPostgresConnection()) {
    try {
      return await deleteAppointmentByEmailPostgres(email, appointmentId);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Cuantas tasaciones se le han entregado a este cliente.
 *
 * No vale contar lo que devuelve `listValuations`: esa consulta hace un INNER
 * JOIN con el garaje para poder ensenar el nombre del coche, y una tasacion
 * pedida con los datos escritos a mano no tiene `vehicle_id`. Se quedaba fuera,
 * y el cliente conservaba su tasacion gratuita despues de haberla usado.
 *
 * Aun con `vehicle_id`, la clave foranea es ON DELETE CASCADE: borrar el coche
 * del garaje se llevaria por delante sus tasaciones y devolveria la gratuita.
 * Por eso esto cuenta la tabla y nada mas, sin depender de que el coche siga
 * existiendo.
 *
 * Devuelve null si no se puede contar, para que quien llame distinga "no tiene
 * ninguna" de "no lo se" y pueda decidir cobrar ante la duda.
 */
async function contarTasacionesDe(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  if (shouldUseSqlServerMobility()) {
    try {
      const filas = listValuationsSqlServer(normalizedEmail);
      return Array.isArray(filas) ? filas.length : null;
    } catch {
      return null;
    }
  }

  if (!hasPostgresConnection()) return null;
  try {
    await ensureMobilitySchemaPostgres();
    const pool = getPgPool();
    const { userId } = await resolvePostgresUserIdentity(pool, normalizedEmail);
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM moveadvisor_user_valuations
        WHERE user_id = $1 OR (user_id IS NULL AND user_email = $2)`,
      [userId, normalizedEmail]
    );
    return Number(r.rows?.[0]?.n ?? 0);
  } catch (err) {
    console.error("[tasacion] no se pudo contar las entregadas:", err?.message);
    return null;
  }
}

async function listValuationsByEmail(email = "") {
  if (shouldUseSqlServerMobility()) {
    try {
      return listValuationsSqlServer(email);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await listValuationsByEmailPostgres(email);
    } catch {
      return [];
    }
  }

  return [];
}

async function listMaintenancesByEmail(email = "") {
  if (shouldUseSqlServerMobility()) {
    try {
      return listMaintenancesSqlServer(email);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await listMaintenancesByEmailPostgres(email);
    } catch {
      return [];
    }
  }

  return [];
}

async function addMaintenanceByEmail(email = "", payload = {}) {
  if (shouldUseSqlServerMobility()) {
    return addMaintenanceSqlServer(email, payload);
  }

  if (hasPostgresConnection()) {
    return await addMaintenanceByEmailPostgres(email, payload);
  }

  return [];
}

async function listInsurancesByEmail(email = "") {
  if (shouldUseSqlServerMobility()) {
    try {
      return listInsurancesSqlServer(email);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await listInsurancesByEmailPostgres(email);
    } catch {
      return [];
    }
  }

  return [];
}

async function upsertInsuranceByEmail(email = "", payload = {}) {
  if (shouldUseSqlServerMobility()) {
    return upsertInsuranceSqlServer(email, payload);
  }

  if (hasPostgresConnection()) {
    return await upsertInsuranceByEmailPostgres(email, payload);
  }

  return [];
}

async function addValuationByEmail(email = "", valuation = {}) {
  if (shouldUseSqlServerMobility()) {
    try {
      return addValuationSqlServer(email, valuation);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await addValuationByEmailPostgres(email, valuation);
    } catch {
      return [];
    }
  }

  return [];
}

async function listVehicleStatesByEmail(email = "") {
  if (shouldUseSqlServerMobility()) {
    try {
      return listVehicleStatesSqlServer(email);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await listVehicleStatesByEmailPostgres(email);
    } catch {
      return [];
    }
  }

  return [];
}

async function upsertVehicleStateByEmail(email = "", payload = {}) {
  if (shouldUseSqlServerMobility()) {
    try {
      return upsertVehicleStateSqlServer(email, payload);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await upsertVehicleStateByEmailPostgres(email, payload);
    } catch {
      return [];
    }
  }

  return [];
}

async function listSavedOffersByEmail(email = "") {
  if (shouldUseSqlServerMobility()) {
    try {
      return listSavedOffersSqlServer(email);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await listSavedOffersByEmailPostgres(email);
    } catch {
      return [];
    }
  }

  return [];
}

async function addSavedOfferByEmail(email = "", payload = {}) {
  if (shouldUseSqlServerMobility()) {
    try {
      return addSavedOfferSqlServer(email, payload);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await addSavedOfferByEmailPostgres(email, payload);
    } catch {
      return [];
    }
  }

  return [];
}

async function removeSavedOfferByEmail(email = "", offerId = "") {
  if (shouldUseSqlServerMobility()) {
    try {
      return removeSavedOfferSqlServer(email, offerId);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await removeSavedOfferByEmailPostgres(email, offerId);
    } catch {
      return [];
    }
  }

  return [];
}

async function getUserMobilityDataByEmail(email = "") {
  if (shouldUseSqlServerMobility()) {
    try {
      return getUserMobilityDataSqlServer(email);
    } catch {
      // Fallback below.
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await getUserMobilityDataByEmailPostgres(email);
    } catch {
      // Fallback below.
    }
  }

  return {
    vehicles: await listGarageVehiclesByEmail(email),
    appointments: [],
    maintenances: [],
    insurances: [],
    valuations: [],
    vehicleStates: [],
    savedOffers: [],
    solicitudes: [],
  };
}

async function listSolicitudesByEmail(email = "") {
  if (hasPostgresConnection()) {
    try {
      return await listSolicitudesByEmailPostgres(email);
    } catch {
      return [];
    }
  }
  return [];
}

function getEmailByStripeCustomerId(customerId = "") {
  const normalized = normalizeText(customerId);
  if (!normalized) {
    return "";
  }

  const store = readStore();
  return normalizeEmail(store?.stripeCustomerToEmail?.[normalized]);
}

function getEmailByStripeSubscriptionId(subscriptionId = "") {
  const normalized = normalizeText(subscriptionId);
  if (!normalized) {
    return "";
  }

  const store = readStore();
  return normalizeEmail(store?.stripeSubscriptionToEmail?.[normalized]);
}

function normalizeIdentityEmail(identityOrEmail = "") {
  if (typeof identityOrEmail === "string") {
    return normalizeEmail(identityOrEmail);
  }

  if (!identityOrEmail || typeof identityOrEmail !== "object") {
    return "";
  }

  return normalizeEmail(
    identityOrEmail?.email || identityOrEmail?.userEmail || identityOrEmail?.user?.email || identityOrEmail?.sessionEmail
  );
}

function resolveAccount(identityOrEmail = "") {
  return resolveAccountByEmail(normalizeIdentityEmail(identityOrEmail));
}

async function listGarageVehicles(identityOrEmail = "") {
  return listGarageVehiclesByEmail(normalizeIdentityEmail(identityOrEmail));
}

async function listGarageVehicleSummaries(identityOrEmail = "") {
  return listGarageVehicleSummariesByEmail(normalizeIdentityEmail(identityOrEmail));
}

/**
 * Las cinco puertas de cada coche, sin que haga falta un encargo de venta.
 *
 * Hasta ahora esto solo se calculaba dentro de un encargo, así que el cliente
 * solo veía lo que le faltaba **después** de pedirnos que se lo vendiéramos. Y
 * es justo lo que necesita saber antes: si le faltan fotos o la ITV, le falta
 * igual, haya encargo o no.
 *
 * Va aparte de `listGarageVehicles` y no dentro porque cuesta una consulta por
 * coche: quien solo quiere pintar el garaje —la web— no debe pagarla. Se pide
 * a propósito con `?puertas=1`.
 *
 * Devuelve un objeto indexado por id de vehículo. Un coche que falle no tumba
 * a los demás: se queda sin puertas y la pantalla no las enseña.
 */
async function puertasDeLosCoches(vehicleIds = []) {
  const pool = getPgPool();
  if (!pool) return {};

  const ids = (Array.isArray(vehicleIds) ? vehicleIds : []).map(normalizeText).filter(Boolean);
  if (!ids.length) return {};

  const porCoche = {};
  for (const id of ids) {
    try {
      porCoche[id] = lasPuertasDelEncargo(await loQueHayDelCoche(pool, id));
    } catch (e) {
      console.error("[garaje] puertas de", id, e.message);
    }
  }
  return porCoche;
}

async function addGarageVehicle(identityOrEmail = "", vehicle = {}) {
  return addGarageVehicleByEmail(normalizeIdentityEmail(identityOrEmail), vehicle);
}

async function removeGarageVehicle(identityOrEmail = "", vehicleId = "") {
  return removeGarageVehicleByEmail(normalizeIdentityEmail(identityOrEmail), vehicleId);
}

async function listAppointments(identityOrEmail = "") {
  return listAppointmentsByEmail(normalizeIdentityEmail(identityOrEmail));
}

async function addAppointment(identityOrEmail = "", appointment = {}) {
  return addAppointmentByEmail(normalizeIdentityEmail(identityOrEmail), appointment);
}

async function deleteAppointment(identityOrEmail = "", appointmentId = "") {
  return deleteAppointmentByEmail(normalizeIdentityEmail(identityOrEmail), appointmentId);
}

async function listMaintenances(identityOrEmail = "") {
  return listMaintenancesByEmail(normalizeIdentityEmail(identityOrEmail));
}

async function addMaintenance(identityOrEmail = "", payload = {}) {
  return addMaintenanceByEmail(normalizeIdentityEmail(identityOrEmail), payload);
}

async function listInsurances(identityOrEmail = "") {
  return listInsurancesByEmail(normalizeIdentityEmail(identityOrEmail));
}

async function upsertInsurance(identityOrEmail = "", payload = {}) {
  return upsertInsuranceByEmail(normalizeIdentityEmail(identityOrEmail), payload);
}

async function listValuations(identityOrEmail = "") {
  return listValuationsByEmail(normalizeIdentityEmail(identityOrEmail));
}

async function addValuation(identityOrEmail = "", valuation = {}) {
  return addValuationByEmail(normalizeIdentityEmail(identityOrEmail), valuation);
}

async function listVehicleStates(identityOrEmail = "") {
  return listVehicleStatesByEmail(normalizeIdentityEmail(identityOrEmail));
}

async function upsertVehicleState(identityOrEmail = "", payload = {}) {
  return upsertVehicleStateByEmail(normalizeIdentityEmail(identityOrEmail), payload);
}

async function listSavedOffers(identityOrEmail = "") {
  return listSavedOffersByEmail(normalizeIdentityEmail(identityOrEmail));
}

async function addSavedOffer(identityOrEmail = "", payload = {}) {
  return addSavedOfferByEmail(normalizeIdentityEmail(identityOrEmail), payload);
}

async function removeSavedOffer(identityOrEmail = "", offerId = "") {
  return removeSavedOfferByEmail(normalizeIdentityEmail(identityOrEmail), offerId);
}

async function getUserMobilityData(identityOrEmail = "") {
  return getUserMobilityDataByEmail(normalizeIdentityEmail(identityOrEmail));
}

async function listSolicitudes(identityOrEmail = "") {
  return listSolicitudesByEmail(normalizeIdentityEmail(identityOrEmail));
}

module.exports = {
  resolveAccount,
  // Deprecated alias kept for compatibility.
  resolveAccountByEmail: resolveAccount,
  updateProfile,
  updateBillingState,
  listGarageVehicleSummaries,
  // Deprecated alias kept for compatibility.
  listGarageVehicleSummariesByEmail: listGarageVehicleSummaries,
  puertasDeLosCoches,
  listGarageVehicles,
  // Se saca para poder comprobar, sin base de datos, qué campos de un coche
  // llegan de verdad a la pantalla.
  sanitizeGarageVehicle,
  // Deprecated alias kept for compatibility.
  listGarageVehiclesByEmail: listGarageVehicles,
  addGarageVehicle,
  // Deprecated alias kept for compatibility.
  addGarageVehicleByEmail: addGarageVehicle,
  removeGarageVehicle,
  // Deprecated alias kept for compatibility.
  removeGarageVehicleByEmail: removeGarageVehicle,
  listAppointments,
  // Deprecated alias kept for compatibility.
  listAppointmentsByEmail: listAppointments,
  addAppointment,
  // Deprecated alias kept for compatibility.
  addAppointmentByEmail: addAppointment,
  deleteAppointment,
  // Deprecated alias kept for compatibility.
  deleteAppointmentByEmail: deleteAppointment,
  listMaintenances,
  // Deprecated alias kept for compatibility.
  listMaintenancesByEmail: listMaintenances,
  addMaintenance,
  // Deprecated alias kept for compatibility.
  addMaintenanceByEmail: addMaintenance,
  listInsurances,
  // Deprecated alias kept for compatibility.
  listInsurancesByEmail: listInsurances,
  upsertInsurance,
  // Deprecated alias kept for compatibility.
  upsertInsuranceByEmail: upsertInsurance,
  listValuations,
  contarTasacionesDe,
  // Deprecated alias kept for compatibility.
  listValuationsByEmail: listValuations,
  addValuation,
  // Deprecated alias kept for compatibility.
  addValuationByEmail: addValuation,
  listVehicleStates,
  // Deprecated alias kept for compatibility.
  listVehicleStatesByEmail: listVehicleStates,
  upsertVehicleState,
  // Deprecated alias kept for compatibility.
  upsertVehicleStateByEmail: upsertVehicleState,
  listSavedOffers,
  // Deprecated alias kept for compatibility.
  listSavedOffersByEmail: listSavedOffers,
  addSavedOffer,
  // Deprecated alias kept for compatibility.
  addSavedOfferByEmail: addSavedOffer,
  removeSavedOffer,
  // Deprecated alias kept for compatibility.
  removeSavedOfferByEmail: removeSavedOffer,
  getUserMobilityData,
  // Deprecated alias kept for compatibility.
  getUserMobilityDataByEmail: getUserMobilityData,
  listSolicitudes,
  appendOrUpdateInvoice,
  getEmailByStripeCustomerId,
  getEmailByStripeSubscriptionId,
};