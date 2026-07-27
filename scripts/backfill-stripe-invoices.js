// One-time script: fetches all paid Stripe invoices for a given email and inserts them into Neon.
// Usage: node scripts/backfill-stripe-invoices.js [email]
// Reads STRIPE_SECRET_KEY and POSTGRES_URL / DATABASE_URL from .env.local

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });

const { Pool } = require("pg");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const CONN_STRING = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
const TARGET_EMAIL = process.argv[2] || "";

if (!STRIPE_SECRET_KEY) {
  console.error("ERROR: STRIPE_SECRET_KEY no encontrada en .env.local");
  process.exit(1);
}
if (!CONN_STRING) {
  console.error("ERROR: POSTGRES_URL o DATABASE_URL no encontrada en .env.local");
  process.exit(1);
}
if (!TARGET_EMAIL) {
  console.error("Uso: node scripts/backfill-stripe-invoices.js <email>");
  process.exit(1);
}

const pool = new Pool({ connectionString: CONN_STRING, ssl: { rejectUnauthorized: false } });

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  return res.json();
}

async function main() {
  console.log(`\nBuscando cliente Stripe para: ${TARGET_EMAIL}`);

  const custData = await stripeGet(`/customers?email=${encodeURIComponent(TARGET_EMAIL)}&limit=5`);
  const customers = custData?.data || [];
  if (!customers.length) {
    console.error("No se encontró ningún cliente Stripe con ese email.");
    process.exit(1);
  }

  let allInvoices = [];
  for (const customer of customers) {
    console.log(`  Cliente encontrado: ${customer.id}`);
    let hasMore = true;
    let startingAfter = null;

    while (hasMore) {
      const qs = `customer=${customer.id}&limit=100${startingAfter ? `&starting_after=${startingAfter}` : ""}`;
      const data = await stripeGet(`/invoices?${qs}`);
      const invoices = data?.data || [];
      allInvoices = allInvoices.concat(invoices);
      hasMore = Boolean(data?.has_more);
      startingAfter = invoices.length ? invoices[invoices.length - 1].id : null;
    }
  }

  const paid = allInvoices.filter((inv) => inv.status === "paid" || inv.amount_paid > 0);
  console.log(`\nFacturas encontradas: ${allInvoices.length} total, ${paid.length} pagadas\n`);

  if (!paid.length) {
    console.log("Nada que insertar.");
    process.exit(0);
  }

  for (const inv of paid) {
    const id = inv.id || "";
    const number = inv.number || "";
    const date = inv.created ? new Date(inv.created * 1000).toISOString() : null;
    const amount = Number(inv.amount_paid || 0) / 100;
    const status = "Pagada";
    const pdfUrl = inv.invoice_pdf || inv.hosted_invoice_url || "";

    await pool.query(
      `INSERT INTO moveadvisor_user_invoices (id, email, number, date, amount, status, pdf_url)
       VALUES ($1, lower($2), $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         status  = EXCLUDED.status,
         pdf_url = EXCLUDED.pdf_url,
         amount  = EXCLUDED.amount`,
      [id, TARGET_EMAIL, number, date, amount, status, pdfUrl]
    );

    console.log(`  ✓ ${number || id}  ${date?.slice(0, 10)}  ${amount.toFixed(2)} EUR  ${pdfUrl ? "(PDF disponible)" : "(sin PDF)"}`);
  }

  console.log("\nBackfill completado.");
  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
