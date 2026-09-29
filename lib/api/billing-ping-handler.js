"use strict";

/**
 * ¿Contesta la base? Sí o no, y nunca un error.
 *
 * Es la sonda que usa el front para saber si puede pedir datos o tiene que
 * enseñar la pantalla de «esto va lento». Por eso devuelve 200 siempre, con
 * `db: false` cuando la base no contesta: un 500 aquí haría que el propio
 * comprobador de salud pareciera la avería.
 *
 * El tope de 8 segundos es lo que la hace útil. Sin él, cuando la base está
 * ahogada esta llamada se queda esperando lo mismo que las demás y deja de
 * responder la única pregunta que tenía que responder.
 *
 * Vivía dentro de `api/billing.js`. Se saca para que `require("pg")` no se
 * cargue en el arranque en frío de las otras cuatro rutas de esa puerta, que
 * no lo necesitan.
 *
 * ── Por qué este NO usa `lib/postgres.js` ─────────────────────────────────
 *
 * Es la única excepción a propósito, junto con `inventoryStore`, y el motivo
 * es justo lo que esta función hace: medir.
 *
 * El pool compartido tiene diez conexiones. Si están todas ocupadas —que es
 * exactamente el día en que a alguien le importa esta sonda—, pedirle una
 * conexión se queda esperando, y la sonda tardaría lo mismo que las consultas
 * sobre las que tenía que informar. Contestaría «la base va bien» treinta
 * segundos tarde, o no contestaría.
 *
 * Con el suyo —`max: 1`, siete segundos para conectar, ocho para todo— la
 * respuesta llega siempre, y dice la verdad. Una conexión más no le hace daño
 * a nadie; una sonda que se cuelga con el sistema, sí.
 */

const { Pool } = require("pg");
const { SSL_POSTGRES } = require("../postgres-ssl");

let _pingPool = null;

module.exports = async function pingHandler(req, res) {
  const hardTimeout = new Promise((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), 8000)
  );
  try {
    if (!_pingPool) {
      const cs = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      if (!cs) return res.status(200).json({ ok: true, db: false });
      _pingPool = new Pool({
        connectionString: cs,
        ssl: SSL_POSTGRES,
        max: 1,
        connectionTimeoutMillis: 7000,
        idleTimeoutMillis: 10000,
      });
    }
    const result = await Promise.race([
      _pingPool.query("SELECT 1").then(() => ({ db: true })),
      hardTimeout,
    ]);
    return res.status(200).json({ ok: true, db: result.db === true });
  } catch {
    return res.status(200).json({ ok: true, db: false });
  }
};
