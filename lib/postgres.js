"use strict";

/**
 * El cliente de Postgres. Uno, para todo el proceso.
 *
 * ## Lo que había
 *
 * Cuarenta y nueve ficheros abriendo el suyo, con veintiséis versiones
 * distintas de la misma función de ocho líneas. Unas con `max: 3`, otras con
 * `max: 5`, la mayoría sin decir nada —y entonces `pg` pone 10—. Unas con SSL
 * verificado y otras sin mencionarlo.
 *
 * Y siete que hacían esto:
 *
 *     function getPool() {
 *       return new Pool({ connectionString: process.env.DATABASE_URL });
 *     }
 *
 * Sin guardarlo. Un `Pool` nuevo **en cada llamada**, y cada uno se queda con
 * sus conexiones abiertas hasta que expiran solas. `lib/viewingStore.js` lo
 * llamaba cinco veces por petición: cinco pools, cada uno con hasta diez
 * conexiones, para atender a una persona que quiere ver un coche.
 *
 * Eso no se nota mientras sobran conexiones. Se nota el día que faltan, y
 * entonces no parece lo que es: parece que la base va lenta. El 24 de
 * septiembre el panel del ERP contestó 500 porque su cliente se rindió a los
 * cinco segundos esperando una conexión libre.
 *
 * ## Por qué un solo sitio
 *
 * Es la misma razón que hizo nacer a `postgres-ssl.js`, que está al lado: un
 * ajuste de conexión repetido veintiséis veces no se cambia nunca, porque
 * siempre queda uno sin cambiar. El día que haya que subir el límite, bajar un
 * tiempo de espera o mirar por qué se agotan las conexiones, hay un fichero
 * donde hacerlo.
 *
 * ## Los dos contratos
 *
 * No todos los sitios querían lo mismo cuando falta la configuración, y eso no
 * es un descuido: en un manejador de peticiones, sin base se contesta 503; en
 * un almacén que se usa dentro de una transacción, seguir sin base es peor que
 * pararse. Así que hay dos puertas y cada quien se queda con la suya:
 *
 *   · `elPool()`            devuelve `null` si no hay configuración;
 *   · `elPoolObligatorio()` revienta con un mensaje que dice qué falta.
 *
 * ## Cuánta capacidad
 *
 * Diez, que es lo que `pg` pone por omisión y por tanto lo que ya tenía la
 * mayoría: así nadie se queda con menos de lo que tenía. Se puede mover con
 * `PG_MAX_CONEXIONES` sin tocar código, porque el número bueno depende de
 * cuántas instancias haya despiertas a la vez y eso cambia sin avisar.
 */

const { Pool } = require("pg");
const { SSL_POSTGRES } = require("./postgres-ssl");

/** La cadena de conexión, con los dos nombres que se han usado por aquí. */
function laCadena() {
  const cruda = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  return typeof cruda === "string" ? cruda.trim() : "";
}

function elMaximo() {
  const puesto = Number.parseInt(process.env.PG_MAX_CONEXIONES || "", 10);
  return Number.isInteger(puesto) && puesto > 0 ? puesto : 10;
}

let _pool = null;
let _cadenaDelPool = "";

/**
 * El pool, o `null` si no hay cadena de conexión configurada.
 *
 * @returns {import("pg").Pool|null}
 */
function elPool() {
  const cadena = laCadena();
  if (!cadena) return null;

  /*
   * Si la cadena cambia, el pool viejo ya no sirve.
   *
   * En producción no pasa nunca. En las pruebas sí: hay varias que cambian
   * `DATABASE_URL` para apuntar a otro sitio, y con un pool cacheado a secas
   * se quedarían hablando con la base de la prueba anterior sin que nada lo
   * dijera.
   */
  if (_pool && _cadenaDelPool !== cadena) {
    const viejo = _pool;
    _pool = null;
    _cadenaDelPool = "";
    viejo.end().catch(() => {});
  }

  if (!_pool) {
    _pool = new Pool({
      connectionString: cadena,
      ssl: SSL_POSTGRES,
      max: elMaximo(),
    });
    _cadenaDelPool = cadena;

    /*
     * Sin esto, un error en una conexión ociosa —los que manda el servidor al
     * cerrar por su cuenta— llega como excepción no capturada y se lleva el
     * proceso por delante. Con esto, se anota y la siguiente consulta abre otra.
     */
    _pool.on("error", (e) => {
      console.error("[postgres] error en una conexión en reposo:", e.message);
    });
  }

  return _pool;
}

/**
 * El pool, o una excepción si no hay configuración.
 *
 * Para los sitios que antes hacían `throw new Error("DATABASE_URL not set")`:
 * quedarse a medias sin base es peor que pararse con un mensaje.
 *
 * @returns {import("pg").Pool}
 */
function elPoolObligatorio() {
  const pool = elPool();
  if (!pool) {
    throw new Error(
      "No hay base de datos: falta DATABASE_URL (o POSTGRES_URL) en el entorno."
    );
  }
  return pool;
}

/** ¿Hay base configurada? Para decidir sin abrir nada. */
function hayBase() {
  return Boolean(laCadena());
}

/**
 * Cerrar el pool. Para las pruebas y para los guiones sueltos, que terminan.
 *
 * Una función sin servidor no llama a esto: el proceso muere y se lleva las
 * conexiones. Llamarlo ahí dejaría a la siguiente petición de esa misma
 * instancia sin pool, que tendría que abrirlo otra vez.
 */
async function cierraElPool() {
  if (!_pool) return;
  const viejo = _pool;
  _pool = null;
  _cadenaDelPool = "";
  await viejo.end().catch(() => {});
}

module.exports = { elPool, elPoolObligatorio, hayBase, cierraElPool };
