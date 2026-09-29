/**
 * Las comparaciones que el cliente guarda para volver a ellas.
 *
 * ── Lo que hacía antes ────────────────────────────────────────────────────
 *
 * Iba a `lib/sqlserverMobilityStore.js`, que habla con SQL Server lanzando
 * `sqlcmd.exe`. En Vercel ese binario no existe, así que al leer contestaba
 * **200 con la lista vacía**:
 *
 *     return res.status(200).json({ ok: true, comparisons: [], fallback: true });
 *
 * Y eso es peor que un error. Un error se ve y se reclama; «no tienes nada
 * guardado» se cree, y el cliente deja de intentarlo.
 *
 * Ahora va a Postgres, a `moveadvisor_user_saved_comparisons`, que ya existía
 * con la forma exacta que hacía falta y con cero filas dentro. La respuesta es
 * la misma de antes —`{ ...payload, id, title, mode }`— porque es la que
 * espera `src/hooks/useAppBootstrap.js`.
 */
const {
  listaComparaciones,
  guardaComparacion,
  borraComparacion,
} = require("../preferencias-y-guardados");
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

module.exports = async function userSavedHandler(req, res) {
  const method = normalizeText(req.method).toUpperCase();
  if (!["GET", "POST", "DELETE"].includes(method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // La regla de quién es la petición vive en `identidad.js`, no aquí: manda la
  // sesión y nunca lo que venga en la URL.
  const { email, userId } = await identidadDeLaPeticion(req, { cuerpo: parseBody(req.body) });
  if (!email) {
    return res.status(401).json({ error: "Sesion no valida. Inicia sesion para gestionar comparaciones guardadas." });
  }

  if (method === "GET") {
    const comparisons = await listaComparaciones(email);
    return res.status(200).json({ ok: true, comparisons });
  }

  if (method === "DELETE") {
    const id = normalizeText(req.query?.id);
    if (!id) {
      return res.status(400).json({ error: "Falta el parametro 'id' para eliminar." });
    }

    const comparisons = await borraComparacion(email, id);
    return res.status(200).json({ ok: true, comparisons });
  }

  const body = parseBody(req.body);
  const payload = body.comparison || body;
  const id = normalizeText(payload?.id);
  if (!id) {
    return res.status(400).json({ error: "El payload de la comparacion debe incluir un campo 'id'." });
  }

  const comparisons = await guardaComparacion(email, payload, { userId });
  return res.status(200).json({ ok: true, comparisons });
};
