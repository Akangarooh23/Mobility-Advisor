const fs = require("fs");
const { elPoolObligatorio } = require("../lib/postgres");
const path = require("path");
const crypto = require("crypto");
const { MARCA, remitente, respuestaA } = require("../lib/marca");
const { plantilla, parrafo, aviso, codigo } = require("../lib/correo");
const { aplicaCors } = require("../lib/cors");
const FRENO = require("../lib/freno");
const { registra } = require("../lib/registra");

// mssql is only needed when AUTH_PROVIDER=mssql; lazy-load to avoid crashing on Vercel
// Neon injects DATABASE_URL; @vercel/postgres needs POSTGRES_URL — map it early
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL;
}

const USERS_DB_PATH = path.join(__dirname, "..", "data", "local-users.json");
const SESSIONS_DB_PATH = path.join(__dirname, "..", "data", "local-sessions.json");
const SESSION_COOKIE_NAME = "moveadvisor_session";
const SESSION_TTL_HOURS = Math.max(Number(process.env.AUTH_SESSION_TTL_HOURS || 720), 1);
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
    apellidos: normalizeText(user.apellidos) || "",
    phone: normalizeText(user.phone) || "",
    email,
    createdAt: normalizeText(user.createdAt),
    lastLoginAt: normalizeText(user.lastLoginAt),
    consentLegalAt: user.consentLegalAt || null,
    consentMarketingAt: user.consentMarketingAt || null,
    consentExperianAt: user.consentExperianAt || null,
    consentMarketingEmailAt: user.consentMarketingEmailAt || null,
    consentMarketingSmsAt: user.consentMarketingSmsAt || null,
    consentThirdPartyEmailAt: user.consentThirdPartyEmailAt || null,
    consentThirdPartySmsAt: user.consentThirdPartySmsAt || null,
    consentsReviewedAt: user.consentsReviewedAt || null,
  };
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password || ""), String(salt || ""), 64).toString("hex");
}

/**
 * La sal con la que se hashea cuando no hay nadie a quien hashear.
 *
 * Existe para que un login contra un correo que no tiene cuenta cueste el mismo
 * tiempo que uno contra un correo que sí. Se genera una vez por instancia porque
 * el valor da igual: lo que importa es que el trabajo se haga. Ver el comentario
 * largo en `action === "login"`.
 */
const SAL_DE_PEGA = crypto.randomBytes(16).toString("hex");

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

/**
 * ¿La cookie de sesión lleva `Secure`?
 *
 * Decía `AUTH_COOKIE_SECURE || "false"`: **por omisión, sin `Secure`**. Y esa
 * variable no está puesta en Vercel, así que la cookie de sesión de todos los
 * clientes salía sin la marca que impide que viaje por una conexión sin cifrar.
 * El dominio lleva HSTS y eso lo tapa casi siempre, pero «casi» no es una
 * defensa: la marca existe para el rato en que el navegador aún no ha visto la
 * cabecera, o para un subdominio que se despiste.
 *
 * Ahora al revés: en producción y en Vercel va con `Secure` salvo que alguien
 * lo apague a mano; en local, donde no hay HTTPS, sigue sin él —si no, el login
 * no funcionaría—. Es el mismo criterio que usa `lib/api/identidad.js` para
 * decidir cuándo exigir sesión: lo seguro por omisión, y la puerta de atrás
 * solo donde hace falta.
 */
function cookieSegura(entorno = process.env) {
  const puesto = String(entorno.AUTH_COOKIE_SECURE || "").trim().toLowerCase();
  if (puesto === "true") return true;
  if (puesto === "false") return false;
  return entorno.NODE_ENV === "production" || Boolean(entorno.VERCEL);
}

