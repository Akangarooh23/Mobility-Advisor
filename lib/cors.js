"use strict";

/**
 * CORS para los clientes que no viven en el dominio.
 *
 * ## Por qué hace falta
 *
 * La web se sirve desde el mismo origen que la API, así que sus peticiones no
 * pasan por CORS: el navegador ni pregunta. Una app nativa no tiene ese lujo —
 * su origen es `capacitor://localhost` o `https://localhost`, y sin estas
 * cabeceras el navegador embebido descarta la respuesta sin enseñar el error
 * en ningún sitio útil.
 *
 * ## Apagado por omisión, y a propósito
 *
 * Sin `CORS_ORIGENES` en el entorno, esto no añade ni una cabecera y el
 * servidor se comporta exactamente como antes. No hay lista de orígenes
 * escrita a mano aquí porque el día que se despliegue un segundo cliente nadie
 * va a acordarse de venir a tocar este fichero; la lista vive donde vive el
 * resto de la configuración.
 *
 * ## Por qué no vale el comodín
 *
 * Estas peticiones van con credenciales —la cookie o el token de sesión—, y el
 * navegador rechaza `Access-Control-Allow-Origin: *` en cuanto hay
 * credenciales de por medio. Hay que devolver el origen concreto, y por eso
 * hay una lista: devolver cualquier origen que pida es lo mismo que no tener
 * lista, y convierte cualquier página de internet en un cliente de la API del
 * usuario que la esté visitando.
 */

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Los orígenes permitidos, separados por comas.
 *
 * Para la app de Capacitor: `CORS_ORIGENES=capacitor://localhost,https://localhost`
 * (Android usa el segundo). Para un cliente web en otro dominio, su URL con
 * esquema y sin barra final.
 */
function origenesPermitidos() {
  return normalizeText(process.env.CORS_ORIGENES)
    .split(",")
    .map((item) => normalizeText(item).toLowerCase().replace(/\/$/, ""))
    .filter(Boolean);
}

/**
 * Pone las cabeceras de CORS si el origen está en la lista, y contesta al
 * preflight.
 *
 * Devuelve `true` cuando ya ha respondido —era un `OPTIONS`— y quien llama
 * debe terminar ahí sin hacer nada más.
 */
function aplicaCors(req, res) {
  const origen = normalizeText(req?.headers?.origin).toLowerCase().replace(/\/$/, "");
  const permitidos = origenesPermitidos();
  const permitido = Boolean(origen) && permitidos.includes(origen);

  if (permitido) {
    // Sin `Vary`, una respuesta guardada en caché para un origen se le acaba
    // sirviendo a otro con la cabecera del primero, y falla sin motivo
    // aparente.
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-PopCar-Client");
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (normalizeText(req?.method).toUpperCase() === "OPTIONS") {
    // Un preflight de un origen que no está en la lista se contesta igual, sin
    // las cabeceras de permiso: el navegador lo interpreta como un no, que es
    // lo que es. Responder 403 aquí sale como un error de red sin explicación.
    res.status(204).end();
    return true;
  }

  return false;
}

module.exports = { aplicaCors, origenesPermitidos };
