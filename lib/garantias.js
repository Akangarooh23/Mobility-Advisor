"use strict";

/**
 * Las garantias que se le pueden ofrecer a un coche.
 *
 * **No las damos nosotros.** PopCar no le vende el coche: se lo vende el
 * concesionario aleman, y es el quien debe la garantia legal europea. Lo que
 * ofrecemos es una garantia mecanica de un tercero, elegida para el tipo de
 * coche que se lleva, y algo que no cabe en una tabla de precios: **somos
 * nosotros quien reclama**.
 *
 * Eso es lo que de verdad se compra aqui. Un particular que compra en Alemania
 * y no va a comprar nunca mas no tiene ninguna capacidad de presion sobre un
 * concesionario de otro pais, en otro idioma y con otro derecho de consumo.
 * Nosotros traemos coches todas las semanas y hablamos con esa gente todas las
 * semanas.
 *
 * Ninguna es obligatoria, pero **el precio publicado lleva una puesta**: la mas
 * barata que se le pueda dar a ese coche. Antes habia una **base** dentro porque
 * el coche lo vendiamos nosotros y la garantia era forzosa; eso ya no existe, y
 * la de ahora se puede quitar. Se pone por defecto porque un precio que sube al
 * final se lee mucho peor que uno que baja: es el mismo dinero.
 *
 * Con el catalogo vacio esto no hace nada y la oferta se ve como siempre. Es a
 * proposito: mientras no haya productos cargados, no hay nada que prometer.
 */
/**
 * Si a este coche se le puede ofrecer esta garantía.
 *
 * Con una antigüedad media de doce años en el catálogo, muchas garantías no se
 * van a poder dar. Enseñar una opción que luego se cae es peor que no
 * enseñarla: el cliente ya ha contado con ella.
 */
function seLePuedeOfrecer(garantia, coche) {
  if (!garantia || garantia.activo === false) return false;

  const anios = aniosDelCoche(coche);
  const tope = garantia.antiguedad_max_anios;
  if (tope != null && anios != null && anios > Number(tope)) return false;

  const km = coche && coche.mileage != null ? Number(coche.mileage) : null;
  const topeKm = garantia.km_max_vehiculo;
  if (topeKm != null && km != null && km > Number(topeKm)) return false;

  return true;
}

function aniosDelCoche(coche) {
  const anio = coche && coche.year != null ? Number(coche.year) : null;
  if (!anio || Number.isNaN(anio)) return null;
  return new Date().getFullYear() - anio;
}

/**
 * Lo que se le ofrece a este coche, con una puesta por defecto.
 *
 * **El precio publicado ya la lleva dentro.** Un coche que se anuncia sin
 * garantia y luego ofrece una por 190 € parece que sube de precio al final; uno
 * que se anuncia con ella y deja quitarla, baja. Es el mismo dinero y se lee al
 * reves.
 *
 * La que va por defecto es la mas barata que se le pueda dar a ese coche. No
 * sale de una marca en la base sino del propio catalogo: si un dia se retira la
 * de doce meses, la de veinticuatro pasa a ser la de por defecto sola.
 *
 * Cada opcion lleva **su precio y su diferencia**: el precio para saber lo que
 * cuesta y la diferencia para saber lo que le cambia el total que esta mirando.
 * Quitarla sale en negativo, que es lo que de verdad pasa.
 */
function opcionesParaElCoche(garantias, coche) {
  const puede = (garantias || []).filter((g) => seLePuedeOfrecer(g, coche));
  if (!puede.length) return { base: null, porDefecto: null, opciones: [] };

  const ordenadas = puede
    .slice()
    .sort((a, b) => (Number(a.nivel) || 0) - (Number(b.nivel) || 0));
  const defecto = ordenadas[0];
  const precioDefecto = Math.round(Number(defecto.precio) || 0);

  const comoSeEnseña = (g) => ({
    id: g.id,
    nombre: g.nombre,
    meses: g.meses != null ? Number(g.meses) : null,
    kmCubiertos: g.km_max_vehiculo != null ? Number(g.km_cubiertos ?? g.km_max_vehiculo) : (g.km_cubiertos != null ? Number(g.km_cubiertos) : null),
    precio: Math.round(Number(g.precio) || 0),
    diferencia: Math.round((Number(g.precio) || 0) - precioDefecto),
    porDefecto: g.id === defecto.id,
    coberturas: g.coberturas || [],
  });

  const opciones = [
    // Quitarla es una opcion y va la primera, pero **no es la de por defecto**:
    // el precio de arriba lleva una puesta, asi que esta baja el total.
    {
      id: null,
      nombre: "Sin garantía",
      meses: null,
      kmCubiertos: null,
      precio: 0,
      diferencia: -precioDefecto,
      porDefecto: false,
      coberturas: [],
    },
    ...ordenadas.map(comoSeEnseña),
  ];

  // `base` se queda a null: no hay ninguna incluida por obligacion. Lo que hay
  // es una elegida por defecto, que es otra cosa y se puede quitar.
  return { base: null, porDefecto: comoSeEnseña(defecto), opciones };
}
/**
 * Lo que se le cobra por la garantia que ha elegido.
 *
 * Si elige una que no se le puede ofrecer —o no elige ninguna— sale a cero. El
 * precio no puede depender de lo que llegue en una peticion: el navegador dice
 * cual quiere, no cuanto cuesta.
 */
