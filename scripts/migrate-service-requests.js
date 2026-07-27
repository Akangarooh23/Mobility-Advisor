/**
 * Crea la tabla moveadvisor_service_requests.
 * Uso: node scripts/migrate-service-requests.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

pool.connect().then(async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_service_requests (
      id                 VARCHAR(64)   PRIMARY KEY,
      user_id            VARCHAR(64),
      user_email         VARCHAR(255)  NOT NULL,
      vehicle_id         VARCHAR(64),
      vehicle_title      VARCHAR(255),
      service_type       VARCHAR(64)   NOT NULL,
      preferred_partner  VARCHAR(64),
      preferred_province VARCHAR(128),
      preferred_dates    TEXT,
      notes              TEXT,
      status             VARCHAR(32)   NOT NULL DEFAULT 'pending',
      created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_svc_req_email
      ON moveadvisor_service_requests(user_email, created_at DESC)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_svc_req_status
      ON moveadvisor_service_requests(status, created_at DESC)
  `);
  console.log("OK — tabla moveadvisor_service_requests creada");
  client.release();
  await pool.end();
}).catch(e => { console.error(e.message); process.exit(1); });
