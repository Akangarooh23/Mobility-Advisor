// Lead de importación: cliente solicita un coche DE desde la ficha pública.
// Guarda el lead en moveadvisor_market_leads (aparece en el panel del ERP) y
// avisa por email (interno + confirmación al cliente) con la fianza del 30%.

const { Pool } = require("pg");
const { MARCA, remitente, respuestaA, correoInterno } = require("../marca");
const { plantilla, parrafo, datos, aviso } = require("../correo");
const { identidadDeLaPeticion } = require("./identidad");
const { precioPuestoAqui, desgloseParaElCliente, FEE_POPCAR } = require("../coste-importacion");
const { loQuePagaAhora } = require("../escrow");
const { precioDeLaElegida, catalogoDeGarantias } = require("../garantias");
const { soloLosQueExisten } = require("../servicios");

/**
 * La columna de los servicios, creada la primera vez que se usa.
 *
 * Es el mismo patrón que el resto del proyecto: nadie corre migraciones a
 * mano. Y así PopCar no depende de que el ERP se haya desplegado antes.
 */
let _columnaServicios = false;
async function preparaServicios(pool) {
  if (_columnaServicios) return;
  await pool.query(`
    ALTER TABLE moveadvisor_market_leads
      ADD COLUMN IF NOT EXISTS servicios JSONB,
      -- El depósito, partido por destino: lo del coche se libera al vendedor
      -- alemán y lo del fee es nuestro. Guardarlo junto obligaría a recalcular
      -- la parte de cada uno el día que haya que soltar el dinero, y para
      -- entonces el fee puede haber cambiado.
      ADD COLUMN IF NOT EXISTS escrow_coche      NUMERIC(10,2),
      ADD COLUMN IF NOT EXISTS escrow_fee        NUMERIC(10,2),
      ADD COLUMN IF NOT EXISTS escrow_garantia   NUMERIC(10,2),
      -- El impuesto va **a cuenta**: es una estimación y se liquida al
      -- matricular. Guardarlo es lo que permite decir después cuánto se puso y
      -- cuánto salió de verdad.
      ADD COLUMN IF NOT EXISTS escrow_impuesto   NUMERIC(10,2),
      ADD COLUMN IF NOT EXISTS escrow_estado     VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      ADD COLUMN IF NOT EXISTS escrow_pagado_at  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS escrow_liberado_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS escrow_devuelto_at TIMESTAMPTZ,
      -- La fecha en que alguien nuestro vio el coche. Sin esto no se libera.
      ADD COLUMN IF NOT EXISTS verificado_alemania_at TIMESTAMPTZ
  `);
  _columnaServicios = true;
}

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

