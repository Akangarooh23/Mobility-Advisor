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
 * Ninguna va incluida en el precio. Antes habia una **base** dentro, porque el
 * coche lo vendiamos nosotros y la garantia era obligatoria; ese modelo ya no
 * existe. Ahora se empieza sin ninguna y el cliente añade la que quiera.
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
 * Lo que se le ofrece a este coche.
 *
 * Cada una con **su precio entero**, no con la diferencia respecto a otra.
 * Antes se enseñaban como diferencias porque habia una base ya incluida en el
 * precio y lo que se decidia era cuanto subir desde ahi. Ahora no hay nada
 * incluido: son productos sueltos y cada uno cuesta lo que cuesta.
 *
 * La primera opcion es siempre **no coger ninguna**, y no es un descarte: es lo
 * que pasa si no hace nada. Ponerla la primera dice la verdad de la situacion,
 * que es que la garantia es opcional.
 */
function opcionesParaElCoche(garantias, coche) {
  const puede = (garantias || []).filter((g) => seLePuedeOfrecer(g, coche));
  if (!puede.length) return { base: null, opciones: [] };

  const opciones = [
    {
      id: null,
      nombre: "Sin garantía",
      meses: null,
      kmCubiertos: null,
      precio: 0,
      coberturas: [],
    },
    ...puede
      .slice()
      .sort((a, b) => (Number(a.nivel) || 0) - (Number(b.nivel) || 0))
      .map((g) => ({
        id: g.id,
        nombre: g.nombre,
        meses: g.meses != null ? Number(g.meses) : null,
        kmCubiertos: g.km_cubiertos != null ? Number(g.km_cubiertos) : null,
        precio: Math.round(Number(g.precio) || 0),
        coberturas: g.coberturas || [],
      })),
  ];

  // `base` se queda a null a proposito: ya no hay ninguna incluida. Se devuelve
  // el campo para no romper a quien lo lea, pero nadie deberia usarlo.
  return { base: null, opciones };
}
/**
 * Lo que se le cobra por la garantia que ha elegido.
 *
 * Si elige una que no se le puede ofrecer —o no elige ninguna— sale a cero. El
 * precio no puede depender de lo que llegue en una peticion: el navegador dice
 * cual quiere, no cuanto cuesta.
 */
function precioDeLaElegida(garantias, coche, elegidaId) {
  const { opciones } = opcionesParaElCoche(garantias, coche);
  if (elegidaId === undefined || elegidaId === null) return { id: null, precio: 0 };
  const elegida = opciones.find((o) => o.id === elegidaId);
  if (!elegida) return { id: null, precio: 0 };
  return { id: elegida.id, precio: elegida.precio };
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
};
