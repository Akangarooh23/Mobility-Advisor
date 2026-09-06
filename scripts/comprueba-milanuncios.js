/**
 * Comprueba el verificador de ofertas activas de Milanuncios.
 *
 *   npm run test:milanuncios
 *
 * Saca los nodos Code del workflow tal cual estan en el JSON, les da el mismo
 * contrato que les daria n8n y lanza el SQL que generan contra la base de
 * verdad, dentro de BEGIN/ROLLBACK.
 *
 * No pide una sola ficha a Milanuncios: las respuestas se fabrican. El portal
 * bloquea por comportamiento y no hay por que gastar cupo en una prueba.
 *
 * Lo que vigila, que es donde este workflow puede hacer daño:
 *
 *   - Que la pantalla de bloqueo de Imperva -HTTP 200 y 96 KB de HTML- NO se
 *     cuente como anuncio vivo ni como baja. Ese es el fallo que tiene hoy
 *     scripts/verify-liveness.js y el que no se puede repetir.
 *   - Que en cuanto llega un bloqueo se deje de pedir.
 *   - Que solo se de de baja con una prueba clara (404/410), y que un 200 raro
 *     no toque is_active.
 *   - Que un fallo pasajero no marque la oferta como vista.
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "milanuncios-verificar-activas.json"), "utf8"));
const codigo = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;

function ejecuta(js, ctx) {
  const salida = [];
  const consola = { log: (m) => salida.push(String(m)) };
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console", js);
  const r = f(ctx.$, ctx.$input, () => ctx.estatico, { id: ctx.run || "run-1" }, consola);
  return { items: r || [], log: salida };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }] });

// La pantalla de Imperva: HTTP 200 y un HTML enorme. Tal como llega de verdad.
const BLOQUEO = { statusCode: 200, body: "<html><head><title>milanuncios.com</title></head>"
  + "<body><h1>Pardon Our Interruption...</h1>" + "x".repeat(90000) + "</body></html>" };
const VIVA = { statusCode: 200, body: "<html><script>window.__INITIAL_PROPS__ = \"{}\";</script></html>" };
const MUERTA = { statusCode: 404, body: "<html>No encontrado</html>" };
const CAIDA = { statusCode: 503, body: "" };
const RARA = { statusCode: 200, body: "<html><body>Este anuncio ya no esta disponible</body></html>" };

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

// Pasa una oferta por ¿toca pedirla? y, si toca, por Veredicto.
function pasa(oferta, respuesta, estatico, run) {
  const t = ejecuta(codigo("Code: ¿toca pedirla?"), { estatico, run, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (item.saltar) return { saltada: true, log: [] };
  const v = ejecuta(codigo("Code: Veredicto"), {
    estatico, run,
    $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: item } } : uno({})),
    $input: uno(respuesta),
  });
  return { saltada: false, sql: v.items[0].json.sql, veredicto: v.items[0].json.veredicto, log: v.log };
}

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  const ofertas = (await c.query(`SELECT id, url, lower(brand) AS marca
    FROM moveadvisor_market_offers WHERE portal='milanuncios' AND is_active
    ORDER BY id LIMIT 5`)).rows;
  console.log("Ofertas de prueba: " + ofertas.length + "\n");

  // ===================================================== la pantalla de bloqueo
  console.log("BLOQUEO — lo que mas daño puede hacer");
  const e1 = {};
  const r1 = pasa(ofertas[0], BLOQUEO, e1);
  r1.log.forEach((l) => console.log("      " + l));
  comprueba("no la cuenta como anuncio vivo", r1.veredicto !== "viva");
  comprueba("no la cuenta como baja", r1.veredicto !== "baja");
  comprueba("no genera NINGUN SQL", r1.sql === null || r1.sql === undefined);
  comprueba("no la suma a las fichas miradas", (e1.mil_vistas || 0) === 0);
  comprueba("deja marcado el bloqueo", e1.mil_bloqueo === true);

  console.log("\n  y a partir de ahi deja de pedir:");
  const siguientes = ofertas.slice(1).map((o) => pasa(o, VIVA, e1));
  comprueba("salta las 4 ofertas que quedaban", siguientes.every((r) => r.saltada),
    "(" + siguientes.filter((r) => r.saltada).length + " de 4)");

  // ===================================================== veredictos, con la base
  console.log("\nVEREDICTOS — contra la base real, con ROLLBACK");
  const e2 = {};
  await c.query("BEGIN");
  try {
    const viva = pasa(ofertas[0], VIVA, e2);
    comprueba("un 200 con datos de anuncio = sigue publicada", viva.veredicto === "viva");
    await c.query(viva.sql);
    let f = (await c.query(`SELECT is_active, last_seen_at, last_checked_at
      FROM moveadvisor_market_offers WHERE id=$1`, [ofertas[0].id])).rows[0];
    comprueba("la deja activa y actualiza last_seen_at", f.is_active === true
      && Date.now() - new Date(f.last_seen_at).getTime() < 60000);

    const muerta = pasa(ofertas[1], MUERTA, e2);
    comprueba("un 404 = baja", muerta.veredicto === "baja");
    await c.query(muerta.sql);
    f = (await c.query(`SELECT is_active FROM moveadvisor_market_offers WHERE id=$1`,
      [ofertas[1].id])).rows[0];
    comprueba("y la da de baja de verdad", f.is_active === false);

    const caida = pasa(ofertas[2], CAIDA, e2);
    comprueba("un 503 es fallo pasajero, no baja", caida.veredicto === "pasajero");
    comprueba("el SQL del fallo pasajero no toca is_active",
      !/is_active/.test(caida.sql));
    comprueba("ni marca la oferta como vista", !/last_seen_at/.test(caida.sql));
    await c.query(caida.sql);
    f = (await c.query(`SELECT is_active FROM moveadvisor_market_offers WHERE id=$1`,
      [ofertas[2].id])).rows[0];
    comprueba("la oferta sigue activa tras el fallo", f.is_active === true);

    const rara = pasa(ofertas[3], RARA, e2);
    rara.log.forEach((l) => console.log("      " + l));
    comprueba("un 200 sin datos de anuncio queda sin clasificar", rara.veredicto === "rara");
    comprueba("y NO la da de baja por una corazonada", !/is_active/.test(rara.sql));
    await c.query(rara.sql);
    f = (await c.query(`SELECT is_active FROM moveadvisor_market_offers WHERE id=$1`,
      [ofertas[3].id])).rows[0];
    comprueba("sigue activa hasta que sepamos que significa", f.is_active === true);
  } finally { await c.query("ROLLBACK"); }

  // ===================================================== resumen
  console.log("\nRESUMEN — lo que hay que leer para ajustar el ritmo");
  const res = ejecuta(codigo("Code: Resumen"), { estatico: e2, $: () => uno({}), $input: uno({}) });
  res.log.forEach((l) => console.log("      " + l));
  const rj = res.items[0].json;
  comprueba("cuenta 4 fichas miradas", rj.vistas === 4, "(" + rj.vistas + ")");
  comprueba("1 viva, 1 baja, 1 rara, 1 pasajero",
    rj.vivas === 1 && rj.bajas === 1 && rj.raras === 1 && rj.fallos === 1);

  // El parte tiene que quedar escrito en la base: con
  // saveDataSuccessExecution='none' es lo unico que sobrevive a la ejecucion.
  await c.query("BEGIN");
  try {
    await c.query(rj.sql);
    const p = (await c.query(`SELECT * FROM moveadvisor_verify_runs
      WHERE portal='milanuncios' ORDER BY id DESC LIMIT 1`)).rows[0];
    comprueba("apunta el parte en la base", !!p);
    comprueba("con el reparto de veredictos", p && p.checked === 4 && p.alive === 1
      && p.deactivated === 1 && p.unclassified === 1 && p.transient === 1);
    comprueba("y con la espera que se uso, que es la mitad de la medida",
      p && p.wait_seconds === 20, "(" + (p && p.wait_seconds) + "s)");
  } finally { await c.query("ROLLBACK"); }

  const res1 = ejecuta(codigo("Code: Resumen"), { estatico: e1, $: () => uno({}), $input: uno({}) });
  comprueba("avisa del bloqueo y de cuantas aguanto", res1.items[0].json.bloqueado === true);
  console.log("      " + res1.log.filter((l) => /BLOQUEADO|subir ESPERA/.test(l)).join("\n      "));
  await c.query("BEGIN");
  try {
    await c.query(res1.items[0].json.sql);
    const p = (await c.query(`SELECT * FROM moveadvisor_verify_runs
      WHERE portal='milanuncios' ORDER BY id DESC LIMIT 1`)).rows[0];
    comprueba("el parte del bloqueo deja blocked=true y las fichas que aguanto",
      p && p.blocked === true && p.checked === 0,
      "(aguanto " + (p && p.checked) + " con " + (p && p.wait_seconds) + "s)");
  } finally { await c.query("ROLLBACK"); }

  // ===================================================== estado entre ejecuciones
  console.log("\nEJECUCIONES SEGUIDAS — no puede heredar el bloqueo de la anterior");
  const nueva = pasa(ofertas[4], VIVA, e1, "run-2");
  comprueba("una ejecucion nueva arranca limpia", !nueva.saltada && nueva.veredicto === "viva");
  comprueba("y reinicia los contadores", e1.mil_vistas === 1 && e1.mil_bloqueo === false);

  // ===================================================== la cola
  console.log("\nCOLA");
  const q = await c.query(wf.nodes.find((n) => n.name === "PG: Cola a verificar").parameters.query);
  const total = Number((await c.query(`SELECT count(*) n FROM moveadvisor_market_offers
    WHERE portal='milanuncios' AND is_active`)).rows[0].n);
  console.log("      " + q.rows.length + " ofertas por ejecucion, " + total + " activas en total");
  console.log("      " + q.rows.length * 6 + " comprobaciones al dia con 6 ejecuciones");
  comprueba("un dia cubre todas las activas", q.rows.length * 6 >= total,
    "(" + q.rows.length * 6 + " >= " + total + ")");

  await c.end();
  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
