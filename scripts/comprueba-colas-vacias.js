/**
 * Que ningún workflow se caiga cuando su cola viene vacía.
 *
 *   npm run test:colas-vacias
 *
 * ── Qué pasó ───────────────────────────────────────────────────────────────
 *
 * La madrugada del 2026-09-07 fallaron las cuatro ejecuciones programadas de
 * los dos workflows de Gamboa, todas con el mismo error:
 *
 *   Nodo: HTTP: Ficha de Gamboa
 *   Error: URL parameter must be a string, got undefined
 *
 * Y el motivo era el caso NORMAL, no una avería: el día anterior se había
 * verificado y enriquecido el catálogo entero, así que con los filtros de 20
 * horas y 30 días no quedaba nada elegible. La cola devolvía cero filas.
 *
 * Lo que no me esperaba —y es la lección— es que **una consulta sin filas no
 * llega como "nada"**: n8n manda UN ITEM VACÍO. Ese item recorre el bucle igual
 * que una oferta, llega al nodo HTTP sin url y lo revienta.
 *
 * O sea que el workflow no fallaba por tener trabajo mal hecho, sino por NO
 * tener trabajo. Cuanto mejor funciona el ciclo, más veces se encuentra la cola
 * vacía y más fallaba. Wallapop iba camino de lo mismo: su cola no se vaciaba
 * nunca con 6 pasadas al día, y al subirlo a 12 la mitad se la iban a encontrar
 * sin nada.
 *
 * ── Qué se comprueba ───────────────────────────────────────────────────────
 *
 * Dos formas de protegerlo, según cómo esté montado cada workflow:
 *
 *   - Los que tienen un nodo Code antes de pedir: ese nodo marca `saltar` y el
 *     IF que ya existía lo devuelve al bucle sin pedir nada.
 *   - Los que van del bucle directos al HTTP: se les pone un IF por medio.
 *
 * Esta prueba no toca la base ni pide nada a ningún portal: lee los JSON de los
 * workflows y ejecuta sus nodos Code con el item vacío que mandaría n8n.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

const leer = (wf) => JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", wf + ".json"), "utf8"));

/** Ejecuta un nodo Code con el contrato mínimo que le daría n8n. */
function corre(js, item) {
  const estatico = {};
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console", js);
  const r = f(() => ({ item: { json: {} } }), { first: () => ({ json: item }) },
    () => estatico, { id: "run-1" }, { log: () => {} });
  return r[0].json;
}

// ── Los que deciden en un nodo Code ────────────────────────────────────────
const CON_GUARDA = [
  { wf: "gamboa-verificar-activas",      nodo: "Code: ¿toca pedirla?", campo: "source_url" },
  { wf: "milanuncios-verificar-activas", nodo: "Code: ¿toca pedirla?", campo: "url" },
];

console.log("CON LA COLA VACÍA, n8n manda un item vacío\n");
for (const { wf, nodo, campo } of CON_GUARDA) {
  const js = leer(wf).nodes.find((n) => n.name === nodo).parameters.jsCode;
  comprueba(wf + ": el item vacío se salta", corre(js, {}).saltar === true);
  comprueba(wf + ": una fila sin url también", corre(js, { id: "x" }).saltar === true);
  const bueno = { id: "x" }; bueno[campo] = "https://ejemplo.com/coche-1234";
  comprueba(wf + ": una oferta de verdad NO se salta", corre(js, bueno).saltar === false);
}

// ── El barrido: NINGÚN workflow puede ir del bucle al HTTP sin filtro ──────
//
// Se escanean todos, no una lista escrita a mano, para que el día que se añada
// un workflow nuevo con el mismo patrón esta prueba lo cace sola. Cuando se
// buscó, había DIEZ además de los dos que ya habían fallado.
console.log("\nNINGÚN WORKFLOW VA DEL BUCLE AL HTTP SIN FILTRO POR MEDIO\n");
const dir = path.join(RAIZ, "n8n-workflows");
const enRiesgo = [];
let revisados = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const w = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const porNombre = {}; (w.nodes || []).forEach((n) => { porNombre[n.name] = n; });
  const conex = w.connections || {};

  // Solo interesan los que sacan su trabajo de una consulta: son los únicos
  // que pueden encontrarse la cola vacía.
  const deConsulta = (w.nodes || []).some((n) => n.type.endsWith("postgres")
    && /select/i.test(String((n.parameters || {}).query || "")));
  if (!deConsulta) continue;

  for (const bucle of (w.nodes || []).filter((n) => n.type.endsWith("splitInBatches"))) {
    for (const l of (((conex[bucle.name] || {}).main || [])[1] || [])) {
      let actual = l.node, pasos = 0, filtrado = false, http = null;
      while (actual && pasos++ < 6) {
        const n = porNombre[actual];
        if (!n) break;
        // Un IF o un Code por medio pueden descartar el item vacío.
        if (n.type.endsWith(".if") || n.type.endsWith("code")) filtrado = true;
        if (n.type.endsWith("httpRequest")) { http = n; break; }
        const sig = ((conex[actual] || {}).main || [])[0] || [];
        actual = sig.length ? sig[0].node : null;
      }
      if (!http) continue;
      revisados++;
      if (/\$json/.test(String(http.parameters.url || "")) && !filtrado) {
        enRiesgo.push(f.replace(".json", "") + " (" + bucle.name + " -> " + http.name + ")");
      }
    }
  }
}
console.log("      " + revisados + " caminos bucle->HTTP revisados en los workflows del repo");
comprueba("ninguno pide con una url que puede venir vacía", enRiesgo.length === 0,
  enRiesgo.length ? "\n         " + enRiesgo.join("\n         ") : "");

console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
process.exit(fallos === 0 ? 0 : 1);
