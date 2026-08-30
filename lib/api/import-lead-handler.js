// Lead de importación: cliente solicita un coche DE desde la ficha pública.
// Guarda el lead en moveadvisor_market_leads (aparece en el panel del ERP) y
// avisa por email (interno + confirmación al cliente) con la fianza del 30%.

const { Pool } = require("pg");
const { MARCA, remitente, respuestaA, correoInterno } = require("../marca");
const { plantilla, parrafo, datos, aviso } = require("../correo");
const { identidadDeLaPeticion } = require("./identidad");

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const connString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connString) return null;
  _pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  return _pool;
}

function norm(v) { return typeof v === "string" ? v.trim() : ""; }
function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function eur(n) { return `${Math.round(Number(n) || 0).toLocaleString("es-ES")} €`; }

async function sendEmails({ name, email, title, price, deposit }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("falta RESEND_API_KEY");
  const from = remitente();
  const internalEmail = process.env.INTERNAL_LEADS_EMAIL || correoInterno();

  const clientHtml = plantilla({
    titulo: "Hemos recibido tu solicitud de importación",
    cuerpo:
      parrafo(`Hola <strong>${esc(name)}</strong>,`) +
      parrafo(`Tu solicitud para importar <strong>${esc(title)}</strong> ha quedado registrada.`) +
      // La fianza es la condición que hay que aceptar para que esto avance: va
      // destacada, no dentro de un párrafo.
      aviso(
        `Reservarlo pide una fianza del 30 %: ${eur(deposit)}`,
        "Te llamamos para explicarte el proceso y confirmar la disponibilidad."
      ),
  });

  const internalHtml = plantilla({
    titulo: "Nueva solicitud de importación",
    cuerpo: datos([
      ["Vehículo", esc(title)],
      ["Precio importado estimado", eur(price)],
      ["Fianza 30 %", eur(deposit)],
      ["Cliente", esc(name)],
      ["Email", `<a href="mailto:${esc(email)}">${esc(email)}</a>`],
    ]),
    pie: "Aviso interno del equipo.",
  });

  // `fetch` no falla con un 400: hay que mirar la respuesta. Si el dominio no
  // está verificado o la clave no vale, Resend contesta 4xx y sin esto
  // parecería que el correo ha salido.
  const manda = async (quien, cuerpo) => {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`Resend ${resp.status} (${quien}): ${err.message || JSON.stringify(err)}`);
    }
  };

  await Promise.all([
    manda("cliente", { from, reply_to: respuestaA(), to: email, subject: `Solicitud de importación — ${title || MARCA.nombre}`, html: clientHtml }),
    manda("interno", { from, to: internalEmail, subject: `Lead de importación — ${title || "sin vehículo"}`, html: internalHtml }),
  ]);
}

/**
 * «Prefiero que me llaméis antes de pagar».
 *
 * La pantalla ya se lo ofrecía por escrito —«también puedes esperar a que te
 * llamemos»— pero no había forma de decirlo: el cliente tenía que quedarse
 * quieto y confiar. Ahora se anota en su solicitud, y quien la atienda lo ve
 * donde mira el resto de lo que ha dicho.
 *
 * No cambia el estado ni la fianza. Es una preferencia, no un paso.
 */
async function pideQueLeLlamen(pool, leadId, email) {
  const MARCA_LLAMADA = "Pide que le llamen antes de pagar";
  const r = await pool.query(
    `UPDATE moveadvisor_market_leads
        SET contact_when = CASE
              WHEN COALESCE(contact_when,'') = '' THEN $3
              WHEN contact_when LIKE '%' || $3 || '%' THEN contact_when
              ELSE contact_when || ' · ' || $3
            END
      WHERE id = $1 AND lower(user_email) = $2 AND lead_type = 'import'
      RETURNING id`,
    [leadId, String(email).toLowerCase(), MARCA_LLAMADA]
  );
  return r.rowCount > 0;
}

