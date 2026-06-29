const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { getMarketPriceSnapshot } = require("./inventoryStore");

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

function buildReportData(vehicle, national) {
  const df    = getDamageFactor(vehicle.damageLevel);
  const mean  = national.market?.mean  || 0;
  const p25   = national.market?.p25   || 0;
  const p75   = national.market?.p75   || 0;
  const days  = national.market?.daysOnMarketMedian;
  const comps = national.comparables || 0;
  return {
    vehicle,
    priceOptimal: Math.round(mean * df),
    priceLow:     Math.round(p25  * df),
    priceHigh:    Math.round(p75  * df),
    comparables:  comps,
    days,
    confidence:   confidencePct(comps),
    demand:       demandLabel(comps, days),
    byPortal:     (national.byPortal || []).slice(0, 6),
    histogram:    national.priceHistogram || [],
    generatedAt:  new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
  };
}

// ── pdf-lib helpers ───────────────────────────────────────────────────────────

function hex(h) {
  const s = h.replace("#", "");
  return rgb(parseInt(s.slice(0,2),16)/255, parseInt(s.slice(2,4),16)/255, parseInt(s.slice(4,6),16)/255);
}

const W = 595.28, H = 841.89, MX = 40, CW = 595.28 - 40 * 2;
const INK    = hex("#1C2B33");
const AMBER  = hex("#BA7517");
const TEAL   = hex("#137370");
const GRAY   = hex("#6B7780");
const LIGHT  = hex("#9AA3AB");
const BG     = hex("#FAF7F2");
const BORDER = hex("#ECE6DB");
const WHITE  = rgb(1, 1, 1);

// Convert pdfkit-style top-left y to pdf-lib bottom-left y
function ty(pkY, h = 0) { return H - pkY - h; }

function fr(page, x, y, w, h, color, bColor, bWidth = 0.5) {
  page.drawRectangle({ x, y: ty(y, h), width: w, height: h, color,
    ...(bColor ? { borderColor: bColor, borderWidth: bWidth } : {}) });
}

function ln(page, x1, y1, x2, y2, color, t = 0.5) {
  page.drawLine({ start: { x: x1, y: ty(y1) }, end: { x: x2, y: ty(y2) }, thickness: t, color });
}

function dt(page, str, x, pkY, size, font, color, maxWidth) {
  if (!str && str !== 0) return;
  page.drawText(String(str), {
    x, y: ty(pkY) - size * 0.78,
    size, font, color,
    ...(maxWidth ? { maxWidth } : {}),
  });
}