function buildSessionCookie(value, { maxAgeSeconds } = {}) {
  const shouldUseSecure = cookieSegura();
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

/**
 * El valor de sesión, venga por donde venga: `<sessionId>.<token>`.
 *
 * Es el mismo string que va en la cookie y el mismo registro de la tabla de
 * sesiones. No hay un segundo mecanismo de autenticación, solo un segundo
 * sobre para el mismo papel.
 */
function parseSessionValue(rawValue) {
  const value = normalizeText(rawValue);

  if (!value || !value.includes(".")) {
    return null;
  }

  const [sessionId, token] = value.split(".");
  if (!sessionId || !token) {
    return null;
  }

  return {
    sessionId: normalizeText(sessionId),
    token: normalizeText(token),
  };
}

/**
 * La sesión de la cabecera `Authorization: Bearer <sessionId>.<token>`.
 *
 * Existe para los clientes que no son un navegador. Una app nativa habla con
 * un cliente HTTP que no guarda cookies entre arranques: con solo la cookie,
 * el usuario se desloguea cada vez que cierra la app.
 */
function parseSessionBearerFromRequest(req) {
  const header = normalizeText(req?.headers?.authorization || req?.headers?.Authorization || "");

  if (!/^bearer\s+/i.test(header)) {
    return null;
  }

  return parseSessionValue(header.replace(/^bearer\s+/i, ""));
}

/**
 * De dónde se lee la sesión, y en qué orden.
 *
 * La cookie primero, para que el navegador se comporte exactamente igual que
 * antes de que esto existiera. La cabecera es el respaldo, no el camino
 * principal: quien la manda es porque no tiene cookies que mandar.
 */
function parseSessionCookieFromRequest(req) {
  const cookies = parseCookies(req?.headers?.cookie || "");
  const desdeLaCookie = parseSessionValue(cookies[SESSION_COOKIE_NAME]);

  return desdeLaCookie || parseSessionBearerFromRequest(req);
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

function getPgPool() {
  return elPoolObligatorio();
}

/** Los nombres que ya no llevan a ninguna parte. */
const PROVEEDORES_RETIRADOS = new Set([
  "mssql", "sqlserver", "sqlcmd-windows", "windows", "mssql-windows",
]);

/**
 * Con qué base trabaja el login: `postgres` o `local`.
 *
 * ── Por qué un aviso y no un silencio ─────────────────────────────────────
 *
 * Aquí había dos proveedores más, `mssql` y `sqlcmd-windows`, con su código
 * detrás: unas seiscientas líneas que hablaban con SQL Server. Se han quitado
 * porque no podían ejecutarse —no hay SQL Server en ninguna parte, `sqlcmd` no
 * existe en el PATH ni en Vercel, y los usuarios llevan tiempo en Postgres—.
 *
 * Lo que no se podía dejar es que `AUTH_PROVIDER=mssql` siguiera colándose.
 * Devolvería un proveedor que ya no atiende nadie, `usePostgres` sería falso y
 * el login acabaría leyendo el fichero JSON de usuarios de desarrollo: nadie
 * podría entrar y no habría ni un error que lo explicara.
 *
 * Así que si alguien lo pone, se dice en voz alta y se sigue por Postgres, que
 * es donde están los usuarios de verdad.
 */
function getAuthProvider() {
  const provider = normalizeText(process.env.AUTH_PROVIDER).toLowerCase();

  if (PROVEEDORES_RETIRADOS.has(provider)) {
    console.warn(
      `[auth] AUTH_PROVIDER=${provider} ya no existe: el login solo habla con ` +
        "Postgres. Se usa Postgres. Quita esa variable o ponla a 'postgres'."
    );
    return "postgres";
  }

  if (["postgres", "postgresql", "neon", "vercel-postgres"].includes(provider)) {
    return "postgres";
  }

  if (normalizeText(process.env.POSTGRES_URL) || normalizeText(process.env.DATABASE_URL)) {
    return "postgres";
  }

  return "local";
}

function shouldUsePostgres() {
  return getAuthProvider() === "postgres";
}

/*
 * Aquí estaba `escapeSqlValue`, que era esto:
 *
 *     String(value || "").replace(/'/g, "''")
 *
 * Escapar comillas a mano para pegar el valor dentro del SQL. Se ha quedado
 * sin usar al irse el camino de SQL Server, y se va con él: lo que queda
 * manda los valores como parámetros, que es lo que hace que no haga falta
 * escapar nada.
 */

// â”€â”€â”€ PostgreSQL (Neon / Vercel Postgres) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let _pgSchemaEnsured = false;

async function findUserByEmailPostgres(email) {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `SELECT id, name, apellidos, phone, email, password_salt AS "passwordSalt", password_hash AS "passwordHash",
            created_at AS "createdAt", last_login_at AS "lastLoginAt",
            consent_legal_at, consent_marketing_at, consent_experian_at,
            consent_marketing_email_at, consent_marketing_sms_at,
            consent_thirdparty_email_at, consent_thirdparty_sms_at,
            consents_reviewed_at
     FROM moveadvisor_users WHERE email = $1 LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function createUserPostgres(user) {
  const pool = getPgPool();
  await pool.query(
    `INSERT INTO moveadvisor_users
      (id, name, apellidos, phone, email, password_salt, password_hash, created_at, last_login_at,
       consent_legal_at, consent_marketing_at, consent_experian_at,
       consent_marketing_email_at, consent_marketing_sms_at,
       consent_thirdparty_email_at, consent_thirdparty_sms_at,
       registration_ip, registration_ua, utm_source, utm_medium, utm_campaign, utm_content,
       affiliate_data, referer, landing_url, language,
       client_type, company_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
    [
      user.id, user.name, user.apellidos || "", user.phone || "", user.email,
      user.passwordSalt, user.passwordHash, user.createdAt, user.lastLoginAt,
      user.consentLegalAt || null, user.consentMarketingAt || null, user.consentExperianAt || null,
      user.consentMarketingEmailAt || null, user.consentMarketingSmsAt || null,
      user.consentThirdPartyEmailAt || null, user.consentThirdPartySmsAt || null,
      user.registrationIp || "", user.registrationUa || "",
      user.utmSource || "", user.utmMedium || "", user.utmCampaign || "", user.utmContent || "",
      user.affiliateData ? JSON.stringify(user.affiliateData) : null,
      user.referer || "", user.landingUrl || "", user.language || "",
      user.clientType || "individual", user.company_name || "",
    ]
  );
  return findUserByEmailPostgres(user.email);
}

async function findUserByIdPostgres(id) {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `SELECT id, name, apellidos, phone, email, password_salt AS "passwordSalt", password_hash AS "passwordHash",
            created_at AS "createdAt", last_login_at AS "lastLoginAt"
     FROM moveadvisor_users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function updateLastLoginPostgres(id) {
  const pool = getPgPool();
  const now = new Date().toISOString();
  await pool.query(`UPDATE moveadvisor_users SET last_login_at = $1 WHERE id = $2`, [now, id]);
  return now;
}

async function createSessionPostgres(session) {
  const pool = getPgPool();
  await pool.query(
    `INSERT INTO moveadvisor_sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [session.id, session.userId, session.tokenHash, session.createdAt, session.expiresAt, session.lastSeenAt, session.userAgent || null]
  );
}

async function findSessionByIdPostgres(id) {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `SELECT id, user_id AS "userId", token_hash AS "tokenHash",
            created_at AS "createdAt", expires_at AS "expiresAt",
            last_seen_at AS "lastSeenAt", user_agent AS "userAgent"
     FROM moveadvisor_sessions WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function updateSessionLastSeenPostgres(id) {
  const pool = getPgPool();
  await pool.query(`UPDATE moveadvisor_sessions SET last_seen_at = $1 WHERE id = $2`, [new Date().toISOString(), id]);
}

async function extendSessionExpiryPostgres(id, newExpiresAt) {
  const pool = getPgPool();
  await pool.query(
    `UPDATE moveadvisor_sessions SET expires_at = $1, last_seen_at = $2 WHERE id = $3`,
    [newExpiresAt, new Date().toISOString(), id]
  );
}

async function deleteSessionByIdPostgres(id) {
  const pool = getPgPool();
  await pool.query(`DELETE FROM moveadvisor_sessions WHERE id = $1`, [id]);
}

async function deleteExpiredSessionsPostgres() {
  const pool = getPgPool();
  await pool.query(`DELETE FROM moveadvisor_sessions WHERE expires_at <= NOW()`);
}

async function findValidResetPostgres({ userId, tokenHash }) {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `SELECT id FROM moveadvisor_sessions
     WHERE user_id = $1 AND token_hash = $2 AND user_agent = 'RESET' AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [userId, tokenHash]
  );
  return normalizeText(rows[0]?.id);
}

