require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
pool.connect().then(async (client) => {
  await client.query(`ALTER TABLE workshop_locations ADD COLUMN IF NOT EXISTS service_type VARCHAR(64)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_workshop_service ON workshop_locations(service_type)`);
  console.log("OK — columna service_type añadida");
  client.release();
  await pool.end();
}).catch((e) => { console.error(e.message); process.exit(1); });
