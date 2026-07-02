'use strict';

const { Pool } = require('pg');

// ─── DB ───────────────────────────────────────────────────────────────────────
let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL not set');
    _pool = new Pool({ connectionString: url, max: 5, ssl: { rejectUnauthorized: false } });
  }
  return _pool;
}

// ─── Tables (lazy creation) ───────────────────────────────────────────────────
let _tablesReady = false;
async function ensureTables(pool) {
  if (_tablesReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pre_clientes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone TEXT NOT NULL UNIQUE,
      name TEXT, email TEXT,
      gdpr_consent BOOLEAN NOT NULL DEFAULT FALSE,
      gdpr_consent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone TEXT NOT NULL UNIQUE,
      flow TEXT NOT NULL DEFAULT 'general',
      step TEXT NOT NULL DEFAULT 'start',
      context JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone TEXT NOT NULL,
      pre_cliente_id UUID REFERENCES pre_clientes(id),
      user_email TEXT,
      tipo TEXT NOT NULL,
      sub_tipo TEXT,
      sub_fuente TEXT,
      oferta_id TEXT,
      criterios JSONB NOT NULL DEFAULT '{}',
      prioridad TEXT NOT NULL DEFAULT 'normal',
      estado TEXT NOT NULL DEFAULT 'nuevo',
      transcript JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  _tablesReady = true;
}

// ─── Meta Cloud API: send message ────────────────────────────────────────────
async function sendWhatsApp(to, text, phoneNumberId) {
  const token = process.env.META_WA_TOKEN;
  if (!token || !phoneNumberId) return;
  await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text, preview_url: false }
    })
  }).catch(() => {});
}

// ─── Session helpers ──────────────────────────────────────────────────────────
async function getSession(pool, phone) {
  const r = await pool.query('SELECT * FROM whatsapp_sessions WHERE phone = $1', [phone]);
  return r.rows[0] || null;
}
async function saveSession(pool, phone, flow, step, ctx) {
  await pool.query(`
    INSERT INTO whatsapp_sessions (phone, flow, step, context)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (phone) DO UPDATE
      SET flow=$2, step=$3, context=$4, updated_at=NOW()
  `, [phone, flow, step, JSON.stringify(ctx)]);
}

// ─── User identification ──────────────────────────────────────────────────────
async function identifyByPhone(pool, phone) {
  const digits = phone.replace(/\D/g, '');

  const pc = await pool.query(
    `SELECT id, name, email FROM pre_clientes
     WHERE regexp_replace(phone,'\\D','','g') = $1 LIMIT 1`,
    [digits]
  ).catch(() => ({ rows: [] }));
  if (pc.rows.length) {
    return { type: 'pre_cliente', id: pc.rows[0].id, name: pc.rows[0].name, email: pc.rows[0].email };
  }

  const ml = await pool.query(
    `SELECT contact_name, user_email FROM moveadvisor_market_leads
     WHERE regexp_replace(contact_phone,'\\D','','g') = $1
     ORDER BY created_at DESC LIMIT 1`,
    [digits]
  ).catch(() => ({ rows: [] }));
  if (ml.rows.length) {
    return { type: 'known_lead', id: null, name: ml.rows[0].contact_name, email: ml.rows[0].user_email };
  }

  return { type: 'unknown', id: null, name: null, email: null };
}

// ─── Pre-client registration ──────────────────────────────────────────────────
async function createPreCliente(pool, phone, name, email) {
  const r = await pool.query(`
    INSERT INTO pre_clientes (phone, name, email, gdpr_consent, gdpr_consent_at)
    VALUES ($1,$2,$3,TRUE,NOW())
    ON CONFLICT (phone) DO UPDATE
      SET name=$2, email=$3, gdpr_consent=TRUE, gdpr_consent_at=NOW(), updated_at=NOW()
    RETURNING id
  `, [phone, name, email]);
  return r.rows[0].id;
}

