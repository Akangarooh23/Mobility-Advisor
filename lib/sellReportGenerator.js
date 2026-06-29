const PDFDocument = require("pdfkit");
const { getMarketPriceSnapshot } = require("./inventoryStore");

// ── Brand colours ────────────────────────────────────────────────────────────
const C_INK    = "#1C2B33";
const C_AMBER  = "#BA7517";
const C_TEAL   = "#137370";
const C_GRAY   = "#6B7780";
const C_LIGHT  = "#9AA3AB";
const C_BG     = "#FAF7F2";
const C_BORDER = "#ECE6DB";
const C_WHITE  = "#FFFFFF";

// ── Helpers ──────────────────────────────────────────────────────────────────
function eur(value) {
  if (!Number.isFinite(value) || value <= 0) return "–";
  return new Intl.NumberFormat("es-ES").format(Math.round(value)) + " €";
}

function getDamageFactor(level = "") {
  const l = String(level).toLowerCase();
  if (l.includes("grave") || l.includes("major")) return 0.84;
  if (l.includes("modera") || l.includes("moderate")) return 0.91;
  if (l.includes("leve") || l.includes("minor")) return 0.97;
  return 1;
}

function demandLabel(comparables, days) {
  if (comparables >= 80 && (days == null || days <= 40)) return "ALTO";
  if (comparables >= 30) return "MEDIO";
  return "BAJO";
}

function confidencePct(comparables) {
  if (comparables >= 80) return 85;
  if (comparables >= 40) return 76;
  if (comparables >= 15) return 63;
  return 48;
}

function portalColor(name = "") {
  const n = name.toLowerCase();
  if (n.includes("flexicar"))  return "#16a34a";
  if (n.includes("autohero"))  return "#2563eb";
  if (n.includes("coches.net") || n.includes("coches net")) return "#ea580c";
  if (n.includes("autoscout")) return "#dc2626";
  if (n.includes("wallapop"))  return "#ca8a04";
  if (n.includes("milanuncios")) return "#7c3aed";
  if (n.includes("autocasion")) return "#0891b2";
  if (n.includes("motor.es"))  return "#0284c7";
  if (n.includes("heycar"))    return "#059669";
  return "#64748b";
}

function portalInitial(name = "") {
  return name.trim().charAt(0).toUpperCase() || "M";
}

// ── PDF helpers ───────────────────────────────────────────────────────────────
function hex2rgb(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [r, g, b];
}

function setFill(doc, hex) { doc.fillColor(hex2rgb(hex)); }
function setStroke(doc, hex) { doc.strokeColor(hex2rgb(hex)); }

function roundRect(doc, x, y, w, h, r = 6) {
  doc.roundedRect(x, y, w, h, r);
}

function sectionTitle(doc, text, x, y) {
  setFill(doc, C_INK);
  doc.fontSize(15).font("Helvetica-Bold").text(text, x, y);
  return y + 22;
}

function eyebrow(doc, text, x, y) {
  setFill(doc, C_AMBER);
  doc.fontSize(7).font("Helvetica-Bold").text(text.toUpperCase(), x, y, { characterSpacing: 1.2 });
}

function runhead(doc, vehicleLabel, pageNum) {
  const y = 18;
  setStroke(doc, C_BORDER);
  doc.moveTo(40, y + 14).lineTo(555, y + 14).lineWidth(0.5).stroke();
  setFill(doc, C_INK);
  doc.fontSize(10).font("Helvetica-Bold").text("CarsWise", 40, y);
  setFill(doc, C_AMBER);
  doc.text(".", 40 + doc.widthOfString("CarsWise") - 1, y);
  setFill(doc, C_LIGHT);
  doc.fontSize(7).font("Helvetica").text(`INFORME DE TASACIÓN · ${vehicleLabel}`, 160, y + 2);
  doc.text(`Pág. ${pageNum}`, 555, y + 2, { align: "right", width: 0 });
}

