"use strict";

/**
 * Informe de estado — espejo de referencia de CarsWise Check.
 *
 * `POST` abre una sesión de captura para un vehículo del usuario y devuelve el
 * enlace que hay que abrir. `GET` lista los expedientes de ese vehículo con su
 * estado al día.
 *
 * Lo que esta tabla NO guarda, y no es un olvido:
 *
 *  - el informe. Vive en `condition_reports` de CarsWise Check, donde un CHECK
 *    impide afirmar un grado mecánico sin verificación física y un enum cerrado
 *    ata cada daño a una pieza. Copiarlo a un JSONB de aquí sería saltarse las
 *    dos cosas.
 *  - los ficheros. Las fotos van directas a R2 desde el navegador, a un prefijo
 *    privado, y lo público es siempre el derivado con matrículas y caras
 *    difuminadas. Aquí no pasa ningún binario ni ninguna URL de original.
 *  - ningún precio. La captura analiza daños; no tasa el coche.
 */

const authHandler = require("../../api/auth");
const { Pool } = require("pg");
const carswiseCheck = require("./carswise-check-client");

/** Estados en los que el enlace de captura sigue sirviendo para algo. */
const ABIERTOS = new Set(["iniciada", "capturando", "subida_completa", "procesando"]);
/** Estados en los que ya no hay nada que consultar. */
const CERRADOS = new Set(["caducada", "anulada"]);

function normalizeText(v) {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
}