// ─── Offer search ─────────────────────────────────────────────────────────────
async function findOffer(pool, ref) {
  const clean = ref.trim();
  const byId = await pool.query(
    `SELECT id, brand, model, year, price, mileage
     FROM moveadvisor_marketplace_vo_offers
     WHERE id = $1 AND status != 'deleted' LIMIT 1`,
    [clean]
  ).catch(() => ({ rows: [] }));
  if (byId.rows.length) return byId.rows[0];

  const tokens = clean.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (!tokens.length) return null;
  const tsq = tokens.map(t => t + ':*').join(' & ');
  const byText = await pool.query(
    `SELECT id, brand, model, year, price, mileage
     FROM moveadvisor_marketplace_vo_offers
     WHERE status != 'deleted'
       AND to_tsvector('spanish', coalesce(brand,'') || ' ' || coalesce(model,'') || ' ' || coalesce(description,''))
           @@ to_tsquery('spanish', $1)
     ORDER BY created_at DESC LIMIT 1`,
    [tsq]
  ).catch(() => ({ rows: [] }));
  return byText.rows[0] || null;
}

// ─── Lead save ────────────────────────────────────────────────────────────────
async function saveLead(pool, { phone, preClienteId, userEmail, tipo, subTipo, subFuente, ofertaId, criterios, prioridad, transcript }) {
  await pool.query(`
    INSERT INTO whatsapp_leads
      (phone, pre_cliente_id, user_email, tipo, sub_tipo, sub_fuente, oferta_id, criterios, prioridad, transcript)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `, [phone, preClienteId || null, userEmail || null, tipo, subTipo || null, subFuente || null, ofertaId || null,
      JSON.stringify(criterios || {}), prioridad || 'normal', JSON.stringify(transcript || [])]);
}

// ─── Ops notification ─────────────────────────────────────────────────────────
async function notifyOps(subject, lines) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const ops = process.env.OPS_EMAIL || 'anapicazokangaroo@gmail.com';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: 'CarsWise Bot <bot@carswiseai.com>',
      to: [ops],
      subject,
      html: `<pre style="font-family:sans-serif;font-size:14px">${lines.join('\n')}</pre>`
    })
  }).catch(() => {});
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SOURCE_MENU =
  '¿Dónde viste este vehículo?\n\n' +
  '1️⃣ Coches.net\n2️⃣ AutoScout24\n3️⃣ Wallapop / Milanuncios\n4️⃣ Motor.es\n5️⃣ Otro portal';

const SOURCES = { '1': 'coches.net', '2': 'autoscout24', '3': 'wallapop', '4': 'motor.es', '5': 'otro portal' };

const ACTION_MENU =
  '¿Qué necesitas?\n\n' +
  '1️⃣ Más fotos o detalles\n2️⃣ Financiación\n3️⃣ Solicitar visita\n4️⃣ Reservar / señal\n5️⃣ Hablar con un asesor';

const ACTION_TYPES = { '1': 'FOTOS', '2': 'FINANCIACION', '3': 'VISITA', '4': 'RESERVA', '5': 'ASESOR' };

const MAIN_MENU =
  '¿En qué te puedo ayudar?\n\n' +
  '1️⃣ Comprar un vehículo\n2️⃣ Renting\n3️⃣ Vender / tasar mi vehículo\n4️⃣ Servicios\n5️⃣ Gestión en curso\n6️⃣ Otra consulta';

const PHONE = process.env.CARSWISE_PHONE || '';

function actionReply(tipo, offerTitle, ofertaId) {
  const t   = offerTitle || 'el vehículo';
  const url = ofertaId ? `https://www.carswiseai.com/marketplace-vo/${ofertaId}` : 'https://www.carswiseai.com';
  return {
    FOTOS:        `Solicitamos las fotos adicionales de *${t}* a nuestro equipo. Te las enviaremos en breve 📸`,
    FINANCIACION: `Nuestro equipo de financiación te contactará en menos de 24h con una propuesta personalizada 💳`,
    VISITA:       `Puedes reservar tu visita aquí:\n${url}\n\nO nuestro equipo te llamará para coordinarla 📅`,
    RESERVA:      `Para reservar *${t}* un asesor te contactará en menos de 2 horas 🚨${PHONE ? '\nTambién puedes llamar al ' + PHONE : ''}`,
    ASESOR:       `Nuestro equipo te contactará en breve para ayudarte con tu consulta sobre *${t}* 💬`,
  }[tipo] || '';
}