function footer(doc, text = "CarsWise AI · www.carswiseai.com · Informe de uso exclusivo del destinatario. Válido 30 días.") {
  const y = 820;
  setStroke(doc, C_BORDER);
  doc.moveTo(40, y).lineTo(555, y).lineWidth(0.5).stroke();
  setFill(doc, C_LIGHT);
  doc.fontSize(6.5).font("Helvetica").text(text, 40, y + 4, { width: 515, align: "center" });
}

// ── Report data builder ──────────────────────────────────────────────────────
function buildReportData(vehicle, national, local) {
  const df = getDamageFactor(vehicle.damageLevel);
  const mean   = national.market?.mean   || 0;
  const p25    = national.market?.p25    || 0;
  const p75    = national.market?.p75    || 0;
  const days   = national.market?.daysOnMarketMedian;
  const comps  = national.comparables || 0;

  return {
    vehicle,
    priceOptimal: Math.round(mean * df),
    priceLow:     Math.round(p25 * df),
    priceHigh:    Math.round(p75 * df),
    comparables:  comps,
    days,
    confidence:   confidencePct(comps),
    demand:       demandLabel(comps, days),
    byPortal:     (national.byPortal || []).slice(0, 6),
    histogram:    national.priceHistogram || [],
    national,
    local,
    generatedAt:  new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
  };
}

