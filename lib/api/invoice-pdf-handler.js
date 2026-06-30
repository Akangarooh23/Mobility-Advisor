const { Pool } = require("pg");

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
    `SELECT i.id, i.number, i.cw_invoice_number, i.date, i.amount, i.status,
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
    doc.fontSize(22).font("Helvetica-Bold").fillColor("#1e40af").text("CarsWise", 50, 50);
    doc.fontSize(9).font("Helvetica").fillColor("#64748b").text("www.carswiseai.com · hola@carswiseai.com", 50, 76);

    doc.fontSize(22).font("Helvetica-Bold").fillColor("#0f172a").text("FACTURA", 400, 50, { align: "right" });
    doc.fontSize(10).font("Helvetica").fillColor("#475569")
      .text(`Nº: ${invoiceNumber}`, 400, 78, { align: "right" })
      .text(`Fecha: ${date}`, 400, 92, { align: "right" });

    doc.moveTo(50, 115).lineTo(545, 115).strokeColor("#e2e8f0").lineWidth(1).stroke();

    // ── Client block ──────────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#94a3b8").text("FACTURADO A", 50, 130);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text(clientName, 50, 145);
    doc.fontSize(9).font("Helvetica").fillColor("#475569");
    let lineY = 160;
    if (row.email)           { doc.text(nt(row.email), 50, lineY); lineY += 12; }
    if (row.phone)           { doc.text(nt(row.phone), 50, lineY); lineY += 12; }
    if (row.tax_id)          { doc.text(`NIF/CIF: ${nt(row.tax_id)}`, 50, lineY); lineY += 12; }
    if (row.billing_street)  { doc.text(nt(row.billing_street), 50, lineY); lineY += 12; }
    const locationLine = [nt(row.billing_postal_code), nt(row.billing_province)].filter(Boolean).join(" ");
    if (locationLine)        { doc.text(locationLine, 50, lineY); }

    // ── Items table ───────────────────────────────────────────────────────────
    const tableTop = 250;
    doc.rect(50, tableTop, 495, 24).fill("#f8fafc");
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#475569")
      .text("CONCEPTO", 60, tableTop + 8)
      .text("IMPORTE", 480, tableTop + 8, { align: "right", width: 55 });

    doc.moveTo(50, tableTop + 24).lineTo(545, tableTop + 24).strokeColor("#e2e8f0").stroke();

    const concept = nt(row.description) || "Suscripción CarsWise Plus";
    doc.fontSize(10).font("Helvetica").fillColor("#0f172a")
      .text(concept, 60, tableTop + 34)
      .text(`${baseAmount} EUR`, 480, tableTop + 34, { align: "right", width: 55 });

    doc.moveTo(50, tableTop + 54).lineTo(545, tableTop + 54).strokeColor("#e2e8f0").stroke();

    // ── Totals ────────────────────────────────────────────────────────────────
    const totY = tableTop + 64;
    doc.fontSize(9).font("Helvetica").fillColor("#475569")
      .text("Base imponible:", 380, totY)
      .text(`${baseAmount} EUR`, 480, totY, { align: "right", width: 55 })
      .text("IVA (21%):", 380, totY + 14)
      .text(`${ivaAmount} EUR`, 480, totY + 14, { align: "right", width: 55 });

    doc.rect(370, totY + 30, 175, 22).fill("#1e40af");
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#ffffff")
      .text("TOTAL:", 380, totY + 36)
      .text(`${amount} EUR`, 480, totY + 36, { align: "right", width: 55 });

    // ── Status ────────────────────────────────────────────────────────────────
    const paid = status === "paid" || status === "pagada";
    doc.fontSize(10).font("Helvetica-Bold").fillColor(paid ? "#16a34a" : "#d97706")
      .text(paid ? "PAGADA" : status.toUpperCase(), 60, totY + 78);

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.moveTo(50, 750).lineTo(545, 750).strokeColor("#e2e8f0").stroke();
    doc.fontSize(8).font("Helvetica").fillColor("#94a3b8")
      .text("CarsWise AI S.L. · Este documento tiene validez de factura.", 50, 758, { align: "center", width: 495 });

    doc.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const invoiceId = nt(req.query.id);
  const email = nt(req.query.email);
  if (!invoiceId || !email) return res.status(400).json({ error: "id and email required" });

  let row;
  try {
    row = await getInvoice(invoiceId, email);
  } catch (err) {
    return res.status(500).json({ error: "db_error", detail: err.message });
  }
  if (!row) return res.status(404).json({ error: "invoice_not_found" });

  const externalPdf = nt(row.cw_pdf_url || row.pdf_url);
  if (externalPdf) return res.redirect(302, externalPdf);

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
