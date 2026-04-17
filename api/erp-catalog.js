const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

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


function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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

module.exports = function erpCatalogHandler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const scope = normalizeText(req.query?.scope).toLowerCase();

  try {
    if (scope === "brands") {
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
      return res.status(200).json({ ok: true, versions: [], source: "local-fallback" });
    }
    if (scope === "version-detail") {
      return res.status(200).json({ ok: true, detail: null, source: "local-fallback" });
    }
    return res.status(200).json({ ok: true, brands: getLocalBrands(), source: "local-fallback" });
  }
};