// ── PDF builder ──────────────────────────────────────────────────────────────
function buildPdf(rd) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: "Informe de Tasación de Mercado – CarsWise", Author: "CarsWise AI" } });
    doc.on("data", (c) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 595.28;
    const MX = 40; // horizontal margin
    const CW = W - MX * 2; // content width

    const vehicleLabel = [rd.vehicle.brand, rd.vehicle.model, rd.vehicle.year ? `(${rd.vehicle.year})` : ""].filter(Boolean).join(" ");

    // ════════════════════════════════════════════════════════════
    //  PAGE 1 — COVER + VERDICT
    // ════════════════════════════════════════════════════════════

    // Cover band
    setFill(doc, C_INK);
    doc.rect(0, 0, W, 170).fill();
    // Amber accent line
    setFill(doc, C_AMBER);
    doc.rect(0, 166, W, 4).fill();

    // Logo
    setFill(doc, C_WHITE);
    doc.fontSize(16).font("Helvetica-Bold").text("CarsWise", MX, 28);
    const logoW = doc.widthOfString("CarsWise");
    setFill(doc, "#E0A33C");
    doc.text(".", MX + logoW - 2, 28);
    setFill(doc, "#9FB0BA");
    doc.fontSize(7.5).font("Helvetica").text("TASACIÓN E INTELIGENCIA DE MERCADO", MX, 47, { characterSpacing: 0.8 });

    // Report title
    setFill(doc, C_WHITE);
    doc.fontSize(26).font("Helvetica-Bold").text("Informe de Tasación", MX, 80);
    doc.text("de Mercado", MX, 108);
    setFill(doc, "#C6D2D9");
    doc.fontSize(10).font("Helvetica").text(`Generado el ${rd.generatedAt} · Válido 30 días`, MX, 138);

    let y = 188;

    // Vehicle card
    setFill(doc, C_BG);
    roundRect(doc, MX, y, CW, 130, 8);
    doc.fill();
    setStroke(doc, C_BORDER);
    roundRect(doc, MX, y, CW, 130, 8);
    doc.lineWidth(0.7).stroke();

    // Vehicle name header
    setFill(doc, C_INK);
    doc.fontSize(15).font("Helvetica-Bold").text(vehicleLabel, MX + 14, y + 12);
    if (rd.vehicle.plate) {
      setFill(doc, "#46535C");
      doc.fontSize(8).font("Helvetica-Bold").text(rd.vehicle.plate.toUpperCase(), MX + 14, y + 32);
    }

    // Specs grid (3 cols x 2 rows)
    const specs = [
      ["MARCA",        rd.vehicle.brand || "–"],
      ["MODELO",       rd.vehicle.model || "–"],
      ["AÑO",          rd.vehicle.year  || "–"],
      ["KILÓMETROS",   rd.vehicle.mileage ? new Intl.NumberFormat("es-ES").format(rd.vehicle.mileage) + " km" : "–"],
      ["COMBUSTIBLE",  rd.vehicle.fuel   || "–"],
      ["ESTADO",       rd.vehicle.damageLevel || "Sin daños"],
    ];
    const colW = CW / 3;
    specs.forEach(([k, v], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const sx = MX + col * colW + 14;
      const sy = y + 54 + row * 34;
      setFill(doc, C_LIGHT);
      doc.fontSize(6.5).font("Helvetica-Bold").text(k, sx, sy, { characterSpacing: 0.8 });
      setFill(doc, C_INK);
      doc.fontSize(10).font("Helvetica-Bold").text(String(v), sx, sy + 9);
    });

    y += 148;

    // ── Veredicto de valor ────────────────────────────────────────────────────
    setFill(doc, "#FFFDFA");
    roundRect(doc, MX, y, CW, 148, 8);
    doc.fill();
    setStroke(doc, C_AMBER);
    roundRect(doc, MX, y, CW, 148, 8);
    doc.lineWidth(1.2).stroke();

    eyebrow(doc, "Precio óptimo de venta", MX + 14, y + 12);

    // Big price
    setFill(doc, C_INK);
    doc.fontSize(38).font("Helvetica-Bold").text(eur(rd.priceOptimal), MX + 14, y + 24);

    // Confidence badge (right side)
    const badgeX = MX + CW - 90;
    setFill(doc, "#E8F4F3");
    roundRect(doc, badgeX, y + 18, 76, 54, 8);
    doc.fill();
    setFill(doc, C_TEAL);
    doc.fontSize(28).font("Helvetica-Bold").text(`${rd.confidence}%`, badgeX + 8, y + 24);
    setFill(doc, C_GRAY);
    doc.fontSize(7).font("Helvetica").text("CONFIANZA", badgeX + 12, y + 56, { characterSpacing: 0.6 });

    setFill(doc, C_GRAY);
    doc.fontSize(8).font("Helvetica").text(`Basado en ${rd.comparables} comparables activos en portales`, MX + 14, y + 68);

    // Range bar
    const barY = y + 84;
    const barW = CW - 100;
    // gradient approximation: low=teal, mid=amber, high=teal
    setFill(doc, "#E7EFEF");
    doc.rect(MX + 14, barY, barW, 10).fill();
    setFill(doc, C_TEAL);
    doc.rect(MX + 14, barY, barW * 0.4, 10).fill();
    setFill(doc, C_AMBER);
    doc.rect(MX + 14 + barW * 0.44, barY, barW * 0.12, 10).fill();
    setFill(doc, C_TEAL);
    doc.rect(MX + 14 + barW * 0.56, barY, barW * 0.44, 10).fill();
    // optimal marker
    setFill(doc, C_INK);
    doc.rect(MX + 14 + barW * 0.5 - 1.5, barY - 3, 3, 16).fill();

    // Range labels
    setFill(doc, C_GRAY);
    doc.fontSize(8).font("Helvetica").text(eur(rd.priceLow), MX + 14, barY + 14);
    setFill(doc, C_AMBER);
    doc.fontSize(8).font("Helvetica-Bold").text(`${eur(rd.priceOptimal)} óptimo`, MX + 14 + barW * 0.35, barY + 14);
    setFill(doc, C_GRAY);
    doc.fontSize(8).font("Helvetica").text(eur(rd.priceHigh), MX + 14 + barW - 30, barY + 14);

    y += 166;

    // ── 3 KPI cards ───────────────────────────────────────────────────────────
    const kpis = [
      { n: String(rd.comparables), l: "Unidades\nen portales", color: C_TEAL },
      { n: rd.days != null ? `${rd.days} d.` : "–", l: "Días medianos\nde venta", color: C_TEAL },
      { n: rd.demand, l: "Nivel de\ndemanda", color: C_AMBER },
    ];
    const kW = (CW - 20) / 3;
    kpis.forEach(({ n, l, color }, i) => {
      const kx = MX + i * (kW + 10);
      setFill(doc, C_WHITE);
      roundRect(doc, kx, y, kW, 62, 7);
      doc.fill();
      setStroke(doc, C_BORDER);
      roundRect(doc, kx, y, kW, 62, 7);
      doc.lineWidth(0.5).stroke();
      setFill(doc, color);
      doc.fontSize(22).font("Helvetica-Bold").text(n, kx + 8, y + 8);
      setFill(doc, C_GRAY);
      doc.fontSize(7.5).font("Helvetica").text(l, kx + 8, y + 36, { lineGap: 2 });
    });

    footer(doc);
    doc.addPage();

    // ════════════════════════════════════════════════════════════
    //  PAGE 2 — PORTALES + HISTOGRAMA
    // ════════════════════════════════════════════════════════════
    runhead(doc, vehicleLabel, 2);
    y = 44;

    // Portal table
    y = sectionTitle(doc, "¿Dónde se vende este coche?", MX, y);
    setFill(doc, C_GRAY);
    doc.fontSize(8.5).font("Helvetica").text("Comparativa de precios y disponibilidad por portal activo.", MX, y);
    y += 16;

    // Table header
    setFill(doc, C_BG);
    doc.rect(MX, y, CW, 22).fill();
    setStroke(doc, C_BORDER);
    doc.rect(MX, y, CW, 22).lineWidth(0.5).stroke();
    const tcols = [MX + 8, MX + 160, MX + 280, MX + 380, MX + 460];
    const thead = ["Portal", "Unidades", "Precio medio", "Días prom.", "% del mercado"];
    thead.forEach((h, i) => {
      setFill(doc, C_LIGHT);
      doc.fontSize(6.5).font("Helvetica-Bold").text(h.toUpperCase(), tcols[i], y + 7, { characterSpacing: 0.6 });
    });
    y += 22;

    const totalUnits = rd.byPortal.reduce((s, r) => s + r.units, 0) || 1;
    rd.byPortal.slice(0, 6).forEach((row, i) => {
      const rowBg = i % 2 === 0 ? C_WHITE : "#FAFAFA";
      setFill(doc, rowBg);
      doc.rect(MX, y, CW, 24).fill();
      setStroke(doc, "#F0F0F0");
      doc.rect(MX, y, CW, 24).lineWidth(0.3).stroke();

      // Portal badge
      const color = portalColor(row.portal);
      setFill(doc, color);
      roundRect(doc, tcols[0], y + 5, 16, 16, 3);
      doc.fill();
      setFill(doc, C_WHITE);
      doc.fontSize(8).font("Helvetica-Bold").text(portalInitial(row.portal), tcols[0] + 4, y + 7);
      setFill(doc, C_INK);
      doc.fontSize(9.5).font("Helvetica-Bold").text(row.portal, tcols[0] + 22, y + 7);

      setFill(doc, C_GRAY);
      doc.fontSize(9).font("Helvetica").text(String(row.units), tcols[1], y + 7);
      setFill(doc, C_INK);
      doc.fontSize(9).font("Helvetica-Bold").text(eur(row.avgPrice), tcols[2], y + 7);
      setFill(doc, C_GRAY);
      doc.fontSize(9).font("Helvetica").text(row.avgDays != null ? `${row.avgDays} d.` : "–", tcols[3], y + 7);
      // bar
      const pct = Math.round((row.units / totalUnits) * 100);
      setFill(doc, "#E7EFEF");
      doc.rect(tcols[4], y + 8, 80, 8).fill();
      setFill(doc, color);
      doc.rect(tcols[4], y + 8, Math.round(80 * row.units / totalUnits), 8).fill();
      setFill(doc, C_GRAY);
      doc.fontSize(7).font("Helvetica").text(`${pct}%`, tcols[4] + 84, y + 9);

      y += 24;
    });
    // Total row
    const totalAvgPrice = rd.byPortal.length
      ? Math.round(rd.byPortal.reduce((s, r) => s + (r.avgPrice || 0), 0) / rd.byPortal.length)
      : null;
    setFill(doc, "#FBF4E9");
    doc.rect(MX, y, CW, 24).fill();
    setFill(doc, C_AMBER);
    doc.fontSize(9).font("Helvetica-Bold").text("TOTAL", tcols[0] + 22, y + 7);
    doc.text(String(totalUnits), tcols[1], y + 7);
    doc.text(eur(totalAvgPrice), tcols[2], y + 7);
    y += 34;

    // ── Histogram ─────────────────────────────────────────────────────────────
    y = sectionTitle(doc, "Distribución de precios en el mercado", MX, y);
    setFill(doc, C_GRAY);
    doc.fontSize(8.5).font("Helvetica").text("Concentración de anuncios por tramo de precio.", MX, y);
    y += 14;

    if (rd.histogram.length) {
      const maxCount = Math.max(...rd.histogram.map((b) => b.count));
      const barMaxW = CW - 120;
      rd.histogram.forEach((bucket) => {
        const label = `${Math.round(bucket.from / 1000)}k–${Math.round(bucket.to / 1000)}k €`;
        const barW2 = maxCount > 0 ? Math.round((bucket.count / maxCount) * barMaxW) : 0;
        const isOptimal = rd.priceOptimal >= bucket.from && rd.priceOptimal < bucket.to;
        setFill(doc, C_GRAY);
        doc.fontSize(8).font("Helvetica").text(label, MX, y + 2, { width: 60 });
        setFill(doc, "#F0F0F0");
        doc.rect(MX + 66, y, barMaxW, 13).fill();
        setFill(doc, isOptimal ? C_AMBER : C_TEAL);
        doc.rect(MX + 66, y, barW2, 13).fill();
        setFill(doc, C_GRAY);
        doc.fontSize(8).font("Helvetica").text(String(bucket.count), MX + 68 + barMaxW, y + 2);
        if (isOptimal) {
          setFill(doc, C_AMBER);
          doc.fontSize(7).font("Helvetica-Bold").text("← precio óptimo", MX + 70 + barW2, y + 3);
        }
        y += 18;
      });
    } else {
      setFill(doc, C_GRAY);
      doc.fontSize(8).font("Helvetica").text("Datos de distribución no disponibles para este modelo.", MX, y);
      y += 16;
    }

    footer(doc);
    doc.addPage();

    // ════════════════════════════════════════════════════════════
    //  PAGE 3 — ESTRATEGIA
    // ════════════════════════════════════════════════════════════
    runhead(doc, vehicleLabel, 3);
    y = 44;

    y = sectionTitle(doc, "Estrategia de venta recomendada", MX, y);
    setFill(doc, C_GRAY);
    doc.fontSize(8.5).font("Helvetica").text("Tres escenarios según tu objetivo: vender rápido, equilibrio o maximizar precio.", MX, y);
    y += 18;

    const scenarios = [
      { tag: "VENTA RÁPIDA", price: rd.priceLow, days: rd.days ? `${Math.round(rd.days * 0.5)}–${Math.round(rd.days * 0.7)} días` : "15–25 días", bg: "#F2F7F7", tc: C_TEAL, desc: "Precio competitivo. Ideal si necesitas liquidez o vender antes de comprar otro coche.", reco: false },
      { tag: "EQUILIBRADO ★", price: rd.priceOptimal, days: rd.days ? `${Math.round(rd.days * 0.8)}–${Math.round(rd.days * 1.2)} días` : "30–45 días", bg: "#FBF4E9", tc: C_AMBER, desc: "Precio de mercado. La mejor relación entre tiempo de venta y valor obtenido.", reco: true },
      { tag: "MÁXIMO VALOR", price: rd.priceHigh, days: rd.days ? `${Math.round(rd.days * 1.4)}–${Math.round(rd.days * 1.9)} días` : "50–75 días", bg: "#F4F2F7", tc: "#5B4B8A", desc: "Por encima de la media. Necesita paciencia y un vehículo en excelente estado.", reco: false },
    ];
    const sW = (CW - 20) / 3;
    scenarios.forEach(({ tag, price, days: sDays, bg, tc, desc, reco }, i) => {
      const sx = MX + i * (sW + 10);
      setFill(doc, bg);
      roundRect(doc, sx, y, sW, 130, 8);
      doc.fill();
      setStroke(doc, reco ? C_AMBER : C_BORDER);
      roundRect(doc, sx, y, sW, 130, 8);
      doc.lineWidth(reco ? 1.5 : 0.5).stroke();
      if (reco) {
        setFill(doc, C_AMBER);
        roundRect(doc, sx + sW - 60, y - 8, 56, 16, 8);
        doc.fill();
        setFill(doc, C_WHITE);
        doc.fontSize(6.5).font("Helvetica-Bold").text("RECOMENDADO", sx + sW - 56, y - 4, { characterSpacing: 0.4 });
      }
      setFill(doc, tc);
      doc.fontSize(7.5).font("Helvetica-Bold").text(tag, sx + 10, y + 10, { characterSpacing: 0.4 });
      doc.fontSize(20).font("Helvetica-Bold").text(eur(price), sx + 10, y + 22);
      setFill(doc, C_GRAY);
      doc.fontSize(8).font("Helvetica").text(sDays, sx + 10, y + 50);
      setStroke(doc, "#F0ECE3");
      doc.moveTo(sx + 10, y + 64).lineTo(sx + sW - 10, y + 64).lineWidth(0.5).stroke();
      setFill(doc, "#46535C");
      doc.fontSize(8).font("Helvetica").text(desc, sx + 10, y + 70, { width: sW - 20, lineGap: 2 });
    });
    y += 148;

    // ── Adjustment factors ────────────────────────────────────────────────────
    y = sectionTitle(doc, "Factores de ajuste de tu vehículo", MX, y + 10);
    setFill(doc, C_GRAY);
    doc.fontSize(8.5).font("Helvetica").text("Cómo influyen las características declaradas sobre el precio de mercado.", MX, y);
    y += 16;

    const mileage = rd.vehicle.mileage || 0;
    const vehicleYear = rd.vehicle.year || new Date().getFullYear();
    const age = new Date().getFullYear() - vehicleYear;
    const adjustments = [
      {
        factor: "Kilometraje",
        impact: mileage < 50000 ? "+300 €" : mileage > 150000 ? "–800 €" : "neutro",
        color: mileage < 50000 ? C_TEAL : mileage > 150000 ? "#B4502E" : C_GRAY,
        note: mileage < 50000 ? "Bajo kilometraje, cotiza mejor" : mileage > 150000 ? "Alto kilometraje, descuento aplicado" : "Kilometraje dentro de la media",
      },
      {
        factor: "Antigüedad",
        impact: age <= 3 ? "+500 €" : age <= 7 ? "neutro" : "–400 €",
        color: age <= 3 ? C_TEAL : age <= 7 ? C_GRAY : "#B4502E",
        note: age <= 3 ? "Vehículo reciente, alta valoración" : age <= 7 ? "Antigüedad dentro de la media" : "Vehículo con varios años de uso",
      },
      {
        factor: "Estado / Daños",
        impact: getDamageFactor(rd.vehicle.damageLevel) === 1 ? "neutro" : getDamageFactor(rd.vehicle.damageLevel) >= 0.97 ? "–150 €" : getDamageFactor(rd.vehicle.damageLevel) >= 0.91 ? "–700 €" : "–1.500 €",
        color: getDamageFactor(rd.vehicle.damageLevel) === 1 ? C_TEAL : "#B4502E",
        note: rd.vehicle.damageDes || (getDamageFactor(rd.vehicle.damageLevel) === 1 ? "Sin daños declarados" : `Daños: ${rd.vehicle.damageLevel}`),
      },
    ];

    // Table header
    setFill(doc, C_BG);
    doc.rect(MX, y, CW, 20).fill();
    setStroke(doc, C_BORDER);
    doc.rect(MX, y, CW, 20).lineWidth(0.5).stroke();
    setFill(doc, C_LIGHT);
    doc.fontSize(6.5).font("Helvetica-Bold").text("FACTOR", MX + 10, y + 6, { characterSpacing: 0.6 });
    doc.text("IMPACTO", MX + 220, y + 6, { characterSpacing: 0.6 });
    doc.text("NOTA", MX + 320, y + 6, { characterSpacing: 0.6 });
    y += 20;

    adjustments.forEach(({ factor, impact, color, note }, i) => {
      setFill(doc, i % 2 === 0 ? C_WHITE : "#FAFAFA");
      doc.rect(MX, y, CW, 22).fill();
      setFill(doc, C_INK);
      doc.fontSize(9).font("Helvetica-Bold").text(factor, MX + 10, y + 6);
      setFill(doc, color);
      doc.fontSize(9).font("Helvetica-Bold").text(impact, MX + 220, y + 6);
      setFill(doc, C_GRAY);
      doc.fontSize(8).font("Helvetica").text(note, MX + 320, y + 6, { width: CW - 330 });
      y += 22;
    });

    footer(doc);
    doc.addPage();

    // ════════════════════════════════════════════════════════════
    //  PAGE 4 — CONSEJOS + METODOLOGÍA
    // ════════════════════════════════════════════════════════════
    runhead(doc, vehicleLabel, 4);
    y = 44;

    y = sectionTitle(doc, "Recomendaciones para vender mejor", MX, y);
    setFill(doc, C_GRAY);
    doc.fontSize(8.5).font("Helvetica").text("Aplica estos consejos para maximizar el precio final y reducir el tiempo de venta.", MX, y);
    y += 18;

    const tips = [
      ["Limpieza interior y exterior", "Un vehículo limpio puede mejorar la percepción de valor en un 10–15%."],
      ["Fotos profesionales", "Usa luz natural, fondo neutro y al menos 8–10 ángulos distintos."],
      ["Historial de mantenimiento", "Tener la revisión al día y los documentos en orden genera más confianza."],
      ["Precio de salida estratégico", `Empieza en ${eur(rd.priceOptimal)} para tener margen de negociación sin perder potenciales compradores.`],
      ["Publicación en varios portales", "Presencia en Coches.net, AutoScout24 y Wallapop multiplica tu alcance."],
      ["Responde rápido a los contactos", "Responder en menos de 1 hora aumenta un 60% la tasa de conversión a visita."],
      ["Horario de publicación", "Los martes y jueves entre 18–20h tienen más tráfico de compradores activos."],
      ["Actualiza el anuncio cada 7 días", "Los portales priorizan anuncios recientes en sus algoritmos de búsqueda."],
    ];

    tips.forEach(([title, text], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const tx = MX + col * (CW / 2 + 8);
      const ty = y + row * 48;
      setFill(doc, C_AMBER);
      doc.fontSize(10).font("Helvetica-Bold").text("✓", tx, ty);
      setFill(doc, C_INK);
      doc.fontSize(9).font("Helvetica-Bold").text(title, tx + 16, ty);
      setFill(doc, "#46535C");
      doc.fontSize(8).font("Helvetica").text(text, tx + 16, ty + 13, { width: CW / 2 - 24, lineGap: 2 });
    });

    y += Math.ceil(tips.length / 2) * 48 + 16;

    // Methodology
    y = sectionTitle(doc, "Metodología y fuentes", MX, y);
    setFill(doc, "#46535C");
    doc.fontSize(8.5).font("Helvetica").text(
      "Este informe utiliza datos en tiempo real de los principales portales de venta de vehículos de ocasión en España. " +
      "El precio óptimo se calcula como la media ponderada de ofertas activas del mismo modelo, año y combustible, ajustada por kilometraje y estado del vehículo declarado. " +
      "Los percentiles P25 y P75 delimitan el rango de precios de mercado. El tiempo estimado de venta se basa en la mediana de días en cartera de anuncios similares.",
      MX, y, { width: CW, lineGap: 2 }
    );
    y += 60;

    // Source table
    const sourcePortals = rd.byPortal.slice(0, 4);
    if (sourcePortals.length) {
      setFill(doc, C_BG);
      doc.rect(MX, y, CW, 20).fill();
      setStroke(doc, C_BORDER);
      doc.rect(MX, y, CW, 20).lineWidth(0.5).stroke();
      setFill(doc, C_LIGHT);
      doc.fontSize(6.5).font("Helvetica-Bold").text("PORTAL", MX + 10, y + 6, { characterSpacing: 0.6 });
      doc.text("ANUNCIOS", MX + 160, y + 6, { characterSpacing: 0.6 });
      doc.text("COBERTURA", MX + 260, y + 6, { characterSpacing: 0.6 });
      y += 20;
      sourcePortals.forEach(({ portal, units }, i) => {
        setFill(doc, i % 2 === 0 ? C_WHITE : "#FAFAFA");
        doc.rect(MX, y, CW, 20).fill();
        setFill(doc, C_INK);
        doc.fontSize(9).font("Helvetica-Bold").text(portal, MX + 10, y + 5);
        setFill(doc, C_GRAY);
        doc.fontSize(9).font("Helvetica").text(String(units), MX + 160, y + 5);
        doc.text(`${Math.round((units / totalUnits) * 100)}%`, MX + 260, y + 5);
        y += 20;
      });
    }

    y += 12;

    // Disclaimer
    setFill(doc, C_BG);
    roundRect(doc, MX, y, CW, 78, 6);
    doc.fill();
    setStroke(doc, C_BORDER);
    roundRect(doc, MX, y, CW, 78, 6);
    doc.lineWidth(0.5).stroke();
    setFill(doc, C_GRAY);
    doc.fontSize(7.5).font("Helvetica").text(
      "AVISO LEGAL: Este informe tiene carácter informativo y no constituye una tasación pericial oficial. Los precios reflejados " +
      "son estimaciones basadas en datos de mercado públicos en el momento de la consulta y pueden variar. CarsWise AI no garantiza " +
      "la venta del vehículo al precio indicado ni asume responsabilidad por decisiones tomadas a partir de este informe. " +
      "Válido 30 días desde la fecha de emisión. Uso exclusivo del destinatario.",
      MX + 12, y + 10, { width: CW - 24, lineGap: 3 }
    );

    footer(doc, `CarsWise AI · ${rd.generatedAt} · Ref. CW-${String(Date.now()).slice(-6)} · www.carswiseai.com`);

    doc.end();
  });
}

// ── Public API ───────────────────────────────────────────────────────────────
async function generateSellReport(vehicle = {}) {
  const baseOptions = {
    desiredType: "compra",
    brand:   String(vehicle.brand   || ""),
    model:   String(vehicle.model   || ""),
    version: String(vehicle.version || ""),
    fuel:    String(vehicle.fuel    || ""),
    year:    vehicle.year   ? Number(vehicle.year)    : null,
    mileage: vehicle.mileage ? Number(vehicle.mileage) : null,
  };

  const [national, local] = await Promise.all([
    getMarketPriceSnapshot(baseOptions),
    vehicle.province
      ? getMarketPriceSnapshot({ ...baseOptions, location: String(vehicle.province) })
      : Promise.resolve(null),
  ]);

  const reportData = buildReportData(vehicle, national, local);
  const pdfBuffer  = await buildPdf(reportData);

  return { pdfBuffer, reportData };
}

module.exports = { generateSellReport };
