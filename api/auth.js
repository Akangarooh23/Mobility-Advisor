const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const sql = require("mssql");

// Neon injects DATABASE_URL; @vercel/postgres needs POSTGRES_URL — map it early
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL;
}

const USERS_DB_PATH = path.join(__dirname, "..", "data", "local-users.json");
const SESSIONS_DB_PATH = path.join(__dirname, "..", "data", "local-sessions.json");
const SESSION_COOKIE_NAME = "moveadvisor_session";
const SESSION_TTL_HOURS = Math.max(Number(process.env.AUTH_SESSION_TTL_HOURS || 24), 1);
const SESSION_CLEANUP_PROBABILITY = Math.min(Math.max(Number(process.env.AUTH_SESSION_CLEANUP_PROBABILITY || 0.2), 0), 1);
const SESSION_SECRET = normalizeText(process.env.AUTH_SESSION_SECRET) || "moveadvisor-local-session-secret";
const RESET_REQUEST_WINDOW_MS = Math.max(Number(process.env.AUTH_RESET_REQUEST_WINDOW_MS || 15 * 60 * 1000), 1_000);
const RESET_REQUEST_MAX_PER_EMAIL = Math.max(Number(process.env.AUTH_RESET_REQUEST_MAX_PER_EMAIL || 3), 1);
const RESET_REQUEST_MAX_PER_IP = Math.max(Number(process.env.AUTH_RESET_REQUEST_MAX_PER_IP || 10), 1);
const RESET_CONFIRM_WINDOW_MS = Math.max(Number(process.env.AUTH_RESET_CONFIRM_WINDOW_MS || 10 * 60 * 1000), 1_000);
const RESET_CONFIRM_MAX_PER_EMAIL = Math.max(Number(process.env.AUTH_RESET_CONFIRM_MAX_PER_EMAIL || 8), 1);
const RESET_CONFIRM_MAX_PER_IP = Math.max(Number(process.env.AUTH_RESET_CONFIRM_MAX_PER_IP || 20), 1);
const RESET_BACKOFF_BASE_MS = Math.max(Number(process.env.AUTH_RESET_BACKOFF_BASE_MS || 30_000), 1_000);
const RESET_BACKOFF_MAX_MS = Math.max(Number(process.env.AUTH_RESET_BACKOFF_MAX_MS || 15 * 60 * 1000), RESET_BACKOFF_BASE_MS);
const AUTH_SECURITY_LOG_ENABLED = String(process.env.AUTH_SECURITY_LOG_ENABLED || "true").toLowerCase() !== "false";
const AUTH_SECURITY_STATUS_ENABLED = String(process.env.AUTH_SECURITY_STATUS_ENABLED || "false").toLowerCase() === "true";

const resetRequestEmailLimiter = new Map();
const resetRequestIpLimiter = new Map();
const resetConfirmEmailLimiter = new Map();
const resetConfirmIpLimiter = new Map();
const resetRequestEmailBackoff = new Map();
const resetRequestIpBackoff = new Map();
const resetConfirmEmailBackoff = new Map();
const resetConfirmIpBackoff = new Map();

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function ensureUsersDb() {
  const dirPath = path.dirname(USERS_DB_PATH);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (!fs.existsSync(USERS_DB_PATH)) {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify({ users: [] }, null, 2), "utf8");
  }
}

