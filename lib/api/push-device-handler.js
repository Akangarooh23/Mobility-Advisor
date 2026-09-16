"use strict";

/**
 * Donde la app apunta y desapunta el móvil para recibir avisos.
 *
 * El token lo da Firebase al móvil, no nosotros, y cambia solo: al reinstalar
 * la app, al restaurar una copia de seguridad, o porque a Firebase le da por
 * rotarlo. Por eso la app lo manda cada vez que arranca y aquí se guarda con un
 * `ON CONFLICT`: apuntar el mismo dos veces no cuesta nada y perderse uno
 * nuevo significa que el cliente deja de recibir avisos sin enterarse.
 *
 * Pide sesión. Sin ella, cualquiera podría apuntar su móvil al correo de otro y
 * quedarse escuchando sus avisos.
 */

const authHandler = require("../../api/auth");
const { guardaDispositivo, olvidaDispositivo, estaConfigurado } = require("../avisos-push");

function parseBody(raw) {
  if (raw && typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw || "{}"));
  } catch {
    return {};
  }
}

function texto(v) {
  return typeof v === "string" ? v.trim() : "";
}

module.exports = async function pushDeviceHandler(req, res) {
  const metodo = (req.method || "GET").toUpperCase();

  const session = await authHandler.getSessionUserFromRequest?.(req);
  const correo = (session?.user?.email || "").toLowerCase().trim();
  if (!correo) return res.status(401).json({ error: "Sesión no válida." });

  const body = parseBody(req.body);
  const token = texto(body.token);

  if (metodo === "POST") {
    if (!token) return res.status(400).json({ error: "Falta el token del dispositivo." });
    try {
      await guardaDispositivo(correo, token, texto(body.platform));
      // `configurado` le dice a la app si esto sirve de algo todavía. Mientras
      // no haya credenciales de Firebase el token se guarda igual —así el día
      // que las haya ya están todos apuntados— pero conviene no prometerle al
      // cliente unos avisos que aún no pueden salir.
      return res.status(200).json({ ok: true, configurado: estaConfigurado() });
    } catch (err) {
      console.error("[push-device] no se ha podido guardar:", err?.message);
      return res.status(500).json({ error: "No se ha podido registrar el dispositivo." });
    }
  }

  if (metodo === "DELETE") {
    if (!token) return res.status(400).json({ error: "Falta el token del dispositivo." });
    try {
      await olvidaDispositivo(token);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[push-device] no se ha podido borrar:", err?.message);
      return res.status(500).json({ error: "No se ha podido dar de baja el dispositivo." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
