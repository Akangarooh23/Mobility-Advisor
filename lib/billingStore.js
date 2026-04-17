const fs = require("fs");
const path = require("path");
const {
  shouldUseSqlServerMobility,
  listGarageVehiclesByEmailSqlServer,
  addGarageVehicleByEmailSqlServer,
  removeGarageVehicleByEmailSqlServer,
  listAppointmentsByEmailSqlServer,
  addAppointmentByEmailSqlServer,
  listMaintenancesByEmailSqlServer,
  addMaintenanceByEmailSqlServer,
  listInsurancesByEmailSqlServer,
  upsertInsuranceByEmailSqlServer,
  listValuationsByEmailSqlServer,
  addValuationByEmailSqlServer,
  listVehicleStatesByEmailSqlServer,
  upsertVehicleStateByEmailSqlServer,
  listSavedOffersByEmailSqlServer,
  addSavedOfferByEmailSqlServer,
  removeSavedOfferByEmailSqlServer,
  getUserMobilityDataByEmailSqlServer,
} = require("./sqlserverMobilityStore");

const BILLING_STORE_PATH = path.join(__dirname, "..", "db", "billing-data.json");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
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
      ssl: { rejectUnauthorized: false },
    });
  }

  return _pgPool;
}

async function ensureMobilitySchemaPostgres() {
  if (_pgMobilitySchemaEnsured || !hasPostgresConnection()) {
    return;
  }

  const pool = getPgPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicles (
      id             VARCHAR(64)  PRIMARY KEY,
      user_email     VARCHAR(255) NOT NULL,
      title          VARCHAR(180) NOT NULL,
      brand          VARCHAR(100) NOT NULL,
      model          VARCHAR(120) NOT NULL,
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_files (
      id          BIGSERIAL    PRIMARY KEY,
      vehicle_id  VARCHAR(64)  NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
      file_type   VARCHAR(20)  NOT NULL CHECK (file_type IN ('photo', 'document')),
      file_name   VARCHAR(255) NOT NULL,
      file_size   BIGINT       NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ  NOT NULL
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_files_vehicle ON moveadvisor_user_vehicle_files (vehicle_id, file_type)"
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

async function listGarageVehiclesByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const vehiclesResult = await pool.query(
    `
      SELECT id, title, brand, model, year, plate, mileage, fuel, policy_company, notes, created_at
      FROM moveadvisor_user_vehicles
      WHERE user_email = $1
      ORDER BY created_at DESC
      LIMIT 20
    `,
    [normalizedEmail]
  );

  const vehicles = vehiclesResult.rows || [];

  if (vehicles.length === 0) {
    return [];
  }

  const vehicleIds = vehicles.map((item) => item.id);
  const filesResult = await pool.query(
    `
      SELECT vehicle_id, file_type, file_name, file_size
      FROM moveadvisor_user_vehicle_files
      WHERE vehicle_id = ANY($1::varchar[])
      ORDER BY id ASC
    `,
    [vehicleIds]
  );

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

  return vehicles.map((row) => {
    const files = filesByVehicleId[row.id] || { photos: [], documents: [] };
    return sanitizeGarageVehicle({
      id: row.id,
      title: row.title,
      brand: row.brand,
      model: row.model,
      year: row.year,
      plate: row.plate,
      mileage: row.mileage,
      fuel: row.fuel,
      policyCompany: row.policy_company,
      notes: row.notes,
      photos: files.photos,
      documents: files.documents,
      createdAt: row.created_at,
    });
  });
}

async function addGarageVehicleByEmailPostgres(email = "", vehicle = {}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedVehicle = sanitizeGarageVehicle(vehicle);

  if (!normalizedEmail || !normalizedVehicle.brand || !normalizedVehicle.model) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const vehicleId = normalizedVehicle.id || `garage-${Date.now()}`;
  const nowIso = new Date().toISOString();

  await pool.query(
    `
      INSERT INTO moveadvisor_user_vehicles (
        id, user_email, title, brand, model, year, plate, mileage, fuel, policy_company, notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12
      )
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
        title = EXCLUDED.title,
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        year = EXCLUDED.year,
        plate = EXCLUDED.plate,
        mileage = EXCLUDED.mileage,
        fuel = EXCLUDED.fuel,
        policy_company = EXCLUDED.policy_company,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at
    `,
    [
      vehicleId,
      normalizedEmail,
      normalizedVehicle.title,
      normalizedVehicle.brand,
      normalizedVehicle.model,
      normalizedVehicle.year,
      normalizedVehicle.plate,
      normalizedVehicle.mileage,
      normalizedVehicle.fuel,
      normalizedVehicle.policyCompany,
      normalizedVehicle.notes,
      nowIso,
    ]
  );

  await pool.query("DELETE FROM moveadvisor_user_vehicle_files WHERE vehicle_id = $1", [vehicleId]);

  const photoRows = Array.isArray(normalizedVehicle.photos) ? normalizedVehicle.photos : [];
  const docRows = Array.isArray(normalizedVehicle.documents) ? normalizedVehicle.documents : [];

  for (const photo of photoRows) {
    if (!normalizeText(photo?.name)) {
      continue;
    }

    await pool.query(
      `
        INSERT INTO moveadvisor_user_vehicle_files (vehicle_id, file_type, file_name, file_size, created_at)
        VALUES ($1, 'photo', $2, $3, $4)
      `,
      [vehicleId, normalizeText(photo.name), Number(photo.size || 0), nowIso]
    );
  }

  for (const doc of docRows) {
    if (!normalizeText(doc?.name)) {
      continue;
    }

    await pool.query(
      `
        INSERT INTO moveadvisor_user_vehicle_files (vehicle_id, file_type, file_name, file_size, created_at)
        VALUES ($1, 'document', $2, $3, $4)
      `,
      [vehicleId, normalizeText(doc.name), Number(doc.size || 0), nowIso]
    );
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
  await pool.query("DELETE FROM moveadvisor_user_vehicles WHERE id = $1 AND user_email = $2", [normalizedVehicleId, normalizedEmail]);
  return listGarageVehiclesByEmailPostgres(normalizedEmail);
}

async function listAppointmentsByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const result = await pool.query(
    `
      SELECT a.id, a.appointment_type, a.title, a.meta, a.status, a.requested_at_text,
             a.vehicle_id, v.title AS vehicle_title, v.plate AS vehicle_plate
      FROM moveadvisor_user_appointments a
      INNER JOIN moveadvisor_user_vehicles v ON v.id = a.vehicle_id
      WHERE a.user_email = $1
      ORDER BY a.created_at DESC
      LIMIT 30
    `,
    [normalizedEmail]
  );

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
  const vehicleCheck = await pool.query(
    "SELECT id FROM moveadvisor_user_vehicles WHERE id = $1 AND user_email = $2 LIMIT 1",
    [vehicleId, normalizedEmail]
  );

  if ((vehicleCheck.rows || []).length === 0) {
    return listAppointmentsByEmailPostgres(normalizedEmail);
  }

  const id = normalizeText(appointment?.id) || `appt-${Date.now()}`;
  const appointmentType = normalizeText(appointment?.type || "workshop") || "workshop";
  const nowIso = new Date().toISOString();

  await pool.query(
    `
      INSERT INTO moveadvisor_user_appointments (
        id, user_email, vehicle_id, appointment_type, title, meta, status, requested_at_text, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $9
      )
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
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
      vehicleId,
      appointmentType,
      normalizeText(appointment?.title || "Cita"),
      normalizeText(appointment?.meta),
      normalizeText(appointment?.status || "Pendiente"),
      normalizeText(appointment?.requestedAt) || toEsDateTimeText(nowIso),
      nowIso,
    ]
  );

  if (appointmentType === "maintenance") {
    await addMaintenanceByEmailPostgres(normalizedEmail, {
      id: `mnt-${id}`,
      vehicleId,
      type: "maintenance",
      title: normalizeText(appointment?.title || "Mantenimiento"),
      status: normalizeText(appointment?.status || "Pendiente"),
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

async function listInsurancesByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const result = await pool.query(
    `
      SELECT ins.id, ins.vehicle_id, ins.provider, ins.policy_number, ins.coverage_type,
             ins.status, ins.renewal_at_text, ins.monthly_premium, ins.notes,
             v.title AS vehicle_title, v.plate AS vehicle_plate
      FROM moveadvisor_user_insurances ins
      INNER JOIN moveadvisor_user_vehicles v ON v.id = ins.vehicle_id
      WHERE ins.user_email = $1
      ORDER BY ins.updated_at DESC
      LIMIT 30
    `,
    [normalizedEmail]
  );

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
  const vehicleCheck = await pool.query(
    "SELECT id FROM moveadvisor_user_vehicles WHERE id = $1 AND user_email = $2 LIMIT 1",
    [vehicleId, normalizedEmail]
  );

  if ((vehicleCheck.rows || []).length === 0) {
    return listInsurancesByEmailPostgres(normalizedEmail);
  }

  const nowIso = new Date().toISOString();
  const id = normalizeText(payload?.id) || `ins-${vehicleId}`;

  await pool.query(
    `
      INSERT INTO moveadvisor_user_insurances (
        id, user_email, vehicle_id, provider, policy_number, coverage_type, status,
        renewal_at_text, monthly_premium, notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11
      )
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
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
      WHERE user_email = $2 AND vehicle_id = $3 AND id <> $1
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
  const result = await pool.query(
    `
      SELECT m.id, m.vehicle_id, m.maintenance_type, m.title, m.status, m.scheduled_at_text,
             m.workshop_name, m.mileage_text, m.estimated_cost, m.notes,
             v.title AS vehicle_title, v.plate AS vehicle_plate
      FROM moveadvisor_user_maintenances m
      INNER JOIN moveadvisor_user_vehicles v ON v.id = m.vehicle_id
      WHERE m.user_email = $1
      ORDER BY m.created_at DESC
      LIMIT 50
    `,
    [normalizedEmail]
  );

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
  const vehicleCheck = await pool.query(
    "SELECT id, title FROM moveadvisor_user_vehicles WHERE id = $1 AND user_email = $2 LIMIT 1",
    [vehicleId, normalizedEmail]
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
        id, user_email, vehicle_id, maintenance_type, title, status,
        scheduled_at_text, workshop_name, mileage_text, estimated_cost, notes, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $12
      )
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
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

  return listMaintenancesByEmailPostgres(normalizedEmail);
}

async function listValuationsByEmailPostgres(email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const result = await pool.query(
    `
      SELECT val.id, val.title, val.meta, val.status, val.report, val.estimate_value,
             val.vehicle_id, v.title AS vehicle_title
      FROM moveadvisor_user_valuations val
      INNER JOIN moveadvisor_user_vehicles v ON v.id = val.vehicle_id
      WHERE val.user_email = $1
      ORDER BY val.created_at DESC
      LIMIT 30
    `,
    [normalizedEmail]
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
  }));
}

async function addValuationByEmailPostgres(email = "", valuation = {}) {
  const normalizedEmail = normalizeEmail(email);
  const vehicleId = normalizeText(valuation?.vehicleId);

  if (!normalizedEmail || !vehicleId) {
    return listValuationsByEmailPostgres(normalizedEmail);
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const vehicleCheck = await pool.query(
    "SELECT id, title FROM moveadvisor_user_vehicles WHERE id = $1 AND user_email = $2 LIMIT 1",
    [vehicleId, normalizedEmail]
  );

  const vehicle = (vehicleCheck.rows || [])[0];
  if (!vehicle) {
    return listValuationsByEmailPostgres(normalizedEmail);
  }

  const id = normalizeText(valuation?.id) || `valuation-${Date.now()}`;
  const nowIso = new Date().toISOString();

  await pool.query(
    `
      INSERT INTO moveadvisor_user_valuations (
        id, user_email, vehicle_id, title, meta, status, report, estimate_value, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $9
      )
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
        vehicle_id = EXCLUDED.vehicle_id,
        title = EXCLUDED.title,
        meta = EXCLUDED.meta,
        status = EXCLUDED.status,
        report = EXCLUDED.report,
        estimate_value = EXCLUDED.estimate_value,
        updated_at = EXCLUDED.updated_at
    `,
    [
      id,
      normalizedEmail,
      vehicleId,
      normalizeText(valuation?.title || vehicle.title || "Vehiculo en valoracion"),
      normalizeText(valuation?.meta),
      normalizeText(valuation?.status || "Ultima tasacion disponible"),
      normalizeText(valuation?.report),
      Number(valuation?.estimateValue || 0) || null,
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
  const result = await pool.query(
    `
      SELECT s.vehicle_id, s.state, s.listing_url, s.notes, s.updated_at,
             v.title, v.brand, v.model, v.year
      FROM moveadvisor_user_vehicle_states s
      INNER JOIN moveadvisor_user_vehicles v ON v.id = s.vehicle_id
      WHERE s.user_email = $1
      ORDER BY s.updated_at DESC
    `,
    [normalizedEmail]
  );

  return (result.rows || []).map((row) => ({
    vehicleId: normalizeText(row.vehicle_id),
    state: normalizeText(row.state),
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

  if (!normalizedEmail || !vehicleId || !["owned", "active_sale", "sold"].includes(state)) {
    return listVehicleStatesByEmailPostgres(normalizedEmail);
  }

  await ensureMobilitySchemaPostgres();
  const pool = getPgPool();
  const vehicleCheck = await pool.query(
    "SELECT id FROM moveadvisor_user_vehicles WHERE id = $1 AND user_email = $2 LIMIT 1",
    [vehicleId, normalizedEmail]
  );

  if ((vehicleCheck.rows || []).length === 0) {
    return listVehicleStatesByEmailPostgres(normalizedEmail);
  }

  const nowIso = new Date().toISOString();

  await pool.query(
    `
      INSERT INTO moveadvisor_user_vehicle_states (user_email, vehicle_id, state, listing_url, notes, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_email, vehicle_id) DO UPDATE SET
        state = EXCLUDED.state,
        listing_url = EXCLUDED.listing_url,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at
    `,
    [normalizedEmail, vehicleId, state, normalizeText(payload?.listingUrl), normalizeText(payload?.notes), nowIso]
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
  const result = await pool.query(
    `
      SELECT id, vehicle_id, title, offer_payload
      FROM moveadvisor_user_saved_offers
      WHERE user_email = $1
      ORDER BY created_at DESC
      LIMIT 40
    `,
    [normalizedEmail]
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
  const nowIso = new Date().toISOString();
  const vehicleId = normalizeText(payload?.vehicleId) || null;

  await pool.query(
    `
      INSERT INTO moveadvisor_user_saved_offers (id, user_email, vehicle_id, title, offer_payload, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
      ON CONFLICT (id) DO UPDATE SET
        user_email = EXCLUDED.user_email,
        vehicle_id = EXCLUDED.vehicle_id,
        title = EXCLUDED.title,
        offer_payload = EXCLUDED.offer_payload,
        updated_at = EXCLUDED.updated_at
    `,
    [id, normalizedEmail, vehicleId, normalizeText(payload?.title), JSON.stringify(payload || {}), nowIso]
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
  await pool.query("DELETE FROM moveadvisor_user_saved_offers WHERE user_email = $1 AND id = $2", [normalizedEmail, id]);
  return listSavedOffersByEmailPostgres(normalizedEmail);
}

async function getUserMobilityDataByEmailPostgres(email = "") {
  return {
    vehicles: await listGarageVehiclesByEmailPostgres(email),
    appointments: await listAppointmentsByEmailPostgres(email),
    maintenances: await listMaintenancesByEmailPostgres(email),
    insurances: await listInsurancesByEmailPostgres(email),
    valuations: await listValuationsByEmailPostgres(email),
    vehicleStates: await listVehicleStatesByEmailPostgres(email),
    savedOffers: await listSavedOffersByEmailPostgres(email),
  };
}

function sanitizeGarageAttachment(input = {}) {
  return {
    name: normalizeText(input?.name),
    size: Number(input?.size || 0),
  };
}

function sanitizeGarageVehicle(input = {}) {
  const brand = normalizeText(input?.brand);
  const model = normalizeText(input?.model);
  const title = normalizeText(input?.title) || `${brand} ${model}`.trim();
  const photos = Array.isArray(input?.photos)
    ? input.photos.map((item) => sanitizeGarageAttachment(item)).filter((item) => item.name)
    : [];
  const documents = Array.isArray(input?.documents)
    ? input.documents.map((item) => sanitizeGarageAttachment(item)).filter((item) => item.name)
    : [];

  return {
    id: normalizeText(input?.id),
    title,
    brand,
    model,
    year: normalizeText(input?.year),
    plate: normalizeText(input?.plate),
    mileage: normalizeText(input?.mileage),
    fuel: normalizeText(input?.fuel),
    policyCompany: normalizeText(input?.policyCompany),
    notes: normalizeText(input?.notes),
    photos: photos.slice(0, 30),
    documents: documents.slice(0, 30),
    createdAt: normalizeText(input?.createdAt) || new Date().toISOString(),
  };
}

function getSeedGarageVehicles(email = "") {
  if (normalizeEmail(email) !== "anapicazoh@gmail.com") {
    return [];
  }

  return [
    {
      id: "garage-seed-audi-a3-sportback-s-line",
      title: "Audi A3 Sportback S line",
      brand: "Audi",
      model: "A3 Sportback S line",
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

function ensureStoreDirectory() {
  const dirPath = path.dirname(BILLING_STORE_PATH);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
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

function readStore() {
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

function writeStore(nextStore) {
  ensureStoreDirectory();

  const safeStore = {
    customersByEmail: nextStore?.customersByEmail || {},
    stripeCustomerToEmail: nextStore?.stripeCustomerToEmail || {},
    stripeSubscriptionToEmail: nextStore?.stripeSubscriptionToEmail || {},
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(BILLING_STORE_PATH, JSON.stringify(safeStore, null, 2));
  return safeStore;
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
      planId: "gratis",
      planLabel: "Plan Gratis",
      status: "inactivo",
      nextBillingDate: "",
      stripeCustomerId: "",
      stripeSubscriptionId: "",
      invoices: [
        {
          id: "demo-invoice-001",
          number: "MA-2026-001",
          date: "2026-04-01",
          amount: 0,
          status: "Pagada",
          pdfUrl: "",
        },
      ],
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
    try {
      return listGarageVehiclesByEmailSqlServer(email);
    } catch {
      // Fallback to next provider.
    }
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

async function addGarageVehicleByEmail(email = "", vehicle = {}) {
  if (shouldUseSqlServerMobility()) {
    try {
      return addGarageVehicleByEmailSqlServer(email, vehicle);
    } catch {
      // Fallback to next provider.
    }
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
    try {
      return removeGarageVehicleByEmailSqlServer(email, vehicleId);
    } catch {
      // Fallback to next provider.
    }
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
      return listAppointmentsByEmailSqlServer(email);
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
      return addAppointmentByEmailSqlServer(email, appointment);
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

async function listValuationsByEmail(email = "") {
  if (shouldUseSqlServerMobility()) {
    try {
      return listValuationsByEmailSqlServer(email);
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
      return listMaintenancesByEmailSqlServer(email);
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
    try {
      return addMaintenanceByEmailSqlServer(email, payload);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await addMaintenanceByEmailPostgres(email, payload);
    } catch {
      return [];
    }
  }

  return [];
}

async function listInsurancesByEmail(email = "") {
  if (shouldUseSqlServerMobility()) {
    try {
      return listInsurancesByEmailSqlServer(email);
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
    try {
      return upsertInsuranceByEmailSqlServer(email, payload);
    } catch {
      return [];
    }
  }

  if (hasPostgresConnection()) {
    try {
      return await upsertInsuranceByEmailPostgres(email, payload);
    } catch {
      return [];
    }
  }

  return [];
}

async function addValuationByEmail(email = "", valuation = {}) {
  if (shouldUseSqlServerMobility()) {
    try {
      return addValuationByEmailSqlServer(email, valuation);
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
      return listVehicleStatesByEmailSqlServer(email);
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
      return upsertVehicleStateByEmailSqlServer(email, payload);
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
      return listSavedOffersByEmailSqlServer(email);
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
      return addSavedOfferByEmailSqlServer(email, payload);
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
      return removeSavedOfferByEmailSqlServer(email, offerId);
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
      return getUserMobilityDataByEmailSqlServer(email);
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
  };
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

module.exports = {
  resolveAccountByEmail,
  updateProfile,
  updateBillingState,
  listGarageVehiclesByEmail,
  addGarageVehicleByEmail,
  removeGarageVehicleByEmail,
  listAppointmentsByEmail,
  addAppointmentByEmail,
  listMaintenancesByEmail,
  addMaintenanceByEmail,
  listInsurancesByEmail,
  upsertInsuranceByEmail,
  listValuationsByEmail,
  addValuationByEmail,
  listVehicleStatesByEmail,
  upsertVehicleStateByEmail,
  listSavedOffersByEmail,
  addSavedOfferByEmail,
  removeSavedOfferByEmail,
  getUserMobilityDataByEmail,
  appendOrUpdateInvoice,
  getEmailByStripeCustomerId,
  getEmailByStripeSubscriptionId,
};