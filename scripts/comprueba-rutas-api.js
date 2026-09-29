/**
 * Que ninguna pantalla vuelva a llamar a la API con la ruta escrita a pelo.
 *
 * ## Qué vigila
 *
 * `fetch("/api/...")` funciona perfectamente mientras la web se sirva del mismo
 * sitio que la API, y por eso se colaron treinta y tres repartidas por
 * dieciséis ficheros sin que nada fallara. Fuera del navegador no funcionan:
 * dentro de un APK, `/api/leads` resuelve contra `https://localhost` y no hay
 * nada ahí. El fallo es silencioso y solo aparece en el dispositivo.
 *
 * La regla es que toda llamada pase por `rutaApi()` o por una de las constantes
 * `*_API_ENDPOINT` de `src/utils/apiClient.js`, que son las que llevan
 * `API_BASE` delante. En el navegador `API_BASE` es cadena vacía, así que el
 * string resultante es idéntico al de antes y la web no nota nada.
 *
 * ## Por qué una prueba y no una nota en el CLAUDE.md
 *
 * Porque la nota no falla. Esto se arregló una vez entero; sin algo que lo
 * vigile, la siguiente pantalla que alguien escriba vuelve a poner la ruta a
 * mano —es lo natural— y nadie se entera hasta que la app está compilada.
 *
 * No necesita red ni base de datos: lee los ficheros.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const DIRECTORIO = path.join(RAIZ, "src");

/**
 * El único fichero donde la ruta se escribe entera, porque es el que define
 * `API_BASE` y las constantes.
 */
const EL_QUE_PUEDE = path.join("src", "utils", "apiClient.js");

