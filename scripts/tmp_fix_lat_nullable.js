require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
pool.connect().then(async (client) => {
  await client.query(`ALTER TABLE workshop_locations ALTER COLUMN lat DROP NOT NULL`);
  await client.query(`ALTER TABLE workshop_locations ALTER COLUMN lon DROP NOT NULL`);
  console.log("OK — lat/lon ahora nullable");
  client.release();
  await pool.end();
}).catch(e => { console.error(e.message); process.exit(1); });
