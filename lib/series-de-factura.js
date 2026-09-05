"use strict";

/**
 * Las series de facturación, en un sitio y con su nombre.
 *
 * Estaban repartidas: la de importación escrita a mano en el webhook, la de
 * rectificativas en el manejador de devoluciones, y la de los informes de
 * tasación no era una serie —era el final del identificador de la sesión de
 * Stripe pegado a un año—. Tres sitios y ninguno sabía de los otros.
 *
 * **Hace falta una serie por servicio.** Lo pidió el asesor y la razón es
 * sencilla: una serie tiene que ser correlativa y sin huecos dentro de su año,
 * y eso solo se puede sostener si cada servicio lleva la suya y la pide por el
 * mismo contador.
 *
 * El contador vive en la base, en la misma tabla que usa el ERP, así que da
 * igual quién pida el número: no se pisan.
 */

/**
 * Una serie por servicio, y una para rectificar.
 *
 * Los prefijos son cortos a propósito: se leen por teléfono cuando alguien
 * llama preguntando por una factura.
 */
const SERIES = {
  /** El servicio de importación: nuestro fee. */
  importacion: "SRV",
  /** Los informes de tasación, que se venden sueltos. */
  tasacion: "TAS",
  /**
   * Rectificar una factura ya emitida.
   *
   * Serie propia, que es como lo pide Hacienda y como lo confirmó el asesor.
   * Y **nunca un abono suelto**: lo que corrige una factura es otra factura que
   * dice a cuál corrige y por qué.
   */
  rectificativa: "RECT",
  /**
   * Las fianzas del modelo viejo, cuando PopCar compraba el coche.
   *
   * Ya no se emiten —el modelo no tiene fianzas— pero la serie existe y sus
   * facturas también, así que el prefijo se queda reservado para que nadie lo
   * reutilice para otra cosa.
   */
  fianza: "FIA",
};

/**
 * El siguiente número de una serie, dentro de su año.
 *
 * Se pide con un `INSERT … ON CONFLICT DO UPDATE`, que en Postgres es atómico:
 * dos cobros a la vez no se llevan el mismo número. Un número repetido en una
 * serie no es un fallo cosmético, es una factura inválida.
 */
async function siguienteNumeroDeFactura(pool, serie, hoy = new Date()) {
  const year = hoy.getFullYear();
  const r = await pool.query(
    `INSERT INTO moveadvisor_invoice_counters (series, year, last_n)
     VALUES ($1, $2, 1)
     ON CONFLICT (series, year) DO UPDATE
       SET last_n = moveadvisor_invoice_counters.last_n + 1
     RETURNING last_n`,
    [serie, year]
  );
  const n = r.rows[0]?.last_n || 1;
  return `${serie}-${year}-${String(n).padStart(4, "0")}`;
}

/**
 * Y las columnas donde vive lo que una rectificativa tiene que decir.
 *
 * Nadie corre migraciones a mano en este proyecto: la columna se crea la
 * primera vez que hace falta.
 */
const ENSURE_RECTIFICATIVA = `
  ALTER TABLE moveadvisor_user_invoices
    ADD COLUMN IF NOT EXISTS rectifica_numero TEXT,
    ADD COLUMN IF NOT EXISTS rectifica_fecha  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rectifica_motivo TEXT`;

/**
 * Lo que una rectificativa tiene que llevar escrito.
 *
 * Son tres cosas y las tres las pidió el asesor por su nombre: **a cuál
 * rectifica** —número, serie y fecha—, **por qué**, y el texto «Factura
 * Rectificativa» bien visible en el encabezado.
 *
 * No es un adorno: una rectificativa que no dice a quién corrige no corrige
 * nada, y quien la reciba no puede casarla con la que tiene.
 */
function referenciaALaOriginal({ numero, fecha } = {}) {
  const n = String(numero ?? "").trim();
  if (!n) return "";
  const cuando = fecha ? new Date(fecha) : null;
  const dia = cuando && !Number.isNaN(cuando.getTime())
    ? cuando.toLocaleDateString("es-ES")
    : "";
  return dia
    ? `Rectificación de la factura ${n} de fecha ${dia}`
    : `Rectificación de la factura ${n}`;
}

/** El encabezado que la distingue de un vistazo. */
const TITULO_RECTIFICATIVA = "FACTURA RECTIFICATIVA";

/**
 * Si a esta factura le falta algo para ser una rectificativa en regla.
 *
 * Se contesta con una lista y no con un sí o un no, porque lo que hace falta es
 * decir **qué** falta: una rectificativa a medias se emite igual y el problema
 * aparece meses después.
 */
function faltaParaRectificar(factura = {}) {
  const falta = [];
  if (!String(factura.rectifica_numero ?? "").trim()) falta.push("a qué factura rectifica");
  if (!factura.rectifica_fecha) falta.push("la fecha de la factura original");
  if (!String(factura.rectifica_motivo ?? "").trim()) falta.push("el motivo de la rectificación");
  return falta;
}

module.exports = {
  SERIES,
  siguienteNumeroDeFactura,
  ENSURE_RECTIFICATIVA,
  referenciaALaOriginal,
  TITULO_RECTIFICATIVA,
  faltaParaRectificar,
};
