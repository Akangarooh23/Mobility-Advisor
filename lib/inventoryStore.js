const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { Pool } = require("pg");

const LOCAL_INVENTORY_PATH = path.join(__dirname, "..", "data", "inventory-offers.json");
const ROOT_ENV_FILES = [path.join(__dirname, "..", ".env.local"), path.join(__dirname, "..", ".env")];

let postgresPool = null;
let cachedLocalEnv = null;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeSqlString(value) {
  return String(value || "").replace(/'/g, "''");
}

function normalizeToken(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCompactToken(value) {
  return normalizeToken(value).replace(/[^a-z0-9]+/g, "");
}

const GENERIC_FILTER_TOKENS = new Set([
  "all",
  "any",
  "cualquiera",
  "cualquier",
  "todos",
  "todas",
  "todo",
  "indiferente",
  "indiferente_motor",
  "indiferentemotor",
  "toda_espana",
  "toda espana",
  "todaespana",
]);

function normalizeFilterToken(value) {
  const token = normalizeToken(value);
  return GENERIC_FILTER_TOKENS.has(token) ? "" : token;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstDefined(raw, keys, fallback = null) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && raw[key] !== undefined && raw[key] !== null && raw[key] !== "") {
      return raw[key];
    }
  }

  return fallback;
}

function readLocalEnvFallback() {
  if (cachedLocalEnv) {
    return cachedLocalEnv;
  }

  const values = {};
  for (const filePath of ROOT_ENV_FILES) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && values[key] === undefined) {
        values[key] = value;
      }
    }
  }

  cachedLocalEnv = values;
  return cachedLocalEnv;
}

function getEnvValue(key) {
  const fromProcess = normalizeText(process.env[key]);
  if (fromProcess) {
    return fromProcess;
  }

  const fromLocal = normalizeText(readLocalEnvFallback()[key]);
  return fromLocal;
}

function getPostgresPool() {
  const connectionString = getEnvValue("DATABASE_URL") || getEnvValue("POSTGRES_URL");

  if (!connectionString) {
    console.warn("[inventoryStore] No DATABASE_URL or POSTGRES_URL found — Postgres pool unavailable, falling back to local inventory");
    return null;
  }

  if (!postgresPool) {
    postgresPool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }

  return postgresPool;
}

function getSqlcmdConnectionArgs() {
  const server = getEnvValue("MSSQL_SERVER");
  const database = getEnvValue("MSSQL_DATABASE") || "Mobilityadvisor";
  const user = getEnvValue("MSSQL_USER");
  const password = String(getEnvValue("MSSQL_PASSWORD") || "");

  if (!server) {
    return null;
  }

  if (user) {
    return ["-S", server, "-d", database, "-U", user, "-P", password, "-y", "0", "-b"];
  }

  return ["-S", server, "-d", database, "-E", "-y", "0", "-b"];
}

