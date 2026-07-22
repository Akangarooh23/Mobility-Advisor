const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { getMarketPriceSnapshot } = require("./inventoryStore");

function eur(value) {
  if (!Number.isFinite(value) || value <= 0) return "–";
  return new Intl.NumberFormat("es-ES").format(Math.round(value)) + " €";
}

function eurSigned(value) {
  if (!Number.isFinite(value)) return "–";
  const abs = new Intl.NumberFormat("es-ES").format(Math.abs(Math.round(value)));
  return value >= 0 ? `+${abs} €` : `-${abs} €`;
}

function getDamageFactor(level = "") {
  const l = String(level).toLowerCase();
  if (l.includes("grave") || l.includes("major")) return 0.84;
  if (l.includes("modera") || l.includes("moderate")) return 0.91;
  if (l.includes("leve") || l.includes("minor")) return 0.97;
  return 1;
}

// Confidence now considers both sample size AND price dispersion (CV)
function confidencePct(comparables, cv = null) {
  let base;
  if (comparables >= 80) base = 88;
  else if (comparables >= 40) base = 78;
  else if (comparables >= 15) base = 65;
  else if (comparables >= 5)  base = 50;
  else                        base = 35;

  if (cv != null) {
    if (cv > 0.35)      base = Math.max(base - 15, 28); // very high variance → low confidence
    else if (cv > 0.20) base = Math.max(base - 7,  35);
    else if (cv < 0.10) base = Math.min(base + 5,  94); // tight price cluster → boost
  }
  return Math.round(base);
}

function demandLabel(comparables, days) {
  if (comparables >= 80 && (days == null || days <= 40)) return "ALTO";
  if (comparables >= 30) return "MEDIO";
  return "BAJO";
}

function buildReportData(vehicle, national) {
  const df      = getDamageFactor(vehicle.damageLevel);
  const median  = national.market?.median || 0;
  const p25     = national.market?.p25    || 0;
  const p75     = national.market?.p75    || 0;
  const days    = national.market?.daysOnMarketMedian;
  const comps   = national.comparables || 0;
  const cv      = national.market?.cv   ?? null;
  const kmImpact  = national.market?.kmImpact  || 0;
  const ageImpact = national.market?.ageImpact || 0;

  // Base price = market MEDIAN (robust to outliers) × damage factor
  const base     = Math.round(median * df);
  const baseLow  = Math.round(p25    * df);
  const baseHigh = Math.round(p75    * df);

  // Apply data-driven km and age adjustments (from linear regression on comparables)
  const totalAdj     = kmImpact + ageImpact;
  const priceOptimal = Math.max(0, base     + totalAdj);
  const priceLow     = Math.max(0, baseLow  + Math.round(totalAdj * 0.70));
  const priceHigh    = Math.max(0, baseHigh + Math.round(totalAdj * 1.25));

  return {
    vehicle,
    priceOptimal,
    priceLow,
    priceHigh,
    comparables:    comps,
    rawComparables: national.rawComparables || comps,
    days,
    confidence:  confidencePct(comps, cv),
    demand:      demandLabel(comps, days),
    byPortal:    (national.byPortal || []).slice(0, 6),
    histogram:   national.priceHistogram || [],
    generatedAt: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
    kmImpact,
    ageImpact,
    damageFactor: df,
    aiAnalysis: null, // populated by generateSellReport
  };
}

