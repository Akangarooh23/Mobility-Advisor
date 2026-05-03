/**
 * migrate-sqlserver-to-postgres.js
 *
 * Migra datos de las tablas nuevas de SQL Server a Postgres (Neon).
 * Tablas migradas:
 *   - MoveAdvisorUserSavedComparisons   -> moveadvisor_user_saved_comparisons
 *   - MoveAdvisorUserMarketAlerts       -> moveadvisor_user_market_alerts
 *   - MoveAdvisorUserMarketAlertStatus  -> moveadvisor_user_market_alert_status
 *   - MoveAdvisorUserPreferences        -> moveadvisor_user_preferences
 *   - MoveAdvisorMarketOffers           -> moveadvisor_market_offers
 *   - MoveAdvisorScrapingRuns           -> moveadvisor_scraping_runs
 *
 * Uso:
 *   node scripts/migrate-sqlserver-to-postgres.js
 *
 * Requiere variables de entorno (carga .env.local automáticamente):
 *   MSSQL_SERVER, MSSQL_DATABASE, MSSQL_USER, MSSQL_PASSWORD
 *   DATABASE_URL  (cadena de conexión Postgres/Neon)
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// ── cargar .env.local ──────────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MSSQL_SERVER   = process.env.MSSQL_SERVER   || "localhost\\SQLEXPRESS";
const MSSQL_DATABASE = process.env.MSSQL_DATABASE || "Mobilityadvisor";
const MSSQL_USER     = String(process.env.MSSQL_USER     || "").trim();
const MSSQL_PASSWORD = String(process.env.MSSQL_PASSWORD || "");
const SQLCMD_PATH    = process.env.SQLCMD_PATH    || "sqlcmd";
const DATABASE_URL   = process.env.DATABASE_URL   || process.env.POSTGRES_URL || "";

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL (o POSTGRES_URL) no está definida en .env.local");
  console.error("Cópiala desde el dashboard de Neon: https://console.neon.tech");
  process.exit(1);
}

// ── helpers SQL Server ─────────────────────────────────────────────────────
function runSqlcmdQuery(sql) {
  const tmp = path.join(os.tmpdir(), `mig-mssql-${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  const authArgs = MSSQL_USER ? ["-U", MSSQL_USER, "-P", MSSQL_PASSWORD] : ["-E"];
  try {
    return execFileSync(
      SQLCMD_PATH,
      ["-S", MSSQL_SERVER, "-d", MSSQL_DATABASE, ...authArgs, "-b", "-y", "0", "-i", tmp],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function parseJsonFromSqlcmd(output) {
  const flat = String(output || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean).join("");
  const start = flat.search(/[\[{]/);
  if (start === -1) return [];
  const end = Math.max(flat.lastIndexOf("]"), flat.lastIndexOf("}")) + 1;
  try { return JSON.parse(flat.slice(start, end)); } catch { return []; }
}

function readTable(tableName, columns) {
  const cols = columns.map(c => `[${c}]`).join(", ");
  const sql = `SELECT ${cols} FROM dbo.${tableName} FOR JSON PATH, INCLUDE_NULL_VALUES;`;
  const raw = runSqlcmdQuery(sql);
  return parseJsonFromSqlcmd(raw);
}

// ── helpers Postgres ───────────────────────────────────────────────────────
async function getPostgresClient() {
  let pg;
  try { pg = require("pg"); } catch {
    console.error("ERROR: módulo 'pg' no instalado. Ejecuta: npm install pg");
    process.exit(1);
  }
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

function pgVal(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function pgBool(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  return Number(v) !== 0;
}

function pgDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function ensureMarketOffersSchema(client) {
  await client.query(`
    ALTER TABLE moveadvisor_market_offers
      ADD COLUMN IF NOT EXISTS listing_type VARCHAR(40) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(18,2),
      ADD COLUMN IF NOT EXISTS finance_price NUMERIC(18,2),
      ADD COLUMN IF NOT EXISTS province VARCHAR(120) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS city VARCHAR(120) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS image_url VARCHAR(2000) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS title VARCHAR(500) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS listed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS body_type VARCHAR(80) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS environmental_label VARCHAR(50) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS doors INT,
      ADD COLUMN IF NOT EXISTS seats INT,
      ADD COLUMN IF NOT EXISTS power_cv INT,
      ADD COLUMN IF NOT EXISTS seller_type VARCHAR(80) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS dealer_name VARCHAR(200) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS warranty_months INT,
      ADD COLUMN IF NOT EXISTS traction VARCHAR(100),
      ADD COLUMN IF NOT EXISTS displacement VARCHAR(50),
      ADD COLUMN IF NOT EXISTS co2 VARCHAR(50),
      ADD COLUMN IF NOT EXISTS next_itv VARCHAR(50),
      ADD COLUMN IF NOT EXISTS power_kw INT,
      ADD COLUMN IF NOT EXISTS consumption NUMERIC(6,2);
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS ix_market_offers_url ON moveadvisor_market_offers (url)`);
}

// ── migraciones ────────────────────────────────────────────────────────────

async function migrateSavedComparisons(client) {
  const rows = readTable("MoveAdvisorUserSavedComparisons", [
    "Id","UserEmail","UserId","Title","Mode","ComparisonPayload","CreatedAt","UpdatedAt"
  ]);
  if (!rows.length) { console.log("  saved_comparisons: 0 filas en SQL Server, nada que migrar"); return; }

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    try {
      await client.query(
        `INSERT INTO moveadvisor_user_saved_comparisons
           (id, user_email, user_id, title, mode, comparison_payload, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [pgVal(r.Id), pgVal(r.UserEmail), pgVal(r.UserId), pgVal(r.Title) || "",
         pgVal(r.Mode) || "buy", pgVal(r.ComparisonPayload) || "{}",
         pgDate(r.CreatedAt), pgDate(r.UpdatedAt)]
      );
      inserted++;
    } catch (e) { console.warn(`  skip saved_comparison ${r.Id}: ${e.message}`); skipped++; }
  }
  console.log(`  saved_comparisons: ${inserted} insertadas, ${skipped} omitidas`);
}

async function migrateMarketAlerts(client) {
  const rows = readTable("MoveAdvisorUserMarketAlerts", [
    "Id","UserEmail","UserId","Title","Mode","Brand","Model","MaxPrice","MaxMileage",
    "Fuel","Location","Color","NotifyByEmail","AlertEmail","Status","AlertPayload","CreatedAt","UpdatedAt"
  ]);
  if (!rows.length) { console.log("  market_alerts: 0 filas en SQL Server, nada que migrar"); return; }

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    try {
      await client.query(
        `INSERT INTO moveadvisor_user_market_alerts
           (id, user_email, user_id, title, mode, brand, model, max_price, max_mileage,
            fuel, location, color, notify_by_email, alert_email, status, alert_payload, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO NOTHING`,
        [pgVal(r.Id), pgVal(r.UserEmail), pgVal(r.UserId), pgVal(r.Title) || "",
         pgVal(r.Mode) || "buy", pgVal(r.Brand) || "", pgVal(r.Model) || "",
         pgVal(r.MaxPrice) || "", pgVal(r.MaxMileage) || "", pgVal(r.Fuel) || "",
         pgVal(r.Location) || "", pgVal(r.Color) || "", pgBool(r.NotifyByEmail),
         pgVal(r.AlertEmail) || "", pgVal(r.Status) || "active",
         pgVal(r.AlertPayload) || "{}", pgDate(r.CreatedAt), pgDate(r.UpdatedAt)]
      );
      inserted++;
    } catch (e) { console.warn(`  skip market_alert ${r.Id}: ${e.message}`); skipped++; }
  }
  console.log(`  market_alerts: ${inserted} insertadas, ${skipped} omitidas`);
}

async function migrateMarketAlertStatus(client) {
  const rows = readTable("MoveAdvisorUserMarketAlertStatus", [
    "AlertId","UserEmail","SeenCount","LastSeenAt"
  ]);
  if (!rows.length) { console.log("  market_alert_status: 0 filas en SQL Server, nada que migrar"); return; }

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    try {
      await client.query(
        `INSERT INTO moveadvisor_user_market_alert_status
           (alert_id, user_email, seen_count, last_seen_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (alert_id) DO NOTHING`,
        [pgVal(r.AlertId), pgVal(r.UserEmail), Number(r.SeenCount) || 0, pgDate(r.LastSeenAt)]
      );
      inserted++;
    } catch (e) { console.warn(`  skip market_alert_status ${r.AlertId}: ${e.message}`); skipped++; }
  }
  console.log(`  market_alert_status: ${inserted} insertadas, ${skipped} omitidas`);
}

async function migrateUserPreferences(client) {
  const rows = readTable("MoveAdvisorUserPreferences", [
    "UserEmail","UserId","FullName","Language","Region",
    "NotifyPriceAlerts","NotifyAppointments","NotifyAnalysisReady","WeeklyDigest","UpdatedAt"
  ]);
  if (!rows.length) { console.log("  user_preferences: 0 filas en SQL Server, nada que migrar"); return; }

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    try {
      await client.query(
        `INSERT INTO moveadvisor_user_preferences
           (user_email, user_id, full_name, language, region,
            notify_price_alerts, notify_appointments, notify_analysis_ready, weekly_digest, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (user_email) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           full_name = EXCLUDED.full_name,
           language = EXCLUDED.language,
           region = EXCLUDED.region,
           notify_price_alerts = EXCLUDED.notify_price_alerts,
           notify_appointments = EXCLUDED.notify_appointments,
           notify_analysis_ready = EXCLUDED.notify_analysis_ready,
           weekly_digest = EXCLUDED.weekly_digest,
           updated_at = EXCLUDED.updated_at`,
        [pgVal(r.UserEmail), pgVal(r.UserId), pgVal(r.FullName) || "",
         pgVal(r.Language) || "es", pgVal(r.Region) || "es",
         pgBool(r.NotifyPriceAlerts), pgBool(r.NotifyAppointments),
         pgBool(r.NotifyAnalysisReady), pgBool(r.WeeklyDigest), pgDate(r.UpdatedAt)]
      );
      inserted++;
    } catch (e) { console.warn(`  skip user_preferences ${r.UserEmail}: ${e.message}`); skipped++; }
  }
  console.log(`  user_preferences: ${inserted} insertadas/actualizadas, ${skipped} omitidas`);
}

async function migrateMarketOffers(client) {
  const curatedWhere = `
    WHERE COALESCE(Price, 0) > 0
      AND ListingType NOT LIKE N'%rent%'
      AND ListingType NOT LIKE N'%alquiler%'
      AND ListingType NOT LIKE N'%suscrip%'
      AND COALESCE(Co2, N'') <> N''
  `;

  // Replace full inventory snapshot so Postgres mirrors curated SQL Server subset exactly.
  await client.query("DELETE FROM moveadvisor_market_offers");

  // Leer en lotes para no saturar memoria
  const countRaw = runSqlcmdQuery(`SELECT COUNT(*) AS cnt FROM dbo.MoveAdvisorMarketOffers ${curatedWhere} FOR JSON PATH;`);
  const countRows = parseJsonFromSqlcmd(countRaw);
  const total = countRows[0]?.cnt || 0;
  console.log(`  market_offers: ${total} filas en SQL Server`);
  if (!total) return;

  const BATCH = 500;
  let offset = 0, inserted = 0, skipped = 0;
  while (offset < total) {
    const sql = `
          SELECT Id,Url,Portal,Brand,Model,Version,Fuel,ListingType,Price,MonthlyPrice,FinancePrice,
            Year,Mileage,Province,City,ImageUrl,Title,ListedAt,SourceUpdatedAt,FirstSeenAt,LastSeenAt,
            RawPayload,Transmission,BodyType,EnvironmentalLabel,Doors,Seats,PowerCv,Color,SellerType,
            DealerName,WarrantyMonths,Traction,Displacement,Co2,NextITV,PowerKw,Consumption
      FROM (
        SELECT *, ROW_NUMBER() OVER (ORDER BY LastSeenAt DESC) rn
        FROM dbo.MoveAdvisorMarketOffers
        ${curatedWhere}
      ) t
      WHERE rn BETWEEN ${offset + 1} AND ${offset + BATCH}
      FOR JSON PATH, INCLUDE_NULL_VALUES;`;
    const rows = parseJsonFromSqlcmd(runSqlcmdQuery(sql));
    for (const r of rows) {
      const location = [pgVal(r.City), pgVal(r.Province)].filter(Boolean).join(", ");
      const images = pgVal(r.ImageUrl) ? JSON.stringify([pgVal(r.ImageUrl)]) : "[]";
      try {
        await client.query(
          `INSERT INTO moveadvisor_market_offers
           (id, url, portal, brand, model, version, fuel, listing_type, price, monthly_price, finance_price,
            year, mileage, province, city, image_url, title, listed_at, source_updated_at, first_seen_at, last_seen_at,
            raw_payload, transmission, body_type, environmental_label, doors, seats, power_cv, color, seller_type,
            dealer_name, warranty_months, traction, displacement, co2, next_itv, power_kw, consumption,
            location, images, scraped_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
               $22,$23,$24,$25,$26,$27,$28,$29,$30,
               $31,$32,$33,$34,$35,$36,$37,$38,
               $39,$40,$41,$42)
          ON CONFLICT (id) DO UPDATE SET
           url = EXCLUDED.url,
           portal = EXCLUDED.portal,
           brand = EXCLUDED.brand,
           model = EXCLUDED.model,
           version = EXCLUDED.version,
           fuel = EXCLUDED.fuel,
           listing_type = EXCLUDED.listing_type,
           price = EXCLUDED.price,
           monthly_price = EXCLUDED.monthly_price,
           finance_price = EXCLUDED.finance_price,
           year = EXCLUDED.year,
           mileage = EXCLUDED.mileage,
           province = EXCLUDED.province,
           city = EXCLUDED.city,
           image_url = EXCLUDED.image_url,
           title = EXCLUDED.title,
           listed_at = EXCLUDED.listed_at,
           source_updated_at = EXCLUDED.source_updated_at,
           first_seen_at = EXCLUDED.first_seen_at,
           last_seen_at = EXCLUDED.last_seen_at,
           raw_payload = EXCLUDED.raw_payload,
           transmission = EXCLUDED.transmission,
           body_type = EXCLUDED.body_type,
           environmental_label = EXCLUDED.environmental_label,
           doors = EXCLUDED.doors,
           seats = EXCLUDED.seats,
           power_cv = EXCLUDED.power_cv,
           color = EXCLUDED.color,
           seller_type = EXCLUDED.seller_type,
           dealer_name = EXCLUDED.dealer_name,
           warranty_months = EXCLUDED.warranty_months,
           traction = EXCLUDED.traction,
           displacement = EXCLUDED.displacement,
           co2 = EXCLUDED.co2,
           next_itv = EXCLUDED.next_itv,
           power_kw = EXCLUDED.power_kw,
           consumption = EXCLUDED.consumption,
           location = EXCLUDED.location,
           images = EXCLUDED.images,
           scraped_at = EXCLUDED.scraped_at,
           updated_at = EXCLUDED.updated_at`,
         [pgVal(r.Id), pgVal(r.Url) || "", pgVal(r.Portal) || "",
          pgVal(r.Brand) || "", pgVal(r.Model) || "", pgVal(r.Version) || "",
          pgVal(r.Fuel) || "", pgVal(r.ListingType) || "",
          r.Price ? Number(r.Price) : null,
          r.MonthlyPrice ? Number(r.MonthlyPrice) : null,
          r.FinancePrice ? Number(r.FinancePrice) : null,
          r.Year ? Number(r.Year) : null,
          r.Mileage ? Number(r.Mileage) : null,
          pgVal(r.Province) || "", pgVal(r.City) || "",
          pgVal(r.ImageUrl) || "", pgVal(r.Title) || "",
          pgDate(r.ListedAt), pgDate(r.SourceUpdatedAt),
          pgDate(r.FirstSeenAt) || pgDate(r.LastSeenAt) || new Date().toISOString(),
          pgDate(r.LastSeenAt) || pgDate(r.FirstSeenAt) || new Date().toISOString(),
          pgVal(r.RawPayload) || "{}",
          pgVal(r.Transmission) || "", pgVal(r.BodyType) || "", pgVal(r.EnvironmentalLabel) || "",
          r.Doors ? Number(r.Doors) : null,
          r.Seats ? Number(r.Seats) : null,
          r.PowerCv ? Number(r.PowerCv) : null,
          pgVal(r.Color) || "", pgVal(r.SellerType) || "",
          pgVal(r.DealerName) || "",
          r.WarrantyMonths ? Number(r.WarrantyMonths) : null,
          pgVal(r.Traction), pgVal(r.Displacement), pgVal(r.Co2), pgVal(r.NextITV),
          r.PowerKw ? Number(r.PowerKw) : null,
          r.Consumption ? Number(r.Consumption) : null,
          location, images,
          pgDate(r.FirstSeenAt) || pgDate(r.LastSeenAt) || new Date().toISOString(),
          pgDate(r.LastSeenAt) || pgDate(r.FirstSeenAt) || new Date().toISOString()]
        );
        inserted++;
      } catch (e) { skipped++; }
    }
    offset += BATCH;
    process.stdout.write(`\r  market_offers: ${inserted} insertadas...`);
  }
  console.log(`\r  market_offers: ${inserted} insertadas, ${skipped} omitidas`);
}

async function migrateScrapingRuns(client) {
  let rows;
  try {
    rows = readTable("MoveAdvisorScrapingRuns", [
      "Id","StartedAt","FinishedAt","Mode","SelectedPlatforms","ReportJson","OffersCount","Message"
    ]);
  } catch {
    console.log("  scraping_runs: tabla no existe en SQL Server, omitiendo");
    return;
  }
  if (!rows.length) { console.log("  scraping_runs: 0 filas, nada que migrar"); return; }

  let inserted = 0, skipped = 0;
  for (const r of rows) {
    try {
      let portal = "";
      try {
        const selected = JSON.parse(String(r.SelectedPlatforms || "[]"));
        portal = Array.isArray(selected) ? selected.join(",") : "";
      } catch {
        portal = pgVal(r.Mode) || "";
      }
      portal = String(portal || "").slice(0, 60);

      await client.query(
        `INSERT INTO moveadvisor_scraping_runs
           (portal, started_at, finished_at, offers_found, status, error_msg)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [portal, pgDate(r.StartedAt), pgDate(r.FinishedAt),
         Number(r.OffersCount) || 0, "ok", pgVal(r.Message) || ""]
      );
      inserted++;
    } catch (e) { console.warn(`  skip scraping_run ${r.Id}: ${e.message}`); skipped++; }
  }
  console.log(`  scraping_runs: ${inserted} insertadas, ${skipped} omitidas`);
}

// ── main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log("=== Migración SQL Server → Postgres ===\n");

  const client = await getPostgresClient();
  console.log("Conectado a Postgres OK\n");

  // Crear tablas si no existen (ejecutar init.sql)
  const initSql = fs.readFileSync(path.join(__dirname, "..", "db", "postgres", "init.sql"), "utf8");
  await client.query(initSql);
  await ensureMarketOffersSchema(client);
  console.log("Schema Postgres actualizado\n");

  try {
    console.log("[1/6] Comparaciones guardadas...");
    await migrateSavedComparisons(client);

    console.log("[2/6] Alertas de mercado...");
    await migrateMarketAlerts(client);

    console.log("[3/6] Estado de alertas...");
    await migrateMarketAlertStatus(client);

    console.log("[4/6] Preferencias de usuario...");
    await migrateUserPreferences(client);

    console.log("[5/6] Ofertas de mercado (inventario)...");
    await migrateMarketOffers(client);

    console.log("[6/6] Runs de scraping...");
    await migrateScrapingRuns(client);
  } finally {
    await client.end();
  }

  console.log("\n✓ Migración completada");
})();
