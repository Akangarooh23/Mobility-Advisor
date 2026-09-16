"use strict";

/**
 * Los avisos que se envían al móvil de un cliente.
 *
 * Lo que la app puede saber sola —que la ITV vence el mes que viene— se lo
 * programa el propio móvil y no pasa por aquí. Esto es para lo otro: que su
 * cita quedó confirmada, que su informe de estado ya está, que alguien ha hecho
 * una oferta por su coche. Cosas que ocurren en el servidor mientras la app
 * está cerrada, y que sin un aviso el cliente solo descubre si entra a mirar.
 *
 * Va por FCM, la mensajería de Firebase, que es el único camino para llegar a
 * un Android. Se usa su API v1, que pide un token de OAuth firmado con la clave
 * de una cuenta de servicio: se firma aquí con `crypto` y no con la librería de
 * Google para no traerse media SDK a una función que manda un POST.
 *
 * **Sin `FIREBASE_SERVICE_ACCOUNT` no se envía nada y no se rompe nada.** Todo
 * lo que llama a esto —crons, avisos de citas— sigue mandando sus correos como
 * siempre; los envíos al móvil sencillamente no salen. Es a propósito: el push
 * es un extra encima del correo, nunca en lugar del correo.
 */

const crypto = require("crypto");
const { Pool } = require("pg");
const { SSL_POSTGRES } = require("./postgres-ssl");

const FCM = "https://fcm.googleapis.com/v1/projects";
const OAUTH = "https://oauth2.googleapis.com/token";
const AMBITO = "https://www.googleapis.com/auth/firebase.messaging";

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL no configurada");
    _pool = new Pool({ connectionString: url, max: 3, ssl: SSL_POSTGRES });
  }
  return _pool;
}