// ─── State machine ────────────────────────────────────────────────────────────
async function processStep(pool, session, phone, body, transcript) {
  const ctx  = { ...(session.context || {}) };
  const { step, flow } = session;
  const lo   = body.toLowerCase().trim();
  const firstName = (ctx.name || '').split(' ')[0];

  // ── Pre-registration ───────────────────────────────────────────────────────
  if (step === 'pre_reg_name') {
    if (body.length < 2) return { step, ctx, reply: 'Por favor, dime tu nombre completo.' };
    ctx.name = body.trim();
    return { step: 'pre_reg_email', ctx, reply: `Encantado, ${ctx.name.split(' ')[0]} 👋\n¿Y tu email de contacto?` };
  }

  if (step === 'pre_reg_email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body)) {
      return { step, ctx, reply: 'No parece un email válido. ¿Puedes escribirlo de nuevo?' };
    }
    ctx.email = body.trim();
    return {
      step: 'pre_reg_consent',
      ctx,
      reply:
        'Antes de continuar, CarsWise tratará tus datos (nombre, email, teléfono) para gestionar tu consulta según el RGPD.\n\n' +
        '¿Aceptas? Responde *SÍ* o *NO*.\n\nhttps://www.carswiseai.com/politica-privacidad'
    };
  }

  if (step === 'pre_reg_consent') {
    if (!/^s[ií]?$|^yes$|^acepto$/i.test(lo)) {
      return {
        step: 'rejected',
        ctx,
        reply: 'Sin tu consentimiento no puedo continuar. Para consultas escríbenos a hola@carswiseai.com.\n¡Hasta pronto! 👋'
      };
    }
    const pcId = await createPreCliente(pool, phone, ctx.name, ctx.email);
    ctx.preClienteId = pcId;
    if (flow === 'vo') {
      return {
        step: 'vo_offer_ref',
        ctx,
        reply: `Perfecto, ${ctx.name.split(' ')[0]} 🙌\n\n¿Cuál es el vehículo que te interesa? Dame la referencia del anuncio o descríbemelo (marca, modelo, año).`
      };
    }
    return { step: 'menu', ctx, reply: `Perfecto, ${ctx.name.split(' ')[0]} 🙌\n\n${MAIN_MENU}` };
  }

  // ── Main menu ──────────────────────────────────────────────────────────────
  if (step === 'menu') {
    if (lo === '1') return { step: 'buy_has_ref',       ctx, reply: '¿Tienes ya un vehículo concreto en mente?\n\n1️⃣ Sí, tengo una referencia o anuncio\n2️⃣ No, estoy buscando' };
    if (lo === '2') return { step: 'renting_has_offer', ctx, reply: '¿Tienes una oferta de renting concreta?\n\n1️⃣ Sí, tengo referencia\n2️⃣ Quiero información general' };
    if (lo === '3') return { step: 'sell',              ctx, reply: '¿Ya tienes cuenta en CarsWise?\n\n1️⃣ Sí, tengo cuenta\n2️⃣ No, soy nuevo' };
    if (lo === '4') return { step: 'service_type',      ctx, reply: '¿Sobre qué servicio?\n\n1️⃣ Taller / mantenimiento\n2️⃣ Seguro de vehículo\n3️⃣ Garantía\n4️⃣ Tramitación / transferencia\n5️⃣ Otro' };
    if (lo === '5') return { step: 'incident_ref',      ctx, reply: '¿Tienes un número de referencia de tu gestión? Escríbelo o responde *NO* si no lo tienes.' };
    if (lo === '6') return { step: 'other_desc',        ctx, reply: '¿En qué te puedo ayudar? Cuéntamelo en un mensaje.' };
    return { step, ctx, reply: `Elige una opción del menú:\n\n${MAIN_MENU}` };
  }

  // ── VO + Buy shared: ref → source → action ─────────────────────────────────
  if (step === 'vo_offer_ref' || step === 'buy_offer_ref') {
    ctx.offerRef = body.trim();
    return { step: step === 'vo_offer_ref' ? 'vo_source' : 'buy_source', ctx, reply: SOURCE_MENU };
  }

  if (step === 'vo_source' || step === 'buy_source') {
    ctx.subFuente = SOURCES[lo] || body.trim();
    const offer   = await findOffer(pool, ctx.offerRef);
    if (offer) {
      ctx.ofertaId   = offer.id;
      ctx.offerTitle = [offer.brand, offer.model, offer.year].filter(Boolean).join(' ');
      const price    = offer.price ? offer.price.toLocaleString('es-ES') + ' €' : 'precio a consultar';
      const km       = offer.mileage ? ' · ' + offer.mileage.toLocaleString('es-ES') + ' km' : '';
      return {
        step: step === 'vo_source' ? 'vo_action' : 'buy_action',
        ctx,
        reply: `He encontrado: *${ctx.offerTitle}*\n💰 ${price}${km}\n\n${ACTION_MENU}`
      };
    }
    ctx.ofertaId   = null;
    ctx.offerTitle = ctx.offerRef;
    return {
      step: step === 'vo_source' ? 'vo_action' : 'buy_action',
      ctx,
      reply: `Recibido, buscaré información sobre "${ctx.offerRef}".\n\n${ACTION_MENU}`
    };
  }

  if (step === 'vo_action' || step === 'buy_action') {
    const tipo = ACTION_TYPES[lo];
    if (!tipo) return { step, ctx, reply: `Elige una opción:\n\n${ACTION_MENU}` };
    ctx.tipo = tipo;
    await saveLead(pool, {
      phone, preClienteId: ctx.preClienteId, userEmail: ctx.userEmail,
      tipo, subFuente: ctx.subFuente, ofertaId: ctx.ofertaId,
      prioridad: tipo === 'RESERVA' ? 'alta' : 'normal', transcript
    });
    if (['RESERVA', 'ASESOR', 'FOTOS'].includes(tipo)) {
      await notifyOps(`[WhatsApp Bot] ${tipo} — ${ctx.offerTitle || ctx.offerRef}`, [
        `Teléfono: ${phone}`, `Nombre: ${ctx.name || '—'}`, `Email: ${ctx.email || '—'}`,
        `Vehículo: ${ctx.offerTitle || ctx.offerRef}`, `Fuente: ${ctx.subFuente || '—'}`,
        `Acción: ${tipo}`, `Oferta ID: ${ctx.ofertaId || 'no encontrado en BD'}`
      ]);
    }
    return {
      step: 'done',
      ctx,
      reply: `${actionReply(tipo, ctx.offerTitle, ctx.ofertaId)}\n\n¿Hay algo más en lo que pueda ayudarte? *SÍ* / *NO*`
    };
  }

  // ── Buy: search ────────────────────────────────────────────────────────────
  if (step === 'buy_has_ref') {
    if (lo === '1') return { step: 'buy_offer_ref',    ctx, reply: '¿Cuál es la referencia o descripción del vehículo?' };
    if (lo === '2') return { step: 'buy_search_brand', ctx, reply: '¿Qué marca y modelo te interesa? (o escribe "cualquiera")' };
    return { step, ctx, reply: '1️⃣ Tengo una referencia   2️⃣ Estoy buscando' };
  }
  if (step === 'buy_search_brand') {
    ctx.criterios = { brand: body.trim() };
    return { step: 'buy_search_budget', ctx, reply: '¿Cuál es tu presupuesto máximo?' };
  }
  if (step === 'buy_search_budget') {
    ctx.criterios = { ...ctx.criterios, budget: body.trim() };
    await saveLead(pool, { phone, preClienteId: ctx.preClienteId, userEmail: ctx.userEmail, tipo: 'BUSQUEDA', subFuente: 'carswiseai.com', criterios: ctx.criterios, transcript });
    await notifyOps('[WhatsApp Bot] BÚSQUEDA', [`Teléfono: ${phone}`, `Nombre: ${ctx.name || '—'}`, `Marca: ${ctx.criterios.brand}`, `Presupuesto: ${ctx.criterios.budget}`]);
    return { step: 'done', ctx, reply: `He registrado tu búsqueda de *${ctx.criterios.brand}* hasta *${ctx.criterios.budget}*.\nTe avisaremos cuando tengamos algo que encaje 🔔\n\n¿Algo más? *SÍ* / *NO*` };
  }

  // ── Renting ────────────────────────────────────────────────────────────────
  if (step === 'renting_has_offer') {
    if (lo === '1') return { step: 'renting_offer_ref', ctx, reply: '¿Cuál es la referencia de la oferta de renting?' };
    if (lo === '2') {
      await saveLead(pool, { phone, preClienteId: ctx.preClienteId, userEmail: ctx.userEmail, tipo: 'RENTING', subFuente: 'whatsapp', transcript });
      await notifyOps('[WhatsApp Bot] RENTING (info general)', [`Teléfono: ${phone}`, `Nombre: ${ctx.name || '—'}`]);
      return { step: 'done', ctx, reply: 'Nuestro equipo de renting te contactará para ofrecerte las mejores opciones 🚗\n\n¿Algo más? *SÍ* / *NO*' };
    }
    return { step, ctx, reply: '1️⃣ Tengo oferta concreta   2️⃣ Información general' };
  }
  if (step === 'renting_offer_ref') {
    ctx.offerRef = body.trim();
    await saveLead(pool, { phone, preClienteId: ctx.preClienteId, userEmail: ctx.userEmail, tipo: 'RENTING', subFuente: 'whatsapp', ofertaId: body.trim(), transcript });
    await notifyOps('[WhatsApp Bot] RENTING (oferta concreta)', [`Teléfono: ${phone}`, `Nombre: ${ctx.name || '—'}`, `Referencia: ${body}`]);
    return { step: 'done', ctx, reply: 'Nuestro equipo te contactará para resolver tu consulta de renting 🚗\n\n¿Algo más? *SÍ* / *NO*' };
  }

  // ── Sell / Tasación ────────────────────────────────────────────────────────
  if (step === 'sell') {
    if (lo === '1') return { step: 'done', ctx, reply: 'Puedes publicar tu vehículo desde tu cuenta en:\nhttps://www.carswiseai.com\n\nSi necesitas ayuda escríbeme y un asesor te guía.' };
    if (lo === '2') return { step: 'tasacion_plate', ctx, reply: '¿Cuál es la matrícula de tu vehículo?' };
    return { step, ctx, reply: '1️⃣ Tengo cuenta en CarsWise   2️⃣ Soy nuevo' };
  }
  if (step === 'tasacion_plate') {
    ctx.criterios = { plate: body.trim().toUpperCase() };
    return { step: 'tasacion_brand', ctx, reply: '¿Marca y modelo?' };
  }
  if (step === 'tasacion_brand') {
    ctx.criterios = { ...ctx.criterios, brandModel: body.trim() };
    return { step: 'tasacion_km', ctx, reply: '¿Kilómetros aproximados?' };
  }
  if (step === 'tasacion_km') {
    ctx.criterios = { ...ctx.criterios, km: body.trim() };
    await saveLead(pool, { phone, preClienteId: ctx.preClienteId, userEmail: ctx.userEmail, tipo: 'TASACION', subFuente: 'whatsapp', criterios: ctx.criterios, transcript });
    await notifyOps('[WhatsApp Bot] TASACIÓN', [`Teléfono: ${phone}`, `Nombre: ${ctx.name || '—'}`, `Matrícula: ${ctx.criterios.plate}`, `Vehículo: ${ctx.criterios.brandModel}`, `Km: ${ctx.criterios.km}`]);
    return { step: 'done', ctx, reply: 'Perfecto. Nuestro equipo de tasación te contactará en menos de 24h con una valoración 💰\n\n¿Algo más? *SÍ* / *NO*' };
  }

  // ── Services ───────────────────────────────────────────────────────────────
  const SERVICE_TYPES = { '1': 'TALLER', '2': 'SEGURO', '3': 'GARANTIA', '4': 'TRAMITACION', '5': 'OTRO' };
  if (step === 'service_type') {
    const st = SERVICE_TYPES[lo];
    if (!st) return { step, ctx, reply: '1️⃣ Taller / mantenimiento\n2️⃣ Seguro\n3️⃣ Garantía\n4️⃣ Tramitación\n5️⃣ Otro' };
    ctx.subTipo = st;
    return { step: 'service_desc', ctx, reply: 'Cuéntame brevemente qué necesitas.' };
  }
  if (step === 'service_desc') {
    await saveLead(pool, { phone, preClienteId: ctx.preClienteId, userEmail: ctx.userEmail, tipo: 'SERVICIO', subTipo: ctx.subTipo, criterios: { description: body }, transcript });
    await notifyOps(`[WhatsApp Bot] SERVICIO — ${ctx.subTipo}`, [`Teléfono: ${phone}`, `Nombre: ${ctx.name || '—'}`, `Descripción: ${body}`]);
    return { step: 'done', ctx, reply: 'Recibido. Nuestro equipo te contactará en breve 🔧\n\n¿Algo más? *SÍ* / *NO*' };
  }

  // ── Incident ───────────────────────────────────────────────────────────────
  if (step === 'incident_ref') {
    const hasRef = !/^no$/i.test(lo) && body.trim().length > 2;
    if (hasRef) {
      ctx.incidentRef = body.trim();
      const byRef = await pool.query(
        `SELECT status FROM moveadvisor_market_leads WHERE id = $1 LIMIT 1`,
        [ctx.incidentRef]
      ).catch(() => ({ rows: [] }));
      if (byRef.rows.length) {
        return { step: 'done', ctx, reply: `Estado de tu gestión *${ctx.incidentRef}*: *${byRef.rows[0].status}*\n\n¿Necesitas algo más? *SÍ* / *NO*` };
      }
    }
    return { step: 'incident_desc', ctx, reply: '¿En qué consiste la gestión? Cuéntamelo y lo escalamos a nuestro equipo.' };
  }
  if (step === 'incident_desc') {
    await saveLead(pool, { phone, preClienteId: ctx.preClienteId, userEmail: ctx.userEmail, tipo: 'INCIDENCIA', criterios: { description: body, ref: ctx.incidentRef }, transcript });
    await notifyOps('[WhatsApp Bot] INCIDENCIA', [`Teléfono: ${phone}`, `Nombre: ${ctx.name || '—'}`, `Ref: ${ctx.incidentRef || '—'}`, `Descripción: ${body}`]);
    return { step: 'done', ctx, reply: 'Escalado al equipo. Te contactarán lo antes posible 🔔\n\n¿Algo más? *SÍ* / *NO*' };
  }

  // ── Other ──────────────────────────────────────────────────────────────────
  if (step === 'other_desc') {
    await saveLead(pool, { phone, preClienteId: ctx.preClienteId, userEmail: ctx.userEmail, tipo: 'OTRA', criterios: { description: body }, transcript });
    await notifyOps('[WhatsApp Bot] OTRA CONSULTA', [`Teléfono: ${phone}`, `Nombre: ${ctx.name || '—'}`, `Mensaje: ${body}`]);
    return { step: 'done', ctx, reply: 'Recibido, nuestro equipo te contactará en breve 💬\n\n¿Algo más? *SÍ* / *NO*' };
  }

  // ── Done / restart ─────────────────────────────────────────────────────────
  if (step === 'done' || step === 'rejected') {
    if (/^s[ií]?$|^yes$/i.test(lo)) {
      if (flow === 'vo') return { step: 'vo_offer_ref', ctx, reply: '¿Sobre qué vehículo te puedo ayudar? Dame la referencia o descripción.' };
      return { step: 'menu', ctx, reply: `¿En qué más te puedo ayudar?\n\n${MAIN_MENU}` };
    }
    return { step: 'done', ctx, reply: `Perfecto${firstName ? ', ' + firstName : ''} 👋 ¡Hasta pronto!` };
  }

  return { step, ctx, reply: 'No te he entendido. Por favor elige una opción.' };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