async function sendEmails({ name, email, title, price, deposit, deposito }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("falta RESEND_API_KEY");
  const from = remitente();
  const internalEmail = process.env.INTERNAL_LEADS_EMAIL || correoInterno();

  const clientHtml = plantilla({
    titulo: "Hemos recibido tu solicitud de importación",
    cuerpo:
      parrafo(`Hola <strong>${esc(name)}</strong>,`) +
      parrafo(`Tu solicitud para importar <strong>${esc(title)}</strong> ha quedado registrada.`) +
      // Lo que más tranquiliza de todo esto no es la cifra: es cuándo se
      // suelta. Va destacado, no dentro de un párrafo.
      aviso(
        `El coche y nuestro servicio: ${eur(deposit)} a una cuenta de depósito`,
        "Ese dinero no se mueve hasta que uno de los nuestros ve el coche en Alemania y confirma que es el que se anunció. Si no lo es, vuelve entero."
      ),
  });

  const internalHtml = plantilla({
    titulo: "Nueva solicitud de importación",
    cuerpo: datos([
      ["Vehículo", esc(title)],
      ["Precio puesto aquí (estimado)", eur(price)],
      ["Al depósito", eur(deposit)],
      ["  del coche, al vendedor", eur(deposito ? deposito.coche : 0)],
      ["  del servicio, nuestro", eur(deposito ? deposito.fee : 0)],
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
    // Y que siga viva: sin esa condición se podía pagar un coche vendido en
    // Alemania hacía semanas.
    //
    // El comentario va aquí fuera y no dentro de la consulta. Estuvo dentro con
    // `//`, que en SQL no es un comentario: Postgres contestaba «syntax error at
    // or near "siga"» y no se podía pedir ningún coche.
    const offerRes = await pool.query(
      `SELECT title, price::numeric AS price, import_cost, market_price_es, year, mileage
       FROM moveadvisor_market_offers WHERE id = $1 AND country = 'DE' AND import_published = TRUE
         AND COALESCE(is_active, TRUE) = TRUE`,
      [offerId]
    );
    if (!offerRes.rows.length) return res.status(404).json({ ok: false, error: "Oferta de importación no encontrada" });
    const offer = offerRes.rows[0];
    /**
     * El precio se calcula aquí, no llega en la petición.
     *
     * Es sobre lo que se cobra la fianza. Aceptar el número que mande el
     * navegador sería dejar que el cliente ponga el precio de su propio coche.
     */
    const garantias = await catalogoDeGarantias(pool);
    const elegida = precioDeLaElegida(
      garantias,
      { year: offer.year, mileage: offer.mileage },
      req.body?.garantia_id !== undefined ? (req.body.garantia_id || null) : undefined
    );
    const importPrice = Math.round(
      precioPuestoAqui(offer.price, offer.market_price_es) + (elegida.precio || 0)
    );
    /**
     * Lo que deposita, que no es una fianza.
     *
     * La fianza era del modelo anterior, cuando comprábamos el coche y se lo
     * vendíamos: un 30 % por adelantado para cubrir el compromiso de comprarlo
     * en Alemania. Ahora el coche se lo compra él al concesionario alemán, así
     * que deposita **el coche entero y nuestro fee**, y ese dinero no se mueve
     * hasta que alguien nuestro está delante del coche y lo confirma.
     *
     * El impuesto de matriculación no va aquí: es de Hacienda, se liquida al
     * matricular y su importe exacto no se sabe hasta entonces.
     */
    // El impuesto entra como **provisión**: se cobra lo estimado y se liquida
    // al matricular. Sale del mismo desglose que ve el cliente en la ficha, para
    // que la cifra que se le pide sea exactamente la que se le enseñó.
    const partes = desgloseParaElCliente(offer.price, offer.market_price_es);
    const impuesto = partes.lineas.find((l) => /impuesto/i.test(l.concepto))?.importe || 0;
    const deposito = loQuePagaAhora({
      precioCoche: offer.price,
      fee: FEE_POPCAR,
      impuesto,
      garantia: elegida.precio || 0,
    });
    const deposit = deposito.total;
    // Lo que ha marcado aparte. Lo que llegue y no sea un servicio, fuera.
    const servicios = soloLosQueExisten(req.body?.servicios);
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
      /**
       * Lo último que ha escrito manda.
       *
       * No solo el teléfono y la hora: también **la garantía y donde quiere
       * recibirlo**. Vuelve a la ficha, elige la ampliada a 36 meses, vuelve a
       * pedirlo — y antes se reutilizaba la solicitud de antes con la fianza
       * vieja. Se le enseñaba un precio y se le iba a cobrar el 30 % de otro.
       *
       * La dirección solo se pisa si ha escrito una: si la dejó en blanco aqui
       * y ya había puesto una en su panel, la del panel sigue valiendo.
       */
      await pool.query(
        `UPDATE moveadvisor_market_leads
            SET contact_name  = COALESCE(NULLIF($2, ''), contact_name),
                contact_phone = COALESCE(NULLIF($3, ''), contact_phone),
                contact_when  = COALESCE(NULLIF($4, ''), contact_when),
                deposit_quoted   = $5,
                garantia_id      = $6,
                garantia_precio  = $7,
                entrega_direccion = COALESCE(NULLIF($8, ''),  entrega_direccion),
                entrega_cp        = COALESCE(NULLIF($9, ''),  entrega_cp),
                entrega_ciudad    = COALESCE(NULLIF($10, ''), entrega_ciudad),
                entrega_provincia = COALESCE(NULLIF($11, ''), entrega_provincia),
                servicios         = $12,
                escrow_coche      = $13,
                escrow_fee        = $14,
                escrow_garantia   = $15,
                escrow_impuesto   = $16
          WHERE id = $1`,
        [yaEstaba, name, phone, contactWhen,
         deposit, elegida.id, elegida.precio || 0,
         String(req.body?.entrega_direccion || "").trim(),
         String(req.body?.entrega_cp || "").trim(),
         String(req.body?.entrega_ciudad || "").trim(),
         String(req.body?.entrega_provincia || "").trim(),
         JSON.stringify(servicios),
         deposito.coche, deposito.fee, deposito.garantia, deposito.impuesto]
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
    await preparaServicios(pool).catch(() => {});
    await pool.query(
      `INSERT INTO moveadvisor_market_leads
         (id, user_email, lead_type, vehicle_id, vehicle_title, vehicle_url, portal, contact_name, contact_phone,
          contact_when, deposit_quoted, garantia_id, garantia_precio,
          entrega_direccion, entrega_cp, entrega_ciudad, entrega_provincia, servicios,
          escrow_coche, escrow_fee, escrow_garantia, escrow_impuesto)
       VALUES ($1, $2, 'import', $3, $4, $5, 'importacion', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      // La dirección entera, no solo el trozo final: este enlace lo abre
      // quien atiende la solicitud desde el ERP, que vive en otro dominio.
      // Guardado a medias, allí llevaba a una página que no existe.
      [leadId, email, offerId, title, `${MARCA.sitioUrl}/marketplace-vo/${offerId}`, name, phone, contactWhen, deposit,
       elegida.id, elegida.precio || 0,
       // La direccion entera tal y como la dejo en la ficha.
       //
       // Antes aqui solo se guardaban ciudad y provincia, porque la calle se
       // pedia despues, en su panel. Ya no: la ficha se la pregunta al pedirlo
       // y hasta se la rellena con la que tiene en sus datos. Quedarse con la
       // mitad era hacerle escribirla dos veces, y dejar el viaje de entrega
       // del ERP apuntando a una ciudad sin calle.
       String(req.body?.entrega_direccion || "").trim(),
       String(req.body?.entrega_cp || "").trim(),
       String(req.body?.entrega_ciudad || "").trim(),
       String(req.body?.entrega_provincia || "").trim(),
       JSON.stringify(servicios),
       deposito.coche, deposito.fee, deposito.garantia, deposito.impuesto]
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
      await sendEmails({ name, email, title, price: importPrice, deposit, deposito });
    } catch (err) {
      correoEnviado = false;
      console.error("[import-lead] no ha salido el correo:", err?.message);
    }

    return res.status(200).json({ ok: true, id: leadId, deposit, correoEnviado });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Error al registrar la solicitud: " + (err?.message || "") });
  }
};
