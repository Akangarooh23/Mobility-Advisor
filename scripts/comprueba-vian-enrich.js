/**
 * Comprueba el enriquecedor de VIAN.
 *
 *   npm run test:vian-enrich
 *
 * Pide unas pocas fichas reales, se las da al nodo Code tal como está en el JSON
 * del workflow, y lanza el SQL que genera contra la base de verdad dentro de
 * BEGIN/ROLLBACK.
 *
 * Lo que vigila:
 *
 *   - Que la provincia salga limpia. Vive dentro de la descripción del JSON-LD
 *     —«... Cambio manual. En Madrid.»— y el punto final se colaba en la
 *     captura: «Madrid.» guardado así no casa con «Madrid» en el filtro.
 *   - Que la versión salga sin la marca y el modelo delante.
 *   - Que NO se escriba description ni warranty_months. VIAN no los da: las
 *     Observaciones son el mismo párrafo comercial en todas las fichas, y la
 *     garantía no aparece por coche. Rellenarlos sería inventar.
 *   - Que las columnas que llegan a CERO usen NULLIF y no COALESCE a secas.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "vian-enrich-offers.json"), "utf8"));
const JS = wf.nodes.find((n) => n.name === "Code: Extraer de la ficha").parameters.jsCode;
const cabs = wf.nodes.find((n) => n.type.endsWith("httpRequest")).parameters.headerParameters.parameters;
const H = {}; cabs.forEach((c) => { H[c.name] = c.value; });

function extrae(oferta, respuesta) {
  const log = [];
  const f = new Function("$", "$input", "console", JS);
  const r = f(() => ({ item: { json: oferta } }), { first: () => ({ json: respuesta }) },
    { log: (m) => log.push(String(m)) });
  return { json: r[0].json, log };
}

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
// El valor de una columna dentro del SQL generado. Se lee la cadena entera
// entre comillas —admitiendo la comilla escapada como ''— y no «hasta el primer
// paréntesis»: las versiones llevan uno dentro, «1.5 MHEV Limited DCT 96 kW
// (130 CV)», y cortando ahí la prueba las enseñaba mutiladas y parecía un fallo
// del enriquecedor cuando el dato estaba bien.
const valor = (sql, col) => {
  const m = sql.match(new RegExp("(?:^|[\\s,])" + col + " = (?:COALESCE\\(NULLIF\\(" + col
    + ", (?:''|0)\\), )?'((?:[^']|'')*)'"));
  return m ? m[1].replace(/''/g, "'") : null;
};

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const filas = (await c.query(`SELECT id, source_url, brand, model
    FROM moveadvisor_marketplace_vo_offers WHERE portal='vian' AND is_active
      AND COALESCE(source_url,'')<>'' ORDER BY random() LIMIT 4`)).rows;

  // ── fichas que no vienen ──────────────────────────────────────────────────
  console.log("CUANDO LA FICHA NO VIENE");
  const err = extrae(filas[0], { statusCode: 500, body: "" });
  comprueba("un 500 no escribe datos", !/body_type|version|provincia/.test(err.json.sql));
  comprueba("pero sella enrich_tried_at, para que la cola gire",
    /enrich_tried_at = NOW\(\)/.test(err.json.sql));
  const sinLd = extrae(filas[0], { statusCode: 200, body: "<html><body>sin json-ld</body></html>" });
  comprueba("una página sin JSON-LD tampoco inventa nada",
    !/body_type|version|provincia/.test(sinLd.json.sql), "(" + sinLd.json.veredicto + ")");

  // ── fichas reales ─────────────────────────────────────────────────────────
  console.log("\nFICHAS REALES");
  const sqls = [];
  let conCarroc = 0, conProv = 0, conVer = 0, conCc = 0, conPvp = 0, conEq = 0;
  for (const f of filas) {
    const r = await fetch(f.source_url, { headers: H, signal: AbortSignal.timeout(25000) });
    const body = await r.text();
    const out = extrae(f, { statusCode: r.status, body: body });
    out.log.forEach((l) => console.log("      " + l));
    if (out.json.veredicto !== "enriquecida") continue;
    sqls.push(out.json.sql);
    if (/body_type = /.test(out.json.sql)) conCarroc++;
    if (/provincia = /.test(out.json.sql)) conProv++;
    if (/version = /.test(out.json.sql)) conVer++;
    if (/displacement = /.test(out.json.sql)) conCc++;
    if (/price_new = /.test(out.json.sql)) conPvp++;
    if (/equipment = /.test(out.json.sql)) conEq++;
    await new Promise((s) => setTimeout(s, 2000));
  }
  const n = sqls.length;
  comprueba("alguna ficha se enriquece", n > 0, "(" + n + " de " + filas.length + ")");
  comprueba("saca carrocería", conCarroc === n, "(" + conCarroc + "/" + n + ")");
  comprueba("saca versión", conVer === n, "(" + conVer + "/" + n + ")");
  comprueba("saca cilindrada", conCc === n, "(" + conCc + "/" + n + ")");
  comprueba("saca provincia", conProv === n, "(" + conProv + "/" + n + ")");
  comprueba("saca equipamiento", conEq === n, "(" + conEq + "/" + n + ")");
  comprueba("saca el PVP de nuevo", conPvp === n, "(" + conPvp + "/" + n + ")");

  // ── la provincia, sin el punto ────────────────────────────────────────────
  console.log("\nLA PROVINCIA");
  const provs = sqls.map((s) => valor(s, "provincia")).filter(Boolean);
  console.log("      " + provs.join(", "));
  comprueba("sale sin el punto final pegado", provs.every((p) => !/[.,;]\s*$/.test(p)));
  comprueba("y sin el «En» delante", provs.every((p) => !/^En\s/i.test(p)));

  // ── la versión, sin marca ni modelo ───────────────────────────────────────
  console.log("\nLA VERSIÓN");
  sqls.forEach((s, i) => {
    const v = valor(s, "version");
    console.log("      " + String(filas[i].brand + " " + filas[i].model).padEnd(22) + "-> " + v);
  });
  comprueba("no repite la marca al principio", sqls.every((s, i) => {
    const v = valor(s, "version");
    return !v || !new RegExp("^" + String(filas[i].brand || "x").split(" ")[0], "i").test(v);
  }));

  // ── lo que NO se debe escribir ────────────────────────────────────────────
  console.log("\nLO QUE VIAN NO DA, Y NO SE INVENTA");
  comprueba("no escribe description", sqls.every((s) => !/[\s,]description = /.test(s)));
  comprueba("no escribe warranty_months", sqls.every((s) => !/warranty_months = /.test(s)));

  // ── el orden del escaparate ───────────────────────────────────────────────
  //
  // Enriquecer no es que el anuncio haya cambiado: es que nosotros nos hemos
  // puesto al día, y el cliente no nota que le rellenemos la carrocería. Pero el
  // escaparate desempata por updated_at DESC cuando el portal_score empata -y
  // los tres concesionarios valen 80-, así que sellarlo aquí pone a VIAN
  // por delante de los otros dos sin que ningún coche se haya movido.
  //
  // Con Modrive se vio en números: con 952 de 1.988 enriquecidas ya ocupaba de
  // la posición 1 a la 696.
  console.log("\nEL ORDEN DEL ESCAPARATE");
  comprueba("el enriquecedor NO toca updated_at", sqls.every((s) => !/updated_at/.test(s)));
  comprueba("pero sí sella last_seen_at", sqls.some((s) => /last_seen_at = NOW\(\)/.test(s)));

  // ── el COALESCE sobre columnas que llegan a cero ──────────────────────────
  console.log("\nCOLUMNAS QUE LLEGAN A CERO");
  comprueba("doors, seats y displacement usan NULLIF",
    ["doors", "seats", "displacement"].every((col) =>
      sqls.every((s) => !s.includes(col + " = COALESCE(" + col + ","))));

  // ── contra la base ────────────────────────────────────────────────────────
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  await c.query("BEGIN");
  try {
    for (const s of sqls) await c.query(s);
    const r = (await c.query(`SELECT
        count(*) FILTER (WHERE body_type IS NOT NULL) carroc,
        count(*) FILTER (WHERE doors IS NOT NULL) puertas,
        count(*) FILTER (WHERE displacement > 0) cc,
        count(*) FILTER (WHERE provincia IS NOT NULL AND provincia <> '') prov,
        count(*) FILTER (WHERE price_new > 0) pvp,
        count(*) FILTER (WHERE equipment IS NOT NULL) equipo
      FROM moveadvisor_marketplace_vo_offers
      WHERE portal='vian' AND enrich_tried_at > NOW() - INTERVAL '1 minute'`)).rows[0];
    console.log("      carrocería=" + r.carroc + " puertas=" + r.puertas + " cc=" + r.cc
      + " provincia=" + r.prov + " pvp=" + r.pvp + " equipamiento=" + r.equipo);
    comprueba("el SQL entra y llena las columnas",
      Number(r.carroc) === n && Number(r.cc) === n && Number(r.prov) === n && Number(r.pvp) === n);
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
