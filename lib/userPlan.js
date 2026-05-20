const { resolveAccount } = require("./billingStore");

const ACTIVE_STATUSES = new Set(["activa", "trialing"]);

let _pgPool = null;
function getPgPool() {
  if (_pgPool) return _pgPool;
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) return null;
  const { Pool } = require("pg");
  _pgPool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  return _pgPool;
}

async function getUserPlanFromDb(email) {
  const pool = getPgPool();
  if (!pool) return null;
  try {
    const result = await pool.query(
      `SELECT plan_id, plan_status FROM moveadvisor_users WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );
    if (!result.rows.length) return null;
    const { plan_id, plan_status } = result.rows[0];
    if (plan_id === "plus" && ACTIVE_STATUSES.has(plan_status)) return "plus";
    return "free";
  } catch {
    return null;
  }
}

function getUserPlanFromStore(email) {
  const account = resolveAccount({ email });
  const planId = String(account?.billingState?.planId || "").toLowerCase();
  const status = String(account?.billingState?.status || "").toLowerCase();
  if (planId === "plus" && ACTIVE_STATUSES.has(status)) return "plus";
  return "free";
}

/**
 * Returns "plus" if the user has an active Plus subscription, "free" otherwise.
 * Checks PostgreSQL first (production), falls back to billingStore (local dev).
 */
async function getUserPlan(email = "") {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return "free";

  const fromDb = await getUserPlanFromDb(normalized);
  if (fromDb !== null) return fromDb;

  return getUserPlanFromStore(normalized);
}

/**
 * Returns true if the user meets the required plan level.
 * Usage: if (!await isAllowed(email, "plus")) return res.status(403).json({ error: "Requiere plan Plus." });
 */
async function isAllowed(email, requiredPlan) {
  if (requiredPlan === "plus") return (await getUserPlan(email)) === "plus";
  return true;
}

module.exports = { getUserPlan, isAllowed };
