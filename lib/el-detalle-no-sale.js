"use strict";

/**
 * El detalle de un error no sale al navegador en producción.
 *
 * ## Lo que pasaba
 *
 * Sesenta y dos respuestas de `lib/` y `api/` metían el mensaje del error en el cuerpo:
 *
 *     return res.status(500).json({ ok: false, error: e.message });
 *
 * Y eso llega al navegador. No es teórico: el 1 de octubre, recorriendo el camino de
 * compra con la aplicación en marcha, una petición que cualquiera puede hacer devolvía
 *
 *     GET /api/search-offers?brand=Audi
 *     500  {"ok":false,"error":"operator does not exist: text = integer"}
 *
 * Medido contra la base que corre, un error de Postgres lleva dentro **nombres de
 * columna y de tabla**:
 *
 *     column "columna_inventada" does not exist      (42703)
 *     relation "tabla_que_no_existe" does not exist  (42P01)
 *
 * ## Lo que NO es, porque conviene no exagerarlo
 *
 * No es una fuga de datos. El valor que provocó el fallo va en `.detail`, no en
 * `.message` —comprobado con una violación de unicidad en una tabla temporal— y aquí
 * nadie devuelve `.detail` de Postgres. Es revelación del esquema, y lo que de verdad
 * se nota es otra cosa: **un 500 con jerga de Postgres es lo que lee un cliente** en vez
 * de «no hemos podido buscar, inténtalo otra vez».
 *
 * ## Por qué un ayudante y no un mensaje fijo en cada sitio
 *
 * Porque las 62 respuestas **no tienen la misma forma**. Unas llevan `ok: false`, otras
 * `offer: null`, otras `sections: []`, y el navegador lee esos campos. Cambiar la
 * respuesta entera por `{ error: "algo" }` arreglaría la fuga y rompería la pantalla.
 *
 * Así que esto sustituye **solo el mensaje** y deja la forma intacta:
 *
 *     - return res.status(500).json({ ok: false, error: e.message });
 *     + return res.status(500).json({ ok: false, error: elDetalle(e, "visit-availability") });
 *
 * ## Lo que hace, en orden
 *
 *  1. Apunta el error con `registra()`, que es donde tiene que estar: con su sitio, su
 *     pila y su contexto. En producción eso va a `moveadvisor_errores` y el aviso
 *     horario lo cuenta. Antes el mensaje viajaba al navegador y **no se guardaba en
 *     ninguna parte**, así que se perdía en cuanto el cliente cerraba la pestaña.
 *  2. Devuelve un texto para la persona: genérico en producción, y el mensaje de verdad
 *     fuera de ella, porque quien mira la pantalla en desarrollo es quien lo arregla.
 *
 * Es el mismo reparto que `falloInterno()` del ERP, que ya usan 116 de sus rutas.
 */

const { registra } = require("./registra");

/** Producción es Vercel o un `NODE_ENV` que lo diga. Igual que en `api/identidad.js`. */
function enProduccion(entorno = process.env) {
  return entorno.NODE_ENV === "production" || Boolean(entorno.VERCEL);
}

/** El texto de un error, sin reventar si lo que llega no es un `Error`. */
function elTexto(err) {
  if (err instanceof Error) return String(err.message || "");
  if (err && typeof err === "object" && "message" in err) return String(err.message || "");
  return String(err == null ? "" : err);
}

/**
 * Lo que se le puede decir a quien llama, y el error apuntado donde corresponde.
 *
 * @param {unknown} err       el error que se ha recogido
 * @param {string}  donde     el sitio, para poder buscarlo en el registro. Que diga
 *                            **qué** falló: «visit-availability: confirmar» sirve,
 *                            «error» no sirve para nada.
 * @param {Object}  [contexto] lo que ayude a reproducirlo, sin datos personales
 * @param {Object}  [entorno]  para las pruebas
 * @returns {string} un texto apto para enseñar
 */
