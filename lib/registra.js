"use strict";

/**
 * Que alguien se entere.
 *
 * ## Qué había
 *
 * Nada. Ninguna dependencia de seguimiento de errores, 16 `catch {}` y 35
 * `.catch(() => {})` que se tragan el error del todo, y 8 `console.error` que van
 * a los registros de Vercel, que caducan y no avisan a nadie.
 *
 * O sea: el sistema de detección de fallos era Ana mirando la pantalla. Y eso ya
 * falló dos veces —el PDF de factura llevaba roto en producción y el aviso de
 * cookies no salía— y las dos se descubrieron por casualidad.
 *
 * ## Los tres que de verdad importaban
 *
 * No todos los `catch` vacíos son iguales. Al mirarlos uno a uno, tres esconden
 * cosas que cuestan dinero o datos:
 *
 *   · **`billing-account-handler`** se tragaba el `UPDATE` que pone
 *     `plan_id = 'plus'`. Stripe cobra y la base puede no enterarse: la persona
 *     ha pagado y la web le sigue tratando como gratuita, sin una línea en
 *     ningún sitio;
 *   · **`vehicle-publish-handler`** se traga **seis** `UPDATE` —entre ellos el
 *     precio y la marca de «publicado»— y después responde `{ ok: true }`. Un
 *     coche puede quedar dado por publicado con `is_listed` en falso, o con el
 *     precio viejo;
 *   · **`marketplace-og-handler`** se tragaba la consulta de la oferta, así que
 *     «la base no contesta» y «ese coche no existe» acababan en lo mismo: un
 *     redirigido al listado. Es justo el fallo que su propio comentario describe
 *     dos líneas más abajo.
 *
 * ## Qué NO hace esto
 *
 * Cambiar el flujo. Lo que se tragaba un error sigue tragándoselo: nadie recibe
 * un 500 nuevo por esto. Lo único que cambia es que queda escrito, con contexto
 * suficiente para buscarlo.
 *
 * Arreglar de verdad los seis `UPDATE` del publicador es otra cosa —quieren una
 * transacción, y decidir si un fallo debe deshacer la publicación— y ésa es una
 * decisión de producto, no de este módulo.
 *
 * ## Y el enchufe
 *
 * Esto escribe una línea JSON en `stderr`, que es lo que Vercel recoge y permite
 * buscar. No instala Sentry porque eso necesita una cuenta y una clave que no
 * están aquí. Cuando las haya, se enchufa en un sitio -`conecta()`- y todo lo que
 * ya llama a `registra` empieza a llegar allí sin tocar ni una línea más.
 */

/** A dónde se manda, además de a los registros. Lo pone `conecta()`. */
let elServicio = null;

/**
 * Si además se guardan en la base.
 *
 * Es **opt-in a propósito**, y no por prudencia genérica: el entorno local de
 * esta máquina apunta a la base de producción. Con el guardado encendido por
 * omisión, cualquier prueba que llame a `registra` metería filas en la tabla de
 * errores de verdad.
 *
 * Se enciende con `GUARDA_LOS_ERRORES=1` en Vercel. El endpoint del navegador
 * —`api/error`— guarda siempre, porque es lo único que hace y no lo llama ninguna
 * prueba.
 */
function seGuardanEnLaBase() {
  return String(process.env.GUARDA_LOS_ERRORES || "").trim() === "1";
}

/**
 * Enchufa un servicio de verdad (Sentry, Datadog, lo que sea).
 *
 * Se llama una vez, al arrancar. La función recibe el mismo objeto que se
 * escribe en los registros.
 */
function conecta(mandaloAlServicio) {
  elServicio = typeof mandaloAlServicio === "function" ? mandaloAlServicio : null;
}

/**
 * Los correos no se escriben enteros.
 *
 * Un registro de errores acaba en sitios donde no debería haber datos personales,
 * y se guarda mucho tiempo. Con el dominio y las dos primeras letras se puede
 * seguir el rastro de un caso sin dejar la dirección puesta.
 */
function tapaElCorreo(texto) {
  return String(texto == null ? "" : texto).replace(
    /([A-Za-z0-9._%+-]{1,64})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    (_todo, antes, dominio) => `${antes.slice(0, 2)}***@${dominio}`
  );
}

