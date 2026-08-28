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
 * El correo y el identificador de quien pide, o correo vacío si no se sabe.
 *
 * Quien llama decide qué hacer sin correo; lo normal es contestar 401.
 */
async function identidadDeLaPeticion(req, { cuerpo = {} } = {}) {
  let sesion = null;
  try {
    sesion = await authHandler.getSessionUserFromRequest?.(req);
  } catch {
    // Sin sesión legible se sigue: el resultado será no saber quién es, y quien
    // llama contestará 401. Un fallo al leerla no puede parecer una sesión.
    sesion = null;
  }

  const correoDeSesion = nt(sesion?.user?.email).toLowerCase();
  const correoPedido   = nt(req?.query?.email || cuerpo?.email).toLowerCase();

  return {
    userId: nt(sesion?.user?.id),
    email: correoDeSesion || (exigeSesion() ? "" : correoPedido),
    conSesion: Boolean(correoDeSesion),
  };
}

module.exports = { identidadDeLaPeticion, exigeSesion };
