const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const sql = require("mssql");
const authHandler = require("./auth");

const USERS_DB_PATH = path.join(__dirname, "..", "data", "local-users.json");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getAuthProvider() {
  const provider = normalizeText(process.env.AUTH_PROVIDER).toLowerCase();

  if (["mssql", "sqlserver"].includes(provider)) {
    return "mssql";
  }

  if (["sqlcmd-windows", "windows", "mssql-windows"].includes(provider)) {
    return "sqlcmd-windows";
  }

  if (normalizeText(process.env.MSSQL_SERVER)) {
    return "mssql";
  }

  return "local";
}

function readLocalUsersCount() {
  if (!fs.existsSync(USERS_DB_PATH)) {
    return 0;
  }

  try {
    const raw = fs.readFileSync(USERS_DB_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return Array.isArray(parsed?.users) ? parsed.users.length : 0;
  } catch {
    return 0;
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
    mssqlPoolPromise = sql.connect(getMssqlConfig());
  }

  return mssqlPoolPromise;
}

async function getMssqlUsersCount() {
  const pool = await getMssqlPool();
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.MoveAdvisorUsers', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.MoveAdvisorUsers (
        Id NVARCHAR(64) NOT NULL PRIMARY KEY,
        Name NVARCHAR(120) NOT NULL,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        PasswordSalt NVARCHAR(64) NOT NULL,
        PasswordHash NVARCHAR(200) NOT NULL,
        CreatedAt DATETIME2 NOT NULL,
        LastLoginAt DATETIME2 NOT NULL
      );
      CREATE UNIQUE INDEX IX_MoveAdvisorUsers_Email ON dbo.MoveAdvisorUsers (Email);
    END
  `);

  const result = await pool.request().query("SELECT COUNT(1) AS total FROM dbo.MoveAdvisorUsers");
  return Number(result.recordset?.[0]?.total || 0);
}

function getSqlcmdUsersCount() {
  runSqlcmd(`
    IF OBJECT_ID(N'dbo.MoveAdvisorUsers', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.MoveAdvisorUsers (
        Id NVARCHAR(64) NOT NULL PRIMARY KEY,
        Name NVARCHAR(120) NOT NULL,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        PasswordSalt NVARCHAR(64) NOT NULL,
        PasswordHash NVARCHAR(200) NOT NULL,
        CreatedAt DATETIME2 NOT NULL,
        LastLoginAt DATETIME2 NOT NULL
      );
      CREATE UNIQUE INDEX IX_MoveAdvisorUsers_Email ON dbo.MoveAdvisorUsers (Email);
    END
  `);

  const output = runSqlcmd("SELECT COUNT(1) AS total FROM dbo.MoveAdvisorUsers FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;");
  const parsed = parseSqlcmdJsonOutput(output);
  return Number(parsed?.total || 0);
}

module.exports = async function authStatusHandler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const provider = getAuthProvider();
  const includeSecurity = normalizeText(req?.query?.security) === "1";
  const securitySnapshot = includeSecurity ? authHandler.getSecurityStatusSnapshot?.() : null;

  try {
    if (provider === "local") {
      return res.status(200).json({
        ok: true,
        provider,
        database: "local-json",
        usersCount: readLocalUsersCount(),
        ...(includeSecurity ? { security: securitySnapshot } : {}),
      });
    }

    if (provider === "sqlcmd-windows") {
      return res.status(200).json({
        ok: true,
        provider,
        server: normalizeText(process.env.MSSQL_SERVER) || "localhost\\SQLEXPRESS",
        database: normalizeText(process.env.MSSQL_DATABASE) || "Mobilityadvisor",
        usersCount: getSqlcmdUsersCount(),
        ...(includeSecurity ? { security: securitySnapshot } : {}),
      });
    }

    return res.status(200).json({
      ok: true,
      provider,
      server: normalizeText(process.env.MSSQL_SERVER),
      database: normalizeText(process.env.MSSQL_DATABASE),
      usersCount: await getMssqlUsersCount(),
      ...(includeSecurity ? { security: securitySnapshot } : {}),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      provider,
      error: error instanceof Error ? error.message : "No se pudo obtener el estado de auth.",
    });
  }
};