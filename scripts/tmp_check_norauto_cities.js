require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

pool.query(
  `SELECT city, postcode, province, count(*) as n
   FROM workshop_locations
   WHERE partner = 'norauto'
   GROUP BY city, postcode, province
   ORDER BY province NULLS FIRST, city`
).then((r) => {
  r.rows.forEach((x) => console.log(JSON.stringify(x)));
  pool.end();
}).catch((e) => { console.error(e.message); pool.end(); });
