/**
 * Comprueba el verificador de VIAN.
 *
 *   npm run test:vian-verificar
 *
 * Este workflow da de baja coches del ESCAPARATE. Una baja mal puesta retira del
 * sitio un coche que se puede vender; una que no se pone deja a un cliente
 * pidiendo cita por un coche que ya no existe.
 *
 * Lo que vigila:
 *
 *   - Que NO dé de baja si el barrido no llegó al final del listado. Con medio
 *     listado leído, una oferta que no aparece puede estar viva en la página que
 *     no llegamos a pedir.
 *   - Que una página fallida deje el barrido incompleto.
 *   - Que el cortacircuitos pare si el listado devuelve mucho menos catálogo del
 *     que dice tener: eso no es una liquidación, es que ha cambiado de forma.
 *   - Que sella por la clave primaria y no por una expresión regular sobre la
 *     URL —que fallaría el día que VIAN cambie sus rutas, como han hecho Gamboa
 *     y Modrive esta semana—.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "vian-verificar-activas.json"), "utf8"));
const codigo = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;
const cabs = wf.nodes.find((n) => n.type.endsWith("httpRequest")).parameters.headerParameters.parameters;
const H = {}; cabs.forEach((c) => { H[c.name] = c.value; });

function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "console", js);
  const r = f(ctx.$, ctx.$input, () => ctx.estatico, { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }] });

/** Una pasada entera: planifica y recorre las páginas con lo que devuelva `da`. */
function barrido(estatico, primera, da) {
  const plan = ejecuta(codigo("Code: Planificar barrido"), {
    estatico, $: () => uno({}), $input: uno(primera),
  });
  const sqls = [];
  for (const it of plan.items) {
    const r = ejecuta(codigo("Code: Sellar los vistos"), {
      estatico,
      $: (n) => (n === "Loop: página por página" ? { item: { json: it.json } } : uno({})),
      $input: uno(da(it.json)),
    });
    if (r.items[0] && r.items[0].json.sql) sqls.push(r.items[0].json.sql);
  }
  const ver = ejecuta(codigo("Code: Veredicto"), { estatico, $: () => uno({}), $input: uno({}) });
  const fre = ver.items.length
    ? ejecuta(codigo("Code: Cortacircuitos"), { estatico, $: () => uno({}), $input: uno(ver.items[0].json) })
    : { items: [], log: [] };
  return { plan, sqls, ver, freno: fre, log: [...plan.log, ...ver.log, ...fre.log] };
}

const pagina = (ids) => ({
  statusCode: 200,
  body: "<html>1000 vehículos" + ids.map((i) =>
    '<a href="/ficha-vehiculo-ocasion/coche-x/' + i + '">x</a>').join("") + "</html>",
});

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

