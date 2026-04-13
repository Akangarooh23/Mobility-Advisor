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

function readDefaultCatalogMap() {
  try {
    const raw = fs.readFileSync(DEFAULT_CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce((acc, [brandName, models]) => {
      const cleanBrand = normalizeText(brandName);

      if (!cleanBrand || !Array.isArray(models)) {
        return acc;
      }

      const cleanModels = Array.from(
        new Set(
          models
            .map((modelName) => normalizeText(modelName))
            .filter(Boolean)
        )
      );

      if (cleanModels.length > 0) {
        acc[cleanBrand] = cleanModels;
      }

      return acc;
    }, {});
  } catch {
    return {};
  }
}

function mapToBrandRows(catalogMap = {}) {
  return Object.keys(catalogMap)
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((brandName) => ({
      name: brandName,
      models: [...(catalogMap[brandName] || [])].sort((a, b) => a.localeCompare(b, "es")),
    }));
}

function parseSqlcmdJsonOutput(rawOutput = "") {
  const output = String(rawOutput || "");
  const firstJsonChar = output.search(/[\[{]/);

  if (firstJsonChar === -1) {
    return null;
  }

  const jsonStart = output[firstJsonChar];
  const jsonEnd = jsonStart === "[" ? "]" : "}";
  const lastJsonChar = output.lastIndexOf(jsonEnd);

  if (lastJsonChar === -1 || lastJsonChar < firstJsonChar) {
    return null;
  }

  const jsonChunk = output.slice(firstJsonChar, lastJsonChar + 1).trim();

  try {
    return JSON.parse(jsonChunk);
  } catch {
    return null;
  }
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

let _pgCatalogSchemaEnsured = false;

async function ensureCatalogSchemaPostgres() {
  if (_pgCatalogSchemaEnsured) return;
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
  _pgCatalogSchemaEnsured = true;
}

async function seedCatalogIfEmptyPostgres(defaultCatalogMap = {}) {
  const pool = getPgPool();
  const { rows } = await pool.query("SELECT COUNT(*)::int AS total FROM moveadvisor_vehicle_brands");
  const total = Number(rows[0]?.total || 0);

  if (total > 0 || Object.keys(defaultCatalogMap).length === 0) {
    return;
  }

  for (const [brandName, models] of Object.entries(defaultCatalogMap)) {
    await pool.query(
      `INSERT INTO moveadvisor_vehicle_brands (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [brandName]
    );
    const brandResult = await pool.query(
      `SELECT id FROM moveadvisor_vehicle_brands WHERE name = $1 LIMIT 1`,
      [brandName]
    );
    const brandId = brandResult.rows[0]?.id;
    if (!brandId) continue;

    for (const modelName of Array.isArray(models) ? models : []) {
      await pool.query(
        `INSERT INTO moveadvisor_vehicle_models (brand_id, name) VALUES ($1, $2) ON CONFLICT (brand_id, name) DO NOTHING`,
        [brandId, modelName]
      );
    }
  }
}

async function getCatalogFromPostgres(defaultCatalogMap = {}) {
  await ensureCatalogSchemaPostgres();
  await seedCatalogIfEmptyPostgres(defaultCatalogMap);
  const pool = getPgPool();

  const { rows } = await pool.query(`
    SELECT b.name AS brand, m.name AS model
    FROM moveadvisor_vehicle_brands b
    LEFT JOIN moveadvisor_vehicle_models m ON m.brand_id = b.id AND m.is_active = TRUE
    WHERE b.is_active = TRUE
    ORDER BY b.sort_order ASC, b.name ASC, m.sort_order ASC, m.name ASC
  `);

  const brandMap = {};

  for (const row of rows) {
    const brand = normalizeText(row?.brand);
    const model = normalizeText(row?.model);
    if (!brand) continue;
    if (!brandMap[brand]) brandMap[brand] = [];
    if (model && !brandMap[brand].includes(model)) brandMap[brand].push(model);
  }

  return brandMap;
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

function buildSqlSeedStatement(catalogMap = {}) {
  const statements = [];

  for (const [brandName, models] of Object.entries(catalogMap)) {
    const safeBrand = brandName.replace(/'/g, "''");

    statements.push(`IF NOT EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleBrands WHERE Name = N'${safeBrand}') INSERT INTO dbo.MoveAdvisorVehicleBrands (Name) VALUES (N'${safeBrand}');`);

    for (const modelName of models) {
      const safeModel = modelName.replace(/'/g, "''");
      statements.push(`
IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleBrands WHERE Name = N'${safeBrand}')
AND NOT EXISTS (
  SELECT 1
  FROM dbo.MoveAdvisorVehicleModels m
  INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId
  WHERE b.Name = N'${safeBrand}' AND m.Name = N'${safeModel}'
)
BEGIN
  INSERT INTO dbo.MoveAdvisorVehicleModels (BrandId, Name)
  SELECT TOP 1 b.Id, N'${safeModel}'
  FROM dbo.MoveAdvisorVehicleBrands b
  WHERE b.Name = N'${safeBrand}';
END;
`);
    }
  }

  return statements.join("\n");
}

async function ensureCatalogTablesAndSeedMssql(defaultCatalogMap = {}) {
  const pool = await getMssqlPool();
  await pool.request().query(TABLE_SETUP_QUERY);

  const totalBrandsResult = await pool.request().query("SELECT COUNT(1) AS total FROM dbo.MoveAdvisorVehicleBrands");
  const totalBrands = Number(totalBrandsResult.recordset?.[0]?.total || 0);

  if (totalBrands === 0 && Object.keys(defaultCatalogMap).length > 0) {
    await pool.request().query(buildSqlSeedStatement(defaultCatalogMap));
  }
}

function ensureCatalogTablesAndSeedSqlcmd(defaultCatalogMap = {}) {
  runSqlcmd(TABLE_SETUP_QUERY);

  const totalBrandsOutput = runSqlcmd("SELECT COUNT(1) AS total FROM dbo.MoveAdvisorVehicleBrands FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;");
  const totalBrands = Number(parseSqlcmdJsonOutput(totalBrandsOutput)?.total || 0);

  if (totalBrands === 0 && Object.keys(defaultCatalogMap).length > 0) {
    runSqlcmd(buildSqlSeedStatement(defaultCatalogMap));
  }
}

async function getCatalogFromMssql(defaultCatalogMap = {}) {
  await ensureCatalogTablesAndSeedMssql(defaultCatalogMap);
  const pool = await getMssqlPool();

  const result = await pool.request().query(`
    SELECT
      b.Name AS brand,
      m.Name AS model
    FROM dbo.MoveAdvisorVehicleBrands b
    LEFT JOIN dbo.MoveAdvisorVehicleModels m ON m.BrandId = b.Id AND m.IsActive = 1
    WHERE b.IsActive = 1
    ORDER BY b.SortOrder ASC, b.Name ASC, m.SortOrder ASC, m.Name ASC;
  `);

  const brandMap = {};

  for (const row of result.recordset || []) {
    const brand = normalizeText(row?.brand);
    const model = normalizeText(row?.model);

    if (!brand) {
      continue;
    }

    if (!brandMap[brand]) {
      brandMap[brand] = [];
    }

    if (model && !brandMap[brand].includes(model)) {
      brandMap[brand].push(model);
    }
  }

  return brandMap;
}

function getCatalogFromSqlcmd(defaultCatalogMap = {}) {
  ensureCatalogTablesAndSeedSqlcmd(defaultCatalogMap);

  const output = runSqlcmd(`
    SELECT
      b.Name AS brand,
      m.Name AS model
    FROM dbo.MoveAdvisorVehicleBrands b
    LEFT JOIN dbo.MoveAdvisorVehicleModels m ON m.BrandId = b.Id AND m.IsActive = 1
    WHERE b.IsActive = 1
    ORDER BY b.SortOrder ASC, b.Name ASC, m.SortOrder ASC, m.Name ASC
    FOR JSON PATH;
  `);

  const rows = parseSqlcmdJsonOutput(output);
  const brandMap = {};

  for (const row of Array.isArray(rows) ? rows : []) {
    const brand = normalizeText(row?.brand);
    const model = normalizeText(row?.model);

    if (!brand) {
      continue;
    }

    if (!brandMap[brand]) {
      brandMap[brand] = [];
    }

    if (model && !brandMap[brand].includes(model)) {
      brandMap[brand].push(model);
    }
  }

  return brandMap;
}

module.exports = async function vehicleCatalogHandler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const defaultCatalogMap = readDefaultCatalogMap();
  const provider = getCatalogProvider();

  try {
    if (provider === "mssql") {
      const catalogMap = await getCatalogFromMssql(defaultCatalogMap);
      return res.status(200).json({
        ok: true,
        provider,
        source: "database",
        brands: mapToBrandRows(catalogMap),
      });
    }

    if (provider === "sqlcmd-windows") {
      const catalogMap = getCatalogFromSqlcmd(defaultCatalogMap);
      return res.status(200).json({
        ok: true,
        provider,
        source: "database",
        brands: mapToBrandRows(catalogMap),
      });
    }

    if (provider === "postgres") {
      const catalogMap = await getCatalogFromPostgres(defaultCatalogMap);
      return res.status(200).json({
        ok: true,
        provider,
        source: "database",
        brands: mapToBrandRows(catalogMap),
      });
    }

    return res.status(200).json({
      ok: true,
      provider,
      source: "local-file",
      brands: mapToBrandRows(defaultCatalogMap),
    });
  } catch (error) {
    return res.status(200).json({
      ok: true,
      provider,
      source: "local-file-fallback",
      warning: error instanceof Error ? error.message : "No se pudo cargar catalogo desde base de datos.",
      brands: mapToBrandRows(defaultCatalogMap),
    });
  }
};
