"use strict";

/**
 * El cliente sube firmada la cláusula del precio desde su panel.
 *
 * Es el mismo camino que el mandato y por el mismo motivo: si se le pidiera que
 * contestara al correo, el papel se quedaría en una bandeja de entrada y alguien
 * tendría que acordarse de entrar al ERP y marcar a mano que aceptó el precio.
 * Mientras eso no pasara, el ERP diría que no lo ha aceptado —y por tanto que
 * paga 150 € si se va— con su firma ya en nuestro poder.
 *
 * Y aquí hay algo más que en el mandato: esa casilla, `acepto_el_precio`, la
 * marcábamos **nosotros**. Era otra vez un dato que el ERP se escribía a sí
 * mismo, que es justo lo que se quitó para la firma del mandato. Ahora la
 * enciende el documento firmado.
 *
 * ## El orden importa
 *
 * Primero se guarda el fichero, después se marca el encargo. Al revés, un fallo
 * al subir dejaría el encargo diciendo que aceptó el precio sin tener el papel —
 * que es exactamente la situación que esto viene a quitar.
 */
const { Pool } = require("pg");
const { SSL_POSTGRES } = require("../postgres-ssl");
const { uploadBase64ToSupabase, safeName, BUCKET_PRIVADO } = require("../supabaseStorage");
const { identidadDeLaPeticion } = require("./identidad");
const C = require("../clausula-del-precio");
const { comoSeLlamaElPapel } = require("../como-se-llama-el-papel");

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

module.exports = async function clausulaPrecioHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const { email } = await identidadDeLaPeticion(req, { cuerpo: body });
  if (!email) {
    return res.status(401).json({ ok: false, error: "Inicia sesión para subir el documento." });
  }

  const encargoId = String(body.encargo_id || "").trim();
  const nombre = safeName(String(body.nombre || "precio-firmado.pdf"));
  const tipo = String(body.tipo || "").trim().toLowerCase();
  const contenido = String(body.contenido || "");
  if (!encargoId) {
    return res.status(400).json({ ok: false, error: "Falta de qué encargo es." });
  }

  // Cuatro tercios de lo que ocupa el fichero, que es lo que engorda base64:
  // medirlo después de subirlo sería rechazarlo cuando ya está en el almacén.
  const tamano = Math.floor((contenido.length * 3) / 4);
  const porQueNo = C.porQueNoSePuedeSubir({ tipo, tamano, nombre });
  if (porQueNo) return res.status(400).json({ ok: false, error: porQueNo });

  const pool = getPool();
  try {
    // Que sea suyo. El identificador viaja por la red y no prueba nada.
    const suyo = await pool.query(C.SQL_SU_ENCARGO, [encargoId, email]);
    const e = suyo.rows[0];
    if (!e) {
      return res.status(404).json({ ok: false, error: "No encontramos ese encargo." });
    }
    if (e.clausula_firmada_at) {
      return res.status(409).json({
        ok: false, error: "ya_estaba_firmada",
        detail: "Ya nos consta que aceptaste el precio. Si quieres cambiarlo, escríbenos.",
      });
    }
    /*
     * Y que toque.
     *
     * Este papel va después del taller. Si llega antes es que alguien guardó un
     * enlace viejo, y aceptar un precio que todavía no se ha fijado es dejarle
     * firmado algo que vamos a tener que cambiar.
     */
    const noToca = C.porQueNoTocaTodavia(e);
    if (noToca) return res.status(409).json({ ok: false, error: noToca });

    const camino = `precio/${encargoId}/${Date.now()}-${nombre}`;
    /*
     * Al cajón privado, como el mandato: lleva su nombre, su matrícula, el
     * precio de su coche y su firma. En el bucket público es alcanzable por
     * quien tenga la dirección.
     */
    const subido = await uploadBase64ToSupabase(contenido, tipo, camino, BUCKET_PRIVADO);
    if (!subido) {
      return res.status(502).json({ ok: false, error: "No hemos podido guardar el archivo. Prueba otra vez." });
    }

    // Con un nombre que se lee, no con el del móvil: en la ficha del encargo,
    // al lado del mandato, «documento (1).pdf» no dice cuál de los dos es.
    const comoSeLlama = comoSeLlamaElPapel(C.PAPEL, e.plate, nombre);
    await pool.query(C.SQL_GUARDA_DOCUMENTO, [encargoId, comoSeLlama, tipo, camino, tamano, email]);

    /*
     * Y ahora el encargo. Si esto fallara quedaría el documento guardado y el
     * encargo sin marcar —recuperable a mano—. Al revés no: un encargo que dice
     * que aceptó el precio sin papel no se distingue de uno con el papel
     * perdido.
     */
    const marca = await pool.query(C.SQL_MARCA_ACEPTADA, [encargoId]);
    if (!marca.rows.length) {
      return res.status(200).json({ ok: true, data: { aceptada: true, ya_estaba: true } });
    }

    /*
     * Y el precio que ha firmado, al coche y al anuncio.
     *
     * Con su `catch`: la firma ya está guardada y es lo que importa. Si esto
     * fallara, el ERP lo pone igual al publicar.
     */
    const firmado = marca.rows[0];
    if (Number(firmado.clausula_precio) > 0 && firmado.vehicle_id) {
      await pool.query(C.SQL_PRECIO_AL_COCHE, [firmado.vehicle_id, String(firmado.clausula_precio)])
        .catch((err) => console.error("[clausula-precio] precio del coche:", err.message));
      await pool.query(C.SQL_PRECIO_AL_ANUNCIO, [firmado.vehicle_id, firmado.clausula_precio])
        .catch((err) => console.error("[clausula-precio] precio del anuncio:", err.message));
    }

    return res.status(200).json({
      ok: true,
      data: {
        aceptada: true,
        firmada_at: marca.rows[0].clausula_firmada_at,
        libre_desde: marca.rows[0].libre_desde,
      },
    });
  } catch (err) {
    console.error("[clausula-precio]", err.message);
    return res.status(500).json({ ok: false, error: "No se ha podido subir. Prueba otra vez." });
  }
};
