const { Pool } = require("pg");
const { MARCA, COLOR, correoSoporte } = require("../marca");
const { identidadDeLaPeticion } = require("./identidad");

const getPool = (() => {
  let pool;
  return () => {
    if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
    return pool;
  };
})();

function nt(v) { return typeof v === "string" ? v.trim() : String(v ?? "").trim(); }

async function getInvoice(invoiceId, email) {
  const pool = getPool();
  const result = await pool.query(
    // `description` es el concepto que se pinta en el PDF. Sin traerlo, toda
    // factura salia como «Suscripcion PopCar Plus», que es el valor por defecto:
    // una fianza de importacion o un informe de tasacion decian lo que no eran.
    `SELECT i.id, i.number, i.cw_invoice_number, i.date, i.amount, i.status, i.description,
            i.pdf_url, i.cw_pdf_url, i.email,
            u.name, u.apellidos, u.phone, u.tax_id,
            u.billing_street, u.billing_postal_code, u.billing_province
     FROM moveadvisor_user_invoices i
     LEFT JOIN moveadvisor_users u ON lower(u.email) = lower(i.email)
     WHERE (i.id::text = $1 OR i.number = $1 OR i.cw_invoice_number = $1)
       AND lower(i.email) = lower($2)
     LIMIT 1`,
    [invoiceId, email]
  );
  return result.rows[0] || null;
}