async function updateUserPasswordPostgres({ userId, passwordSalt, passwordHash }) {
  const pool = getPgPool();
  await pool.query(
    `UPDATE moveadvisor_users SET password_salt = $1, password_hash = $2, last_login_at = $3 WHERE id = $4`,
    [passwordSalt, passwordHash, new Date().toISOString(), userId]
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    apellidos: normalizeText(foundUser.Apellidos || foundUser.apellidos),
    phone: normalizeText(foundUser.Phone || foundUser.phone),
    email: normalizeText(foundUser.Email || foundUser.email).toLowerCase(),
    passwordSalt: normalizeText(foundUser.PasswordSalt || foundUser.passwordSalt),
    passwordHash: normalizeText(foundUser.PasswordHash || foundUser.passwordHash),
    createdAt: new Date(foundUser.CreatedAt || foundUser.createdAt || new Date()).toISOString(),
    lastLoginAt: new Date(foundUser.LastLoginAt || foundUser.lastLoginAt || new Date()).toISOString(),
    consentLegalAt: foundUser.consent_legal_at || foundUser.consentLegalAt || null,
    consentMarketingAt: foundUser.consent_marketing_at || foundUser.consentMarketingAt || null,
    consentExperianAt: foundUser.consent_experian_at || foundUser.consentExperianAt || null,
    consentMarketingEmailAt: foundUser.consent_marketing_email_at || foundUser.consentMarketingEmailAt || null,
    consentMarketingSmsAt: foundUser.consent_marketing_sms_at || foundUser.consentMarketingSmsAt || null,
    consentThirdPartyEmailAt: foundUser.consent_thirdparty_email_at || foundUser.consentThirdPartyEmailAt || null,
    consentThirdPartySmsAt: foundUser.consent_thirdparty_sms_at || foundUser.consentThirdPartySmsAt || null,
    consentsReviewedAt: foundUser.consents_reviewed_at || foundUser.consentsReviewedAt || null,
  };
}

async function sendPasswordResetEmail({ email, code }) {
  const provider = normalizeText(process.env.ALERT_EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "console")).toLowerCase();
  const exposeResetCode = String(process.env.AUTH_EXPOSE_RESET_CODE || "false").toLowerCase() === "true";
  const requireDelivery = String(process.env.AUTH_REQUIRE_EMAIL_DELIVERY || "false").toLowerCase() === "true";
  const localFallbackEnabled = String(process.env.AUTH_LOCAL_RESET_FALLBACK || "true").toLowerCase() !== "false";
  const isProductionLike = String(process.env.NODE_ENV || "").toLowerCase() === "production" || String(process.env.VERCEL || "") === "1";
  const from =
    remitente();

  // onboarding@resend.dev solo entrega al dueno de la cuenta de Resend.
  // En produccion, RESEND_FROM_EMAIL tiene que apuntar a un dominio verificado.
  if (isProductionLike && from.includes("onboarding@resend.dev")) {
    console.error("[auth] el remitente es onboarding@resend.dev: el correo solo llega al dueno de la cuenta de Resend. Pon RESEND_FROM_EMAIL con un dominio verificado.");
  }

  const subject = `${MARCA.nombre} · Código para recuperar tu contraseña`;
  const text = [
    "Hola,",
    "",
    "Has solicitado recuperar tu contraseña.",
    `Tu código de recuperación es: ${code}`,
    "Este código caduca en 15 minutos.",
    "",
    "Si no has solicitado este cambio, ignora este mensaje.",
    "",
    `— El equipo de ${MARCA.nombre}`,
  ].join("\n");

  const html = plantilla({
    titulo: "Recupera tu contraseña",
    cuerpo:
      parrafo("Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Introduce este código en la aplicación:") +
      codigo(code) +
      aviso("El código caduca en 15 minutos", "Si no has pedido el cambio, ignora este correo: tu contraseña no se toca."),
  });

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
          reply_to: respuestaA(),
          to: [email],
          subject,
          text,
          html,
        }),
      });

      if (!response.ok) {
        const payload = await response.text().catch(() => "");
        throw new Error(payload || "No se pudo enviar el email de recuperación.");
      }

      return;
    } catch (error) {
      const canUseLocalFallback = localFallbackEnabled && exposeResetCode && !isProductionLike;

      if (requireDelivery && !canUseLocalFallback) {
        throw error;
      }

      console.warn("[auth] Fallo envio con Resend. Usando fallback local.");
    }
  }

  console.log("[auth] Codigo de recuperacion (modo local/consola):", JSON.stringify({ email, code }));
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

