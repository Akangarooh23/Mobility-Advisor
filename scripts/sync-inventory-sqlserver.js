const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "data", "inventory-offers.json");

const MSSQL_SERVER = process.env.MSSQL_SERVER || "localhost\\SQLEXPRESS";
const MSSQL_DATABASE = process.env.MSSQL_DATABASE || "Mobilityadvisor";
const MSSQL_USER = String(process.env.MSSQL_USER || "").trim();
const MSSQL_PASSWORD = String(process.env.MSSQL_PASSWORD || "");
const SQLCMD_PATH = process.env.SQLCMD_PATH || "sqlcmd";
const SYNC_BATCH_SIZE = Math.max(100, Number.parseInt(process.env.INVENTORY_SYNC_BATCH_SIZE || "1000", 10) || 1000);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeSqlString(value) {
  return String(value || "").replace(/'/g, "''");
}

function sqlString(value) {
  return `N'${escapeSqlString(value)}'`;
}

function sqlNullableString(value) {
  const normalized = normalizeText(value);
  return normalized ? sqlString(normalized) : "NULL";
}

function sqlNullableInt(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(Math.round(numeric)) : "NULL";
}

function sqlNullableDecimal(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(Number(numeric.toFixed(2))) : "NULL";
}

function toIsoText(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function sqlNullableDate(value) {
  const iso = toIsoText(value);
  return iso ? sqlString(iso) : "NULL";
}

function runSqlFile(sqlText) {
  const tempPath = path.join(os.tmpdir(), `moveadvisor-inventory-sync-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);

  try {
    fs.writeFileSync(tempPath, sqlText, "utf8");
    const authArgs = MSSQL_USER ? ["-U", MSSQL_USER, "-P", MSSQL_PASSWORD] : ["-E"];
    return execFileSync(
      SQLCMD_PATH,
      ["-S", MSSQL_SERVER, "-d", MSSQL_DATABASE, ...authArgs, "-b", "-y", "0", "-i", tempPath],
      { encoding: "utf8", maxBuffer: 12 * 1024 * 1024 }
    );
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {}
  }
}

function parseJsonFromSqlcmd(output) {
  const flat = String(output || "")
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

function normalizeOffer(input = {}) {
  const url = normalizeText(input.url);
  if (!url) {
    return null;
  }

  const id = crypto.createHash("sha1").update(url.toLowerCase()).digest("hex");

  return {
    id,
    url,
    portal: normalizeText(input.portal) || "market",
    brand: normalizeText(input.brand),
    model: normalizeText(input.model),
    version: normalizeText(input.version),
    fuel: normalizeText(input.fuel),
    transmission: normalizeText(input.transmission),
    bodyType: normalizeText(input.bodyType),
    environmentalLabel: normalizeText(input.environmentalLabel),
    listingType: normalizeText(input.listingType) || "compra",
    province: normalizeText(input.province),
    city: normalizeText(input.city),
    color: normalizeText(input.color),
    sellerType: normalizeText(input.sellerType),
    dealerName: normalizeText(input.dealerName),
    image: normalizeText(input.image),
    title: normalizeText(input.title),
    price: Number.isFinite(Number(input.price)) ? Number(input.price) : null,
    monthlyPrice: Number.isFinite(Number(input.monthlyPrice)) ? Number(input.monthlyPrice) : null,
    year: Number.isFinite(Number(input.year)) ? Number(input.year) : null,
    mileage: Number.isFinite(Number(input.mileage)) ? Number(input.mileage) : null,
    doors: Number.isFinite(Number(input.doors)) ? Number(input.doors) : null,
    seats: Number.isFinite(Number(input.seats)) ? Number(input.seats) : null,
    powerCv: Number.isFinite(Number(input.powerCv)) ? Number(input.powerCv) : null,
    warrantyMonths: Number.isFinite(Number(input.warrantyMonths)) ? Number(input.warrantyMonths) : null,
    updatedAt: toIsoText(input.updatedAt),
    listedAt: toIsoText(input.listedAt),
    rawPayload: JSON.stringify(input || {}),
  };
}

function buildEnsureTableSql() {
  return `
IF OBJECT_ID(N'dbo.MoveAdvisorMarketOffers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorMarketOffers (
    Id NVARCHAR(40) NOT NULL PRIMARY KEY,
    Url NVARCHAR(1000) NOT NULL,
    Portal NVARCHAR(80) NOT NULL,
    Brand NVARCHAR(120) NOT NULL,
    Model NVARCHAR(140) NOT NULL,
    Version NVARCHAR(180) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Version DEFAULT (N''),
    Fuel NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Fuel DEFAULT (N''),
    Transmission NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Transmission DEFAULT (N''),
    BodyType NVARCHAR(80) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_BodyType DEFAULT (N''),
    EnvironmentalLabel NVARCHAR(24) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_EnvironmentalLabel DEFAULT (N''),
    ListingType NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_ListingType DEFAULT (N'compra'),
    Price DECIMAL(18,2) NULL,
    MonthlyPrice DECIMAL(18,2) NULL,
    [Year] INT NULL,
    Mileage INT NULL,
    Doors INT NULL,
    Seats INT NULL,
    PowerCv INT NULL,
    Province NVARCHAR(120) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Province DEFAULT (N''),
    City NVARCHAR(120) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_City DEFAULT (N''),
    Color NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Color DEFAULT (N''),
    SellerType NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_SellerType DEFAULT (N''),
    DealerName NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_DealerName DEFAULT (N''),
    WarrantyMonths INT NULL,
    ImageUrl NVARCHAR(1200) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_ImageUrl DEFAULT (N''),
    Title NVARCHAR(280) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Title DEFAULT (N''),
    ListedAt DATETIME2 NULL,
    SourceUpdatedAt DATETIME2 NULL,
    FirstSeenAt DATETIME2 NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_FirstSeenAt DEFAULT (SYSUTCDATETIME()),
    LastSeenAt DATETIME2 NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_LastSeenAt DEFAULT (SYSUTCDATETIME()),
    RawPayload NVARCHAR(MAX) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_RawPayload DEFAULT (N'{}')
  );
END;

IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'Transmission') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD Transmission NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Transmission_Migration DEFAULT (N'');
IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'BodyType') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD BodyType NVARCHAR(80) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_BodyType_Migration DEFAULT (N'');
IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'EnvironmentalLabel') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD EnvironmentalLabel NVARCHAR(24) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_EnvironmentalLabel_Migration DEFAULT (N'');
IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'Doors') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD Doors INT NULL;
IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'Seats') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD Seats INT NULL;
IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'PowerCv') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD PowerCv INT NULL;
IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'Color') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD Color NVARCHAR(60) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_Color_Migration DEFAULT (N'');
IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'SellerType') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD SellerType NVARCHAR(40) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_SellerType_Migration DEFAULT (N'');
IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'DealerName') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD DealerName NVARCHAR(160) NOT NULL CONSTRAINT DF_MoveAdvisorMarketOffers_DealerName_Migration DEFAULT (N'');
IF COL_LENGTH('dbo.MoveAdvisorMarketOffers', 'WarrantyMonths') IS NULL
  ALTER TABLE dbo.MoveAdvisorMarketOffers ADD WarrantyMonths INT NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'UX_MoveAdvisorMarketOffers_Url' AND object_id = OBJECT_ID(N'dbo.MoveAdvisorMarketOffers')
)
BEGIN
  CREATE UNIQUE INDEX UX_MoveAdvisorMarketOffers_Url ON dbo.MoveAdvisorMarketOffers (Url);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_MoveAdvisorMarketOffers_ListingType_Price' AND object_id = OBJECT_ID(N'dbo.MoveAdvisorMarketOffers')
)
BEGIN
  CREATE INDEX IX_MoveAdvisorMarketOffers_ListingType_Price ON dbo.MoveAdvisorMarketOffers (ListingType, Price, LastSeenAt DESC);
