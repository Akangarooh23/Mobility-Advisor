"use strict";

/**
 * Las preferencias del cliente y sus comparaciones guardadas, en Postgres.
 *
 * ## Por qué existe esto
 *
 * Las dos cosas vivían en `lib/sqlserverMobilityStore.js`, que habla con SQL
 * Server **lanzando `sqlcmd.exe`** con `execFileSync` desde dentro de la
 * petición. En Vercel no hay `sqlcmd`, así que ese camino no se puede
 * completar, y lo que pasaba no era un error:
 *
 *     if (!shouldUseSqlServerMobility()) {
 *       if (method === "GET") {
 *         return res.status(200).json({ ok: true, comparisons: [], fallback: true });
 *       }
 *       return res.status(503).json({ error: "Backend de movilidad no configurado." });
 *     }
 *
 * Es decir: al leer, **200 con la lista vacía**. Para quien lo usa eso no es
 * «esto está roto», es «no tengo nada guardado», que es peor: no se puede ni
 * reclamar. Y al guardar, un 503 en la pantalla de preferencias del panel, que
 * es una pantalla que existe y en la que se pulsa un botón.
 *
 * Las dos tablas de Postgres ya estaban hechas y con la forma exacta que hace
 * falta —`moveadvisor_user_saved_comparisons` y `moveadvisor_user_preferences`,
 * las dos con cero filas—. Solo faltaba que alguien las usara.
 *
 * ## Qué se conserva
 *
 * La forma de la respuesta, exactamente. Lo que devolvía el camino de SQL
 * Server es lo que espera `src/hooks/useAppBootstrap.js` y la pantalla de
 * preferencias, y cambiarlo sería arreglar una cosa rompiendo otra:
 *
 *   · las comparaciones salen como `{ ...payload, id, title, mode }`, con el
 *     payload guardado desenvuelto encima;
 *   · las preferencias, con sus siete campos en minúscula camel y sus valores
 *     por omisión —idioma `es`, avisos encendidos—.
 *
 * ## El correo y el identificador
 *
 * Se busca por correo, que es como está escrito el resto, y se guarda también
 * `user_id` cuando se sabe. Es la mitad de `0006-el-correo-deja-de-ser-la-atadura`
 * que se puede hacer sin romper nada: escribir las dos cosas hoy para poder
 * dejar de mirar el correo mañana.
 */

const { elPool } = require("./postgres");

function texto(v) {
  return typeof v === "string" ? v.trim() : "";
}

function correoDe(v) {
  return texto(v).toLowerCase();
}

/** `false` solo si viene un `false` de verdad: lo que no se sabe, se enciende. */
function siNoDicenQueNo(v) {
  return v !== false && v !== 0 && v !== "false" && v !== "0";
}

/* ─────────────────────────────── preferencias ─────────────────────────────── */

const PREFERENCIAS_POR_OMISION = {
  fullName: "",
  language: "es",
  region: "es",
  notifyPriceAlerts: true,
  notifyAppointments: true,
  notifyAnalysisReady: true,
  weeklyDigest: true,
};

function comoLasLeeLaWeb(fila) {
  if (!fila) return null;
  return {
    fullName: texto(fila.full_name),
    language: texto(fila.language) || "es",
    region: texto(fila.region) || "es",
    notifyPriceAlerts: siNoDicenQueNo(fila.notify_price_alerts),
    notifyAppointments: siNoDicenQueNo(fila.notify_appointments),
    notifyAnalysisReady: siNoDicenQueNo(fila.notify_analysis_ready),
    weeklyDigest: siNoDicenQueNo(fila.weekly_digest),
  };
}

/**
 * Las preferencias de alguien, o `null` si nunca las ha guardado.
 *
 * `null` y «las de por omisión» no son lo mismo y la web los distingue: con
 * `null` enseña el formulario vacío en vez de fingir que ya eligió.
 */
async function leePreferencias(email) {
  const correo = correoDe(email);
  const pool = elPool();
  if (!correo || !pool) return null;

  const { rows } = await pool.query(
    `SELECT full_name, language, region,
            notify_price_alerts, notify_appointments, notify_analysis_ready, weekly_digest
       FROM moveadvisor_user_preferences
      WHERE lower(user_email) = $1
      LIMIT 1`,
    [correo]
  );
  return comoLasLeeLaWeb(rows[0]);
}

/**
 * Guarda -o actualiza- las preferencias, y devuelve cómo quedaron.
 *
 * Lo que no venga en el cuerpo se queda como estaba, no se borra: la pantalla
 * manda el formulario entero hoy, pero un cliente que llame con un solo campo
 * no debería perder los otros seis.
 */
