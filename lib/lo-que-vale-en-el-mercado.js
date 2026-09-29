"use strict";

/**
 * Cuánto está cada oferta por debajo de lo que se pide por ese coche.
 *
 * ## Para qué
 *
 * El consejero enseñaba las ofertas ordenadas por **lo más reciente**, que no
 * dice nada de si son buenas. Lo que hace falta es lo contrario: de todo lo que
 * encaja con lo que ha pedido, las que están mejor de precio.
 *
 * «Mejor de precio» no es «más barata». Un Golf de 12.000 € puede ser caro y
 * uno de 22.000 barato: depende del año y de los kilómetros. Así que se compara
 * cada oferta **contra lo que se pide por su mismo coche**, y se ordena por la
 * diferencia.
 *
 * Eso permite decirle «está 1.850 € por debajo de lo que se pide de media por
 * ese coche», que es una frase comprobable y que ningún portal le da.
 *
 * ## Por qué no se usa el motor de la tasación
 *
 * Porque hace otra cosa. Para tasar **un** coche se traen entre 400 y 1.500
 * comparables y se corre una regresión sobre kilómetros y año: eso es lo que
 * hace falta para poner un precio a un coche concreto, y tarda lo suyo. Aquí
 * hay que situar **doce** ofertas en su mercado, y con la mediana de su mismo
 * modelo y año sobra.
 *
 * ## La regla que manda: sin comparables no se dice nada
 *
 * Con menos de ocho coches parecidos no hay mercado del que hablar, y una
 * mediana de tres es una casualidad con aspecto de dato. Esas ofertas se
 * enseñan igual —no se esconde nada— pero sin la frase y detrás de las que sí
 * tienen con qué compararse.
 */

/** Cuántos coches parecidos hacen falta para que la mediana signifique algo. */
const COMPARABLES_MINIMOS = 8;

/** Y cuánto se estira el año a los lados para juntarlos. */
const ANOS_A_LOS_LADOS = 1;

/**
 * El ancho del tramo de kilómetros con el que se compara.
 *
 * Sin esto la mediana ignora los kilómetros, y entonces un coche con muchos
 * parece un chollo solo por ser más barato que la mediana de su año. Pasó en
 * la primera medición: un Golf de 2022 con 91.000 km salía «3.743 € por
 * debajo» cuando lo que pasaba es que tiene el doble de kilómetros que el Golf
 * de 2022 normal.
 *
 * Veinticinco mil porque es ancho de verdad —no deja tramos con cuatro coches—
 * y a la vez separa lo que hay que separar: 20.000 km y 120.000 km no son el
 * mismo coche aunque sean del mismo año.
 */
const TRAMO_DE_KM = 25000;

/**
 * Y el ancho del tramo de potencia, que es como se separan los acabados.
 *
 * ## Por qué hace falta
 *
 * Sin esto, un **BMW M3 y un 320d son el mismo coche**: mismo modelo, mismo
 * año, mismo tramo de kilómetros. Medido sobre el pool, con los Serie 3 de
 * 2020-2022 y 25.000-50.000 km:
 *
 *     todos juntos          33.000 EUR   155 coches
 *     de 150 a 199 CV       28.950 EUR    68
 *     de 500 a 549 CV       82.999 EUR    31   ← el M3
 *
 * Así que a un M3 de 82.999 € se le decía que estaba **50.000 € por encima del
 * mercado**, y a un 320d normal que era un chollo. Lo mismo con el Golf —19.990
 * el 1.0 TSI contra 37.000 el GTI o el R— y con el León contra el Cupra.
 *
 * ## Por qué la potencia y no la versión
 *
 * Porque la versión es texto libre y hay miles de escrituras distintas. La
 * potencia está rellena en el 95% de las ofertas, es un número, y separa
 * exactamente lo que hay que separar: lo que distingue a un GTI de un Golf
 * normal es que tiene el doble de caballos.
 *
 * ## Y por qué cincuenta
 *
 * Porque separa las gamas sin dejar tramos vacíos: con cincuenta, los modelos
 * medidos tienen entre 9 y 348 coches por tramo. Más fino dejaría tramos de
 * tres coches, y con tres no se habla de mercado.
 */
const TRAMO_DE_CV = 50;

const texto = (v) => String(v ?? "").trim().toLowerCase();
const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * La mediana de cada oferta, en una sola consulta.
 *
 * Una por oferta serían doce viajes a la base. Aquí se piden de golpe todas las
 * combinaciones de marca, modelo y año que hay entre las candidatas —que suelen
 * ser cinco o seis distintas— y después se reparten.
 */