/** Lo que se puede sacar de un error, que puede no ser un Error. */
function loQueSeSabeDe(error) {
  if (!error) return { mensaje: "" };

  if (error instanceof Error) {
    return {
      mensaje: tapaElCorreo(error.message),
      tipo: error.name,
      // El código de Postgres dice mucho: 23505 es clave duplicada, 42P01 tabla
      // que no existe, 57014 consulta cancelada por tiempo.
      codigo: error.code ? String(error.code) : undefined,
      restriccion: error.constraint || undefined,
      tabla: error.table || undefined,
      pila: typeof error.stack === "string" ? tapaElCorreo(error.stack).split("\n").slice(0, 6).join("\n") : undefined,
    };
  }

  if (typeof error === "object") {
    try {
      return { mensaje: tapaElCorreo(JSON.stringify(error).slice(0, 600)) };
    } catch {
      return { mensaje: "[objeto que no se puede serializar]" };
    }
  }

  return { mensaje: tapaElCorreo(error) };
}

/**
 * Deja constancia de un error que no se va a propagar.
 *
 * @param donde    qué estaba pasando, en dos o tres palabras y con su sitio:
 *                 "vehicle-publish: marcar is_listed"
 * @param error    lo que se ha cazado, sea lo que sea
 * @param contexto ids y datos con los que buscarlo después. Sin correos enteros:
 *                 se tapan solos, pero mejor mandar ids.
 *
 * ## Qué devuelve, y por qué es una promesa
 *
 * Los registros se escriben **a la vez**, aquí mismo: eso no espera a nadie. Lo
 * que devuelve es una promesa de que además se ha guardado en la base.
 *
 *     registra(...)         // registros seguro, base a lo que salga
 *     await registra(...)   // registros y base, garantizado
 *
 * Y la diferencia importa en una función serverless: lo que se lanza sin esperar
 * puede no ejecutarse nunca, porque el proceso se congela en cuanto se manda la
 * respuesta. Donde se pueda esperar, se espera.
 *
 * La promesa **nunca se rompe**. Ni ésta ni nada de aquí: un registrador que se
 * cae es peor que no tener ninguno, porque taparía el error de verdad con el suyo.
 */
function registra(donde, error, contexto = {}) {
  let linea;

  try {
    linea = {
      nivel: "error",
      donde: String(donde || "sin sitio"),
      cuando: new Date().toISOString(),
      ...loQueSeSabeDe(error),
      ...(contexto && typeof contexto === "object" ? { contexto } : {}),
    };
  } catch {
    linea = { nivel: "error", donde: String(donde || "sin sitio"), mensaje: "[no se pudo describir el error]" };
  }

  try {
    /*
     * Una sola línea de JSON: es lo que permite buscar por `donde` o por un id en
     * los registros de Vercel, que es todo lo que hay hasta que exista Sentry.
     */
    console.error(JSON.stringify(linea));
  } catch {
    // Si ni esto se puede, no hay nada más que hacer sin romper la petición.
  }

  if (elServicio) {
    try {
      elServicio(linea);
    } catch {
      // El servicio se cae: los registros ya tienen la línea.
    }
  }

  if (!seGuardanEnLaBase()) {
    return Promise.resolve(linea);
  }

  /*
   * Se pide aquí y no arriba para que un fichero que solo quiera registrar no
   * arrastre el módulo de Postgres, y para que las pruebas no lo carguen nunca.
   */
  try {
    const { guarda } = require("./errores-guardados");
    return guarda(linea).then(() => linea, () => linea);
  } catch {
    return Promise.resolve(linea);
  }
}

/**
 * Lo mismo, para poner detrás de una promesa que antes se tragaba el error.
 *
 *     await pool.query(...).catch(seTragaba("vehicle-publish: precio", { vehicleId }));
 *
 * Se llama así porque lo que hace es exactamente lo que había —tragárselo— más
 * dejarlo escrito.
 *
 * Devuelve una función `async`, y eso es deliberado: puesta en un
 * `await algo().catch(seTragaba(...))`, el `await` de fuera espera también a que
 * se guarde. Sin eso, en serverless el guardado se quedaría a medias cuando la
 * respuesta sale antes.
 */
function seTragaba(donde, contexto = {}) {
  return async (error) => {
    await registra(donde, error, contexto);
  };
}

module.exports = { registra, seTragaba, conecta, tapaElCorreo, seGuardanEnLaBase };
