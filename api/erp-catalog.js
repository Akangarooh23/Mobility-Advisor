const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function getMssqlModule() {
  return require("mssql");
}

if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL;
}

const LOCAL_CATALOG_PATH = path.join(__dirname, "..", "data", "vehicle-catalog.json");

function readLocalCatalog() {
  try {
    const raw = fs.readFileSync(LOCAL_CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}


// Returns sorted brand list from local catalog, each with a 1-based numeric id
function getLocalBrands() {
  const catalog = readLocalCatalog();
  return Object.keys(catalog)
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((name, idx) => ({ id: idx + 1, name }));
}

// Returns models for the given brand id (1-based index) from local catalog
function getLocalModels(brandId) {
  const catalog = readLocalCatalog();
  const brands = Object.keys(catalog).sort((a, b) => a.localeCompare(b, "es"));
  const idx = Number(brandId) - 1;
  if (idx < 0 || idx >= brands.length) return [];
  const brandName = brands[idx];
  const models = Array.isArray(catalog[brandName]) ? catalog[brandName] : [];
  return models.map((name, i) => ({ id: i + 1, name }));
}

function getLocalVersions(brandId, modelId) {
  const modelRows = getLocalModels(brandId);
  const selectedModel = modelRows.find((row) => String(row.id) === String(modelId));

  if (!selectedModel?.name) {
    return [];
  }

  // Local catalog has no authoritative trim/version catalog. Return empty instead of synthetic versions.
  return [];
}


function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasPostgresEnvConfig() {
  return Boolean(normalizeText(process.env.POSTGRES_URL || process.env.DATABASE_URL));
}

function getErpCatalogProvider() {
  const provider = normalizeText(process.env.ERP_CATALOG_PROVIDER).toLowerCase();
  if (["postgres", "postgresql", "neon", "vercel-postgres"].includes(provider)) {
    return "postgres";
  }
  if (["mssql", "sqlserver"].includes(provider)) {
    return "mssql";
  }
  if (["sqlcmd", "sqlcmd-windows", "windows"].includes(provider)) {
    return "sqlcmd";
  }
  if (hasPostgresEnvConfig()) {
    return "postgres";
  }
  if (hasMssqlEnvConfig()) {
    return "mssql";
  }
  return "sqlcmd";
}

let mssqlPoolPromise = null;
let pgPool = null;
let pgErpSchemaEnsured = false;

function getPgPool() {
  if (!pgPool) {
    const { Pool } = require("pg");
    const connectionString = normalizeText(process.env.POSTGRES_URL || process.env.DATABASE_URL);
    if (!connectionString) {
      throw new Error("No DATABASE_URL o POSTGRES_URL configurados para ERP catalog en PostgreSQL.");
    }
    pgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pgPool;
}

async function ensureErpCatalogSchemaPostgres() {
  if (pgErpSchemaEnsured) {
    return;
  }

  const pool = getPgPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_erp_brands (
      id BIGINT PRIMARY KEY,
      name VARCHAR(120) NOT NULL
    )
  `);
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_erp_brands_name ON moveadvisor_erp_brands (name)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_erp_models (
      id BIGINT PRIMARY KEY,
      brand_id BIGINT NOT NULL REFERENCES moveadvisor_erp_brands(id),
      name VARCHAR(160) NOT NULL
    )
  `);
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_erp_models_brand_name ON moveadvisor_erp_models (brand_id, name)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_erp_versions (
      codversion VARCHAR(128) PRIMARY KEY,
      brand_id BIGINT NOT NULL REFERENCES moveadvisor_erp_brands(id),
      model_id BIGINT NOT NULL REFERENCES moveadvisor_erp_models(id),
      label VARCHAR(200) NOT NULL,
      fuel VARCHAR(80) NOT NULL DEFAULT '',
      body_type VARCHAR(80) NOT NULL DEFAULT '',
      cv VARCHAR(40) NOT NULL DEFAULT '',
      doors VARCHAR(20) NOT NULL DEFAULT '',
      seats VARCHAR(20) NOT NULL DEFAULT '',
      co2 VARCHAR(40) NOT NULL DEFAULT '',
      transmision VARCHAR(80) NOT NULL DEFAULT '',
      consumption VARCHAR(80) NOT NULL DEFAULT ''
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS ix_moveadvisor_erp_versions_brand_model ON moveadvisor_erp_versions (brand_id, model_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_moveadvisor_erp_versions_model ON moveadvisor_erp_versions (model_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_moveadvisor_erp_versions_label ON moveadvisor_erp_versions (label)");

  pgErpSchemaEnsured = true;
}

async function queryErpCatalogPostgres({ scope, brandId, modelId, codversion }) {
  await ensureErpCatalogSchemaPostgres();
  const pool = getPgPool();

  if (scope === "brands") {
    const result = await pool.query(`
      SELECT DISTINCT b.id::bigint AS id, b.name
      FROM moveadvisor_erp_brands b
      WHERE EXISTS (
        SELECT 1 FROM moveadvisor_erp_versions v WHERE v.brand_id = b.id
      )
      ORDER BY b.name ASC
    `);
    return Array.isArray(result?.rows) ? result.rows : [];
  }

  if (scope === "models") {
    const result = await pool.query(
      `
        SELECT DISTINCT m.id::bigint AS id, m.name
        FROM moveadvisor_erp_models m
        WHERE m.brand_id = $1
          AND EXISTS (
            SELECT 1 FROM moveadvisor_erp_versions v WHERE v.model_id = m.id AND NULLIF(TRIM(v.label), '') IS NOT NULL
          )
        ORDER BY m.name ASC
      `,
      [Number(brandId)]
    );
    return Array.isArray(result?.rows) ? result.rows : [];
  }

  if (scope === "versions") {
    const result = await pool.query(
      `
        SELECT DISTINCT v.codversion, v.label
        FROM moveadvisor_erp_versions v
        INNER JOIN moveadvisor_erp_models m ON m.id = v.model_id
        INNER JOIN moveadvisor_erp_brands b ON b.id = m.brand_id
        WHERE m.brand_id = $1
          AND m.id = $2
          AND NULLIF(TRIM(v.label), '') IS NOT NULL
        ORDER BY v.label ASC
      `,
      [Number(brandId), Number(modelId)]
    );
    return Array.isArray(result?.rows) ? result.rows : [];
  }

  if (scope === "version-detail") {
    const result = await pool.query(
      `
        SELECT
          NULLIF(TRIM(v.fuel), '') AS fuel,
          NULLIF(TRIM(v.body_type), '') AS "bodyType",
          NULLIF(TRIM(v.cv), '') AS cv,
          NULLIF(TRIM(v.doors), '') AS doors,
          NULLIF(TRIM(v.seats), '') AS seats,
          NULLIF(TRIM(v.co2), '') AS co2,
          NULLIF(TRIM(v.transmision), '') AS transmision,
          NULLIF(TRIM(v.consumption), '') AS consumption
        FROM moveadvisor_erp_versions v
        WHERE v.codversion = $1
        LIMIT 1
      `,
      [String(codversion || "")]
    );
    return (result?.rows || [])[0] || null;
  }

  return null;
}

function hasMssqlEnvConfig() {
  return Boolean(
    normalizeText(process.env.MSSQL_SERVER)
    && normalizeText(process.env.MSSQL_DATABASE)
    && normalizeText(process.env.MSSQL_USER)
    && normalizeText(process.env.MSSQL_PASSWORD)
  );
}

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
    port,
    options: {
      encrypt,
      trustServerCertificate,
    },
    pool: {
      min: 0,
      max: 5,
      idleTimeoutMillis: 30_000,
    },
  };
}

async function getMssqlPool() {
  if (!mssqlPoolPromise) {
    const sql = getMssqlModule();
    mssqlPoolPromise = sql.connect(getMssqlConfig());
  }
  return mssqlPoolPromise;
}

async function queryErpCatalogMssql({ scope, brandId, modelId, codversion }) {
  const sql = getMssqlModule();
  const pool = await getMssqlPool();

  if (scope === "brands") {
    const result = await pool.request().query(`
      SELECT DISTINCT ma.IDMARCA AS id, ma.NOMBREMARCA AS name
      FROM dbo.Marcas ma
      WHERE EXISTS (SELECT 1 FROM dbo.Vehiculos_ERP v WHERE v.IDMARCA = ma.IDMARCA)
      ORDER BY ma.NOMBREMARCA;
    `);
    return Array.isArray(result?.recordset) ? result.recordset : [];
  }

  if (scope === "models") {
    const result = await pool
      .request()
      .input("brandId", sql.Int, Number(brandId))
      .query(`
        SELECT DISTINCT mo.IDMODELO AS id, mo.NOMBREMODELO AS name
        FROM dbo.Modelos mo
        WHERE mo.IDMARCA = @brandId
          AND EXISTS (
            SELECT 1
            FROM dbo.Vehiculos_ERP v
            WHERE v.IDMODELO = mo.IDMODELO
              AND v.VERSION IS NOT NULL
              AND v.VERSION <> ''
          )
        ORDER BY mo.NOMBREMODELO;
      `);
    return Array.isArray(result?.recordset) ? result.recordset : [];
  }

  if (scope === "versions") {
    const result = await pool
      .request()
      .input("brandId", sql.Int, Number(brandId))
      .input("modelId", sql.Int, Number(modelId))
      .query(`
        SELECT DISTINCT v.CODVERSION AS codversion, v.VERSION AS label
        FROM dbo.Vehiculos_ERP v
        INNER JOIN dbo.Modelos mo ON mo.IDMODELO = v.IDMODELO
        INNER JOIN dbo.Marcas ma ON ma.IDMARCA = mo.IDMARCA
        WHERE mo.IDMARCA = @brandId
          AND mo.IDMODELO = @modelId
          AND v.VERSION IS NOT NULL
          AND v.VERSION <> ''
        ORDER BY v.VERSION;
      `);
    return Array.isArray(result?.recordset) ? result.recordset : [];
  }

  if (scope === "version-detail") {
    const result = await pool
      .request()
      .input("codversion", sql.NVarChar(128), String(codversion || ""))
      .query(`
        SELECT TOP 1
          NOMBRECOMBUSTIBLE AS fuel,
          NOMBRECARROCERIA AS bodyType,
          POTENCIA AS cv,
          NPUERTAS AS doors,
          NPLAZAS AS seats,
          EMISIONESCO2 AS co2,
          TRANSMISION AS transmision,
          CONSUMOCOMBINADO AS consumption
        FROM dbo.vVehiculosERP_Enriquecido
        WHERE CODVERSION = @codversion;
      `);
    const rows = Array.isArray(result?.recordset) ? result.recordset : [];
    return rows[0] || null;
  }

  return null;
}

function getSqlcmdPath() {
  return normalizeText(process.env.SQLCMD_PATH) || "sqlcmd";
}

function getSqlcmdConnectionArgs() {
  const server = normalizeText(process.env.MSSQL_SERVER) || "localhost\\SQLEXPRESS";
  const db = normalizeText(process.env.MSSQL_DATABASE) || "Mobilityadvisor";
  // Force UTF-8 output so accents/special chars are preserved (Citroen -> Citroen with diaeresis, etc.)
  return ["-S", server, "-d", db, "-E", "-b", "-y", "0", "-f", "65001"];
}

function runSqlcmd(query) {
  const args = [...getSqlcmdConnectionArgs(), "-Q", query];
  const output = execFileSync(getSqlcmdPath(), args);
  if (!Buffer.isBuffer(output)) {
    return String(output || "");
  }

  const utf8Text = output.toString("utf8");
  // sqlcmd on Windows may emit non-UTF8 bytes; fallback preserves accents like ë/ó.
  if (utf8Text.includes("�")) {
    return output.toString("latin1");
  }

  return utf8Text;
}

function parseSqlcmdJson(raw) {
  // SQL Server FOR JSON PATH splits output into ~2033-char chunks across multiple lines
  const joined = String(raw || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("");
  const start = joined.search(/[\[{]/);
  if (start === -1) return null;
  const ch = joined[start];
  const end = joined.lastIndexOf(ch === "[" ? "]" : "}");
  if (end === -1) return null;
  try { return JSON.parse(joined.slice(start, end + 1)); } catch { return null; }
}

module.exports = async function erpCatalogHandler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const scope = normalizeText(req.query?.scope).toLowerCase();
  const isVercelRuntime = Boolean(normalizeText(process.env.VERCEL) || normalizeText(process.env.VERCEL_ENV));
  const provider = getErpCatalogProvider();

  try {
    if (scope === "brands") {
      if (provider === "postgres") {
        const rows = await queryErpCatalogPostgres({ scope: "brands" });
        return res.status(200).json({ ok: true, brands: rows, source: "postgres" });
      }
      if (provider === "mssql") {
        const rows = await queryErpCatalogMssql({ scope: "brands" });
        return res.status(200).json({ ok: true, brands: rows, source: "mssql" });
      }
      const out = runSqlcmd(
        "SELECT DISTINCT ma.IDMARCA AS id, ma.NOMBREMARCA AS name FROM dbo.Marcas ma WHERE EXISTS (SELECT 1 FROM dbo.Vehiculos_ERP v WHERE v.IDMARCA = ma.IDMARCA) ORDER BY ma.NOMBREMARCA FOR JSON PATH;"
      );
      const rows = parseSqlcmdJson(out);
      return res.status(200).json({ ok: true, brands: Array.isArray(rows) ? rows : [] });
    }

    if (scope === "models") {
      const brandId = parseInt(req.query?.brandId, 10);
      if (!brandId || isNaN(brandId)) {
        return res.status(400).json({ error: "brandId requerido" });
      }
      if (provider === "postgres") {
        const rows = await queryErpCatalogPostgres({ scope: "models", brandId });
        return res.status(200).json({ ok: true, models: rows, source: "postgres" });
      }
      if (provider === "mssql") {
        const rows = await queryErpCatalogMssql({ scope: "models", brandId });
        return res.status(200).json({ ok: true, models: rows, source: "mssql" });
      }
      const out = runSqlcmd(
        `SELECT DISTINCT mo.IDMODELO AS id, mo.NOMBREMODELO AS name FROM dbo.Modelos mo WHERE mo.IDMARCA = ${brandId} AND EXISTS (SELECT 1 FROM dbo.Vehiculos_ERP v WHERE v.IDMODELO = mo.IDMODELO AND v.VERSION IS NOT NULL AND v.VERSION <> '') ORDER BY mo.NOMBREMODELO FOR JSON PATH;`
      );
      const rows = parseSqlcmdJson(out);
      return res.status(200).json({ ok: true, models: Array.isArray(rows) ? rows : [] });
    }

    if (scope === "versions") {
      const brandId = parseInt(req.query?.brandId, 10);
      const modelId = parseInt(req.query?.modelId, 10);
      if (!brandId || isNaN(brandId)) {
        return res.status(400).json({ error: "brandId requerido" });
      }
      if (!modelId || isNaN(modelId)) {
        return res.status(400).json({ error: "modelId requerido" });
      }
      if (provider === "postgres") {
        const rows = await queryErpCatalogPostgres({ scope: "versions", brandId, modelId });
        return res.status(200).json({ ok: true, versions: rows, source: "postgres" });
      }
      if (provider === "mssql") {
        const rows = await queryErpCatalogMssql({ scope: "versions", brandId, modelId });
        return res.status(200).json({ ok: true, versions: rows, source: "mssql" });
      }
      const out = runSqlcmd(
        `SELECT DISTINCT v.CODVERSION AS codversion, v.VERSION AS label FROM dbo.Vehiculos_ERP v INNER JOIN dbo.Modelos mo ON mo.IDMODELO = v.IDMODELO INNER JOIN dbo.Marcas ma ON ma.IDMARCA = mo.IDMARCA WHERE mo.IDMARCA = ${brandId} AND mo.IDMODELO = ${modelId} AND v.VERSION IS NOT NULL AND v.VERSION <> '' ORDER BY v.VERSION FOR JSON PATH;`
      );
      const rows = parseSqlcmdJson(out);
      return res.status(200).json({ ok: true, versions: Array.isArray(rows) ? rows : [] });
    }

    if (scope === "version-detail") {
      const codversion = normalizeText(req.query?.codversion);
      if (!codversion) {
        return res.status(400).json({ error: "codversion requerido" });
      }
      if (provider === "postgres") {
        const detail = await queryErpCatalogPostgres({ scope: "version-detail", codversion });
        return res.status(200).json({ ok: true, detail: detail || null, source: "postgres" });
      }
      if (provider === "mssql") {
        const detail = await queryErpCatalogMssql({ scope: "version-detail", codversion });
        return res.status(200).json({ ok: true, detail: detail || null, source: "mssql" });
      }
      const safe = codversion.replace(/'/g, "''");
      const out = runSqlcmd(
        `SELECT TOP 1 NOMBRECOMBUSTIBLE AS fuel, NOMBRECARROCERIA AS bodyType, POTENCIA AS cv, NPUERTAS AS doors, NPLAZAS AS seats, EMISIONESCO2 AS co2, TRANSMISION AS transmision, CONSUMOCOMBINADO AS consumption FROM dbo.vVehiculosERP_Enriquecido WHERE CODVERSION = N'${safe}' FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;`
      );
      const detail = parseSqlcmdJson(out);
      return res.status(200).json({ ok: true, detail: detail || null });
    }

    return res.status(400).json({ error: "scope no reconocido. Usa: brands, models, versions, version-detail" });
  } catch (err) {
    const fallbackReason = normalizeText(err?.message) || "catalog source unavailable";
    const fallbackMeta = {
      source: "local-fallback",
      reason: fallbackReason,
      runtime: isVercelRuntime ? "vercel" : "node",
      provider,
      postgresConfigured: hasPostgresEnvConfig(),
      mssqlConfigured: hasMssqlEnvConfig(),
    };

    // sqlcmd / SQL Server not available (e.g. Vercel). Fall back to local catalog file.
    if (scope === "brands") {
      return res.status(200).json({ ok: true, brands: getLocalBrands(), ...fallbackMeta });
    }
    if (scope === "models") {
      const brandId = req.query?.brandId;
      return res.status(200).json({ ok: true, models: getLocalModels(brandId), ...fallbackMeta });
    }
    // versions and version-detail have no local data; return empty gracefully
    if (scope === "versions") {
      const brandId = req.query?.brandId;
      const modelId = req.query?.modelId;
      return res.status(200).json({ ok: true, versions: getLocalVersions(brandId, modelId), ...fallbackMeta });
    }
    if (scope === "version-detail") {
      return res.status(200).json({ ok: true, detail: null, ...fallbackMeta });
    }
    return res.status(200).json({ ok: true, brands: getLocalBrands(), ...fallbackMeta });
  }
};
