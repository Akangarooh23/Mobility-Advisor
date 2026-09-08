const { resolveAccount, updateBillingState } = require("../billingStore");
const { resolvePlanById, resolvePlanPriceId, getCheckoutPlansCatalog } = require("../billingCatalog");
const { getMarketPriceSnapshot } = require("../inventoryStore");
const authHandler = require("../../api/auth");
const { MARCA } = require("../marca");
const tasacion = require("../tasacion");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Las etiquetas de daños, tal y como las espera el generador del informe.
 *
 * El navegador manda la clave de traduccion —`sell.damageMinor`— y el PDF
 * quiere el texto. La misma tabla existe en el webhook, que recibe lo mismo por
 * los metadatos de Stripe; se repite porque son dos entradas al mismo sitio y
 * juntarlas obligaria a que el checkout dependiera del webhook.
 */
const ETIQUETA_DE_DANOS = {
  "sell.damageNone": "Sin daños",
  "sell.damageMinor": "Daños leves",
  "sell.damageModerate": "Daños moderados",
  "sell.damageSevere": "Daños graves",
};

/**
 * El vehiculo tal y como lo quiere el generador del informe.
 *
 * El camino de pago lo arma el webhook desde los metadatos de Stripe; el
 * gratuito no pasa por ahi y tiene el cuerpo de la peticion en la mano, asi que
 * lo arma aqui con los mismos nombres de campo. Si se separan, el cliente que
 * paga y el que no reciben informes distintos.
 */
function vehiculoDelCuerpo(body = {}) {
  const numero = (v) => {
    const limpio = normalizeText(String(v ?? "")).replace(/\./g, "").replace(/,/g, ".");
    const n = Number(limpio);
    return Number.isFinite(n) && limpio !== "" ? n : null;
  };
  return {
    brand: normalizeText(body.brand),
    model: normalizeText(body.model),
    version: normalizeText(body.version),
    year: numero(body.year),
    mileage: numero(body.mileage),
    fuel: normalizeText(body.fuel),
    transmission: normalizeText(body.transmission),
    color: normalizeText(body.color),
    owners: normalizeText(String(body.owners ?? "")),
    serviceHistory: normalizeText(body.serviceHistory),
    powerCv: numero(body.powerCv),
    itvStatus: normalizeText(body.itvStatus),
    plate: normalizeText(body.plate),
    damageLevel: ETIQUETA_DE_DANOS[normalizeText(body.damageLevel)] || normalizeText(body.damageLevel) || null,
    damageDescription: normalizeText(body.damageDescription),
    province: normalizeText(body.province),
  };
}

let _checkoutPool = null;
function getCheckoutPool() {
  if (_checkoutPool) return _checkoutPool;
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) return null;
  const { Pool } = require("pg");
  _checkoutPool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  return _checkoutPool;
}

