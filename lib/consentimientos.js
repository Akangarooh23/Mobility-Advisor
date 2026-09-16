"use strict";

/**
 * Los consentimientos de un usuario, y cómo se retiran.
 *
 * Hasta ahora eran siete columnas de fecha en `moveadvisor_users`: si tenían
 * fecha, había consentimiento. Eso guarda el estado pero no el hecho, y por eso
 * no se podía retirar nada — poner la columna a NULL borra la prueba de que un
 * día dijo que sí, que es justo lo que hay que poder enseñar si alguien
 * reclama. La política de privacidad promete que el consentimiento es
 * «revocable en cualquier momento sin coste» y no había forma de revocarlo.
 *
 * Un consentimiento no es una casilla: es un hecho con fecha. Así que se guarda
 * como lo que es, en una tabla que **solo crece**. Retirar uno no borra el de
 * antes: añade una fila que dice que no. Si mañana lo vuelve a dar, son tres
 * filas y la historia entera se puede leer.
 *
 * Las siete columnas de siempre se quedan y se siguen actualizando como copia
 * del estado de hoy. Así nada de lo que ya las lee se entera del cambio.
 *
 * Aquí abajo, la parte que decide —qué estado hay y qué cambia— son funciones
 * puras y con pruebas. Lo que toca la base es fino a propósito.
 */

/** Los cuatro que el usuario puede dar y quitar cuando quiera. */
const TIPOS = ["marketing_email", "marketing_sms", "thirdparty_email", "thirdparty_sms"];

/**
 * El legal no está, y no es un olvido.
 *
 * No se pueden «des-aceptar» las condiciones y seguir teniendo cuenta: eso es
 * darse de baja, que es otro trámite y con otras consecuencias. Un interruptor
 * para eso prometería algo que no puede cumplir.
 */
const COLUMNA = {
  marketing_email: "consent_marketing_email_at",
  marketing_sms: "consent_marketing_sms_at",
  thirdparty_email: "consent_thirdparty_email_at",
  thirdparty_sms: "consent_thirdparty_sms_at",
};

/** Cómo se llama cada uno cuando hay que escribirlo en un correo o una pantalla. */
const COMO_SE_LLAMAN = {
  marketing_email: "Novedades de PopCar por correo",
  marketing_sms: "Novedades de PopCar por SMS",
  thirdparty_email: "Ofertas de colaboradores por correo",
  thirdparty_sms: "Ofertas de colaboradores por SMS",
};

/* ---------- lo que decide ---------- */

/**
 * El estado de hoy, a partir del historial y de las columnas de siempre.
 *
 * Manda la última fila de cada tipo. Cuando no hay ninguna —todo el que
 * consintió antes de que esta tabla existiera— vale la columna: tener fecha es
 * haber consentido. Sin esto, el día que se estrene esto todo el mundo
 * aparecería sin consentir y dejarían de salir correos que sí se habían
 * autorizado.
 */
function estadoDesde(filas = [], columnas = {}) {
  const ultima = {};
  for (const fila of filas) {
    const tipo = String(fila?.tipo || "");
    if (!TIPOS.includes(tipo)) continue;
    const cuando = new Date(fila?.ocurrio_en || 0).getTime();
    if (!ultima[tipo] || cuando >= ultima[tipo].cuando) {
      ultima[tipo] = { cuando, concedido: fila?.concedido === true };
    }
  }

  const estado = {};
  for (const tipo of TIPOS) {
    if (ultima[tipo]) estado[tipo] = ultima[tipo].concedido;
    else estado[tipo] = Boolean(columnas?.[COLUMNA[tipo]]);
  }
  return estado;
}

/**
 * Qué cambia de verdad entre lo que hay y lo que se pide.
 *
 * Solo lo que cambia. Guardar sin tocar nada no debe dejar rastro: un historial
 * con una fila por cada vez que alguien abrió la pantalla de ajustes no prueba
 * nada, solo pesa.
 *
 * Lo que no venga en `deseado` se queda como está. Así una pantalla que solo
 * enseña dos de los cuatro no apaga los otros dos sin querer.
 */
