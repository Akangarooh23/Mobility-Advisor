/**
 * El informe de estado de un coche, para el ERP.
 *
 * El ERP sabía **que** el informe existe —lo usa de puerta para publicar y sale
 * en los papeles que faltan de un encargo— pero no había forma de abrirlo desde
 * la ficha del IDCar. Si un cliente llamaba preguntando por su informe, quien
 * cogía el teléfono veía que estaba hecho y no podía verlo.
 *
 * ── Por qué pasa por aquí y no va directo a Check ─────────────────────────
 *
 * El PDF lo tiene PopCar Check y se pide con su clave de servicio. Esa clave
 * podría estar también en el ERP, y entonces habría **dos** sitios desde los
 * que se habla con Check y dos sitios donde rotarla el día que haya que
 * rotarla. Con una sola credencial en un solo sitio, el ERP no se entera de que
 * Check existe: pide el informe de un coche a PopCar, como pide la devolución
 * de una fianza.
 *
 * ── Quién puede llamar ────────────────────────────────────────────────────
 *
 * El secreto compartido entre los dos servicios, el mismo de
 * `fianza-devolucion`. No hay sesión de usuario: quien llama no es una persona
 * con cuenta, es la otra mitad del sistema. Sin secreto configurado no se
 * atiende a nadie —fallar cerrado—, porque lo que hay detrás son las fotos del
 * coche de un cliente.
 */
const { Pool } = require("pg");
const { SSL_POSTGRES } = require("../postgres-ssl");
const popcarCheck = require("./popcar-check-client");

const nt = (v) => String(v ?? "").trim();

/** Los estados en los que ya hay informe que enseñar. */
const LISTO = new Set(["informe_listo", "verificada", "publicada"]);

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!conn) return null;
  _pool = new Pool({ connectionString: conn, ssl: SSL_POSTGRES });
  return _pool;
}

module.exports = async function informeDeEstadoInternoHandler(req, res) {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const secreto = nt(process.env.INTERNAL_API_SECRET);
  if (!secreto) {
    console.error("[informe-interno] INTERNAL_API_SECRET sin configurar: no se atiende.");
    return res.status(503).json({ ok: false, error: "sin_configurar" });
  }
  if (nt(req.headers?.authorization) !== `Bearer ${secreto}`) {
    return res.status(401).json({ ok: false, error: "no_autorizado" });
  }

  const vehicleId = nt(req.query?.vehicleId);
  if (!vehicleId) return res.status(400).json({ ok: false, error: "falta_el_coche" });

  const pool = getPool();
  if (!pool) return res.status(503).json({ ok: false, error: "sin_base_de_datos" });

  let fila;
  try {
    /*
     * El último expediente del coche, no «uno cualquiera».
     *
     * Un coche puede repetir el informe —se rehace cuando cambia algo— y lo que
     * el ERP tiene que enseñar es el vigente. Por fecha de creación descendente,
     * que es el orden en que se emitieron.
     */
    const r = await pool.query(
      `SELECT capture_session_id, status, created_at
         FROM moveadvisor_vehicle_condition_reports
        WHERE vehicle_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [vehicleId]
    );
    fila = r.rows[0];
  } catch (e) {
    console.error("[informe-interno] no se ha podido leer:", e.message);
    return res.status(500).json({ ok: false, error: "no_se_puede_leer" });
  }

  if (!fila) return res.status(404).json({ ok: false, error: "sin_informe" });
  if (!LISTO.has(nt(fila.status))) {
    // No es un fallo: es que todavía no hay documento. El ERP lo dice tal cual
    // en la ficha, que es mejor que un error rojo sobre algo que va a llegar.
    return res.status(409).json({ ok: false, error: "todavia_no_esta", estado: fila.status });
  }

  const pdf = await popcarCheck.descargarInformePdf(fila.capture_session_id);
  if (!pdf.ok) {
    console.error("[informe-interno] Check no da el PDF:", pdf.status, pdf.error);
    return res.status(pdf.status === 409 ? 409 : 502).json({ ok: false, error: "no_se_puede_traer" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="informe-de-estado.pdf"');
  // Sin guardar: lleva las fotos del coche de un cliente.
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).send(pdf.bytes);
};
