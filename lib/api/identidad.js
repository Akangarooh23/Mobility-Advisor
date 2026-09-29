/**
 * De quién es esta petición.
 *
 * La regla es una y vive aquí: **manda la sesión, nunca lo que venga en la
 * URL**. Un correo en la barra de direcciones lo escribe cualquiera; la cookie
 * de sesión es `HttpOnly`, va firmada y se comprueba contra la tabla de
 * sesiones.
 *
 * Fuera de producción se admite el correo de la petición, porque si no no se
 * puede probar un endpoint con curl sin montar antes una sesión. Esa puerta se
 * cierra sola en cuanto hay `NODE_ENV=production` o se está en Vercel, y se
 * puede forzar en cualquier sentido con `AUTH_BILLING_REQUIRE_SESSION`.
 *
 * Estaba escrito así dentro del manejador de la cuenta, y solo ahí. El de la
 * factura en PDF se conformaba con el número y el correo, y los números no
 * siempre son impredecibles —hay `SUBS-2026-0001`—, de modo que con el correo
 * de alguien se le podía sacar una factura con su nombre, su teléfono, su NIF y
 * su dirección. Con la regla en un sitio, eso no vuelve a depender de que quien
 * escriba el siguiente endpoint se acuerde.
 */
const authHandler = require("../../api/auth");

function nt(v) {
  return String(v ?? "").trim();
}

/** ¿Hay que exigir sesión aquí? En producción y en Vercel, sí. */
function exigeSesion(entorno = process.env) {
  const porDefecto = entorno.NODE_ENV === "production" || Boolean(entorno.VERCEL);
  return nt(entorno.AUTH_BILLING_REQUIRE_SESSION || (porDefecto ? "true" : "false")).toLowerCase() !== "false";
}

/**
 * Y la de las rutas que mueven dinero, que es más estricta.
 *
 * La diferencia está solo en lo que pasa **fuera** de producción: ahí la regla
 * general afloja para poder probar con curl, y ésta no. Se puede apagar con
 * `AUTH_BILLING_REQUIRE_SESSION=false`, pero hay que escribirlo a mano; no se
 * cae sola por estar en un portátil.
 *
 * Estaba escrita tres veces —dos en el checkout y una en el portal— con esta
 * misma línea copiada. Tenerla aquí es lo que hace que la diferencia sea una
 * decisión con nombre y no un descuido entre ficheros.
 */
function exigeSesionParaPagar(entorno = process.env) {
  return nt(entorno.AUTH_BILLING_REQUIRE_SESSION || "true").toLowerCase() !== "false";
}

/** La sesión, o nada. Un fallo al leerla nunca puede parecer una sesión. */
async function laSesion(req) {
  try {
    return await authHandler.getSessionUserFromRequest?.(req);
  } catch {
    // Sin sesión legible se sigue: el resultado será no saber quién es, y quien
    // llama contestará 401.
    return null;
  }
}

/**
 * El correo y el identificador de quien pide, o correo vacío si no se sabe.
 *
 * Quien llama decide qué hacer sin correo; lo normal es contestar 401.
 */
async function identidadDeLaPeticion(req, { cuerpo = {} } = {}) {
  const sesion = await laSesion(req);

  const correoDeSesion = nt(sesion?.user?.email).toLowerCase();
  const correoPedido   = nt(req?.query?.email || cuerpo?.email).toLowerCase();

  return {
    userId: nt(sesion?.user?.id),
    email: correoDeSesion || (exigeSesion() ? "" : correoPedido),
    conSesion: Boolean(correoDeSesion),
    usuario: sesion?.user || null,
  };
}

/**
 * Lo mismo, para pagar.
 *
 * Dos diferencias con la de arriba, y las dos son de las rutas de dinero:
 *
 *   · exige sesión también fuera de producción;
 *   · y el correo de reserva del cuerpo se llama `customerEmail`, que es como
 *     lo manda la pantalla de pago desde siempre.
 */
async function identidadDeQuienPaga(req, { cuerpo = {} } = {}) {
  const sesion = await laSesion(req);

  const correoDeSesion = nt(sesion?.user?.email).toLowerCase();
  const correoPedido   = nt(cuerpo?.customerEmail).toLowerCase();

  return {
    userId: nt(sesion?.user?.id),
    email: correoDeSesion || (exigeSesionParaPagar() ? "" : correoPedido),
    conSesion: Boolean(correoDeSesion),
    /*
     * El usuario entero, para quien necesite más que el correo. Lo usa la
     * tasación para saber si a esta persona le queda la gratuita, y mirar eso
     * por el objeto del usuario en vez de por su correo es lo que hace que
     * cambiar de correo no regale otra.
     */
    usuario: sesion?.user || null,
  };
}

module.exports = {
  identidadDeLaPeticion,
  identidadDeQuienPaga,
  exigeSesion,
  exigeSesionParaPagar,
};