function elDetalle(err, donde, contexto = {}, entorno = process.env) {
  // El registro primero: si el aviso falla, el cliente igual recibe su respuesta.
  try {
    const r = registra(donde, err, contexto);
    if (r && typeof r.catch === "function") r.catch(() => {});
  } catch {
    // `registra` no debe poder tumbar una respuesta. Si no puede apuntar, se sigue.
  }

  if (enProduccion(entorno)) return "No hemos podido completarlo. Vuelve a intentarlo en un momento.";

  const texto = elTexto(err);
  return texto || "No hemos podido completarlo. Vuelve a intentarlo en un momento.";
}

/**
 * Igual, pero para los campos que se llaman `detail` y acompañan a un código estable.
 *
 * Esos sitios ya hacen lo correcto a medias —`{ error: "db_error", detail: err.message }`:
 * el código es estable y el navegador lo puede tratar— y lo único que les falta es que
 * el detalle no salga en producción. Devolver `undefined` hace que `JSON.stringify` se
 * coma la clave, así que la respuesta queda igual que si nunca hubiera estado.
 */
function elDetalleSoloFuera(err, donde, contexto = {}, entorno = process.env) {
  try {
    const r = registra(donde, err, contexto);
    if (r && typeof r.catch === "function") r.catch(() => {});
  } catch { /* igual que arriba */ }

  return enProduccion(entorno) ? undefined : elTexto(err) || undefined;
}

/**
 * ¿Es un error de «lo que has pedido no puede existir» en vez de «algo se ha roto»?
 *
 * Postgres contesta `22P02` —`invalid_text_representation`— cuando un valor no se puede
 * ni convertir al tipo de la columna. El caso de verdad, encontrado ejecutando:
 *
 *     ?route=propuesta&bookingId=00000000-0000-0000-0000-000000000000  ->  404
 *     ?route=propuesta&bookingId=noesuuid                              ->  500
 *
 * La segunda reventaba en el cast, **dentro de Postgres**, antes de poder decir «no hay
 * ninguna fila». Y eso lo ve una persona: esas rutas son las que abre el enlace del
 * correo, así que un enlace cortado por el cliente de correo contestaba «vuelve a
 * intentarlo» por algo que no va a funcionar nunca.
 *
 * ## Por qué por el código de error y no por la forma del identificador
 *
 * Mi primer arreglo validaba que el `bookingId` tuviera forma de UUID antes de
 * consultar. **Puso rojas 71 pruebas**, y el rojo tenía razón: esa comprobación asume
 * que la columna es `uuid`, y en esta misma base `vehicle_visit_bookings.id` es `uuid`
 * pero **`vehicle_visit_requests.id` es `text`**. Una validación de forma en la capa
 * HTTP se queda mintiendo en cuanto una tabla cambia de tipo, y nadie se enteraría.
 *
 * El código de error no asume nada: lo dice Postgres, que es quien sabe de qué tipo es
 * cada columna.
 */
function noPuedeExistir(err) {
  return Boolean(err && typeof err === "object" && err.code === "22P02");
}

/**
 * Contesta por un error recogido: 404 si lo pedido no puede existir, 500 si no.
 *
 * El detalle nunca sale en producción y el error siempre queda apuntado, igual que en
 * `elDetalle`. Devuelve lo que devuelva `res.json`, para poder escribir
 * `return elFallo(res, e, "…")` y que el manejador corte ahí.
 */
function elFallo(res, err, donde, contexto = {}, entorno = process.env) {
  if (noPuedeExistir(err)) {
    // Se apunta igual: un identificador imposible que llega muchas veces es una pista.
    try {
      const r = registra(`${donde}: identificador imposible`, err, contexto);
      if (r && typeof r.catch === "function") r.catch(() => {});
    } catch {
      // No debe poder tumbar la respuesta.
    }
    return res.status(404).json({ ok: false, error: "No lo encontramos." });
  }
  return res.status(500).json({ ok: false, error: elDetalle(err, donde, contexto, entorno) });
}

module.exports = { elDetalle, elDetalleSoloFuera, elFallo, noPuedeExistir, enProduccion, elTexto };