let tablaLista = false;
async function ensureTables(pool) {
  if (tablaLista) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_condition_reports (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vehicle_id           VARCHAR(64) NOT NULL REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE,
      capture_vehicle_uuid UUID NOT NULL,
      capture_session_id   UUID NOT NULL UNIQUE,
      capture_url          TEXT NOT NULL DEFAULT '',
      status               VARCHAR(32) NOT NULL DEFAULT 'iniciada',
      created_by_email     VARCHAR(255),
      expires_at           TIMESTAMPTZ,
      status_checked_at    TIMESTAMPTZ,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS ix_moveadvisor_condition_reports_vehicle
       ON moveadvisor_vehicle_condition_reports (vehicle_id, created_at DESC)`
  );
  tablaLista = true;
}

/** El vehículo tiene que ser del usuario de la sesión. */
async function buscarVehiculoPropio(pool, vehicleId, email) {
  const res = await pool.query(
    `SELECT v.id, v.plate, v.mileage, v.vehicle_location,
            v.brand, v.model, v.version, v.year, v.fuel, v.transmission_type
       FROM moveadvisor_user_vehicles v
       LEFT JOIN moveadvisor_users u ON lower(u.email) = $1
      WHERE v.id = $2 AND (lower(v.user_email) = $1 OR v.user_id = u.id)`,
    [email, vehicleId]
  );
  return res.rows[0] || null;
}

function aKilometros(valor) {
  const cifras = normalizeText(valor).replace(/\D/g, "");
  if (!cifras) return null;
  const km = Number.parseInt(cifras, 10);
  return Number.isFinite(km) && km >= 0 && km < 2000000 ? km : null;
}

/** `vehicle_location` es texto libre; solo sirve si lleva un CP de cinco cifras. */
function aCodigoPostal(valor) {
  const encontrado = normalizeText(valor).match(/\b(\d{5})\b/);
  return encontrado ? encontrado[1] : null;
}

/** A dónde se devuelve al usuario, según la pantalla desde la que abrió. */
function urlDeVuelta(origen) {
  const base = normalizeText(process.env.PUBLIC_SITE_URL) || "https://www.carswiseai.com";
  const destino = normalizeText(origen) === "panel" ? "panel" : "idcar";
  return `${base.replace(/\/$/, "")}/?volver=${destino}`;
}

function aFilaPublica(fila) {
  return {
    session_id: fila.capture_session_id,
    status: fila.status,
    // El enlace lleva el token de la sesión: solo se devuelve mientras sirva,
    // y solo a quien acaba de demostrar que el coche es suyo.
    capture_url: ABIERTOS.has(fila.status) ? fila.capture_url : "",
    expires_at: fila.expires_at,
    created_at: fila.created_at,
  };
}

/**
 * Pregunta a CarsWise Check por los expedientes que puedan haber cambiado.
 * Un fallo de red no rompe la respuesta: se devuelve el último estado conocido.
 */
async function refrescarEstados(pool, filas) {
  const pendientes = filas.filter((f) => !CERRADOS.has(f.status));
  if (!pendientes.length || !carswiseCheck.estaConfigurado()) return filas;

  const refrescadas = await Promise.all(
    pendientes.map(async (fila) => {
      const r = await carswiseCheck.leerEstadoDeSesion(fila.capture_session_id);

      let nuevoEstado = null;
      if (r.ok) {
        nuevoEstado = normalizeText(r.datos?.status) || null;
      } else if (r.status === 410) {
        nuevoEstado = r.error === "SESSION_CANCELLED" ? "anulada" : "caducada";
      } else if (r.status === 404) {
        nuevoEstado = "anulada";
      }

      if (!nuevoEstado || nuevoEstado === fila.status) return fila;

      await pool.query(
        `UPDATE moveadvisor_vehicle_condition_reports
            SET status = $2,
                capture_url = CASE WHEN $2 IN ('caducada','anulada') THEN '' ELSE capture_url END,
                status_checked_at = NOW(),
                updated_at = NOW()
          WHERE capture_session_id = $1`,
        [fila.capture_session_id, nuevoEstado]
      ).catch(() => {});

      return { ...fila, status: nuevoEstado };
    })
  );

  const porSesion = new Map(refrescadas.map((f) => [f.capture_session_id, f]));
  return filas.map((f) => porSesion.get(f.capture_session_id) || f);
}

async function listar(pool, vehicleId) {
  const res = await pool.query(
    `SELECT capture_session_id, capture_url, status, expires_at, created_at
       FROM moveadvisor_vehicle_condition_reports
      WHERE vehicle_id = $1
      ORDER BY created_at DESC
      LIMIT 20`,
    [vehicleId]
  );
  return refrescarEstados(pool, res.rows);
}

module.exports = async function conditionReportHandler(req, res) {
  const metodo = String(req.method || "GET").toUpperCase();
  if (metodo !== "GET" && metodo !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const email = normalizeText(sessionPayload?.user?.email).toLowerCase();
  if (!email) return res.status(401).json({ error: "Sesión no válida" });

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const vehicleId = normalizeText(body.vehicleId || req.query?.vehicleId);
  if (!vehicleId) return res.status(400).json({ error: "vehicleId requerido" });

  const pool = getPool();
  try {
    await ensureTables(pool);

    const vehiculo = await buscarVehiculoPropio(pool, vehicleId, email);
    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado o no pertenece a tu cuenta" });
    }

    if (metodo === "GET") {
      /**
       * `?descargar=<session_id>` devuelve el informe en PDF.
       *
       * Va por aquí y no contra CarsWise Check directamente porque el
       * navegador no tiene —ni debe tener— el token de la sesión de captura.
       * La comprobación de que el coche es del usuario ya está hecha arriba,
       * en `buscarVehiculoPropio`, y solo entonces se pide el documento con la
       * clave de servicio.
       */
      const aDescargar = normalizeText(req.query?.descargar);
      if (aDescargar) {
        const suya = await pool.query(
          `SELECT 1 FROM moveadvisor_vehicle_condition_reports
            WHERE capture_session_id = $1 AND vehicle_id = $2`,
          [aDescargar, vehicleId]
        );
        // El expediente tiene que ser de ese coche. Sin esto, el identificador
        // de una sesión ajena descargaría su informe con solo tener un coche.
        if (!suya.rows.length) {
          return res.status(404).json({ error: "Ese informe no es de este vehículo" });
        }

        /**
         * `&modelo=glb|usdz` devuelve el esquema de daños en volumen.
         *
         * Comparte comprobación con el PDF a propósito: es el mismo expediente
         * del mismo coche, y duplicar la puerta es duplicar el sitio donde
         * olvidarse de cerrarla.
         *
         * Se puede cachear un rato, al revés que el PDF: el modelo no lleva
         * nada personal —ni matrícula, ni fotos, ni las medidas del coche
         * real— y los visores de los móviles bajan el fichero entero cada vez
         * que se pulsa el botón.
         */
        const formato = normalizeText(req.query?.modelo).toLowerCase();
        if (formato === "glb" || formato === "usdz") {
          const modelo = await carswiseCheck.descargarModelo3d(aDescargar, formato);
          if (!modelo.ok) {
            console.error("[condition-report] no se pudo traer el modelo:", modelo.status, modelo.error);
            const mensaje =
              modelo.status === 409
                ? "El informe todavía no está terminado."
                : "No se ha podido cargar la vista en 3D. Vuelve a intentarlo.";
            return res.status(modelo.status === 409 ? 409 : 502).json({ error: mensaje });
          }
          res.setHeader("Content-Type", modelo.contentType);
          res.setHeader("Content-Disposition", `inline; filename="coche.${modelo.extension}"`);
          res.setHeader("Cache-Control", "private, max-age=300");
          return res.status(200).send(modelo.bytes);
        }

        const pdf = await carswiseCheck.descargarInformePdf(aDescargar);
        if (!pdf.ok) {
          console.error("[condition-report] no se pudo descargar el PDF:", pdf.status, pdf.error);
          const mensaje =
            pdf.status === 409
              ? "El informe todavía no está terminado."
              : "No se ha podido descargar el informe. Vuelve a intentarlo.";
          return res.status(pdf.status === 409 ? 409 : 502).json({ error: mensaje });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'inline; filename="informe-de-estado.pdf"');
        res.setHeader("Cache-Control", "private, no-store");
        return res.status(200).send(pdf.bytes);
      }

      const filas = await listar(pool, vehicleId);
      return res.status(200).json({ ok: true, informes: filas.map(aFilaPublica) });
    }

    // ── POST: abrir la captura ────────────────────────────────────────────
    if (!carswiseCheck.estaConfigurado()) {
      return res.status(503).json({ error: "La captura guiada no está configurada todavía" });
    }

    // Si ya hay una sesión viva, se continúa esa: crear otra dejaría huérfanas
    // las fotos que el usuario ya hubiera hecho.
    const existentes = await listar(pool, vehicleId);
    const viva = existentes.find((f) => ABIERTOS.has(f.status) && normalizeText(f.capture_url));
    if (viva) {
      return res.status(200).json({
        ok: true,
        reanudada: true,
        ...aFilaPublica(viva),
      });
    }

    const creada = await carswiseCheck.crearSesionDeCaptura({
      vehicleId,
      userId: sessionPayload?.user?.id || null,
      plate: normalizeText(vehiculo.plate).toUpperCase() || null,
      odometerKm: aKilometros(vehiculo.mileage),
      postalCode: aCodigoPostal(vehiculo.vehicle_location),
      // La ficha pública del expediente enseña el coche, y esos datos son de
      // aquí. Se mandan una vez y allí se congelan; `vehicle_location` va
      // entero pero no se publica tal cual: al otro lado se reduce a provincia,
      // porque este campo es texto libre y a veces lleva la dirección.
      // A dónde vuelve el usuario al terminar, según de dónde salió: del IDCar
      // o del panel de vehículos. Sin esto acabaría en una pestaña suelta de
      // otro dominio, sin saber si su expediente ha quedado registrado.
      //
      // El navegador manda de dónde viene, no la dirección: un origen es una
      // palabra de una lista de dos y no puede apuntar a ninguna parte. Dejar
      // que el cliente mande la URL sería regalar una redirección abierta.
      returnUrl: urlDeVuelta(body.origen),
      snapshot: {
        make: normalizeText(vehiculo.brand),
        model: normalizeText(vehiculo.model),
        version: normalizeText(vehiculo.version),
        year: normalizeText(vehiculo.year),
        fuel: normalizeText(vehiculo.fuel),
        gearbox: normalizeText(vehiculo.transmission_type),
        location: normalizeText(vehiculo.vehicle_location),
      },
    });

    if (!creada.ok) {
      console.error("[condition-report] no se pudo abrir la sesión:", creada.error, creada.detail || creada.message || "");
      return res.status(502).json({ error: "No se ha podido abrir la captura. Vuelve a intentarlo." });
    }

    const datos = creada.datos || {};
    await pool.query(
      `INSERT INTO moveadvisor_vehicle_condition_reports
         (vehicle_id, capture_vehicle_uuid, capture_session_id, capture_url,
          status, created_by_email, expires_at, status_checked_at)
       VALUES ($1,$2,$3,$4,'iniciada',$5,$6,NOW())
       ON CONFLICT (capture_session_id) DO NOTHING`,
      [
        vehicleId,
        carswiseCheck.uuidDeVehiculo(vehicleId),
        datos.session_id,
        datos.capture_url || "",
        email,
        datos.expires_at || null,
      ]
    );

    return res.status(201).json({
      ok: true,
      reanudada: false,
      session_id: datos.session_id,
      status: "iniciada",
      capture_url: datos.capture_url || "",
      expires_at: datos.expires_at || null,
    });
  } catch (err) {
    console.error("[condition-report] error:", err?.message);
    return res.status(500).json({ error: "Error al preparar el informe de estado" });
  } finally {
    try { await pool.end(); } catch {}
  }
};
