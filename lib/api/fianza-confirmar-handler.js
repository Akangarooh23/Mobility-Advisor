/**
 * Confirmar la fianza al volver de Stripe.
 *
 * Hasta ahora una fianza cobrada solo se anotaba si Stripe conseguía avisarnos
 * por el webhook. Eso es un único punto por el que puede pasar todo: si el aviso
 * no llega —no está suscrito el evento, el secreto no coincide, el endpoint está
 * dado de alta en otro modo—, el cliente paga, se le queda el dinero cobrado y
 * en su panel sigue poniendo «pendiente de fianza», con el botón de pagar
 * delante. Es exactamente lo que no puede pasar.
 *
 * Así que se confirma también por el otro lado: al volver del pago, la pantalla
 * trae el identificador de la sesión, aquí se le pregunta a Stripe si está
 * pagada y, si lo está, se anota lo mismo que anotaría el webhook. Lo que llegue
 * primero gana; el segundo no duplica nada porque marcar es idempotente
 * —`COALESCE` sobre la fecha— y la factura se guarda con un identificador fijo,
 * `fia-<solicitud>`.
 *
 * Quien pregunta tiene que haber entrado, y la solicitud de la sesión de pago
 * tiene que ser suya: si no, con un identificador de sesión ajeno se podría dar
 * por pagada la fianza de otro.
 */
const { Pool } = require("pg");
const { identidadDeLaPeticion } = require("./identidad");
const { depositoRecibido } = require("./billing-webhook-handler");

let pool = null;
function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10000 });
  return pool;
}

function nt(v) { return String(v ?? "").trim(); }

module.exports = async function fianzaConfirmarHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const sessionId = nt(body.sessionId || body.session_id);
  if (!sessionId) return res.status(400).json({ ok: false, error: "Falta la sesión de pago." });

  const { email } = await identidadDeLaPeticion(req, { cuerpo: { email: body.email } });
  if (!email) return res.status(401).json({ ok: false, error: "Inicia sesión." });

  const clave = nt(process.env.STRIPE_SECRET_KEY);
  if (!clave) return res.status(500).json({ ok: false, error: "Pagos sin configurar." });

  let sesion;
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${clave}` },
    });
    sesion = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ ok: false, error: nt(sesion?.error?.message) || "Stripe no contesta." });
  } catch (e) {
    return res.status(502).json({ ok: false, error: "No se ha podido comprobar el pago." });
  }

  const meta = sesion?.metadata || {};
  if (nt(meta.plan_id).toLowerCase() !== "fianza") {
    return res.status(400).json({ ok: false, error: "Esa sesión de pago no es de una fianza." });
  }
  // Pagado de verdad. Una sesión abierta y abandonada también existe.
  if (nt(sesion?.payment_status).toLowerCase() !== "paid") {
    return res.status(200).json({ ok: true, pagada: false });
  }

  const leadId = nt(meta.lead_id);
  const pg = getPool();
  if (!leadId || !pg) return res.status(500).json({ ok: false, error: "No se ha podido anotar el pago." });

  // La solicitud tiene que ser de quien pregunta.
  const suya = await pg.query(
    `SELECT id FROM moveadvisor_market_leads WHERE id = $1 AND lower(user_email) = $2 AND lead_type = 'import'`,
    [leadId, email.toLowerCase()]
  );
  if (!suya.rowCount) return res.status(403).json({ ok: false, error: "Esa solicitud no es tuya." });

  /**
   * Con transferencia, volver de la pantalla no significa que haya dinero.
   *
   * Este camino existe porque el aviso de Stripe puede tardar o perderse, y la
   * pantalla pregunta al volver del pago. Con tarjeta eso bastaba. Con una
   * transferencia, volver del pago es haber visto un IBAN: el dinero llega
   * horas o días después.
   */
  if (nt(sesion?.payment_status) !== "paid") {
    return res.status(200).json({ ok: true, pagada: false, esperando: true });
  }

  await depositoRecibido({
    leadId,
    email: nt(sesion?.customer_details?.email || meta.customer_email || email).toLowerCase(),
    importe: Number(meta.importe || 0) || Math.round(Number(sesion?.amount_total || 0) / 100),
    fee: Number(meta.fee || 0) || 0,
    sessionId: nt(sesion?.id),
    cobroRef: nt(sesion?.payment_intent),
  });

  return res.status(200).json({ ok: true, pagada: true });
};
