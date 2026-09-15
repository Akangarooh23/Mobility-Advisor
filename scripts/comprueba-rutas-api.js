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

/** Una constante de ruta sin la base delante: `= "/api/…"`. */
const CONSTANTE_SIN_BASE = /=\s*(?:"|')\/api\//;

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

const fallos = [];
let revisados = 0;

for (const fichero of recorre(DIRECTORIO)) {
  const rel = path.relative(RAIZ, fichero);
  if (rel === EL_QUE_PUEDE) continue;

  revisados += 1;
  const lineas = fs.readFileSync(fichero, "utf8").split("\n");

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

    if (CONSTANTE_SIN_BASE.test(linea)) {
      fallos.push(
        `${rel}:${i + 1} define una ruta de API sin API_BASE delante\n` +
        `      ${linea.trim()}`
      );
    }
  });
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