module.exports = async function whatsappHandler(req, res) {

  // ── GET: Meta webhook verification ────────────────────────────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.META_WA_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  // ── Parse Meta JSON payload ────────────────────────────────────────────────
  const entry   = req.body?.entry?.[0];
  const change  = entry?.changes?.[0]?.value;
  const message = change?.messages?.[0];

  // ACK immediately — Meta requires a fast 200
  res.status(200).json({ status: 'ok' });

  // Ignore non-text messages and status updates (delivered, read, etc.)
  if (!message || message.type !== 'text') return;

  const from        = message.from;          // e.g. "34612345678"
  const body        = message.text?.body?.trim() || '';
  const phoneNumId  = change?.metadata?.phone_number_id || '';

  if (!from || !body) return;

  // Determine flow from which number received the message
  const voPhoneId = process.env.META_WA_PHONE_ID_VO || '';
  const flow      = (voPhoneId && phoneNumId === voPhoneId) ? 'vo' : 'general';

  // Which phone number ID to send FROM (use the same one that received the message)
  const sendFromId = phoneNumId || process.env.META_WA_PHONE_ID_GENERAL || '';

  try {
    const pool = getPool();
    await ensureTables(pool);

    let session = await getSession(pool, from);

    if (!session) {
      const userInfo = await identifyByPhone(pool, from);
      const ctx = {};
      if (userInfo.type === 'pre_cliente') {
        ctx.preClienteId = userInfo.id;
        ctx.name         = userInfo.name;
        ctx.email        = userInfo.email;
      } else if (userInfo.type === 'known_lead') {
        ctx.name      = userInfo.name;
        ctx.userEmail = userInfo.email;
      }

      let step, greeting;
      if (userInfo.type === 'unknown') {
        step     = 'pre_reg_name';
        greeting = flow === 'vo'
          ? 'Hola 👋 Soy el asistente de CarsWise. Veo que estás interesado en uno de nuestros vehículos.\n\nPara poder ayudarte, ¿cómo te llamas?'
          : 'Hola 👋 Soy el asistente de CarsWise.\n\nPara poder ayudarte, ¿cómo te llamas?';
      } else {
        const fn = (userInfo.name || '').split(' ')[0];
        if (flow === 'vo') {
          step     = 'vo_offer_ref';
          greeting = `¡Hola${fn ? ', ' + fn : ''}! 👋 ¿Cuál es el vehículo que te interesa? Dame la referencia o descríbemelo.`;
        } else {
          step     = 'menu';
          greeting = `¡Hola${fn ? ', ' + fn : ''}! 👋\n\n${MAIN_MENU}`;
        }
      }

      await saveSession(pool, from, flow, step, ctx);
      await sendWhatsApp(from, greeting, sendFromId);
      return;
    }

    // Advance state machine
    const transcript = [
      ...((session.context?.transcript || []).slice(-18)),
      { role: 'user', text: body, ts: new Date().toISOString() }
    ];

    const result = await processStep(pool, session, from, body, transcript);

    transcript.push({ role: 'bot', text: result.reply, ts: new Date().toISOString() });
    result.ctx.transcript = transcript.slice(-20);

    await saveSession(pool, from, session.flow, result.step, result.ctx);
    await sendWhatsApp(from, result.reply, sendFromId);

  } catch (err) {
    console.error('[whatsapp-handler]', err);
    await sendWhatsApp(from, 'Ha ocurrido un error. Por favor inténtalo de nuevo o contáctanos en hola@carswiseai.com', sendFromId).catch(() => {});
  }
};