/** Una llamada con la ruta escrita a pelo: `fetch("/api/…")`. */
const A_PELO = /fetch\(\s*(?:"|'|`)\/api\//;

/**
 * Una ruta guardada en una variable: `X = … "/api/…"`.
 *
 * Captura el nombre, porque por sí solo el literal no dice nada: lo que
 * importa es si alguien lo mete en un `fetch` tal cual o lo pasa antes por
 * `rutaApi()`.
 *
 * El `[^;\n]*?` del medio es para los de reserva -`apiBase || "/api/…"`-, que
 * es justo la forma que se le escapaba a la regla anterior.
 */
const GUARDA_RUTA = /([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*?)(?:"|'|`)\/api\//g;

/**
 * ¿Se usa ese nombre dentro de un `fetch(...)`?
 *
 * No se analiza el código de verdad: se mira un trozo detrás de cada `fetch(`,
 * que es suficiente para `fetch(API, …)` y para `` fetch(`${API}?x=1`) ``, que
 * son las dos formas que hay en el repositorio.
 */
function llegaAUnFetch(fuente, nombre) {
  const suyo = new RegExp(`\\b${nombre}\\b`);
  let desde = 0;
  for (;;) {
    const i = fuente.indexOf("fetch(", desde);
    if (i < 0) return false;
    if (suyo.test(fuente.slice(i, i + 200))) return true;
    desde = i + 6;
  }
}

function recorre(directorio, encontrados = []) {
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    const completa = path.join(directorio, entrada.name);

    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules") continue;
      recorre(completa, encontrados);
      continue;
    }

    if (!entrada.name.endsWith(".js")) continue;
    // Una prueba puede escribir la ruta que le dé la gana: no se despliega.
    if (entrada.name.endsWith(".test.js")) continue;

    encontrados.push(completa);
  }

  return encontrados;
}

/**
 * Lo que se le reprocha a un fichero, si algo.
 *
 * Está aparte para poder probarlo con fuentes de mentira en
 * `lib/rutas-api-vigilan-lo-que-deben.test.js`. Una prueba que decide si el
 * resto compila tiene que estar probada ella misma: la versión anterior de
 * esta regla se equivocaba en las dos direcciones y nadie se enteró hasta que
 * la bloqueó.
 *
 * @param {string} fuente  el fichero entero
 * @param {string} rel     su ruta, solo para el mensaje
 * @returns {string[]}     los reproches, vacío si no hay
 */
function revisaFuente(fuente, rel = "(fuente)") {
  const fallos = [];
  const lineas = fuente.split("\n");

  lineas.forEach((linea, i) => {
    // Un comentario que enseñe la ruta es documentación, no una llamada.
    if (/^\s*(\/\/|\*|\/\*)/.test(linea)) return;

    if (A_PELO.test(linea)) {
      fallos.push(
        `${rel}:${i + 1} llama a la API con la ruta escrita a pelo\n` +
        `      ${linea.trim()}\n` +
        `      usa rutaApi("/api/..."), que es lo mismo en el navegador y lo` +
        ` único que funciona fuera de él`
      );
    }

    /*
     * Una ruta guardada en una variable solo es un problema si acaba en un
     * `fetch` sin pasar por `rutaApi()`.
     *
     * Antes esto se miraba línea a línea: cualquier `= "/api/…"` fallaba.
     * Eso se equivocaba en las dos direcciones a la vez, y las dos están
     * comprobadas en `comprueba-rutas-api.test.js`:
     *
     *   · daba por mala `ruta = "/api/mandato-firmado"` en
     *     LoQueTeFaltaDelEncargo, que se pasa por `rutaApi(ruta)` al usarla y
     *     por tanto está bien;
     *   · y dejaba pasar `const API = apiBase || "/api/visit-availability"`
     *     en AvailabilityEditor, que iba a cuatro `fetch` sin base y rompía
     *     las franjas de visita dentro del APK — que es exactamente lo que
     *     esta prueba existe para impedir.
     *
     * Una prueba que grita donde no hay nada y calla donde sí lo hay acaba
     * desactivada, y con razón.
     */
    GUARDA_RUTA.lastIndex = 0;
    let encaje;
    while ((encaje = GUARDA_RUTA.exec(linea)) !== null) {
      const [, nombre, entremedias] = encaje;

      // Ya se envuelve aquí mismo.
      if (entremedias.includes("rutaApi(")) continue;
      // O se envuelve donde se usa.
      if (new RegExp(`rutaApi\\(\\s*${nombre}\\b`).test(fuente)) continue;
      // Y si nunca llega a un fetch, no es una URL y no es asunto de esto.
      if (!llegaAUnFetch(fuente, nombre)) continue;

      fallos.push(
        `${rel}:${i + 1} guarda una ruta de API sin base y la usa en un fetch\n` +
        `      ${linea.trim()}\n` +
        `      envuélvela: rutaApi("/api/..."). Fuera del navegador, sin base` +
        ` no resuelve a ningún sitio`
      );
    }
  });

  return fallos;
}

module.exports = { revisaFuente };

// Lo de abajo es la herramienta de línea de órdenes. Al requerir este fichero
// desde una prueba no se ejecuta: solo se coge `revisaFuente`.
if (require.main !== module) {
  return;
}

const fallos = [];
let revisados = 0;

for (const fichero of recorre(DIRECTORIO)) {
  const rel = path.relative(RAIZ, fichero);
  if (rel === EL_QUE_PUEDE) continue;

  revisados += 1;
  fallos.push(...revisaFuente(fs.readFileSync(fichero, "utf8"), rel));
}

/**
 * Y que el propio `apiClient.js` no se olvide de la base en sus constantes,
 * que es justo lo que pasó con las tres de `user-saved`, `user-alerts` y
 * `user-preferences`.
 */
const cliente = fs.readFileSync(path.join(RAIZ, EL_QUE_PUEDE), "utf8");
cliente.split("\n").forEach((linea, i) => {
  if (/^\s*(\/\/|\*|\/\*)/.test(linea)) return;
  if (/export const \w*API_ENDPOINT\s*=/.test(linea) && !linea.includes("API_BASE")) {
    fallos.push(
      `${EL_QUE_PUEDE}:${i + 1} constante de ruta sin API_BASE\n` +
      `      ${linea.trim()}`
    );
  }
});

if (fallos.length) {
  console.error("[rutas-api] FALLA — hay llamadas que no funcionarán fuera del navegador:\n");
  fallos.forEach((f) => console.error("  " + f + "\n"));
  process.exit(1);
}

console.log(
  `[rutas-api] OK: ${revisados} ficheros de src/ revisados, ninguna llamada con la ruta ` +
  `escrita a pelo y todas las constantes de apiClient.js llevan API_BASE delante.`,
);
