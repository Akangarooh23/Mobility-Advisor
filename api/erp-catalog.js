const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function getMssqlModule() {
  return require("mssql");
}

const LOCAL_CATALOG_PATH = path.join(__dirname, "..", "data", "vehicle-catalog.json");
const LOCAL_INVENTORY_OFFERS_PATH = path.join(__dirname, "..", "data", "inventory-offers.json");

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

function readLocalInventoryOffers() {
  try {
    const raw = fs.readFileSync(LOCAL_INVENTORY_OFFERS_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return Array.isArray(parsed?.offers) ? parsed.offers : [];
  } catch {
    return [];
  }
}

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getLocalBrandName(brandId) {
  const catalog = readLocalCatalog();
  const brands = Object.keys(catalog).sort((a, b) => a.localeCompare(b, "es"));
  const idx = Number(brandId) - 1;
  if (idx < 0 || idx >= brands.length) return "";
  return brands[idx];
}

function isLikelySameModel(selectedModelName, offeredModelName) {
  const selected = normalizeToken(selectedModelName);
  const offered = normalizeToken(offeredModelName);
  if (!selected || !offered) return false;
  return offered === selected || offered.startsWith(`${selected} `) || selected.startsWith(`${offered} `);
}

function normalizeVersionLabel(value) {
  let text = String(value || "").trim();
  if (!text) return "";
  text = text.replace(/\s*\|\s*.*$/g, "");
  text = text.replace(/\s*-\s*\d[\d.,\s]*€.*$/i, "");
  text = text.replace(/\s+en\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ].*$/i, "");
  text = text.replace(/\s+/g, " ").trim();
  return text.slice(0, 100);
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

  const brandName = getLocalBrandName(brandId);
  const offers = readLocalInventoryOffers();
  if (brandName && offers.length > 0) {
    const targetBrand = normalizeToken(brandName);
    const selectedModelName = selectedModel.name;
    const dedup = new Set();
    const localVersions = [];

    for (const offer of offers) {
      if (normalizeToken(offer?.brand) !== targetBrand) {
        continue;
      }
      if (!isLikelySameModel(selectedModelName, offer?.model)) {
        continue;
      }

      const label = normalizeVersionLabel(offer?.version || offer?.title || offer?.model);
      if (!label) {
        continue;
      }

      const key = normalizeToken(label);
      if (!key || dedup.has(key)) {
        continue;
      }

      dedup.add(key);
      localVersions.push({
        codversion: `local-${brandId}-${modelId}-${localVersions.length + 1}`,
        label,
      });

      if (localVersions.length >= 30) {
        break;
      }
    }

    if (localVersions.length > 0) {
      return localVersions;
    }
  }

  return [
    {
      codversion: `local-${brandId}-${modelId}`,
      label: `${selectedModel.name} (estándar)`,
    },
  ];
}


function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

let mssqlPoolPromise = null;

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
      .input("modelId", sql.Int, Number(modelId))
      .query(`
        SELECT DISTINCT CODVERSION AS codversion, VERSION AS label
        FROM dbo.Vehiculos_ERP
        WHERE IDMODELO = @modelId
          AND VERSION IS NOT NULL
          AND VERSION <> ''
        ORDER BY VERSION;
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

  try {
    if (scope === "brands") {
      if (hasMssqlEnvConfig()) {
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
      if (hasMssqlEnvConfig()) {
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
      const modelId = parseInt(req.query?.modelId, 10);
      if (!modelId || isNaN(modelId)) {
        return res.status(400).json({ error: "modelId requerido" });
      }
      if (hasMssqlEnvConfig()) {
        const rows = await queryErpCatalogMssql({ scope: "versions", modelId });
        return res.status(200).json({ ok: true, versions: rows, source: "mssql" });
      }
      const out = runSqlcmd(
        `SELECT DISTINCT CODVERSION AS codversion, VERSION AS label FROM dbo.Vehiculos_ERP WHERE IDMODELO = ${modelId} AND VERSION IS NOT NULL AND VERSION <> '' ORDER BY VERSION FOR JSON PATH;`
      );
      const rows = parseSqlcmdJson(out);
      return res.status(200).json({ ok: true, versions: Array.isArray(rows) ? rows : [] });
    }

    if (scope === "version-detail") {
      const codversion = normalizeText(req.query?.codversion);
      if (!codversion) {
        return res.status(400).json({ error: "codversion requerido" });
      }
      if (hasMssqlEnvConfig()) {
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
    // sqlcmd / SQL Server not available (e.g. Vercel). Fall back to local catalog file.
    if (scope === "brands") {
      return res.status(200).json({ ok: true, brands: getLocalBrands(), source: "local-fallback" });
    }
    if (scope === "models") {
      const brandId = req.query?.brandId;
      return res.status(200).json({ ok: true, models: getLocalModels(brandId), source: "local-fallback" });
    }
    // versions and version-detail have no local data; return empty gracefully
    if (scope === "versions") {
      const brandId = req.query?.brandId;
      const modelId = req.query?.modelId;
      return res.status(200).json({ ok: true, versions: getLocalVersions(brandId, modelId), source: "local-fallback" });
    }
    if (scope === "version-detail") {
      return res.status(200).json({ ok: true, detail: null, source: "local-fallback" });
    }
    return res.status(200).json({ ok: true, brands: getLocalBrands(), source: "local-fallback" });
  }
};