function buildPdf(PDFDocument, row) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const invoiceNumber = nt(row.cw_invoice_number || row.number || row.id);
    const date = row.date ? new Date(row.date).toLocaleDateString("es-ES") : "–";
    const amount = Number(row.amount || 0).toFixed(2);
    const status = nt(row.status);
    const clientName = [nt(row.name), nt(row.apellidos)].filter(Boolean).join(" ") || nt(row.email);
    const baseAmount = (Number(amount) / 1.21).toFixed(2);
    const ivaAmount = (Number(amount) - Number(baseAmount)).toFixed(2);

    // ── Header ────────────────────────────────────────────────────────────────
    // El amarillo va de relleno en la barra, no en el texto: sobre papel blanco
    // un logotipo amarillo no se lee, y menos impreso o fotocopiado.
    doc.rect(50, 50, 6, 26).fill(COLOR.amarillo);
    doc.fontSize(22).font("Helvetica-Bold").fillColor(COLOR.negro).text(MARCA.nombre, 66, 50);
    doc.fontSize(9).font("Helvetica").fillColor(COLOR.textoSuave).text([MARCA.sitio, correoSoporte()].filter(Boolean).join(" · "), 66, 76);

    doc.fontSize(22).font("Helvetica-Bold").fillColor(COLOR.texto).text("FACTURA", 400, 50, { align: "right" });
    doc.fontSize(10).font("Helvetica").fillColor(COLOR.textoSuave)
      .text(`Nº: ${invoiceNumber}`, 400, 78, { align: "right" })
      .text(`Fecha: ${date}`, 400, 92, { align: "right" });

    doc.moveTo(50, 115).lineTo(545, 115).strokeColor(COLOR.linea).lineWidth(1).stroke();

    // ── Client block ──────────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor(COLOR.textoTenue).text("FACTURADO A", 50, 130);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(COLOR.texto).text(clientName, 50, 145);
    doc.fontSize(9).font("Helvetica").fillColor(COLOR.textoSuave);
    let lineY = 160;
    if (row.email)           { doc.text(nt(row.email), 50, lineY); lineY += 12; }
    if (row.phone)           { doc.text(nt(row.phone), 50, lineY); lineY += 12; }
    if (row.tax_id)          { doc.text(`NIF/CIF: ${nt(row.tax_id)}`, 50, lineY); lineY += 12; }
    if (row.billing_street)  { doc.text(nt(row.billing_street), 50, lineY); lineY += 12; }
    const locationLine = [nt(row.billing_postal_code), nt(row.billing_province)].filter(Boolean).join(" ");
    if (locationLine)        { doc.text(locationLine, 50, lineY); }

    // ── Items table ───────────────────────────────────────────────────────────
    const tableTop = 250;
    doc.rect(50, tableTop, 495, 24).fill(COLOR.fondoSuave);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(COLOR.textoSuave)
      .text("CONCEPTO", 60, tableTop + 8)
      .text("IMPORTE", 480, tableTop + 8, { align: "right", width: 55 });

    doc.moveTo(50, tableTop + 24).lineTo(545, tableTop + 24).strokeColor(COLOR.linea).stroke();

    const concept = nt(row.description) || `Suscripción ${MARCA.nombre} Plus`;
    doc.fontSize(10).font("Helvetica").fillColor(COLOR.texto)
      .text(concept, 60, tableTop + 34)
      .text(`${baseAmount} EUR`, 480, tableTop + 34, { align: "right", width: 55 });

    doc.moveTo(50, tableTop + 54).lineTo(545, tableTop + 54).strokeColor(COLOR.linea).stroke();

    // ── Totals ────────────────────────────────────────────────────────────────
    const totY = tableTop + 64;
    doc.fontSize(9).font("Helvetica").fillColor(COLOR.textoSuave)
      .text("Base imponible:", 380, totY)
      .text(`${baseAmount} EUR`, 480, totY, { align: "right", width: 55 })
      .text("IVA (21%):", 380, totY + 14)
      .text(`${ivaAmount} EUR`, 480, totY + 14, { align: "right", width: 55 });

    /**
     * Los suplidos, si los hay.
     *
     * Dinero que hemos pagado en nombre del cliente: el coche, que es del
     * concesionario alemán, y el impuesto, que es de Hacienda. Ninguno es
     * ingreso nuestro, así que **van fuera de la base de IVA** y aparte.
     *
     * Sin este bloque, la factura diría 3.630 € al lado de una transferencia de
     * 21.940, y la diferencia no tendría explicación en ningún papel.
     */
    let suplidosY = totY + 30;
    let sumaSuplidos = 0;
    const suplidos = Array.isArray(row.suplidos) ? row.suplidos : [];
    if (suplidos.length) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(COLOR.textoTenue)
        .text("SUPLIDOS", 50, suplidosY);
      doc.fontSize(8).font("Helvetica").fillColor(COLOR.textoSuave)
        .text("Pagados en tu nombre. No son ingreso de PopCar y van fuera de la base imponible.",
              50, suplidosY + 12, { width: 300 });
      suplidosY += 32;
      for (const su of suplidos) {
        const importe = Number(su && su.importe) || 0;
        sumaSuplidos += importe;
        doc.fontSize(9).font("Helvetica").fillColor(COLOR.texto)
          .text(nt(su && su.concepto), 50, suplidosY, { width: 320 })
          .text(`${importe.toFixed(2)} EUR`, 480, suplidosY, { align: "right", width: 55 });
        suplidosY += 14;
      }
      suplidosY += 6;
    }

    doc.rect(370, totY + 30, 175, 22).fill(COLOR.amarillo);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(COLOR.negro)
      .text("TOTAL FACTURA:", 380, totY + 36)
      .text(`${amount} EUR`, 480, totY + 36, { align: "right", width: 55 });

    // Y lo que ha transferido de verdad, si hay suplidos: la factura son 3.630
    // y el ingreso 21.940, y sin esta línea esa diferencia no cuadra en ningún
    // papel.
    if (sumaSuplidos) {
      doc.fontSize(9).font("Helvetica").fillColor(COLOR.textoSuave)
        .text("Total pagado (factura + suplidos):", 300, totY + 58)
        .text(`${(Number(amount) + sumaSuplidos).toFixed(2)} EUR`, 480, totY + 58, { align: "right", width: 55 });
    }

    // ── Status ────────────────────────────────────────────────────────────────
    const paid = status === "paid" || status === "pagada";
    doc.fontSize(10).font("Helvetica-Bold").fillColor(paid ? COLOR.negro : COLOR.amarilloTexto)
      .text(paid ? "PAGADA" : status.toUpperCase(), 60, totY + 78);

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.moveTo(50, 750).lineTo(545, 750).strokeColor(COLOR.linea).stroke();
    doc.fontSize(8).font("Helvetica").fillColor(COLOR.textoTenue)
      .text(`${MARCA.razonSocial} · Este documento tiene validez de factura.`, 50, 758, { align: "center", width: 495 });

    doc.end();
  });
}

