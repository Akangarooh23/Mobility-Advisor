/**
 * migrate-erp-sqlserver-to-postgres.js
 *
 * Migra catálogo ERP desde SQL Server a PostgreSQL (Neon/Vercel Postgres).
 *
 * Origen (SQL Server):
 *   - dbo.Marcas
 *   - dbo.Modelos
 *   - dbo.Vehiculos_ERP
 *   - dbo.vVehiculosERP_Enriquecido (opcional para enriquecer detalles)
 *
 * Destino (Postgres):
 *   - moveadvisor_erp_brands
 *   - moveadvisor_erp_models
 *   - moveadvisor_erp_versions
 *
 * Uso:
 *   node scripts/migrate-erp-sqlserver-to-postgres.js
 *
 * Variables requeridas:
 *   - DATABASE_URL (o POSTGRES_URL)
 *   - MSSQL_SERVER, MSSQL_DATABASE
 *   - MSSQL_USER + MSSQL_PASSWORD (o autenticacion integrada si omites MSSQL_USER)
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const MSSQL_SERVER = process.env.MSSQL_SERVER || "localhost\\SQLEXPRESS";
const MSSQL_DATABASE = process.env.MSSQL_DATABASE || "Mobilityadvisor";
const MSSQL_USER = String(process.env.MSSQL_USER || "").trim();
const MSSQL_PASSWORD = String(process.env.MSSQL_PASSWORD || "");
const SQLCMD_PATH = process.env.SQLCMD_PATH || "sqlcmd";
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL (o POSTGRES_URL) no esta definida.");
  process.exit(1);
}

function runSqlcmdQuery(sql) {
  const tmp = path.join(os.tmpdir(), `erp-mig-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  const authArgs = MSSQL_USER ? ["-U", MSSQL_USER, "-P", MSSQL_PASSWORD] : ["-E"];

  try {
    return execFileSync(
      SQLCMD_PATH,
      ["-S", MSSQL_SERVER, "-d", MSSQL_DATABASE, ...authArgs, "-b", "-y", "0", "-i", tmp, "-f", "65001"],
      { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
    );
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function parseJsonFromSqlcmd(output) {
  const flat = String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("");

  const start = flat.search(/[\[{]/);
  if (start === -1) return [];

  const endArray = flat.lastIndexOf("]");
  const endObject = flat.lastIndexOf("}");
  const end = Math.max(endArray, endObject);
  if (end < start) return [];

  try {
    return JSON.parse(flat.slice(start, end + 1));
  } catch {
    return [];
  }
}

function readSqlServerRows(query) {
  const raw = runSqlcmdQuery(query);
  const rows = parseJsonFromSqlcmd(raw);
  return Array.isArray(rows) ? rows : [];
}

async function getPgClient() {
  const { Client } = require("pg");
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullableText(value) {
  const text = normalizeText(value);
  return text || null;
}

function toBigIntOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

async function ensureDestinationSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_erp_brands (
      id BIGINT PRIMARY KEY,
      name VARCHAR(120) NOT NULL
    )
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_erp_brands_name
    ON moveadvisor_erp_brands (name)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_erp_models (
      id BIGINT PRIMARY KEY,
      brand_id BIGINT NOT NULL REFERENCES moveadvisor_erp_brands(id),
      name VARCHAR(160) NOT NULL
    )
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_erp_models_brand_name
    ON moveadvisor_erp_models (brand_id, name)
  `);

  await client.query(`
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

  await client.query(`
    CREATE INDEX IF NOT EXISTS ix_moveadvisor_erp_versions_brand_model
    ON moveadvisor_erp_versions (brand_id, model_id)
  `);
}

function loadBrandsFromSqlServer() {
  return readSqlServerRows(`
    SELECT DISTINCT
      ma.IDMARCA AS id,
      ma.NOMBREMARCA AS name
    FROM dbo.Marcas ma
    WHERE ma.IDMARCA IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(ma.NOMBREMARCA)), '') IS NOT NULL
    FOR JSON PATH, INCLUDE_NULL_VALUES;
  `);
}

function loadModelsFromSqlServer() {
  return readSqlServerRows(`
    SELECT DISTINCT
      mo.IDMODELO AS id,
      mo.IDMARCA AS brand_id,
      mo.NOMBREMODELO AS name
    FROM dbo.Modelos mo
    WHERE mo.IDMODELO IS NOT NULL
      AND mo.IDMARCA IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(mo.NOMBREMODELO)), '') IS NOT NULL
    FOR JSON PATH, INCLUDE_NULL_VALUES;
  `);
}

function loadVersionsFromSqlServer() {
  const baseRows = readSqlServerRows(`
    SELECT DISTINCT
      CAST(v.CODVERSION AS NVARCHAR(128)) AS codversion,
      v.IDMARCA AS brand_id,
      v.IDMODELO AS model_id,
      v.VERSION AS label
    FROM dbo.Vehiculos_ERP v
    WHERE NULLIF(LTRIM(RTRIM(CAST(v.CODVERSION AS NVARCHAR(128)))), '') IS NOT NULL
      AND v.IDMARCA IS NOT NULL
      AND v.IDMODELO IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(v.VERSION)), '') IS NOT NULL
    FOR JSON PATH, INCLUDE_NULL_VALUES;
  `);

  // Enriquecimiento opcional desde vista; si falla, seguimos con campos vacios.
  let detailRows = [];
  try {
    detailRows = readSqlServerRows(`
      SELECT
        CAST(CODVERSION AS NVARCHAR(128)) AS codversion,
        NOMBRECOMBUSTIBLE AS fuel,
        NOMBRECARROCERIA AS body_type,
        CAST(POTENCIA AS NVARCHAR(40)) AS cv,
        CAST(NPUERTAS AS NVARCHAR(20)) AS doors,
        CAST(NPLAZAS AS NVARCHAR(20)) AS seats,
        CAST(EMISIONESCO2 AS NVARCHAR(40)) AS co2,
        TRANSMISION AS transmision,
        CAST(CONSUMOCOMBINADO AS NVARCHAR(80)) AS consumption
      FROM dbo.vVehiculosERP_Enriquecido
      WHERE NULLIF(LTRIM(RTRIM(CAST(CODVERSION AS NVARCHAR(128)))), '') IS NOT NULL
      FOR JSON PATH, INCLUDE_NULL_VALUES;
    `);
  } catch {
    detailRows = [];
  }

  const detailByCode = new Map();
  for (const row of detailRows) {
    const code = normalizeText(row?.codversion);
    if (!code || detailByCode.has(code)) continue;
    detailByCode.set(code, {
      fuel: normalizeText(row?.fuel),
      body_type: normalizeText(row?.body_type),
      cv: normalizeText(row?.cv),
      doors: normalizeText(row?.doors),
      seats: normalizeText(row?.seats),
      co2: normalizeText(row?.co2),
      transmision: normalizeText(row?.transmision),
      consumption: normalizeText(row?.consumption),
    });
  }

  return baseRows.map((row) => {
    const code = normalizeText(row?.codversion);
    const detail = detailByCode.get(code) || {};
    return {
      codversion: code,
      brand_id: row?.brand_id,
      model_id: row?.model_id,
      label: normalizeText(row?.label),
      fuel: detail.fuel || "",
      body_type: detail.body_type || "",
      cv: detail.cv || "",
      doors: detail.doors || "",
      seats: detail.seats || "",
      co2: detail.co2 || "",
      transmision: detail.transmision || "",
      consumption: detail.consumption || "",
    };
  });
}

async function upsertBrands(client, rows) {
  let ok = 0;
  for (const row of rows) {
    const id = toBigIntOrNull(row?.id);
    const name = normalizeText(row?.name);
    if (!id || !name) continue;

    await client.query(
      `
        INSERT INTO moveadvisor_erp_brands (id, name)
        VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name
      `,
      [id, name]
    );
    ok += 1;
  }
  return ok;
}

async function upsertModels(client, rows) {
  let ok = 0;
  for (const row of rows) {
    const id = toBigIntOrNull(row?.id);
    const brandId = toBigIntOrNull(row?.brand_id);
    const name = normalizeText(row?.name);
    if (!id || !brandId || !name) continue;

    await client.query(
      `
        INSERT INTO moveadvisor_erp_models (id, brand_id, name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
          brand_id = EXCLUDED.brand_id,
          name = EXCLUDED.name
      `,
      [id, brandId, name]
    );
    ok += 1;
  }
  return ok;
}

async function upsertVersions(client, rows) {
  let ok = 0;
  for (const row of rows) {
    const code = normalizeText(row?.codversion);
    const brandId = toBigIntOrNull(row?.brand_id);
    const modelId = toBigIntOrNull(row?.model_id);
    const label = normalizeText(row?.label);
    if (!code || !brandId || !modelId || !label) continue;

    await client.query(
      `
        INSERT INTO moveadvisor_erp_versions (
          codversion, brand_id, model_id, label,
          fuel, body_type, cv, doors, seats, co2, transmision, consumption
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (codversion) DO UPDATE SET
          brand_id = EXCLUDED.brand_id,
          model_id = EXCLUDED.model_id,
          label = EXCLUDED.label,
          fuel = EXCLUDED.fuel,
          body_type = EXCLUDED.body_type,
          cv = EXCLUDED.cv,
          doors = EXCLUDED.doors,
          seats = EXCLUDED.seats,
          co2 = EXCLUDED.co2,
          transmision = EXCLUDED.transmision,
          consumption = EXCLUDED.consumption
      `,
      [
        code,
        brandId,
        modelId,
        label,
        toNullableText(row?.fuel) || "",
        toNullableText(row?.body_type) || "",
        toNullableText(row?.cv) || "",
        toNullableText(row?.doors) || "",
        toNullableText(row?.seats) || "",
        toNullableText(row?.co2) || "",
        toNullableText(row?.transmision) || "",
        toNullableText(row?.consumption) || "",
      ]
    );

    ok += 1;
  }
  return ok;
}

async function main() {
  console.log("[ERP MIGRATION] SQL Server -> Postgres");
  console.log(`  SQL Server: ${MSSQL_SERVER} / ${MSSQL_DATABASE}`);

  const pg = await getPgClient();

  try {
    await ensureDestinationSchema(pg);

    console.log("  Leyendo marcas de SQL Server...");
    const brands = loadBrandsFromSqlServer();
    console.log(`    marcas leidas: ${brands.length}`);

    console.log("  Leyendo modelos de SQL Server...");
    const models = loadModelsFromSqlServer();
    console.log(`    modelos leidos: ${models.length}`);

    console.log("  Leyendo versiones de SQL Server...");
    const versions = loadVersionsFromSqlServer();
    console.log(`    versiones leidas: ${versions.length}`);

    await pg.query("BEGIN");
    const upBrands = await upsertBrands(pg, brands);
    const upModels = await upsertModels(pg, models);
    const upVersions = await upsertVersions(pg, versions);
    await pg.query("COMMIT");

    const counts = await pg.query(`
      SELECT
        (SELECT COUNT(*)::int FROM moveadvisor_erp_brands) AS brands,
        (SELECT COUNT(*)::int FROM moveadvisor_erp_models) AS models,
        (SELECT COUNT(*)::int FROM moveadvisor_erp_versions) AS versions
    `);

    console.log("[ERP MIGRATION] OK");
    console.log(`  upsert brands:   ${upBrands}`);
    console.log(`  upsert models:   ${upModels}`);
    console.log(`  upsert versions: ${upVersions}`);
    console.log(`  totals postgres: brands=${counts.rows[0].brands}, models=${counts.rows[0].models}, versions=${counts.rows[0].versions}`);
  } catch (error) {
    try { await pg.query("ROLLBACK"); } catch {}
    console.error("[ERP MIGRATION] ERROR:", error?.message || error);
    process.exitCode = 1;
  } finally {
    await pg.end();
  }
}

main();
