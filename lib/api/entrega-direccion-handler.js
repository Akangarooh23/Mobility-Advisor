"use strict";

/**
 * Dónde quiere el cliente que le entreguemos el coche.
 *
 * No se pide al solicitarlo a propósito: **el precio no depende de dónde viva**
 * —la entrega en península va incluida— así que preguntarle la dirección antes
 * de dejarle pedir el coche es un campo más entre él y el botón, a cambio de
 * nada. Se pide después, desde su panel, y se puede cambiar tantas veces como
 * quiera mientras el coche no haya salido.
 *
 * Fuera de la península puede haber un recargo. No se calcula aquí ni se
 * inventa: se le dice que se lo confirmamos, porque hoy no hay tarifa de nadie
 * para esos viajes y poner una cifra sería adivinar.
 */

const { Pool } = require("pg");
const { identidadDeLaPeticion } = require("./identidad");

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) return null;
  _pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  return _pool;
}

/**
 * Las provincias donde la entrega no es un viaje por carretera.
 *
 * Un coche a Palma o a Las Palmas se mete en un barco, y eso no lo cubre lo que
 * se le ha cobrado. Se avisa, no se cobra: el importe sale cuando haya tarifa.
 */
const FUERA_DE_PENINSULA = [
  "baleares", "illes balears", "islas baleares",
  "las palmas", "santa cruz de tenerife", "canarias",
  "ceuta", "melilla",
];

function sinAcentos(v) {
  return String(v || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim();
}

/** Si esa provincia lleva recargo por no estar en la península. */
function llevaRecargo(provincia) {
  const p = sinAcentos(provincia);
  if (!p) return false;
  return FUERA_DE_PENINSULA.some((x) => p.includes(x));
}

function nt(v) {
  return typeof v === "string" ? v.trim() : "";
}

module.exports = async function entregaDireccionHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const pool = getPool();
  if (!pool) return res.status(200).json({ ok: false, error: "sin_base_de_datos" });

  const body = req.body || {};
  const leadId = nt(body.lead_id);
  if (!leadId) return res.status(400).json({ ok: false, error: "falta_solicitud" });

  /**
   * Solo el dueño de la solicitud cambia su dirección.
   *
   * Sin esto, con el identificador de una solicitud ajena se le podría cambiar
   * a otro dónde recibe su coche.
   */
  const { email } = await identidadDeLaPeticion(req, { cuerpo: { email: body.email } });
  if (!email) return res.status(401).json({ ok: false, error: "sin_identificar" });

  const direccion = nt(body.direccion);
  const ciudad = nt(body.ciudad);
  const provincia = nt(body.provincia);
  const cp = nt(body.cp);

  if (!direccion || !ciudad) {
    return res.status(400).json({
      ok: false, error: "falta_direccion",
      detail: "Hace falta la calle y la ciudad para poder llevártelo.",
    });
  }

  try {
    const r = await pool.query(
      /**
       * Con la fianza pagada ya no se cambia.
       *
       * Lo que se le cobró incluye llevárselo a donde dijo. Dejarle cambiarlo
       * después sería dejarle pagar un precio de península y pedir la entrega
       * en Palma, que cuesta otra cosa.
       *
       * Va en el WHERE y no en un `if` a propósito: entre leer y escribir cabe
       * un pago, y así la propia consulta no puede escribir sobre una solicitud
       * que se acaba de pagar.
       */
      `UPDATE moveadvisor_market_leads
          SET entrega_direccion = $2, entrega_ciudad = $3,
              entrega_provincia = $4, entrega_cp = $5
        WHERE id = $1 AND lower(user_email) = lower($6)
          AND deposit_paid_at IS NULL
        RETURNING id`,
      [leadId, direccion, ciudad, provincia, cp, email]
    );
    if (!r.rows.length) {
      /**
       * O no es suya, o ya está pagada. Se distingue para poder decírselo: un
       * «no encontrada» delante de una solicitud que tiene abierta es de las
       * cosas que más desconciertan.
       */
      const suya = await pool.query(
        `SELECT deposit_paid_at FROM moveadvisor_market_leads
           WHERE id = $1 AND lower(user_email) = lower($2)`,
        [leadId, email]
      );
      if (suya.rows.length && suya.rows[0].deposit_paid_at) {
        return res.status(409).json({
          ok: false, error: "fianza_pagada",
          detail: "La fianza ya está pagada y la dirección queda fijada. Escríbenos y la cambiamos nosotros.",
        });
      }
      return res.status(404).json({ ok: false, error: "solicitud_no_encontrada" });
    }

    return res.status(200).json({
      ok: true,
      direccion: { direccion, ciudad, provincia, cp },
      // Lo que se le dice, sin cifra: no hay tarifa para esos viajes todavía.
      recargo: llevaRecargo(provincia)
        ? "Fuera de la península la entrega puede llevar un recargo. Te lo confirmamos antes de nada."
        : null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message });
  }
};

module.exports.llevaRecargo = llevaRecargo;
module.exports.FUERA_DE_PENINSULA = FUERA_DE_PENINSULA;
