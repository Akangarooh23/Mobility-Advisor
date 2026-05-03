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

function mergeCatalogMaps(primaryMap = {}, secondaryMap = {}) {
  const merged = {};
  const allBrands = new Set([
    ...Object.keys(secondaryMap || {}),
    ...Object.keys(primaryMap || {}),
  ]);

  for (const brandName of allBrands) {
    const primaryModels = Array.isArray(primaryMap?.[brandName]) ? primaryMap[brandName] : [];
    const secondaryModels = Array.isArray(secondaryMap?.[brandName]) ? secondaryMap[brandName] : [];
    const mergedModels = Array.from(new Set([...secondaryModels, ...primaryModels].map((model) => normalizeText(model)).filter(Boolean)));

    if (mergedModels.length > 0) {
      merged[brandName] = mergedModels;
    }
  }

  return merged;
}

function mapToBrandRows(catalogMap = {}) {
  return Object.keys(catalogMap)
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((brandName) => ({
      name: brandName,
      models: [...(catalogMap[brandName] || [])].sort((a, b) => a.localeCompare(b, "es")),
    }));
}

function mapCoverageRowsToBrandMap(rows = []) {
  const coverageMap = {};

  for (const row of Array.isArray(rows) ? rows : []) {
    const brand = normalizeText(row?.brand);
    const model = normalizeText(row?.model);
    if (!brand || !model) {
      continue;
    }

    if (!Array.isArray(coverageMap[brand])) {
      coverageMap[brand] = [];
    }

    if (!coverageMap[brand].includes(model)) {
      coverageMap[brand].push(model);
    }
  }

  return coverageMap;
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

async function getModelCoverageFromMssql() {
  const pool = await getMssqlPool();

  const result = await pool.request().query(`
    SELECT
      Brand AS brand,
      Model AS model,
      COUNT(1) AS matches
    FROM dbo.MoveAdvisorMarketOffers
    WHERE LTRIM(RTRIM(COALESCE(Brand, N''))) <> N''
      AND LTRIM(RTRIM(COALESCE(Model, N''))) <> N''
    GROUP BY Brand, Model
    ORDER BY Brand ASC, COUNT(1) DESC, Model ASC;
  `);

  return mapCoverageRowsToBrandMap(result.recordset || []);
}

function getModelCoverageFromSqlcmd() {
  const output = runSqlcmd(`
    SELECT
      Brand AS brand,
      Model AS model,
      COUNT(1) AS matches
    FROM dbo.MoveAdvisorMarketOffers
    WHERE LTRIM(RTRIM(COALESCE(Brand, N''))) <> N''
      AND LTRIM(RTRIM(COALESCE(Model, N''))) <> N''
    GROUP BY Brand, Model
    ORDER BY Brand ASC, COUNT(1) DESC, Model ASC
    FOR JSON PATH;
  `);

  return mapCoverageRowsToBrandMap(parseSqlcmdJsonOutput(output));
}

async function getModelCoverageFromPostgres() {
  const pool = getPgPool();
  const { rows } = await pool.query(`
    SELECT
      TRIM(brand) AS brand,
      TRIM(model) AS model,
      COUNT(*)::int AS matches
    FROM moveadvisor_market_offers
    WHERE TRIM(COALESCE(brand, '')) <> ''
      AND TRIM(COALESCE(model, '')) <> ''
    GROUP BY TRIM(brand), TRIM(model)
    ORDER BY TRIM(brand) ASC, COUNT(*) DESC, TRIM(model) ASC
  `);

  return mapCoverageRowsToBrandMap(rows || []);
}

// ── Admin (write) helpers ──────────────────────────────────────────────────

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
    if (!brandName) return acc;
    const safeModels = Array.from(
      new Set((Array.isArray(models) ? models : []).map((m) => normalizeText(m)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "es"));
    acc[brandName] = safeModels;
    return acc;
  }, {});
  fs.writeFileSync(DEFAULT_CATALOG_PATH, JSON.stringify(safeMap, null, 2), "utf8");
}

