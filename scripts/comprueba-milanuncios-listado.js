/**
 * Comprueba el verificador de ofertas activas de Milanuncios.
 *
 *   npm run test:milanuncios-listado
 *
 * Saca los nodos Code del workflow tal cual estan en el JSON, les da el mismo
 * contrato que les daria n8n y lanza el SQL que generan contra la base de
 * verdad, dentro de BEGIN/ROLLBACK. Asi se comprueba lo unico que importa de
 * verdad -cuantas filas toca cada sentencia- sin dejar rastro.
 *
 * No pide una sola pagina a Milanuncios: el HTML se fabrica con la misma forma
 * que el real (__INITIAL_PROPS__ como string JSON escapado). El portal bloquea
 * por comportamiento y no hay por que gastar cupo en una prueba.
 *
 * Lo que vigila, que es donde este workflow puede hacer daño:
 *
 *   - Que NUNCA de de baja por ausencia si no ha visto el listado entero.
 *   - Que NUNCA de de baja si una pagina vino bloqueada.
 *   - Que NUNCA empiece una marca que no cabe entera en el cupo.
 *   - Que reconozca la pantalla de bloqueo, que llega con un HTTP 200.
 *   - Que la cuenta de bajas que apunta en la libreta sea la real.
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "milanuncios-verificar-por-listado.json"), "utf8"));
const codigo = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;

// --- imitacion minima de n8n -------------------------------------------------
function ejecuta(js, ctx) {
  const salida = [];
  const consola = { log: (m) => salida.push(String(m)) };
  const f = new Function("$", "$input", "$getWorkflowStaticData", "console", js);
  const r = f(ctx.$, ctx.$input, () => ctx.estatico, consola);
  return { items: r || [], log: salida };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }] });
const varios = (js) => ({ first: () => ({ json: js[0] }), all: () => js.map((j) => ({ json: j })) });

// --- HTML con la forma real: __INITIAL_PROPS__ es un string JSON escapado ----
function paginaHtml(ads, totalPages) {
  const props = { adListPagination: { adList: { ads: ads }, pagination: { totalPages: totalPages } } };
  return "<html><body><script>window.__INITIAL_PROPS__ = "
    + JSON.stringify(JSON.stringify(props)) + ";</script></body></html>";
}
const BLOQUEO = "<html><h1>Pardon Our Interruption...</h1></html>";

const trozos = (a, n) => { const r = []; for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i + n)); return r; };
let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

// Recorre el bucle entero: por cada peticion planificada pasa por ¿toca pedirla?
// y, si toca, por Procesar pagina. `respuesta(item)` decide que devuelve el
// portal para esa peticion.
async function corre(peticiones, estatico, respuesta, cliente) {
  let sellados = 0, pedidas = 0, saltadas = 0;
  const registro = [];
  for (const p of peticiones) {
    const t = ejecuta(codigo("Code: ¿toca pedirla?"), {
      estatico, $: () => uno({}), $input: uno(p),
    });
    const item = t.items[0].json;
    if (item.saltar) { saltadas++; continue; }
    pedidas++;
    const r = ejecuta(codigo("Code: Procesar página"), {
      estatico,
      $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: item } } : uno({})),
      $input: uno(respuesta(item)),
    });
    registro.push(...r.log);
    const sql = r.items[0].json.sql;
    if (sql && cliente) { const q = await cliente.query(sql); sellados += q.rowCount; }
  }
  return { sellados, pedidas, saltadas, log: registro };
}

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  const idsDe = async (marca) => (await c.query(
    `SELECT id FROM moveadvisor_market_offers
     WHERE portal='milanuncios' AND lower(brand)=$1 AND is_active ORDER BY id`, [marca])).rows.map((r) => r.id);

  const maserati = await idsDe("maserati");
  const daewoo = await idsDe("daewoo");
  console.log("En la base: maserati " + maserati.length + " activas, daewoo " + daewoo.length + "\n");

  const anuncioDe = (id) => ({ id: id.replace(/^mil_/, "") });

  // =========================================================== reparto
  console.log("REPARTO — el cupo de 9 peticiones entre varias marcas");
  const e1 = {};
  const candidatas = [
    { marca: "daewoo", activas: 20, paginas: 2, sondear: false },     // cabe: 2
    { marca: "maserati", activas: 248, paginas: 4, sondear: false },  // cabe: 4
    { marca: "volkswagen", activas: 112, paginas: 200, sondear: false }, // no cabe
    { marca: "mazda", activas: 167, paginas: null, sondear: true },   // sonda: 1
    { marca: "jeep", activas: 178, paginas: null, sondear: true },    // sonda: 1
    { marca: "ds", activas: 185, paginas: null, sondear: true },      // sonda: 1
    { marca: "fiat", activas: 153, paginas: null, sondear: true },    // ya no cabe
  ];
  const plan = ejecuta(codigo("Code: Repartir la noche"), {
    estatico: e1, $: () => uno({}), $input: varios(candidatas),
  });
  plan.log.forEach((l) => console.log("      " + l));
  const pet = plan.items.map((i) => i.json);
  comprueba("no se pasa del presupuesto de 9", pet.length <= 9, "(" + pet.length + " peticiones)");
  comprueba("mete varias marcas en la misma noche",
    new Set(pet.map((p) => p.marca)).size >= 4, "(" + new Set(pet.map((p) => p.marca)).size + " marcas)");
  comprueba("barre daewoo entera (2 paginas)", pet.filter((p) => p.marca === "daewoo").length === 2);
  comprueba("barre maserati entera (4 paginas)", pet.filter((p) => p.marca === "maserati").length === 4);
  comprueba("NO empieza volkswagen, que no cabe entera",
    pet.filter((p) => p.marca === "volkswagen").length === 0);
  comprueba("gasta lo que sobra en sondas de una pagina",
    pet.filter((p) => p.sonda).length === 3 && pet.filter((p) => p.sonda).every((p) => p.pagina === 1),
    "(" + pet.filter((p) => p.sonda).length + " sondas)");
  comprueba("las urls de la pagina 1 no llevan ?pagina=",
    pet.filter((p) => p.pagina === 1).every((p) => !/pagina=/.test(p.url)));
  comprueba("las urls de la pagina 2 en adelante si",
    pet.filter((p) => p.pagina > 1).every((p) => p.url.endsWith("?pagina=" + p.pagina)));

  // =========================================================== barrido bueno
  console.log("\nBARRIDO COMPLETO — dos marcas enteras, bajas contra la base real");
  const SIGUEN_MAS = 200, SIGUEN_DAE = 12;
  const pagsMas = trozos(maserati.slice(0, SIGUEN_MAS).map(anuncioDe), 50);   // 4 paginas
  const pagsDae = trozos(daewoo.slice(0, SIGUEN_DAE).map(anuncioDe), 6);      // 2 paginas
  const bajasMas = maserati.length - SIGUEN_MAS;
  const bajasDae = daewoo.length - SIGUEN_DAE;

  const responde = (item) => {
    if (item.marca === "maserati") return { statusCode: 200, body: paginaHtml(pagsMas[item.pagina - 1], 4) };
    if (item.marca === "daewoo") return { statusCode: 200, body: paginaHtml(pagsDae[item.pagina - 1], 2) };
    return { statusCode: 200, body: paginaHtml([{ id: "999" + item.pagina }], 200) }; // sondas: marca grande
  };

  await c.query("BEGIN");
  try {
    const run = await corre(pet, e1, responde, c);
    run.log.forEach((l) => console.log("      " + l));
    comprueba("sella las " + (SIGUEN_MAS + SIGUEN_DAE) + " que siguen publicadas",
      run.sellados === SIGUEN_MAS + SIGUEN_DAE, "(" + run.sellados + " filas)");

    const ver = ejecuta(codigo("Code: Veredicto"), { estatico: e1, $: () => uno({}), $input: uno({}) });
    ver.log.forEach((l) => console.log("      " + l));
    const porMarca = {};
    for (const i of ver.items) porMarca[i.json.marca] = i.json;

    comprueba("cierra las 5 marcas tocadas", ver.items.length === 5, "(" + ver.items.length + ")");
    comprueba("da de baja en maserati y daewoo",
      porMarca.maserati.bajas === true && porMarca.daewoo.bajas === true);
    comprueba("NO da de baja en las sondas",
      ["mazda", "jeep", "ds"].every((m) => porMarca[m] && porMarca[m].bajas === false));

    for (const i of ver.items) await c.query(i.json.sql);

    const quedanMas = Number((await c.query(`SELECT count(*) n FROM moveadvisor_market_offers
      WHERE portal='milanuncios' AND lower(brand)='maserati' AND is_active`)).rows[0].n);
    const quedanDae = Number((await c.query(`SELECT count(*) n FROM moveadvisor_market_offers
      WHERE portal='milanuncios' AND lower(brand)='daewoo' AND is_active`)).rows[0].n);
    comprueba("quedan activas las " + SIGUEN_MAS + " vistas de maserati", quedanMas === SIGUEN_MAS, "(" + quedanMas + ")");
    comprueba("quedan activas las " + SIGUEN_DAE + " vistas de daewoo", quedanDae === SIGUEN_DAE, "(" + quedanDae + ")");

    const lib = {};
    for (const r of (await c.query(`SELECT * FROM moveadvisor_brand_sweeps WHERE portal='milanuncios'`)).rows)
      lib[r.brand] = r;
    comprueba("apunta las 5 marcas en la libreta", Object.keys(lib).length === 5, "(" + Object.keys(lib).length + ")");
    comprueba("apunta las bajas reales de maserati", lib.maserati.deactivated === bajasMas,
      "(" + lib.maserati.deactivated + " de " + bajasMas + ")");
    comprueba("apunta las bajas reales de daewoo", lib.daewoo.deactivated === bajasDae,
      "(" + lib.daewoo.deactivated + " de " + bajasDae + ")");
    comprueba("marca complete solo en las barridas enteras",
      lib.maserati.complete === true && lib.daewoo.complete === true
      && ["mazda", "jeep", "ds"].every((m) => lib[m].complete === false));
    comprueba("la sonda deja apuntado el tamaño que descubrio", lib.mazda.total_pages === 200,
      "(" + lib.mazda.total_pages + " paginas)");
  } finally { await c.query("ROLLBACK"); }

  // =========================================================== marca crecida
  console.log("\nMARCA CRECIDA — la libreta decia 4 paginas y ahora tiene 6");
  const e2 = {};
  ejecuta(codigo("Code: Repartir la noche"), {
    estatico: e2, $: () => uno({}),
    $input: varios([{ marca: "maserati", activas: 248, paginas: 4, sondear: false }]),
  });
  const pet2 = [1, 2, 3, 4].map((n) => ({ marca: "maserati", pagina: n, sonda: false,
    url: "https://www.milanuncios.com/maserati-de-segunda-mano/" + (n > 1 ? "?pagina=" + n : "") }));
  await corre(pet2, e2, () => ({ statusCode: 200, body: paginaHtml(pagsMas[0], 6) }), null);
  const ver2 = ejecuta(codigo("Code: Veredicto"), { estatico: e2, $: () => uno({}), $input: uno({}) });
  ver2.log.forEach((l) => console.log("      " + l));
  comprueba("se da cuenta de que ya no lo vio entero y no da de baja",
    ver2.items[0].json.bajas === false);
  comprueba("y no cuela ningun UPDATE de ofertas",
    !/UPDATE moveadvisor_market_offers/.test(ver2.items[0].json.sql));

  // =========================================================== bloqueo
  console.log("\nBLOQUEO A MITAD — deja de pedir y no da de baja a nadie");
  const e3 = {};
  ejecuta(codigo("Code: Repartir la noche"), {
    estatico: e3, $: () => uno({}),
    $input: varios([
      { marca: "daewoo", activas: 20, paginas: 2, sondear: false },
      { marca: "maserati", activas: 248, paginas: 4, sondear: false },
    ]),
  });
  const pet3 = [
    { marca: "daewoo", pagina: 1, sonda: false, url: "u1" },
    { marca: "daewoo", pagina: 2, sonda: false, url: "u2" },
    { marca: "maserati", pagina: 1, sonda: false, url: "u3" },
    { marca: "maserati", pagina: 2, sonda: false, url: "u4" },
  ];
  const run3 = await corre(pet3, e3, (item) =>
    (item.marca === "daewoo" && item.pagina === 2)
      ? { statusCode: 200, body: BLOQUEO }
      : { statusCode: 200, body: paginaHtml(pagsDae[0], 2) }, null);
  run3.log.forEach((l) => console.log("      " + l));
  comprueba("detecta el bloqueo aunque venga con HTTP 200", e3.mil_bloqueo === true);
  comprueba("deja de pedir paginas en cuanto le bloquean",
    run3.pedidas === 2 && run3.saltadas === 2, "(" + run3.pedidas + " pedidas, " + run3.saltadas + " saltadas)");
  const ver3 = ejecuta(codigo("Code: Veredicto"), { estatico: e3, $: () => uno({}), $input: uno({}) });
  ver3.log.forEach((l) => console.log("      " + l));
  comprueba("no da de baja a nadie", ver3.items.every((i) => i.json.bajas === false));
  comprueba("ningun SQL toca las ofertas",
    ver3.items.every((i) => !/UPDATE moveadvisor_market_offers/.test(i.json.sql)));
  comprueba("no apunta las marcas que no llego a mirar", ver3.items.length === 1,
    "(" + ver3.items.map((i) => i.json.marca).join(", ") + ")");

  // =========================================================== cola
  console.log("\nCOLA — que marcas saldrian esta noche");
  const q = await c.query(wf.nodes.find((n) => n.name === "PG: Marcas candidatas").parameters.query);
  console.log("      " + q.rows.length + " candidatas, las 5 primeras:");
  q.rows.slice(0, 5).forEach((r) => console.log("        " + r.marca.padEnd(14)
    + String(r.activas).padStart(4) + " activas   paginas=" + (r.paginas === null ? "?" : r.paginas)
    + "   sondear=" + r.sondear));
  comprueba("la cola devuelve candidatas", q.rows.length > 0);

  await c.end();
  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
