const { Pool } = require("pg");

const getPool = (() => {
  let pool;
  return () => {
    if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
    return pool;
  };
})();

function normalizeText(v) { return typeof v === "string" ? v.trim() : String(v ?? "").trim(); }

async function getInvoice(invoiceId, email) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT i.id, i.number, i.cw_invoice_number, i.date, i.amount, i.status,
            i.pdf_url, i.cw_pdf_url, i.email,
            u.name, u.apellidos, u.phone, u.tax_id,
            u.billing_street, u.billing_postal_code, u.billing_province
     FROM moveadvisor_user_invoices i
     LEFT JOIN moveadvisor_users u ON lower(u.email) = lower(i.email)
     WHERE i.id = $1 AND lower(i.email) = lower($2)
     LIMIT 1`,
    [invoiceId, email]
  );
  return result.rows[0] || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // Auth: require session email via query param (validated against DB row)
  const invoiceId = normalizeText(req.query.id);
  const email = normalizeText(req.query.email);
  if (!invoiceId || !email) return res.status(400).json({ error: "id and email required" });

  let row;
  try {
    row = await getInvoice(invoiceId, email);
  } catch (err) {
    return res.status(500).json({ error: "db_error", detail: err.message });
  }

  if (!row) return res.status(404).json({ error: "invoice_not_found" });

  // If Stripe already has a PDF URL, redirect there
  const externalPdf = normalizeText(row.cw_pdf_url || row.pdf_url);
  if (externalPdf) return res.redirect(302, externalPdf);

  // Generate PDF on-demand
  const invoiceNumber = normalizeText(row.cw_invoice_number || row.number || `INV-${row.id}`);
  const date = row.date ? new Date(row.date).toLocaleDateString("es-ES") : "–";
  const amount = Number(row.amount || 0).toFixed(2);
  const status = normalizeText(row.status);
  const clientName = [normalizeText(row.name), normalizeText(row.apellidos)].filter(Boolean).join(" ") || normalizeText(row.email);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="factura-${invoiceNumber}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");

  let PDFDocument;
  try { PDFDocument = require("pdfkit"); } catch { return res.status(500).json({ error: "pdf_unavailable" }); }
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

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
  if (row.email)            { doc.text(normalizeText(row.email), 50, lineY); lineY += 12; }
  if (row.phone)            { doc.text(normalizeText(row.phone), 50, lineY); lineY += 12; }
  if (row.tax_id)           { doc.text(`NIF/CIF: ${normalizeText(row.tax_id)}`, 50, lineY); lineY += 12; }
  if (row.billing_street)   { doc.text(normalizeText(row.billing_street), 50, lineY); lineY += 12; }
  if (row.billing_postal_code || row.billing_province)
    doc.text([normalizeText(row.billing_postal_code), normalizeText(row.billing_province)].filter(Boolean).join(" "), 50, lineY);

  // ── Items table ───────────────────────────────────────────────────────────
  const tableTop = 250;
  doc.rect(50, tableTop, 495, 24).fill("#f8fafc");
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#475569")
    .text("CONCEPTO", 60, tableTop + 8)
    .text("IMPORTE", 480, tableTop + 8, { align: "right", width: 55 });

  doc.moveTo(50, tableTop + 24).lineTo(545, tableTop + 24).strokeColor("#e2e8f0").stroke();

  const baseAmount = (Number(amount) / 1.21).toFixed(2);
  const ivaAmount  = (Number(amount) - Number(baseAmount)).toFixed(2);

  doc.fontSize(10).font("Helvetica").fillColor("#0f172a")
    .text("Suscripción CarsWise Plus", 60, tableTop + 34)
    .text(`${baseAmount} EUR`, 480, tableTop + 34, { align: "right", width: 55 });

  doc.moveTo(50, tableTop + 54).lineTo(545, tableTop + 54).strokeColor("#e2e8f0").stroke();

  // ── Totals ────────────────────────────────────────────────────────────────
  const totY = tableTop + 64;
  doc.fontSize(9).font("Helvetica").fillColor("#475569")
    .text("Base imponible:", 380, totY).text(`${baseAmount} EUR`, 480, totY, { align: "right", width: 55 })
    .text("IVA (21%):", 380, totY + 14).text(`${ivaAmount} EUR`, 480, totY + 14, { align: "right", width: 55 });

  doc.rect(370, totY + 30, 175, 22).fill("#1e40af");
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#ffffff")
    .text("TOTAL:", 380, totY + 36)
    .text(`${amount} EUR`, 480, totY + 36, { align: "right", width: 55 });

  // ── Status badge ──────────────────────────────────────────────────────────
  const badgeColor = status === "paid" || status === "pagada" ? "#16a34a" : "#d97706";
  doc.circle(60, totY + 80, 5).fill(badgeColor);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(badgeColor)
    .text(status === "paid" || status === "pagada" ? "PAGADA" : status.toUpperCase(), 70, totY + 75);

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.moveTo(50, 750).lineTo(545, 750).strokeColor("#e2e8f0").stroke();
  doc.fontSize(8).font("Helvetica").fillColor("#94a3b8")
    .text("CarsWise AI S.L. · CIF: B-XXXXXXXX · Calle Ejemplo 1, Madrid · Este documento tiene validez de factura.", 50, 758, { align: "center", width: 495 });

  doc.end();
};