function queCambia(actual = {}, deseado = {}) {
  const cambios = [];
  for (const tipo of TIPOS) {
    if (!(tipo in deseado)) continue;
    const quiere = deseado[tipo] === true;
    if (quiere !== (actual[tipo] === true)) cambios.push({ tipo, concedido: quiere });
  }
  return cambios;
}

/* ---------- lo que toca la base ---------- */

let _tablaLista = false;
async function preparaTabla(pool) {
  if (_tablaLista) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_user_consents (
      id          BIGSERIAL   PRIMARY KEY,
      user_email  TEXT        NOT NULL,
      tipo        TEXT        NOT NULL,
      concedido   BOOLEAN     NOT NULL,
      ocurrio_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      origen      TEXT,
      ip          TEXT,
      user_agent  TEXT
    );
    CREATE INDEX IF NOT EXISTS moveadvisor_user_consents_quien
      ON moveadvisor_user_consents (lower(user_email), tipo, ocurrio_en DESC);
  `);
  _tablaLista = true;
}

/** El estado de hoy de un usuario. */
async function estadoDe(pool, email) {
  const correo = String(email || "").trim().toLowerCase();
  if (!correo) return estadoDesde([], {});

  await preparaTabla(pool);

  const [historial, usuario] = await Promise.all([
    pool.query(
      `SELECT tipo, concedido, ocurrio_en
         FROM moveadvisor_user_consents
        WHERE lower(user_email) = $1
        ORDER BY ocurrio_en ASC`,
      [correo],
    ),
    pool.query(
      `SELECT ${Object.values(COLUMNA).join(", ")}
         FROM moveadvisor_users
        WHERE lower(email) = $1
        LIMIT 1`,
      [correo],
    ),
  ]);

  return estadoDesde(historial.rows || [], (usuario.rows || [])[0] || {});
}

/**
 * Aplica lo que el usuario ha pedido.
 *
 * Escribe una fila por cada cambio y deja las columnas de siempre al día: con
 * fecha si acaba de darlo, a NULL si lo retira. La prueba de que lo dio no se
 * pierde al vaciar la columna — está en el historial, que es donde tiene que
 * estar.
 */
async function aplica(pool, email, deseado, contexto = {}) {
  const correo = String(email || "").trim().toLowerCase();
  if (!correo) return { cambios: [], estado: estadoDesde([], {}) };

  const actual = await estadoDe(pool, correo);
  const cambios = queCambia(actual, deseado);
  if (cambios.length === 0) return { cambios: [], estado: actual };

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    for (const cambio of cambios) {
      await cliente.query(
        `INSERT INTO moveadvisor_user_consents (user_email, tipo, concedido, origen, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          correo,
          cambio.tipo,
          cambio.concedido,
          String(contexto.origen || "").slice(0, 40) || null,
          String(contexto.ip || "").slice(0, 100) || null,
          String(contexto.userAgent || "").slice(0, 500) || null,
        ],
      );

      await cliente.query(
        `UPDATE moveadvisor_users
            SET ${COLUMNA[cambio.tipo]} = ${cambio.concedido ? "NOW()" : "NULL"}
          WHERE lower(email) = $1`,
        [correo],
      );
    }

    /*
     * Y los dos agregados viejos, que siguen existiendo y los lee alguien.
     * Quedan encendidos si queda encendido alguno de los suyos: es lo mismo que
     * hace `save_consents` al darlos, visto desde el otro lado.
     */
    const despues = { ...actual };
    for (const c of cambios) despues[c.tipo] = c.concedido;

    const marketing = despues.marketing_email || despues.marketing_sms;
    const terceros = despues.thirdparty_email || despues.thirdparty_sms;
    await cliente.query(
      `UPDATE moveadvisor_users
          SET consent_marketing_at = ${marketing ? "COALESCE(consent_marketing_at, NOW())" : "NULL"},
              consent_experian_at  = ${terceros ? "COALESCE(consent_experian_at, NOW())" : "NULL"}
        WHERE lower(email) = $1`,
      [correo],
    );

    await cliente.query("COMMIT");
    return { cambios, estado: despues };
  } catch (err) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
}

module.exports = {
  TIPOS,
  COLUMNA,
  COMO_SE_LLAMAN,
  estadoDesde,
  queCambia,
  estadoDe,
  aplica,
};