async function createSessionForUser({ req, res, user, usePostgres }) {
  const previousSession = parseSessionCookieFromRequest(req);

  if (previousSession?.sessionId) {
    if (usePostgres) {
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

  if (usePostgres) {
    await createSessionPostgres(session);
  } else {
    createSessionLocal(session);
  }

  setSessionCookie(res, `${sessionId}.${token}`, {
    maxAgeSeconds: SESSION_TTL_HOURS * 60 * 60,
  });

  // El token sale de aquí en claro porque quien llama decide si se lo enseña
  // al cliente. Al navegador no: ver `laSesionQueSeDevuelve`.
  return { sessionId, expiresAt, token: `${sessionId}.${token}` };
}

/**
 * La sesión tal y como se le cuenta al cliente que acaba de entrar.
 *
 * Al navegador se le devuelve lo de siempre —el id y la caducidad— y el token
 * viaja solo en la cookie `HttpOnly`. Devolvérselo en el cuerpo además sería
 * regalarle a cualquier script de la página lo que la cookie le esconde, y no
 * le hace ninguna falta: el navegador ya manda la cookie solo.
 *
 * Al que se identifica como app se le da el token, porque es lo único que va a
 * poder guardar. Y se le da **porque lo ha pedido**: así la respuesta de la web
 * no cambia ni un byte.
 */
function laSesionQueSeDevuelve(req, session) {
  const cliente = normalizeText(req?.headers?.["x-popcar-client"]).toLowerCase();
  const esApp = cliente === "app";

  return {
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    ...(esApp ? { token: session.token } : {}),
  };
}

async function resolveSessionUser({ req, usePostgres }) {
  const parsedSession = parseSessionCookieFromRequest(req);

  if (!parsedSession) {
    return null;
  }

  const sessionRecord = usePostgres
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
    if (usePostgres) {
      await deleteSessionByIdPostgres(session.id);
    } else {
      deleteSessionByIdLocal(session.id);
    }
    return null;
  }

  if (hashSessionToken(parsedSession.token) !== session.tokenHash) {
    return null;
  }

  const foundUser = usePostgres
    ? await findUserByIdPostgres(session.userId)
    : findUserByIdLocal(session.userId);

  if (!foundUser) {
    return null;
  }

  // Sliding session: extend expiry on each valid access
  const newExpiresAt = getSessionExpiryIso();
  if (usePostgres) {
    await extendSessionExpiryPostgres(session.id, newExpiresAt);
  } else {
    updateSessionLastSeenLocal(session.id);
  }

  return {
    session: { ...session, expiresAt: newExpiresAt },
    user: mapDbUser(foundUser),
  };
}

async function cleanupExpiredSessions({ usePostgres }) {
  if (!shouldRunSessionCleanup()) {
    return;
  }

  if (usePostgres) {
    await deleteExpiredSessionsPostgres();
    return;
  }

  deleteExpiredSessionsLocal();
}

async function authHandler(req, res) {
  if (aplicaCors(req, res)) {
    return undefined;
  }

  try {
    return await _authHandlerInner(req, res);
  } catch (err) {
    /*
     * Lo que salió mal se guarda; no se cuenta.
     *
     * Aquí iba `details: err.message`. El mensaje de Postgres lleva nombres de
     * tabla, de columna, de restricción y a veces el valor que falló, y este es
     * el endpoint donde más se busca esa información: con un par de peticiones
     * mal formadas se dibuja el esquema de usuarios y sesiones.
     *
     * `registra()` lo deja en `moveadvisor_errores` con su huella, que es donde
     * hay que mirarlo. Y el front no se queda sin mensaje: `App.js` lee
     * `data.details || data.error`, así que ahora enseña el de `error`, que
     * además está escrito para una persona.
     */
    await registra("auth", err, { accion: normalizeText(req?.body?.action) }).catch(() => {});
    return res.status(500).json({
      ok: false,
      error: "Error interno del servidor. Intentalo de nuevo.",
      provider: getAuthProvider(),
    });
  }
}

async function _authHandlerInner(req, res) {
  const usePostgres = shouldUsePostgres();
  const db = usePostgres ? null : readUsersDb();

  runSecurityMaintenance();
  try {
    await cleanupExpiredSessions({ usePostgres });
  } catch (err) {
    // Non-blocking maintenance: do not fail auth bootstrap when cleanup cannot run.
    console.error("[MoveAdvisor] session cleanup failed:", err);
  }

  if (req.method === "GET") {
    if (AUTH_SECURITY_STATUS_ENABLED && normalizeText(req?.query?.security) === "1") {
      return res.status(200).json({
        ok: true,
        security: buildSecurityStatusSnapshot(),
      });
    }

    let sessionPayload = null;
    try {
      sessionPayload = await resolveSessionUser({ req, usePostgres });
    } catch (err) {
      console.error("[MoveAdvisor] resolveSessionUser failed:", err);
      clearSessionCookie(res);
      return res.status(200).json({ ok: true, authenticated: false });
    }

    if (!sessionPayload?.user) {
      clearSessionCookie(res);
      return res.status(200).json({ ok: true, authenticated: false });
    }

    // Refresh cookie so the browser window stays alive for another TTL period
    const rawSession = parseSessionCookieFromRequest(req);
    if (rawSession?.sessionId && rawSession?.token) {
      setSessionCookie(res, `${rawSession.sessionId}.${rawSession.token}`, {
        maxAgeSeconds: SESSION_TTL_HOURS * 60 * 60,
      });
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
  const apellidos = normalizeText(body.apellidos);
  const phone = normalizeText(body.phone);
  const clientIp = getClientIp(req);
  const clientUa = (req.headers["user-agent"] || "").slice(0, 500);
  const consentLegalAt = body.consentLegalAt ? new Date(body.consentLegalAt).toISOString() : null;
  const consentMarketingAt = body.consentMarketingAt ? new Date(body.consentMarketingAt).toISOString() : null;
  const consentExperianAt = body.consentExperianAt ? new Date(body.consentExperianAt).toISOString() : null;
  const consentMarketingEmailAt = body.consentMarketingEmailAt ? new Date(body.consentMarketingEmailAt).toISOString() : null;
  const consentMarketingSmsAt = body.consentMarketingSmsAt ? new Date(body.consentMarketingSmsAt).toISOString() : null;
  const consentThirdPartyEmailAt = body.consentThirdPartyEmailAt ? new Date(body.consentThirdPartyEmailAt).toISOString() : null;
  const consentThirdPartySmsAt = body.consentThirdPartySmsAt ? new Date(body.consentThirdPartySmsAt).toISOString() : null;
  const utmSource = normalizeText(body.utmSource);
  const utmMedium = normalizeText(body.utmMedium);
  const utmCampaign = normalizeText(body.utmCampaign);
  const utmContent = normalizeText(body.utmContent);
  const affiliateData = body.affiliateData && typeof body.affiliateData === "object" ? body.affiliateData : null;
  const referer = normalizeText(body.referer).slice(0, 1000);
  const landingUrl = normalizeText(body.landingUrl).slice(0, 1000);
  const language = normalizeText(body.language).slice(0, 20);

  if (!action) {
    return res.status(400).json({ error: "Debes indicar la acción de auth." });
  }

  if (action === "logout") {
    const parsedSession = parseSessionCookieFromRequest(req);

    if (parsedSession?.sessionId) {
      if (usePostgres) {
        await deleteSessionByIdPostgres(parsedSession.sessionId);
      } else {
        deleteSessionByIdLocal(parsedSession.sessionId);
      }
    }

    clearSessionCookie(res);
    return res.status(200).json({ ok: true, message: "Sesión cerrada." });
  }

  /*
   * Los consentimientos que se pueden ver y retirar.
   *
   * `save_consents` es la del alta y se queda como está: su COALESCE preserva
   * la fecha en que se dio, que es la prueba. Esto es lo otro —lo que faltaba—
   * y por eso es una acción aparte y no un parámetro más de aquella.
   *
   * Solo los cuatro de comunicaciones. El legal no lleva interruptor: no se
   * pueden «des-aceptar» las condiciones y seguir teniendo cuenta, eso es
   * darse de baja.
   */
  if (action === "get_consents" || action === "update_consents") {
    if (!usePostgres) {
      return res.status(503).json({ error: "Los consentimientos solo se guardan en Postgres." });
    }

    const sesion = await authHandler.getSessionUserFromRequest(req);
    const correo = normalizeText(sesion?.user?.email).toLowerCase();
    if (!correo) {
      return res.status(401).json({ error: "Sesión no válida." });
    }

    const consentimientos = require("../lib/consentimientos");
    const pool = getPgPool();

    try {
      if (action === "get_consents") {
        return res.status(200).json({ ok: true, consents: await consentimientos.estadoDe(pool, correo) });
      }

      const deseado = {};
      for (const tipo of consentimientos.TIPOS) {
        if (body && Object.prototype.hasOwnProperty.call(body, tipo)) deseado[tipo] = body[tipo];
      }

      const { cambios, estado } = await consentimientos.aplica(pool, correo, deseado, {
        origen: normalizeText(body.origen) || "web",
        ip: clientIp,
        userAgent: clientUa,
      });

      return res.status(200).json({ ok: true, consents: estado, cambios: cambios.length });
    } catch (err) {
      console.error("[consentimientos]", err?.message);
      return res.status(500).json({ error: "No se han podido guardar los consentimientos." });
    }
  }

  if (action === "save_consents") {
    const parsedSession = parseSessionCookieFromRequest(req);
    if (!parsedSession?.sessionId) {
      return res.status(401).json({ error: "Sesión no válida." });
    }
    const sessionRow = usePostgres ? await findSessionByIdPostgres(parsedSession.sessionId) : null;
    if (!sessionRow?.userId) {
      return res.status(401).json({ error: "Sesión no válida." });
    }
    if (usePostgres) {
      const now = new Date().toISOString();
      const legalAt            = body.consentLegal             ? now : null;
      const marketingEmailAt   = body.consentMarketingEmail    ? now : null;
      const marketingSmsAt     = body.consentMarketingSms      ? now : null;
      const thirdPartyEmailAt  = body.consentThirdPartyEmail   ? now : null;
      const thirdPartySmsAt    = body.consentThirdPartySms     ? now : null;
      // backward-compat aggregates: set if any sub-consent is given
      const marketingAt        = (body.consentMarketingEmail || body.consentMarketingSms) ? now : null;
      const experianAt         = (body.consentThirdPartyEmail || body.consentThirdPartySms) ? now : null;
      // Tracking fields — only fill if currently empty (COALESCE + NULLIF)
      const reviewIp       = clientIp || "";
      const reviewUa       = clientUa || "";
      const reviewLang     = normalizeText(body.language).slice(0, 20) || "";
      const reviewUtmSrc   = normalizeText(body.utmSource);
      const reviewUtmMed   = normalizeText(body.utmMedium);
      const reviewUtmCamp  = normalizeText(body.utmCampaign);
      const reviewUtmCont  = normalizeText(body.utmContent);
      const reviewReferer  = normalizeText(body.referer).slice(0, 1000) || "";
      const reviewLanding  = normalizeText(body.landingUrl).slice(0, 1000) || "";
      const reviewAffiliate = body.affiliateData && typeof body.affiliateData === "object" ? body.affiliateData : null;
      const pool = getPgPool();
      await pool.query(
        `UPDATE moveadvisor_users
         SET consent_legal_at              = COALESCE(consent_legal_at, $2),
             consent_marketing_at          = COALESCE(consent_marketing_at, $3),
             consent_experian_at           = COALESCE(consent_experian_at, $4),
             consent_marketing_email_at    = COALESCE(consent_marketing_email_at, $5),
             consent_marketing_sms_at      = COALESCE(consent_marketing_sms_at, $6),
             consent_thirdparty_email_at   = COALESCE(consent_thirdparty_email_at, $7),
             consent_thirdparty_sms_at     = COALESCE(consent_thirdparty_sms_at, $8),
             consents_reviewed_at          = $9,
             registration_ip               = COALESCE(NULLIF(registration_ip, ''), $10),
             registration_ua               = COALESCE(NULLIF(registration_ua, ''), $11),
             language                      = COALESCE(NULLIF(language, ''), $12),
             utm_source                    = COALESCE(NULLIF(utm_source, ''), $13),
             utm_medium                    = COALESCE(NULLIF(utm_medium, ''), $14),
             utm_campaign                  = COALESCE(NULLIF(utm_campaign, ''), $15),
             utm_content                   = COALESCE(NULLIF(utm_content, ''), $16),
             referer                       = COALESCE(NULLIF(referer, ''), $17),
             landing_url                   = COALESCE(NULLIF(landing_url, ''), $18),
             affiliate_data                = COALESCE(affiliate_data, $19)
         WHERE id = $1`,
        [
          sessionRow.userId,
          legalAt, marketingAt, experianAt,
          marketingEmailAt, marketingSmsAt, thirdPartyEmailAt, thirdPartySmsAt,
          now,
          reviewIp, reviewUa, reviewLang,
          reviewUtmSrc, reviewUtmMed, reviewUtmCamp, reviewUtmCont,
          reviewReferer, reviewLanding,
          reviewAffiliate ? JSON.stringify(reviewAffiliate) : null,
        ]
      );
      const updated = await findUserByEmailPostgres(
        (await getPgPool().query(`SELECT email FROM moveadvisor_users WHERE id = $1`, [sessionRow.userId])).rows[0]?.email
      );
      return res.status(200).json({ ok: true, user: sanitizeUser(mapDbUser(updated)) });
    }
    return res.status(200).json({ ok: true });
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

    const sessionPayload = await resolveSessionUser({ req, usePostgres });
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

    if (usePostgres) {
      await updateUserPasswordPostgres({ userId: sessionUser.id, passwordSalt: newSalt, passwordHash: newHash });
    } else {
      updateUserPasswordLocal({ userId: sessionUser.id, passwordSalt: newSalt, passwordHash: newHash });
    }

    const refreshedUser = usePostgres
      ? await findUserByIdPostgres(sessionUser.id)
      : findUserByIdLocal(sessionUser.id);
    const normalizedUser = mapDbUser(refreshedUser || sessionUser);

    const createdSession = await createSessionForUser({
      req,
      res,
      user: normalizedUser,
      usePostgres,
    });

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(normalizedUser),
      message: "Contraseña actualizada correctamente.",
      session: laSesionQueSeDevuelve(req, createdSession),
    });
  }

  if (action === "request_password_reset") {
    /*
     * El freno de verdad va primero: el de abajo vive en memoria.
     *
     * Lo que sigue —`readBackoff`, `consumeRateLimit`— cuenta en un `Map` del
     * proceso, y en Vercel cada petición puede caer en otra instancia: frena a
     * quien insiste desde un sitio, no a quien reparte. Se queda porque no
     * estorba y porque `/api/auth-status` lo enseña, pero el que decide es
     * este, que cuenta en la base.
     */
    const frenoPool = usePostgres ? getPgPool() : null;
    const resetCorreo = await FRENO.pide(frenoPool, "reset", email, FRENO.LIMITES.reset);
    const resetIp     = await FRENO.pide(frenoPool, "reset-ip", clientIp, FRENO.LIMITES.resetPorIp);
    if (!resetCorreo.paso || !resetIp.paso) {
      const espera = Math.max(resetCorreo.enSegundos, resetIp.enSegundos);
      logAuthSecurity("password_reset_request_rate_limited", {
        email: maskEmail(email), ip: maskIp(clientIp), retryAfterSeconds: espera,
      });
      res.setHeader("Retry-After", String(espera));
      return res.status(429).json({
        error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
      });
    }

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

    const foundUser = usePostgres
      ? await findUserByEmailPostgres(email)
      : db.users.find((item) => normalizeText(item?.email).toLowerCase() === email);

    if (foundUser) {
      const user = mapDbUser(foundUser);
      const resetCode = crypto.randomBytes(4).toString("hex").toUpperCase();
      const resetTokenHash = hashSessionToken(resetCode);
      const resetSession = buildPasswordResetSession({ userId: user.id, tokenHash: resetTokenHash });

      if (usePostgres) {
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

    const foundUser = usePostgres
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
    const resetSessionId = usePostgres
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

    if (usePostgres) {
      await updateUserPasswordPostgres({ userId: user.id, passwordSalt: newSalt, passwordHash: newHash });
      await deleteSessionByIdPostgres(resetSessionId);
    } else {
      updateUserPasswordLocal({ userId: user.id, passwordSalt: newSalt, passwordHash: newHash });
      deleteSessionByIdLocal(resetSessionId);
    }

    const refreshedUser = usePostgres
      ? await findUserByIdPostgres(user.id)
      : findUserByIdLocal(user.id);
    const normalizedUser = mapDbUser(refreshedUser || user);

    const createdSession = await createSessionForUser({
      req,
      res,
      user: normalizedUser,
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
      session: laSesionQueSeDevuelve(req, createdSession),
    });
  }

  if (action === "register") {
    const clientType = String(body.clientType || "individual");
    const company_name = String(body.company_name || "");
    if (!name && !(clientType === "business" && company_name)) {
      return res.status(400).json({ error: "Indica tu nombre para crear la cuenta." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Introduce un correo electrónico válido." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    /*
     * El freno del alta, y qué frena de verdad.
     *
     * Aquí no había ninguno. El login se cuida mucho de no decir si un correo
     * tiene cuenta —su comentario explica que la diferencia es una lista de
     * clientes— y tres líneas más abajo esto contesta 409 «Ya existe una cuenta
     * con ese correo». Con una lista de direcciones y una petición por cada una
     * se sabía quién está aquí, tan rápido como aguantara la máquina.
     *
     * El que corta el barrido es **el de IP**: el de correo no, porque para
     * preguntar por mil direcciones basta una petición por dirección. El de
     * correo está para que no se pueda machacar un alta concreta.
     *
     * Y esto no cierra el agujero, lo estrecha: quien tenga paciencia y muchas
     * IP sigue pudiendo preguntar. Cerrarlo de verdad es no contestar 409 —dar
     * la misma respuesta que en un alta buena y mandar un correo al dueño de la
     * dirección—, y eso cambia lo que ve la gente, así que se decide aparte.
     */
    const frenoAlta = usePostgres ? getPgPool() : null;
    const altaPorIp = await FRENO.pide(frenoAlta, "registro-ip", clientIp, FRENO.LIMITES.registroPorIp);
    const altaPorCorreo = await FRENO.pide(frenoAlta, "registro", email, FRENO.LIMITES.registro);
    if (!altaPorIp.paso || !altaPorCorreo.paso) {
      const espera = Math.max(altaPorIp.enSegundos, altaPorCorreo.enSegundos);
      logAuthSecurity("register_rate_limited", {
        email: maskEmail(email), ip: maskIp(clientIp), retryAfterSeconds: espera,
      });
      res.setHeader("Retry-After", String(espera));
      return res.status(429).json({
        error: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
      });
    }

    const existingUser = usePostgres
      ? await findUserByEmailPostgres(email)
      : db.users.find((item) => normalizeText(item?.email).toLowerCase() === email);
    if (existingUser) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    }

    const now = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString("hex");
    const user = {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `user-${Date.now()}`,
      name: clientType === "business" ? company_name : name,
      apellidos: clientType === "business" ? "" : apellidos,
      phone,
      email,
      clientType,
      company_name: clientType === "business" ? company_name : "",
      passwordSalt: salt,
      passwordHash: hashPassword(password, salt),
      createdAt: now,
      lastLoginAt: now,
      consentLegalAt,
      consentMarketingAt,
      consentExperianAt,
      consentMarketingEmailAt,
      consentMarketingSmsAt,
      consentThirdPartyEmailAt,
      consentThirdPartySmsAt,
      registrationIp: clientIp,
      registrationUa: clientUa,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      affiliateData,
      referer,
      landingUrl,
      language,
    };

    const savedUser = usePostgres
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
      usePostgres,
    });

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(normalizedSavedUser),
      message: `Cuenta creada para ${email}.`,
      session: laSesionQueSeDevuelve(req, createdSession),
    });
  }

  if (action === "login") {
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "Introduce tu correo y tu contraseña." });
    }

    /*
     * El freno, antes de mirar la contraseña.
     *
     * Aquí no había ninguno: se podían probar contraseñas en bucle, todas las
     * que se quisiera y tan rápido como aguantara la máquina. El de recuperar
     * contraseña sí existía, pero vive en un `Map` del proceso y en Vercel eso
     * no frena nada —cada petición puede caer en otra instancia—. Este cuenta
     * en la base: una sola cuenta, la vean desde donde la vean.
     *
     * Por correo **y** por IP: por correo para que no le revienten la cuenta a
     * alguien concreto, por IP para que no prueben mil correos desde el mismo
     * sitio. Y se cuenta antes de comprobar nada, para que un intento fallido
     * cueste igual que uno acertado y no se pueda medir la diferencia.
     */
    const frenoPool = usePostgres ? getPgPool() : null;
    const porCorreo = await FRENO.pide(frenoPool, "login", email, FRENO.LIMITES.login);
    const porIp     = await FRENO.pide(frenoPool, "login-ip", clientIp, FRENO.LIMITES.loginPorIp);
    if (!porCorreo.paso || !porIp.paso) {
      const espera = Math.max(porCorreo.enSegundos, porIp.enSegundos);
      logAuthSecurity("login_rate_limited", {
        email: maskEmail(email), ip: maskIp(clientIp), retryAfterSeconds: espera,
      });
      res.setHeader("Retry-After", String(espera));
      return res.status(429).json({
        error: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
      });
    }

    const foundUser = usePostgres
      ? await findUserByEmailPostgres(email)
      : db.users.find((item) => normalizeText(item?.email).toLowerCase() === email);

    /*
     * Un solo mensaje para las dos cosas, y por qué importa.
     *
     * Antes contestaba «No existe ninguna cuenta con ese correo» (404) o «La
     * contraseña no es correcta» (401), y esa diferencia es una lista de
     * clientes: con una lista de correos y una petición por cada uno se sabe
     * quién tiene cuenta aquí sin acertar ni una contraseña. Para un sitio donde
     * la gente sube su coche y sus papeles, eso ya es información que vender.
     *
     * A quien se equivoca de verdad no le sirve de menos: si no se acuerda del
     * correo o de la contraseña, lo que hace es lo mismo —probar otra vez o
     * recuperarla—.
     */
    const user = foundUser ? mapDbUser(foundUser) : null;

    /*
     * Y el reloj tampoco lo dice.
     *
     * Esto era `Boolean(user) && hashPassword(...) === user.passwordHash`, y el
     * `&&` cortaba: si la cuenta no existía, **scrypt no se llamaba**. Medido en
     * esta máquina, siete pasadas: 43,7 · 43,8 · 44,1 · 46,2 · 46,4 · 46,6 ·
     * 47,9 ms. O sea que un correo con cuenta tardaba 46 ms más que uno sin
     * ella, y eso se mide desde cualquier parte promediando unas peticiones:
     * está muy por encima del ruido de la red.
     *
     * Con lo cual el mensaje único de aquí arriba no servía de nada. Tanto
     * cuidado en no decirlo con palabras, y lo decía el cronómetro.
     *
     * Ahora el hash se calcula siempre, contra una sal de pega cuando no hay
     * usuario, y se tira. Cuesta 46 ms en el caso que antes era gratis; es el
     * precio de que los dos casos se parezcan.
     */
    const hashRecibido = hashPassword(password, user ? user.passwordSalt : SAL_DE_PEGA);
    const acierta = Boolean(user) && hashRecibido === user.passwordHash;

    if (!acierta) {
      logAuthSecurity("login_failed", {
        email: maskEmail(email), ip: maskIp(clientIp), existeLaCuenta: Boolean(user),
      });
      return res.status(401).json({ error: "El correo o la contraseña no son correctos." });
    }

    // Acertó: la cuenta de intentos se suelta, para que un día torpe no deje a
    // nadie frenado después de entrar bien.
    await FRENO.suelta(frenoPool, "login", email);

    const now = usePostgres
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
      usePostgres,
    });

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(loggedUser),
      message: `Sesión iniciada para ${email}.`,
      session: laSesionQueSeDevuelve(req, createdSession),
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

authHandler.getSessionUserFromRequest = async function getSessionUserFromRequest(req) {
  const usePostgres = shouldUsePostgres();

  return resolveSessionUser({ req, usePostgres });
};

module.exports = authHandler;

/*
 * Se asoman dos piezas para poder probarlas sueltas.
 *
 * `authHandler` habla con tres bases distintas y montarlas en una prueba diría
 * más del andamio que del código. Estas dos son decisiones puras —de una
 * variable de entorno a un sí o un no— y son justo las que no pueden torcerse
 * sin que nadie se entere.
 */
module.exports.cookieSegura = cookieSegura;
module.exports.buildSessionCookie = buildSessionCookie;
