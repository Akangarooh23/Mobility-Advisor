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

  // Los tres tramos se comprueban juntos. Mirar solo `conOfertas` dejaria fuera
  // precisamente las principales, que son las marcas mas grandes.
  const principales = respuesta.principales || [];
  const otras = respuesta.conOfertas || [];
  const sinOfertas = respuesta.sinOfertas || [];
  const marcas = [...principales, ...otras].filter((m) => m.n > 0);
  console.log(
    "principales: " + principales.length +
    " · otras: " + otras.length +
    " · sin ofertas: " + sinOfertas.length +
    "   (se comprueban " + marcas.length + ")"
  );

  // Ninguna marca puede salir en dos tramos a la vez.
  const repetidas = [];
  const vistas = new Map();
  for (const [tramo, lista] of [["principales", principales], ["otras", otras], ["sin ofertas", sinOfertas]]) {
    for (const m of lista) {
      const k = m.nombre.toLowerCase();
      if (vistas.has(k)) repetidas.push("«" + m.nombre + "» en " + vistas.get(k) + " y en " + tramo);
      else vistas.set(k, tramo);
    }
  }
  if (repetidas.length) {
    console.log("SALEN DOS VECES:");
    repetidas.forEach((r) => console.log("   " + r));
  }

  const ordenada = (lista) =>
    lista.every((m, i) => i === 0 ||
      String(m.nombre).localeCompare(String(lista[i - 1].nombre), "es", { sensitivity: "base" }) >= 0);
  const desordenados = [["principales", principales], ["otras", otras], ["sin ofertas", sinOfertas]]
    .filter(([, l]) => !ordenada(l)).map(([n]) => n);
  if (desordenados.length) console.log("NO VAN DE LA A A LA Z: " + desordenados.join(", "));

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

  if (fallos.length === 0 && repetidas.length === 0 && fallosModelo.length === 0 && desordenados.length === 0) {
    console.log("todas cuadran: el recuento es el numero de ofertas que salen");
    process.exit(0);
  }

  console.log("NO cuadran " + (fallos.length + fallosModelo.length) + ":");
  fallos.forEach((f) => console.log("   marca:  " + f));
  fallosModelo.forEach((f) => console.log("   modelo: " + f));
  process.exit(1);
})();
