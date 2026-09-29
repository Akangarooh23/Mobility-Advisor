/**
 * Las preferencias del cliente: idioma, región y qué avisos quiere.
 *
 * ── Lo que hacía antes ────────────────────────────────────────────────────
 *
 * Iba a `lib/sqlserverMobilityStore.js`, que habla con SQL Server lanzando
 * `sqlcmd.exe`. En Vercel ese binario no existe, así que el camino no podía
 * completarse y quedaba esto:
 *
 *     if (!shouldUseSqlServerMobility()) {
 *       if (method === "GET") return res.status(200).json({ ok: true, preferences: null, fallback: true });
 *       return res.status(503).json({ error: "Backend de movilidad no configurado." });
 *     }
 *
 * O sea: al leer, «no tienes preferencias». Al guardar, un 503 en la cara, en
 * una pantalla del panel donde hay un botón que se pulsa
 * (`UserDashboardPreferences`).
 *
 * Ahora va a Postgres, a `moveadvisor_user_preferences`, que ya existía con la
 * forma exacta que hacía falta y con cero filas dentro. La respuesta es la
 * misma que devolvía el camino viejo, para no arreglar esto rompiendo la web.
 */
const { leePreferencias, guardaPreferencias } = require("../preferencias-y-guardados");
const { identidadDeLaPeticion } = require("./identidad");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBody(body) {
  if (body && typeof body === "object") {
    return body;
  }

  try {
    return JSON.parse(String(body || "{}"));
  } catch {
    return {};
  }
}

module.exports = async function userPreferencesHandler(req, res) {
  const method = normalizeText(req.method).toUpperCase();
  if (!["GET", "PUT", "POST"].includes(method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // La regla de quién es la petición vive en `identidad.js`, no aquí: manda la
  // sesión y nunca lo que venga en la URL. De paso trae el identificador, que
  // se guarda junto al correo para poder dejar de mirar el correo algún día.
  const { email, userId } = await identidadDeLaPeticion(req, { cuerpo: parseBody(req.body) });
  if (!email) {
    return res.status(401).json({ error: "Sesion no valida. Inicia sesion para gestionar preferencias." });
  }

  if (method === "GET") {
    const preferences = await leePreferencias(email);
    return res.status(200).json({ ok: true, preferences: preferences || null });
  }

  const body = parseBody(req.body);
  const payload = body.preferences || body;
  const preferences = await guardaPreferencias(email, payload, { userId });
  return res.status(200).json({ ok: true, preferences, message: "Preferencias guardadas correctamente." });
};
