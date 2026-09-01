/**
 * Renombrar las etapas de importación en las solicitudes ya guardadas.
 *
 * El modelo cambió: PopCar no compra el coche, lo compra el cliente al
 * concesionario alemán, y lo que se deposita no es una fianza sino el coche
 * entero más nuestro fee. Dos etapas dejaron de decir lo que pasa:
 *
 *   Fianza pagada      →  Depósito retenido
 *   Pedido a Alemania  →  Verificado y pagado
 *
 * «Fianza pagada» daba a entender que le habíamos cobrado; lo que hay es dinero
 * suyo retenido que nadie ha tocado. Y «Pedido a Alemania» describía una compra
 * nuestra: ahora lo que pasa ahí es que hemos ido a ver el coche y, solo
 * entonces, se ha liberado el pago al vendedor.
 *
 *   node scripts/renombra-etapas-importacion.cjs          → en seco
 *   node scripts/renombra-etapas-importacion.cjs --aplica → escribe
 *
 * Solo toca solicitudes de importación. Las etapas de las otras secciones del
 * marketplace se llaman igual en algunos casos y no significan lo mismo.
 */
require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const APLICA = process.argv.includes("--aplica");

const CAMBIOS = [
  ["Fianza pagada", "Depósito retenido"],
  ["Pedido a Alemania", "Verificado y pagado"],
];

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const { rows } = await pool.query(
    `SELECT status, count(*)::int AS n
       FROM moveadvisor_market_leads
      WHERE lead_type = 'import'
      GROUP BY 1 ORDER BY n DESC`
  );
  console.log("etapas guardadas hoy:");
  rows.forEach((r) => console.log(`  ${String(r.status).padEnd(24)} ${r.n}`));

  const porCambiar = rows.filter((r) => CAMBIOS.some(([de]) => de === r.status));
  const total = porCambiar.reduce((s, r) => s + r.n, 0);
  console.log(`\npor renombrar: ${total}`);
  porCambiar.forEach((r) => {
    const [, a] = CAMBIOS.find(([de]) => de === r.status);
    console.log(`  ${r.n} × ${r.status} → ${a}`);
  });

  if (!total) { console.log("\nno hay nada que renombrar."); await pool.end(); return; }

  if (!APLICA) {
    console.log("\nen seco: no se ha escrito nada. Con --aplica se escribe.");
    await pool.end();
    return;
  }

  let escritas = 0;
  for (const [de, a] of CAMBIOS) {
    const r = await pool.query(
      `UPDATE moveadvisor_market_leads
          SET status = $2
        WHERE lead_type = 'import' AND status = $1`,
      [de, a]
    );
    if (r.rowCount) console.log(`  ${r.rowCount} × ${de} → ${a}`);
    escritas += r.rowCount;
  }
  console.log(`\nrenombradas ${escritas}`);
  await pool.end();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