async function laMedianaDeCada(pool, ofertas) {
  /*
   * Indexado por la propia oferta, no por su `id`.
   *
   * La primera version usaba `o.id` y las doce ofertas acabaron con la misma
   * mediana: el `id` no siempre viene, y todas colisionaban en la misma
   * entrada del mapa. Un Golf de 2019 con «6.564 coches comparables» es la
   * cifra que lo delató. Con el objeto como clave eso no puede pasar.
   */
  const medianas = new Map();
  if (!pool || !Array.isArray(ofertas) || !ofertas.length) return medianas;

  /* Las parejas marca+modelo distintas que hay entre las candidatas. */
  const parejas = new Map();
  for (const o of ofertas) {
    const marca = texto(o?.brand);
    const modelo = texto(o?.model);
    const anio = numero(o?.year);
    if (!marca || !modelo || !anio) continue;
    parejas.set(`${marca}|${modelo}`, [marca, modelo]);
  }
  if (!parejas.size) return medianas;

  const anios = ofertas.map((o) => numero(o?.year)).filter(Boolean);
  const desde = Math.min(...anios) - ANOS_A_LOS_LADOS;
  const hasta = Math.max(...anios) + ANOS_A_LOS_LADOS;

  /*
   * Las parejas van como parejas, no como dos listas.
   *
   * La primera version preguntaba `marca = ANY(...) AND modelo = ANY(...)`, y
   * eso cruza todo con todo: contaba como comparables de un Golf los Peugeot
   * 208 y los Mercedes Clase A que hubiera en las otras ofertas. De ahí
   * salían los 6.564.
   */
  const valores = [];
  const huecos = [...parejas.values()].map(([marca, modelo]) => {
    valores.push(marca, modelo);
    return `($${valores.length - 1}, $${valores.length})`;
  });
  valores.push(desde, hasta);

  const { rows } = await pool.query(
    `SELECT lower(brand) AS marca, lower(model) AS modelo, "year" AS anio,
            (mileage / ${TRAMO_DE_KM})::int AS tramo,
            CASE WHEN power_cv > 0 THEN (power_cv / ${TRAMO_DE_CV})::int END AS cv,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY price)::int AS mediana,
            count(*)::int AS n
       FROM moveadvisor_market_offers
      WHERE is_active AND country = 'ES'
        AND price BETWEEN 500 AND 200000
        AND (lower(brand), lower(model)) IN (${huecos.join(", ")})
        AND "year" BETWEEN $${valores.length - 1} AND $${valores.length}
        AND mileage IS NOT NULL
      GROUP BY 1, 2, 3, 4, 5`,
    valores
  );

  /*
   * Los tres años juntos, no solo el suyo.
   *
   * Un modelo de un año concreto puede tener cuatro anuncios en toda España, y
   * con cuatro no se habla de mercado. Sumando el anterior y el siguiente sale
   * una mediana con la que sí se puede comparar, y un año arriba o abajo mueve
   * el precio mucho menos que lo que gana en fiabilidad.
   */
  /*
   * Guardadas por tramo de potencia, y también sin él.
   *
   * Con potencia es como se compara un GTI con otros GTI. Sin ella hace falta
   * el saco de siempre —todo el modelo junto— porque el 5% de las ofertas no
   * dice los caballos y esas también merecen su comparación.
   */
  const porClave = new Map();
  const suma = (mapa, clave, f) => {
    const antes = mapa.get(clave) || { total: 0, n: 0 };
    mapa.set(clave, { total: antes.total + Number(f.mediana) * Number(f.n), n: antes.n + Number(f.n) });
  };

  for (const f of rows) {
    const base = `${f.marca}|${f.modelo}|${f.anio}|${f.tramo}`;
    if (f.cv !== null && f.cv !== undefined) suma(porClave, `${base}|${f.cv}`, f);
    suma(porClave, base, f);
  }

  for (const [clave, x] of porClave) {
    porClave.set(clave, { mediana: Math.round(x.total / x.n), n: x.n });
  }

  for (const o of ofertas) {
    const marca = texto(o?.brand);
    const modelo = texto(o?.model);
    const anio = numero(o?.year);
    const precio = numero(o?.price);
    const kms = numero(o?.mileage);
    if (!marca || !modelo || !anio || !precio || kms === null) continue;

    const tramo = Math.floor(kms / TRAMO_DE_KM);

    /*
     * Contra los de su misma potencia, si se sabe cuál es.
     *
     * Es lo que separa un GTI de un Golf normal. Si el anuncio no dice los
     * caballos —el 5%— se compara contra todo el modelo, que es lo que se
     * hacía antes: peor comparación, pero mejor que ninguna.
     */
    const cv = numero(o?.powerCv ?? o?.power_cv);
    const suPotencia = cv && cv > 0 ? `|${Math.floor(cv / TRAMO_DE_CV)}` : "";

    const cerca = [];
    for (let a = anio - ANOS_A_LOS_LADOS; a <= anio + ANOS_A_LOS_LADOS; a += 1) {
      const trozo = porClave.get(`${marca}|${modelo}|${a}|${tramo}${suPotencia}`);
      if (trozo) cerca.push(trozo);
    }
    if (!cerca.length) continue;

    const comparables = cerca.reduce((acc, x) => acc + x.n, 0);
    if (comparables < COMPARABLES_MINIMOS) continue;

    // La media de las medianas de cada año, pesada por cuántos coches hay.
    const suma = cerca.reduce((acc, x) => acc + x.mediana * x.n, 0);
    const mediana = Math.round(suma / comparables);

    medianas.set(o, { mediana, comparables, ahorro: Math.round(mediana - precio) });
  }

  return medianas;
}

/**
 * Las ordena por lo que se ahorra, de mayor a menor.
 *
 * Las que no tienen con qué compararse van al final **en el orden en que
 * venían**: no se esconden —puede ser justo el coche que buscaba— pero no se
 * pueden poner por delante de una que sí sabemos que está bien de precio.
 */
function ordenaPorCalidadPrecio(ofertas, medianas) {
  if (!Array.isArray(ofertas) || !medianas || !medianas.size) return ofertas || [];

  const conDato = [];
  const sinDato = [];
  for (const o of ofertas) {
    if (medianas.has(o)) conDato.push(o);
    else sinDato.push(o);
  }

  conDato.sort((a, b) => (medianas.get(b).ahorro - medianas.get(a).ahorro));
  return [...conDato, ...sinDato];
}

module.exports = {
  laMedianaDeCada,
  ordenaPorCalidadPrecio,
  COMPARABLES_MINIMOS,
  ANOS_A_LOS_LADOS,
  TRAMO_DE_KM,
  TRAMO_DE_CV,
};
