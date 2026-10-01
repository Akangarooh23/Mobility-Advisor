/**
 * El filtro de atipicos protegia el precio y dejaba crudo todo lo demas.
 *
 * El informe de tasacion calcula el precio recomendado como la mediana de los
 * comparables tras quitar los atipicos con la valla de Tukey. Eso estaba bien.
 * Lo que estaba mal es que la valla se aplicaba solo a la **lista de precios**,
 * y las tablas de debajo seguian leyendo la lista entera de ofertas: el precio
 * medio por portal, los anuncios parecidos que se le ensenan al cliente, la
 * tendencia y la regresion de km y ano.
 *
 * Una mediana aguanta un anuncio absurdo; una media no. En la base hay ahora
 * mismo un Hyundai i20 de 2022 a 453.545 euros y un SEAT Leon de 2024 a
 * 247.990: uno solo de esos, en un portal con pocos anuncios, deja la tabla
 * diciendo cifras que no existen.
 *
 * Y el informe se contradecia solo: arriba «187 comparables validos, 3 atipicos
 * excluidos» y dos paginas despues la media de los 190.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { tukeyFence, aggregateByPortal } = require("./inventoryStore");

// ── La valla ────────────────────────────────────────────────────────────────

test("la valla deja fuera el precio absurdo y dentro los normales", () => {
  const precios = [11000, 11500, 12000, 12500, 13000, 247990].sort((a, b) => a - b);
  const { lo, hi } = tukeyFence(precios);
  assert.ok(247990 > hi, "el SEAT Leon a 247.990 tendria que caer fuera");
  for (const p of [11000, 11500, 12000, 12500, 13000]) {
    assert.ok(p >= lo && p <= hi, `${p} tendria que caer dentro`);
  }
});

test("con menos de cuatro precios la valla se abre, no inventa", () => {
  const { lo, hi } = tukeyFence([10000, 12000, 400000]);
  assert.equal(lo, -Infinity);
  assert.equal(hi, Infinity);
});

test("y si todos valen lo mismo tampoco hay valla que poner", () => {
  const { lo, hi } = tukeyFence([12000, 12000, 12000, 12000]);
  assert.equal(lo, -Infinity);
  assert.equal(hi, Infinity);
});

// ── Lo que se le ensena al cliente ──────────────────────────────────────────

const oferta = (portal, price) => ({ portal, price, listedAt: null, updatedAt: null });

test("un solo anuncio absurdo dobla la media de su portal", () => {
  const limpias = [
    oferta("autocasion", 11000),
    oferta("autocasion", 12000),
    oferta("autocasion", 13000),
  ];
  const conElRaro = [...limpias, oferta("autocasion", 247990)];

  const bien = aggregateByPortal(limpias, "venta")[0].avgPrice;
  const mal = aggregateByPortal(conElRaro, "venta")[0].avgPrice;

  assert.equal(bien, 12000);
  assert.ok(mal > 70000, `con el raro dentro la media sale ${mal}`);
  // No es un matiz: es la diferencia entre «12.000 €» y «70.998 €» en la misma
  // tabla, debajo de un precio recomendado que si estaba bien calculado.
});

// ── Que las tablas beban de la lista filtrada, y no de la cruda ─────────────

/**
 * Esto se comprueba sobre el codigo y no ejecutandolo porque la funcion que lo
 * arma, `getMarketPriceSnapshot`, va a la base de datos: para llamarla haria
 * falta un Postgres delante, y entonces la prueba dejaria de correr sola.
 *
 * Lo que se protege es el cableado: que nadie vuelva a pasarle a una tabla del
 * informe el pool sin filtrar. Es exactamente el fallo que hubo.
 */
