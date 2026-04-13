const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// mssql is only needed when VEHICLE_CATALOG_PROVIDER=mssql; lazy-load to avoid crashing on Vercel
function getMssqlModule() {
  return require("mssql");
}

// Neon injects DATABASE_URL; map to POSTGRES_URL early
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL;
}

const DEFAULT_CATALOG_PATH = path.join(__dirname, "..", "data", "vehicle-catalog.json");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getCatalogProvider() {
  const provider = normalizeText(process.env.VEHICLE_CATALOG_PROVIDER || process.env.AUTH_PROVIDER).toLowerCase();

  if (["mssql", "sqlserver"].includes(provider)) {
    return "mssql";
  }

  if (["sqlcmd-windows", "windows", "mssql-windows"].includes(provider)) {
    return "sqlcmd-windows";
  }

  if (["postgres", "postgresql", "neon", "vercel-postgres"].includes(provider)) {
    return "postgres";
  }

  if (normalizeText(process.env.POSTGRES_URL) || normalizeText(process.env.DATABASE_URL)) {
    return "postgres";
  }

  if (normalizeText(process.env.MSSQL_SERVER)) {
    return "mssql";
  }

  return "local";
}

function getSqlcmdPath() {
  return normalizeText(process.env.SQLCMD_PATH) || "sqlcmd";
}

function getSqlcmdConnectionArgs() {
  const server = normalizeText(process.env.MSSQL_SERVER) || "localhost\\SQLEXPRESS";
  const dbName = normalizeText(process.env.MSSQL_DATABASE) || "Mobilityadvisor";

  return ["-S", server, "-d", dbName, "-E", "-b", "-y", "0"];
}

function runSqlcmd(query) {
  const args = [...getSqlcmdConnectionArgs(), "-Q", query];
  return execFileSync(getSqlcmdPath(), args, { encoding: "utf8" });
}

let mssqlPoolPromise = null;

function getMssqlConfig() {
  const server = normalizeText(process.env.MSSQL_SERVER);
  const database = normalizeText(process.env.MSSQL_DATABASE);
  const user = normalizeText(process.env.MSSQL_USER);
  const password = normalizeText(process.env.MSSQL_PASSWORD);

  if (!server || !database || !user || !password) {
    throw new Error("Falta configurar MSSQL_SERVER, MSSQL_DATABASE, MSSQL_USER o MSSQL_PASSWORD.");
  }

  const port = Number(process.env.MSSQL_PORT || 1433);
  const encrypt = String(process.env.MSSQL_ENCRYPT || "true").toLowerCase() !== "false";
  const trustServerCertificate = String(process.env.MSSQL_TRUST_SERVER_CERTIFICATE || "true").toLowerCase() !== "false";

  return {
    server,
    database,
    user,
    password,
    port: Number.isFinite(port) ? port : 1433,
    options: { encrypt, trustServerCertificate },
    pool: { max: 3, min: 0, idleTimeoutMillis: 15000 },
  };
}

async function getMssqlPool() {
  if (!mssqlPoolPromise) {
    const sql = getMssqlModule();
    mssqlPoolPromise = sql.connect(getMssqlConfig());
  }

  return mssqlPoolPromise;
}

// ─── PostgreSQL (Neon / Vercel Postgres) ──────────────────────────────────────

let _pgPool = null;

function getPgPool() {
  if (!_pgPool) {
    const { Pool } = require("pg");
    const connString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connString) {
      throw new Error("No DATABASE_URL o POSTGRES_URL configurados para conexión PostgreSQL");
    }
    _pgPool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  }
  return _pgPool;
}

let _pgAdminSchemaEnsured = false;

