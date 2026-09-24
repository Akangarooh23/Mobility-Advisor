"use strict";

/**
 * Qué modelos hay de verdad para este cliente.
 *
 * ## El problema que resuelve
 *
 * Los cinco modelos que el consejero propone salían de una **tabla escrita a
 * mano** que solo miraba el combustible. Contestando el test entero —compacto,
 * marca generalista europea, 15.000-20.000 €, Valencia— proponía un Toyota
 * C-HR, un Kia Niro, un Hyundai Kona y un Nissan Qashqai: cuatro SUV japoneses
 * y coreanos. Contradecía dos respuestas seguidas.
 *
 * Y no es solo que quede mal. Esos nombres son con lo que sale a buscar el
 * motor, así que una lista que contradice al cliente se convierte en una
 * búsqueda que no encuentra nada suyo.
 *
 * ## Lo que hace
 *
 * Pregunta a la base qué marcas y modelos tienen coches **que cumplen lo que
 * ha pedido**, y devuelve los que más stock tienen. Así la lista no puede
 * contradecirle: sale de las mismas condiciones con las que luego se buscan
 * las ofertas.
 *
 * ## Por qué se ordena por cuántos hay
 *
 * Porque un modelo del que hay cuarenta en su provincia y su presupuesto es un
 * modelo que va a poder ver, comparar y negociar, y del que habrá recambios y
 * compradores cuando lo venda. Uno del que hay dos es una recomendación que no
 * puede seguir.
 *
 * El precio no entra aquí: ya se juzga después, comparando cada oferta con la
 * mediana de su mismo modelo, año y tramo de kilómetros.
 */

const { condicionesDelConsejero } = require("./lo-que-busca-el-consejero");
const { losQueHay } = require("./los-valores-que-existen");

/** Menos de esto no es un modelo que se pueda recomendar, es una casualidad. */
const LOS_MINIMOS = 3;

/**
 * Lo que se le espera a la base antes de seguir sin lista.
 *
 * Con un perfil de SUV premium aleman en Madrid la consulta tarda 44 segundos
 * -tardaba 104 antes de mirar solo las mas recientes- y el analisis entero
 * tiene que caber en el tiempo de su funcion. Esto es una mejora de la
 * recomendacion, no un requisito para darla: pasado el tope, se sigue sin ella.
 *
 * El tope va holgado sobre los 44 medidos a proposito: quedarse corto por dos
 * segundos devuelve la lista vacia, y entonces vuelven los modelos de la tabla
 * escrita a mano, que es justo lo que se estaba quitando.
 */
const LO_QUE_SE_ESPERA_MS = 70000;

/** Cuantas ofertas se miran para saber que modelos son comunes. */
const LA_VENTANA = 20000;

const texto = (v) => String(v ?? "").trim();