function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  words.forEach((w) => {
    if ((cur + " " + w).trim().length <= maxChars) cur = (cur + " " + w).trim();
    else { lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  return lines;
}

function runhead(page, vLabel, pageNum, rb, ib) {
  ln(page, MX, 32, W - MX, 32, BORDER, 0.5);
  dt(page, "CarsWise", MX, 18, 10, rb, INK);
  dt(page, ".", MX + rb.widthOfTextAtSize("CarsWise", 10) - 1, 18, 10, rb, AMBER);
  dt(page, `INFORME DE TASACION · ${vLabel}`, 160, 20, 7, ib, LIGHT);
  dt(page, `Pag. ${pageNum}`, W - MX - 30, 20, 7, ib, LIGHT);
}

function footer(page, text, ib) {
  const t = text || "CarsWise AI · www.carswiseai.com · Valido 30 dias.";
  ln(page, MX, 820, W - MX, 820, BORDER, 0.5);
  dt(page, t, MX + 50, 824, 6.5, ib, LIGHT);
}

// ── PDF builder ───────────────────────────────────────────────────────────────

async function buildPdf(rd) {
  const pdfDoc = await PDFDocument.create();
  const rb = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const ib = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const vLabel = [rd.vehicle.brand, rd.vehicle.model, rd.vehicle.year ? `(${rd.vehicle.year})` : ""].filter(Boolean).join(" ");

  // ═══════════════════════════════════════════════════════
  //  PAGE 1 — COVER + VERDICT
  // ═══════════════════════════════════════════════════════
  const p1 = pdfDoc.addPage([W, H]);

  // Cover band
  fr(p1, 0, 0, W, 170, INK);
  fr(p1, 0, 166, W, 4, AMBER);

  dt(p1, "CarsWise", MX, 28, 16, rb, WHITE);
  dt(p1, ".", MX + rb.widthOfTextAtSize("CarsWise", 16) - 1, 28, 16, rb, hex("#E0A33C"));
  dt(p1, "TASACION E INTELIGENCIA DE MERCADO", MX, 47, 7.5, ib, hex("#9FB0BA"));
  dt(p1, "Informe de Tasacion", MX, 80, 26, rb, WHITE);
  dt(p1, "de Mercado", MX, 108, 26, rb, WHITE);
  dt(p1, `Generado el ${rd.generatedAt} · Valido 30 dias`, MX, 138, 10, ib, hex("#C6D2D9"));

  let y = 188;

  // Vehicle card
  fr(p1, MX, y, CW, 130, BG, BORDER, 0.7);
  dt(p1, vLabel, MX + 14, y + 12, 15, rb, INK);
  if (rd.vehicle.plate) dt(p1, rd.vehicle.plate.toUpperCase(), MX + 14, y + 32, 8, rb, hex("#46535C"));

  const specs = [
    ["MARCA",       rd.vehicle.brand   || "–"],
    ["MODELO",      rd.vehicle.model   || "–"],
    ["ANO",         String(rd.vehicle.year || "–")],
    ["KM",          rd.vehicle.mileage ? new Intl.NumberFormat("es-ES").format(rd.vehicle.mileage) + " km" : "–"],
    ["COMBUSTIBLE", rd.vehicle.fuel    || "–"],
    ["ESTADO",      rd.vehicle.damageLevel || "Sin danos"],
  ];
  const specColW = CW / 3;
  specs.forEach(([k, v], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const sx = MX + col * specColW + 14, sy = y + 54 + row * 34;
    dt(p1, k, sx, sy, 6.5, rb, LIGHT);
    dt(p1, v, sx, sy + 10, 10, rb, INK);
  });
  y += 148;

  // Verdict box
  fr(p1, MX, y, CW, 148, hex("#FFFDFA"), AMBER, 1.2);
  dt(p1, "PRECIO OPTIMO DE VENTA", MX + 14, y + 12, 7, rb, AMBER);
  dt(p1, eur(rd.priceOptimal), MX + 14, y + 24, 38, rb, INK);

  const badgeX = MX + CW - 90;
  fr(p1, badgeX, y + 18, 76, 54, hex("#E8F4F3"));
  dt(p1, `${rd.confidence}%`, badgeX + 8, y + 24, 28, rb, TEAL);
  dt(p1, "CONFIANZA", badgeX + 14, y + 56, 7, ib, GRAY);

  dt(p1, `Basado en ${rd.comparables} comparables activos en portales`, MX + 14, y + 68, 8, ib, GRAY);

  const barY = y + 84, barBW = CW - 100;
  const priceRange = (rd.priceHigh - rd.priceLow) || 1;
  const optPct = Math.max(0.05, Math.min(0.95, (rd.priceOptimal - rd.priceLow) / priceRange));
  const optPx = Math.round(barBW * optPct);
  fr(p1, MX + 14, barY, barBW, 10, hex("#E7EFEF"));
  fr(p1, MX + 14, barY, optPx, 10, TEAL);
  fr(p1, MX + 14 + optPx - Math.round(barBW * 0.06), barY, Math.round(barBW * 0.12), 10, AMBER);
  fr(p1, MX + 14 + optPx + Math.round(barBW * 0.06), barY, barBW - optPx - Math.round(barBW * 0.06), 10, TEAL);
  fr(p1, MX + 14 + optPx - 1, barY - 3, 3, 16, INK);
  dt(p1, eur(rd.priceLow),     MX + 14,              barY + 14, 8, ib, GRAY);
  dt(p1, `${eur(rd.priceOptimal)} optimo`, MX + 14 + Math.max(4, optPx - 30), barY + 14, 8, rb, AMBER);
  dt(p1, eur(rd.priceHigh),    MX + 14 + barBW - 40, barY + 14, 8, ib, GRAY);
  y += 166;

  // KPI cards
  const kpis = [
    { n: String(rd.comparables), l: "Unidades en portales", color: TEAL },
    { n: rd.days != null ? `${rd.days} d.` : "–", l: "Dias medianos de venta", color: TEAL },
    { n: rd.demand, l: "Nivel de demanda", color: AMBER },
  ];
  const kW = (CW - 20) / 3;
  kpis.forEach(({ n, l, color }, i) => {
    const kx = MX + i * (kW + 10);
    fr(p1, kx, y, kW, 62, WHITE, BORDER, 0.5);
    dt(p1, n, kx + 8, y + 8, 22, rb, color);
    dt(p1, l, kx + 8, y + 40, 7.5, ib, GRAY);
  });

  footer(p1, null, ib);

  // ═══════════════════════════════════════════════════════
  //  PAGE 2 — PORTALES + HISTOGRAMA
  // ═══════════════════════════════════════════════════════
  const p2 = pdfDoc.addPage([W, H]);
  runhead(p2, vLabel, 2, rb, ib);
  y = 44;

  dt(p2, "Donde se vende este coche?", MX, y, 15, rb, INK); y += 22;
  dt(p2, "Comparativa de precios y disponibilidad por portal activo.", MX, y, 8.5, ib, GRAY); y += 16;

  // Table header
  fr(p2, MX, y, CW, 22, BG, BORDER, 0.5);
  const tcols = [MX + 8, MX + 140, MX + 240, MX + 360, MX + 430];
  ["Portal", "Unidades", "Precio medio", "Dias prom.", "% mercado"].forEach((h, i) => {
    dt(p2, h.toUpperCase(), tcols[i], y + 5, 6.5, rb, LIGHT);
  });
  y += 22;

  const totalUnits = rd.byPortal.reduce((s, r) => s + r.units, 0) || 1;
  rd.byPortal.slice(0, 6).forEach((row, i) => {
    fr(p2, MX, y, CW, 24, i % 2 === 0 ? WHITE : hex("#FAFAFA"), hex("#F0F0F0"), 0.3);
    dt(p2, row.portal, tcols[0], y + 7, 9.5, rb, INK);
    dt(p2, String(row.units), tcols[1], y + 7, 9, ib, GRAY);
    dt(p2, eur(row.avgPrice), tcols[2], y + 7, 9, rb, INK);
    dt(p2, row.avgDays != null ? `${row.avgDays} d.` : "–", tcols[3], y + 7, 9, ib, GRAY);
    const pct = Math.round((row.units / totalUnits) * 100);
    fr(p2, tcols[4], y + 8, 60, 8, hex("#E7EFEF"));
    fr(p2, tcols[4], y + 8, Math.round(60 * row.units / totalUnits), 8, TEAL);
    dt(p2, `${pct}%`, tcols[4] + 64, y + 9, 7, ib, GRAY);
    y += 24;
  });

  const totalAvgPrice = rd.byPortal.length
    ? Math.round(rd.byPortal.reduce((s, r) => s + (r.avgPrice || 0), 0) / rd.byPortal.length)
    : null;
  fr(p2, MX, y, CW, 24, hex("#FBF4E9"));
  dt(p2, "TOTAL", tcols[0], y + 7, 9, rb, AMBER);
  dt(p2, String(totalUnits), tcols[1], y + 7, 9, rb, AMBER);
  dt(p2, eur(totalAvgPrice), tcols[2], y + 7, 9, rb, AMBER);
  y += 34;

  dt(p2, "Distribucion de precios en el mercado", MX, y, 15, rb, INK); y += 22;
  dt(p2, "Concentracion de anuncios por tramo de precio.", MX, y, 8.5, ib, GRAY); y += 14;

  if (rd.histogram.length) {
    const maxCount = Math.max(...rd.histogram.map((b) => b.count));
    const barMaxW = CW - 120;
    rd.histogram.forEach((bucket) => {
      const label = `${Math.round(bucket.from / 1000)}k-${Math.round(bucket.to / 1000)}k EUR`;
      const bW = maxCount > 0 ? Math.round((bucket.count / maxCount) * barMaxW) : 0;
      const isOpt = rd.priceOptimal >= bucket.from && rd.priceOptimal < bucket.to;
      dt(p2, label, MX, y + 2, 8, ib, GRAY);
      fr(p2, MX + 66, y, barMaxW, 13, hex("#F0F0F0"));
      if (bW > 0) fr(p2, MX + 66, y, bW, 13, isOpt ? AMBER : TEAL);
      dt(p2, String(bucket.count), MX + 68 + barMaxW, y + 2, 8, ib, GRAY);
      if (isOpt) dt(p2, "<- optimo", MX + 70 + bW, y + 3, 7, rb, AMBER);
      y += 18;
    });
  } else {
    dt(p2, "Datos de distribucion no disponibles para este modelo.", MX, y, 8, ib, GRAY);
  }

  footer(p2, null, ib);

  // ═══════════════════════════════════════════════════════
  //  PAGE 3 — ESTRATEGIA + FACTORES
  // ═══════════════════════════════════════════════════════
  const p3 = pdfDoc.addPage([W, H]);
  runhead(p3, vLabel, 3, rb, ib);
  y = 44;

  dt(p3, "Estrategia de venta recomendada", MX, y, 15, rb, INK); y += 22;
  dt(p3, "Tres escenarios segun tu objetivo: rapido, equilibrado o maximo precio.", MX, y, 8.5, ib, GRAY); y += 18;

  const scenarios = [
    { tag: "VENTA RAPIDA", price: rd.priceLow,     t: rd.days ? `${Math.round(rd.days*0.5)}-${Math.round(rd.days*0.7)} d.` : "15-25 dias", bg: hex("#F2F7F7"), tc: TEAL,   desc: "Precio competitivo. Ideal si necesitas liquidez." },
    { tag: "EQUILIBRADO",  price: rd.priceOptimal, t: rd.days ? `${Math.round(rd.days*0.8)}-${Math.round(rd.days*1.2)} d.` : "30-45 dias", bg: hex("#FBF4E9"), tc: AMBER,  desc: "Precio de mercado. Mejor relacion tiempo/valor.", reco: true },
    { tag: "MAXIMO VALOR", price: rd.priceHigh,    t: rd.days ? `${Math.round(rd.days*1.4)}-${Math.round(rd.days*1.9)} d.` : "50-75 dias", bg: hex("#F4F2F7"), tc: hex("#5B4B8A"), desc: "Por encima de la media. Requiere paciencia." },
  ];
  const sW = (CW - 20) / 3;
  scenarios.forEach(({ tag, price, t, bg, tc, desc, reco }, i) => {
    const sx = MX + i * (sW + 10);
    fr(p3, sx, y, sW, 120, bg, reco ? AMBER : BORDER, reco ? 1.5 : 0.5);
    if (reco) { fr(p3, sx + sW - 90, y + 6, 80, 14, AMBER); dt(p3, "RECOMENDADO", sx + sW - 88, y + 9, 6, rb, WHITE); }
    dt(p3, tag, sx + 10, y + 10, 7.5, rb, tc);
    dt(p3, eur(price), sx + 10, y + 22, 20, rb, tc);
    dt(p3, t, sx + 10, y + 50, 8, ib, GRAY);
    ln(p3, sx + 10, y + 64, sx + sW - 10, y + 64, hex("#F0ECE3"), 0.5);
    wrapText(desc, 32).forEach((l, li) => dt(p3, l, sx + 10, y + 70 + li * 12, 8, ib, hex("#46535C")));
  });
  y += 138;

  dt(p3, "Factores de ajuste de tu vehiculo", MX, y, 15, rb, INK); y += 22;
  dt(p3, "Como influyen las caracteristicas declaradas sobre el precio.", MX, y, 8.5, ib, GRAY); y += 16;

  const km = rd.vehicle.mileage != null ? Number(rd.vehicle.mileage) : null;
  const vehicleYear = rd.vehicle.year ? Number(rd.vehicle.year) : null;
  const age = vehicleYear ? new Date().getFullYear() - vehicleYear : null;
  const df2 = getDamageFactor(rd.vehicle.damageLevel);
  const adjs = [
    km != null
      ? { f: "Kilometraje", imp: km < 50000 ? "+300 EUR" : km > 150000 ? "-800 EUR" : "neutro", c2: km < 50000 ? TEAL : km > 150000 ? hex("#B4502E") : GRAY, n: km < 50000 ? "Bajo km, cotiza mejor" : km > 150000 ? "Alto km, descuento aplicado" : "Km dentro de la media" }
      : { f: "Kilometraje", imp: "sin dato", c2: GRAY, n: "Km no declarado" },
    age != null
      ? { f: "Antiguedad", imp: age <= 3 ? "+500 EUR" : age <= 7 ? "neutro" : "-400 EUR", c2: age <= 3 ? TEAL : age <= 7 ? GRAY : hex("#B4502E"), n: age <= 3 ? "Vehiculo reciente, alta valoracion" : age <= 7 ? "Antiguedad en la media" : "Vehiculo con varios anos de uso" }
      : { f: "Antiguedad", imp: "sin dato", c2: GRAY, n: "Ano no declarado" },
    { f: "Estado", imp: df2 === 1 ? "neutro" : df2 >= 0.97 ? "-150 EUR" : df2 >= 0.91 ? "-700 EUR" : "-1.500 EUR", c2: df2 === 1 ? TEAL : hex("#B4502E"), n: df2 === 1 ? "Sin danos declarados" : `Danos: ${rd.vehicle.damageLevel}` },
  ];

  fr(p3, MX, y, CW, 20, BG, BORDER, 0.5);
  [["FACTOR", 10], ["IMPACTO", 210], ["NOTA", 320]].forEach(([h, dx]) => dt(p3, h, MX + dx, y + 6, 6.5, rb, LIGHT));
  y += 20;

  adjs.forEach(({ f, imp, c2, n }, i) => {
    fr(p3, MX, y, CW, 22, i % 2 === 0 ? WHITE : hex("#FAFAFA"));
    dt(p3, f,   MX + 10,  y + 6, 9, rb, INK);
    dt(p3, imp, MX + 220, y + 6, 9, rb, c2);
    dt(p3, n,   MX + 320, y + 6, 8, ib, GRAY, CW - 330);
    y += 22;
  });

  footer(p3, null, ib);

  // ═══════════════════════════════════════════════════════
  //  PAGE 4 — CONSEJOS + METODOLOGIA
  // ═══════════════════════════════════════════════════════
  const p4 = pdfDoc.addPage([W, H]);
  runhead(p4, vLabel, 4, rb, ib);
  y = 44;

  dt(p4, "Recomendaciones para vender mejor", MX, y, 15, rb, INK); y += 22;
  dt(p4, "Aplica estos consejos para maximizar el precio y reducir el tiempo de venta.", MX, y, 8.5, ib, GRAY); y += 18;

  const tips = [
    ["Limpieza interior y exterior", "Un vehiculo limpio mejora la percepcion de valor en un 10-15%."],
    ["Fotos profesionales",          "Luz natural, fondo neutro y al menos 8-10 angulos distintos."],
    ["Historial de mantenimiento",   "Revision al dia y documentos en orden generan mas confianza."],
    ["Precio de salida estrategico", `Empieza en ${eur(rd.priceOptimal)} para tener margen de negociacion.`],
    ["Publicacion en varios portales","Presencia en Coches.net, AutoScout24 y Wallapop multiplica el alcance."],
    ["Responde rapido",              "Responder en menos de 1 hora aumenta un 60% la tasa de visita."],
    ["Horario de publicacion",       "Martes y jueves de 18-20h tienen mas trafico de compradores."],
    ["Actualiza el anuncio",         "Los portales priorizan anuncios recientes en sus algoritmos."],
  ];

  tips.forEach(([title, tip], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const tx = MX + col * (CW / 2 + 8), tyR = y + row * 46;
    dt(p4, "+", tx, tyR, 10, rb, AMBER);
    dt(p4, title, tx + 16, tyR, 9, rb, INK);
    wrapText(tip, 42).forEach((l, li) => dt(p4, l, tx + 16, tyR + 13 + li * 11, 8, ib, hex("#46535C")));
  });
  y += Math.ceil(tips.length / 2) * 46 + 16;

  dt(p4, "Metodologia y fuentes", MX, y, 15, rb, INK); y += 22;
  const methodText = "Este informe utiliza datos en tiempo real de los principales portales de venta de vehiculos de ocasion en Espana. El precio optimo se calcula como la media ponderada de ofertas activas del mismo modelo, ano y combustible, ajustada por kilometraje y estado. Los percentiles P25 y P75 delimitan el rango de precios de mercado. El tiempo estimado se basa en la mediana de dias en cartera de anuncios similares.";
  wrapText(methodText, 92).forEach((l, i) => { dt(p4, l, MX, y + i * 12, 8.5, ib, hex("#46535C")); });
  y += wrapText(methodText, 92).length * 12 + 16;

  // Disclaimer
  fr(p4, MX, y, CW, 72, BG, BORDER, 0.5);
  const disc = "AVISO LEGAL: Este informe tiene caracter informativo y no constituye una tasacion pericial oficial. Los precios son estimaciones basadas en datos de mercado publicos en el momento de la consulta. CarsWise AI no garantiza la venta al precio indicado ni asume responsabilidad por decisiones tomadas a partir de este informe. Valido 30 dias desde la fecha de emision.";
  wrapText(disc, 95).forEach((l, i) => dt(p4, l, MX + 12, y + 10 + i * 11, 7.5, ib, GRAY));

  footer(p4, `CarsWise AI · ${rd.generatedAt} · www.carswiseai.com`, ib);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// ── Public API ────────────────────────────────────────────────────────────────
async function generateSellReport(vehicle = {}) {
  const baseOptions = {
    desiredType: "compra",
    brand:   String(vehicle.brand   || ""),
    model:   String(vehicle.model   || ""),
    version: String(vehicle.version || ""),
    fuel:    String(vehicle.fuel    || ""),
    year:    vehicle.year    ? Number(vehicle.year)    : null,
    mileage: vehicle.mileage ? Number(vehicle.mileage) : null,
  };

  const national = await getMarketPriceSnapshot(baseOptions);
  const reportData = buildReportData(vehicle, national);
  const pdfBuffer  = await buildPdf(reportData);
  return { pdfBuffer, reportData };
}

module.exports = { generateSellReport };