END;

IF OBJECT_ID(N'dbo.MoveAdvisorScrapingRuns', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MoveAdvisorScrapingRuns (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    StartedAt DATETIME2 NOT NULL,
    FinishedAt DATETIME2 NOT NULL,
    Mode NVARCHAR(20) NOT NULL,
    SelectedPlatforms NVARCHAR(MAX) NOT NULL,
    ReportJson NVARCHAR(MAX) NOT NULL,
    OffersCount INT NOT NULL,
    Message NVARCHAR(300) NOT NULL CONSTRAINT DF_MoveAdvisorScrapingRuns_Message DEFAULT (N'')
  );
END;
`;
}

function buildUpsertSql(offers) {
  const statements = offers.map((offer) => {
    return `
MERGE dbo.MoveAdvisorMarketOffers AS target
USING (
  SELECT
    ${sqlString(offer.id)} AS Id,
    ${sqlString(offer.url)} AS Url,
    ${sqlString(offer.portal)} AS Portal,
    ${sqlString(offer.brand)} AS Brand,
    ${sqlString(offer.model)} AS Model,
    ${sqlString(offer.version)} AS Version,
    ${sqlString(offer.fuel)} AS Fuel,
    ${sqlString(offer.transmission)} AS Transmission,
    ${sqlString(offer.bodyType)} AS BodyType,
    ${sqlString(offer.environmentalLabel)} AS EnvironmentalLabel,
    ${sqlString(offer.listingType)} AS ListingType,
    ${sqlNullableDecimal(offer.price)} AS Price,
    ${sqlNullableDecimal(offer.monthlyPrice)} AS MonthlyPrice,
    ${sqlNullableInt(offer.year)} AS [Year],
    ${sqlNullableInt(offer.mileage)} AS Mileage,
    ${sqlNullableInt(offer.doors)} AS Doors,
    ${sqlNullableInt(offer.seats)} AS Seats,
    ${sqlNullableInt(offer.powerCv)} AS PowerCv,
    ${sqlString(offer.province)} AS Province,
    ${sqlString(offer.city)} AS City,
    ${sqlString(offer.color)} AS Color,
    ${sqlString(offer.sellerType)} AS SellerType,
    ${sqlString(offer.dealerName)} AS DealerName,
    ${sqlNullableInt(offer.warrantyMonths)} AS WarrantyMonths,
    ${sqlString(offer.image)} AS ImageUrl,
    ${sqlString(offer.title)} AS Title,
    ${sqlNullableDate(offer.listedAt)} AS ListedAt,
    ${sqlNullableDate(offer.updatedAt)} AS SourceUpdatedAt,
    ${sqlString(offer.rawPayload)} AS RawPayload
) AS source
ON target.Url = source.Url
WHEN MATCHED THEN
  UPDATE SET
    target.Portal = source.Portal,
    target.Brand = source.Brand,
    target.Model = source.Model,
    target.Version = source.Version,
    target.Fuel = source.Fuel,
    target.Transmission = source.Transmission,
    target.BodyType = source.BodyType,
    target.EnvironmentalLabel = source.EnvironmentalLabel,
    target.ListingType = source.ListingType,
    target.Price = source.Price,
    target.MonthlyPrice = source.MonthlyPrice,
    target.[Year] = source.[Year],
    target.Mileage = source.Mileage,
    target.Doors = source.Doors,
    target.Seats = source.Seats,
    target.PowerCv = source.PowerCv,
    target.Province = source.Province,
    target.City = source.City,
    target.Color = source.Color,
    target.SellerType = source.SellerType,
    target.DealerName = source.DealerName,
    target.WarrantyMonths = source.WarrantyMonths,
    target.ImageUrl = source.ImageUrl,
    target.Title = source.Title,
    target.ListedAt = source.ListedAt,
    target.SourceUpdatedAt = source.SourceUpdatedAt,
    target.LastSeenAt = SYSUTCDATETIME(),
    target.RawPayload = source.RawPayload
WHEN NOT MATCHED THEN
  INSERT (
    Id, Url, Portal, Brand, Model, Version, Fuel, Transmission, BodyType, EnvironmentalLabel, ListingType,
    Price, MonthlyPrice, [Year], Mileage, Doors, Seats, PowerCv, Province, City, Color, SellerType, DealerName, WarrantyMonths,
    ImageUrl, Title, ListedAt, SourceUpdatedAt, FirstSeenAt, LastSeenAt, RawPayload
  )
  VALUES (
    source.Id, source.Url, source.Portal, source.Brand, source.Model, source.Version, source.Fuel, source.Transmission, source.BodyType, source.EnvironmentalLabel, source.ListingType,
    source.Price, source.MonthlyPrice, source.[Year], source.Mileage, source.Doors, source.Seats, source.PowerCv, source.Province, source.City, source.Color, source.SellerType, source.DealerName, source.WarrantyMonths,
    source.ImageUrl, source.Title, source.ListedAt, source.SourceUpdatedAt, SYSUTCDATETIME(), SYSUTCDATETIME(), source.RawPayload
  );`;
  });

  return statements.join("\n");
}

function buildRunSummarySql(payload, runOffers) {
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const startedAt = sqlNullableDate(payload?.generatedAt || new Date().toISOString());
  const finishedAt = sqlNullableDate(new Date().toISOString());
  const mode = sqlString(normalizeText(payload?.pipeline?.mode) || "live");
  const selected = sqlString(JSON.stringify(payload?.pipeline?.selected || []));
  const report = sqlString(JSON.stringify(payload?.pipeline?.report || []));
  const offersCount = sqlNullableInt(runOffers);

  return `
INSERT INTO dbo.MoveAdvisorScrapingRuns (
  Id, StartedAt, FinishedAt, Mode, SelectedPlatforms, ReportJson, OffersCount, Message
)
VALUES (
  ${sqlString(runId)},
  ${startedAt},
  ${finishedAt},
  ${mode},
  ${selected},
  ${report},
  ${offersCount},
  ${sqlString("inventory sync completed")}
);

SELECT
  (SELECT COUNT(*) FROM dbo.MoveAdvisorMarketOffers) AS totalOffers,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorMarketOffers WHERE DATEDIFF(HOUR, LastSeenAt, SYSUTCDATETIME()) <= 24) AS offersSeen24h,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorMarketOffers WHERE ListingType = N'compra') AS compraOffers,
  (SELECT COUNT(*) FROM dbo.MoveAdvisorMarketOffers WHERE ListingType = N'renting') AS rentingOffers,
  ${offersCount} AS runOffers
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
`;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function main() {
  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_INPUT;
  if (!fs.existsSync(inputPath)) {
    throw new Error(`No existe fichero de inventario: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const payload = JSON.parse(raw || "{}");
  const offers = (Array.isArray(payload?.offers) ? payload.offers : [])
    .map(normalizeOffer)
    .filter(Boolean);

  runSqlFile(buildEnsureTableSql());

  const chunks = chunkArray(offers, SYNC_BATCH_SIZE);
  for (let idx = 0; idx < chunks.length; idx += 1) {
    const chunkSql = buildUpsertSql(chunks[idx]);
    if (!chunkSql.trim()) {
      continue;
    }
    runSqlFile(chunkSql);
  }

  const summaryOutput = runSqlFile(buildRunSummarySql(payload, offers.length));
  const summary = parseJsonFromSqlcmd(summaryOutput) || {};

  console.log(`[inventory-sync] SQL Server: ${MSSQL_SERVER} / ${MSSQL_DATABASE}`);
  console.log(`[inventory-sync] Auth: ${MSSQL_USER ? "sql-login" : "windows-auth"}`);
  console.log(`[inventory-sync] Batch size: ${SYNC_BATCH_SIZE}`);
  console.log(`[inventory-sync] Input offers: ${offers.length}`);
  console.log(`[inventory-sync] Total rows: ${summary.totalOffers || 0}`);
  console.log(`[inventory-sync] Seen 24h: ${summary.offersSeen24h || 0}`);
  console.log(`[inventory-sync] Compra: ${summary.compraOffers || 0} | Renting: ${summary.rentingOffers || 0}`);
}

try {
  main();
} catch (error) {
  console.error("[inventory-sync] Error:", error?.message || error);
  if (error?.stdout) {
    console.error("[inventory-sync] sqlcmd stdout:\n" + String(error.stdout));
  }
  if (error?.stderr) {
    console.error("[inventory-sync] sqlcmd stderr:\n" + String(error.stderr));
  }
  process.exit(1);
}