function parseSqlcmdJsonOutput(rawOutput = "") {
  const flat = String(rawOutput || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("");
  const start = flat.search(/[\[{]/);

  if (start === -1) {
    return null;
  }

  const open = flat[start];
  const close = open === "[" ? "]" : "}";
  const end = flat.lastIndexOf(close);
  if (end === -1 || end < start) {
    return null;
  }

  try {
    return JSON.parse(flat.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeOffer(raw = {}) {
  const price = toNumber(firstDefined(raw, ["price", "precio", "precio_compra", "target_price"]));
  const monthlyPrice = toNumber(firstDefined(raw, ["monthlyPrice", "monthly_price", "precio_alquiler_mensual", "precio_cuota_mensual"]));
  const financePrice = toNumber(firstDefined(raw, ["financePrice", "finance_price", "precio_financiado"]));
  const brand = normalizeText(firstDefined(raw, ["brand", "marca"]));
  const model = normalizeText(firstDefined(raw, ["model", "modelo"]));
  const version = normalizeText(firstDefined(raw, ["version", "trim"]));
  const fuel = normalizeText(firstDefined(raw, ["fuel", "combustible"]));
  const portal = normalizeText(firstDefined(raw, ["portal", "source", "provider"]));
  const listingType = normalizeToken(firstDefined(raw, ["listingType", "listing_type", "tipo"]));
  const transmission = normalizeText(firstDefined(raw, ["transmission", "transmision", "gearbox", "cambio"]));
  const bodyType = normalizeText(firstDefined(raw, ["bodyType", "body_type", "carroceria", "segmento"]));
  const environmentalLabel = normalizeText(firstDefined(raw, ["environmentalLabel", "dgtLabel", "etiqueta_dgt", "distintivo_ambiental"]));
  const year = toNumber(firstDefined(raw, ["year", "año", "anio"]));
  const mileage = toNumber(firstDefined(raw, ["mileage", "km", "kilometros"]));
  const doors = toNumber(firstDefined(raw, ["doors", "puertas"]));
  const seats = toNumber(firstDefined(raw, ["seats", "plazas", "asientos"]));
  const powerCv = toNumber(firstDefined(raw, ["powerCv", "power_cv", "potencia_cv", "cv"]));
  const url = normalizeText(firstDefined(raw, ["url", "original_url", "link"]));
  const location = normalizeText(firstDefined(raw, ["location", "ubicacion"]));
  const province = normalizeText(firstDefined(raw, ["province", "provincia"])) || location;
  const city = normalizeText(firstDefined(raw, ["city", "ciudad"])) || location;
  const color = normalizeText(firstDefined(raw, ["color"]));
  const sellerType = normalizeText(firstDefined(raw, ["sellerType", "seller_type", "tipo_vendedor"]));
  const traction = normalizeText(firstDefined(raw, ["traction", "traccion"]));
  const displacement = normalizeText(firstDefined(raw, ["displacement", "cilindrada"]));
  const co2 = normalizeText(firstDefined(raw, ["co2", "co2_g_km"]));
  const powerKw = normalizeText(firstDefined(raw, ["powerKw", "power_kw", "potencia_kw"]));
  const consumption = normalizeText(firstDefined(raw, ["consumption", "consumo"]));
  const dealerName = normalizeText(firstDefined(raw, ["dealerName", "dealer_name", "concesionario"]));
  const warrantyMonths = toNumber(firstDefined(raw, ["warrantyMonths", "warranty_months", "garantia_meses"]));
  const nextItvRaw = normalizeText(firstDefined(raw, ["nextITV", "next_itv", "proxima_itv"]));
  const nextItvNumeric = toNumber(nextItvRaw);
  let nextITV = nextItvRaw;
  if (Number.isFinite(nextItvNumeric) && nextItvNumeric > 20000 && nextItvNumeric < 80000) {
    const excelEpochUtc = Date.UTC(1899, 11, 30);
    const asDate = new Date(excelEpochUtc + Math.round(nextItvNumeric) * 24 * 60 * 60 * 1000);
    if (!Number.isNaN(asDate.getTime())) {
      nextITV = asDate.toISOString().slice(0, 10);
    }
  }
  const imagesRaw = firstDefined(raw, ["images", "imagenes", "gallery"]);
  let imageFromImages = "";
  if (Array.isArray(imagesRaw) && imagesRaw.length > 0) {
    imageFromImages = normalizeText(imagesRaw[0]);
  } else if (typeof imagesRaw === "string" && imagesRaw.trim().startsWith("[")) {
    try {
      const parsedImages = JSON.parse(imagesRaw);
      if (Array.isArray(parsedImages) && parsedImages.length > 0) {
        imageFromImages = normalizeText(parsedImages[0]);
      }
    } catch {
      imageFromImages = "";
    }
  }
  const image = normalizeText(firstDefined(raw, ["image", "imagen_principal_url", "image_url"], imageFromImages));
  const updatedAtRaw = firstDefined(raw, ["updatedAt", "updated_at", "fecha_ultima_actualizacion", "fecha_scrape", "scraped_at"]);
  const listedAtRaw = firstDefined(raw, ["listedAt", "listed_at", "first_seen", "fecha_primera_vez"]);
  const updatedAt = normalizeText(updatedAtRaw);
  const listedAt = normalizeText(listedAtRaw);

  if (!brand || !model || !url) {
    return null;
  }

  return {
    portal: portal || "market",
    brand,
    model,
    version,
    fuel,
    transmission,
    bodyType,
    environmentalLabel,
    year: Number.isFinite(year) ? Math.round(year) : null,
    mileage: Number.isFinite(mileage) ? Math.round(mileage) : null,
    doors: Number.isFinite(doors) ? Math.round(doors) : null,
    seats: Number.isFinite(seats) ? Math.round(seats) : null,
    powerCv: Number.isFinite(powerCv) ? Math.round(powerCv) : null,
    price: Number.isFinite(price) ? price : null,
    monthlyPrice: Number.isFinite(monthlyPrice) ? monthlyPrice : null,
    financePrice: Number.isFinite(financePrice) ? financePrice : null,
    url,
    province,
    city,
    color,
    sellerType,
    traction,
    displacement,
    co2,
    powerKw,
    consumption,
    dealerName,
    nextITV,
    warrantyMonths: Number.isFinite(warrantyMonths) ? Math.round(warrantyMonths) : null,
    image,
    updatedAt,
    listedAt,
    listingType,
  };
}

function buildSqlServerWhereClause(filters = {}) {
  const {
    desiredType = "compra",
    modelTokens = [],
    version = "",
    fuel = "",
    location = "",
    city = "",
    color = "",
    targetYear = null,
    maxYearDistance = 4,
    maxMileage = null,
    transmission = "",
    bodyType = "",
    environmentalLabel = "",
    sellerType = "",
    traction = "",
    displacement = "",
    displacementMin = null,
    displacementMax = null,
    co2 = "",
    co2Min = null,
    co2Max = null,
    powerKw = "",
    powerKwMin = null,
    powerKwMax = null,
    consumption = "",
    consumptionMin = null,
    consumptionMax = null,
    minDoors = null,
    minSeats = null,
    minPowerCv = null,
    maxPowerCv = null,
    minPrice = null,
    maxPrice = null,
    minYear = null,
    maxYear = null,
  } = filters;

  const conditions = [];

  if (normalizeToken(desiredType) === "renting") {
    conditions.push("(COALESCE(MonthlyPrice, 0) > 0 OR ListingType LIKE N'%rent%' OR ListingType LIKE N'%alquiler%' OR ListingType LIKE N'%suscrip%')");
  } else {
    conditions.push("(COALESCE(Price, 0) > 0 AND ListingType NOT LIKE N'%rent%' AND ListingType NOT LIKE N'%alquiler%' AND ListingType NOT LIKE N'%suscrip%')");
  }

  const normalizedFuel = normalizeFilterToken(fuel);
  const normalizedVersion = normalizeToken(version);
  const normalizedCity = normalizeFilterToken(city);
  const normalizedColor = normalizeToken(color);
  if (normalizedFuel) {
    conditions.push(`LOWER(COALESCE(Fuel, N'')) LIKE N'%${escapeSqlString(normalizedFuel)}%'`);
  }
  if (normalizedVersion) {
    conditions.push(`LOWER(COALESCE(Version, N'')) LIKE N'%${escapeSqlString(normalizedVersion)}%'`);
  }
  if (normalizedCity) {
    conditions.push(`LOWER(COALESCE(City, N'')) LIKE N'%${escapeSqlString(normalizedCity)}%'`);
  }
  if (normalizedColor) {
    conditions.push(`LOWER(COALESCE(Color, N'')) LIKE N'%${escapeSqlString(normalizedColor)}%'`);
  }

  const normalizedTransmission = normalizeFilterToken(transmission);
  if (normalizedTransmission) {
    conditions.push(`LOWER(COALESCE(Transmission, N'')) LIKE N'%${escapeSqlString(normalizedTransmission)}%'`);
  }

  const normalizedBodyType = normalizeFilterToken(bodyType);
  if (normalizedBodyType) {
    conditions.push(`LOWER(COALESCE(BodyType, N'')) LIKE N'%${escapeSqlString(normalizedBodyType)}%'`);
  }

  const normalizedLabel = normalizeFilterToken(environmentalLabel);
  if (normalizedLabel) {
    conditions.push(`LOWER(COALESCE(EnvironmentalLabel, N'')) LIKE N'%${escapeSqlString(normalizedLabel)}%'`);
  }

  const normalizedSellerType = normalizeFilterToken(sellerType);
  if (normalizedSellerType) {
    conditions.push(`LOWER(COALESCE(SellerType, N'')) LIKE N'%${escapeSqlString(normalizedSellerType)}%'`);
  }

  const normalizedTraction = normalizeFilterToken(traction);
  if (normalizedTraction) {
    conditions.push(`LOWER(COALESCE(Traction, N'')) LIKE N'%${escapeSqlString(normalizedTraction)}%'`);
  }

  const normalizedDisplacement = normalizeFilterToken(displacement);
  if (normalizedDisplacement) {
    conditions.push(`LOWER(COALESCE(Displacement, N'')) LIKE N'%${escapeSqlString(normalizedDisplacement)}%'`);
  }
  const minDisplacementNumber = toNumber(displacementMin);
  if (Number.isFinite(minDisplacementNumber)) {
    conditions.push(`TRY_CAST(Displacement AS FLOAT) >= ${Number(minDisplacementNumber)}`);
  }
  const maxDisplacementNumber = toNumber(displacementMax);
  if (Number.isFinite(maxDisplacementNumber)) {
    conditions.push(`TRY_CAST(Displacement AS FLOAT) <= ${Number(maxDisplacementNumber)}`);
  }

  const normalizedCo2 = normalizeFilterToken(co2);
  if (normalizedCo2) {
    conditions.push(`LOWER(COALESCE(Co2, N'')) LIKE N'%${escapeSqlString(normalizedCo2)}%'`);
  }
  const minCo2Number = toNumber(co2Min);
  if (Number.isFinite(minCo2Number)) {
    conditions.push(`TRY_CAST(Co2 AS FLOAT) >= ${Number(minCo2Number)}`);
  }
  const maxCo2Number = toNumber(co2Max);
  if (Number.isFinite(maxCo2Number)) {
    conditions.push(`TRY_CAST(Co2 AS FLOAT) <= ${Number(maxCo2Number)}`);
  }

  const normalizedPowerKw = normalizeFilterToken(powerKw);
  if (normalizedPowerKw) {
    conditions.push(`LOWER(CAST(COALESCE(PowerKw, 0) AS NVARCHAR(32))) LIKE N'%${escapeSqlString(normalizedPowerKw)}%'`);
  }
  const minPowerKwNumber = toNumber(powerKwMin);
  if (Number.isFinite(minPowerKwNumber)) {
    conditions.push(`TRY_CAST(PowerKw AS FLOAT) >= ${Number(minPowerKwNumber)}`);
  }
  const maxPowerKwNumber = toNumber(powerKwMax);
  if (Number.isFinite(maxPowerKwNumber)) {
    conditions.push(`TRY_CAST(PowerKw AS FLOAT) <= ${Number(maxPowerKwNumber)}`);
  }

  const normalizedConsumption = normalizeFilterToken(consumption);
  if (normalizedConsumption) {
    conditions.push(`LOWER(COALESCE(Consumption, N'')) LIKE N'%${escapeSqlString(normalizedConsumption)}%'`);
  }
  const minConsumptionNumber = toNumber(consumptionMin);
  if (Number.isFinite(minConsumptionNumber)) {
    conditions.push(`TRY_CAST(Consumption AS FLOAT) >= ${Number(minConsumptionNumber)}`);
  }
  const maxConsumptionNumber = toNumber(consumptionMax);
  if (Number.isFinite(maxConsumptionNumber)) {
    conditions.push(`TRY_CAST(Consumption AS FLOAT) <= ${Number(maxConsumptionNumber)}`);
  }

  const normalizedLocation = normalizeFilterToken(location);
  if (normalizedLocation) {
    const token = escapeSqlString(normalizedLocation);
    conditions.push(`(
      LOWER(COALESCE(Province, N'')) LIKE N'%${token}%'
      OR LOWER(COALESCE(City, N'')) LIKE N'%${token}%'
    )`);
  }

  const targetYearNumber = toNumber(targetYear);
  const maxYearDistanceNumber = Math.max(0, Math.round(toNumber(maxYearDistance) || 0));
  if (Number.isFinite(targetYearNumber) && maxYearDistanceNumber > 0) {
    conditions.push(`([Year] IS NULL OR ABS([Year] - ${Math.round(targetYearNumber)}) <= ${maxYearDistanceNumber})`);
  }

  const minYearNumber = toNumber(minYear);
  if (Number.isFinite(minYearNumber)) {
    conditions.push(`[Year] >= ${Math.round(minYearNumber)}`);
  }

  const maxYearNumber = toNumber(maxYear);
  if (Number.isFinite(maxYearNumber)) {
    conditions.push(`[Year] <= ${Math.round(maxYearNumber)}`);
  }

  const maxMileageNumber = toNumber(maxMileage);
  if (Number.isFinite(maxMileageNumber) && maxMileageNumber > 0) {
    conditions.push(`(Mileage IS NULL OR Mileage <= ${Math.round(maxMileageNumber * 1.25)})`);
  }

  const minDoorsNumber = toNumber(minDoors);
  if (Number.isFinite(minDoorsNumber) && minDoorsNumber > 0) {
    conditions.push(`(Doors IS NULL OR Doors >= ${Math.round(minDoorsNumber)})`);
  }

  const minSeatsNumber = toNumber(minSeats);
  if (Number.isFinite(minSeatsNumber) && minSeatsNumber > 0) {
    conditions.push(`(Seats IS NULL OR Seats >= ${Math.round(minSeatsNumber)})`);
  }

  const minPowerCvNumber = toNumber(minPowerCv);
  if (Number.isFinite(minPowerCvNumber) && minPowerCvNumber > 0) {
    conditions.push(`(PowerCv IS NULL OR PowerCv >= ${Math.round(minPowerCvNumber)})`);
  }

  const maxPowerCvNumber = toNumber(maxPowerCv);
  if (Number.isFinite(maxPowerCvNumber) && maxPowerCvNumber > 0) {
    conditions.push(`(PowerCv IS NULL OR PowerCv <= ${Math.round(maxPowerCvNumber)})`);
  }

  const minPriceNumber = toNumber(minPrice);
  const maxPriceNumber = toNumber(maxPrice);
  const priceField = normalizeToken(desiredType) === "renting" ? "MonthlyPrice" : "Price";
  if (Number.isFinite(minPriceNumber) && minPriceNumber > 0) {
    conditions.push(`COALESCE(${priceField}, 0) >= ${Number(minPriceNumber.toFixed(2))}`);
  }
  if (Number.isFinite(maxPriceNumber) && maxPriceNumber > 0) {
    conditions.push(`COALESCE(${priceField}, 0) <= ${Number(maxPriceNumber.toFixed(2))}`);
  }

  const normalizedModelTokens = (Array.isArray(modelTokens) ? modelTokens : [modelTokens])
    .map((item) => normalizeToken(item))
    .filter(Boolean)
    .slice(0, 8);
  if (normalizedModelTokens.length) {
    const modelConditions = normalizedModelTokens.map((token) => {
      const compactToken = normalizeCompactToken(token);
      const escapedToken = escapeSqlString(token);
      const compactCondition = compactToken.length >= 3
        ? `OR LOWER(REPLACE(REPLACE(REPLACE(CONCAT(COALESCE(Brand, N''), N' ', COALESCE(Model, N''), N' ', COALESCE(Version, N'')), N' ', N''), N'-', N''), N'_', N'')) LIKE N'%${escapeSqlString(compactToken)}%'`
        : "";
      return `(
        LOWER(CONCAT(COALESCE(Brand, N''), N' ', COALESCE(Model, N''), N' ', COALESCE(Version, N''))) LIKE N'%${escapedToken}%'
        ${compactCondition}
      )`;
    });
    conditions.push(`(${modelConditions.join(" OR ")})`);
  }

  return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
}

function readLocalInventory() {
  try {
    if (!fs.existsSync(LOCAL_INVENTORY_PATH)) {
      return [];
    }

    const raw = fs.readFileSync(LOCAL_INVENTORY_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.offers) ? parsed.offers : Array.isArray(parsed) ? parsed : [];
    return list.map(normalizeOffer).filter(Boolean);
  } catch {
    return [];
  }
}

async function readPostgresInventory(limit = 30000, modelTokens = []) {
  const pool = getPostgresPool();
  if (!pool) {
    return [];
  }

  try {
    const boundedLimit = Math.max(100, Math.min(limit, 100000));

    const selectCols = `
        portal,
        brand,
        model,
        version,
        fuel,
        transmission,
        COALESCE(body_type, '') AS body_type,
        COALESCE(environmental_label, '') AS environmental_label,
        year,
        mileage,
        doors,
        seats,
        power_cv,
        price,
        monthly_price,
        finance_price,
        url,
        COALESCE(province, COALESCE(location, '')) AS province,
        COALESCE(city, COALESCE(location, '')) AS city,
        color,
        COALESCE(seller_type, '') AS seller_type,
        COALESCE(traction, '') AS traction,
        COALESCE(displacement, '') AS displacement,
        COALESCE(co2, '') AS co2,
        COALESCE(power_kw::text, '') AS power_kw,
        COALESCE(consumption::text, '') AS consumption,
        COALESCE(dealer_name, '') AS dealer_name,
        warranty_months,
        COALESCE(next_itv, '') AS next_itv,
        COALESCE(image_url, '') AS image_url,
        CASE WHEN NULLIF(images, '[]') IS NOT NULL THEN images WHEN COALESCE(image_url, '') <> '' THEN json_build_array(image_url)::text ELSE '[]' END AS images,
        COALESCE(listing_type, 'compra') AS listing_type,
        updated_at,
        COALESCE(listed_at, scraped_at) AS listed_at`;

    // When model tokens are provided, run a targeted query to retrieve all matching
    // offers regardless of updated_at position, avoiding the generic limit window.
    const safeTokens = Array.isArray(modelTokens)
      ? modelTokens.map((t) => normalizeToken(t)).filter((t) => t.length >= 2)
      : [];

    if (safeTokens.length > 0) {
      const params = [boundedLimit];
      const sqlEscape = (s) => s.replace(/%/g, "\\%").replace(/_/g, "\\_");
      const conditions = safeTokens.flatMap((token) => {
        const combined = params.push(`%${sqlEscape(token)}%`);
        const combinedCond = `LOWER(CONCAT(COALESCE(brand,''), ' ', COALESCE(model,''), ' ', COALESCE(version,''))) LIKE $${combined}`;
        const words = token.split(/\s+/).filter((w) => w.length >= 2);
        if (words.length >= 2) {
          const wordConds = words.map((word) => {
            const idx = params.push(`%${sqlEscape(word)}%`);
            return `LOWER(CONCAT(COALESCE(brand,''), ' ', COALESCE(model,''), ' ', COALESCE(version,''))) LIKE $${idx}`;
          });
          return [`(${combinedCond} OR (${wordConds.join(" AND ")}))`];
        }
        return [combinedCond];
      });
      const targetedQuery = `
        SELECT ${selectCols}
        FROM moveadvisor_market_offers
        WHERE ${conditions.join(" OR ")}
        ORDER BY updated_at DESC NULLS LAST, scraped_at DESC NULLS LAST
        LIMIT $1
      `;
      try {
        const targetedResult = await pool.query(targetedQuery, params);
        const targetedList = (targetedResult.rows || []).map(normalizeOffer).filter(Boolean);
        if (targetedList.length > 0) {
          return targetedList;
        }
      } catch (err) {
        console.warn("[inventoryStore] targeted model query failed, falling back to generic:", err?.message);
      }
    }

    // Primary table used by current pipeline (Neon/Vercel)
    const modernQuery = `
      SELECT ${selectCols}
      FROM moveadvisor_market_offers
      ORDER BY updated_at DESC NULLS LAST, scraped_at DESC NULLS LAST
      LIMIT $1
    `;

    try {
      const modernResult = await pool.query(modernQuery, [boundedLimit]);
      const modernList = (modernResult.rows || []).map(normalizeOffer).filter(Boolean);
      if (modernList.length > 0) {
        return modernList;
      }
    } catch (err) {
      console.warn("[inventoryStore] moveadvisor_market_offers query failed, trying legacy table:", err?.message);
    }

    // Legacy table support (older deployments)
    const legacyQuery = `
      SELECT *
      FROM offers
      WHERE COALESCE(es_valida, true) = true
      ORDER BY fecha_ultima_actualizacion DESC NULLS LAST, fecha_scrape DESC NULLS LAST
      LIMIT $1
    `;
    const legacyResult = await pool.query(legacyQuery, [boundedLimit]);
    return (legacyResult.rows || []).map(normalizeOffer).filter(Boolean);
  } catch (err) {
    console.error("[inventoryStore] readPostgresInventory failed:", err?.message);
    return [];
  }
}

async function readSqlServerInventory(limit = 12000, filters = {}) {
  const connArgs = getSqlcmdConnectionArgs();
  if (!connArgs) {
    return [];
  }

  const sqlcmdPath = normalizeText(process.env.SQLCMD_PATH) || "sqlcmd";
  const boundedLimit = Math.max(100, Math.min(limit, 25000));
  const whereClause = buildSqlServerWhereClause(filters);
  const query = `
SET NOCOUNT ON;
IF OBJECT_ID(N'dbo.MoveAdvisorMarketOffers', N'U') IS NULL
BEGIN
  SELECT TOP (0)
    CAST(NULL AS NVARCHAR(80)) AS portal,
    CAST(NULL AS NVARCHAR(120)) AS brand,
    CAST(NULL AS NVARCHAR(140)) AS model,
    CAST(NULL AS NVARCHAR(180)) AS version,
    CAST(NULL AS NVARCHAR(60)) AS fuel,
    CAST(NULL AS NVARCHAR(60)) AS transmission,
    CAST(NULL AS NVARCHAR(80)) AS bodyType,
    CAST(NULL AS NVARCHAR(24)) AS environmentalLabel,
    CAST(NULL AS INT) AS [year],
    CAST(NULL AS INT) AS mileage,
    CAST(NULL AS INT) AS doors,
    CAST(NULL AS INT) AS seats,
    CAST(NULL AS INT) AS powerCv,
    CAST(NULL AS DECIMAL(18,2)) AS price,
    CAST(NULL AS DECIMAL(18,2)) AS monthlyPrice,
    CAST(NULL AS DECIMAL(18,2)) AS financePrice,
    CAST(NULL AS NVARCHAR(1000)) AS url,
    CAST(NULL AS NVARCHAR(120)) AS province,
    CAST(NULL AS NVARCHAR(120)) AS city,
    CAST(NULL AS NVARCHAR(60)) AS color,
    CAST(NULL AS NVARCHAR(40)) AS sellerType,
    CAST(NULL AS NVARCHAR(40)) AS traction,
    CAST(NULL AS NVARCHAR(40)) AS displacement,
    CAST(NULL AS NVARCHAR(40)) AS co2,
    CAST(NULL AS NVARCHAR(40)) AS powerKw,
    CAST(NULL AS NVARCHAR(40)) AS consumption,
    CAST(NULL AS NVARCHAR(160)) AS dealerName,
    CAST(NULL AS INT) AS warrantyMonths,
    CAST(NULL AS NVARCHAR(40)) AS nextITV,
    CAST(NULL AS NVARCHAR(1200)) AS image,
    CAST(NULL AS NVARCHAR(40)) AS listingType,
    CAST(NULL AS NVARCHAR(64)) AS updatedAt,
    CAST(NULL AS NVARCHAR(64)) AS listedAt
    FOR JSON PATH;
END
ELSE
BEGIN
  SELECT TOP (${boundedLimit})
    Portal AS portal,
    Brand AS brand,
    Model AS model,
    Version AS version,
    Fuel AS fuel,
    Transmission AS transmission,
    BodyType AS bodyType,
    EnvironmentalLabel AS environmentalLabel,
    [Year] AS [year],
    Mileage AS mileage,
    Doors AS doors,
    Seats AS seats,
    PowerCv AS powerCv,
    Price AS price,
    MonthlyPrice AS monthlyPrice,
    FinancePrice AS financePrice,
    Url AS url,
    Province AS province,
    City AS city,
    Color AS color,
    SellerType AS sellerType,
    Traction AS traction,
    Displacement AS displacement,
    Co2 AS co2,
    CAST(PowerKw AS NVARCHAR(40)) AS powerKw,
    Consumption AS consumption,
    DealerName AS dealerName,
    WarrantyMonths AS warrantyMonths,
    NextITV AS nextITV,
    ImageUrl AS image,
    ListingType AS listingType,
    CONVERT(VARCHAR(33), SourceUpdatedAt, 127) AS updatedAt,
    CONVERT(VARCHAR(33), ListedAt, 127) AS listedAt
  FROM dbo.MoveAdvisorMarketOffers
  ${whereClause}
  ORDER BY LastSeenAt DESC
  FOR JSON PATH;
END;
`;

  try {
    const output = execFileSync(sqlcmdPath, [...connArgs, "-Q", query], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    const rows = parseSqlcmdJsonOutput(output);
    const list = Array.isArray(rows) ? rows : [];
    return list.map(normalizeOffer).filter(Boolean);
  } catch {
    return [];
  }
}

function desiredTypeMatches(offer, desiredType) {
  if (desiredType === "renting") {
    if (offer.monthlyPrice && offer.monthlyPrice > 0) {
      return true;
    }

    return /rent|suscrip|alquiler|cuota/.test(offer.listingType || "");
  }

  if (offer.price && offer.price > 0) {
    return true;
  }

  return !/rent|suscrip|alquiler|cuota/.test(offer.listingType || "");
}

function scoreOfferForModels(offer, modelTokens = []) {
  if (!Array.isArray(modelTokens) || modelTokens.length === 0) {
    return 0;
  }

  const haystack = normalizeToken(`${offer.brand} ${offer.model} ${offer.version}`);
  const compactHaystack = normalizeCompactToken(`${offer.brand} ${offer.model} ${offer.version} ${offer.url || ""}`);
  return modelTokens.reduce((acc, token) => {
    const normalizedToken = normalizeToken(token);
    const compactToken = normalizeCompactToken(token);
    const matches = haystack.includes(normalizedToken)
      || (compactToken.length >= 3 && compactHaystack.includes(compactToken));
    return acc + (matches ? 1 : 0);
  }, 0);
}

function percentile(values, p) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) {
    return sorted[low];
  }

  const weight = index - low;
  return sorted[low] * (1 - weight) + sorted[high] * weight;
}

function toIsoOrEmpty(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function computeDaysOnMarket(offer) {
  const listedDate = new Date(offer.listedAt || offer.updatedAt || "");
  if (Number.isNaN(listedDate.getTime())) {
    return null;
  }

  const days = (Date.now() - listedDate.getTime()) / (1000 * 60 * 60 * 24);
  return Number.isFinite(days) && days >= 0 ? Math.round(days) : null;
}

function aggregateByPortal(offers, desiredType) {
  const groups = new Map();
  for (const offer of offers) {
    const key = normalizeText(offer.portal || "market") || "market";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(offer);
  }

  const rows = [];
  for (const [portal, list] of groups.entries()) {
    const prices = list
      .map((item) => (desiredType === "renting" ? item.monthlyPrice : item.price))
      .filter((value) => Number.isFinite(value) && value > 0);
    rows.push({
      portal,
      units: list.length,
      avgPrice: prices.length ? Math.round(prices.reduce((acc, value) => acc + value, 0) / prices.length) : null,
    });
  }

  return rows.sort((a, b) => b.units - a.units);
}

async function readInventoryUniverse(options = {}) {
  const preferredProvider = normalizeToken(process.env.INVENTORY_PROVIDER);
  const trySqlServerFirst = preferredProvider === "sqlserver" || preferredProvider === "mssql";

  if (trySqlServerFirst) {
    const fromSqlServer = await readSqlServerInventory(12000, options);
    if (fromSqlServer.length > 0) {
      return {
        offers: fromSqlServer,
        source: "sqlserver",
      };
    }
  }

  const pgModelTokens = Array.isArray(options.modelTokens) ? options.modelTokens : [];
  const fromPostgres = await readPostgresInventory(30000, pgModelTokens);
  if (fromPostgres.length > 0) {
    return {
      offers: fromPostgres,
      source: "postgres",
    };
  }

  const fromSqlServer = await readSqlServerInventory(12000, options);
  if (fromSqlServer.length > 0) {
    return {
      offers: fromSqlServer,
      source: "sqlserver",
    };
  }

  return {
    offers: readLocalInventory(),
    source: "local-json",
  };
}

async function listInventoryOffers(options = {}) {
  const {
    desiredType = "compra",
    brand = "",
    modelCandidates = [],
    version = "",
    fuel = "",
    transmission = "",
    bodyType = "",
    environmentalLabel = "",
    sellerType = "",
    traction = "",
    displacement = "",
    displacementMin = null,
    displacementMax = null,
    co2 = "",
    co2Min = null,
    co2Max = null,
    powerKw = "",
    powerKwMin = null,
    powerKwMax = null,
    consumption = "",
    consumptionMin = null,
    consumptionMax = null,
    maxYearDistance = 4,
    targetYear = null,
    minYear = null,
    maxYear = null,
    minMileage = null,
    maxMileage = null,
    minDoors = null,
    minSeats = null,
    minPowerCv = null,
    maxPowerCv = null,
    minPrice = null,
    maxPrice = null,
    location = "",
    city = "",
    color = "",
    limit = 20,
  } = options;

  const { offers, source } = await readInventoryUniverse({
    desiredType,
    modelTokens: modelCandidates,
    version,
    fuel,
    transmission,
    bodyType,
    environmentalLabel,
    sellerType,
    traction,
    displacement,
    displacementMin,
    displacementMax,
    co2,
    co2Min,
    co2Max,
    powerKw,
    powerKwMin,
    powerKwMax,
    consumption,
    consumptionMin,
    consumptionMax,
    maxYearDistance,
    targetYear,
    minYear,
    maxYear,
    maxMileage,
    minDoors,
    minSeats,
    minPowerCv,
    maxPowerCv,
    minPrice,
    maxPrice,
    location,
    city,
    color,
  });
  const modelTokens = (Array.isArray(modelCandidates) ? modelCandidates : [modelCandidates])
    .map((item) => normalizeToken(item))
    .filter(Boolean);
  const normalizedBrand = normalizeFilterToken(brand);
  const normalizedFuel = normalizeFilterToken(fuel);
  const normalizedVersion = normalizeToken(version);
  const normalizedTransmission = normalizeFilterToken(transmission);
  const normalizedBodyType = normalizeFilterToken(bodyType);
  const normalizedEnvironmentalLabel = normalizeFilterToken(environmentalLabel);
  const normalizedSellerType = normalizeFilterToken(sellerType);
  const normalizedTraction = normalizeFilterToken(traction);
  const normalizedDisplacement = normalizeFilterToken(displacement);
  const normalizedCo2 = normalizeFilterToken(co2);
  const normalizedPowerKw = normalizeFilterToken(powerKw);
  const normalizedConsumption = normalizeFilterToken(consumption);
  const normalizedLocation = normalizeFilterToken(location);
  const normalizedCity = normalizeFilterToken(city);
  const normalizedColor = normalizeToken(color);
  const maxMileageNumber = toNumber(maxMileage);
  const minMileageNumber = toNumber(minMileage);
  const targetYearNumber = toNumber(targetYear);
  const minYearNumber = toNumber(minYear);
  const maxYearNumber = toNumber(maxYear);
  const minDoorsNumber = toNumber(minDoors);
  const minSeatsNumber = toNumber(minSeats);
  const minPowerCvNumber = toNumber(minPowerCv);
  const maxPowerCvNumber = toNumber(maxPowerCv);
  const minPriceNumber = toNumber(minPrice);
  const maxPriceNumber = toNumber(maxPrice);
  const minDisplacementNumber = toNumber(displacementMin);
  const maxDisplacementNumber = toNumber(displacementMax);
  const minCo2Number = toNumber(co2Min);
  const maxCo2Number = toNumber(co2Max);
  const minPowerKwNumber = toNumber(powerKwMin);
  const maxPowerKwNumber = toNumber(powerKwMax);
  const minConsumptionNumber = toNumber(consumptionMin);
  const maxConsumptionNumber = toNumber(consumptionMax);

  const filtered = offers
    .filter((offer) => desiredTypeMatches(offer, desiredType))
    .filter((offer) => {
      if (normalizedBrand && !normalizeToken(offer.brand).includes(normalizedBrand)) {
        return false;
      }
      if (normalizedTransmission && !normalizeToken(offer.transmission).includes(normalizedTransmission)) {
        return false;
      }
      if (normalizedVersion && !normalizeToken(offer.version).includes(normalizedVersion)) {
        return false;
      }
      if (normalizedCity && !normalizeToken(offer.city).includes(normalizedCity)) {
        return false;
      }
      if (normalizedLocation) {
        const locationHaystack = normalizeToken(`${offer.province || ""} ${offer.city || ""}`);
        if (!locationHaystack || !locationHaystack.includes(normalizedLocation)) {
          return false;
        }
      }
      if (normalizedColor && !normalizeToken(offer.color).includes(normalizedColor)) {
        return false;
      }
      if (normalizedBodyType && !normalizeToken(offer.bodyType).includes(normalizedBodyType)) {
        return false;
      }
      if (normalizedEnvironmentalLabel && !normalizeToken(offer.environmentalLabel).includes(normalizedEnvironmentalLabel)) {
        return false;
      }
      if (normalizedSellerType && !normalizeToken(offer.sellerType).includes(normalizedSellerType)) {
        return false;
      }
      if (normalizedTraction && !normalizeToken(offer.traction).includes(normalizedTraction)) {
        return false;
      }
      if (normalizedDisplacement && !normalizeToken(offer.displacement).includes(normalizedDisplacement)) {
        return false;
      }
      if (normalizedCo2 && !normalizeToken(offer.co2).includes(normalizedCo2)) {
        return false;
      }
      if (normalizedPowerKw && !normalizeToken(offer.powerKw).includes(normalizedPowerKw)) {
        return false;
      }
      if (normalizedConsumption && !normalizeToken(offer.consumption).includes(normalizedConsumption)) {
        return false;
      }
      const hasDisplacementRange = Number.isFinite(minDisplacementNumber) || Number.isFinite(maxDisplacementNumber);
      const offerDisplacement = toNumber(offer.displacement);
      if (hasDisplacementRange && !Number.isFinite(offerDisplacement)) {
        return false;
      }
      if (Number.isFinite(minDisplacementNumber) && offerDisplacement < minDisplacementNumber) {
        return false;
      }
      if (Number.isFinite(maxDisplacementNumber) && offerDisplacement > maxDisplacementNumber) {
        return false;
      }
      const hasCo2Range = Number.isFinite(minCo2Number) || Number.isFinite(maxCo2Number);
      const offerCo2 = toNumber(offer.co2);
      if (hasCo2Range && !Number.isFinite(offerCo2)) {
        return false;
      }
      if (Number.isFinite(minCo2Number) && offerCo2 < minCo2Number) {
        return false;
      }
      if (Number.isFinite(maxCo2Number) && offerCo2 > maxCo2Number) {
        return false;
      }
      const hasPowerKwRange = Number.isFinite(minPowerKwNumber) || Number.isFinite(maxPowerKwNumber);
      const offerPowerKw = toNumber(offer.powerKw);
      if (hasPowerKwRange && !Number.isFinite(offerPowerKw)) {
        return false;
      }
      if (Number.isFinite(minPowerKwNumber) && offerPowerKw < minPowerKwNumber) {
        return false;
      }
      if (Number.isFinite(maxPowerKwNumber) && offerPowerKw > maxPowerKwNumber) {
        return false;
      }
      const hasConsumptionRange = Number.isFinite(minConsumptionNumber) || Number.isFinite(maxConsumptionNumber);
      const offerConsumption = toNumber(offer.consumption);
      if (hasConsumptionRange && !Number.isFinite(offerConsumption)) {
        return false;
      }
      if (Number.isFinite(minConsumptionNumber) && offerConsumption < minConsumptionNumber) {
        return false;
      }
      if (Number.isFinite(maxConsumptionNumber) && offerConsumption > maxConsumptionNumber) {
        return false;
      }
      if (Number.isFinite(minYearNumber) && Number.isFinite(offer.year) && offer.year < minYearNumber) {
        return false;
      }
      if (Number.isFinite(maxYearNumber) && Number.isFinite(offer.year) && offer.year > maxYearNumber) {
        return false;
      }
      if (Number.isFinite(minMileageNumber) && Number.isFinite(offer.mileage) && offer.mileage < minMileageNumber) {
        return false;
      }
      if (Number.isFinite(maxMileageNumber) && Number.isFinite(offer.mileage) && offer.mileage > maxMileageNumber) {
        return false;
      }
      if (Number.isFinite(minDoorsNumber) && Number.isFinite(offer.doors) && offer.doors < minDoorsNumber) {
        return false;
      }
      if (Number.isFinite(minSeatsNumber) && Number.isFinite(offer.seats) && offer.seats < minSeatsNumber) {
        return false;
      }
      if (Number.isFinite(minPowerCvNumber) && Number.isFinite(offer.powerCv) && offer.powerCv > 0 && offer.powerCv < minPowerCvNumber) {
        return false;
      }
      if (Number.isFinite(maxPowerCvNumber) && Number.isFinite(offer.powerCv) && offer.powerCv > 0 && offer.powerCv > maxPowerCvNumber) {
        return false;
      }

      const priceField = desiredType === "renting" ? "monthlyPrice" : "price";
      const offerPrice = toNumber(offer[priceField]);
      if (Number.isFinite(minPriceNumber) && Number.isFinite(offerPrice) && offerPrice < minPriceNumber) {
        return false;
      }
      if (Number.isFinite(maxPriceNumber) && Number.isFinite(offerPrice) && offerPrice > maxPriceNumber) {
        return false;
      }

      return true;
    })
    .map((offer) => {
      let score = scoreOfferForModels(offer, modelTokens);
      if (normalizedFuel && normalizeToken(offer.fuel).includes(normalizedFuel)) {
        score += 2;
      }
      if (normalizedLocation) {
        const locationHaystack = normalizeToken(`${offer.province} ${offer.city}`);
        if (locationHaystack.includes(normalizedLocation)) {
          score += 1;
        }
      }
      if (targetYearNumber && Number.isFinite(offer.year)) {
        const yearDistance = Math.abs(Number(offer.year) - targetYearNumber);
        if (yearDistance <= maxYearDistance) {
          score += 2;
        }
      }
      if (maxMileageNumber && Number.isFinite(offer.mileage)) {
        if (offer.mileage <= maxMileageNumber * 1.25) {
          score += 1;
        } else {
          score -= 1;
        }
      }

      return { ...offer, _score: score };
    })
    .filter((offer) => (modelTokens.length ? offer._score > 0 : true))
    .sort((left, right) => {
      if (right._score !== left._score) {
        return right._score - left._score;
      }

      const leftUpdated = new Date(left.updatedAt || 0).getTime();
      const rightUpdated = new Date(right.updatedAt || 0).getTime();
      return rightUpdated - leftUpdated;
    })
    .slice(0, Math.max(1, Math.min(limit, 5000)))
    .map(({ _score, ...offer }) => offer);

  return {
    offers: filtered,
    source,
    totalUniverse: offers.length,
  };
}

async function getMarketPriceSnapshot(options = {}) {
  const {
    brand = "",
    model = "",
    version = "",
    fuel = "",
    year = null,
    mileage = null,
    location = "",
    desiredType = "compra",
  } = options;

  const modelCandidates = [
    `${normalizeText(brand)} ${normalizeText(model)} ${normalizeText(version)}`.trim(),
    `${normalizeText(brand)} ${normalizeText(model)}`.trim(),
    normalizeText(model),
  ].filter(Boolean);

  const { offers, source, totalUniverse } = await listInventoryOffers({
    desiredType,
    modelCandidates,
    fuel,
    targetYear: year,
    maxMileage: mileage,
    location,
    limit: 400,
  });

  const priceField = desiredType === "renting" ? "monthlyPrice" : "price";
  const prices = offers
    .map((offer) => offer[priceField])
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const marketMean = prices.length
    ? Math.round(prices.reduce((acc, value) => acc + value, 0) / prices.length)
    : null;
  const marketMedian = percentile(prices, 0.5);
  const p25 = percentile(prices, 0.25);
  const p75 = percentile(prices, 0.75);

  const daysValues = offers
    .map((offer) => computeDaysOnMarket(offer))
    .filter((value) => Number.isFinite(value));
  const medianDays = percentile(daysValues, 0.5);

  const freshestOffer = offers[0] || null;

  return {
    source,
    totalUniverse,
    comparables: offers.length,
    market: {
      mean: Number.isFinite(marketMean) ? marketMean : null,
      median: Number.isFinite(marketMedian) ? Math.round(marketMedian) : null,
      p25: Number.isFinite(p25) ? Math.round(p25) : null,
      p75: Number.isFinite(p75) ? Math.round(p75) : null,
      daysOnMarketMedian: Number.isFinite(medianDays) ? Math.round(medianDays) : null,
      updatedAt: freshestOffer ? toIsoOrEmpty(freshestOffer.updatedAt || freshestOffer.listedAt) : "",
    },
    byPortal: aggregateByPortal(offers, desiredType),
    samples: offers.slice(0, 5),
  };
}

function buildMarketplaceVoId(offer = {}) {
  const explicitId = normalizeText(offer?.id);
  if (explicitId) {
    return explicitId;
  }

  const seed = [
    normalizeText(offer?.url),
    normalizeText(offer?.title),
    normalizeText(offer?.brand),
    normalizeText(offer?.model),
    String(toNumber(offer?.price) || ""),
    String(toNumber(offer?.year) || ""),
    String(toNumber(offer?.mileage) || ""),
  ].join("|");

  const safeSeed = seed || `${Date.now()}-${Math.random()}`;
  return `vo-${crypto.createHash("sha1").update(safeSeed).digest("hex").slice(0, 12)}`;
}

function normalizeMarketplaceVoOffer(raw = {}) {
  const brand = normalizeText(raw?.brand);
  const model = normalizeText(raw?.model);
  const title = normalizeText(raw?.title) || [brand, model, normalizeText(raw?.version)].filter(Boolean).join(" ");
  const price = toNumber(raw?.price);

  if (!brand || !model || !title || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  const year = toNumber(raw?.year);
  const mileage = toNumber(raw?.mileage);
  const displacement = toNumber(raw?.displacement);
  const warrantyMonths = Math.max(0, toNumber(raw?.warrantyMonths) || 0);
  const portalScore = Math.max(0, Math.min(100, Math.round(toNumber(raw?.portalScore) || 80)));

  return {
    id: buildMarketplaceVoId(raw),
    title,
    brand,
    model,
    price: Number(price),
    year: Number.isFinite(year) ? Math.round(year) : null,
    mileage: Number.isFinite(mileage) ? Math.round(mileage) : null,
    location: normalizeText(raw?.location),
    color: normalizeText(raw?.color),
    displacement: Number.isFinite(displacement) ? Math.round(displacement) : null,
    fuel: normalizeText(raw?.fuel),
    power: normalizeText(raw?.power),
    seller: normalizeText(raw?.seller),
    hasGuaranteeSeal: Boolean(raw?.hasGuaranteeSeal),
    portalScore,
    warrantyMonths,
    description: normalizeText(raw?.description),
    image: normalizeText(raw?.image),
    url: normalizeText(raw?.url),
    portal: normalizeText(raw?.portal),
    isActive: raw?.isActive === false ? false : true,
    matricula: normalizeText(raw?.matricula),
    peritajeUrl: normalizeText(raw?.peritajeUrl || raw?.peritaje_url),
    imageUrls: Array.isArray(raw?.imageUrls) ? raw.imageUrls : null,
    salePrice: raw?.salePrice != null ? Number(raw.salePrice) : null,
    internalLocation: normalizeText(raw?.internalLocation),
    version: normalizeText(raw?.version),
    transmission: normalizeText(raw?.transmission),
  };
}

async function ensureMarketplaceVoTablePostgres() {
  const pool = getPostgresPool();
  if (!pool) {
    return false;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_marketplace_vo_offers (
      id VARCHAR(64) PRIMARY KEY,
      title TEXT NOT NULL,
      brand VARCHAR(120) NOT NULL,
      model VARCHAR(140) NOT NULL,
      price NUMERIC(12,2) NOT NULL,
      year INTEGER,
      mileage INTEGER,
      location VARCHAR(160),
      color VARCHAR(80),
      displacement INTEGER,
      fuel VARCHAR(80),
      power VARCHAR(80),
      seller VARCHAR(160),
      has_guarantee_seal BOOLEAN DEFAULT FALSE,
      portal_score INTEGER DEFAULT 80,
      warranty_months INTEGER DEFAULT 0,
      description TEXT,
      image_url TEXT,
      source_url TEXT,
      portal VARCHAR(80),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS ix_marketplace_vo_offers_active ON moveadvisor_marketplace_vo_offers (is_active, portal_score DESC, updated_at DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_marketplace_vo_offers_brand_model ON moveadvisor_marketplace_vo_offers (brand, model)");
  await pool.query("CREATE INDEX IF NOT EXISTS ix_marketplace_vo_offers_price ON moveadvisor_marketplace_vo_offers (price)");

  // Renting columns — safe to run on existing tables
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS available_for_purchase BOOLEAN DEFAULT TRUE");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS renting_available BOOLEAN DEFAULT FALSE");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS renting_km_year INTEGER DEFAULT 15000");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS renting_12m NUMERIC(10,2)");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS renting_24m NUMERIC(10,2)");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS renting_36m NUMERIC(10,2)");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS renting_48m NUMERIC(10,2)");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS renting_60m NUMERIC(10,2)");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS image_urls TEXT");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS seller_type VARCHAR(20)");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS has_stock_management BOOLEAN DEFAULT FALSE");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS matricula VARCHAR(20)");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS peritaje_url TEXT");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2)");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS internal_location VARCHAR(160)");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS version VARCHAR(200)");
  await pool.query("ALTER TABLE moveadvisor_marketplace_vo_offers ADD COLUMN IF NOT EXISTS transmission VARCHAR(80)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_marketplace_vo_units (
      id VARCHAR(64) PRIMARY KEY,
      offer_id VARCHAR(64) NOT NULL REFERENCES moveadvisor_marketplace_vo_offers(id) ON DELETE CASCADE,
      color VARCHAR(80),
      mileage INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'available',
      notes TEXT,
      rented_at TIMESTAMPTZ,
      returned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS ix_vo_units_offer_id ON moveadvisor_marketplace_vo_units (offer_id, status)");

  return true;
}

async function upsertMarketplaceVoOffers(offers = []) {
  const pool = getPostgresPool();
  if (!pool) {
    return { ok: false, source: "no-postgres", upserted: 0 };
  }

  await ensureMarketplaceVoTablePostgres();
  const normalized = (Array.isArray(offers) ? offers : [])
    .map((item) => normalizeMarketplaceVoOffer(item))
    .filter(Boolean);

  if (normalized.length === 0) {
    return { ok: true, source: "postgres-marketplace-table", upserted: 0 };
  }

  await pool.query("BEGIN");
  try {
    for (const offer of normalized) {
      await pool.query(
        `
          INSERT INTO moveadvisor_marketplace_vo_offers (
            id,
            title,
            brand,
            model,
            price,
            year,
            mileage,
            location,
            color,
            displacement,
            fuel,
            power,
            seller,
            has_guarantee_seal,
            portal_score,
            warranty_months,
            description,
            image_url,
            source_url,
            portal,
            is_active,
            matricula,
            peritaje_url,
            image_urls,
            sale_price,
            internal_location,
            version,
            transmission,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            brand = EXCLUDED.brand,
            model = EXCLUDED.model,
            price = EXCLUDED.price,
            year = EXCLUDED.year,
            mileage = EXCLUDED.mileage,
            location = EXCLUDED.location,
            color = EXCLUDED.color,
            displacement = EXCLUDED.displacement,
            fuel = EXCLUDED.fuel,
            power = EXCLUDED.power,
            seller = EXCLUDED.seller,
            has_guarantee_seal = EXCLUDED.has_guarantee_seal,
            portal_score = EXCLUDED.portal_score,
            warranty_months = EXCLUDED.warranty_months,
            description = EXCLUDED.description,
            image_url = CASE WHEN EXCLUDED.image_url IS NOT NULL AND EXCLUDED.image_url <> '' THEN EXCLUDED.image_url ELSE moveadvisor_marketplace_vo_offers.image_url END,
            source_url = EXCLUDED.source_url,
            portal = EXCLUDED.portal,
            is_active = EXCLUDED.is_active,
            matricula = EXCLUDED.matricula,
            peritaje_url = EXCLUDED.peritaje_url,
            image_urls = CASE WHEN EXCLUDED.image_urls IS NOT NULL AND EXCLUDED.image_urls <> '[]' THEN EXCLUDED.image_urls ELSE moveadvisor_marketplace_vo_offers.image_urls END,
            sale_price = EXCLUDED.sale_price,
            internal_location = EXCLUDED.internal_location,
            version = EXCLUDED.version,
            transmission = EXCLUDED.transmission,
            updated_at = NOW()
        `,
        [
          offer.id,
          offer.title,
          offer.brand,
          offer.model,
          offer.price,
          offer.year,
          offer.mileage,
          offer.location || null,
          offer.color || null,
          offer.displacement,
          offer.fuel || null,
          offer.power || null,
          offer.seller || null,
          offer.hasGuaranteeSeal,
          offer.portalScore,
          offer.warrantyMonths,
          offer.description || null,
          offer.image || null,
          offer.url || null,
          offer.portal || null,
          offer.isActive,
          offer.matricula || null,
          offer.peritajeUrl || null,
          offer.imageUrls ? JSON.stringify(offer.imageUrls) : null,
          offer.salePrice != null ? offer.salePrice : null,
          offer.internalLocation || null,
          offer.version || null,
          offer.transmission || null,
        ]
      );
    }
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  return {
    ok: true,
    source: "postgres-marketplace-table",
    upserted: normalized.length,
  };
}

async function listMarketplaceVoOffers(options = {}) {
  const {
    limit = 50,
    offset = 0,
    onlyActive = true,
    query = "",
    brand = "",
    model = "",
    maxPrice = null,
    minYear = null,
    maxMileage = null,
    location = "",
    color = "",
    fuel = "",
    displacement = "",
    onlyGuaranteed = false,
    sort = "",
    modalityMode = "",
  } = options;

  const boundedLimit = Number(limit) > 0 ? Math.max(1, Math.min(Number(limit), 2500)) : 50;
  const boundedOffset = Number(offset) >= 0 ? Number(offset) : 0;
  const pool = getPostgresPool();
  if (!pool) {
    return {
      offers: [],
      source: "no-postgres",
      totalUniverse: 0,
    };
  }

  try {
    await ensureMarketplaceVoTablePostgres();

    const conditions = [];
    const values = [];

    if (onlyActive) conditions.push("o.is_active = TRUE");
    if (modalityMode === "compra") {
      conditions.push("o.available_for_purchase = TRUE");
    } else if (modalityMode === "renting") {
      conditions.push("o.renting_available = TRUE");
    }

    if (query) {
      values.push(`%${String(query).toLowerCase()}%`);
      conditions.push(`(lower(COALESCE(o.title,'')) LIKE $${values.length} OR lower(o.brand) LIKE $${values.length} OR lower(o.model) LIKE $${values.length} OR lower(COALESCE(o.location,'')) LIKE $${values.length} OR lower(COALESCE(o.fuel,'')) LIKE $${values.length})`);
    }
    if (maxPrice && Number(maxPrice) > 0) {
      values.push(Number(maxPrice));
      conditions.push(`COALESCE(o.sale_price, o.price) <= $${values.length}`);
    }
    if (minYear && Number(minYear) > 0) {
      values.push(Number(minYear));
      conditions.push(`o.year >= $${values.length}`);
    }
    if (maxMileage && Number(maxMileage) > 0) {
      values.push(Number(maxMileage));
      conditions.push(`o.mileage <= $${values.length}`);
    }
    if (brand) {
      values.push(String(brand).toLowerCase());
      conditions.push(`lower(COALESCE(o.brand,'')) = $${values.length}`);
    }
    if (model) {
      values.push(String(model).toLowerCase());
      conditions.push(`lower(COALESCE(o.model,'')) = $${values.length}`);
    }
    if (location) {
      values.push(String(location).toLowerCase());
      conditions.push(`lower(COALESCE(o.location,'')) = $${values.length}`);
    }
    if (color) {
      values.push(String(color).toLowerCase());
      conditions.push(`lower(COALESCE(o.color,'')) = $${values.length}`);
    }
    if (fuel) {
      values.push(String(fuel).toLowerCase());
      conditions.push(`lower(COALESCE(o.fuel,'')) = $${values.length}`);
    }
    if (displacement === "electric") {
      conditions.push("(o.displacement IS NULL OR o.displacement = 0)");
    } else if (displacement === "0_1200") {
      conditions.push("o.displacement > 0 AND o.displacement <= 1200");
    } else if (displacement === "1200_1600") {
      conditions.push("o.displacement > 1200 AND o.displacement <= 1600");
    } else if (displacement === "1600_2000") {
      conditions.push("o.displacement > 1600 AND o.displacement <= 2000");
    } else if (displacement === "2000_plus") {
      conditions.push("o.displacement > 2000");
    }
    if (onlyGuaranteed) {
      conditions.push("o.has_guarantee_seal = TRUE");
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM moveadvisor_marketplace_vo_offers o ${whereClause}`,
      values
    );
    const totalUniverse = Number(countResult?.rows?.[0]?.total || 0);

    if (totalUniverse <= 0) {
      return {
        offers: [],
        source: "postgres-marketplace-table",
        totalUniverse: 0,
      };
    }

    const sqlQuery = `
      SELECT
        o.id, o.title, o.brand, o.model, o.price, o.year, o.mileage, o.location,
        o.color, o.displacement, o.fuel, o.power, o.seller,
        o.has_guarantee_seal, o.portal_score, o.warranty_months, o.description,
        o.image_url, o.source_url, o.portal, o.matricula, o.peritaje_url,
        o.available_for_purchase, o.renting_available, o.renting_km_year,
        o.renting_12m, o.renting_24m, o.renting_36m, o.renting_48m, o.renting_60m,
        o.renting_prices_json,
        o.image_urls, o.has_stock_management, o.sale_price,
        o.transmission, o.version, o.internal_location, o.seller_type,
        (SELECT COUNT(*)::int FROM moveadvisor_marketplace_vo_units WHERE offer_id = o.id AND status = 'available') AS units_available,
        ARRAY(SELECT DISTINCT color FROM moveadvisor_marketplace_vo_units WHERE offer_id = o.id AND status = 'available' AND color IS NOT NULL AND color <> '' ORDER BY color) AS available_colors
      FROM moveadvisor_marketplace_vo_offers o
      ${whereClause}
      ORDER BY ${sort === "price_asc" ? "o.sale_price ASC NULLS LAST, o.price ASC" : sort === "price_desc" ? "o.sale_price DESC NULLS LAST, o.price DESC" : "o.portal_score DESC NULLS LAST, o.updated_at DESC NULLS LAST"}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    const rowsResult = await pool.query(sqlQuery, [...values, boundedLimit, boundedOffset]);

    const offers = (rowsResult.rows || []).map((row) => ({
      id: normalizeText(row.id),
      title: normalizeText(row.title),
      brand: normalizeText(row.brand),
      model: normalizeText(row.model),
      price: Number(toNumber(row.price) || 0),
      year: toNumber(row.year),
      mileage: toNumber(row.mileage) || 0,
      location: normalizeText(row.location),
      color: normalizeText(row.color),
      displacement: toNumber(row.displacement) || 0,
      fuel: normalizeText(row.fuel) || "Sin especificar",
      power: normalizeText(row.power),
      seller: normalizeText(row.seller) || "Portal",
      hasGuaranteeSeal: Boolean(row.has_guarantee_seal),
      portalScore: Math.max(0, Math.min(100, Math.round(toNumber(row.portal_score) || 80))),
      warrantyMonths: Math.max(0, Math.round(toNumber(row.warranty_months) || 0)),
      description: normalizeText(row.description),
      image: (() => { try { const a = JSON.parse(row.image_urls || '[]'); if (Array.isArray(a) && a.length) return normalizeText(a[0]); } catch {} return normalizeText(row.image_url); })(),
      url: normalizeText(row.source_url),
      portal: normalizeText(row.portal),
      availableForPurchase: row.available_for_purchase !== false,
      rentingAvailable: Boolean(row.renting_available),
      rentingKmYear: Number(toNumber(row.renting_km_year) || 15000),
      renting12m: toNumber(row.renting_12m) || null,
      renting24m: toNumber(row.renting_24m) || null,
      renting36m: toNumber(row.renting_36m) || null,
      renting48m: toNumber(row.renting_48m) || null,
      renting60m: toNumber(row.renting_60m) || null,
      rentingPricesJson: row.renting_prices_json || null,
      images: (() => { try { const a = JSON.parse(row.image_urls || '[]'); return Array.isArray(a) && a.length ? a : (row.image_url ? [normalizeText(row.image_url)] : []); } catch { return row.image_url ? [normalizeText(row.image_url)] : []; } })(),
      hasStockManagement: Boolean(row.has_stock_management),
      matricula: normalizeText(row.matricula),
      peritajeUrl: normalizeText(row.peritaje_url),
      salePrice: row.sale_price != null ? Number(row.sale_price) : null,
      unitsAvailable: Number(row.units_available || 0),
      availableColors: Array.isArray(row.available_colors) ? row.available_colors.filter(Boolean) : [],
      transmission: normalizeText(row.transmission) || null,
      version: normalizeText(row.version) || null,
      internalLocation: normalizeText(row.internal_location) || null,
      sellerType: normalizeText(row.seller_type) || null,
    }));

    return {
      offers,
      source: "postgres-marketplace-table",
      totalUniverse,
    };
  } catch {
    return {
      offers: [],
      source: "postgres-marketplace-table-error",
      totalUniverse: 0,
    };
  }
}

// Resolve brand/model against alias tables in PostgreSQL
async function resolveBrandWithAliases(inputBrand) {
  if (!inputBrand || typeof inputBrand !== "string") {
    return inputBrand;
  }

  const pool = getPostgresPool();
  if (!pool) {
    return inputBrand; // Fallback to input if no pool
  }

  try {
    const normalizeAliasToken = (text) => {
      const t = normalizeToken(text).toLowerCase();
      // Replicate the SQL function's logic: unaccent + replace non-alphanumeric
      return t.replace(/[^a-z0-9]+/g, "");
    };

    const aliasKey = normalizeAliasToken(inputBrand);
    if (!aliasKey) {
      return inputBrand;
    }

    const result = await pool.query(
      `SELECT canonical_name 
       FROM moveadvisor_brand_aliases 
       WHERE alias_key = $1 AND is_active = TRUE 
       LIMIT 1`,
      [aliasKey]
    );

    if (result.rows.length > 0) {
      return result.rows[0].canonical_name;
    }

    return inputBrand;
  } catch (error) {
    console.warn("Error resolving brand alias:", error.message);
    return inputBrand;
  }
}

// Resolve model against alias tables in PostgreSQL
async function resolveModelWithAliases(inputModel, canonicalBrand) {
  if (!inputModel || typeof inputModel !== "string") {
    return inputModel;
  }

  const pool = getPostgresPool();
  if (!pool) {
    return inputModel;
  }

  try {
    const normalizeAliasToken = (text) => {
      const t = normalizeToken(text).toLowerCase();
      return t.replace(/[^a-z0-9]+/g, "");
    };

    const modelAliasKey = normalizeAliasToken(inputModel);
    const brandKey = normalizeAliasToken(canonicalBrand || inputModel);

    if (!modelAliasKey) {
      return inputModel;
    }

    const result = await pool.query(
      `SELECT canonical_name 
       FROM moveadvisor_model_aliases 
       WHERE brand_key = $1 AND alias_key = $2 AND is_active = TRUE 
       LIMIT 1`,
      [brandKey, modelAliasKey]
    );

    if (result.rows.length > 0) {
      return result.rows[0].canonical_name;
    }

    return inputModel;
  } catch (error) {
    console.warn("Error resolving model alias:", error.message);
    return inputModel;
  }
}

const MARKETPLACE_VO_OFFER_SELECT = `
  SELECT o.id, o.title, o.brand, o.model, o.price, o.year, o.mileage, o.location, o.color,
         o.displacement, o.fuel, o.power, o.seller, o.has_guarantee_seal, o.portal_score,
         o.warranty_months, o.description, o.image_url, o.source_url, o.portal,
         o.available_for_purchase, o.renting_available, o.renting_km_year,
         o.renting_12m, o.renting_24m, o.renting_36m, o.renting_48m, o.renting_60m,
         o.image_urls, o.has_stock_management, o.sale_price,
         o.transmission, o.version, o.internal_location, o.seller_type,
         COALESCE(
           (SELECT json_agg(json_build_object('color', color, 'mileage', mileage) ORDER BY mileage)
            FROM moveadvisor_marketplace_vo_units
            WHERE offer_id = o.id AND status = 'available'),
           '[]'::json
         ) AS available_units_json
  FROM moveadvisor_marketplace_vo_offers o
`;

function mapMarketplaceVoRow(row) {
  if (!row) return null;
  return {
    id: normalizeText(row.id),
    title: normalizeText(row.title),
    brand: normalizeText(row.brand),
    model: normalizeText(row.model),
    price: Number(toNumber(row.price) || 0),
    year: toNumber(row.year),
    mileage: toNumber(row.mileage) || 0,
    location: normalizeText(row.location),
    color: normalizeText(row.color),
    displacement: toNumber(row.displacement) || 0,
    fuel: normalizeText(row.fuel) || "Sin especificar",
    power: normalizeText(row.power),
    seller: normalizeText(row.seller) || "Portal",
    hasGuaranteeSeal: Boolean(row.has_guarantee_seal),
    portalScore: Math.max(0, Math.min(100, Math.round(toNumber(row.portal_score) || 80))),
    warrantyMonths: Math.max(0, Math.round(toNumber(row.warranty_months) || 0)),
    description: normalizeText(row.description),
    image: (() => { try { const a = JSON.parse(row.image_urls || "[]"); if (Array.isArray(a) && a.length) return normalizeText(a[0]); } catch {} return normalizeText(row.image_url); })(),
    url: normalizeText(row.source_url),
    portal: normalizeText(row.portal),
    availableForPurchase: row.available_for_purchase !== false,
    rentingAvailable: Boolean(row.renting_available),
    rentingKmYear: Number(toNumber(row.renting_km_year) || 15000),
    renting12m: toNumber(row.renting_12m) || null,
    renting24m: toNumber(row.renting_24m) || null,
    renting36m: toNumber(row.renting_36m) || null,
    renting48m: toNumber(row.renting_48m) || null,
    renting60m: toNumber(row.renting_60m) || null,
    images: (() => { try { const a = JSON.parse(row.image_urls || "[]"); return Array.isArray(a) && a.length ? a : (row.image_url ? [normalizeText(row.image_url)] : []); } catch { return row.image_url ? [normalizeText(row.image_url)] : []; } })(),
    hasStockManagement: Boolean(row.has_stock_management),
    salePrice: row.sale_price != null ? Number(row.sale_price) : null,
    transmission: normalizeText(row.transmission) || null,
    version: normalizeText(row.version) || null,
    internalLocation: normalizeText(row.internal_location) || null,
    sellerType: normalizeText(row.seller_type) || null,
    availableUnits: Array.isArray(row.available_units_json) ? row.available_units_json : [],
  };
}

async function getMarketplaceVoOfferById(offerId) {
  if (!offerId) return null;
  const pool = getPostgresPool();
  if (!pool) return null;
  try {
    const result = await pool.query(
      `${MARKETPLACE_VO_OFFER_SELECT} WHERE o.id = $1 AND o.is_active = TRUE LIMIT 1`,
      [String(offerId)]
    );
    return mapMarketplaceVoRow(result.rows?.[0]);
  } catch {
    return null;
  }
}

async function getMarketplaceVoOfferByUrl(sourceUrl) {
  if (!sourceUrl) return null;
  const pool = getPostgresPool();
  if (!pool) return null;
  try {
    const result = await pool.query(
      `${MARKETPLACE_VO_OFFER_SELECT} WHERE o.source_url = $1 LIMIT 1`,
      [sourceUrl]
    );
    return mapMarketplaceVoRow(result.rows?.[0]);
  } catch {
    return null;
  }
}

async function listUserPublishedVehiclesForMarketplace(filters = {}) {
  const pool = getPostgresPool();
  if (!pool) return [];

  try {
    const conditions = [
      "vs.state = 'active_sale'",
      "v.price IS NOT NULL",
      "v.price > 0",
    ];
    const values = [];

    if (filters.query) {
      values.push(`%${filters.query.toLowerCase()}%`);
      conditions.push(`(lower(v.title) LIKE $${values.length} OR lower(v.brand) LIKE $${values.length} OR lower(v.model) LIKE $${values.length})`);
    }
    if (filters.brand) {
      values.push(filters.brand.toLowerCase());
      conditions.push(`lower(v.brand) = $${values.length}`);
    }
    if (filters.model) {
      values.push(filters.model.toLowerCase());
      conditions.push(`lower(v.model) = $${values.length}`);
    }
    if (filters.maxPrice) {
      values.push(Number(filters.maxPrice));
      conditions.push(`v.price <= $${values.length}`);
    }
    if (filters.minYear) {
      values.push(Number(filters.minYear));
      conditions.push(`v.year >= $${values.length}`);
    }
    if (filters.maxMileage) {
      values.push(Number(filters.maxMileage));
      conditions.push(`v.mileage <= $${values.length}`);
    }
    if (filters.fuel) {
      values.push(filters.fuel.toLowerCase());
      conditions.push(`lower(v.fuel) = $${values.length}`);
    }
    if (filters.color) {
      values.push(filters.color.toLowerCase());
      conditions.push(`lower(v.color) = $${values.length}`);
    }

    const sql = `
      SELECT
        v.id, v.title, v.brand, v.model, v.version,
        v.year, v.mileage, v.fuel, v.color,
        v.cv, v.transmission_type,
        v.vehicle_location, v.price, v.notes,
        v.plate, v.user_email, v.updated_at,
        vs.listing_url
      FROM moveadvisor_user_vehicles v
      INNER JOIN moveadvisor_user_vehicle_states vs ON vs.vehicle_id = v.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY v.updated_at DESC
      LIMIT 50
    `;

    const result = await pool.query(sql, values);

    return (result.rows || []).map((row) => ({
      id: `user_${normalizeText(row.id)}`,
      title: normalizeText(row.title) || [row.brand, row.model].filter(Boolean).join(" "),
      brand: normalizeText(row.brand),
      model: normalizeText(row.model),
      version: normalizeText(row.version) || null,
      price: Number(row.price) || 0,
      salePrice: null,
      year: Number(row.year) || 0,
      mileage: Number(row.mileage) || 0,
      location: normalizeText(row.vehicle_location),
      color: normalizeText(row.color),
      displacement: 0,
      fuel: normalizeText(row.fuel) || "Sin especificar",
      power: row.cv ? `${row.cv} CV` : "",
      seller: "Particular CarsWise",
      hasGuaranteeSeal: false,
      portalScore: 60,
      warrantyMonths: 0,
      description: normalizeText(row.notes),
      image: "",
      images: [],
      url: normalizeText(row.listing_url),
      portal: "CarsWise Particulares",
      availableForPurchase: true,
      rentingAvailable: false,
      hasStockManagement: false,
      unitsAvailable: 1,
      availableColors: [],
      transmission: normalizeText(row.transmission_type) || null,
      matricula: normalizeText(row.plate),
      sellerType: "particular",
      sourceType: "particulares",
    }));
  } catch {
    return [];
  }
}

module.exports = {
  listInventoryOffers,
  getMarketPriceSnapshot,
  listMarketplaceVoOffers,
  getMarketplaceVoOfferById,
  getMarketplaceVoOfferByUrl,
  upsertMarketplaceVoOffers,
  resolveBrandWithAliases,
  resolveModelWithAliases,
  listUserPublishedVehiclesForMarketplace,
};