async function guardaPreferencias(email, cambios = {}, { userId = "" } = {}) {
  const correo = correoDe(email);
  const pool = elPool();
  if (!correo || !pool) return null;

  const antes = (await leePreferencias(correo)) || PREFERENCIAS_POR_OMISION;
  const nuevo = {
    fullName: cambios.fullName !== undefined ? texto(cambios.fullName) : antes.fullName,
    language: cambios.language !== undefined ? texto(cambios.language) || "es" : antes.language,
    region: cambios.region !== undefined ? texto(cambios.region) || "es" : antes.region,
    notifyPriceAlerts: cambios.notifyPriceAlerts !== undefined
      ? siNoDicenQueNo(cambios.notifyPriceAlerts) : antes.notifyPriceAlerts,
    notifyAppointments: cambios.notifyAppointments !== undefined
      ? siNoDicenQueNo(cambios.notifyAppointments) : antes.notifyAppointments,
    notifyAnalysisReady: cambios.notifyAnalysisReady !== undefined
      ? siNoDicenQueNo(cambios.notifyAnalysisReady) : antes.notifyAnalysisReady,
    weeklyDigest: cambios.weeklyDigest !== undefined
      ? siNoDicenQueNo(cambios.weeklyDigest) : antes.weeklyDigest,
  };

  await pool.query(
    `INSERT INTO moveadvisor_user_preferences
       (user_email, user_id, full_name, language, region,
        notify_price_alerts, notify_appointments, notify_analysis_ready, weekly_digest, updated_at)
     VALUES ($1, NULLIF($2, ''), $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (user_email) DO UPDATE
        SET user_id               = COALESCE(NULLIF(EXCLUDED.user_id, ''), moveadvisor_user_preferences.user_id),
            full_name             = EXCLUDED.full_name,
            language              = EXCLUDED.language,
            region                = EXCLUDED.region,
            notify_price_alerts   = EXCLUDED.notify_price_alerts,
            notify_appointments   = EXCLUDED.notify_appointments,
            notify_analysis_ready = EXCLUDED.notify_analysis_ready,
            weekly_digest         = EXCLUDED.weekly_digest,
            updated_at            = NOW()`,
    [
      correo, texto(userId), nuevo.fullName, nuevo.language, nuevo.region,
      nuevo.notifyPriceAlerts, nuevo.notifyAppointments, nuevo.notifyAnalysisReady, nuevo.weeklyDigest,
    ]
  );

  return nuevo;
}

/* ────────────────────────── comparaciones guardadas ───────────────────────── */

function comoLaLeeLaWeb(fila) {
  let guardado = {};
  try {
    const leido = JSON.parse(String(fila?.comparison_payload || "{}"));
    if (leido && typeof leido === "object") guardado = leido;
  } catch {
    // Un payload ilegible no puede tirar la lista entera: se devuelve la
    // comparación con lo que sí se sabe de ella.
    guardado = {};
  }

  return {
    ...guardado,
    id: texto(fila?.id) || texto(guardado?.id),
    title: texto(fila?.title) || texto(guardado?.title),
    mode: texto(fila?.mode) || texto(guardado?.mode) || "buy",
  };
}

/** Las comparaciones de alguien, de la más reciente a la más vieja. */
async function listaComparaciones(email) {
  const correo = correoDe(email);
  const pool = elPool();
  if (!correo || !pool) return [];

  const { rows } = await pool.query(
    `SELECT id, title, mode, comparison_payload
       FROM moveadvisor_user_saved_comparisons
      WHERE lower(user_email) = $1
      ORDER BY created_at DESC`,
    [correo]
  );
  return rows.map(comoLaLeeLaWeb);
}

/**
 * Guarda una comparación y devuelve la lista entera, como hacía la de antes.
 *
 * Sin `id` no se guarda nada: el identificador lo pone quien la crea, y una
 * comparación sin él no se puede ni actualizar ni borrar después.
 */
async function guardaComparacion(email, payload = {}, { userId = "" } = {}) {
  const correo = correoDe(email);
  const id = texto(payload?.id);
  const pool = elPool();
  if (!correo || !id || !pool) return listaComparaciones(correo);

  await pool.query(
    `INSERT INTO moveadvisor_user_saved_comparisons
       (id, user_email, user_id, title, mode, comparison_payload, created_at, updated_at)
     VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE
        SET user_id            = COALESCE(NULLIF(EXCLUDED.user_id, ''), moveadvisor_user_saved_comparisons.user_id),
            title              = EXCLUDED.title,
            mode               = EXCLUDED.mode,
            comparison_payload = EXCLUDED.comparison_payload,
            updated_at         = NOW()
      WHERE lower(moveadvisor_user_saved_comparisons.user_email) = lower(EXCLUDED.user_email)`,
    [
      id, correo, texto(userId),
      texto(payload?.title),
      texto(payload?.mode) || "buy",
      JSON.stringify(payload ?? {}),
    ]
  );

  return listaComparaciones(correo);
}

/**
 * Borra una comparación suya y devuelve la lista que queda.
 *
 * El `user_email` de la condición no es decorativo: sin él, quien adivine un
 * identificador borra la comparación de otro.
 */
async function borraComparacion(email, id) {
  const correo = correoDe(email);
  const cual = texto(id);
  const pool = elPool();
  if (!correo || !cual || !pool) return listaComparaciones(correo);

  await pool.query(
    `DELETE FROM moveadvisor_user_saved_comparisons
      WHERE id = $1 AND lower(user_email) = $2`,
    [cual, correo]
  );
  return listaComparaciones(correo);
}

module.exports = {
  PREFERENCIAS_POR_OMISION,
  leePreferencias,
  guardaPreferencias,
  listaComparaciones,
  guardaComparacion,
  borraComparacion,
};
