"use strict";

/**
 * El cliente sube su mandato firmado desde el panel.
 *
 * Antes se le pedía que contestara al correo con el papel. Entonces el papel se
 * quedaba en una bandeja de entrada y alguien tenía que acordarse de entrar al
 * ERP y marcar a mano la fecha y cómo nos constaba. Mientras eso no pasara, el
 * encargo decía «sin mandato firmado · no se le puede facturar» con el papel
 * firmado ya en nuestro poder.
 *
 * Aquí se sube, se guarda y el encargo se marca solo.
 *
 * ## El orden importa
 *
 * Primero se guarda el fichero, después se marca el encargo. Al revés, un fallo
 * al subir dejaría el encargo firmado sin documento — que es exactamente la
 * situación que esto viene a quitar: decir que hay un papel y no tenerlo.
 */
const { Pool } = require("pg");
const { SSL_POSTGRES } = require("../postgres-ssl");
const { uploadBase64ToSupabase, safeName } = require("../supabaseStorage");
const { identidadDeLaPeticion } = require("./identidad");
const M = require("../mandato-firmado");

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({ connectionString: url, max: 5, ssl: SSL_POSTGRES });
  }
  return _pool;
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") { try { return JSON.parse(body); } catch { return {}; } }
  return body;
}

module.exports = async function mandatoFirmadoHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const { email } = await identidadDeLaPeticion(req, { cuerpo: body });
  if (!email) {
    return res.status(401).json({ ok: false, error: "Inicia sesión para subir el mandato." });
  }

  const encargoId = String(body.encargo_id || "").trim();
  const nombre = safeName(String(body.nombre || "mandato-firmado.pdf"));
  const tipo = String(body.tipo || "").trim().toLowerCase();
  const contenido = String(body.contenido || "");
  if (!encargoId) {
    return res.status(400).json({ ok: false, error: "Falta de qué encargo es." });
  }

  /*
   * El tamaño se mide sobre el base64 antes de subir nada.
   *
   * Cuatro tercios de lo que ocupa el fichero, que es lo que engorda base64:
   * medirlo después de subirlo sería rechazarlo cuando ya está en el almacén.
   */
  const tamano = Math.floor((contenido.length * 3) / 4);
  const porQueNo = M.porQueNoSePuedeSubir({ tipo, tamano, nombre });
  if (porQueNo) return res.status(400).json({ ok: false, error: porQueNo });

  const pool = getPool();
  try {
    // Que sea suyo. El identificador viaja por la red y no prueba nada.
    const suyo = await pool.query(M.SQL_SU_ENCARGO, [encargoId, email]);
    const e = suyo.rows[0];
    if (!e) {
      return res.status(404).json({ ok: false, error: "No encontramos ese encargo." });
    }
    if (e.firmado_at) {
      return res.status(409).json({
        ok: false, error: "ya_estaba_firmado",
        detail: "Ya nos consta firmado. Si quieres cambiar el papel, escríbenos.",
      });
    }

    /*
     * Se guarda la ruta dentro del almacén, no la URL pública.
     *
     * `uploadBase64ToSupabase` devuelve la URL pública, y `erp_documentos.ruta`
     * es lo que el ERP pega detrás de su bucket para bajarse el fichero:
     * guardando la URL entera, la descarga del ERP pedía
     * `.../object/vehicle-files/https://...` y no encontraba nada. Los dos usan
     * el mismo bucket, así que lo que hace falta es el camino.
     */
    const camino = `mandatos/${encargoId}/${Date.now()}-${nombre}`;
    const subido = await uploadBase64ToSupabase(contenido, tipo, camino);
    if (!subido) {
      return res.status(502).json({ ok: false, error: "No hemos podido guardar el archivo. Prueba otra vez." });
    }

    await pool.query(M.SQL_GUARDA_DOCUMENTO, [encargoId, nombre, tipo, camino, tamano, email]);

    /*
     * Y ahora sí, el encargo. Si esto fallara quedaría el documento guardado y
     * el encargo sin marcar — que es el estado de antes, recuperable a mano.
     * Al revés no: un encargo firmado sin papel no se distingue de uno firmado
     * con papel perdido.
     */
    const marca = await pool.query(M.SQL_MARCA_FIRMADO, [
      encargoId, `Subido por ${email}`,
    ]);
    if (!marca.rows.length) {
      // Alguien lo marcó entre medias. El documento ya está guardado, que es lo
      // que hacía falta.
      return res.status(200).json({ ok: true, data: { firmado: true, ya_estaba: true } });
    }

    return res.status(200).json({
      ok: true,
      data: { firmado: true, firmado_at: marca.rows[0].firmado_at, ruta: camino },
    });
  } catch (err) {
    console.error("[mandato-firmado]", err.message);
    return res.status(500).json({ ok: false, error: "No se ha podido subir. Prueba otra vez." });
  }
};
