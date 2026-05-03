const fs = require("fs");
const path = require("path");
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
  const connectionString = normalizeText(process.env.DATABASE_URL || process.env.POSTGRES_URL);

  if (!connectionString) {
    return null;
  }

  if (!postgresPool) {
    postgresPool = new Pool({ connectionString });
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
  const dealerName = normalizeText(firstDefined(raw, ["dealerName", "dealer_name", "concesionario"]));
  const warrantyMonths = toNumber(firstDefined(raw, ["warrantyMonths", "warranty_months", "garantia_meses"]));
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
    url,
    province,
    city,
    color,
    sellerType,
    dealerName,
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

  const normalizedLocation = normalizeFilterToken(location);
  if (normalizedLocation) {
    const token = escapeSqlString(normalizedLocation);
    conditions.push(`(LOWER(COALESCE(Province, N'')) LIKE N'%${token}%' OR LOWER(COALESCE(City, N'')) LIKE N'%${token}%')`);
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

async function readPostgresInventory(limit = 12000) {
  const pool = getPostgresPool();
  if (!pool) {
    return [];
  }

  try {
    const boundedLimit = Math.max(100, Math.min(limit, 25000));

    // Primary table used by current pipeline (Neon/Vercel)
    const modernQuery = `
      SELECT
        portal,
        brand,
        model,
        version,
        fuel,
        transmission,
        ''::text AS body_type,
        ''::text AS environmental_label,
        year,
        mileage,
        NULL::int AS doors,
        NULL::int AS seats,
        NULL::int AS power_cv,
        price,
        NULL::numeric AS monthly_price,
        url,
        COALESCE(location, '') AS province,
        COALESCE(location, '') AS city,
        color,
        ''::text AS seller_type,
        ''::text AS dealer_name,
        NULL::int AS warranty_months,
        COALESCE(images, '[]') AS images,
        'compra'::text AS listing_type,
        updated_at,
        scraped_at
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
    } catch {
      // Fallback to legacy table below.
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
  } catch {
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
    CAST(NULL AS NVARCHAR(1000)) AS url,
    CAST(NULL AS NVARCHAR(120)) AS province,
    CAST(NULL AS NVARCHAR(120)) AS city,
    CAST(NULL AS NVARCHAR(60)) AS color,
    CAST(NULL AS NVARCHAR(40)) AS sellerType,
    CAST(NULL AS NVARCHAR(160)) AS dealerName,
    CAST(NULL AS INT) AS warrantyMonths,
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
    Url AS url,
    Province AS province,
    City AS city,
    Color AS color,
    SellerType AS sellerType,
    DealerName AS dealerName,
    WarrantyMonths AS warrantyMonths,
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
  const compactHaystack = normalizeCompactToken(`${offer.brand} ${offer.model} ${offer.version}`);
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

  const fromPostgres = await readPostgresInventory();
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
    modelCandidates = [],
    version = "",
    fuel = "",
    transmission = "",
    bodyType = "",
    environmentalLabel = "",
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
  const normalizedFuel = normalizeFilterToken(fuel);
  const normalizedVersion = normalizeToken(version);
  const normalizedTransmission = normalizeFilterToken(transmission);
  const normalizedBodyType = normalizeFilterToken(bodyType);
  const normalizedEnvironmentalLabel = normalizeFilterToken(environmentalLabel);
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

  const filtered = offers
    .filter((offer) => desiredTypeMatches(offer, desiredType))
    .filter((offer) => {
      if (normalizedTransmission && !normalizeToken(offer.transmission).includes(normalizedTransmission)) {
        return false;
      }
      if (normalizedVersion && !normalizeToken(offer.version).includes(normalizedVersion)) {
        return false;
      }
      if (normalizedCity && !normalizeToken(offer.city).includes(normalizedCity)) {
        return false;
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
      if (Number.isFinite(minPowerCvNumber) && Number.isFinite(offer.powerCv) && offer.powerCv < minPowerCvNumber) {
        return false;
      }
      if (Number.isFinite(maxPowerCvNumber) && Number.isFinite(offer.powerCv) && offer.powerCv > maxPowerCvNumber) {
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
    .slice(0, Math.max(1, Math.min(limit, 200)))
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

module.exports = {
  listInventoryOffers,
  getMarketPriceSnapshot,
};