(async () => {
  // ══ nunca da de baja con el barrido a medias ═════════════════════════════
  console.log("SI EL BARRIDO NO LLEGA AL FINAL");
  // Un listado que dice tener 1.000 coches pero cuyas páginas nunca se repiten:
  // se acaba el tope antes del final natural.
  let n = 0;
  const e1 = {};
  const r1 = barrido(e1, pagina(["100001"]), () => pagina([String(200000 + (n++))]));
  r1.log.filter((l) => /No se da de baja/.test(l)).forEach((l) => console.log("      " + l));
  comprueba("no da de baja a nadie", !/UPDATE moveadvisor_marketplace_vo_offers[\s\S]*is_active = FALSE/
    .test(r1.ver.items[0].json.sql || ""));
  comprueba("pero deja el parte", /INSERT INTO moveadvisor_verify_runs/.test(r1.ver.items[0].json.sql || ""));

  // ══ una página que falla ═════════════════════════════════════════════════
  console.log("\nSI UNA PÁGINA FALLA");
  const e2 = {};
  let k = 0;
  const r2 = barrido(e2, pagina(["910001", "910002", "910003"]), () =>
    (k++ === 1 ? { statusCode: 0, body: "" } : pagina([String(300000 + k)])));
  r2.log.filter((l) => /Barrido incompleto|No se da de baja/.test(l)).forEach((l) => console.log("      " + l));
  comprueba("marca el barrido como incompleto", e2.vian_fallo === true);
  comprueba("y no da de baja a nadie", !/is_active = FALSE/.test(r2.ver.items[0].json.sql || ""));

  // ══ el barrido bueno ═════════════════════════════════════════════════════
  console.log("\nUN BARRIDO COMPLETO");
  const e3 = {};
  const paginas = [["910011", "910012"], ["910013", "910014"], ["910013", "910014"]];
  let i3 = 0;
  const r3 = barrido(e3, pagina(paginas[0]), () => pagina(paginas[Math.min(i3++, paginas.length - 1)]));
  r3.log.filter((l) => /final del listado|barrido completo/.test(l)).forEach((l) => console.log("      " + l));
  // Sin esta comprobación, la prueba pasaba con ids de dos dígitos que la
  // expresión del workflow no reconoce: veía cero coches, concluía «no hay nada
  // nuevo» y daba el barrido por completo. Pasaba por el motivo equivocado.
  comprueba("ha visto coches de verdad", (e3.vian_vistos || 0) === 4, "(" + e3.vian_vistos + ")");
  comprueba("detecta el final cuando una página no aporta nada nuevo", e3.vian_completo === true);
  comprueba("ahora sí da de baja lo que no apareció",
    /is_active = FALSE/.test(r3.ver.items[0].json.sql || ""));
  comprueba("y resucita lo que reapareció", /is_active = TRUE/.test(r3.ver.items[0].json.sql || ""));
  comprueba("sella por la clave primaria, no por la url",
    r3.sqls.every((s) => /WHERE id IN \('vian_/.test(s)) && !r3.sqls.some((s) => /source_url ~/.test(s)));

  // ══ el cortacircuitos ════════════════════════════════════════════════════
  console.log("\nEL CORTACIRCUITOS");
  // El listado dice tener 1.000 pero solo aparecen 4: eso no es una liquidación.
  const e4 = {};
  const p4 = [["910021", "910022", "910023", "910024"], ["910021", "910022", "910023", "910024"]];
  let i4 = 0;
  const r4 = barrido(e4, pagina(p4[0]), () => pagina(p4[Math.min(i4++, 1)]));
  r4.freno.log.forEach((l) => console.log("      " + l));
  comprueba("para antes de aplicar nada", (r4.freno.items[0] || {}).json
    && r4.freno.items[0].json.parado === true);
  comprueba("y no deja SQL que ejecutar", !(r4.freno.items[0] || {}).json.sql);

  // ══ contra el listado de verdad ══════════════════════════════════════════
  console.log("\nCONTRA EL LISTADO DE VERDAD");
  const r = await fetch(wf.nodes.find((x) => x.name === "HTTP: Contar el catálogo").parameters.url,
    { headers: H, signal: AbortSignal.timeout(30000) });
  const body = await r.text();
  const e5 = {};
  const plan = ejecuta(codigo("Code: Planificar barrido"), {
    estatico: e5, $: () => uno({}), $input: uno({ statusCode: r.status, body: body }),
  });
  plan.log.forEach((l) => console.log("      " + l));
  comprueba("cuenta el catálogo del propio listado", (e5.vian_total || 0) > 300,
    "(" + e5.vian_total + " coches)");
  comprueba("planifica las páginas en consecuencia",
    plan.items.length >= 45 && plan.items.length <= 80, "(" + plan.items.length + ")");

  const pag = ejecuta(codigo("Code: Sellar los vistos"), {
    estatico: e5,
    $: (nn) => (nn === "Loop: página por página" ? { item: { json: plan.items[0].json } } : uno({})),
    $input: uno({ statusCode: 200, body: body }),
  });
  pag.log.forEach((l) => console.log("      " + l));
  comprueba("saca los coches de la página", (e5.vian_vistos || 0) >= 10, "(" + e5.vian_vistos + ")");

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  await c.query("BEGIN");
  try {
    const q = await c.query(pag.items[0].json.sql);
    comprueba("el sellado casa con ofertas nuestras", q.rowCount > 0, "(" + q.rowCount + " filas)");
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
