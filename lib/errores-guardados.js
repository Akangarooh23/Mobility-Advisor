"use strict";

const { elPool } = require("./postgres");

/**
 * Los fallos, guardados en casa.
 *
 * ## Qué hace
 *
 * Escribe en `moveadvisor_errores` lo que `registra()` ya escribe en los
 * registros, y sabe agruparlo para que se pueda contar. Es la mitad que convierte
 * líneas sueltas en «este fallo, 400 veces, 87 personas, desde el martes».
 *
 * ## La huella, que es lo que decide el agrupado
 *
 * Dos fallos son el mismo si vienen del mismo sitio y dicen lo mismo salvo los
 * números. Un id de coche distinto, un importe distinto o una hora distinta no son
 * dos fallos: son el mismo cuatrocientas veces. Sin quitar los números, el aviso
 * diría «400 fallos distintos» y no serviría para nada.
 *
 * Se quitan también los uuid y los correos ya tapados, por el mismo motivo.
 *
 * ## Por qué se espera a que escriba
 *
 * En una función serverless, lo que se lanza sin esperar puede no ejecutarse
 * nunca: el proceso se congela en cuanto se manda la respuesta. Así que esto se
 * espera —con un límite de dos segundos— y se paga una vez, solo cuando ya ha
 * fallado algo. Es un precio que se cobra en el camino del error, que es raro; el
 * camino bueno no lo paga.
 *
 * Y nunca lanza. Un registrador que se cae taparía el error de verdad con el suyo.
 */

/** Lo que tarda como mucho en escribir antes de rendirse. */
const LO_QUE_SE_ESPERA_MS = 2000;

/**
 * Lo que hace que dos fallos sean el mismo.
 *
 * `donde` más el mensaje sin números, sin uuid y sin correos.
 */
function laHuella(donde, mensaje) {
  /*
   * Se recorta ANTES de las expresiones, no después.
   *
   * Con el recorte al final, `\S*\*\*\*@\S+` —la de los correos tapados— se pone
   * a retroceder sobre todo el mensaje buscando un `***@` que no está: medido,
   * 2 ms con mil caracteres, 127 ms con diez mil y **3,2 segundos con cincuenta
   * mil**. Cuadrático.
   *
   * Y un mensaje de cincuenta mil caracteres no es raro: el cuerpo de una
   * respuesta HTML que alguien metió en un `new Error`, o una pila muy larga. Eso
   * habría dejado colgada una función serverless durante tres segundos, justo
   * cuando ya estaba fallando algo.
   */
  const limpio = String(mensaje || "")
    .slice(0, 500)
    .toLowerCase()
    // uuid primero: si no, los trozos numéricos se los come la regla siguiente.
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "#")
    // Correos, que `registra` ya deja tapados pero con el dominio puesto.
    .replace(/\S*\*\*\*@\S+/g, "#")
    // Y cualquier número: ids, importes, horas, líneas de una pila.
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  return `${String(donde || "sin sitio").slice(0, 120)} :: ${limpio}`;
}

/** Con un límite, para no dejar colgada una petición que ya ha fallado. */
function conLimite(promesa) {
  return Promise.race([
    promesa,
    new Promise((_ok, falla) => {
      const reloj = setTimeout(() => falla(new Error("la base tardó demasiado")), LO_QUE_SE_ESPERA_MS);
      // Que el temporizador no mantenga vivo el proceso él solo.
      if (typeof reloj.unref === "function") reloj.unref();
    }),
  ]);
}

/**
 * Guarda un fallo. Devuelve `true` si se escribió.
 *
 * `linea` es lo que monta `registra()`: `{ donde, mensaje, codigo, pila,
 * contexto }`. `extra` es lo que solo tiene el navegador.
 */
async function guarda(linea = {}, extra = {}) {
  const pool = elPool();
  // Sin base configurada no hay nada que hacer, y no es un error: en local y en
  // las pruebas puede no haberla.
  if (!pool) return false;

  const donde = String(linea.donde || "sin sitio").slice(0, 200);
  const mensaje = String(linea.mensaje || "").slice(0, 2000);

  let contexto = "{}";
  try {
    contexto = JSON.stringify(linea.contexto || {});
  } catch {
    // Referencias circulares: el fallo se guarda igual, sin el contexto.
    contexto = '{"_":"contexto que no se puede serializar"}';
  }

  try {
    await conLimite(
      pool.query(
        `INSERT INTO moveadvisor_errores
           (lado, donde, mensaje, huella, codigo, pila, contexto,
            pantalla, direccion, navegador, quien, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12)`,
        [
          extra.lado === "navegador" ? "navegador" : "servidor",
          donde,
          mensaje,
          laHuella(donde, mensaje),
          linea.codigo ? String(linea.codigo).slice(0, 40) : null,
          linea.pila ? String(linea.pila).slice(0, 4000) : null,
          contexto,
          extra.pantalla ? String(extra.pantalla).slice(0, 120) : null,
          extra.direccion ? String(extra.direccion).slice(0, 500) : null,
          extra.navegador ? String(extra.navegador).slice(0, 300) : null,
          extra.quien ? String(extra.quien).slice(0, 200) : null,
          extra.version ? String(extra.version).slice(0, 80) : null,
        ]
      )
    );
    return true;
  } catch (error) {
    /*
     * Si la tabla no existe todavía —la migración no se ha aplicado— o la base no
     * contesta, el fallo ya está en los registros. Se dice una vez, en texto
     * plano, para que no parezca que el guardado funciona.
     */
    try {
      console.error(`[errores-guardados] no se pudo guardar: ${error?.message || error}`);
    } catch {}
    return false;
  }
}

module.exports = { guarda, laHuella, LO_QUE_SE_ESPERA_MS };