async function applyPostgresAction(action, brand, model) {
  await ensureCatalogSchemaPostgres();
  const pool = getPgPool();
  if (action === "upsert_brand") {
    await pool.query(`INSERT INTO moveadvisor_vehicle_brands (name, is_active) VALUES ($1, TRUE) ON CONFLICT (name) DO UPDATE SET is_active = TRUE`, [brand]);
    return;
  }
  if (action === "upsert_model") {
    await pool.query(`INSERT INTO moveadvisor_vehicle_brands (name, is_active) VALUES ($1, TRUE) ON CONFLICT (name) DO UPDATE SET is_active = TRUE`, [brand]);
    const r = await pool.query(`SELECT id FROM moveadvisor_vehicle_brands WHERE name = $1 LIMIT 1`, [brand]);
    const brandId = r.rows[0]?.id;
    if (!brandId) return;
    await pool.query(`INSERT INTO moveadvisor_vehicle_models (brand_id, name, is_active) VALUES ($1, $2, TRUE) ON CONFLICT (brand_id, name) DO UPDATE SET is_active = TRUE`, [brandId, model]);
    return;
  }
  if (action === "delete_model") {
    await pool.query(`UPDATE moveadvisor_vehicle_models m SET is_active = FALSE FROM moveadvisor_vehicle_brands b WHERE m.brand_id = b.id AND b.name = $1 AND m.name = $2`, [brand, model]);
    return;
  }
  if (action === "delete_brand") {
    await pool.query(`UPDATE moveadvisor_vehicle_models m SET is_active = FALSE FROM moveadvisor_vehicle_brands b WHERE m.brand_id = b.id AND b.name = $1`, [brand]);
    await pool.query(`UPDATE moveadvisor_vehicle_brands SET is_active = FALSE WHERE name = $1`, [brand]);
  }
}