async function checkBillingProfileComplete(email) {
  const pool = getCheckoutPool();
  if (!pool || !email) return { ok: true };
  try {
    const r = await pool.query(
      `SELECT tax_id, billing_street FROM moveadvisor_users WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );
    const row = r.rows[0];
    const missing = [];
    if (!normalizeText(row?.tax_id))        missing.push("NIF/CIF");
    if (!normalizeText(row?.billing_street)) missing.push("dirección");
    return missing.length ? { ok: false, missing } : { ok: true };
  } catch (err) {
    /**
     * Fail-open, y a propósito — pero ya no en silencio.
     *
     * Si la consulta falla, se deja pasar al checkout. Es una decisión
     * defendible: bloquear a alguien que quiere pagar porque la base tuvo un
     * hipo cuesta una venta. El precio es una factura sin NIF ni dirección,
     * que en España es un problema contable.
     *
     * Lo que no era defendible es que ocurriera sin dejar rastro: nadie podría
     * saber nunca cuántas facturas salieron así. El comportamiento se mantiene
     * porque la elección —perder la venta o emitir la factura incompleta— es
     * de negocio, no técnica. Si algún día se prefiere lo contrario, se cambia
     * este `true` por un `false` y ya está.
     */
    console.error("[billing-checkout] no se pudo verificar el perfil de facturacion, se deja pasar:", err?.message);
    return { ok: true, verificado: false };
  }
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

function encodeForm(payload = {}) {
  return new URLSearchParams(payload).toString();
}

function buildStripeCustomerForm(profile = {}, customerEmail = "") {
  const fullName = normalizeText(profile?.fullName);
  const phone = normalizeText(profile?.phone);
  const billingAddress = normalizeText(profile?.billingAddress);
  const taxId = normalizeText(profile?.taxId);
  const company = normalizeText(profile?.company);
  const payload = {
    email: customerEmail,
    name: fullName || customerEmail,
  };

  if (phone) payload.phone = phone;
  if (billingAddress) payload["address[line1]"] = billingAddress;
  if (taxId) payload["metadata[tax_id]"] = taxId;
  if (company) payload["metadata[company]"] = company;

  return payload;
}

async function upsertStripeCustomer({ stripeSecretKey, account = {}, customerEmail = "" }) {
  const existingCustomerId = normalizeText(account?.billing?.stripeCustomerId);
  const customerPayload = buildStripeCustomerForm(account?.profile, customerEmail);
  const targetUrl = existingCustomerId
    ? `https://api.stripe.com/v1/customers/${encodeURIComponent(existingCustomerId)}`
    : "https://api.stripe.com/v1/customers";

  const stripeResponse = await fetch(targetUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm(customerPayload),
  });

  const data = await stripeResponse.json().catch(() => ({}));

  if (!stripeResponse.ok) {
    const detail = normalizeText(data?.error?.message || stripeResponse.statusText);
    throw new Error(detail || "No se pudo preparar el cliente de Stripe.");
  }

  return normalizeText(data?.id);
}

/**
 * Cómo se paga el depósito, según la clave que haya puesta.
 *
 * **En real, solo transferencia.** Son veinte mil euros: no pasan por la tarjeta
 * de un particular, llevarían unos 300 € de comisión —el 10 % de nuestro fee— y
 * una tarjeta se puede disputar meses después, cuando el dinero ya está en
 * Alemania. Una transferencia SEPA no.
 *
 * **En prueba, además, tarjeta.** Porque para recorrer el flujo de punta a punta
 * hace falta poder pagar, y simular la llegada de una transferencia es más
 * incómodo que teclear la 4242. Aquí no hay riesgo: con una clave de prueba no
 * se mueve dinero y no hay comisión que pagar.
 *
 * La distinción sale de la propia clave y no de una variable aparte, para que no
 * se pueda quedar mal puesta: el día que se ponga una clave real, la tarjeta
 * desaparece sola. Y mira `_test_` en cualquier posición porque una clave
 * restringida empieza por `rk_`, no por `sk_`: con el prefijo entero, una
 * `rk_test_` se tomaba por real y dejaba la prueba sin forma de pagar.
 */

/**
 * Dónde se abre la cuenta a la que transfiere.
 *
 * **No es el país del cliente.** Es dónde emite Stripe el IBAN virtual al que
 * manda el dinero, y España no está entre los que puede: «The country provided
 * (ES) is not supported for eu_bank_transfer details». Con `ES` puesto, la
 * sesión no llegaba a abrirse y el cliente veía ese error en inglés después de
 * pulsar «Pagar el depósito ahora».
 *
 * Da igual cuál de los cuatro sea: una transferencia SEPA en euros a un IBAN
 * alemán cuesta y tarda lo mismo que a uno español, y el dinero llega a la
 * misma cuenta de PopCar. Se deja configurable por si Stripe abre España más
 * adelante, pero validado contra la lista: una variable mal puesta volvería a
 * romper el pago, y se rompería en producción y delante del cliente.
 */
const PAISES_DE_TRANSFERENCIA = ["DE", "FR", "IE", "NL"];
function paisDeLaCuenta() {
  const puesto = String(process.env.STRIPE_BANK_TRANSFER_COUNTRY || "").trim().toUpperCase();
  return PAISES_DE_TRANSFERENCIA.includes(puesto) ? puesto : "DE";
}

function formasDePago(stripeSecretKey) {
  const enPruebas = String(stripeSecretKey || "").includes("_test_");
  const transferencia = {
    "payment_method_options[customer_balance][funding_type]": "bank_transfer",
    "payment_method_options[customer_balance][bank_transfer][type]": "eu_bank_transfer",
    "payment_method_options[customer_balance][bank_transfer][eu_bank_transfer][country]": paisDeLaCuenta(),
  };
  if (!enPruebas) {
    return { "payment_method_types[0]": "customer_balance", ...transferencia };
  }
  // La tarjeta primero: en pruebas es la que se va a usar.
  return {
    "payment_method_types[0]": "card",
    "payment_method_types[1]": "customer_balance",
    ...transferencia,
  };
}

// Se exportan para poder probarlas: son las dos decisiones que, mal tomadas,
// dejan al cliente delante de un error de Stripe en inglés.
async function billingCheckoutHandler(req, res) {
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const requestedPlanId = normalizeText(body.planId).toLowerCase();

  // ── Pago único: la fianza de una importación ──────────────────────────────
  //
  // Es el paso que abre todo lo demás: hasta que no está cobrada no se pide el
  // coche a Alemania. Se cobra como la tasación —Checkout de importe libre— con
  // la cifra que se le dijo al pedirlo, que quedó guardada con la solicitud y no
  // se recalcula: si el precio del anuncio ha cambiado, el suyo no.
  //
  // Lo que pasa después lo hace el webhook: marcar la fianza, mover el
  // expediente y emitir la factura. Aquí solo se abre la puerta de pago.
  // `deposito` es el nombre de ahora; `fianza` se sigue aceptando porque es lo
  // que manda cualquier pantalla que no se haya recargado todavia.
  if (requestedPlanId === "deposito" || requestedPlanId === "fianza") {
    const requireSession = String(process.env.AUTH_BILLING_REQUIRE_SESSION || "true").toLowerCase() !== "false";
    const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
    const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
    const customerEmail = sessionEmail || (requireSession ? "" : normalizeText(body.customerEmail).toLowerCase());
    if (!customerEmail) return res.status(401).json({ error: "Inicia sesion para pagar la fianza." });

    const leadId = normalizeText(body.leadId);
    if (!leadId) return res.status(400).json({ error: "Falta la solicitud." });

    const pool = getCheckoutPool();
    if (!pool) return res.status(500).json({ error: "Sin base de datos." });

    // La solicitud tiene que ser suya, de importacion, con fianza y sin pagar.
    // Las cuatro condiciones van en la consulta: si falta una, no hay fila y no
    // hay pago.
    let solicitud;
    try {
      const r = await pool.query(
        `SELECT id, vehicle_title, deposit_quoted, deposit_paid_at, escrow_fee
           FROM moveadvisor_market_leads
          WHERE id = $1 AND lower(user_email) = $2 AND lead_type = 'import'`,
        [leadId, customerEmail]
      );
      solicitud = r.rows[0];
    } catch (e) {
      return res.status(500).json({ error: "No se ha podido leer la solicitud." });
    }
    if (!solicitud) return res.status(404).json({ error: "Esa solicitud de importacion no existe." });
    if (solicitud.deposit_paid_at) return res.status(409).json({ error: "Esa fianza ya esta pagada." });

    const fianza = Math.round(Number(solicitud.deposit_quoted || 0));
    if (!(fianza > 0)) return res.status(409).json({ error: "Esa solicitud no tiene fianza calculada. Llama al equipo." });

    // La factura se emite sola al cobrar, asi que hacen falta sus datos antes.
    const perfil = await checkBillingProfileComplete(customerEmail);
    if (!perfil.ok) {
      return res.status(422).json({
        error: "billing_profile_incomplete",
        missing: perfil.missing,
        message: `Para emitir la factura necesitamos tu perfil completo: faltan ${perfil.missing.join(" y ")}. Ve a Mi cuenta → Perfil.`,
      });
    }

    const stripeSecretKey = normalizeText(process.env.STRIPE_SECRET_KEY);
    const origin = normalizeText(body.origin) || normalizeText(req.headers?.origin) || "";
    // El identificador de la sesión vuelve en la dirección: con él, la pantalla
    // puede preguntarle a Stripe si está pagada sin esperar al webhook.
    const successUrl = `${origin || MARCA.sitioUrl}/panel?fianza=ok&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${origin || MARCA.sitioUrl}/panel?fianza=cancel`;
    // Sin clave no hay pago. Contestar `ok: true` sin dirección dejaba a la
    // pantalla enseñando un aviso genérico y a nadie enterándose de que lo que
    // falta es una variable de entorno.
    if (!stripeSecretKey) {
      console.error("[fianza] STRIPE_SECRET_KEY sin configurar: no se puede cobrar.");
      return res.status(503).json({ error: "El pago con tarjeta no esta disponible ahora mismo. Te llamamos y lo vemos." });
    }

    try {
      const stripeCustomerId = await upsertStripeCustomer({
        stripeSecretKey,
        // La cuenta de verdad, no `{}`: de ahi sale el stripeCustomerId que ya
        // tenga este cliente. Con el objeto vacio no habia ninguno que reutilizar
        // y cada compra creaba un cliente nuevo en Stripe con el mismo correo.
        account: resolveAccount({ userId: normalizeText(sessionPayload?.user?.id), email: customerEmail }),
        customerEmail,
      });
      /**
       * Por transferencia, no con tarjeta.
       *
       * Aqui no se cobra el 30 % de un coche: se deposita **el coche entero y
       * nuestro servicio**, veinte mil euros o mas. Con tarjeta eso no funciona
       * por tres razones, y ninguna es de gusto:
       *
       * - **Limite.** Una tarjeta de particular no pasa veinte mil euros.
       * - **Coste.** Serian unos 315 € de comision, el 10 % de nuestro fee.
       * - **Contracargos.** Una tarjeta se puede disputar meses despues, y para
       *   entonces el dinero ya esta en Alemania. Una transferencia SEPA no.
       *
       * Stripe da un IBAN por cliente y avisa cuando llega el dinero. Eso es lo
       * que nos aporta: **enterarnos solos**, en vez de mirar el banco a mano.
       *
       * Lo que **no** es: una cuenta de deposito de verdad. El dinero entra en la
       * cuenta de PopCar. La garantia que se le da al cliente es que no se le
       * paga al vendedor hasta que hemos visto el coche, y eso se dice asi. El
       * escrow de verdad llega con MangoPay o PayComet.
       */
      const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: encodeForm({
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          ...formasDePago(stripeSecretKey),
          "line_items[0][price_data][currency]": "eur",
          "line_items[0][price_data][unit_amount]": String(fianza * 100),
          "line_items[0][price_data][product_data][name]": `Deposito de importacion · ${normalizeText(solicitud.vehicle_title) || "vehiculo"}`,
          "line_items[0][price_data][product_data][description]": "El coche y el servicio de PopCar. No se le paga al vendedor hasta que hemos visto el coche; si no es el que se anuncio, se devuelve entero.",
          "line_items[0][quantity]": "1",
          customer: stripeCustomerId,
          "metadata[plan_id]": "deposito",
          "metadata[customer_email]": customerEmail,
          "metadata[lead_id]": leadId,
          "metadata[importe]": String(fianza),
          // Lo nuestro de ese deposito. Es lo unico que se factura: el resto es
          // dinero del vendedor aleman que esta de paso.
          "metadata[fee]": String(Math.round(Number(solicitud.escrow_fee || 0))),
        }),
      });
      const data = await stripeResponse.json().catch(() => ({}));
      if (!stripeResponse.ok) return res.status(502).json({ error: normalizeText(data?.error?.message) || "Error al crear la sesion de pago." });
      return res.status(200).json({ ok: true, url: normalizeText(data?.url) });
    } catch (err) {
      return res.status(500).json({ error: err?.message || "Error interno al preparar el pago de la fianza." });
    }
  }

  // One-time payment: vehicle valuation/tasación report
  if (requestedPlanId === "valuation") {
    const requireSession = String(process.env.AUTH_BILLING_REQUIRE_SESSION || "true").toLowerCase() !== "false";
    const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
    const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
    const customerEmail = sessionEmail || (requireSession ? "" : normalizeText(body.customerEmail).toLowerCase());
    if (!customerEmail) return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para solicitar la tasacion." });

    const stripeSecretKey = normalizeText(process.env.STRIPE_SECRET_KEY);
    const priceId = normalizeText(process.env.STRIPE_PRICE_VALUATION);
    const origin = normalizeText(body.origin) || normalizeText(req.headers?.origin) || "";
    const successUrl = `${origin || MARCA.sitioUrl}/vender?tasacion=ok`;
    const cancelUrl = `${origin || MARCA.sitioUrl}/vender?tasacion=cancel`;

    if (!stripeSecretKey || !priceId) {
      return res.status(200).json({ ok: true, simulated: true, message: "Tasacion en modo simulado. Configura STRIPE_SECRET_KEY y STRIPE_PRICE_VALUATION.", url: "" });
    }

    // Pre-flight: billing profile must be complete
    const profileCheck = await checkBillingProfileComplete(customerEmail);
    if (!profileCheck.ok) {
      return res.status(422).json({
        error: "billing_profile_incomplete",
        missing: profileCheck.missing,
        message: `Para emitir la factura necesitas completar tu perfil: faltan ${profileCheck.missing.join(" y ")}. Ve a Mi cuenta → Perfil.`,
      });
    }

    // Pre-flight: verify market data exists before charging
    if (normalizeText(body.brand) && normalizeText(body.model)) {
      try {
        const snapshot = await getMarketPriceSnapshot({
          brand: body.brand, model: body.model, version: body.version,
          fuel: body.fuel, year: body.year ? Number(body.year) : null,
          desiredType: "compra",
        });
        if (!snapshot.comparables && !body.year) {
          return res.status(422).json({ error: "No hay datos de mercado para este vehiculo y no se indico el año. Verifica la marca, modelo y año para poder generar la estimacion." });
        }
      } catch {
        // If the check itself fails, allow checkout to proceed (don't block on infra errors)
      }
    }

    /**
     * La primera es gratis, y gratis significa que no se abre Stripe.
     *
     * No es un descuento del 100 %: una sesion de cero euros Stripe la rechaza,
     * y aunque la aceptara seria mandar al cliente a una pasarela para no
     * cobrarle nada. Se entrega aqui mismo y se responde que va de camino.
     *
     * Va despues de las validaciones de arriba —perfil de facturacion completo
     * y datos de mercado suficientes— a proposito: si el informe no se va a
     * poder generar, mejor decirlo antes de gastarle la gratuita al cliente.
     */
    if (await tasacion.leQuedaLaGratuita(sessionPayload?.user || customerEmail)) {
      try {
        await tasacion.entregar({ email: customerEmail, vehicle: vehiculoDelCuerpo(body), pagada: false });
        return res.status(200).json({
          ok: true,
          gratis: true,
          url: "",
          message: "Tu primera tasacion es gratuita. Te llega por correo en unos minutos.",
        });
      } catch (err) {
        console.error("[valuation] fallo la entrega de la gratuita:", err?.message);
        return res.status(502).json({ error: "No se ha podido preparar tu tasacion. Vuelve a intentarlo." });
      }
    }

    try {
      const stripeCustomerId = await upsertStripeCustomer({
        stripeSecretKey,
        // La cuenta de verdad, no `{}`: de ahi sale el stripeCustomerId que ya
        // tenga este cliente. Con el objeto vacio no habia ninguno que reutilizar
        // y cada compra creaba un cliente nuevo en Stripe con el mismo correo.
        account: resolveAccount({ userId: normalizeText(sessionPayload?.user?.id), email: customerEmail }),
        customerEmail,
      });
      const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: encodeForm({
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          customer: stripeCustomerId,
          "metadata[plan_id]": "valuation",
          "metadata[customer_email]": customerEmail,
          "metadata[veh_brand]":    normalizeText(body.brand).slice(0, 100),
          "metadata[veh_model]":    normalizeText(body.model).slice(0, 100),
          "metadata[veh_version]":  normalizeText(body.version).slice(0, 100),
          "metadata[veh_year]":     normalizeText(String(body.year || "")),
          "metadata[veh_mileage]":  normalizeText(String(body.mileage || "")),
          "metadata[veh_fuel]":         normalizeText(body.fuel).slice(0, 40),
          "metadata[veh_transmission]":    normalizeText(body.transmission).slice(0, 20),
          "metadata[veh_color]":           normalizeText(body.color).slice(0, 30),
          "metadata[veh_owners]":          normalizeText(String(body.owners || "")).slice(0, 5),
          "metadata[veh_service_history]": normalizeText(body.serviceHistory).slice(0, 20),
          "metadata[veh_power_cv]":        normalizeText(String(body.powerCv || "")).slice(0, 8),
          "metadata[veh_itv_status]":      normalizeText(body.itvStatus).slice(0, 10),
          "metadata[veh_plate]":        normalizeText(body.plate).slice(0, 20),
          "metadata[veh_damage]":   normalizeText(body.damageLevel).slice(0, 40),
          "metadata[veh_damage_desc]": normalizeText(body.damageDescription).slice(0, 400),
          "metadata[veh_province]": normalizeText(body.province).slice(0, 80),
        }),
      });
      const data = await stripeResponse.json().catch(() => ({}));
      if (!stripeResponse.ok) return res.status(502).json({ error: normalizeText(data?.error?.message) || "Error al crear sesion de pago." });
      return res.status(200).json({ ok: true, url: normalizeText(data?.url) });
    } catch (err) {
      return res.status(500).json({ error: err?.message || "Error interno al procesar el pago." });
    }
  }

  if (requestedPlanId === "valuation_fleet") {
    const requireSession = String(process.env.AUTH_BILLING_REQUIRE_SESSION || "true").toLowerCase() !== "false";
    const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
    const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
    const customerEmail = sessionEmail || (requireSession ? "" : normalizeText(body.customerEmail).toLowerCase());
    if (!customerEmail) return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para solicitar la tasacion." });

    const vehicles = Array.isArray(body.fleetVehicles) ? body.fleetVehicles : [];
    if (!vehicles.length) return res.status(400).json({ error: "No se han seleccionado vehiculos para tasar." });

    /**
     * El precio vive en lib/tasacion.js, junto al de la tasacion suelta.
     *
     * Estaban en dos sitios y con dos escalas: aqui arrancaba en 10 € y la
     * suelta valia otra cosa, asi que tasar un coche costaba distinto segun por
     * que boton se entrara. Ahora la misma curva y el mismo punto de partida.
     */
    const count = vehicles.length;
    const conGratuita = await tasacion.leQuedaLaGratuita(sessionPayload?.user || customerEmail);
    const cuenta = tasacion.importe({ cuantos: count, conGratuita });
    if (!cuenta) return res.status(400).json({ error: "Para flotas de 100+ vehiculos contacta con nuestro equipo comercial." });
    const unitAmountCents = cuenta.unidadCentimos;
    const totalCents = cuenta.totalCentimos;

    /**
     * Una flota de un solo coche con la gratuita puesta sale a cero.
     *
     * Pasa cuando alguien entra por el boton de flota con un unico vehiculo. Un
     * cargo de cero euros Stripe lo rechaza, asi que se entrega igual que la
     * suelta: es un coche, y el correo de uno solo lleva su PDF adjunto en vez
     * de la tabla resumen de una flota.
     */
    if (cuenta.aCobrar === 0) {
      try {
        await tasacion.entregar({
          email: customerEmail,
          vehicle: vehiculoDelCuerpo(vehicles[0] || {}),
          pagada: false,
        });
        return res.status(200).json({
          ok: true,
          gratis: true,
          url: "",
          message: "Tu primera tasacion es gratuita. Te llega por correo en unos minutos.",
        });
      } catch (err) {
        console.error("[valuation_fleet] fallo la entrega de la gratuita:", err?.message);
        return res.status(502).json({ error: "No se ha podido preparar tu tasacion. Vuelve a intentarlo." });
      }
    }

    const stripeSecretKey = normalizeText(process.env.STRIPE_SECRET_KEY);
    const origin = normalizeText(body.origin) || normalizeText(req.headers?.origin) || "";
    const successUrl = `${origin || MARCA.sitioUrl}/vender?tasacion=ok&fleet=${count}`;
    const cancelUrl  = `${origin || MARCA.sitioUrl}/vender?tasacion=cancel`;

    if (!stripeSecretKey) {
      return res.status(200).json({ ok: true, simulated: true, message: "Flota en modo simulado.", url: "" });
    }

    // Serialize vehicles into chunks of max 480 chars each
    const compact = vehicles.map((v) => ({
      b: String(v.brand   || "").slice(0, 20),
      m: String(v.model   || "").slice(0, 20),
      y: String(v.year    || ""),
      k: String(v.mileage || ""),
      f: String(v.fuel    || "").slice(0, 12),
      p: String(v.plate   || "").slice(0, 10),
      pr: String(v.province || "").slice(0, 20),
    }));
    const fleetJson = JSON.stringify(compact);
    const fleetMeta = {};
    const chunkSize = 480;
    for (let i = 0; i * chunkSize < fleetJson.length; i++) {
      fleetMeta[`metadata[fleet_${i}]`] = fleetJson.slice(i * chunkSize, (i + 1) * chunkSize);
    }
    fleetMeta[`metadata[fleet_chunks]`] = String(Math.ceil(fleetJson.length / chunkSize));

    // Pre-flight: billing profile must be complete
    const profileCheckFleet = await checkBillingProfileComplete(customerEmail);
    if (!profileCheckFleet.ok) {
      return res.status(422).json({
        error: "billing_profile_incomplete",
        missing: profileCheckFleet.missing,
        message: `Para emitir la factura necesitas completar tu perfil: faltan ${profileCheckFleet.missing.join(" y ")}. Ve a Mi cuenta → Perfil.`,
      });
    }

    // Pre-flight: check market data for each vehicle; block if any has no data at all
    const noDataVehicles = [];
    try {
      await Promise.all(vehicles.map(async (v) => {
        if (!normalizeText(v.brand) || !normalizeText(v.model)) return;
        const snap = await getMarketPriceSnapshot({ brand: v.brand, model: v.model, fuel: v.fuel, year: v.year ? Number(v.year) : null, desiredType: "compra" });
        if (!snap.comparables) noDataVehicles.push(`${v.brand} ${v.model}${v.plate ? ` (${v.plate})` : ""}`);
      }));
    } catch { /* infra error — allow checkout */ }
    if (noDataVehicles.length) {
      return res.status(422).json({ error: `Sin datos de mercado para: ${noDataVehicles.join(", ")}. Verifica la marca y modelo.` });
    }

    try {
      const stripeCustomerId = await upsertStripeCustomer({
        stripeSecretKey,
        // La cuenta de verdad, no `{}`: de ahi sale el stripeCustomerId que ya
        // tenga este cliente. Con el objeto vacio no habia ninguno que reutilizar
        // y cada compra creaba un cliente nuevo en Stripe con el mismo correo.
        account: resolveAccount({ userId: normalizeText(sessionPayload?.user?.id), email: customerEmail }),
        customerEmail,
      });
      const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: encodeForm({
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          "line_items[0][price_data][currency]": "eur",
          "line_items[0][price_data][unit_amount]": String(totalCents),
          "line_items[0][price_data][product_data][name]": `Informe de Tasacion de Mercado · ${count} vehiculo${count !== 1 ? "s" : ""}`,
          // La linea dice cuantos se cobran y cuantos van gratis. Poner el total
          // a secas, con la gratuita ya descontada del importe, deja al cliente
          // haciendo la division para entender por que no le cuadra.
          "line_items[0][price_data][product_data][description]": cuenta.gratis
            ? `${count} informes PDF · ${cuenta.gratis} gratuito y ${cuenta.aCobrar} a ${unitAmountCents / 100} €/unidad · Entrega automatica por email`
            : `${count} informes PDF · ${unitAmountCents / 100} €/unidad · Entrega automatica por email`,
          "line_items[0][quantity]": "1",
          customer: stripeCustomerId,
          "metadata[plan_id]": "valuation_fleet",
          "metadata[customer_email]": customerEmail,
          "metadata[fleet_count]": String(count),
          ...fleetMeta,
        }),
      });
      const data = await stripeResponse.json().catch(() => ({}));
      if (!stripeResponse.ok) return res.status(502).json({ error: normalizeText(data?.error?.message) || "Error al crear sesion de pago." });
      return res.status(200).json({ ok: true, url: normalizeText(data?.url) });
    } catch (err) {
      return res.status(500).json({ error: err?.message || "Error interno al procesar el pago de flota." });
    }
  }

  const billingMode = normalizeText(body.billingMode).toLowerCase() === "annual" ? "annual" : "monthly";
  const selectedPlan = resolvePlanById(requestedPlanId);
  const planId = normalizeText(selectedPlan?.id).toLowerCase();
  const planLabel = normalizeText(selectedPlan?.label) || `Plan ${MARCA.nombre}`;
  const priceId = resolvePlanPriceId(planId, billingMode);
  const requireSession = String(process.env.AUTH_BILLING_REQUIRE_SESSION || "true").toLowerCase() !== "false";
  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionUserId = normalizeText(sessionPayload?.user?.id);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  const customerEmail = sessionEmail || (requireSession ? "" : normalizeText(body.customerEmail).toLowerCase());
  const identity = { userId: sessionUserId, email: customerEmail };
  const origin = normalizeText(body.origin) || normalizeText(req.headers?.origin) || "";

  if (!customerEmail) {
    return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para iniciar checkout." });
  }

  const stripeSecretKey = normalizeText(process.env.STRIPE_SECRET_KEY);
  // A dónde vuelve el cliente al salir de la pasarela. La reserva era
  // example.com, el dominio de ejemplo de la IANA: sin cabecera `origin`, quien
  // acabara de pagar aterrizaba ahí. Igual que pasaba en el portal de cliente.
  const successUrl =
    normalizeText(process.env.STRIPE_CHECKOUT_SUCCESS_URL) ||
    `${origin || MARCA.sitioUrl}/panel/cuenta?checkout=ok`;
  const cancelUrl =
    normalizeText(process.env.STRIPE_CHECKOUT_CANCEL_URL) ||
    `${origin || MARCA.sitioUrl}/panel/cuenta?checkout=cancel`;
  const accountSnapshot = resolveAccount(identity);

  if (!selectedPlan) {
    return res.status(400).json({
      error: "Plan no valido para checkout.",
      plans: getCheckoutPlansCatalog(),
    });
  }

  if (!priceId) {
    return res.status(400).json({
      error: "Este plan no tiene precio de Stripe configurado para checkout.",
      planId,
      planLabel,
      plans: getCheckoutPlansCatalog(),
    });
  }

  if (!stripeSecretKey || !priceId) {
    const account = updateBillingState(customerEmail, {
      planId,
      planLabel,
      status: "pendiente",
    });

    return res.status(200).json({
      ok: true,
      simulated: true,
      provider: "stripe",
      message: "Checkout preparado en modo simulado. Configura STRIPE_SECRET_KEY y los precios (BILLING_PLANS_JSON o STRIPE_PRICE_*).",
      url: "",
      account,
      plans: getCheckoutPlansCatalog(),
    });
  }

  try {
    const stripeCustomerId = await upsertStripeCustomer({
      stripeSecretKey,
      account: accountSnapshot,
      customerEmail,
    });

    // Guard against duplicate subscription: check if customer already has an active subscription
    if (planId === "plus") {
      const subsRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=active&limit=1`, {
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      });
      const subsData = await subsRes.json().catch(() => ({}));
      if (Array.isArray(subsData?.data) && subsData.data.length > 0) {
        return res.status(409).json({
          error: "Ya tienes una suscripcion Plus activa. Ve a 'Gestionar metodo de pago' para administrarla.",
          alreadyActive: true,
        });
      }
    }

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encodeForm({
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        customer: stripeCustomerId,
        "metadata[plan_id]": planId,
        "metadata[billing_mode]": billingMode,
      }),
    });

    const data = await stripeResponse.json().catch(() => ({}));

    if (!stripeResponse.ok) {
      const detail = normalizeText(data?.error?.message || stripeResponse.statusText);
      return res.status(502).json({ error: detail || "No se pudo crear la sesion de checkout en Stripe." });
    }

    return res.status(200).json({
      ok: true,
      simulated: false,
      provider: "stripe",
      sessionId: normalizeText(data?.id),
      url: normalizeText(data?.url),
      message: "Checkout de Stripe listo.",
      account: updateBillingState(customerEmail, {
        planId,
        planLabel,
        status: "checkout_abierto",
        stripeCustomerId,
      }),
      plans: getCheckoutPlansCatalog(),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "No se pudo iniciar checkout.",
    });
  }
}

// El manejador sigue siendo la exportación por defecto —así lo llama
// `api/billing.js`— y las dos funciones van colgadas para poder probarlas.
module.exports = billingCheckoutHandler;
module.exports.formasDePago = formasDePago;
module.exports.paisDeLaCuenta = paisDeLaCuenta;
module.exports.PAISES_DE_TRANSFERENCIA = PAISES_DE_TRANSFERENCIA;