/**
 * Trae el PDF guardado y lo entrega por esta ruta.
 *
 * Con la clave de servicio, no por la direccion publica: asi funciona igual
 * cuando el almacen deje de ser publico, que es a donde hay que ir.
 *
 * Devuelve false si no se ha podido, para que quien llama genere el PDF de
 * nuevo en vez de dejar al cliente sin su factura.
 */
async function sirveElGuardado(url, res, row) {
  const clave = process.env.SUPABASE_SERVICE_KEY || "";
  try {
    // La direccion publica y la privada son la misma quitando `/public`: se pide
    // siempre la privada, que es la que sigue valiendo si el cubo se cierra.
    const directa = url.replace("/object/public/", "/object/");
    // Las dos cabeceras: la clave nueva de Supabase (sb_secret_…) no es un JWT y
    // solo la acepta por `apikey`; una antigua sigue valiendo por Authorization.
    const cabeceras = clave ? { apikey: clave, Authorization: `Bearer ${clave}` } : undefined;
    const r = await fetch(directa, cabeceras ? { headers: cabeceras } : undefined);
    if (!r.ok) return false;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) return false;
    const numero = nt(row.cw_invoice_number || row.number || row.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="factura-${numero}.pdf"`);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(buf);
    return true;
  } catch (e) {
    console.error("[factura] no se ha podido traer el PDF guardado:", e.message);
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const invoiceId = nt(req.query.id);
  if (!invoiceId) return res.status(400).json({ error: "id required" });

  // El correo sale de la sesión, no de la URL.
  //
  // Antes bastaba con el numero de factura y el correo, y los numeros no
  // siempre son impredecibles —hay `SUBS-2026-0001`—, asi que con el correo de
  // alguien se le podia sacar una factura con su nombre, su telefono, su NIF y
  // su direccion. La consulta sigue filtrando por correo, que es lo que impide
  // ver la factura de otro aun teniendo sesion propia.
  const { email } = await identidadDeLaPeticion(req);
  if (!email) {
    return res.status(401).json({ error: "Sesion no valida. Inicia sesion para ver tus facturas." });
  }

  let row;
  try {
    row = await getInvoice(invoiceId, email);
  } catch (err) {
    return res.status(500).json({ error: "db_error", detail: err.message });
  }
  if (!row) return res.status(404).json({ error: "invoice_not_found" });

  // El PDF guardado se sirve desde aqui, no se manda al cliente a su
  // direccion de almacenamiento.
  //
  // Antes esto era un `redirect` a la URL publica del fichero. La sesion
  // protegia la consulta y el fichero no: quien tuviera el enlace lo abria sin
  // ser nadie, y las rutas llevan el numero de factura dentro, que va seguido.
  // Ahora se descarga aqui, con la clave del servidor, y sale por esta ruta,
  // que si mira quien pregunta.
  //
  // A un enlace de fuera —Stripe, con su testigo largo y aleatorio— si se le
  // manda: ese fichero no es nuestro y su direccion ya es la llave.
  const guardado = nt(row.cw_pdf_url || row.pdf_url);
  if (guardado) {
    const nuestro = guardado.includes("/storage/v1/object/");
    if (!nuestro) return res.redirect(302, guardado);
    const servido = await sirveElGuardado(guardado, res, row);
    if (servido) return;
    // Si no se ha podido traer, se genera de nuevo mas abajo: el cliente
    // tiene que poder descargar su factura aunque el almacen falle.
  }

  let PDFDocument;
  try {
    PDFDocument = require("pdfkit");
  } catch {
    return res.status(500).json({ error: "pdf_library_unavailable" });
  }

  let pdfBuffer;
  try {
    pdfBuffer = await buildPdf(PDFDocument, row);
  } catch (err) {
    return res.status(500).json({ error: "pdf_generation_failed", detail: err.message });
  }

  const invoiceNumber = nt(row.cw_invoice_number || row.number || row.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="factura-${invoiceNumber}.pdf"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  res.setHeader("Cache-Control", "private, no-store");
  res.end(pdfBuffer);
};
