/**
 * Construye lib/los-municipios.json desde el callejero oficial del INE.
 *
 *   npm run genera-municipios
 *
 * No hace falta lanzarlo casi nunca: el INE publica la relación una vez al año,
 * a 1 de enero. Se relanza cuando salga la nueva y punto.
 *
 * ── Por qué un fichero generado y no una lista a mano ──────────────────────
 *
 * lib/las-provincias.js tenía ~170 formas escritas a mano y cubrían el 95,6 %
 * de las ofertas. El 4,4 % que faltaba eran 2.708 formas distintas para 29.877
 * filas, y ninguna llegaba a 300 anuncios: 2.455 de ellas tenían menos de
 * treinta. Escribirlas a mano era inviable, y al día siguiente aparecía otro
 * pueblo.
 *
 * Los 8.132 municipios de España caben en una tabla. Lo que no cabe es la lista
 * de excepciones que hace falta para no tenerla.
 *
 * ── Qué se guarda, y qué se tira ───────────────────────────────────────────
 *
 * Solo nombre -> provincia, y SOLO cuando ese nombre existe en una provincia.
 * Hay 20 nombres repartidos entre dos provincias -«Sancti-Spíritus» está en
 * Badajoz y en Salamanca, «Mieres» en Girona y en Asturias, «Arroyomolinos» en
 * Cáceres y en Madrid- y esos NO entran: con el nombre a secas no se puede
 * saber cuál es, y elegir uno sería inventarse dónde está un coche.
 *
 * Los que sí importan por volumen se resuelven a mano en FORMAS, que se mira
 * antes que esto. «Arroyomolinos» son 129 anuncios y todos de Madrid.
 *
 * ── Las variantes que se generan ───────────────────────────────────────────
 *
 * El INE trae los nombres oficiales, y los oficiales llevan dentro dos formas
 * que los portales escriben de otra manera:
 *
 *   «Agurain/Salvatierra»  -> se añaden las dos mitades por separado
 *   «Coruña, A»            -> se añade «A Coruña»
 *   «Vila-real»            -> se añade «Vila real», que es como lo escriben
 *
 * Son reglas sobre el dato oficial, no excepciones nuestras.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { plano, PROVINCIAS } = require("../lib/las-provincias");

const RAIZ = path.join(__dirname, "..");
const SALIDA = path.join(RAIZ, "lib", "los-municipios.json");
const FUENTE = "https://www.ine.es/daco/daco42/codmun/diccionario25.xlsx";

/*
 * CPRO -> provincia. Los dos primeros dígitos de un código postal español son
 * este mismo número, así que esta tabla sirve para las dos cosas.
 *
 * El orden es el oficial del INE, alfabético por los nombres tradicionales, y
 * por eso La Coruña va en el 15 y no donde iría «A Coruña».
 */
const POR_CODIGO = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Ávila",
  "06": "Badajoz", "07": "Baleares", "08": "Barcelona", "09": "Burgos", "10": "Cáceres",
  "11": "Cádiz", "12": "Castellón", "13": "Ciudad Real", "14": "Córdoba", "15": "La Coruña",
  "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa",
  "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida",
  "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia",
  "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas",
  "36": "Pontevedra", "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria",
  "40": "Segovia", "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel",
  "45": "Toledo", "46": "Valencia", "47": "Valladolid", "48": "Bizkaia", "49": "Zamora",
  "50": "Zaragoza", "51": "Ceuta", "52": "Melilla",
};

async function baja(destino) {
  if (fs.existsSync(destino)) {
    console.log("  ya estaba bajado: " + destino);
    return;
  }
  console.log("  bajando del INE: " + FUENTE);
  const r = await fetch(FUENTE, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error("el INE respondió " + r.status);
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  console.log("  " + fs.statSync(destino).size.toLocaleString("es") + " bytes");
}

(async () => {
  const xls = path.join(require("os").tmpdir(), "ine-municipios.xlsx");
  await baja(xls);

  const hoja = XLSX.readFile(xls);
  const filas = XLSX.utils.sheet_to_json(hoja.Sheets[hoja.SheetNames[0]],
    { header: 1, raw: false }).slice(2);   // dos líneas de cabecera
  console.log("\n  municipios leídos: " + filas.length.toLocaleString("es"));
  if (filas.length < 8000) throw new Error("vienen muy pocos: el fichero no es el que espero");

  /* nombre aplanado -> las provincias que lo usan. Más de una = ambiguo. */
  const mapa = new Map();
  const anade = (nombre, prov) => {
    const k = plano(nombre);
    if (!k) return;
    if (!mapa.has(k)) mapa.set(k, new Set());
    mapa.get(k).add(prov);
  };

  const cuantos = {};
  for (const [, cpro, , , nombre] of filas) {
    const prov = POR_CODIGO[cpro];
    if (!prov) throw new Error("código de provincia desconocido: " + cpro + " (" + nombre + ")");
    cuantos[prov] = (cuantos[prov] || 0) + 1;
    anade(nombre, prov);
    if (String(nombre).indexOf("/") !== -1) {
      for (const mitad of String(nombre).split("/")) anade(mitad, prov);
    }
    const coma = String(nombre).indexOf(",");
    if (coma !== -1) anade(String(nombre).slice(coma + 1) + " " + String(nombre).slice(0, coma), prov);
    // «Vila-real» lo mandan como «Vila Real»; el guion oficial no lo escribe nadie.
    if (String(nombre).indexOf("-") !== -1) anade(String(nombre).replace(/-/g, " "), prov);
  }

  const faltan = PROVINCIAS.filter((p) => !cuantos[p]);
  if (faltan.length) throw new Error("provincias sin ni un municipio: " + faltan.join(", "));

  const unicos = [...mapa].filter(([, s]) => s.size === 1);
  const ambiguos = [...mapa].filter(([, s]) => s.size > 1);
  console.log("  nombres distintos       : " + mapa.size.toLocaleString("es"));
  console.log("  apuntan a una provincia : " + unicos.length.toLocaleString("es"));
  console.log("  ambiguos, se descartan  : " + ambiguos.length);
  for (const [k, s] of ambiguos) console.log("      " + k.padEnd(30) + [...s].join(" / "));

  const salida = {};
  for (const [k, s] of unicos.sort((a, b) => (a[0] < b[0] ? -1 : 1))) salida[k] = [...s][0];
  fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 0) + "\n");
  console.log("\n  escrito " + SALIDA);
  console.log("  " + fs.statSync(SALIDA).size.toLocaleString("es") + " bytes\n");
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
