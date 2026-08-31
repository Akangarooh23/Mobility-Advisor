"use strict";

/**
 * Las garantías que se le pueden ofrecer a un coche.
 *
 * Hay una **base**, que va dentro del precio que se enseña, y otras por encima
 * o por debajo que el cliente elige. Lo que se le presenta no es una lista de
 * precios sueltos: es la base y **la diferencia** con cada alternativa. Sumar o
 * restar sobre un total que ya has visto se entiende; recalcularlo entero
 * delante, no.
 *
 * Con el catálogo vacío esto no hace nada y la oferta se ve como siempre. Es a
 * propósito: mientras no haya productos cargados, no hay nada que prometer.
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
 * Lo que se le ofrece a este coche, con la base marcada y las diferencias.
 *
 * La opción de quedarse sin garantía solo aparece si la base es renunciable. Si
 * la base es el mínimo legal, no se puede quitar aunque el cliente quiera, y
 * ofrecerlo sería ofrecer algo que no podemos cumplir.
 */
function opcionesParaElCoche(garantias, coche) {
  const puede = (garantias || []).filter((g) => seLePuedeOfrecer(g, coche));
  const base = puede.find((g) => g.es_base) || null;
  if (!base) return { base: null, opciones: [] };

  const precioBase = Number(base.precio) || 0;

  const opciones = puede
    .slice()
    .sort((a, b) => (Number(a.nivel) || 0) - (Number(b.nivel) || 0))
    .map((g) => ({
      id: g.id,
      nombre: g.nombre,
      meses: g.meses != null ? Number(g.meses) : null,
      kmCubiertos: g.km_cubiertos != null ? Number(g.km_cubiertos) : null,
      esBase: Boolean(g.es_base),
      // Lo que le cambia el total si elige ésta. Cero en la base.
      diferencia: Math.round((Number(g.precio) || 0) - precioBase),
      coberturas: g.coberturas || [],
    }));

  // Y la de no coger ninguna, si se puede renunciar.
  if (base.renunciable) {
    opciones.push({
      id: null,
      nombre: "Sin garantía",
      meses: null,
      kmCubiertos: null,
      esBase: false,
      diferencia: -precioBase,
      coberturas: [],
    });
  }

  return {
    base: {
      id: base.id,
      nombre: base.nombre,
      meses: base.meses != null ? Number(base.meses) : null,
      precio: precioBase,
      renunciable: Boolean(base.renunciable),
      coberturas: base.coberturas || [],
    },
    opciones,
  };
}

/**
 * Lo que se le cobra por la garantía que ha elegido.
 *
 * Si elige una que no se le puede ofrecer, se cae a la base en vez de aceptarla:
 * el precio no puede depender de lo que llegue en una petición.
 */
function precioDeLaElegida(garantias, coche, elegidaId) {
  const { base, opciones } = opcionesParaElCoche(garantias, coche);
  if (!base) return { id: null, precio: 0 };

  if (elegidaId === null) {
    return base.renunciable ? { id: null, precio: 0 } : { id: base.id, precio: base.precio };
  }

  const elegida = opciones.find((o) => o.id && o.id === elegidaId);
  if (!elegida) return { id: base.id, precio: base.precio };
  return { id: elegida.id, precio: base.precio + elegida.diferencia };
}

/**
 * El catálogo de garantías, leído una vez por petición.
 *
 * Son un puñado de filas y se aplican a todos los coches de la lista, así que
 * se leen enteras y se filtran aquí. Una consulta por oferta serían doscientas
 * para pintar una página.
 *
 * Si la tabla no existe todavía —o está vacía—, se devuelve nada y la oferta se
 * ve como siempre. Mientras no haya productos cargados no hay nada que ofrecer.
 */
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
