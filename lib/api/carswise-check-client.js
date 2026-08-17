"use strict";

/**
 * Cliente de servicio contra CarsWise Check (captura.carswiseai.com).
 *
 * Solo se usa desde el servidor: la clave `CARSWISE_CHECK_INTERNAL_KEY` no
 * puede pisar el navegador. El contrato está en docs/INTEGRATION.md del
 * proyecto de captura.
 *
 * Este módulo no guarda informes ni ficheros. El expediente vive en la base de
 * CarsWise Check, donde el esquema impide afirmar mecánica sin verificación
 * física y ata cada daño a una pieza de una lista cerrada. Aquí solo se
 * recuerda que ese coche tiene un expediente y en qué punto va.
 */

const { createHash } = require("crypto");

/**
 * Los vehículos de aquí llevan identificadores tipo `garage-1723456789012`, y
 * CarsWise Check exige UUID. Un UUID v5 sobre este espacio de nombres da
 * siempre el mismo UUID para el mismo coche, sin tabla de correspondencias y
 * sin colisiones entre proyectos.
 */
const NAMESPACE = "3f8a0c2e-6b19-4d7a-9f31-5c2e8b4a17d6";

const TIMEOUT_MS = 8000;

function uuidV5(nombre, namespace) {
  const bytesNs = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1")
    .update(Buffer.concat([bytesNs, Buffer.from(String(nombre), "utf8")]))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // versión 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20),
  ].join("-");
}

function uuidDeVehiculo(vehicleId) {
  return uuidV5(vehicleId, NAMESPACE);
}

function baseUrl() {
  const bruto = process.env.CARSWISE_CHECK_URL || "https://captura.carswiseai.com";
  return String(bruto).replace(/\/+$/, "");
}

function claveInterna() {
  return process.env.CARSWISE_CHECK_INTERNAL_KEY || "";
}

function estaConfigurado() {
  return Boolean(claveInterna());
}

async function peticion(ruta, opciones = {}) {
  if (!estaConfigurado()) {
    return { ok: false, status: 503, error: "capture_not_configured" };
  }

  let respuesta;
  try {
    respuesta = await fetch(`${baseUrl()}${ruta}`, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": claveInterna(),
        ...(opciones.headers || {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, status: 502, error: "capture_unreachable", detail: err?.message };
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    return {
      ok: false,
      status: respuesta.status,
      error: datos?.error?.code || "capture_error",
      message: datos?.error?.message || "",
    };
  }
  return { ok: true, status: respuesta.status, datos };
}

/**
 * Abre una sesión de captura para un vehículo.
 *
 * Manda lo que el perfil tenga: en CarsWise Check solo `vehicle_id` es
 * obligatorio y el resto lo completa el usuario en la primera pantalla,
 * delante del coche.
 */
async function crearSesionDeCaptura({ vehicleId, userId, plate, odometerKm, postalCode }) {
  return peticion("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      vehicle_id: uuidDeVehiculo(vehicleId),
      // El identificador local, además del UUID: con él las fotos y el vídeo
      // se guardan en `vehicles/<id>/inspeccion/...`, la misma carpeta del
      // coche donde ya viven su ficha técnica y sus documentos. Sin esto la
      // carpeta saldría con el UUID y nadie la relacionaría con el vehículo.
      external_vehicle_ref: vehicleId,
      user_id: userId || null,
      plate: plate || null,
      odometer_km: Number.isFinite(odometerKm) ? odometerKm : null,
      postal_code: postalCode || null,
    }),
  });
}

/** Estado de una sesión ya creada. Devuelve solo el estado, nunca material. */
async function leerEstadoDeSesion(sessionId) {
  return peticion(`/api/sessions/${encodeURIComponent(sessionId)}/status`, { method: "GET" });
}

module.exports = {
  uuidDeVehiculo,
  estaConfigurado,
  crearSesionDeCaptura,
  leerEstadoDeSesion,
};