async function ensureCatalogSchemaPostgres() {
  if (_pgAdminSchemaEnsured) return;
  const pool = getPgPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_brands (
      id         SERIAL       PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
      sort_order INT          NOT NULL DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_brands_name
    ON moveadvisor_vehicle_brands (name)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_models (
      id         SERIAL       PRIMARY KEY,
      brand_id   INT          NOT NULL REFERENCES moveadvisor_vehicle_brands(id),
      name       VARCHAR(120) NOT NULL,
      is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
      sort_order INT          NOT NULL DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_models_brand_name
    ON moveadvisor_vehicle_models (brand_id, name)
  `);
  _pgAdminSchemaEnsured = true;
}

async function applyPostgresAction(action, brand, model) {
  await ensureCatalogSchemaPostgres();
  const pool = getPgPool();

  if (action === "upsert_brand") {
    await pool.query(
      `INSERT INTO moveadvisor_vehicle_brands (name, is_active)
       VALUES ($1, TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE`,
      [brand]
    );
    return;
  }

  if (action === "upsert_model") {
    await pool.query(
      `INSERT INTO moveadvisor_vehicle_brands (name, is_active)
       VALUES ($1, TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE`,
      [brand]
    );
    const brandResult = await pool.query(
      `SELECT id FROM moveadvisor_vehicle_brands WHERE name = $1 LIMIT 1`,
      [brand]
    );
    const brandId = brandResult.rows[0]?.id;
    if (!brandId) return;
    await pool.query(
      `INSERT INTO moveadvisor_vehicle_models (brand_id, name, is_active)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (brand_id, name) DO UPDATE SET is_active = TRUE`,
      [brandId, model]
    );
    return;
  }

  if (action === "delete_model") {
    await pool.query(
      `UPDATE moveadvisor_vehicle_models m
       SET is_active = FALSE
       FROM moveadvisor_vehicle_brands b
       WHERE m.brand_id = b.id AND b.name = $1 AND m.name = $2`,
      [brand, model]
    );
    return;
  }

  if (action === "delete_brand") {
    await pool.query(
      `UPDATE moveadvisor_vehicle_models m
       SET is_active = FALSE
       FROM moveadvisor_vehicle_brands b
       WHERE m.brand_id = b.id AND b.name = $1`,
      [brand]
    );
    await pool.query(
      `UPDATE moveadvisor_vehicle_brands SET is_active = FALSE WHERE name = $1`,
      [brand]
    );
  }
}

const TABLE_SETUP_QUERY = `
IF OBJECT_ID(N'dbo.MoveAdvisorVehicleBrands', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorVehicleBrands (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_MoveAdvisorVehicleBrands_IsActive DEFAULT (1),
    SortOrder INT NOT NULL CONSTRAINT DF_MoveAdvisorVehicleBrands_SortOrder DEFAULT (0)
  );

  CREATE UNIQUE INDEX IX_MoveAdvisorVehicleBrands_Name ON dbo.MoveAdvisorVehicleBrands (Name);
END;

IF OBJECT_ID(N'dbo.MoveAdvisorVehicleModels', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorVehicleModels (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    BrandId INT NOT NULL,
    Name NVARCHAR(120) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_MoveAdvisorVehicleModels_IsActive DEFAULT (1),
    SortOrder INT NOT NULL CONSTRAINT DF_MoveAdvisorVehicleModels_SortOrder DEFAULT (0),
    CONSTRAINT FK_MoveAdvisorVehicleModels_Brand FOREIGN KEY (BrandId) REFERENCES dbo.MoveAdvisorVehicleBrands(Id)
  );

  CREATE UNIQUE INDEX IX_MoveAdvisorVehicleModels_BrandId_Name ON dbo.MoveAdvisorVehicleModels (BrandId, Name);
END;
`;

async function ensureCatalogTablesMssql() {
  const pool = await getMssqlPool();
  await pool.request().query(TABLE_SETUP_QUERY);
}

function ensureCatalogTablesSqlcmd() {
  runSqlcmd(TABLE_SETUP_QUERY);
}

function readLocalCatalogMap() {
  try {
    const raw = fs.readFileSync(DEFAULT_CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalCatalogMap(map = {}) {
  const safeMap = Object.entries(map).reduce((acc, [brand, models]) => {
    const brandName = normalizeText(brand);
    if (!brandName) {
      return acc;
    }

    const safeModels = Array.from(
      new Set((Array.isArray(models) ? models : []).map((modelName) => normalizeText(modelName)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "es"));

    acc[brandName] = safeModels;
    return acc;
  }, {});

  fs.writeFileSync(DEFAULT_CATALOG_PATH, JSON.stringify(safeMap, null, 2), "utf8");
}

async function applyMssqlAction(action, brand, model) {
  await ensureCatalogTablesMssql();
  const pool = await getMssqlPool();
  const safeBrand = brand.replace(/'/g, "''");
  const safeModel = model.replace(/'/g, "''");

  if (action === "upsert_brand") {
    await pool.request().query(`
      IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleBrands WHERE Name = N'${safeBrand}')
        UPDATE dbo.MoveAdvisorVehicleBrands SET IsActive = 1 WHERE Name = N'${safeBrand}';
      ELSE
        INSERT INTO dbo.MoveAdvisorVehicleBrands (Name, IsActive) VALUES (N'${safeBrand}', 1);
    `);
    return;
  }

  if (action === "upsert_model") {
    await pool.request().query(`
      IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleBrands WHERE Name = N'${safeBrand}')
        UPDATE dbo.MoveAdvisorVehicleBrands SET IsActive = 1 WHERE Name = N'${safeBrand}';
      ELSE
        INSERT INTO dbo.MoveAdvisorVehicleBrands (Name, IsActive) VALUES (N'${safeBrand}', 1);

      IF EXISTS (
        SELECT 1
        FROM dbo.MoveAdvisorVehicleModels m
        INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId
        WHERE b.Name = N'${safeBrand}' AND m.Name = N'${safeModel}'
      )
        UPDATE m SET IsActive = 1
        FROM dbo.MoveAdvisorVehicleModels m
        INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId
        WHERE b.Name = N'${safeBrand}' AND m.Name = N'${safeModel}';
      ELSE
        INSERT INTO dbo.MoveAdvisorVehicleModels (BrandId, Name, IsActive)
        SELECT TOP 1 b.Id, N'${safeModel}', 1
        FROM dbo.MoveAdvisorVehicleBrands b
        WHERE b.Name = N'${safeBrand}';
    `);
    return;
  }

  if (action === "delete_model") {
    await pool.request().query(`
      UPDATE m
      SET m.IsActive = 0
      FROM dbo.MoveAdvisorVehicleModels m
      INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId
      WHERE b.Name = N'${safeBrand}' AND m.Name = N'${safeModel}';
    `);
    return;
  }

  if (action === "delete_brand") {
    await pool.request().query(`
      UPDATE b
      SET b.IsActive = 0
      FROM dbo.MoveAdvisorVehicleBrands b
      WHERE b.Name = N'${safeBrand}';

      UPDATE m
      SET m.IsActive = 0
      FROM dbo.MoveAdvisorVehicleModels m
      INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId
      WHERE b.Name = N'${safeBrand}';
    `);
  }
}

function applySqlcmdAction(action, brand, model) {
  ensureCatalogTablesSqlcmd();
  const safeBrand = brand.replace(/'/g, "''");
  const safeModel = model.replace(/'/g, "''");

  if (action === "upsert_brand") {
    runSqlcmd(`
      IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleBrands WHERE Name = N'${safeBrand}')
        UPDATE dbo.MoveAdvisorVehicleBrands SET IsActive = 1 WHERE Name = N'${safeBrand}';
      ELSE
        INSERT INTO dbo.MoveAdvisorVehicleBrands (Name, IsActive) VALUES (N'${safeBrand}', 1);
    `);
    return;
  }

  if (action === "upsert_model") {
    runSqlcmd(`
      IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleBrands WHERE Name = N'${safeBrand}')
        UPDATE dbo.MoveAdvisorVehicleBrands SET IsActive = 1 WHERE Name = N'${safeBrand}';
      ELSE
        INSERT INTO dbo.MoveAdvisorVehicleBrands (Name, IsActive) VALUES (N'${safeBrand}', 1);

      IF EXISTS (
        SELECT 1
        FROM dbo.MoveAdvisorVehicleModels m
        INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId
        WHERE b.Name = N'${safeBrand}' AND m.Name = N'${safeModel}'
      )
        UPDATE m SET IsActive = 1
        FROM dbo.MoveAdvisorVehicleModels m
        INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId
        WHERE b.Name = N'${safeBrand}' AND m.Name = N'${safeModel}';
      ELSE
        INSERT INTO dbo.MoveAdvisorVehicleModels (BrandId, Name, IsActive)
        SELECT TOP 1 b.Id, N'${safeModel}', 1
        FROM dbo.MoveAdvisorVehicleBrands b
        WHERE b.Name = N'${safeBrand}';
    `);
    return;
  }

  if (action === "delete_model") {
    runSqlcmd(`
      UPDATE m
      SET m.IsActive = 0
      FROM dbo.MoveAdvisorVehicleModels m
      INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId
      WHERE b.Name = N'${safeBrand}' AND m.Name = N'${safeModel}';
    `);
    return;
  }

  if (action === "delete_brand") {
    runSqlcmd(`
      UPDATE b
      SET b.IsActive = 0
      FROM dbo.MoveAdvisorVehicleBrands b
      WHERE b.Name = N'${safeBrand}';

      UPDATE m
      SET m.IsActive = 0
      FROM dbo.MoveAdvisorVehicleModels m
      INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId
      WHERE b.Name = N'${safeBrand}';
    `);
  }
}

function applyLocalAction(action, brand, model) {
  const map = readLocalCatalogMap();

  if (action === "upsert_brand") {
    if (!Array.isArray(map[brand])) {
      map[brand] = [];
    }
  }

  if (action === "upsert_model") {
    if (!Array.isArray(map[brand])) {
      map[brand] = [];
    }

    if (!map[brand].includes(model)) {
      map[brand].push(model);
    }
  }

  if (action === "delete_model") {
    if (Array.isArray(map[brand])) {
      map[brand] = map[brand].filter((entry) => normalizeText(entry) !== model);
    }
  }

  if (action === "delete_brand") {
    delete map[brand];
  }

  writeLocalCatalogMap(map);
}

module.exports = async function vehicleCatalogAdminHandler(req, res) {
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = normalizeText(req?.body?.action).toLowerCase();
  const brand = normalizeText(req?.body?.brand);
  const model = normalizeText(req?.body?.model);
  const provider = getCatalogProvider();

  if (!["upsert_brand", "upsert_model", "delete_model", "delete_brand"].includes(action)) {
    return res.status(400).json({ ok: false, error: "Accion no valida para catalogo." });
  }

  if (!brand) {
    return res.status(400).json({ ok: false, error: "La marca es obligatoria." });
  }

  if (["upsert_model", "delete_model"].includes(action) && !model) {
    return res.status(400).json({ ok: false, error: "El modelo es obligatorio para esta accion." });
  }

  try {
    if (provider === "mssql") {
      await applyMssqlAction(action, brand, model);
    } else if (provider === "sqlcmd-windows") {
      applySqlcmdAction(action, brand, model);
    } else if (provider === "postgres") {
      await applyPostgresAction(action, brand, model);
    } else {
      applyLocalAction(action, brand, model);
    }

    return res.status(200).json({ ok: true, provider, action, brand, model: model || "" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      provider,
      error: error instanceof Error ? error.message : "No se pudo actualizar el catalogo.",
    });
  }
};
