/**
 * Comprueba el invariante del buscador de ofertas (Comprar › Buscar coche):
 * el numero que ensena cada marca en el desplegable tiene que ser exactamente
 * el numero de ofertas que salen al filtrar por ella.
 *
 * Se separan con facilidad, y siempre en silencio. Ha pasado dos veces:
 *   - agrupando el desplegable por `brand` exacto y filtrando por `lower(brand)`,
 *     de modo que «Peugeot», «PEUGEOT» y «peugeot» contaban por separado pero
 *     filtraban juntas;
 *   - recortando el nombre al agrupar y no al filtrar, con las marcas que
 *     llegaban con un espacio al final.
 * En los dos casos la pantalla prometia un numero y daba otro. Este script lo
 * detecta: si no imprime «todas cuadran», hay un descuadre.
 *
 * Uso:  node scripts/check-brand-facet-counts.js
 */
require("dotenv").config({ path: ".env.local" });
const handler = require("../lib/api/search-offers-handler.js");

function llamar(consulta) {
  return new Promise((resolver) =>
    handler(
      { url: "/api/search-offers?" + consulta, method: "GET" },
      {
        status() { return this; },
        json(datos) { resolver(datos); return this; },
        setHeader() { return this; },
      }
    )
  );
}

(async () => {
  const respuesta = await llamar("facets=brands");
  if (!respuesta.ok) {
    console.error("no se pudo leer el desplegable: " + respuesta.error);
    process.exit(1);
  }

  const marcas = respuesta.conOfertas;
  console.log("marcas con ofertas: " + marcas.length);

  // De doce en doce: en serie tarda demasiado y de golpe agota el pool.
  const fallos = [];
  for (let i = 0; i < marcas.length; i += 12) {
    const lote = marcas.slice(i, i + 12);
    const resultados = await Promise.all(
      lote.map((m) => llamar("brand=" + encodeURIComponent(m.nombre) + "&limit=1"))
    );
    lote.forEach((m, j) => {
      if (resultados[j].total !== m.n) {
        fallos.push("«" + m.nombre + "» dice " + m.n + " y da " + resultados[j].total);
      }
    });
  }

  if (fallos.length === 0) {
    console.log("todas cuadran: el recuento es el numero de ofertas que salen");
    process.exit(0);
  }

  console.log("NO cuadran " + fallos.length + " de " + marcas.length + ":");
  fallos.forEach((f) => console.log("   " + f));
  process.exit(1);
})();
