/**
 * Comprueba el enriquecedor de Gamboa.
 *
 *   npm run test:gamboa-enrich
 *
 * Pide unas pocas fichas reales, se las da al nodo Code tal como esta en el
 * JSON del workflow, y lanza el SQL que genera contra la base de verdad dentro
 * de BEGIN/ROLLBACK.
 *
 * Lo que vigila:
 *
 *   - Que las DOS garantias vayan cada una a su columna. En la ficha conviven
 *     "Garantia = 60 meses" (la de la marca, en la tabla tecnica) y "12 meses
 *     de garantia Gamboa" (la del concesionario, pegada al precio). Meter la
 *     de la marca en warranty_months es prometerle a un cliente cinco años de
 *     lo que tiene uno.
 *   - Que una ficha que ya no existe -Gamboa responde 200 y redirige a la
 *     categoria- no escriba datos inventados ni de nadie de baja. De dar de
 *     baja se encarga el verificador.
 *   - Que el enriquecedor RELLENE huecos y no pise lo que trajo el scraper.
 *   - Que enrich_tried_at se mueva siempre, tambien cuando no hay nada que
 *     sacar: si no, una ficha que falla atasca la cola para siempre.
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "gamboa-enrich-offers.json"), "utf8"));
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

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const filas = (await c.query(`SELECT id, source_url FROM moveadvisor_marketplace_vo_offers
    WHERE portal='gamboa' AND is_active AND COALESCE(source_url,'')<>''
    ORDER BY price DESC NULLS LAST LIMIT 6`)).rows;

  // ── fichas que ya no existen ──────────────────────────────────────────────
  console.log("FICHA QUE YA NO EXISTE");
  const muerta = extrae(filas[0], { statusCode: 200, body: "<html><body>listado de categoria</body></html>" });
  comprueba("un 200 sin ficha no inventa datos",
    !/color =|year =|warranty_months =/.test(muerta.json.sql));
  comprueba("no da de baja a nadie: eso es del verificador",
    !/is_active/.test(muerta.json.sql));
  comprueba("pero sella enrich_tried_at para que la cola siga girando",
    /enrich_tried_at = NOW\(\)/.test(muerta.json.sql));
  const err = extrae(filas[0], { statusCode: 500, body: "" });
  comprueba("un 500 tampoco escribe datos", !/color =/.test(err.json.sql));

  // ── fichas reales ─────────────────────────────────────────────────────────
  console.log("\nFICHAS REALES");
  let vivas = 0, conColor = 0, conEquipo = 0, conFotos = 0, conGarantias = 0, idas = 0;
  const sqls = [];
  const vivasOfertas = [];   // en paralelo con sqls: la oferta de cada SQL
  for (const f of filas) {
    const r = await fetch(f.source_url, { headers: H, redirect: "follow", signal: AbortSignal.timeout(25000) });
    const body = await r.text();
    const out = extrae(f, { statusCode: r.status, body: body });
    out.log.forEach((l) => console.log("      " + l));
    if (out.json.veredicto === "enriquecida") {
      vivas++;
      sqls.push(out.json.sql);
      vivasOfertas.push(f);
      if (/color = COALESCE/.test(out.json.sql)) conColor++;
      if (/equipment = /.test(out.json.sql)) conEquipo++;
      if (out.json.fotos > 0) conFotos++;
      // las dos garantias, cada una a su columna
      if (/warranty_months = COALESCE/.test(out.json.sql)
        && /brand_warranty_months = COALESCE/.test(out.json.sql)) conGarantias++;
    } else { idas++; }
    await new Promise((s) => setTimeout(s, 2000));
  }
  console.log("      -> " + vivas + " con ficha, " + idas + " ya no existen");
  comprueba("alguna ficha se enriquece", vivas > 0);
  comprueba("saca color", conColor === vivas, "(" + conColor + " de " + vivas + ")");
  comprueba("saca fotos", conFotos === vivas, "(" + conFotos + " de " + vivas + ")");
  comprueba("saca equipamiento", conEquipo === vivas, "(" + conEquipo + " de " + vivas + ")");

  // ── la galeria entera, no las tres primeras ───────────────────────────────
  // Se escapo una vez: la expresion solo miraba data-src y devolvia 3 fotos de
  // las 19 que tiene un coche normal, porque el resto van en srcset o en src.
  // Y hay que filtrar por el numero del coche: la ficha trae tambien fotos de
  // los "coches similares" del final.
  console.log("\nLA GALERIA");
  const galerias = sqls.map((s) => {
    const m = s.match(/image_urls = '(\[.*?\])'/s);
    try { return m ? JSON.parse(m[1].replace(/''/g, "'")) : []; } catch (e) { return []; }
  });
  const maxFotos = Math.max(0, ...galerias.map((g) => g.length));
  console.log("      fotos por coche: " + galerias.map((g) => g.length).join(", "));
  comprueba("trae la galeria entera, no solo las del carrusel", maxFotos >= 5,
    "(la mayor tiene " + maxFotos + ")");
  comprueba("y ninguna foto de otro coche", galerias.every((g, i) => {
    const num = (String((vivasOfertas[i] || {}).source_url || "").match(/(\d{4,})\s*$/) || [])[1];
    return !num || g.every((u) => u.includes("/" + num + "/"));
  }));

  // ── las dos garantias ─────────────────────────────────────────────────────
  console.log("\nLAS DOS GARANTIAS");
  comprueba("cada una va a su columna", conGarantias === vivas, "(" + conGarantias + " de " + vivas + ")");
  const uno = sqls[0] || "";
  const wm = (uno.match(/(?:^|[\s,])warranty_months = COALESCE\(NULLIF\(warranty_months, 0\), (\d+)\)/) || [])[1];
  const bm = (uno.match(/brand_warranty_months = COALESCE\(NULLIF\(brand_warranty_months, 0\), (\d+)\)/) || [])[1];
  console.log("      warranty_months (Gamboa) = " + wm + "    brand_warranty_months (marca) = " + bm);
  comprueba("la del concesionario es la menor de las dos",
    wm && bm ? Number(wm) <= Number(bm) : false);
  comprueba("no se cuela la de la marca en warranty_months", wm !== bm || !bm);

  // ── columnas que llegan a CERO, no a NULL ─────────────────────────────────
  // Esto es lo que se escapo la primera vez: warranty_months tiene DEFAULT 0,
  // asi que las 960 filas valen 0 y un COALESCE a secas no entra nunca. La
  // ejecucion entera paso sin guardar una sola garantia y sin dar ningun error.
  console.log("\nCOLUMNAS CON CERO POR DEFECTO");
  const conCero = (await c.query(`SELECT count(*) n FROM moveadvisor_marketplace_vo_offers
    WHERE portal='gamboa' AND is_active AND warranty_months = 0`)).rows[0].n;
  console.log("      warranty_months a cero en la base: " + conCero);
  comprueba("warranty_months usa NULLIF, no COALESCE a secas",
    /warranty_months = COALESCE\(NULLIF\(warranty_months, 0\)/.test(uno));
  comprueba("year, mileage, doors y seats tambien",
    ["year", "mileage", "doors", "seats"].every((col) =>
      !new RegExp(col + " = COALESCE\\(" + col + ",").test(uno)));

  // ── contra la base ────────────────────────────────────────────────────────
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  await c.query("BEGIN");
  try {
    for (const s of sqls) await c.query(s);
    // La prueba de fuego: que la garantia de Gamboa quede escrita de verdad,
    // pisando el cero que habia.
    const g = (await c.query(`SELECT count(*) n FROM moveadvisor_marketplace_vo_offers
      WHERE portal='gamboa' AND enrich_tried_at > NOW() - INTERVAL '1 minute'
        AND warranty_months > 0`)).rows[0].n;
    comprueba("la garantia de Gamboa se escribe encima del cero", Number(g) > 0,
      "(" + g + " coches)");
    const r = (await c.query(`SELECT
        count(*) FILTER (WHERE color IS NOT NULL AND color <> '') con_color,
        count(*) FILTER (WHERE image_urls IS NOT NULL) con_fotos,
        count(*) FILTER (WHERE equipment IS NOT NULL) con_equipo,
        count(*) FILTER (WHERE warranty_months IS NOT NULL) con_garantia,
        count(*) FILTER (WHERE brand_warranty_months IS NOT NULL) con_gar_marca,
        count(*) FILTER (WHERE body_type IS NOT NULL) con_carroceria
      FROM moveadvisor_marketplace_vo_offers WHERE portal='gamboa' AND enrich_tried_at > NOW() - INTERVAL '1 minute'`)).rows[0];
    console.log("      color=" + r.con_color + "  fotos=" + r.con_fotos + "  equipamiento=" + r.con_equipo
      + "  garantia=" + r.con_garantia + "  gar.marca=" + r.con_gar_marca + "  carroceria=" + r.con_carroceria);
    comprueba("el SQL entra y llena las columnas nuevas",
      Number(r.con_color) > 0 && Number(r.con_fotos) > 0 && Number(r.con_equipo) > 0
      && Number(r.con_garantia) > 0 && Number(r.con_carroceria) > 0);
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
