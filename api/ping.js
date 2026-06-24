const { Pool } = require("pg");

let _pool = null;
function getPool() {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) return null;
    _pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 1 });
  }
  return _pool;
}

module.exports = async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(200).json({ ok: true, db: false });
  }
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ ok: true, db: true });
  } catch {
    res.status(200).json({ ok: true, db: false });
  }
};