test("las tablas del informe reciben las ofertas sanas, no el pool crudo", () => {
  const fuente = fs.readFileSync(path.join(__dirname, "inventoryStore.js"), "utf8");

  const debenBeberDeSanos = [
    { que: "la tabla de precio medio por portal", patron: /byPortal:\s*aggregateByPortal\(([A-Za-z]+),/ },
    // Sin el «no precedido de function», el patron casa con la declaracion de
    // la funcion —que empieza por `(offers,`— y no con la llamada de verdad.
    { que: "la regresion de km y ano", patron: /(?<!function )computeUsageImpact\(([A-Za-z]+),/ },
    { que: "la tendencia de precios", patron: /(?<!function )computePriceTrend\(([A-Za-z]+),/ },
    { que: "los anuncios parecidos que se ensenan", patron: /\?\s*\[\.\.\.([A-Za-z]+)\]\.sort/ },
  ];

  for (const { que, patron } of debenBeberDeSanos) {
    const m = fuente.match(patron);
    assert.ok(m, `no encuentro ${que} en inventoryStore.js: esta prueba ya no mira donde debe`);
    assert.equal(
      m[1],
      "sanos",
      `${que} lee «${m[1]}» en vez de «sanos»: vuelve a promediar los anuncios absurdos`
    );
  }
});

test("y el recuento de atipicos excluidos sigue saliendo del pool crudo", () => {
  const fuente = fs.readFileSync(path.join(__dirname, "inventoryStore.js"), "utf8");
  // Si esto tambien se filtrara, el informe diria siempre «0 atipicos
  // excluidos» y nadie se enteraria de que el filtro esta funcionando.
  assert.match(fuente, /rawComparables:\s*rawPrices\.length/);
  assert.match(fuente, /const rawPrices = computeOffers/);
});

/**
 * Las ofertas salen repartidas entre portales, no todas del que se rasco antes.
 *
 * ## Lo que pasaba
 *
 * El corte final era `ORDER BY updated_at DESC LIMIT 12`, y esa fecha no mide
 * que oferta es mejor: mide **cuando se rasco ese portal por ultima vez**. Como
 * cada scraper corre a su hora, el que acabara de pasar se llevaba los doce
 * huecos.
 *
 * Medido el 1 de octubre de 2026 con «Madrid, gasolina, hasta 10.000 EUR, hasta
 * 100.000 km», que tiene 3.892 ofertas que cumplen:
 *
 *     antes:  las 12, TODAS de canalcar, que tiene 17 en total
 *     ahora:  cochescom 2 · canalcar 2 · flexicar 2 · milanuncios 2 ·
 *             cochesnet 2 · autoscout24 1 · wallapop 1
 *
 * Y la ventana SI traia variedad: de sus 240 filas habia 92 de wallapop, 51 de
 * flexicar y 36 de milanuncios. Las traia y las tiraba en el ultimo paso.
 *
 * ## Por que el arreglo va en el corte y no en la ventana
 *
 * Porque ordenar 240 filas que ya estan en memoria no cuesta ninguna lectura
 * mas. Repartir la VENTANA por portal se probo y se paso de dos minutos: sin un
 * indice de `(portal, updated_at)` cada portal tiene que ordenar sus filas, y
 * wallapop tiene 532.107 activas.
 */
test("el consejero reparte las ofertas entre portales", () => {
  const fuente = fs.readFileSync(path.join(__dirname, "inventoryStore.js"), "utf8");

  // Numera las ofertas dentro de cada portal...
  assert.match(fuente, /PARTITION BY lower\(COALESCE\(portal,''\)\)/);
  // ...y ese numero manda en el orden final, antes que la fecha.
  assert.match(fuente, /ORDER BY _del_portal, updated_at DESC/);
});

test("y la tasacion no reparte, que necesita todos los comparables", () => {
  /*
   * La tasacion necesita TODOS los comparables del mismo modelo. Repartirlos
   * por portal le cambiaria la mediana, que es el numero que no se puede tocar.
   * Su rama es la de `if (!primeroCorta)`, y ahi no puede aparecer el reparto.
   */
  const fuente = fs.readFileSync(path.join(__dirname, "inventoryStore.js"), "utf8");
  const i = fuente.indexOf("if (!primeroCorta) {");
  assert.ok(i > 0, "ya no existe la rama de la tasacion");

  const suRama = fuente.slice(i, i + 260);
  assert.ok(!suRama.includes("_del_portal"), "la tasacion esta repartiendo por portal");
});

/**
 * Y lo que sale son coches, no motos.
 *
 * Salio al repartir: entre las doce aparecio un «SHERCO 300» de 7.200 EUR con
 * 656 km, que es una moto de trial. No era nuevo -llevaba en la base igual que
 * las demas-, pero antes no llegaba al corte porque Wallapop no entraba nunca.
 *
 * La columna `es_coche` no sirve todavia: esta rellena en el 17% del catalogo
 * -323.269 de 1.915.882 activas- y el propio Sherco la tiene a NULL. Exigir
 * `es_coche IS TRUE` tiraria cinco de cada seis ofertas buenas para quitar una
 * moto.
 */
test("las marcas que no hacen coches se quedan fuera", () => {
  const { condicionesDelConsejero, LAS_QUE_NO_HACEN_COCHES } = require("./lo-que-busca-el-consejero");

  assert.ok(LAS_QUE_NO_HACEN_COCHES.includes("sherco"));
  assert.ok(LAS_QUE_NO_HACEN_COCHES.includes("yamaha"));

  /*
   * Honda, BMW y Suzuki hacen motos Y coches. Meterlas aqui para quitar unas
   * pocas motos se llevaria por delante miles de coches buenos.
   */
  for (const marca of ["honda", "bmw", "suzuki"]) {
    assert.equal(LAS_QUE_NO_HACEN_COCHES.includes(marca), false, marca + " tambien hace coches");
  }

  const r = condicionesDelConsejero({ soloPresentables: true }, 1, null);
  const condicion = r.condiciones.find((c) => c.includes("<> ALL("));

  assert.ok(condicion, "no se aplica el filtro");
  assert.match(condicion, /'sherco'/);

  /*
   * Y la lista va escrita en el SQL, no como parametro: las condiciones de
   * «presentable» no llevan ninguno, porque no dependen de lo que pida nadie,
   * y hay otra prueba que lo fija. Son constantes del fichero, no entra nada
   * de fuera.
   */
  assert.deepEqual(r.valores, []);
});

test("y el filtro numera su parametro como los demas", () => {
  /*
   * Esta prueba existe por un fallo que cometi al escribirlo: puse el marcador
   * a mano, ignorando el desplazamiento con el que se llama a la funcion.
   * Colisionaba con otro parametro y daba SQL valido con resultados
   * equivocados, que no falla por ningun lado.
   */
  const { condicionesDelConsejero } = require("./lo-que-busca-el-consejero");
  const r = condicionesDelConsejero({ soloPresentables: true, maxPrice: 10000, maxMileage: 100000 }, 1, null);

  const usados = (r.condiciones.join(" ").match(/\$\d+/g) || []);
  assert.equal(new Set(usados).size, usados.length, "marcadores repetidos: " + usados.join(" "));
  assert.equal(usados.length, r.valores.length);
});
/**
 * La provincia escrita a mano no puede costar cincuenta segundos.
 *
 * ## Lo que pasaba
 *
 * Habia dos caminos para la provincia y uno era cincuenta veces mas lento. Con
 * `provinciaFormas` se comparaba con `=`, que usa el indice. Con la provincia
 * suelta en `location` -que es lo que manda el consejero- se comparaba con
 * `LIKE '%madrid%'`, y un comodin por delante impide usar cualquier indice.
 *
 * Medido el 1 de octubre de 2026 contra produccion, un diesel en Madrid por
 * debajo de 10.000 EUR:
 *
 *     Index Scan using ix_mmo_activas_recientes   (el de la FECHA)
 *     Rows Removed by Filter: 525.393
 *     Buffers: read=452.474 dirtied=392.085 written=358.028
 *     Execution Time: 52.198 ms
 *
 * Entraba por el indice de `updated_at` y descartaba medio millon de filas de
 * una en una hasta juntar 240, escribiendo 358.000 paginas a disco en CADA
 * busqueda.
 *
 * ## Por que importaba tanto
 *
 * Porque la peticion entera tardaba entre 70 y 181 segundos y el cliente veia
 * una pantalla SIN OFERTAS. No es que no las hubiera: es que el navegador se
 * cansaba antes de que llegaran. Dos intentos de arreglarlo buscaron el fallo
 * en los filtros, que estaban bien.
 *
 * Despues del cambio, el mismo perfil: 4,8 s y doce ofertas de siete portales.
 */
test("la provincia suelta se traduce y compara con =, no con LIKE", () => {
  const { condicionesDelConsejero } = require("./lo-que-busca-el-consejero");
  const enLaBase = new Map([["province", ["madrid", "barcelona", "valencia"]]]);

  const r = condicionesDelConsejero({ soloPresentables: true, location: "madrid" }, 1, enLaBase);
  const prov = r.condiciones.find((c) => c.includes("province"));

  assert.ok(prov, "no hay condicion de provincia");
  assert.match(prov, /= ANY\(/);
  assert.doesNotMatch(prov, /LIKE/);
});

test("y si no se reconoce el nombre, se cae al LIKE en vez de quedarse sin provincia", () => {
  /*
   * Quedarse sin filtro de provincia seria peor que ser lento: le saldrian
   * coches de la otra punta de Espana sin que nada se lo dijera.
   */
  const { condicionesDelConsejero } = require("./lo-que-busca-el-consejero");
  const r = condicionesDelConsejero({ soloPresentables: true, location: "trasmoz" }, 1, null);
  const prov = r.condiciones.find((c) => c.includes("province"));

  assert.ok(prov, "se ha quedado sin filtro de provincia");
  assert.match(prov, /LIKE/);
});
