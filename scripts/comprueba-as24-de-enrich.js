/**
 * Comprueba el enriquecedor de Alemania.
 *
 *   npm run test:as24-de-enrich
 *
 * Pide DOS fichas alemanas de verdad y se las da al nodo Code tal como está en
 * el JSON del workflow. Luego lanza el SQL contra la base dentro de
 * BEGIN/ROLLBACK.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que NO escriba environmental_label. AutoScout24 da la norma europea
 *     -«Euro 6»- y esa columna guarda la etiqueta de la DGT: C, ECO, B,
 *     0 Emisiones. Meter una en la otra habría contaminado 138.000 filas con un
 *     valor que ningún filtro entiende, y encima parecería que está relleno.
 *   - Que la tracción salga en NUESTRO vocabulario. El portal dice «Tracción
 *     delantera»; la tabla usa «Delantera», «Trasera», «Total».
 *   - Que updated_at no se toque: enriquecer no es que el anuncio haya
 *     cambiado, es que nosotros nos hemos puesto al día.
 *   - Que una ficha que no se sabe leer gaste su enrich_tried_at igualmente,
 *     para no atascar una cola de 138.577.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "autoscout24-de-enrich-offers.json"), "utf8"));
const codigo = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;
const http = wf.nodes.find((n) => n.type.endsWith("httpRequest"));
const H = {};
((http.parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });

function corre(js, res, oferta) {
  const log = [];
  const f = new Function("$", "$input", "console", js);
  const r = f(() => ({ item: { json: oferta } }),
    { first: () => ({ json: res }), all: () => [{ json: res }] },
    { log: (m) => log.push(String(m)) });
  return { json: (r && r[0] ? r[0].json : {}), log };
}

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  comprueba("el nodo HTTP manda User-Agent",
    http.parameters.sendHeaders === true && !!H["User-Agent"]);
  comprueba("ninguna cabecera en options.headers, que typeVersion 4 ignora",
    !(http.parameters.options || {}).headers);
  comprueba("un corte de red no tumba la pasada",
    http.onError === "continueRegularOutput");
  comprueba("los nodos de Postgres reintentan",
    wf.nodes.filter((n) => n.type.endsWith(".postgres")).every((n) => n.retryOnFail === true));
  comprueba("hay un IF antes del HTTP para la cola vacía",
    wf.nodes.some((n) => n.name === "IF: ¿hay ficha que pedir?"));
  comprueba("el workflow avisa si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");

  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const p = String(expr).split(" ");
  comprueba("corre entre las 8:00 y las 00:00",
    String(p[2]).split(",").map(Number).every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto, para no pisar a los demás", Number(p[1]) !== 0, "minuto " + p[1]);

  // ══ la cola ══════════════════════════════════════════════════════════════
  console.log("\nLA COLA");
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const cola = wf.nodes.find((n) => n.name === "PG: Cola a enriquecer").parameters.query;
  comprueba("solo ofertas alemanas activas",
    /portal = 'autoscout24'/.test(cola) && /country = 'DE'/.test(cola) && /AND is_active/.test(cola));
  comprueba("solo las que no han pasado nunca", /enrich_tried_at IS NULL/.test(cola));
  comprueba("y por orden de utilidad: primero las candidatas a importar",
    /ORDER BY import_score DESC NULLS LAST/.test(cola));

  const q = await c.query(cola);
  console.log("      pendientes en la cola ahora: " + q.rows.length
    + " (de " + (await c.query(`SELECT count(*)::int n FROM moveadvisor_market_offers
        WHERE portal='autoscout24' AND country='DE' AND is_active AND enrich_tried_at IS NULL`)).rows[0].n + ")");

  // ══ contra fichas de verdad ══════════════════════════════════════════════
  // Se miran VARIAS fichas y se juzga sobre el conjunto, no sobre una.
  //
  // Con una sola la prueba es una lotería: la cola trae ofertas ya muertas -que
  // responden 410 y no traen nada, y está bien que no traigan nada- y algunas
  // vivas son campers o furgonetas que no declaran ni puertas ni CO₂. Exigirle
  // todos los campos a una ficha cualquiera es pedirle al test que falle por
  // motivos que no son fallos.
  console.log("\nSIETE FICHAS REALES");
  let ultimoSql = null, ultimoId = null;
  const vivas = [];
  let muertas = 0;
  for (const fila of q.rows.slice(0, 7)) {
    const r = await fetch(fila.url, { headers: H, signal: AbortSignal.timeout(30000) });
    const body = await r.text();
    const out = corre(codigo("Code: Extraer de la ficha"),
      { statusCode: r.status, body: body }, fila);
    const j = out.json;

    if (r.status !== 200) {
      muertas++;
      console.log("      HTTP " + r.status + "  (ya vendida)   solo gasta el intento: "
        + (/enrich_tried_at = NOW\(\)/.test(j.sql || "") && !/body_type/.test(j.sql || "") ? "sí" : "NO"));
      comprueba("una ficha ya vendida no inventa datos",
        !/body_type|co2 =|doors/.test(j.sql || ""));
      await dormir(1300);
      continue;
    }

    vivas.push(j);
    ultimoSql = j.sql;
    ultimoId = fila.id;
    console.log("      HTTP 200  " + String(j.carroceria || "-").padEnd(20)
      + (j.puertas || "-") + "p  " + (j.plazas || "-") + " plazas  "
      + (j.cilindrada || "-") + " cc  " + (j.co2 || "-") + " g/km  " + (j.traccion || "-"));

    comprueba("  genera el UPDATE", !!j.sql && /^UPDATE moveadvisor_market_offers/.test(j.sql));
    comprueba("  la tracción usa el vocabulario de la tabla",
      !j.traccion || ["Delantera", "Trasera", "Total"].includes(j.traccion), j.traccion || "-");
    comprueba("  NO escribe environmental_label",
      !/environmental_label/.test(j.sql) && !/Euro ?\d/.test(j.sql));
    comprueba("  NO toca updated_at", !/updated_at/.test(j.sql));
    await dormir(1300);
  }

  console.log("\nSOBRE EL CONJUNTO  (" + vivas.length + " vivas, " + muertas + " ya vendidas)");
  const conAlgo = (f) => vivas.filter(f).length;
  comprueba("la mayoría da carrocería", conAlgo((j) => !!j.carroceria) >= vivas.length * 0.8,
    conAlgo((j) => !!j.carroceria) + " de " + vivas.length);
  comprueba("la mayoría da cilindrada", conAlgo((j) => j.cilindrada > 100) >= vivas.length * 0.7,
    conAlgo((j) => j.cilindrada > 100) + " de " + vivas.length);
  comprueba("alguna da CO₂, que es lo que decide el impuesto de matriculación",
    conAlgo((j) => !!j.co2) > 0,
    vivas.filter((j) => j.co2).map((j) => j.co2).join(", ") + " g/km");
  comprueba("alguna da puertas", conAlgo((j) => j.puertas > 0) > 0);

  // ══ una ficha que no se sabe leer ════════════════════════════════════════
  console.log("\nUNA FICHA QUE NO SE SABE LEER");
  for (const caso of [
    ["HTTP 500", { statusCode: 500, body: "" }],
    ["200 sin __NEXT_DATA__", { statusCode: 200, body: "<html><body>nada</body></html>" }],
  ]) {
    const mala = corre(codigo("Code: Extraer de la ficha"), caso[1], { id: "as24_x", url: "u" });
    comprueba(caso[0] + ": gasta su intento y no escribe nada más",
      /enrich_tried_at = NOW\(\)/.test(mala.json.sql || "")
      && !/body_type|co2|doors/.test(mala.json.sql || ""));
  }

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  await c.query("BEGIN");
  try {
    const lee = async () => (await c.query(
      "SELECT updated_at, body_type, doors, seats, displacement, co2, consumption, traction, enrich_tried_at"
      + " FROM moveadvisor_market_offers WHERE id = $1", [ultimoId])).rows[0];
    const antes = await lee();
    const res = await c.query(ultimoSql);
    comprueba("el SQL casa con una oferta nuestra", res.rowCount === 1, "(" + res.rowCount + " filas)");
    const desp = await lee();
    comprueba("los datos entran",
      !!desp.body_type && desp.doors > 0 && desp.seats > 0 && desp.displacement > 0,
      desp.body_type + ", " + desp.doors + "p, " + desp.seats + " plazas, " + desp.displacement + " cc"
      + (desp.co2 ? ", " + desp.co2 + " g/km" : ""));
    comprueba("y updated_at se queda donde estaba",
      String(antes.updated_at) === String(desp.updated_at), String(antes.updated_at).slice(0, 19));
    comprueba("queda marcada como intentada", !!desp.enrich_tried_at);
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