let _tablaLista = false;
async function preparaTabla(pool) {
  if (_tablaLista) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_push_devices (
      token       TEXT        PRIMARY KEY,
      user_email  TEXT        NOT NULL,
      platform    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS moveadvisor_push_devices_email
      ON moveadvisor_push_devices (lower(user_email));
  `);
  _tablaLista = true;
}

function texto(v) {
  return typeof v === "string" ? v.trim() : "";
}

/* ---------- los dispositivos ---------- */

/**
 * Guarda el móvil de un cliente.
 *
 * La clave es el token y no el correo: un mismo cliente puede tener la app en
 * dos móviles y hay que avisar a los dos. Y al revés, un móvil que cambia de
 * dueño —se vende, se presta— reaparece con el mismo token y otro correo, y
 * entonces el `ON CONFLICT` lo reasigna en vez de dejar el aviso yendo a quien
 * ya no es.
 */
async function guardaDispositivo(email, token, plataforma) {
  const correo = texto(email).toLowerCase();
  const t = texto(token);
  if (!correo || !t) return false;

  const pool = getPool();
  await preparaTabla(pool);
  await pool.query(
    `INSERT INTO moveadvisor_push_devices (token, user_email, platform)
          VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE
        SET user_email = EXCLUDED.user_email,
            platform   = EXCLUDED.platform,
            updated_at = NOW()`,
    [t, correo, texto(plataforma) || null]
  );
  return true;
}

/** Al cerrar sesión o al apagar los avisos. */
async function olvidaDispositivo(token) {
  const t = texto(token);
  if (!t) return false;
  const pool = getPool();
  await preparaTabla(pool);
  await pool.query(`DELETE FROM moveadvisor_push_devices WHERE token = $1`, [t]);
  return true;
}

/** Los móviles de estos clientes. */
async function dispositivosDe(correos) {
  const lista = (Array.isArray(correos) ? correos : [correos])
    .map((c) => texto(c).toLowerCase())
    .filter(Boolean);
  if (!lista.length) return [];

  const pool = getPool();
  await preparaTabla(pool);
  const { rows } = await pool.query(
    `SELECT token, user_email FROM moveadvisor_push_devices
      WHERE lower(user_email) = ANY($1::text[])`,
    [lista]
  );
  return rows;
}

/* ---------- Firebase ---------- */

function credenciales() {
  const crudo = texto(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!crudo) return null;
  try {
    // Se admite el JSON tal cual y también en base64: pegar un JSON con saltos
    // de línea en un panel de variables de entorno sale mal más veces de las
    // que sale bien.
    const json = crudo.startsWith("{") ? crudo : Buffer.from(crudo, "base64").toString("utf8");
    const datos = JSON.parse(json);
    if (!datos.client_email || !datos.private_key || !datos.project_id) return null;
    return datos;
  } catch {
    return null;
  }
}

function estaConfigurado() {
  return Boolean(credenciales());
}

let _token = { valor: "", caduca: 0 };

/**
 * El token de acceso de Google, firmando un JWT con la clave de servicio.
 *
 * Dura una hora y se guarda cincuenta minutos: pedir uno nuevo en cada aviso
 * sería una llamada de más por cada notificación, y con varios destinatarios se
 * nota.
 */
async function tokenDeAcceso() {
  const ahora = Math.floor(Date.now() / 1000);
  if (_token.valor && _token.caduca > ahora + 60) return _token.valor;

  const cred = credenciales();
  if (!cred) return "";

  const cabecera = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = base64url(
    JSON.stringify({
      iss: cred.client_email,
      scope: AMBITO,
      aud: OAUTH,
      iat: ahora,
      exp: ahora + 3600,
    })
  );
  const firma = crypto
    .createSign("RSA-SHA256")
    .update(`${cabecera}.${cuerpo}`)
    .sign(cred.private_key.replace(/\\n/g, "\n"));

  const jwt = `${cabecera}.${cuerpo}.${base64url(firma)}`;

  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  const datos = await res.json().catch(() => ({}));
  if (!res.ok || !datos.access_token) {
    console.error("[avisos-push] Google no da token:", datos.error_description || res.status);
    return "";
  }

  _token = { valor: datos.access_token, caduca: ahora + Number(datos.expires_in || 3600) };
  return _token.valor;
}

function base64url(v) {
  return Buffer.from(v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ---------- el envío ---------- */

/**
 * Manda un aviso a todos los móviles de estos clientes.
 *
 * `datos` viaja con la notificación y es lo que la app lee al tocarla para
 * abrir la pantalla que toca en vez de la de inicio; van como texto porque FCM
 * no admite otra cosa ahí.
 *
 * Nunca lanza. Un aviso que no sale no puede tumbar el cron que lo manda ni
 * impedir que salga el correo, que es el canal que de verdad importa.
 */
async function enviaAviso(correos, aviso) {
  const cred = credenciales();
  if (!cred) return { enviados: 0, fallidos: 0, motivo: "sin configurar" };

  let dispositivos = [];
  try {
    dispositivos = await dispositivosDe(correos);
  } catch (err) {
    console.error("[avisos-push] no se han podido leer los dispositivos:", err?.message);
    return { enviados: 0, fallidos: 0, motivo: "error de base" };
  }
  if (!dispositivos.length) return { enviados: 0, fallidos: 0, motivo: "sin dispositivos" };

  const acceso = await tokenDeAcceso();
  if (!acceso) return { enviados: 0, fallidos: dispositivos.length, motivo: "sin token" };

  const datos = {};
  for (const [k, v] of Object.entries(aviso?.datos || {})) datos[k] = String(v ?? "");

  let enviados = 0;
  let fallidos = 0;

  for (const dispositivo of dispositivos) {
    const mensaje = {
      message: {
        token: dispositivo.token,
        notification: { title: texto(aviso?.titulo), body: texto(aviso?.cuerpo) },
        data: datos,
        android: { priority: "high", notification: { default_sound: true } },
      },
    };

    try {
      const res = await fetch(`${FCM}/${cred.project_id}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${acceso}`, "content-type": "application/json" },
        body: JSON.stringify(mensaje),
      });

      if (res.ok) {
        enviados += 1;
        continue;
      }

      fallidos += 1;
      const error = await res.json().catch(() => ({}));
      const codigo = texto(error?.error?.status);

      // Un token muerto —app desinstalada, datos borrados— se borra. Si no, la
      // tabla se llena de móviles que ya no existen y cada aviso se pasa medio
      // minuto llamando a puertas tapiadas.
      if (res.status === 404 || codigo === "NOT_FOUND" || codigo === "UNREGISTERED") {
        await olvidaDispositivo(dispositivo.token).catch(() => {});
      } else {
        console.error("[avisos-push] FCM responde", res.status, codigo);
      }
    } catch (err) {
      fallidos += 1;
      console.error("[avisos-push] no ha salido:", err?.message);
    }
  }

  return { enviados, fallidos };
}

module.exports = {
  guardaDispositivo,
  olvidaDispositivo,
  dispositivosDe,
  enviaAviso,
  estaConfigurado,
  // Se saca fuera para poder comprobar la firma del JWT sin un Firebase de
  // verdad delante: es la pieza que más fácil se tuerce —una clave con los
  // saltos de línea escapados, un `aud` que no es el que espera Google— y el
  // síntoma sería que no llega ningún aviso y nadie sabe por qué.
  tokenDeAcceso,
};