async function applyMssqlAction(action, brand, model) {
  await ensureCatalogTablesMssql();
  const pool = await getMssqlPool();
  const sb = brand.replace(/'/g, "''");
  const sm = model.replace(/'/g, "''");
  if (action === "upsert_brand") {
    await pool.request().query(`IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleBrands WHERE Name = N'${sb}') UPDATE dbo.MoveAdvisorVehicleBrands SET IsActive = 1 WHERE Name = N'${sb}'; ELSE INSERT INTO dbo.MoveAdvisorVehicleBrands (Name, IsActive) VALUES (N'${sb}', 1);`);
    return;
  }
  if (action === "upsert_model") {
    await pool.request().query(`IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleBrands WHERE Name = N'${sb}') UPDATE dbo.MoveAdvisorVehicleBrands SET IsActive = 1 WHERE Name = N'${sb}'; ELSE INSERT INTO dbo.MoveAdvisorVehicleBrands (Name, IsActive) VALUES (N'${sb}', 1); IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleModels m INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId WHERE b.Name = N'${sb}' AND m.Name = N'${sm}') UPDATE m SET IsActive = 1 FROM dbo.MoveAdvisorVehicleModels m INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId WHERE b.Name = N'${sb}' AND m.Name = N'${sm}'; ELSE INSERT INTO dbo.MoveAdvisorVehicleModels (BrandId, Name, IsActive) SELECT TOP 1 b.Id, N'${sm}', 1 FROM dbo.MoveAdvisorVehicleBrands b WHERE b.Name = N'${sb}';`);
    return;
  }
  if (action === "delete_model") {
    await pool.request().query(`UPDATE m SET m.IsActive = 0 FROM dbo.MoveAdvisorVehicleModels m INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId WHERE b.Name = N'${sb}' AND m.Name = N'${sm}';`);
    return;
  }
  if (action === "delete_brand") {
    await pool.request().query(`UPDATE b SET b.IsActive = 0 FROM dbo.MoveAdvisorVehicleBrands b WHERE b.Name = N'${sb}'; UPDATE m SET m.IsActive = 0 FROM dbo.MoveAdvisorVehicleModels m INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId WHERE b.Name = N'${sb}';`);
  }
}

function applySqlcmdAction(action, brand, model) {
  ensureCatalogTablesSqlcmd();
  const sb = brand.replace(/'/g, "''");
  const sm = model.replace(/'/g, "''");
  if (action === "upsert_brand") {
    runSqlcmd(`IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleBrands WHERE Name = N'${sb}') UPDATE dbo.MoveAdvisorVehicleBrands SET IsActive = 1 WHERE Name = N'${sb}'; ELSE INSERT INTO dbo.MoveAdvisorVehicleBrands (Name, IsActive) VALUES (N'${sb}', 1);`);
    return;
  }
  if (action === "upsert_model") {
    runSqlcmd(`IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleBrands WHERE Name = N'${sb}') UPDATE dbo.MoveAdvisorVehicleBrands SET IsActive = 1 WHERE Name = N'${sb}'; ELSE INSERT INTO dbo.MoveAdvisorVehicleBrands (Name, IsActive) VALUES (N'${sb}', 1); IF EXISTS (SELECT 1 FROM dbo.MoveAdvisorVehicleModels m INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId WHERE b.Name = N'${sb}' AND m.Name = N'${sm}') UPDATE m SET IsActive = 1 FROM dbo.MoveAdvisorVehicleModels m INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId WHERE b.Name = N'${sb}' AND m.Name = N'${sm}'; ELSE INSERT INTO dbo.MoveAdvisorVehicleModels (BrandId, Name, IsActive) SELECT TOP 1 b.Id, N'${sm}', 1 FROM dbo.MoveAdvisorVehicleBrands b WHERE b.Name = N'${sb}';`);
    return;
  }
  if (action === "delete_model") {
    runSqlcmd(`UPDATE m SET m.IsActive = 0 FROM dbo.MoveAdvisorVehicleModels m INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId WHERE b.Name = N'${sb}' AND m.Name = N'${sm}';`);
    return;
  }
  if (action === "delete_brand") {
    runSqlcmd(`UPDATE b SET b.IsActive = 0 FROM dbo.MoveAdvisorVehicleBrands b WHERE b.Name = N'${sb}'; UPDATE m SET m.IsActive = 0 FROM dbo.MoveAdvisorVehicleModels m INNER JOIN dbo.MoveAdvisorVehicleBrands b ON b.Id = m.BrandId WHERE b.Name = N'${sb}';`);
  }
}

function applyLocalAction(action, brand, model) {
  const map = readLocalCatalogMap();
  if (action === "upsert_brand") { if (!Array.isArray(map[brand])) map[brand] = []; }
  if (action === "upsert_model") { if (!Array.isArray(map[brand])) map[brand] = []; if (!map[brand].includes(model)) map[brand].push(model); }
  if (action === "delete_model") { if (Array.isArray(map[brand])) map[brand] = map[brand].filter((e) => normalizeText(e) !== model); }
  if (action === "delete_brand") { delete map[brand]; }
  writeLocalCatalogMap(map);
}

// ── Unified handler (GET = read, POST = admin write) ───────────────────────

module.exports = async function vehicleCatalogHandler(req, res) {
  // POST → admin actions
  if (req.method === "POST") {
    const action = normalizeText(req?.body?.action).toLowerCase();
    const brand = normalizeText(req?.body?.brand);
    const model = normalizeText(req?.body?.model);
    const provider = getCatalogProvider();

    if (!["upsert_brand", "upsert_model", "delete_model", "delete_brand"].includes(action)) {
      return res.status(400).json({ ok: false, error: "Accion no valida para catalogo." });
    }
    if (!brand) return res.status(400).json({ ok: false, error: "La marca es obligatoria." });
    if (["upsert_model", "delete_model"].includes(action) && !model) {
      return res.status(400).json({ ok: false, error: "El modelo es obligatorio para esta accion." });
    }

    try {
      if (provider === "mssql") await applyMssqlAction(action, brand, model);
      else if (provider === "sqlcmd-windows") applySqlcmdAction(action, brand, model);
      else if (provider === "postgres") await applyPostgresAction(action, brand, model);
      else applyLocalAction(action, brand, model);
      return res.status(200).json({ ok: true, provider, action, brand, model: model || "" });
    } catch (error) {
      return res.status(500).json({ ok: false, provider, error: error instanceof Error ? error.message : "No se pudo actualizar el catalogo." });
    }
  }

  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const defaultCatalogMap = readDefaultCatalogMap();
  const provider = getCatalogProvider();

  try {
    if (provider === "mssql") {
      const catalogMap = await getCatalogFromMssql(defaultCatalogMap);
      const matchedModelsByBrand = await getModelCoverageFromMssql().catch(() => ({}));
      const mergedCatalogMap = mergeCatalogMaps(catalogMap, defaultCatalogMap);
      return res.status(200).json({
        ok: true,
        provider,
        source: "database+local-file",
        brands: mapToBrandRows(mergedCatalogMap),
        matchedModelsByBrand,
      });
    }

    if (provider === "sqlcmd-windows") {
      const catalogMap = getCatalogFromSqlcmd(defaultCatalogMap);
      const matchedModelsByBrand = (() => {
        try {
          return getModelCoverageFromSqlcmd();
        } catch {
          return {};
        }
      })();
      const mergedCatalogMap = mergeCatalogMaps(catalogMap, defaultCatalogMap);
      return res.status(200).json({
        ok: true,
        provider,
        source: "database+local-file",
        brands: mapToBrandRows(mergedCatalogMap),
        matchedModelsByBrand,
      });
    }

    if (provider === "postgres") {
      const catalogMap = await getCatalogFromPostgres(defaultCatalogMap);
      const matchedModelsByBrand = await getModelCoverageFromPostgres().catch(() => ({}));
      const mergedCatalogMap = mergeCatalogMaps(catalogMap, defaultCatalogMap);
      return res.status(200).json({
        ok: true,
        provider,
        source: "database+local-file",
        brands: mapToBrandRows(mergedCatalogMap),
        matchedModelsByBrand,
      });
    }

    return res.status(200).json({
      ok: true,
      provider,
      source: "local-file",
      brands: mapToBrandRows(defaultCatalogMap),
      matchedModelsByBrand: {},
    });
  } catch (error) {
    return res.status(200).json({
      ok: true,
      provider,
      source: "local-file-fallback",
      warning: error instanceof Error ? error.message : "No se pudo cargar catalogo desde base de datos.",
      brands: mapToBrandRows(defaultCatalogMap),
      matchedModelsByBrand: {},
    });
  }
};
