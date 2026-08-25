/**
 * Comprueba el invariante del buscador de ofertas (Comprar › Buscar coche):
 * el numero que ensena cada marca en el desplegable tiene que ser exactamente
 * el numero de ofertas que salen al filtrar por ella.
 *
 * Se separan con facilidad, y siempre en silencio. Ha pasado tres veces:
 *   - agrupando el desplegable por `brand` exacto y filtrando por `lower(brand)`,
 *     de modo que «Peugeot», «PEUGEOT» y «peugeot» contaban por separado pero
 *     filtraban juntas;
 *   - recortando el nombre al agrupar y no al filtrar, con las marcas que
 *     llegaban con un espacio al final;
 *   - agrupando por tildes y guiones sin ampliar el filtro a esas grafias, que
 *     habria dejado «Citroën» fuera de las 30.471 de Citroen.
 * En los tres casos la pantalla prometia un numero y daba otro. Este script lo
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

  // Ninguna marca puede salir arriba y otra vez abajo en «Mas marcas».
  const arriba = new Set(marcas.map((m) => m.nombre.toLowerCase()));
  const repetidas = respuesta.sinOfertas.filter((m) => arriba.has(m.nombre.toLowerCase()));
  if (repetidas.length) {
    console.log("SALEN DOS VECES: " + repetidas.map((m) => m.nombre).join(", "));
  }

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

  // Lo mismo un nivel mas abajo. Los modelos se parten mas que las marcas
  // —«Leon» y «León», o el C-HR de Toyota de cinco maneras—, asi que el
  // invariante importa igual. Se miran las marcas mas grandes, que son las que
  // acumulan las variantes.
  const MARCAS_MUESTRA = ["Seat", "Volkswagen", "Toyota", "Renault", "Citroen", "Mercedes-Benz"];
  const fallosModelo = [];
  for (const marca of MARCAS_MUESTRA) {
    const facetas = await llamar("facets=models&brand=" + encodeURIComponent(marca));
    if (!facetas.ok || !facetas.conOfertas.length) {
      fallosModelo.push("«" + marca + "» no devuelve modelos");
      continue;
    }
    const top = [...facetas.conOfertas].sort((a, b) => b.n - a.n).slice(0, 6);
    for (let i = 0; i < top.length; i += 6) {
      const lote = top.slice(i, i + 6);
      const res = await Promise.all(
        lote.map((m) =>
          llamar("brand=" + encodeURIComponent(marca) + "&model=" + encodeURIComponent(m.nombre) + "&limit=1")
        )
      );
      lote.forEach((m, j) => {
        if (res[j].total !== m.n) {
          fallosModelo.push("«" + marca + " " + m.nombre + "» dice " + m.n + " y da " + res[j].total);
        }
      });
    }
  }
  console.log("modelos comprobados en: " + MARCAS_MUESTRA.join(", "));

  if (fallos.length === 0 && repetidas.length === 0 && fallosModelo.length === 0) {
    console.log("todas cuadran: el recuento es el numero de ofertas que salen");
    process.exit(0);
  }

  console.log("NO cuadran " + (fallos.length + fallosModelo.length) + ":");
  fallos.forEach((f) => console.log("   marca:  " + f));
  fallosModelo.forEach((f) => console.log("   modelo: " + f));
  process.exit(1);
})();