/** Un nombre presentable: «volkswagen golf» no, «Volkswagen Golf» sí. */
function comoSeEscribe(v) {
  return texto(v)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => (p.length <= 2 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
    .join(" ");
}

/**
 * Los modelos con stock que cumplen los criterios, de más a menos.
 *
 * Devuelve `[]` si no hay base, si falla o si no hay nada: quien llama se
 * queda con lo que tuviera. Esto mejora la recomendación, no puede tumbarla.
 */
async function losModelosQueHay(pool, criterios = {}, cuantos = 5) {
  if (!pool) return [];

  /*
   * Con los valores que de verdad hay en cada columna, que es lo que permite
   * comparar con `=` en vez de con `LIKE '%compact%'`.
   *
   * Medido: sin esto la consulta tarda 97 segundos, porque un `LIKE` con
   * comodín delante no puede usar ningún índice. Es la misma lección que ya
   * costó 118 segundos en la búsqueda de ofertas; aquí volvía a pasar por no
   * pasarle la lista.
   *
   * Desde cero: los parámetros de los criterios son los primeros de la
   * consulta, y detrás van el mínimo y el límite.
   */
  const enLaBase = await losQueHay(pool);
  const { condiciones, valores } = condicionesDelConsejero(criterios, 0, enLaBase);
  if (!condiciones.length) return [];

  /*
   * `is_active` va aparte porque no es un criterio del cliente, es que un
   * anuncio retirado no es una oferta.
   */
  const donde = ["COALESCE(is_active, TRUE) = TRUE", ...condiciones].join(" AND ");

  /*
   * Tres si los hay, y si no, los que haya.
   *
   * Tres unidades del mismo modelo es lo que hace que una recomendación se
   * pueda seguir: puedes verlos, compararlos y negociar. Pero con un perfil
   * estrecho —compacto, automático, de profesional, siete marcas concretas, en
   * una provincia— no llega a tres ni uno, y exigirlo devolvía la lista vacía y
   * se volvía a la tabla escrita a mano, que es lo que veníamos a quitar.
   *
   * Un modelo del que hay uno sigue siendo mejor recomendación que uno que no
   * existe.
   */
  const preguntar = (minimo) => pedirLosModelos(pool, donde, valores, minimo, cuantos);
  const conTres = await preguntar(LOS_MINIMOS);
  return conTres.length ? conTres : preguntar(1);
}

/**
 * Lo mismo, pero sin poder llevarse por delante el análisis.
 *
 * Con un perfil de SUV premium alemán en Madrid la consulta tardó 104
 * segundos, y el análisis entero tiene que caber en el tiempo de su función.
 * Esto mejora la recomendación; si tarda más de la cuenta, la recomendación se
 * hace sin ella y ya está.
 */
async function losModelosQueHaySinPasarse(pool, criterios = {}, cuantos = 5, tope = LO_QUE_SE_ESPERA_MS) {
  let reloj = null;
  const seAcaboElTiempo = new Promise((resolver) => {
    reloj = setTimeout(() => {
      console.warn("[los-modelos-que-hay] se ha pasado de " + tope + " ms, se sigue sin lista");
      resolver([]);
    }, tope);
  });

  try {
    return await Promise.race([losModelosQueHay(pool, criterios, cuantos), seAcaboElTiempo]);
  } finally {
    clearTimeout(reloj);
  }
}

/** La consulta, para poder repetirla con otro mínimo. */
async function pedirLosModelos(pool, donde, valores, minimo, cuantos) {
  try {
    /*
     * Sobre una ventana, no sobre todo lo que cumpla.
     *
     * Agrupar el conjunto entero tardaba 104 segundos con un perfil de SUV
     * premium alemán, y el análisis no tiene ese tiempo. Con las veinte mil
     * más recientes basta y sobra para saber qué modelos son comunes en ese
     * perfil: lo que se busca aquí es el nombre del coche, no un censo.
     *
     * Lo que se pierde, dicho claro: si un modelo solo tiene anuncios viejos
     * puede quedarse fuera del recuento. Para recomendar un coche que se pueda
     * encontrar hoy, eso es más una ventaja que una pérdida.
     */
    const { rows } = await pool.query(
      `SELECT marca, modelo, count(*)::int AS cuantos, min(price)::int AS desde
         FROM (
           SELECT lower(brand) AS marca, lower(model) AS modelo, price
             FROM moveadvisor_market_offers
            WHERE ${donde}
              AND COALESCE(brand, '') <> ''
              AND COALESCE(model, '') <> ''
            ORDER BY updated_at DESC NULLS LAST
            LIMIT ${LA_VENTANA}
         ) recientes
        GROUP BY 1, 2
       HAVING count(*) >= $${valores.length + 1}
        ORDER BY count(*) DESC
        LIMIT $${valores.length + 2}`,
      [...valores, minimo, Math.max(1, cuantos)]
    );

    return rows.map((r) => ({
      marca: comoSeEscribe(r.marca),
      modelo: comoSeEscribe(r.modelo),
      cuantos: r.cuantos,
      desde: r.desde,
    }));
  } catch (err) {
    console.warn("[los-modelos-que-hay] no se han podido leer:", err && err.message);
    return [];
  }
}

/**
 * Cómo se le cuentan al modelo de lenguaje.
 *
 * Con cuántos hay y desde qué precio, porque son datos verdaderos que puede
 * usar en su explicación sin inventarse nada.
 */
function comoSeLosCuentas(modelos = []) {
  return modelos
    .map((m) => `- ${m.marca} ${m.modelo}: ${m.cuantos} en venta, desde ${m.desde} EUR`)
    .join("\n");
}

/** Si un modelo recomendado es uno de los que hay. */
function esDeLosQueHay(recomendado, modelos = []) {
  const suyo = (texto(recomendado?.marca) + " " + texto(recomendado?.modelo)).toLowerCase();
  if (!suyo.trim()) return false;

  return modelos.some((m) => {
    const marca = m.marca.toLowerCase();
    const modelo = m.modelo.toLowerCase();
    /*
     * El modelo puede venir con la version pegada -«Corolla Hybrid» contra
     * «corolla»- asi que basta con que la marca este y el modelo empiece
     * igual. Lo que no vale es cambiar de coche.
     */
    return suyo.includes(marca) && (suyo.includes(modelo) || modelo.includes(texto(recomendado?.modelo).toLowerCase()));
  });
}

module.exports = {
  losModelosQueHay,
  losModelosQueHaySinPasarse,
  comoSeLosCuentas,
  esDeLosQueHay,
  LOS_MINIMOS,
  LO_QUE_SE_ESPERA_MS,
  comoSeEscribe,
};