module.exports = async function importLeadHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

  const accion  = norm(body.accion);
  const offerId = norm(body.offer_id);
  const name    = norm(body.name);
  const phone   = norm(body.phone);
  const message = norm(body.message).slice(0, 500);

  // Para pedir una importacion hay que haber entrado, y el correo sale de la
  // sesion.
  //
  // Se cogia del cuerpo sin comprobar nada: cualquiera podia pedir una
  // importacion a nombre de otro, y a ese otro le llegaba un correo con una
  // fianza de miles de euros que no ha pedido. Es el mismo agujero que se cerro
  // en las visitas, que estaba abierto aqui. La regla vive en un sitio, en
  // `identidad.js`, para que no dependa de que quien escriba el siguiente
  // endpoint se acuerde.
  const { email } = await identidadDeLaPeticion(req, { cuerpo: { email: body.email } });
  if (!email) {
    return res.status(401).json({ ok: false, error: "Inicia sesión para pedir una importación." });
  }

  // Pedir que le llamen es sobre una solicitud que ya existe: no hace falta
  // oferta, y no se crea nada.
  if (accion === "llamada") {
    const leadId = norm(body.lead_id);
    if (!leadId) return res.status(400).json({ ok: false, error: "Falta la solicitud." });
    const pool = getPool();
    if (!pool) return res.status(500).json({ ok: false, error: "Sin base de datos." });
    const anotado = await pideQueLeLlamen(pool, leadId, email);
    if (!anotado) return res.status(404).json({ ok: false, error: "Esa solicitud no es tuya." });
    return res.status(200).json({ ok: true, anotado: true });
  }

  if (!offerId) return res.status(400).json({ ok: false, error: "offer_id requerido" });
  if (!email.includes("@")) return res.status(400).json({ ok: false, error: "Email inválido" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ ok: false, error: "Sin base de datos" });

  try {
    const offerRes = await pool.query(
      `SELECT title, price::numeric AS price, import_cost
       FROM moveadvisor_market_offers WHERE id = $1 AND country = 'DE' AND import_published = TRUE`,
      [offerId]
    );
    if (!offerRes.rows.length) return res.status(404).json({ ok: false, error: "Oferta de importación no encontrada" });
    const offer = offerRes.rows[0];
    const importPrice = Math.round(Number(offer.price || 0) + Number(offer.import_cost || 0));
    const deposit = Math.round(importPrice * 0.30);
    const title = norm(offer.title);

    const leadId = `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // El teléfono va en su columna, que es donde lo busca quien atiende.
    //
    // Se metía solo dentro de «cuándo», así que en el ERP el campo Teléfono
    // salía vacío y el número quedaba escondido en medio de otra frase. Se
    // sigue dejando también ahí, que es lo que leen las solicitudes ya hechas.
    const contactWhen = [phone ? `Tel: ${phone}` : "", message].filter(Boolean).join(" · ").slice(0, 500);

    /**
     * Si ya tenía una solicitud abierta de este mismo coche, se reutiliza.
     *
     * Volver a la ficha y pedirlo otra vez —porque se cerró el pago, porque se
     * volvió atrás— creaba otro expediente. Tres solicitudes idénticas del
     * mismo coche, tres correos y tres tarjetas en el panel para un coche que
     * se quiere una sola vez.
     *
     * Solo se reutiliza lo que sigue abierto y sin pagar: una fianza ya cobrada
     * es un expediente en marcha, y pedir ese coche otra vez sí sería otra cosa.
     */
    const abierta = await pool.query(
      `SELECT id FROM moveadvisor_market_leads
        WHERE lower(user_email) = $1 AND lead_type = 'import' AND vehicle_id = $2
          AND deposit_paid_at IS NULL
          AND status IN ('Pendiente','Contactado')
        ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase(), offerId]
    );

    if (abierta.rows.length) {
      const yaEstaba = abierta.rows[0].id;
      // Lo último que ha escrito manda: puede haber cambiado el teléfono o la
      // hora a la que quiere que le llamen.
      await pool.query(
        `UPDATE moveadvisor_market_leads
            SET contact_name  = COALESCE(NULLIF($2, ''), contact_name),
                contact_phone = COALESCE(NULLIF($3, ''), contact_phone),
                contact_when  = COALESCE(NULLIF($4, ''), contact_when)
          WHERE id = $1`,
        [yaEstaba, name, phone, contactWhen]
      );
      // Sin correo: el de la primera vez lleva estos mismos datos, y dos
      // confirmaciones seguidas de lo mismo son ruido.
      return res.status(200).json({ ok: true, id: yaEstaba, deposit, correoEnviado: true, yaEstaba: true });
    }
    // La fianza se guarda, no solo se manda.
    //
    // Es lo que se le ha prometido al cliente en el correo. El precio de la
    // oferta puede cambiar despues, o la oferta dejar de estar publicada, y
    // entonces ya no habria forma de saber que numero se le dio. Quien atienda
    // el lead tiene que ver esa cifra, no una recalculada hoy.
    await pool.query(
      `INSERT INTO moveadvisor_market_leads
         (id, user_email, lead_type, vehicle_id, vehicle_title, vehicle_url, portal, contact_name, contact_phone,
          contact_when, deposit_quoted)
       VALUES ($1, $2, 'import', $3, $4, $5, 'importacion', $6, $7, $8, $9)`,
      // La dirección entera, no solo el trozo final: este enlace lo abre
      // quien atiende la solicitud desde el ERP, que vive en otro dominio.
      // Guardado a medias, allí llevaba a una página que no existe.
      [leadId, email, offerId, title, `${MARCA.sitioUrl}/marketplace-vo/${offerId}`, name, phone, contactWhen, deposit]
    );

    // Esperar al correo antes de contestar.
    //
    // Esto corre en una función que se apaga en cuanto responde: un envío
    // lanzado sin esperar puede no llegar a salir nunca. La pantalla dice «te
    // hemos mandado un correo», y no llegaba.
    //
    // Si falla, la solicitud ya está guardada y no se pierde: se contesta que
    // sí, avisando de que el correo no ha salido, y queda en el registro para
    // poder mirarlo.
    let correoEnviado = true;
    try {
      await sendEmails({ name, email, title, price: importPrice, deposit });
    } catch (err) {
      correoEnviado = false;
      console.error("[import-lead] no ha salido el correo:", err?.message);
    }

    return res.status(200).json({ ok: true, id: leadId, deposit, correoEnviado });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Error al registrar la solicitud: " + (err?.message || "") });
  }
};