function precioDeLaElegida(garantias, coche, elegidaId) {
  const { porDefecto, opciones } = opcionesParaElCoche(garantias, coche);
  if (!porDefecto) return { id: null, precio: 0 };
  // Sin decir nada, la que lleva el precio publicado. Caer a cero aqui seria
  // cobrarle menos de lo que se le enseño.
  if (elegidaId === undefined) return { id: porDefecto.id, precio: porDefecto.precio };
  // Y `null` es haber dicho que no quiere ninguna, que si es cero.
  if (elegidaId === null) return { id: null, precio: 0 };
  const elegida = opciones.find((o) => o.id === elegidaId);
  if (!elegida) return { id: porDefecto.id, precio: porDefecto.precio };
  return { id: elegida.id, precio: elegida.precio };
}
/**
 * Lo que cuesta la garantia de por defecto, en SQL, coche a coche.
 *
 * El precio publicado la lleva dentro, asi que ordenar por precio y filtrar por
 * horquilla tienen que contarla. Y no es una cantidad fija: depende de la edad y
 * los kilometros de cada coche, porque a un coche de quince anios no se le puede
 * dar ninguna y su precio no sube nada.
 *
 * Es la misma regla que `seLePuedeOfrecer` escrita en SQL. Que esten en dos
 * sitios es feo, pero la alternativa —traerse las 25.000 filas y filtrar en
 * memoria para poder ordenarlas— lo es mas. `garantia-en-sql.test.js` las compara
 * fila a fila para que no se separen.
 *
 * En una sola linea: se pega dentro de un ORDER BY y de un WHERE.
 */
function sqlGarantiaPorDefecto(garantias, alias = "") {
  const c = alias ? `${alias}.` : "";
  const activas = (garantias || [])
    .filter((g) => g && g.activo !== false)
    .slice()
    .sort((a, b) => (Number(a.nivel) || 0) - (Number(b.nivel) || 0));
  if (!activas.length) return "0";

  // El anio de hoy va como numero y no como `EXTRACT(YEAR FROM CURRENT_DATE)`
  // para que la cuenta sea exactamente la misma que hace `aniosDelCoche`, que
  // usa la hora del servidor y no la de Postgres.
  const hoy = new Date().getFullYear();
  const ramas = activas.map((g) => {
    const cond = [];
    if (g.antiguedad_max_anios != null) {
      cond.push(`(${c}year IS NULL OR ${hoy} - ${c}year <= ${Number(g.antiguedad_max_anios)})`);
    }
    if (g.km_max_vehiculo != null) {
      cond.push(`(${c}mileage IS NULL OR ${c}mileage <= ${Number(g.km_max_vehiculo)})`);
    }
    const precio = Math.round(Number(g.precio) || 0);
    // Sin topes se le puede dar a cualquiera: TRUE, y ahi acaba el CASE.
    return `WHEN ${cond.length ? cond.join(" AND ") : "TRUE"} THEN ${precio}`;
  });

  // El ELSE 0 es el coche al que no se le puede dar ninguna: su precio no lleva
  // garantia dentro, y por eso no se le suma nada.
  return `(CASE ${ramas.join(" ")} ELSE 0 END)`;
}
async function catalogoDeGarantias(pool) {
  if (!pool) return [];
  try {
    const r = await pool.query(
      `SELECT g.id, g.nombre, g.nivel, g.es_base, g.renunciable, g.meses, g.km_cubiertos,
              g.precio::numeric AS precio, g.antiguedad_max_anios, g.km_max_vehiculo, g.activo,
              COALESCE(json_agg(json_build_object('texto', c.texto, 'incluida', c.incluida)
                       ORDER BY c.orden) FILTER (WHERE c.id IS NOT NULL), '[]') AS coberturas
         FROM market_garantias g
         LEFT JOIN market_garantia_coberturas c ON c.garantia_id = g.id
        WHERE g.activo
        GROUP BY g.id`,
      []
    );
    return r.rows;
  } catch {
    return [];
  }
}

module.exports = {
  seLePuedeOfrecer,
  opcionesParaElCoche,
  precioDeLaElegida,
  aniosDelCoche,
  catalogoDeGarantias,
  sqlGarantiaPorDefecto,
};