// ── AI qualitative analysis via Gemini ───────────────────────────────────────
async function callGeminiAnalysis(rd) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const v = rd.vehicle;
  const prompt = `Eres un analista experto en el mercado de vehículos de ocasión en España. Analiza este vehículo.

VEHÍCULO: ${v.brand || ""} ${v.model || ""} ${v.version || ""} | Año ${v.year || "–"} | ${v.mileage ? new Intl.NumberFormat("es-ES").format(v.mileage) + " km" : "km no indicados"} | ${v.fuel || "combustible no indicado"}
ESTADO: ${v.damageLevel || "Sin daños"}${v.damageDescription ? " – " + v.damageDescription : ""}
DATOS DE MERCADO: Precio óptimo ${rd.priceOptimal}€ · Rango ${rd.priceLow}€–${rd.priceHigh}€ · ${rd.comparables} comparables · Confianza ${rd.confidence}%${rd.days ? ` · ${rd.days} días medianos en cartera` : ""}

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin texto fuera del JSON):
{
  "analisisMercado": "2-3 frases sobre la situación actual de demanda de este modelo en España",
  "factoresClave": ["factor específico 1", "factor específico 2", "factor específico 3"],
  "margenNegociacion": { "pct": 5, "estrategia": "frase corta de cómo negociar" },
  "consejosPersonalizados": ["consejo 1 específico para este coche", "consejo 2", "consejo 3"]
}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);

    let responseText = null;
    for (const modelName of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.25, maxOutputTokens: 600 },
            }),
            signal: ctrl.signal,
          }
        );
        if (res.ok) {
          const json = await res.json();
          responseText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) break;
        }
      } catch { /* try next model */ }
    }
    clearTimeout(timer);
    if (!responseText) return null;

    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
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
const GREEN  = hex("#1A6B3C");
const RED    = hex("#B4502E");

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

  const compsLabel = rd.rawComparables > rd.comparables
    ? `Basado en ${rd.comparables} comparables validos (${rd.rawComparables - rd.comparables} atipicos excluidos)`
    : `Basado en ${rd.comparables} comparables activos en portales`;
  dt(p1, compsLabel, MX + 14, y + 68, 7.5, ib, GRAY);

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

  // Unit-weighted total (corrects the mean-of-means bias)
  const totalAvgPrice = totalUnits > 0
    ? Math.round(rd.byPortal.reduce((s, r) => s + (r.avgPrice || 0) * r.units, 0) / totalUnits)
    : null;
  fr(p2, MX, y, CW, 24, hex("#FBF4E9"));
  dt(p2, "TOTAL", tcols[0], y + 7, 9, rb, AMBER);
  dt(p2, String(totalUnits), tcols[1], y + 7, 9, rb, AMBER);
  dt(p2, eur(totalAvgPrice), tcols[2], y + 7, 9, rb, AMBER);
  y += 34;

  dt(p2, "Distribucion de precios en el mercado", MX, y, 15, rb, INK); y += 22;
  dt(p2, "Concentracion de anuncios por tramo de precio (outliers excluidos).", MX, y, 8.5, ib, GRAY); y += 14;

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
  //  PAGE 3 — ESTRATEGIA + FACTORES (con ajustes reales)
  // ═══════════════════════════════════════════════════════
  const p3 = pdfDoc.addPage([W, H]);
  runhead(p3, vLabel, 3, rb, ib);
  y = 44;

  dt(p3, "Estrategia de venta recomendada", MX, y, 15, rb, INK); y += 22;
  dt(p3, "Tres escenarios segun tu objetivo: rapido, equilibrado o maximo precio.", MX, y, 8.5, ib, GRAY); y += 18;

  const scenarios = [
    { tag: "VENTA RAPIDA", price: rd.priceLow,     t: rd.days ? `${Math.round(rd.days*0.5)}-${Math.round(rd.days*0.7)} d.` : "15-25 dias", bg: hex("#F2F7F7"), tc: TEAL,   desc: "Precio competitivo. Ideal si necesitas liquidez." },
    { tag: "EQUILIBRADO",  price: rd.priceOptimal, t: rd.days ? `${Math.round(rd.days*0.8)}-${Math.round(rd.days*1.2)} d.` : "30-45 dias", bg: hex("#FBF4E9"), tc: AMBER,  desc: "Precio de mediana de mercado. Mejor relacion tiempo/valor.", reco: true },
    { tag: "MAXIMO VALOR", price: rd.priceHigh,    t: rd.days ? `${Math.round(rd.days*1.4)}-${Math.round(rd.days*1.9)} d.` : "50-75 dias", bg: hex("#F4F2F7"), tc: hex("#5B4B8A"), desc: "Por encima de la mediana. Requiere paciencia." },
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

  // Adjustment factors — DATA-DRIVEN values from linear regression
  dt(p3, "Factores de ajuste calculados para este vehiculo", MX, y, 15, rb, INK); y += 22;
  dt(p3, "Impacto en precio calculado a partir de los comparables reales del mercado.", MX, y, 8.5, ib, GRAY); y += 16;

  const km = rd.vehicle.mileage != null ? Number(rd.vehicle.mileage) : null;
  const vehicleYear = rd.vehicle.year ? Number(rd.vehicle.year) : null;
  const age = vehicleYear ? new Date().getFullYear() - vehicleYear : null;

  const kmImpactColor  = rd.kmImpact  > 50 ? GREEN : rd.kmImpact  < -50 ? RED : GRAY;
  const ageImpactColor = rd.ageImpact > 50 ? GREEN : rd.ageImpact < -50 ? RED : GRAY;
  const dmgColor = rd.damageFactor === 1 ? GREEN : RED;

  const adjs = [
    {
      f: "Kilometraje",
      imp: Math.abs(rd.kmImpact) > 50 ? eurSigned(rd.kmImpact) : "neutro",
      c2: kmImpactColor,
      n: km != null
        ? (rd.kmImpact > 50 ? `Bajo km respecto al mercado (+${new Intl.NumberFormat("es-ES").format(km)} km vs media)` : rd.kmImpact < -50 ? `Alto km respecto al mercado (${new Intl.NumberFormat("es-ES").format(km)} km vs media)` : `Km dentro de la media del mercado (${new Intl.NumberFormat("es-ES").format(km)} km)`)
        : "Km no declarado",
    },
    {
      f: "Antiguedad",
      imp: Math.abs(rd.ageImpact) > 50 ? eurSigned(rd.ageImpact) : "neutro",
      c2: ageImpactColor,
      n: age != null
        ? (rd.ageImpact > 50 ? `Vehiculo mas reciente que la media del mercado (${age} anos)` : rd.ageImpact < -50 ? `Vehiculo mas antiguo que la media del mercado (${age} anos)` : `Antiguedad en linea con el mercado (${age} anos)`)
        : "Ano no declarado",
    },
    {
      f: "Estado / Danos",
      imp: rd.damageFactor === 1 ? "neutro" : `×${rd.damageFactor.toFixed(2)} (${Math.round((1 - rd.damageFactor) * 100)}% descuento)`,
      c2: dmgColor,
      n: rd.damageFactor === 1 ? "Sin danos declarados" : `Danos ${rd.vehicle.damageLevel || "declarados"} aplicados al precio`,
    },
  ];

  fr(p3, MX, y, CW, 20, BG, BORDER, 0.5);
  [["FACTOR", 10], ["IMPACTO", 200], ["NOTA", 300]].forEach(([h, dx]) => dt(p3, h, MX + dx, y + 6, 6.5, rb, LIGHT));
  y += 20;

  adjs.forEach(({ f, imp, c2, n }, i) => {
    fr(p3, MX, y, CW, 22, i % 2 === 0 ? WHITE : hex("#FAFAFA"));
    dt(p3, f,   MX + 10,  y + 6, 9, rb, INK);
    dt(p3, imp, MX + 210, y + 6, 9, rb, c2);
    dt(p3, n,   MX + 310, y + 6, 7.5, ib, GRAY, CW - 320);
    y += 22;
  });

  footer(p3, null, ib);

  // ═══════════════════════════════════════════════════════
  //  PAGE 4 — IA + CONSEJOS + METODOLOGIA
  // ═══════════════════════════════════════════════════════
  const p4 = pdfDoc.addPage([W, H]);
  runhead(p4, vLabel, 4, rb, ib);
  y = 44;

  const ai = rd.aiAnalysis;

  if (ai) {
    // AI market analysis section
    dt(p4, "Analisis de Inteligencia de Mercado", MX, y, 15, rb, INK); y += 22;
    dt(p4, "Generado por IA a partir de los datos de mercado de tu vehiculo.", MX, y, 8.5, ib, GRAY); y += 14;

    fr(p4, MX, y, CW, 2, TEAL);  y += 8;
    wrapText(ai.analisisMercado || "", 90).forEach((l) => { dt(p4, l, MX, y, 9, ib, hex("#46535C")); y += 13; });
    y += 8;

    // Key factors
    if (Array.isArray(ai.factoresClave) && ai.factoresClave.length) {
      dt(p4, "Factores clave para este coche:", MX, y, 9, rb, INK); y += 14;
      ai.factoresClave.forEach((f) => {
        dt(p4, "•", MX, y, 9, rb, AMBER);
        wrapText(f, 86).forEach((l) => { dt(p4, l, MX + 12, y, 8.5, ib, hex("#46535C")); y += 12; });
        y += 2;
      });
      y += 6;
    }

    // Negotiation margin
    if (ai.margenNegociacion?.pct) {
      fr(p4, MX, y, CW, 28, hex("#F2F7F7"), BORDER, 0.5);
      dt(p4, `Margen de negociacion estimado: ${ai.margenNegociacion.pct}%`, MX + 10, y + 7, 9, rb, TEAL);
      if (ai.margenNegociacion.estrategia) {
        dt(p4, ai.margenNegociacion.estrategia, MX + 10, y + 19, 8, ib, GRAY);
      }
      y += 38;
    }

    // Personalized tips from AI
    dt(p4, "Consejos personalizados para tu vehiculo", MX, y, 13, rb, INK); y += 18;
    if (Array.isArray(ai.consejosPersonalizados)) {
      ai.consejosPersonalizados.forEach((tip, i) => {
        const cx = MX + (i % 2) * (CW / 2 + 8);
        const tyR = y + Math.floor(i / 2) * 44;
        dt(p4, "+", cx, tyR, 10, rb, AMBER);
        wrapText(tip, 42).forEach((l, li) => dt(p4, l, cx + 14, tyR + li * 12, 8, ib, hex("#46535C")));
      });
      y += Math.ceil((ai.consejosPersonalizados.length || 0) / 2) * 44 + 10;
    }
  } else {
    // Fallback: generic tips
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
  }

  // Methodology
  dt(p4, "Metodologia y fuentes", MX, y, 13, rb, INK); y += 18;
  const methodText = "Este informe utiliza datos en tiempo real de los principales portales de venta de vehiculos de ocasion en Espana. El precio optimo se calcula como la mediana de la muestra de comparables una vez eliminados los valores atipicos (metodo IQR de Tukey). Los ajustes por kilometraje y antiguedad se derivan de regresion lineal sobre los propios comparables. Los percentiles P25 y P75 delimitan el rango de precios de mercado.";
  let my = y;
  wrapText(methodText, 92).forEach((l) => { dt(p4, l, MX, my, 8, ib, hex("#46535C")); my += 12; });
  y = my + 14;

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
    mileage: vehicle.mileage ? Number(String(vehicle.mileage).replace(/\./g, "").replace(/,/g, ".")) : null,
  };

  const national   = await getMarketPriceSnapshot(baseOptions);
  const reportData = buildReportData(vehicle, national);

  // AI qualitative layer (non-blocking — graceful fallback to generic tips)
  reportData.aiAnalysis = await callGeminiAnalysis(reportData).catch(() => null);

  const pdfBuffer = await buildPdf(reportData);
  return { pdfBuffer, reportData };
}

module.exports = { generateSellReport };
