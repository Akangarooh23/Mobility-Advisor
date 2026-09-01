/**
 * Poner los productos de garantía en el modelo que hay.
 *
 * Se cargaron cuando PopCar compraba el coche y lo vendía: entonces la garantía
 * era obligatoria, iba dentro del precio, y por eso había una llamada **«Garantía
 * incluida»** a **0 €** marcada como base.
 *
 * Ese modelo ya no existe. Ahora no le vendemos el coche —se lo vende el
 * concesionario alemán— así que no le debemos ninguna garantía: la pone una
 * aseguradora y el cliente la añade si quiere.
 *
 * Con los nombres de antes, la ficha se contradecía sola: ofrecía «Garantía
 * incluida · 12 meses · sin coste» justo debajo del párrafo que dice que la pone
 * una aseguradora y no nosotros.
 *
 *   node scripts/renombra-garantias.cjs          → en seco
 *   node scripts/renombra-garantias.cjs --aplica → escribe
 *
 * **Los precios son provisionales.** Son los que se inventaron para poder ver la
 * pantalla, no los de ninguna aseguradora. Cuando lleguen los de verdad, se
 * cambian aquí y ya está.
 */
require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const APLICA = process.argv.includes("--aplica");

/**
 * Lo que tiene que quedar.
 *
 * Ninguna es base y ninguna va incluida: se empieza sin garantía, que es lo que
 * pasa si el cliente no hace nada.
 *
 * La de doce meses pasa de 0 € a tener precio. Una garantía de una aseguradora a
 * coste cero no existe, y enseñarla gratis al lado de un texto que dice que la
 * pone un tercero es contarle dos cosas distintas a la vez.
 */
const COMO_QUEDAN = [
  { viejo: "Garantía incluida",   nombre: "Garantía mecánica · 12 meses", precio: 190 },
  { viejo: "Ampliada a 24 meses", nombre: "Garantía mecánica · 24 meses", precio: 290 },
  { viejo: "Ampliada a 36 meses", nombre: "Garantía mecánica · 36 meses", precio: 690 },
];

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const { rows } = await pool.query(
    `SELECT id, nombre, meses, precio, es_base, renunciable FROM market_garantias ORDER BY nivel`
  );

  console.log("COMO ESTÁN");
  rows.forEach((r) =>
    console.log(`  ${String(r.nombre).padEnd(32)} ${String(r.precio)} €  base:${r.es_base}`)
  );

  console.log("\nCOMO QUEDARÍAN");
  const plan = [];
  for (const c of COMO_QUEDAN) {
    const fila = rows.find((r) => String(r.nombre).trim() === c.viejo);
    if (!fila) { console.log(`  (no está) ${c.viejo}`); continue; }
    plan.push({ id: fila.id, ...c });
    console.log(`  ${c.nombre.padEnd(32)} ${c.precio} €  base:false`);
  }

  if (!plan.length) { console.log("\nno hay nada que cambiar."); await pool.end(); return; }

  if (!APLICA) {
    console.log("\nen seco: no se ha escrito nada. Con --aplica se escribe.");
    await pool.end();
    return;
  }

  let n = 0;
  for (const p of plan) {
    const r = await pool.query(
      `UPDATE market_garantias
          SET nombre = $2, precio = $3, es_base = FALSE, renunciable = TRUE
        WHERE id = $1`,
      [p.id, p.nombre, p.precio]
    );
    n += r.rowCount;
  }
  console.log(`\nactualizadas ${n}`);
  await pool.end();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