function readUsersDb() {
  ensureUsersDb();

  try {
    const raw = fs.readFileSync(USERS_DB_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return Array.isArray(parsed?.users) ? parsed : { users: [] };
  } catch {
    return { users: [] };
  }
}

function writeUsersDb(db = { users: [] }) {
  ensureUsersDb();
  const safeDb = {
    users: Array.isArray(db?.users) ? db.users : [],
  };
  fs.writeFileSync(USERS_DB_PATH, JSON.stringify(safeDb, null, 2), "utf8");
}

function ensureSessionsDb() {
  const dirPath = path.dirname(SESSIONS_DB_PATH);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (!fs.existsSync(SESSIONS_DB_PATH)) {
    fs.writeFileSync(SESSIONS_DB_PATH, JSON.stringify({ sessions: [] }, null, 2), "utf8");
  }
}

function readSessionsDb() {
  ensureSessionsDb();

  try {
    const raw = fs.readFileSync(SESSIONS_DB_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return Array.isArray(parsed?.sessions) ? parsed : { sessions: [] };
  } catch {
    return { sessions: [] };
  }
}

function writeSessionsDb(db = { sessions: [] }) {
  ensureSessionsDb();
  const safeDb = {
    sessions: Array.isArray(db?.sessions) ? db.sessions : [],
  };
  fs.writeFileSync(SESSIONS_DB_PATH, JSON.stringify(safeDb, null, 2), "utf8");
}

function sanitizeUser(user = {}) {
  const email = normalizeText(user.email).toLowerCase();

  return {
    id: normalizeText(user.id) || `user:${email}`,
    name: normalizeText(user.name) || email.split("@")[0] || "Usuario",
    email,
    createdAt: normalizeText(user.createdAt),
    lastLoginAt: normalizeText(user.lastLoginAt),
  };
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password || ""), String(salt || ""), 64).toString("hex");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseBody(body) {
  if (body && typeof body === "object") {
    return body;
  }

  try {
    return JSON.parse(String(body || "{}"));
  } catch {
    return {};
  }
}

function hashSessionToken(token) {
  return crypto
    .createHash("sha256")
    .update(`${String(token || "")}|${SESSION_SECRET}`)
    .digest("hex");
}

function getSessionExpiryIso(hours = SESSION_TTL_HOURS) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();

      if (!key) {
        return acc;
      }

      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function buildSessionCookie(value, { maxAgeSeconds } = {}) {
  const shouldUseSecure = String(process.env.AUTH_COOKIE_SECURE || "false").toLowerCase() === "true";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value || "")}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (Number.isFinite(maxAgeSeconds)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  }

  if (shouldUseSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function setSessionCookie(res, cookieValue, { maxAgeSeconds } = {}) {
  res.setHeader("Set-Cookie", buildSessionCookie(cookieValue, { maxAgeSeconds }));
}

function clearSessionCookie(res) {
  setSessionCookie(res, "", { maxAgeSeconds: 0 });
}

function parseSessionCookieFromRequest(req) {
  const cookies = parseCookies(req?.headers?.cookie || "");
  const rawValue = normalizeText(cookies[SESSION_COOKIE_NAME]);

  if (!rawValue || !rawValue.includes(".")) {
    return null;
  }

  const [sessionId, token] = rawValue.split(".");
  if (!sessionId || !token) {
    return null;
  }

  return {
    sessionId: normalizeText(sessionId),
    token: normalizeText(token),
  };
}

function shouldRunSessionCleanup() {
  if (SESSION_CLEANUP_PROBABILITY <= 0) {
    return false;
  }

  if (SESSION_CLEANUP_PROBABILITY >= 1) {
    return true;
  }

  return Math.random() < SESSION_CLEANUP_PROBABILITY;
}

function getClientIp(req) {
  const forwardedFor = normalizeText(req?.headers?.["x-forwarded-for"] || req?.headers?.["X-Forwarded-For"]);
  if (forwardedFor) {
    return normalizeText(forwardedFor.split(",")[0]);
  }

  return normalizeText(req?.socket?.remoteAddress || req?.connection?.remoteAddress || "");
}

function consumeRateLimit(bucket, key, maxAttempts, windowMs) {
  const safeKey = normalizeText(key);

  if (!safeKey) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  const windowStart = now - windowMs;
  const previous = Array.isArray(bucket.get(safeKey)) ? bucket.get(safeKey) : [];
  const recent = previous.filter((timestamp) => Number(timestamp) >= windowStart);

  if (recent.length >= maxAttempts) {
    const oldestRecent = recent[0];
    const retryAfterMs = Math.max(0, windowMs - (now - oldestRecent));
    bucket.set(safeKey, recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recent.push(now);
  bucket.set(safeKey, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

function clearRateLimitKey(bucket, key) {
  const safeKey = normalizeText(key);
  if (!safeKey) {
    return;
  }

  bucket.delete(safeKey);
}

function readBackoff(backoffBucket, key) {
  const safeKey = normalizeText(key);

  if (!safeKey) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const current = backoffBucket.get(safeKey);
  if (!current || typeof current !== "object") {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const blockedUntil = Number(current.blockedUntil || 0);
  const now = Date.now();

  if (blockedUntil <= now) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((blockedUntil - now) / 1000));
  return { blocked: true, retryAfterSeconds };
}

function registerBackoffViolation(backoffBucket, key) {
  const safeKey = normalizeText(key);

  if (!safeKey) {
    return { retryAfterSeconds: 0 };
  }

  const now = Date.now();
  const current = backoffBucket.get(safeKey);
  const previousLevel = Number(current?.level || 0);
  const previousUntil = Number(current?.blockedUntil || 0);

  // If enough time passed since last block, start from level 1 again.
  const level = previousUntil > 0 && now > previousUntil + RESET_BACKOFF_MAX_MS ? 1 : previousLevel + 1;
  const safeLevel = Math.max(1, Math.min(level, 12));
  const penaltyMs = Math.min(RESET_BACKOFF_MAX_MS, RESET_BACKOFF_BASE_MS * 2 ** (safeLevel - 1));
  const blockedUntil = now + penaltyMs;

  backoffBucket.set(safeKey, {
    level: safeLevel,
    blockedUntil,
  });

  return {
    retryAfterSeconds: Math.max(1, Math.ceil(penaltyMs / 1000)),
  };
}

function clearBackoff(backoffBucket, key) {
  const safeKey = normalizeText(key);
  if (!safeKey) {
    return;
  }

  backoffBucket.delete(safeKey);
}

function maskEmail(email) {
  const normalized = normalizeText(email).toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return "";
  }

  const [localPart, domain] = normalized.split("@");
  if (!localPart || !domain) {
    return "";
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || "*"}*@${domain}`;
  }

  return `${localPart[0]}***${localPart.slice(-1)}@${domain}`;
}

function maskIp(ip) {
  const normalized = normalizeText(ip);
  if (!normalized) {
    return "";
  }

  if (normalized.includes(":")) {
    const chunks = normalized.split(":").filter(Boolean);
    if (!chunks.length) {
      return "***";
    }
    return `${chunks.slice(0, 2).join(":")}:***`;
  }

  if (normalized.includes(".")) {
    const chunks = normalized.split(".");
    if (chunks.length < 4) {
      return "***";
    }
    return `${chunks[0]}.${chunks[1]}.*.*`;
  }

  return "***";
}

function logAuthSecurity(event, details = {}) {
  if (!AUTH_SECURITY_LOG_ENABLED) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    area: "auth",
    event: normalizeText(event) || "unknown",
    ...details,
  };

  try {
    console.warn(`[MoveAdvisor][security] ${JSON.stringify(payload)}`);
  } catch {
    console.warn("[MoveAdvisor][security]", payload);
  }
}

function summarizeBackoffBucket(backoffBucket) {
  const now = Date.now();
  let activeBlocks = 0;

  for (const state of backoffBucket.values()) {
    if (Number(state?.blockedUntil || 0) > now) {
      activeBlocks += 1;
    }
  }

  return {
    trackedKeys: backoffBucket.size,
    activeBlocks,
  };
}

function summarizeLimiterBucket(limiterBucket, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  let keysWithRecentActivity = 0;
  let totalRecentAttempts = 0;

  for (const timestamps of limiterBucket.values()) {
    if (!Array.isArray(timestamps)) {
      continue;
    }

    const recentCount = timestamps.filter((timestamp) => Number(timestamp) >= windowStart).length;
    if (recentCount > 0) {
      keysWithRecentActivity += 1;
      totalRecentAttempts += recentCount;
    }
  }

  return {
    trackedKeys: limiterBucket.size,
    keysWithRecentActivity,
    totalRecentAttempts,
  };
}

function buildSecurityStatusSnapshot() {
  return {
    enabled: AUTH_SECURITY_STATUS_ENABLED,
    config: {
      resetRequestWindowMs: RESET_REQUEST_WINDOW_MS,
      resetRequestMaxPerEmail: RESET_REQUEST_MAX_PER_EMAIL,
      resetRequestMaxPerIp: RESET_REQUEST_MAX_PER_IP,
      resetConfirmWindowMs: RESET_CONFIRM_WINDOW_MS,
      resetConfirmMaxPerEmail: RESET_CONFIRM_MAX_PER_EMAIL,
      resetConfirmMaxPerIp: RESET_CONFIRM_MAX_PER_IP,
      resetBackoffBaseMs: RESET_BACKOFF_BASE_MS,
      resetBackoffMaxMs: RESET_BACKOFF_MAX_MS,
      authSecurityLogEnabled: AUTH_SECURITY_LOG_ENABLED,
    },
    request: {
      limiterByEmail: summarizeLimiterBucket(resetRequestEmailLimiter, RESET_REQUEST_WINDOW_MS),
      limiterByIp: summarizeLimiterBucket(resetRequestIpLimiter, RESET_REQUEST_WINDOW_MS),
      backoffByEmail: summarizeBackoffBucket(resetRequestEmailBackoff),
      backoffByIp: summarizeBackoffBucket(resetRequestIpBackoff),
    },
    confirm: {
      limiterByEmail: summarizeLimiterBucket(resetConfirmEmailLimiter, RESET_CONFIRM_WINDOW_MS),
      limiterByIp: summarizeLimiterBucket(resetConfirmIpLimiter, RESET_CONFIRM_WINDOW_MS),
      backoffByEmail: summarizeBackoffBucket(resetConfirmEmailBackoff),
      backoffByIp: summarizeBackoffBucket(resetConfirmIpBackoff),
    },
    generatedAt: new Date().toISOString(),
  };
}

function cleanupLimiterBucket(limiterBucket, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;

  for (const [key, timestamps] of limiterBucket.entries()) {
    if (!Array.isArray(timestamps)) {
      limiterBucket.delete(key);
      continue;
    }

    const recent = timestamps.filter((timestamp) => Number(timestamp) >= windowStart);
    if (!recent.length) {
      limiterBucket.delete(key);
      continue;
    }

    limiterBucket.set(key, recent);
  }
}

function cleanupBackoffBucket(backoffBucket) {
  const now = Date.now();

  for (const [key, state] of backoffBucket.entries()) {
    const blockedUntil = Number(state?.blockedUntil || 0);
    if (!blockedUntil || now > blockedUntil + RESET_BACKOFF_MAX_MS) {
      backoffBucket.delete(key);
    }
  }
}

function runSecurityMaintenance() {
  cleanupLimiterBucket(resetRequestEmailLimiter, RESET_REQUEST_WINDOW_MS);
  cleanupLimiterBucket(resetRequestIpLimiter, RESET_REQUEST_WINDOW_MS);
  cleanupLimiterBucket(resetConfirmEmailLimiter, RESET_CONFIRM_WINDOW_MS);
  cleanupLimiterBucket(resetConfirmIpLimiter, RESET_CONFIRM_WINDOW_MS);
  cleanupBackoffBucket(resetRequestEmailBackoff);
  cleanupBackoffBucket(resetRequestIpBackoff);
  cleanupBackoffBucket(resetConfirmEmailBackoff);
  cleanupBackoffBucket(resetConfirmIpBackoff);
}

let mssqlPoolPromise = null;
let _pgSql = null;

function getPgSql() {
  // @vercel/postgres requires POSTGRES_URL; fall back to DATABASE_URL (Neon integration default)
  if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
    process.env.POSTGRES_URL = process.env.DATABASE_URL;
  }

  if (!_pgSql) {
    try {
      _pgSql = require("@vercel/postgres").sql;
    } catch {
      throw new Error(
        "El paquete @vercel/postgres no está instalado. Ejecuta: npm install @vercel/postgres"
      );
    }
  }
  return _pgSql;
}

function getAuthProvider() {
  const provider = normalizeText(process.env.AUTH_PROVIDER).toLowerCase();

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

function shouldUseMssql() {
  return getAuthProvider() === "mssql";
}

function shouldUseSqlcmdWindows() {
  return getAuthProvider() === "sqlcmd-windows";
}

function shouldUsePostgres() {
  return getAuthProvider() === "postgres";
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
    port: Number.isFinite(port) ? port : 1433,
    options: {
      encrypt,
      trustServerCertificate,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

async function getMssqlPool() {
  if (!mssqlPoolPromise) {
    mssqlPoolPromise = sql.connect(getMssqlConfig());
  }

  return mssqlPoolPromise;
}

async function ensureMssqlSchema() {
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

    IF OBJECT_ID(N'dbo.MoveAdvisorSessions', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.MoveAdvisorSessions (
        Id NVARCHAR(64) NOT NULL PRIMARY KEY,
        UserId NVARCHAR(64) NOT NULL,
        TokenHash NVARCHAR(200) NOT NULL,
        CreatedAt DATETIME2 NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        LastSeenAt DATETIME2 NOT NULL,
        UserAgent NVARCHAR(255) NULL
      );

      CREATE INDEX IX_MoveAdvisorSessions_UserId ON dbo.MoveAdvisorSessions (UserId);
      CREATE INDEX IX_MoveAdvisorSessions_ExpiresAt ON dbo.MoveAdvisorSessions (ExpiresAt);
    END
  `);
}

async function findUserByEmailMssql(email) {
  await ensureMssqlSchema();
  const pool = await getMssqlPool();
  const result = await pool
    .request()
    .input("email", sql.NVarChar(255), email)
    .query(`
      SELECT TOP 1 Id, Name, Email, PasswordSalt, PasswordHash, CreatedAt, LastLoginAt
      FROM dbo.MoveAdvisorUsers
      WHERE Email = @email
    `);

  return result.recordset?.[0] || null;
}

async function createUserMssql(user) {
  await ensureMssqlSchema();
  const pool = await getMssqlPool();

  await pool
    .request()
    .input("id", sql.NVarChar(64), user.id)
    .input("name", sql.NVarChar(120), user.name)
    .input("email", sql.NVarChar(255), user.email)
    .input("passwordSalt", sql.NVarChar(64), user.passwordSalt)
    .input("passwordHash", sql.NVarChar(200), user.passwordHash)
    .input("createdAt", sql.DateTime2, new Date(user.createdAt))
    .input("lastLoginAt", sql.DateTime2, new Date(user.lastLoginAt))
    .query(`
      INSERT INTO dbo.MoveAdvisorUsers (Id, Name, Email, PasswordSalt, PasswordHash, CreatedAt, LastLoginAt)
      VALUES (@id, @name, @email, @passwordSalt, @passwordHash, @createdAt, @lastLoginAt)
    `);

  return findUserByEmailMssql(user.email);
}

async function findUserByIdMssql(id) {
  await ensureMssqlSchema();
  const pool = await getMssqlPool();
  const result = await pool
    .request()
    .input("id", sql.NVarChar(64), id)
    .query(`
      SELECT TOP 1 Id, Name, Email, PasswordSalt, PasswordHash, CreatedAt, LastLoginAt
      FROM dbo.MoveAdvisorUsers
      WHERE Id = @id
    `);

  return result.recordset?.[0] || null;
}

async function updateLastLoginMssql(id) {
  await ensureMssqlSchema();
  const pool = await getMssqlPool();
  const now = new Date();

  await pool
    .request()
    .input("id", sql.NVarChar(64), id)
    .input("lastLoginAt", sql.DateTime2, now)
    .query(`
      UPDATE dbo.MoveAdvisorUsers
      SET LastLoginAt = @lastLoginAt
      WHERE Id = @id
    `);

  return now.toISOString();
}

async function createSessionMssql(session) {
  await ensureMssqlSchema();
  const pool = await getMssqlPool();

  await pool
    .request()
    .input("id", sql.NVarChar(64), session.id)
    .input("userId", sql.NVarChar(64), session.userId)
    .input("tokenHash", sql.NVarChar(200), session.tokenHash)
    .input("createdAt", sql.DateTime2, new Date(session.createdAt))
    .input("expiresAt", sql.DateTime2, new Date(session.expiresAt))
    .input("lastSeenAt", sql.DateTime2, new Date(session.lastSeenAt))
    .input("userAgent", sql.NVarChar(255), session.userAgent || null)
    .query(`
      INSERT INTO dbo.MoveAdvisorSessions (Id, UserId, TokenHash, CreatedAt, ExpiresAt, LastSeenAt, UserAgent)
      VALUES (@id, @userId, @tokenHash, @createdAt, @expiresAt, @lastSeenAt, @userAgent)
    `);
}

async function findSessionByIdMssql(id) {
  await ensureMssqlSchema();
  const pool = await getMssqlPool();
  const result = await pool
    .request()
    .input("id", sql.NVarChar(64), id)
    .query(`
      SELECT TOP 1 Id, UserId, TokenHash, CreatedAt, ExpiresAt, LastSeenAt, UserAgent
      FROM dbo.MoveAdvisorSessions
      WHERE Id = @id
    `);

  return result.recordset?.[0] || null;
}

async function updateSessionLastSeenMssql(id) {
  await ensureMssqlSchema();
  const pool = await getMssqlPool();
  const now = new Date();

  await pool
    .request()
    .input("id", sql.NVarChar(64), id)
    .input("lastSeenAt", sql.DateTime2, now)
    .query(`
      UPDATE dbo.MoveAdvisorSessions
      SET LastSeenAt = @lastSeenAt
      WHERE Id = @id
    `);
}

async function deleteSessionByIdMssql(id) {
  await ensureMssqlSchema();
  const pool = await getMssqlPool();

  await pool
    .request()
    .input("id", sql.NVarChar(64), id)
    .query("DELETE FROM dbo.MoveAdvisorSessions WHERE Id = @id");
}

async function deleteExpiredSessionsMssql() {
  await ensureMssqlSchema();
  const pool = await getMssqlPool();

  await pool.request().query(`
    DELETE FROM dbo.MoveAdvisorSessions
    WHERE ExpiresAt <= SYSUTCDATETIME()
  `);
}

function escapeSqlValue(value) {
  return String(value || "").replace(/'/g, "''");
}

function getSqlcmdPath() {
  return normalizeText(process.env.SQLCMD_PATH) || "sqlcmd";
}

function getSqlcmdConnectionArgs(database) {
  const server = normalizeText(process.env.MSSQL_SERVER) || "localhost\\SQLEXPRESS";
  const dbName = normalizeText(database) || normalizeText(process.env.MSSQL_DATABASE) || "Mobilityadvisor";

  return ["-S", server, "-d", dbName, "-E", "-b", "-y", "0"];
}

function runSqlcmd(query, { database } = {}) {
  const args = [...getSqlcmdConnectionArgs(database), "-Q", query];

  try {
    return execFileSync(getSqlcmdPath(), args, { encoding: "utf8" });
  } catch (error) {
    const stderr = normalizeText(error?.stderr || "");
    const stdout = normalizeText(error?.stdout || "");
    throw new Error(stderr || stdout || "Error ejecutando sqlcmd con autenticación de Windows.");
  }
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

function ensureSqlcmdSchema() {
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

    IF OBJECT_ID(N'dbo.MoveAdvisorSessions', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.MoveAdvisorSessions (
        Id NVARCHAR(64) NOT NULL PRIMARY KEY,
        UserId NVARCHAR(64) NOT NULL,
        TokenHash NVARCHAR(200) NOT NULL,
        CreatedAt DATETIME2 NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        LastSeenAt DATETIME2 NOT NULL,
        UserAgent NVARCHAR(255) NULL
      );

      CREATE INDEX IX_MoveAdvisorSessions_UserId ON dbo.MoveAdvisorSessions (UserId);
      CREATE INDEX IX_MoveAdvisorSessions_ExpiresAt ON dbo.MoveAdvisorSessions (ExpiresAt);
    END
  `);
}

function findUserByEmailSqlcmd(email) {
  ensureSqlcmdSchema();
  const safeEmail = escapeSqlValue(email);
  const output = runSqlcmd(`
    SELECT TOP 1
      Id AS id,
      Name AS name,
      Email AS email,
      PasswordSalt AS passwordSalt,
      PasswordHash AS passwordHash,
      CreatedAt AS createdAt,
      LastLoginAt AS lastLoginAt
    FROM dbo.MoveAdvisorUsers
    WHERE Email = N'${safeEmail}'
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);

  return parseSqlcmdJsonOutput(output);
}

function createUserSqlcmd(user) {
  ensureSqlcmdSchema();

  runSqlcmd(`
    INSERT INTO dbo.MoveAdvisorUsers (Id, Name, Email, PasswordSalt, PasswordHash, CreatedAt, LastLoginAt)
    VALUES (
      N'${escapeSqlValue(user.id)}',
      N'${escapeSqlValue(user.name)}',
      N'${escapeSqlValue(user.email)}',
      N'${escapeSqlValue(user.passwordSalt)}',
      N'${escapeSqlValue(user.passwordHash)}',
      '${escapeSqlValue(user.createdAt)}',
      '${escapeSqlValue(user.lastLoginAt)}'
    );
  `);

  return findUserByEmailSqlcmd(user.email) || user;
}

function findUserByIdSqlcmd(id) {
  ensureSqlcmdSchema();
  const output = runSqlcmd(`
    SELECT TOP 1
      Id AS id,
      Name AS name,
      Email AS email,
      PasswordSalt AS passwordSalt,
      PasswordHash AS passwordHash,
      CreatedAt AS createdAt,
      LastLoginAt AS lastLoginAt
    FROM dbo.MoveAdvisorUsers
    WHERE Id = N'${escapeSqlValue(id)}'
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);

  return parseSqlcmdJsonOutput(output);
}

function updateLastLoginSqlcmd(id) {
  ensureSqlcmdSchema();
  const now = new Date().toISOString();

  runSqlcmd(`
    UPDATE dbo.MoveAdvisorUsers
    SET LastLoginAt = '${escapeSqlValue(now)}'
    WHERE Id = N'${escapeSqlValue(id)}';
  `);

  return now;
}

function createSessionSqlcmd(session) {
  ensureSqlcmdSchema();

  runSqlcmd(`
    INSERT INTO dbo.MoveAdvisorSessions (Id, UserId, TokenHash, CreatedAt, ExpiresAt, LastSeenAt, UserAgent)
    VALUES (
      N'${escapeSqlValue(session.id)}',
      N'${escapeSqlValue(session.userId)}',
      N'${escapeSqlValue(session.tokenHash)}',
      '${escapeSqlValue(session.createdAt)}',
      '${escapeSqlValue(session.expiresAt)}',
      '${escapeSqlValue(session.lastSeenAt)}',
      ${session.userAgent ? `N'${escapeSqlValue(session.userAgent)}'` : "NULL"}
    );
  `);
}

function findSessionByIdSqlcmd(id) {
  ensureSqlcmdSchema();
  const output = runSqlcmd(`
    SELECT TOP 1
      Id AS id,
      UserId AS userId,
      TokenHash AS tokenHash,
      CreatedAt AS createdAt,
      ExpiresAt AS expiresAt,
      LastSeenAt AS lastSeenAt,
      UserAgent AS userAgent
    FROM dbo.MoveAdvisorSessions
    WHERE Id = N'${escapeSqlValue(id)}'
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);

  return parseSqlcmdJsonOutput(output);
}

function updateSessionLastSeenSqlcmd(id) {
  ensureSqlcmdSchema();

  runSqlcmd(`
    UPDATE dbo.MoveAdvisorSessions
    SET LastSeenAt = '${escapeSqlValue(new Date().toISOString())}'
    WHERE Id = N'${escapeSqlValue(id)}';
  `);
}

function deleteSessionByIdSqlcmd(id) {
  ensureSqlcmdSchema();

  runSqlcmd(`
    DELETE FROM dbo.MoveAdvisorSessions
    WHERE Id = N'${escapeSqlValue(id)}';
  `);
}

function deleteExpiredSessionsSqlcmd() {
  ensureSqlcmdSchema();

  runSqlcmd(`
    DELETE FROM dbo.MoveAdvisorSessions
    WHERE ExpiresAt <= SYSUTCDATETIME();
  `);
}

// ─── PostgreSQL (Neon / Vercel Postgres) ─────────────────────────────────────

async function ensurePostgresSchema() {
  const sql = getPgSql();

  await sql`
    CREATE TABLE IF NOT EXISTS moveadvisor_users (
      id          VARCHAR(64)  PRIMARY KEY,
      name        VARCHAR(120) NOT NULL,
      email       VARCHAR(255) NOT NULL UNIQUE,
      password_salt VARCHAR(64)  NOT NULL,
      password_hash VARCHAR(200) NOT NULL,
      created_at  TIMESTAMPTZ  NOT NULL,
      last_login_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS moveadvisor_sessions (
      id           VARCHAR(64)  PRIMARY KEY,
      user_id      VARCHAR(64)  NOT NULL,
      token_hash   VARCHAR(200) NOT NULL,
      created_at   TIMESTAMPTZ  NOT NULL,
      expires_at   TIMESTAMPTZ  NOT NULL,
      last_seen_at TIMESTAMPTZ  NOT NULL,
      user_agent   VARCHAR(255)
    )
  `;
}

async function findUserByEmailPostgres(email) {
  await ensurePostgresSchema();
  const sql = getPgSql();
  const { rows } = await sql`
    SELECT id, name, email, password_salt AS "passwordSalt", password_hash AS "passwordHash",
           created_at AS "createdAt", last_login_at AS "lastLoginAt"
    FROM moveadvisor_users
    WHERE email = ${email}
    LIMIT 1
  `;

  return rows[0] || null;
}

async function createUserPostgres(user) {
  await ensurePostgresSchema();
  const sql = getPgSql();

  await sql`
    INSERT INTO moveadvisor_users (id, name, email, password_salt, password_hash, created_at, last_login_at)
    VALUES (${user.id}, ${user.name}, ${user.email}, ${user.passwordSalt}, ${user.passwordHash},
            ${user.createdAt}, ${user.lastLoginAt})
  `;

  return findUserByEmailPostgres(user.email);
}

async function findUserByIdPostgres(id) {
  await ensurePostgresSchema();
  const sql = getPgSql();
  const { rows } = await sql`
    SELECT id, name, email, password_salt AS "passwordSalt", password_hash AS "passwordHash",
           created_at AS "createdAt", last_login_at AS "lastLoginAt"
    FROM moveadvisor_users
    WHERE id = ${id}
    LIMIT 1
  `;

  return rows[0] || null;
}

async function updateLastLoginPostgres(id) {
  await ensurePostgresSchema();
  const sql = getPgSql();
  const now = new Date().toISOString();

  await sql`
    UPDATE moveadvisor_users
    SET last_login_at = ${now}
    WHERE id = ${id}
  `;

  return now;
}

async function createSessionPostgres(session) {
  await ensurePostgresSchema();
  const sql = getPgSql();

  await sql`
    INSERT INTO moveadvisor_sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent)
    VALUES (${session.id}, ${session.userId}, ${session.tokenHash}, ${session.createdAt},
            ${session.expiresAt}, ${session.lastSeenAt}, ${session.userAgent || null})
  `;
}

async function findSessionByIdPostgres(id) {
  await ensurePostgresSchema();
  const sql = getPgSql();
  const { rows } = await sql`
    SELECT id, user_id AS "userId", token_hash AS "tokenHash",
           created_at AS "createdAt", expires_at AS "expiresAt",
           last_seen_at AS "lastSeenAt", user_agent AS "userAgent"
    FROM moveadvisor_sessions
    WHERE id = ${id}
    LIMIT 1
  `;

  return rows[0] || null;
}

async function updateSessionLastSeenPostgres(id) {
  await ensurePostgresSchema();
  const sql = getPgSql();

  await sql`
    UPDATE moveadvisor_sessions
    SET last_seen_at = ${new Date().toISOString()}
    WHERE id = ${id}
  `;
}

async function deleteSessionByIdPostgres(id) {
  await ensurePostgresSchema();
  const sql = getPgSql();

  await sql`DELETE FROM moveadvisor_sessions WHERE id = ${id}`;
}

async function deleteExpiredSessionsPostgres() {
  await ensurePostgresSchema();
  const sql = getPgSql();

  await sql`DELETE FROM moveadvisor_sessions WHERE expires_at <= NOW()`;
}

async function findValidResetPostgres({ userId, tokenHash }) {
  await ensurePostgresSchema();
  const sql = getPgSql();
  const { rows } = await sql`
    SELECT id
    FROM moveadvisor_sessions
    WHERE user_id  = ${userId}
      AND token_hash = ${tokenHash}
      AND user_agent = 'RESET'
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return normalizeText(rows[0]?.id);
}

async function updateUserPasswordPostgres({ userId, passwordSalt, passwordHash }) {
  await ensurePostgresSchema();
  const sql = getPgSql();

  await sql`
    UPDATE moveadvisor_users
    SET password_salt  = ${passwordSalt},
        password_hash  = ${passwordHash},
        last_login_at  = ${new Date().toISOString()}
    WHERE id = ${userId}
  `;
}

// ─────────────────────────────────────────────────────────────────────────────

function createSessionLocal(session) {
  const db = readSessionsDb();
  db.sessions = [session, ...db.sessions.filter((item) => item.id !== session.id)].slice(0, 200);
  writeSessionsDb(db);
}

function findSessionByIdLocal(id) {
  const db = readSessionsDb();
  return db.sessions.find((item) => normalizeText(item?.id) === normalizeText(id)) || null;
}

function updateSessionLastSeenLocal(id) {
  const db = readSessionsDb();
  const idx = db.sessions.findIndex((item) => normalizeText(item?.id) === normalizeText(id));

  if (idx >= 0) {
    db.sessions[idx] = {
      ...db.sessions[idx],
      lastSeenAt: new Date().toISOString(),
    };
    writeSessionsDb(db);
  }
}

function deleteSessionByIdLocal(id) {
  const db = readSessionsDb();
  db.sessions = db.sessions.filter((item) => normalizeText(item?.id) !== normalizeText(id));
  writeSessionsDb(db);
}

function deleteExpiredSessionsLocal() {
  const nowMs = Date.now();
  const db = readSessionsDb();
  const next = db.sessions.filter((item) => {
    const expiresMs = Date.parse(item?.expiresAt || "");
    return Number.isFinite(expiresMs) && expiresMs > nowMs;
  });

  if (next.length !== db.sessions.length) {
    db.sessions = next;
    writeSessionsDb(db);
  }
}

function findUserByIdLocal(id) {
  const db = readUsersDb();
  return db.users.find((item) => normalizeText(item?.id) === normalizeText(id)) || null;
}

function mapDbUser(foundUser = {}) {
  return {
    id: normalizeText(foundUser.Id || foundUser.id),
    name: normalizeText(foundUser.Name || foundUser.name),
    email: normalizeText(foundUser.Email || foundUser.email).toLowerCase(),
    passwordSalt: normalizeText(foundUser.PasswordSalt || foundUser.passwordSalt),
    passwordHash: normalizeText(foundUser.PasswordHash || foundUser.passwordHash),
    createdAt: new Date(foundUser.CreatedAt || foundUser.createdAt || new Date()).toISOString(),
    lastLoginAt: new Date(foundUser.LastLoginAt || foundUser.lastLoginAt || new Date()).toISOString(),
  };
}

async function sendPasswordResetEmail({ email, code }) {
  const provider = normalizeText(process.env.ALERT_EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "console")).toLowerCase();
  const from =
    normalizeText(process.env.ALERT_EMAIL_FROM) ||
    normalizeText(process.env.RESEND_FROM_EMAIL) ||
    "MoveAdvisor <onboarding@resend.dev>";

  const subject = "MoveAdvisor · Código para recuperar tu contraseña";
  const text = [
    "Hola,",
    "",
    "Has solicitado recuperar tu contraseña.",
    `Tu código de recuperación es: ${code}`,
    "Este código caduca en 15 minutos.",
    "",
    "Si no has solicitado este cambio, ignora este mensaje.",
  ].join("\n");

  if (provider === "resend" && process.env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject,
          text,
        }),
      });

      if (!response.ok) {
        const payload = await response.text().catch(() => "");
        throw new Error(payload || "No se pudo enviar el email de recuperación.");
      }

      return;
    } catch (error) {
      if (String(process.env.AUTH_REQUIRE_EMAIL_DELIVERY || "false").toLowerCase() === "true") {
        throw error;
      }

      console.warn("⚠️ [MoveAdvisor] Falló envío con Resend. Se usa fallback local para recuperación.");
    }
  }

  console.log("🔐 [MoveAdvisor] Código de recuperación (modo local)");
  console.log(JSON.stringify({ email, code }, null, 2));
}

function buildPasswordResetSession({ userId, tokenHash }) {
  const now = new Date().toISOString();
  return {
    id: `reset-${typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now()}`,
    userId,
    tokenHash,
    createdAt: now,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    lastSeenAt: now,
    userAgent: "RESET",
  };
}

async function findValidResetMssql({ userId, tokenHash }) {
  await ensureMssqlSchema();
  const pool = await getMssqlPool();
  const result = await pool
    .request()
    .input("userId", sql.NVarChar(64), userId)
    .input("tokenHash", sql.NVarChar(200), tokenHash)
    .query(`
      SELECT TOP 1 Id
      FROM dbo.MoveAdvisorSessions
      WHERE UserId = @userId
        AND TokenHash = @tokenHash
        AND UserAgent = N'RESET'
        AND ExpiresAt > SYSUTCDATETIME()
      ORDER BY CreatedAt DESC
    `);

  return normalizeText(result.recordset?.[0]?.Id || "");
}

function findValidResetSqlcmd({ userId, tokenHash }) {
  ensureSqlcmdSchema();
  const output = runSqlcmd(`
    SELECT TOP 1 Id AS id
    FROM dbo.MoveAdvisorSessions
    WHERE UserId = N'${escapeSqlValue(userId)}'
      AND TokenHash = N'${escapeSqlValue(tokenHash)}'
      AND UserAgent = N'RESET'
      AND ExpiresAt > SYSUTCDATETIME()
    ORDER BY CreatedAt DESC
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
  `);

  const parsed = parseSqlcmdJsonOutput(output);
  return normalizeText(parsed?.id);
}

function findValidResetLocal({ userId, tokenHash }) {
  const nowMs = Date.now();
  const db = readSessionsDb();

  const match = db.sessions.find((item) => {
    const expiresMs = Date.parse(item?.expiresAt || "");
    return (
      normalizeText(item?.userId) === userId &&
      normalizeText(item?.tokenHash) === tokenHash &&
      normalizeText(item?.userAgent) === "RESET" &&
      Number.isFinite(expiresMs) &&
      expiresMs > nowMs
    );
  });

  return normalizeText(match?.id);
}

async function updateUserPasswordMssql({ userId, passwordSalt, passwordHash }) {
  await ensureMssqlSchema();
  const pool = await getMssqlPool();

  await pool
    .request()
    .input("userId", sql.NVarChar(64), userId)
    .input("passwordSalt", sql.NVarChar(64), passwordSalt)
    .input("passwordHash", sql.NVarChar(200), passwordHash)
    .input("lastLoginAt", sql.DateTime2, new Date())
    .query(`
      UPDATE dbo.MoveAdvisorUsers
      SET PasswordSalt = @passwordSalt,
          PasswordHash = @passwordHash,
          LastLoginAt = @lastLoginAt
      WHERE Id = @userId
    `);
}

function updateUserPasswordSqlcmd({ userId, passwordSalt, passwordHash }) {
  ensureSqlcmdSchema();

  runSqlcmd(`
    UPDATE dbo.MoveAdvisorUsers
    SET PasswordSalt = N'${escapeSqlValue(passwordSalt)}',
        PasswordHash = N'${escapeSqlValue(passwordHash)}',
        LastLoginAt = SYSUTCDATETIME()
    WHERE Id = N'${escapeSqlValue(userId)}';
  `);
}

function updateUserPasswordLocal({ userId, passwordSalt, passwordHash }) {
  const db = readUsersDb();
  const idx = db.users.findIndex((item) => normalizeText(item?.id) === normalizeText(userId));

  if (idx >= 0) {
    db.users[idx] = {
      ...db.users[idx],
      passwordSalt,
      passwordHash,
      lastLoginAt: new Date().toISOString(),
    };
    writeUsersDb(db);
  }
}

async function createSessionForUser({ req, res, user, useMssql, useSqlcmdWindows, usePostgres }) {
  const previousSession = parseSessionCookieFromRequest(req);

  if (previousSession?.sessionId) {
    if (useMssql) {
      await deleteSessionByIdMssql(previousSession.sessionId);
    } else if (useSqlcmdWindows) {
      deleteSessionByIdSqlcmd(previousSession.sessionId);
    } else if (usePostgres) {
      await deleteSessionByIdPostgres(previousSession.sessionId);
    } else {
      deleteSessionByIdLocal(previousSession.sessionId);
    }
  }

  const token = crypto.randomBytes(32).toString("hex");
  const sessionId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `session-${Date.now()}`;
  const now = new Date().toISOString();
  const expiresAt = getSessionExpiryIso();
  const session = {
    id: sessionId,
    userId: user.id,
    tokenHash: hashSessionToken(token),
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
    userAgent: normalizeText(req?.headers?.["user-agent"] || "").slice(0, 255),
  };

  if (useMssql) {
    await createSessionMssql(session);
  } else if (useSqlcmdWindows) {
    createSessionSqlcmd(session);
  } else if (usePostgres) {
    await createSessionPostgres(session);
  } else {
    createSessionLocal(session);
  }

  setSessionCookie(res, `${sessionId}.${token}`, {
    maxAgeSeconds: SESSION_TTL_HOURS * 60 * 60,
  });

  return { sessionId, expiresAt };
}

async function resolveSessionUser({ req, useMssql, useSqlcmdWindows, usePostgres }) {
  const parsedSession = parseSessionCookieFromRequest(req);

  if (!parsedSession) {
    return null;
  }

  const sessionRecord = useMssql
    ? await findSessionByIdMssql(parsedSession.sessionId)
    : useSqlcmdWindows
    ? findSessionByIdSqlcmd(parsedSession.sessionId)
    : usePostgres
    ? await findSessionByIdPostgres(parsedSession.sessionId)
    : findSessionByIdLocal(parsedSession.sessionId);

  if (!sessionRecord) {
    return null;
  }

  const session = {
    id: normalizeText(sessionRecord.Id || sessionRecord.id),
    userId: normalizeText(sessionRecord.UserId || sessionRecord.userId),
    tokenHash: normalizeText(sessionRecord.TokenHash || sessionRecord.tokenHash),
    expiresAt: new Date(sessionRecord.ExpiresAt || sessionRecord.expiresAt || 0).toISOString(),
  };

  const now = Date.now();
  const expiresAtMs = Date.parse(session.expiresAt);

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
    if (useMssql) {
      await deleteSessionByIdMssql(session.id);
    } else if (useSqlcmdWindows) {
      deleteSessionByIdSqlcmd(session.id);
    } else if (usePostgres) {
      await deleteSessionByIdPostgres(session.id);
    } else {
      deleteSessionByIdLocal(session.id);
    }
    return null;
  }

  if (hashSessionToken(parsedSession.token) !== session.tokenHash) {
    return null;
  }

  const foundUser = useMssql
    ? await findUserByIdMssql(session.userId)
    : useSqlcmdWindows
    ? findUserByIdSqlcmd(session.userId)
    : usePostgres
    ? await findUserByIdPostgres(session.userId)
    : findUserByIdLocal(session.userId);

  if (!foundUser) {
    return null;
  }

  if (useMssql) {
    await updateSessionLastSeenMssql(session.id);
  } else if (useSqlcmdWindows) {
    updateSessionLastSeenSqlcmd(session.id);
  } else if (usePostgres) {
    await updateSessionLastSeenPostgres(session.id);
  } else {
    updateSessionLastSeenLocal(session.id);
  }

  return {
    session,
    user: mapDbUser(foundUser),
  };
}

async function cleanupExpiredSessions({ useMssql, useSqlcmdWindows, usePostgres }) {
  if (!shouldRunSessionCleanup()) {
    return;
  }

  if (useMssql) {
    await deleteExpiredSessionsMssql();
    return;
  }

  if (useSqlcmdWindows) {
    deleteExpiredSessionsSqlcmd();
    return;
  }

  if (usePostgres) {
    await deleteExpiredSessionsPostgres();
    return;
  }

  deleteExpiredSessionsLocal();
}

async function authHandler(req, res) {
  try {
  return await _authHandlerInner(req, res);
  } catch (err) {
    console.error("[MoveAdvisor] authHandler uncaught error:", err);
    return res.status(500).json({ error: "Error interno del servidor. Inténtalo de nuevo." });
  }
}

async function _authHandlerInner(req, res) {
  const useMssql = shouldUseMssql();
  const useSqlcmdWindows = shouldUseSqlcmdWindows();
  const usePostgres = shouldUsePostgres();
  const db = useMssql || useSqlcmdWindows || usePostgres ? null : readUsersDb();

  runSecurityMaintenance();
  await cleanupExpiredSessions({ useMssql, useSqlcmdWindows, usePostgres });

  if (req.method === "GET") {
    if (AUTH_SECURITY_STATUS_ENABLED && normalizeText(req?.query?.security) === "1") {
      return res.status(200).json({
        ok: true,
        security: buildSecurityStatusSnapshot(),
      });
    }

    const sessionPayload = await resolveSessionUser({ req, useMssql, useSqlcmdWindows, usePostgres });

    if (!sessionPayload?.user) {
      clearSessionCookie(res);
      return res.status(200).json({ ok: true, authenticated: false });
    }

    return res.status(200).json({
      ok: true,
      authenticated: true,
      user: sanitizeUser(sessionPayload.user),
      session: {
        id: sessionPayload.session.id,
        expiresAt: sessionPayload.session.expiresAt,
      },
    });
  }

  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const action = normalizeText(body.action).toLowerCase();
  const email = normalizeText(body.email).toLowerCase();
  const password = normalizeText(body.password);
  const name = normalizeText(body.name);
  const clientIp = getClientIp(req);

  if (!action) {
    return res.status(400).json({ error: "Debes indicar la acción de auth." });
  }

  if (action === "logout") {
    const parsedSession = parseSessionCookieFromRequest(req);

    if (parsedSession?.sessionId) {
      if (useMssql) {
        await deleteSessionByIdMssql(parsedSession.sessionId);
      } else if (useSqlcmdWindows) {
        deleteSessionByIdSqlcmd(parsedSession.sessionId);
      } else if (usePostgres) {
        await deleteSessionByIdPostgres(parsedSession.sessionId);
      } else {
        deleteSessionByIdLocal(parsedSession.sessionId);
      }
    }

    clearSessionCookie(res);
    return res.status(200).json({ ok: true, message: "Sesión cerrada." });
  }

  if (action === "change_password") {
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || body.password || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Debes indicar contraseña actual y nueva contraseña." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres." });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "La nueva contraseña no puede ser igual a la anterior." });
    }

    const sessionPayload = await resolveSessionUser({ req, useMssql, useSqlcmdWindows, usePostgres });
    if (!sessionPayload?.user?.id) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Tu sesión ha caducado. Inicia sesión de nuevo." });
    }

    const sessionUser = mapDbUser(sessionPayload.user);
    const expectedCurrentHash = hashPassword(currentPassword, sessionUser.passwordSalt || "");

    if (expectedCurrentHash !== sessionUser.passwordHash) {
      return res.status(401).json({ error: "La contraseña actual no es correcta." });
    }

    const newSalt = crypto.randomBytes(16).toString("hex");
    const newHash = hashPassword(newPassword, newSalt);

    if (useMssql) {
      await updateUserPasswordMssql({ userId: sessionUser.id, passwordSalt: newSalt, passwordHash: newHash });
    } else if (useSqlcmdWindows) {
      updateUserPasswordSqlcmd({ userId: sessionUser.id, passwordSalt: newSalt, passwordHash: newHash });
    } else if (usePostgres) {
      await updateUserPasswordPostgres({ userId: sessionUser.id, passwordSalt: newSalt, passwordHash: newHash });
    } else {
      updateUserPasswordLocal({ userId: sessionUser.id, passwordSalt: newSalt, passwordHash: newHash });
    }

    const refreshedUser = useMssql
      ? await findUserByIdMssql(sessionUser.id)
      : useSqlcmdWindows
      ? findUserByIdSqlcmd(sessionUser.id)
      : usePostgres
      ? await findUserByIdPostgres(sessionUser.id)
      : findUserByIdLocal(sessionUser.id);
    const normalizedUser = mapDbUser(refreshedUser || sessionUser);

    const createdSession = await createSessionForUser({
      req,
      res,
      user: normalizedUser,
      useMssql,
      useSqlcmdWindows,
      usePostgres,
    });

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(normalizedUser),
      message: "Contraseña actualizada correctamente.",
      session: createdSession,
    });
  }

  if (action === "request_password_reset") {
    const requestIpBackoff = readBackoff(resetRequestIpBackoff, clientIp);
    const requestEmailBackoff = readBackoff(resetRequestEmailBackoff, email);

    if (requestIpBackoff.blocked || requestEmailBackoff.blocked) {
      const retryAfterSeconds = Math.max(requestIpBackoff.retryAfterSeconds, requestEmailBackoff.retryAfterSeconds);
      logAuthSecurity("password_reset_request_backoff_blocked", {
        retryAfterSeconds,
        email: maskEmail(email),
        ip: maskIp(clientIp),
      });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
      });
    }

    const ipRate = consumeRateLimit(
      resetRequestIpLimiter,
      clientIp,
      RESET_REQUEST_MAX_PER_IP,
      RESET_REQUEST_WINDOW_MS
    );

    if (!ipRate.allowed) {
      const backoff = registerBackoffViolation(resetRequestIpBackoff, clientIp);
      logAuthSecurity("password_reset_request_rate_limited_ip", {
        retryAfterSeconds: Math.max(ipRate.retryAfterSeconds, backoff.retryAfterSeconds),
        ip: maskIp(clientIp),
      });
      res.setHeader("Retry-After", String(Math.max(ipRate.retryAfterSeconds, backoff.retryAfterSeconds)));
      return res.status(429).json({
        error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
      });
    }

    const emailRate = consumeRateLimit(
      resetRequestEmailLimiter,
      email,
      RESET_REQUEST_MAX_PER_EMAIL,
      RESET_REQUEST_WINDOW_MS
    );

    if (!emailRate.allowed) {
      const backoff = registerBackoffViolation(resetRequestEmailBackoff, email);
      logAuthSecurity("password_reset_request_rate_limited_email", {
        retryAfterSeconds: Math.max(emailRate.retryAfterSeconds, backoff.retryAfterSeconds),
        email: maskEmail(email),
      });
      res.setHeader("Retry-After", String(Math.max(emailRate.retryAfterSeconds, backoff.retryAfterSeconds)));
      return res.status(429).json({
        error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(200).json({
        ok: true,
        message: "Si el correo existe, recibirás instrucciones para recuperar tu contraseña.",
      });
    }

    const foundUser = useMssql
      ? await findUserByEmailMssql(email)
      : useSqlcmdWindows
      ? findUserByEmailSqlcmd(email)
      : usePostgres
      ? await findUserByEmailPostgres(email)
      : db.users.find((item) => normalizeText(item?.email).toLowerCase() === email);

    if (foundUser) {
      const user = mapDbUser(foundUser);
      const resetCode = crypto.randomBytes(4).toString("hex").toUpperCase();
      const resetTokenHash = hashSessionToken(resetCode);
      const resetSession = buildPasswordResetSession({ userId: user.id, tokenHash: resetTokenHash });

      if (useMssql) {
        await createSessionMssql(resetSession);
      } else if (useSqlcmdWindows) {
        createSessionSqlcmd(resetSession);
      } else if (usePostgres) {
        await createSessionPostgres(resetSession);
      } else {
        createSessionLocal(resetSession);
      }

      await sendPasswordResetEmail({ email: user.email, code: resetCode });

      return res.status(200).json({
        ok: true,
        message: "Si el correo existe, recibirás instrucciones para recuperar tu contraseña.",
        ...(String(process.env.AUTH_EXPOSE_RESET_CODE || "false").toLowerCase() === "true"
          ? { debugResetCode: resetCode }
          : {}),
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Si el correo existe, recibirás instrucciones para recuperar tu contraseña.",
    });
  }

  if (action === "reset_password") {
    const resetCode = normalizeText(body.resetCode).toUpperCase();
    const newPassword = String(body.newPassword || body.password || "");

    const confirmIpBackoff = readBackoff(resetConfirmIpBackoff, clientIp);
    const confirmEmailBackoff = readBackoff(resetConfirmEmailBackoff, email);

    if (confirmIpBackoff.blocked || confirmEmailBackoff.blocked) {
      const retryAfterSeconds = Math.max(confirmIpBackoff.retryAfterSeconds, confirmEmailBackoff.retryAfterSeconds);
      logAuthSecurity("password_reset_confirm_backoff_blocked", {
        retryAfterSeconds,
        email: maskEmail(email),
        ip: maskIp(clientIp),
      });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "Demasiados intentos de recuperación. Espera un momento e inténtalo de nuevo.",
      });
    }

    const resetIpRate = consumeRateLimit(
      resetConfirmIpLimiter,
      clientIp,
      RESET_CONFIRM_MAX_PER_IP,
      RESET_CONFIRM_WINDOW_MS
    );

    if (!resetIpRate.allowed) {
      const backoff = registerBackoffViolation(resetConfirmIpBackoff, clientIp);
      logAuthSecurity("password_reset_confirm_rate_limited_ip", {
        retryAfterSeconds: Math.max(resetIpRate.retryAfterSeconds, backoff.retryAfterSeconds),
        ip: maskIp(clientIp),
      });
      res.setHeader("Retry-After", String(Math.max(resetIpRate.retryAfterSeconds, backoff.retryAfterSeconds)));
      return res.status(429).json({
        error: "Demasiados intentos de recuperación. Espera un momento e inténtalo de nuevo.",
      });
    }

    const resetEmailRate = consumeRateLimit(
      resetConfirmEmailLimiter,
      email,
      RESET_CONFIRM_MAX_PER_EMAIL,
      RESET_CONFIRM_WINDOW_MS
    );

    if (!resetEmailRate.allowed) {
      const backoff = registerBackoffViolation(resetConfirmEmailBackoff, email);
      logAuthSecurity("password_reset_confirm_rate_limited_email", {
        retryAfterSeconds: Math.max(resetEmailRate.retryAfterSeconds, backoff.retryAfterSeconds),
        email: maskEmail(email),
      });
      res.setHeader("Retry-After", String(Math.max(resetEmailRate.retryAfterSeconds, backoff.retryAfterSeconds)));
      return res.status(429).json({
        error: "Demasiados intentos de recuperación. Espera un momento e inténtalo de nuevo.",
      });
    }

    if (!isValidEmail(email) || !resetCode) {
      return res.status(400).json({ error: "Debes indicar correo y código de recuperación." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres." });
    }

    const foundUser = useMssql
      ? await findUserByEmailMssql(email)
      : useSqlcmdWindows
      ? findUserByEmailSqlcmd(email)
      : usePostgres
      ? await findUserByEmailPostgres(email)
      : db.users.find((item) => normalizeText(item?.email).toLowerCase() === email);

    if (!foundUser) {
      registerBackoffViolation(resetConfirmEmailBackoff, email);
      registerBackoffViolation(resetConfirmIpBackoff, clientIp);
      logAuthSecurity("password_reset_confirm_invalid_user", {
        email: maskEmail(email),
        ip: maskIp(clientIp),
      });
      return res.status(400).json({ error: "Código o correo no válidos." });
    }

    const user = mapDbUser(foundUser);
    const resetTokenHash = hashSessionToken(resetCode);
    const resetSessionId = useMssql
      ? await findValidResetMssql({ userId: user.id, tokenHash: resetTokenHash })
      : useSqlcmdWindows
      ? findValidResetSqlcmd({ userId: user.id, tokenHash: resetTokenHash })
      : usePostgres
      ? await findValidResetPostgres({ userId: user.id, tokenHash: resetTokenHash })
      : findValidResetLocal({ userId: user.id, tokenHash: resetTokenHash });

    if (!resetSessionId) {
      registerBackoffViolation(resetConfirmEmailBackoff, email);
      registerBackoffViolation(resetConfirmIpBackoff, clientIp);
      logAuthSecurity("password_reset_confirm_invalid_code", {
        email: maskEmail(email),
        ip: maskIp(clientIp),
      });
      return res.status(400).json({ error: "Código o correo no válidos." });
    }

    const newSalt = crypto.randomBytes(16).toString("hex");
    const newHash = hashPassword(newPassword, newSalt);

    if (useMssql) {
      await updateUserPasswordMssql({ userId: user.id, passwordSalt: newSalt, passwordHash: newHash });
      await deleteSessionByIdMssql(resetSessionId);
    } else if (useSqlcmdWindows) {
      updateUserPasswordSqlcmd({ userId: user.id, passwordSalt: newSalt, passwordHash: newHash });
      deleteSessionByIdSqlcmd(resetSessionId);
    } else if (usePostgres) {
      await updateUserPasswordPostgres({ userId: user.id, passwordSalt: newSalt, passwordHash: newHash });
      await deleteSessionByIdPostgres(resetSessionId);
    } else {
      updateUserPasswordLocal({ userId: user.id, passwordSalt: newSalt, passwordHash: newHash });
      deleteSessionByIdLocal(resetSessionId);
    }

    const refreshedUser = useMssql
      ? await findUserByIdMssql(user.id)
      : useSqlcmdWindows
      ? findUserByIdSqlcmd(user.id)
      : usePostgres
      ? await findUserByIdPostgres(user.id)
      : findUserByIdLocal(user.id);
    const normalizedUser = mapDbUser(refreshedUser || user);

    const createdSession = await createSessionForUser({
      req,
      res,
      user: normalizedUser,
      useMssql,
      useSqlcmdWindows,
      usePostgres,
    });

    clearRateLimitKey(resetConfirmEmailLimiter, email);
    clearRateLimitKey(resetConfirmIpLimiter, clientIp);
    clearBackoff(resetConfirmEmailBackoff, email);
    clearBackoff(resetConfirmIpBackoff, clientIp);
    logAuthSecurity("password_reset_confirm_success", {
      email: maskEmail(email),
      ip: maskIp(clientIp),
    });

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(normalizedUser),
      message: "Contraseña actualizada correctamente.",
      session: createdSession,
    });
  }

  if (action === "register") {
    if (!name) {
      return res.status(400).json({ error: "Indica tu nombre para crear la cuenta." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Introduce un correo electrónico válido." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    const existingUser = useMssql
      ? await findUserByEmailMssql(email)
      : useSqlcmdWindows
      ? findUserByEmailSqlcmd(email)
      : usePostgres
      ? await findUserByEmailPostgres(email)
      : db.users.find((item) => normalizeText(item?.email).toLowerCase() === email);
    if (existingUser) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    }

    const now = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString("hex");
    const user = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `user-${Date.now()}`,
      name,
      email,
      passwordSalt: salt,
      passwordHash: hashPassword(password, salt),
      createdAt: now,
      lastLoginAt: now,
    };

    const savedUser = useMssql
      ? await createUserMssql(user)
      : useSqlcmdWindows
      ? createUserSqlcmd(user)
      : usePostgres
      ? await createUserPostgres(user)
      : (() => {
          db.users.unshift(user);
          writeUsersDb(db);
          return user;
        })();
    const normalizedSavedUser = mapDbUser(savedUser);

    const createdSession = await createSessionForUser({
      req,
      res,
      user: normalizedSavedUser,
      useMssql,
      useSqlcmdWindows,
      usePostgres,
    });

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(normalizedSavedUser),
      message: `Cuenta creada para ${email}.`,
      session: createdSession,
    });
  }

  if (action === "login") {
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "Introduce tu correo y tu contraseña." });
    }

    const foundUser = useMssql
      ? await findUserByEmailMssql(email)
      : useSqlcmdWindows
      ? findUserByEmailSqlcmd(email)
      : usePostgres
      ? await findUserByEmailPostgres(email)
      : db.users.find((item) => normalizeText(item?.email).toLowerCase() === email);

    if (!foundUser) {
      return res.status(404).json({ error: "No existe ninguna cuenta con ese correo." });
    }

    const user = mapDbUser(foundUser);
    const expectedHash = hashPassword(password, user.passwordSalt);

    if (expectedHash !== user.passwordHash) {
      return res.status(401).json({ error: "La contraseña no es correcta." });
    }

    const now = useMssql
      ? await updateLastLoginMssql(user.id)
      : useSqlcmdWindows
      ? updateLastLoginSqlcmd(user.id)
      : usePostgres
      ? await updateLastLoginPostgres(user.id)
      : (() => {
          const nowValue = new Date().toISOString();
          const userIndex = db.users.findIndex((item) => normalizeText(item?.email).toLowerCase() === email);

          if (userIndex >= 0) {
            db.users[userIndex] = {
              ...db.users[userIndex],
              lastLoginAt: nowValue,
            };
            writeUsersDb(db);
          }

          return nowValue;
        })();

    const loggedUser = {
      ...user,
      lastLoginAt: now,
    };

    const createdSession = await createSessionForUser({
      req,
      res,
      user: loggedUser,
      useMssql,
      useSqlcmdWindows,
      usePostgres,
    });

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(loggedUser),
      message: `Sesión iniciada para ${email}.`,
      session: createdSession,
    });
  }

  return res.status(400).json({ error: "Acción de auth no soportada." });
}

  if (req.method === "GET") {
    if (AUTH_SECURITY_STATUS_ENABLED && normalizeText(req?.query?.security) === "1") {
      return res.status(200).json({
        ok: true,
        security: buildSecurityStatusSnapshot(),
      });
    }

    const sessionPayload = await resolveSessionUser({ req, useMssql, useSqlcmdWindows });

    if (!sessionPayload?.user) {
      clearSessionCookie(res);
      return res.status(200).json({ ok: true, authenticated: false });
    }

    return res.status(200).json({
      ok: true,
      authenticated: true,
      user: sanitizeUser(sessionPayload.user),
      session: {
        id: sessionPayload.session.id,
        expiresAt: sessionPayload.session.expiresAt,
      },
    });
  }

  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const action = normalizeText(body.action).toLowerCase();
  const email = normalizeText(body.email).toLowerCase();
  const password = normalizeText(body.password);
  const name = normalizeText(body.name);
  const clientIp = getClientIp(req);

  if (!action) {
    return res.status(400).json({ error: "Debes indicar la acción de auth." });
  }

  if (action === "logout") {
    const parsedSession = parseSessionCookieFromRequest(req);

    if (parsedSession?.sessionId) {
      if (useMssql) {
        await deleteSessionByIdMssql(parsedSession.sessionId);
      } else if (useSqlcmdWindows) {
        deleteSessionByIdSqlcmd(parsedSession.sessionId);
      } else {
        deleteSessionByIdLocal(parsedSession.sessionId);
      }
    }

    clearSessionCookie(res);
    return res.status(200).json({ ok: true, message: "Sesión cerrada." });
  }

  if (action === "change_password") {
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || body.password || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Debes indicar contraseña actual y nueva contraseña." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres." });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "La nueva contraseña no puede ser igual a la anterior." });
    }

    const sessionPayload = await resolveSessionUser({ req, useMssql, useSqlcmdWindows });
    if (!sessionPayload?.user?.id) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Tu sesión ha caducado. Inicia sesión de nuevo." });
    }

    const sessionUser = mapDbUser(sessionPayload.user);
    const expectedCurrentHash = hashPassword(currentPassword, sessionUser.passwordSalt || "");

    if (expectedCurrentHash !== sessionUser.passwordHash) {
      return res.status(401).json({ error: "La contraseña actual no es correcta." });
    }

    const newSalt = crypto.randomBytes(16).toString("hex");
    const newHash = hashPassword(newPassword, newSalt);

    if (useMssql) {
      await updateUserPasswordMssql({ userId: sessionUser.id, passwordSalt: newSalt, passwordHash: newHash });
    } else if (useSqlcmdWindows) {
      updateUserPasswordSqlcmd({ userId: sessionUser.id, passwordSalt: newSalt, passwordHash: newHash });
    } else {
      updateUserPasswordLocal({ userId: sessionUser.id, passwordSalt: newSalt, passwordHash: newHash });
    }

    const refreshedUser = useMssql
      ? await findUserByIdMssql(sessionUser.id)
      : useSqlcmdWindows
      ? findUserByIdSqlcmd(sessionUser.id)
      : findUserByIdLocal(sessionUser.id);
    const normalizedUser = mapDbUser(refreshedUser || sessionUser);

    const createdSession = await createSessionForUser({
      req,
      res,
      user: normalizedUser,
      useMssql,
      useSqlcmdWindows,
    });

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(normalizedUser),
      message: "Contraseña actualizada correctamente.",
      session: createdSession,
    });
  }

  if (action === "request_password_reset") {
    const requestIpBackoff = readBackoff(resetRequestIpBackoff, clientIp);
    const requestEmailBackoff = readBackoff(resetRequestEmailBackoff, email);

    if (requestIpBackoff.blocked || requestEmailBackoff.blocked) {
      const retryAfterSeconds = Math.max(requestIpBackoff.retryAfterSeconds, requestEmailBackoff.retryAfterSeconds);
      logAuthSecurity("password_reset_request_backoff_blocked", {
        retryAfterSeconds,
        email: maskEmail(email),
        ip: maskIp(clientIp),
      });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
      });
    }

    const ipRate = consumeRateLimit(
      resetRequestIpLimiter,
      clientIp,
      RESET_REQUEST_MAX_PER_IP,
      RESET_REQUEST_WINDOW_MS
    );

    if (!ipRate.allowed) {
      const backoff = registerBackoffViolation(resetRequestIpBackoff, clientIp);
      logAuthSecurity("password_reset_request_rate_limited_ip", {
        retryAfterSeconds: Math.max(ipRate.retryAfterSeconds, backoff.retryAfterSeconds),
        ip: maskIp(clientIp),
      });
      res.setHeader("Retry-After", String(Math.max(ipRate.retryAfterSeconds, backoff.retryAfterSeconds)));
      return res.status(429).json({
        error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
      });
    }

    const emailRate = consumeRateLimit(
      resetRequestEmailLimiter,
      email,
      RESET_REQUEST_MAX_PER_EMAIL,
      RESET_REQUEST_WINDOW_MS
    );

    if (!emailRate.allowed) {
      const backoff = registerBackoffViolation(resetRequestEmailBackoff, email);
      logAuthSecurity("password_reset_request_rate_limited_email", {
        retryAfterSeconds: Math.max(emailRate.retryAfterSeconds, backoff.retryAfterSeconds),
        email: maskEmail(email),
      });
      res.setHeader("Retry-After", String(Math.max(emailRate.retryAfterSeconds, backoff.retryAfterSeconds)));
      return res.status(429).json({
        error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(200).json({
        ok: true,
        message: "Si el correo existe, recibirás instrucciones para recuperar tu contraseña.",
      });
    }

    const foundUser = useMssql
      ? await findUserByEmailMssql(email)
      : useSqlcmdWindows
      ? findUserByEmailSqlcmd(email)
      : db.users.find((item) => normalizeText(item?.email).toLowerCase() === email);

    if (foundUser) {
      const user = mapDbUser(foundUser);
      const resetCode = crypto.randomBytes(4).toString("hex").toUpperCase();
      const resetTokenHash = hashSessionToken(resetCode);
      const resetSession = buildPasswordResetSession({ userId: user.id, tokenHash: resetTokenHash });

      if (useMssql) {
        await createSessionMssql(resetSession);
      } else if (useSqlcmdWindows) {
        createSessionSqlcmd(resetSession);
      } else {
        createSessionLocal(resetSession);
      }

      await sendPasswordResetEmail({ email: user.email, code: resetCode });

      return res.status(200).json({
        ok: true,
        message: "Si el correo existe, recibirás instrucciones para recuperar tu contraseña.",
        ...(String(process.env.AUTH_EXPOSE_RESET_CODE || "false").toLowerCase() === "true"
          ? { debugResetCode: resetCode }
          : {}),
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Si el correo existe, recibirás instrucciones para recuperar tu contraseña.",
    });
  }

  if (action === "reset_password") {
    const resetCode = normalizeText(body.resetCode).toUpperCase();
    const newPassword = String(body.newPassword || body.password || "");

    const confirmIpBackoff = readBackoff(resetConfirmIpBackoff, clientIp);
    const confirmEmailBackoff = readBackoff(resetConfirmEmailBackoff, email);

    if (confirmIpBackoff.blocked || confirmEmailBackoff.blocked) {
      const retryAfterSeconds = Math.max(confirmIpBackoff.retryAfterSeconds, confirmEmailBackoff.retryAfterSeconds);
      logAuthSecurity("password_reset_confirm_backoff_blocked", {
        retryAfterSeconds,
        email: maskEmail(email),
        ip: maskIp(clientIp),
      });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "Demasiados intentos de recuperación. Espera un momento e inténtalo de nuevo.",
      });
    }

    const resetIpRate = consumeRateLimit(
      resetConfirmIpLimiter,
      clientIp,
      RESET_CONFIRM_MAX_PER_IP,
      RESET_CONFIRM_WINDOW_MS
    );

    if (!resetIpRate.allowed) {
      const backoff = registerBackoffViolation(resetConfirmIpBackoff, clientIp);
      logAuthSecurity("password_reset_confirm_rate_limited_ip", {
        retryAfterSeconds: Math.max(resetIpRate.retryAfterSeconds, backoff.retryAfterSeconds),
        ip: maskIp(clientIp),
      });
      res.setHeader("Retry-After", String(Math.max(resetIpRate.retryAfterSeconds, backoff.retryAfterSeconds)));
      return res.status(429).json({
        error: "Demasiados intentos de recuperación. Espera un momento e inténtalo de nuevo.",
      });
    }

    const resetEmailRate = consumeRateLimit(
      resetConfirmEmailLimiter,
      email,
      RESET_CONFIRM_MAX_PER_EMAIL,
      RESET_CONFIRM_WINDOW_MS
    );

    if (!resetEmailRate.allowed) {
      const backoff = registerBackoffViolation(resetConfirmEmailBackoff, email);
      logAuthSecurity("password_reset_confirm_rate_limited_email", {
        retryAfterSeconds: Math.max(resetEmailRate.retryAfterSeconds, backoff.retryAfterSeconds),
        email: maskEmail(email),
      });
      res.setHeader("Retry-After", String(Math.max(resetEmailRate.retryAfterSeconds, backoff.retryAfterSeconds)));
      return res.status(429).json({
        error: "Demasiados intentos de recuperación. Espera un momento e inténtalo de nuevo.",
      });
    }

    if (!isValidEmail(email) || !resetCode) {
      return res.status(400).json({ error: "Debes indicar correo y código de recuperación." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres." });
    }

    const foundUser = useMssql
      ? await findUserByEmailMssql(email)
      : useSqlcmdWindows
      ? findUserByEmailSqlcmd(email)
      : db.users.find((item) => normalizeText(item?.email).toLowerCase() === email);

    if (!foundUser) {
      registerBackoffViolation(resetConfirmEmailBackoff, email);
      registerBackoffViolation(resetConfirmIpBackoff, clientIp);
      logAuthSecurity("password_reset_confirm_invalid_user", {
        email: maskEmail(email),
        ip: maskIp(clientIp),
      });
      return res.status(400).json({ error: "Código o correo no válidos." });
    }

    const user = mapDbUser(foundUser);
    const resetTokenHash = hashSessionToken(resetCode);
    const resetSessionId = useMssql
      ? await findValidResetMssql({ userId: user.id, tokenHash: resetTokenHash })
      : useSqlcmdWindows
      ? findValidResetSqlcmd({ userId: user.id, tokenHash: resetTokenHash })
      : findValidResetLocal({ userId: user.id, tokenHash: resetTokenHash });

    if (!resetSessionId) {
      registerBackoffViolation(resetConfirmEmailBackoff, email);
      registerBackoffViolation(resetConfirmIpBackoff, clientIp);
      logAuthSecurity("password_reset_confirm_invalid_code", {
        email: maskEmail(email),
        ip: maskIp(clientIp),
      });
      return res.status(400).json({ error: "Código o correo no válidos." });
    }

    const newSalt = crypto.randomBytes(16).toString("hex");
    const newHash = hashPassword(newPassword, newSalt);

    if (useMssql) {
      await updateUserPasswordMssql({ userId: user.id, passwordSalt: newSalt, passwordHash: newHash });
      await deleteSessionByIdMssql(resetSessionId);
    } else if (useSqlcmdWindows) {
      updateUserPasswordSqlcmd({ userId: user.id, passwordSalt: newSalt, passwordHash: newHash });
      deleteSessionByIdSqlcmd(resetSessionId);
    } else {
      updateUserPasswordLocal({ userId: user.id, passwordSalt: newSalt, passwordHash: newHash });
      deleteSessionByIdLocal(resetSessionId);
    }

    const refreshedUser = useMssql
      ? await findUserByIdMssql(user.id)
      : useSqlcmdWindows
      ? findUserByIdSqlcmd(user.id)
      : findUserByIdLocal(user.id);
    const normalizedUser = mapDbUser(refreshedUser || user);

    const createdSession = await createSessionForUser({
      req,
      res,
      user: normalizedUser,
      useMssql,
      useSqlcmdWindows,
    });

    clearRateLimitKey(resetConfirmEmailLimiter, email);
    clearRateLimitKey(resetConfirmIpLimiter, clientIp);
    clearBackoff(resetConfirmEmailBackoff, email);
    clearBackoff(resetConfirmIpBackoff, clientIp);
    logAuthSecurity("password_reset_confirm_success", {
      email: maskEmail(email),
      ip: maskIp(clientIp),
    });

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(normalizedUser),
      message: "Contraseña actualizada correctamente.",
      session: createdSession,
    });
  }

  if (action === "register") {
    if (!name) {
      return res.status(400).json({ error: "Indica tu nombre para crear la cuenta." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Introduce un correo electrónico válido." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    const existingUser = useMssql
      ? await findUserByEmailMssql(email)
      : useSqlcmdWindows
      ? findUserByEmailSqlcmd(email)
      : db.users.find((item) => normalizeText(item?.email).toLowerCase() === email);
    if (existingUser) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    }

    const now = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString("hex");
    const user = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `user-${Date.now()}`,
      name,
      email,
      passwordSalt: salt,
      passwordHash: hashPassword(password, salt),
      createdAt: now,
      lastLoginAt: now,
    };

    const savedUser = useMssql
      ? await createUserMssql(user)
      : useSqlcmdWindows
      ? createUserSqlcmd(user)
      : (() => {
          db.users.unshift(user);
          writeUsersDb(db);
          return user;
        })();
    const normalizedSavedUser = mapDbUser(savedUser);

    const createdSession = await createSessionForUser({
      req,
      res,
      user: normalizedSavedUser,
      useMssql,
      useSqlcmdWindows,
    });

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(normalizedSavedUser),
      message: `Cuenta creada para ${email}.`,
      session: createdSession,
    });
  }

  if (action === "login") {
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "Introduce tu correo y tu contraseña." });
    }

    const foundUser = useMssql
      ? await findUserByEmailMssql(email)
      : useSqlcmdWindows
      ? findUserByEmailSqlcmd(email)
      : db.users.find((item) => normalizeText(item?.email).toLowerCase() === email);

    if (!foundUser) {
      return res.status(404).json({ error: "No existe ninguna cuenta con ese correo." });
    }

    const user = mapDbUser(foundUser);
    const expectedHash = hashPassword(password, user.passwordSalt);

    if (expectedHash !== user.passwordHash) {
      return res.status(401).json({ error: "La contraseña no es correcta." });
    }

    const now = useMssql
      ? await updateLastLoginMssql(user.id)
      : useSqlcmdWindows
      ? updateLastLoginSqlcmd(user.id)
      : (() => {
          const nowValue = new Date().toISOString();
          const userIndex = db.users.findIndex((item) => normalizeText(item?.email).toLowerCase() === email);

          if (userIndex >= 0) {
            db.users[userIndex] = {
              ...db.users[userIndex],
              lastLoginAt: nowValue,
            };
            writeUsersDb(db);
          }

          return nowValue;
        })();

    const loggedUser = {
      ...user,
      lastLoginAt: now,
    };

    const createdSession = await createSessionForUser({
      req,
      res,
      user: loggedUser,
      useMssql,
      useSqlcmdWindows,
    });

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(loggedUser),
      message: `Sesión iniciada para ${email}.`,
      session: createdSession,
    });
  }

  return res.status(400).json({ error: "Acción de auth no soportada." });
}

authHandler.getSecurityStatusSnapshot = function getSecurityStatusSnapshot() {
  if (!AUTH_SECURITY_STATUS_ENABLED) {
    return null;
  }

  runSecurityMaintenance();
  return buildSecurityStatusSnapshot();
};

authHandler.isSecurityStatusEnabled = function isSecurityStatusEnabled() {
  return AUTH_SECURITY_STATUS_ENABLED;
};

module.exports = authHandler;