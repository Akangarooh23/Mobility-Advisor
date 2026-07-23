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

// ── Damage factor (hardcoded fallback used when Gemini is unavailable) ────────
function getDamageFactor(level = "") {
  const l = String(level).toLowerCase();
  if (l.includes("grave") || l.includes("major"))    return 0.84;
  if (l.includes("modera") || l.includes("moderate")) return 0.91;
  if (l.includes("leve") || l.includes("minor"))     return 0.97;
  return 1;
}

// ── ZBE (Zero Emission Zone) restriction — Spain ─────────────────────────────
function getZbeFlag(year, fuel) {
  const y = Number(year) || 0;
  const f = (fuel || "").toLowerCase();
  if (y > 0 && y <= 2014 && (f.includes("diesel") || f.includes("gasoil"))) {
    return {
      norm:   "Euro 5 (estimado)",
      detail: "Diesel matriculado hasta 2014 — sin acceso libre a las ZBE de Madrid, Barcelona y otras ciudades.",
      impact: "Reduce la demanda y el precio un 8-15% vs. equivalente Euro 6.",
    };
  }
  if (y > 0 && y <= 2000 && !f.includes("diesel") && !f.includes("electri") && !f.includes("hibrid")) {
    return {
      norm:   "Euro 3 (estimado)",
      detail: "Gasolina matriculada hasta 2000 — puede tener restricciones en ZBE avanzadas.",
      impact: "Consultar normativa local antes de fijar precio.",
    };
  }
  return null;
}

// ── DGT environmental label — derived from year + fuel ───────────────────────
function getEnvLabel(year, fuel) {
  const y = Number(year) || 0;
  const f = (fuel || "").toLowerCase();
  if (f.includes("electri") || f.includes("hidrogen")) {
    return { code: "0",   hex: "#1A6B3C", bg: "#DCFCE7", detail: "Electrico/hidrogeno — acceso libre a todas las ZBE" };
  }
  if (f.includes("enchuf") || f.includes("plug") || f.includes("phev")) {
    return { code: "0",   hex: "#1A6B3C", bg: "#DCFCE7", detail: "Hibrido enchufable — acceso libre a ZBE" };
  }
  if (f.includes("hibrid") || f.includes("hybrid")) {
    return { code: "ECO", hex: "#0369A1", bg: "#E0F2FE", detail: "Hibrido — acceso preferente en ZBE, estacionamiento gratuito" };
  }
  const isDiesel = f.includes("diesel") || f.includes("gasoil");
  if (isDiesel) {
    if (y >= 2015) return { code: "C",   hex: "#1D4ED8", bg: "#DBEAFE", detail: "Etiqueta C (Euro 6) — circulacion normal salvo episodios de alta contaminacion" };
    if (y >= 2011) return { code: "B",   hex: "#92400E", bg: "#FEF3C7", detail: "Etiqueta B (Euro 5) — restringido en ZBE activas" };
    return             { code: "sin", hex: "#B91C1C", bg: "#FEE2E2", detail: "Sin etiqueta DGT — acceso muy limitado o nulo en ZBE" };
  }
  if (y >= 2006) return   { code: "C",   hex: "#1D4ED8", bg: "#DBEAFE", detail: "Etiqueta C — circulacion normal" };
  if (y >= 2000) return   { code: "B",   hex: "#92400E", bg: "#FEF3C7", detail: "Etiqueta B — posibles restricciones en ZBE" };
  return                  { code: "sin", hex: "#B91C1C", bg: "#FEE2E2", detail: "Sin etiqueta DGT" };
}

// ── ITV status warning ────────────────────────────────────────────────────────
function getItvWarning(itvStatus) {
  const s = (itvStatus || "").toLowerCase().trim();
  if (s === "caducada") {
    return { level: "danger", label: "ITV CADUCADA", detail: "La ITV ha vencido — el comprador lo usara como argumento de descuento fuerte (coste ITV + posibles reparaciones)." };
  }
  if (s === "pronto") {
    return { level: "warn", label: "ITV proxima (<6 meses)", detail: "La ITV vence pronto — el comprador asumira ese gasto. Ajusta el precio aprox. 70-150 EUR a la baja o renuvala antes de vender." };
  }
  return null;
}

// ── Color market liquidity factor ─────────────────────────────────────────────
const COLOR_ADJUSTMENTS = {
  blanco: 0.00, negro: 0.00, plata: 0.00,
  gris: -0.01, azul: -0.01, rojo: -0.01,
  verde: -0.02, beige: -0.02, crema: -0.02,
  marron: -0.05, naranja: -0.04, amarillo: -0.04,
  morado: -0.05, violeta: -0.05, rosa: -0.05,
  otro: -0.02,
};

function getColorAdj(color = "") {
  const c = color.toLowerCase().trim();
  for (const [key, adj] of Object.entries(COLOR_ADJUSTMENTS)) {
    if (c.includes(key)) return { factor: 1 + adj, pct: Math.round(adj * 100), label: key };
  }
  return { factor: 1.0, pct: 0, label: "" };
}

// ── Owner count + service history factor ─────────────────────────────────────
// owners: "1" | "2" | "3"  (3 = 3+)
// serviceHistory: "oficial" | "parcial" | "sin"
const OWNER_HISTORY_MATRIX = {
  "1-oficial": 0.07, "1-parcial": 0.03, "1-sin": 0.00,
  "2-oficial": 0.02, "2-parcial": 0.00, "2-sin": -0.03,
  "3-oficial":-0.02, "3-parcial":-0.05, "3-sin": -0.08,
};

function getOwnerHistoryFactor(owners, serviceHistory) {
  const o = String(owners || "").trim();
  const h = String(serviceHistory || "").toLowerCase().trim();
  if (!o && !h) return { factor: 1.0, pct: 0 };
  const oKey = o === "1" ? "1" : o === "2" ? "2" : o ? "3" : null;
  const hKey = h === "oficial" ? "oficial" : h === "parcial" ? "parcial" : h === "sin" ? "sin" : null;
  if (!oKey && !hKey) return { factor: 1.0, pct: 0 };
  // Partial info: only owner count or only history
  if (oKey && !hKey) {
    const avg = (OWNER_HISTORY_MATRIX[`${oKey}-oficial`] + OWNER_HISTORY_MATRIX[`${oKey}-parcial`] + OWNER_HISTORY_MATRIX[`${oKey}-sin`]) / 3;
    return { factor: 1 + avg, pct: Math.round(avg * 100) };
  }
  if (!oKey && hKey) {
    const keys = ["1", "2", "3"].map((o2) => OWNER_HISTORY_MATRIX[`${o2}-${hKey}`]);
    const avg = keys.reduce((a, v) => a + v, 0) / keys.length;
    return { factor: 1 + avg, pct: Math.round(avg * 100) };
  }
  const adj = OWNER_HISTORY_MATRIX[`${oKey}-${hKey}`] ?? 0;
  return { factor: 1 + adj, pct: Math.round(adj * 100) };
}

// ── Depreciation fallback (used when comparables < 3) ────────────────────────
const BRAND_TIERS = [
  {
    tier: "luxury",
    refPrice: 120000,
    brands: ["ferrari", "lamborghini", "bentley", "rolls-royce", "rolls royce", "aston martin", "mclaren"],
  },
  {
    tier: "premium",
    refPrice: 62000,
    brands: ["porsche", "maserati", "jaguar", "lexus", "genesis"],
  },
  {
    tier: "premium_entry",
    refPrice: 38000,
    brands: ["bmw", "mercedes", "audi", "volvo", "alfa romeo", "alfa", "mini", "cupra", "land rover", "infiniti"],
  },
  {
    tier: "mainstream",
    refPrice: 23000,
    brands: ["volkswagen", "vw", "toyota", "ford", "opel", "vauxhall", "peugeot", "citroen", "renault",
             "seat", "skoda", "hyundai", "kia", "nissan", "mazda", "honda", "mitsubishi",
             "fiat", "jeep", "suzuki", "subaru", "chevrolet", "dodge", "tesla"],
  },
  {
    tier: "economy",
    refPrice: 15000,
    brands: ["dacia", "mg", "lada", "microcar", "ligier", "aixam", "smart"],
  },
];

function getBrandRefPrice(brand = "") {
  const b = brand.toLowerCase().trim();
  for (const entry of BRAND_TIERS) {
    if (entry.brands.some((n) => b.includes(n) || n.includes(b))) return entry.refPrice;
  }
  return 22000;
}

// Cumulative residual value (% of new price) by integer year of age
const DEPR_TABLE = [1.00, 0.80, 0.67, 0.57, 0.49, 0.43, 0.38, 0.33, 0.29, 0.26, 0.23];

function standardDepreciationFactor(age) {
  if (age <= 0) return 1.00;
  if (age >= DEPR_TABLE.length - 1) {
    return Math.max(0.08, DEPR_TABLE[DEPR_TABLE.length - 1] * Math.pow(0.91, age - (DEPR_TABLE.length - 1)));
  }
  const lo = Math.floor(age), hi = lo + 1;
  return DEPR_TABLE[lo] + (DEPR_TABLE[hi] - DEPR_TABLE[lo]) * (age - lo);
}

function estimatePriceByDepreciation(vehicle, referenceDate) {
  const refYear = (referenceDate || new Date()).getFullYear();
  const age = vehicle.year ? refYear - Number(vehicle.year) : null;
  if (age == null || age < 0) return null;

  const refPrice = getBrandRefPrice(vehicle.brand || "");
  const base     = Math.round(refPrice * standardDepreciationFactor(age));

  // Simple km adjustment: Spain avg ~15,000 km/year
  const km = vehicle.mileage ? Number(vehicle.mileage) : null;
  let kmAdj = 0;
  if (km != null && age > 0) {
    const expectedKm = age * 15000;
    const excess     = km - expectedKm;
    const rawAdj     = excess > 0 ? -(excess * 0.08) : -(excess * 0.05);
    const cap        = base * 0.15;
    kmAdj = Math.round(Math.max(-cap, Math.min(cap, rawAdj)));
  }

  return {
    optimal:  Math.max(0, base + kmAdj),
    low:      Math.max(0, Math.round(base * 0.90) + kmAdj),
    high:     Math.max(0, Math.round(base * 1.10) + kmAdj),
    refPrice,
    age,
  };
}

// ── Confidence scoring ────────────────────────────────────────────────────────
function confidencePct(comparables, cv = null, usedFallback = false) {
  if (usedFallback) return 35;

  let base;
  if (comparables >= 80) base = 88;
  else if (comparables >= 40) base = 78;
  else if (comparables >= 15) base = 65;
  else if (comparables >= 5)  base = 50;
  else                        base = 35;

  if (cv != null) {
    if (cv > 0.35)      base = Math.max(base - 15, 28);
    else if (cv > 0.20) base = Math.max(base - 7,  35);
    else if (cv < 0.10) base = Math.min(base + 5,  94);
  }
  return Math.round(base);
}

function demandLabel(comparables, days) {
  if (comparables >= 80 && (days == null || days <= 40)) return "ALTO";
  if (comparables >= 30) return "MEDIO";
  return "BAJO";
}

// ── Report data builder ───────────────────────────────────────────────────────
// damageFactor: explicit override (from Gemini); null = use hardcoded table
// referenceDate: inject a fixed Date for testing; defaults to now (production)
function buildReportData(vehicle, national, damageFactor = null, referenceDate = null) {
  const refDate = referenceDate || new Date();
  const df  = damageFactor != null ? damageFactor : getDamageFactor(vehicle.damageLevel);
  const mkt = national.market || {};
  const days = mkt.daysOnMarketMedian;
  const comps = national.comparables || 0;
  const cv    = mkt.cv ?? null;

  // Use private-seller median when we have enough data (cleaner price signal)
  // Fall back to combined median so the model always has a reference
  const hasPrivate  = (mkt.privateCount || 0) >= 5 && mkt.privateMedian;
  const median = hasPrivate ? mkt.privateMedian : (mkt.median || 0);
  const p25    = hasPrivate ? (mkt.privateP25 || mkt.p25 || 0) : (mkt.p25 || 0);
  const p75    = hasPrivate ? (mkt.privateP75 || mkt.p75 || 0) : (mkt.p75 || 0);

  let base, baseLow, baseHigh, usedFallback, fallbackRefPrice;

  if (comps >= 3 && median > 0) {
    usedFallback     = false;
    fallbackRefPrice = null;
    base     = Math.round(median * df);
    baseLow  = Math.round(p25    * df);
    baseHigh = Math.round(p75    * df);
  } else {
    usedFallback = true;
    const est = estimatePriceByDepreciation(vehicle, refDate);
    if (est && est.optimal > 0) {
      fallbackRefPrice = est.refPrice;
      base     = Math.round(est.optimal * df);
      baseLow  = Math.round(est.low     * df);
      baseHigh = Math.round(est.high    * df);
    } else {
      fallbackRefPrice = null;
      base = baseLow = baseHigh = 0;
    }
  }

  // km/age regression adjustments only valid when we have real comparables
  const kmImpact  = !usedFallback ? (national.market?.kmImpact  || 0) : 0;
  const ageImpact = !usedFallback ? (national.market?.ageImpact || 0) : 0;
  const totalAdj  = kmImpact + ageImpact;

  // Color liquidity factor
  const colorAdj = getColorAdj(vehicle.color || "");
  // Owner count + service history factor
  const ownerAdj = getOwnerHistoryFactor(vehicle.owners, vehicle.serviceHistory);
  // Combined multiplier (color × owner/history — both independent of market adjustment)
  const combinedFactor = colorAdj.factor * ownerAdj.factor;

  return {
    vehicle,
    priceOptimal:    Math.max(0, Math.round((base     + totalAdj) * combinedFactor)),
    priceLow:        Math.max(0, Math.round((baseLow  + Math.round(totalAdj * 0.70)) * combinedFactor)),
    priceHigh:       Math.max(0, Math.round((baseHigh + Math.round(totalAdj * 1.25)) * combinedFactor)),
    comparables:     comps,
    rawComparables:  national.rawComparables || comps,
    days,
    confidence:      confidencePct(comps, cv, usedFallback),
    demand:          demandLabel(comps, days),
    byPortal:        (national.byPortal || []).slice(0, 6),
    histogram:       national.priceHistogram || [],
    samples:         national.samples || [],
    priceTrend:      mkt.priceTrend   || null,
    absorptionRate:  mkt.absorptionRate ?? null,
    privateMedian:   mkt.privateMedian ?? null,
    dealerMedian:    mkt.dealerMedian  ?? null,
    privateCount:    mkt.privateCount  || 0,
    dealerCount:     mkt.dealerCount   || 0,
    usedPrivate:     hasPrivate,
    generatedAt:     refDate.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
    kmImpact,
    ageImpact,
    colorAdj,
    ownerAdj,
    damageFactor:    df,
    aiDamageFactor:  damageFactor,
    zbeFlag:         getZbeFlag(vehicle.year, vehicle.fuel),
    envLabel:        getEnvLabel(vehicle.year, vehicle.fuel),
    itvWarning:      getItvWarning(vehicle.itvStatus),
    dealerP25:       mkt.dealerP25   ?? null,
    dealerP75:       mkt.dealerP75   ?? null,
    usedFallback,
    fallbackRefPrice,
    aiAnalysis:      null,
  };
}

// ── Gemini: market analysis + semantic damage factor ─────────────────────────
async function callGeminiAnalysis(rd) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const v         = rd.vehicle;
  const hasDamage = v.damageLevel && !String(v.damageLevel).toLowerCase().includes("sin");
  const damageCtx = hasDamage
    ? `\nDAÑOS: nivel "${v.damageLevel}"${v.damageDescription ? `, descripcion: "${v.damageDescription}"` : ""}. Calcula el factor de descuento apropiado (campo damageFactor, rango 0.60-0.99).`
    : `\nESTADO: Sin daños declarados. damageFactor debe ser 1.00.`;

  const marketCtx = rd.usedFallback
    ? "Sin comparables activos — estimacion por depreciacion estandar."
    : `Precio optimo ${rd.priceOptimal}€ · Rango ${rd.priceLow}€–${rd.priceHigh}€ · ${rd.comparables} comparables · Confianza ${rd.confidence}%${rd.days ? ` · ${rd.days} dias medianos en cartera` : ""}`;

  const prompt = `Eres un analista experto en el mercado de vehículos de ocasión en España.

VEHÍCULO: ${v.brand || ""} ${v.model || ""} ${v.version || ""} | Año ${v.year || "–"} | ${v.mileage ? new Intl.NumberFormat("es-ES").format(v.mileage) + " km" : "km no indicados"} | ${v.fuel || "combustible no indicado"}${damageCtx}
DATOS DE MERCADO: ${marketCtx}

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin texto fuera del JSON):
{
  "damageFactor": 1.00,
  "analisisMercado": "2-3 frases sobre la situación actual de demanda de este modelo en España",
  "factoresClave": ["factor específico 1", "factor específico 2", "factor específico 3"],
  "margenNegociacion": { "pct": 5, "estrategia": "frase corta de cómo negociar" },
  "consejosPersonalizados": ["consejo 1 específico para este coche", "consejo 2", "consejo 3"]
}

Para damageFactor: 1.00 = sin daños; 0.97 = cosmético mínimo; 0.91 = carrocería moderada; 0.84 = mecánico/estructural importante; 0.70 = daño grave múltiple. Sé preciso según la descripción real.`;

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);

    let responseText = null;
    for (const modelName of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              contents:         [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
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
    const parsed = JSON.parse(match[0]);

    // Validate damageFactor
    if (typeof parsed.damageFactor !== "number" || parsed.damageFactor < 0.60 || parsed.damageFactor > 1.00) {
      parsed.damageFactor = null;
    }
    return parsed;
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
const WARN   = hex("#7A3B0A");
const WARNBG = hex("#FFF4E0");

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
  const words = String(text || "").split(" ");
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

  // Fallback notice banner
  if (rd.usedFallback) {
    fr(p1, MX, y, CW, 26, WARNBG, hex("#D08020"), 0.8);
    dt(p1, "Sin comparables activos — precio estimado por curva de depreciacion estandar", MX + 10, y + 8, 8, rb, WARN);
    y += 34;
  }

  // ZBE restriction warning
  if (rd.zbeFlag) {
    fr(p1, MX, y, CW, 36, hex("#FEF2F2"), hex("#DC2626"), 0.8);
    dt(p1, "ATENCION: RESTRICCION ZBE", MX + 10, y + 8, 8, rb, hex("#991B1B"));
    dt(p1, rd.zbeFlag.detail, MX + 10, y + 20, 7.5, ib, hex("#991B1B"), CW - 20);
    y += 44;
  }

  // ITV warning
  if (rd.itvWarning) {
    const itvBg     = rd.itvWarning.level === "danger" ? hex("#FEF2F2") : WARNBG;
    const itvBorder = rd.itvWarning.level === "danger" ? hex("#DC2626") : hex("#D08020");
    const itvInk    = rd.itvWarning.level === "danger" ? hex("#991B1B") : WARN;
    fr(p1, MX, y, CW, 36, itvBg, itvBorder, 0.8);
    dt(p1, rd.itvWarning.label, MX + 10, y + 8, 8, rb, itvInk);
    dt(p1, rd.itvWarning.detail, MX + 10, y + 20, 7.5, ib, itvInk, CW - 20);
    y += 44;
  }

  // Vehicle card
  fr(p1, MX, y, CW, 130, BG, BORDER, 0.7);
  dt(p1, vLabel, MX + 14, y + 12, 15, rb, INK);
  if (rd.vehicle.plate) dt(p1, rd.vehicle.plate.toUpperCase(), MX + 14, y + 32, 8, rb, hex("#46535C"));
  // DGT environmental label badge (top-right corner of vehicle card)
  if (rd.envLabel) {
    const el = rd.envLabel;
    const bW = el.code === "ECO" ? 38 : 26;
    fr(p1, MX + CW - bW - 12, y + 8, bW, 20, hex(el.bg), hex(el.hex), 0.8);
    dt(p1, el.code, MX + CW - bW - 12 + (bW - rb.widthOfTextAtSize(el.code, 8.5)) / 2, y + 13, 8.5, rb, hex(el.hex));
  }

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

  // Verdict box — expand height when we have private/dealer split data
  const hasCompData = !rd.usedFallback && (rd.privateMedian || rd.dealerMedian);
  const verdictH    = hasCompData ? 182 : 148;
  fr(p1, MX, y, CW, verdictH, hex("#FFFDFA"), AMBER, 1.2);
  dt(p1, "PRECIO DE PUBLICACION RECOMENDADO", MX + 14, y + 12, 6.5, rb, AMBER);
  dt(p1, eur(rd.priceOptimal), MX + 14, y + 24, 38, rb, INK);

  const badgeX = MX + CW - 90;
  fr(p1, badgeX, y + 18, 76, 54, hex("#E8F4F3"));
  dt(p1, `${rd.confidence}%`, badgeX + 8, y + 24, 28, rb, TEAL);
  dt(p1, "CONFIANZA", badgeX + 14, y + 56, 7, ib, GRAY);

  const compsLabel = rd.usedFallback
    ? `Estimacion sin datos de mercado · ${rd.fallbackRefPrice ? `ref. marca ${eur(rd.fallbackRefPrice)}` : "curva estandar"}`
    : rd.usedPrivate
    ? `Basado en ${rd.privateCount} anuncios de particulares · ${rd.dealerCount} de concesionarios excluidos del precio base`
    : rd.rawComparables > rd.comparables
    ? `Basado en ${rd.comparables} comparables validos (${rd.rawComparables - rd.comparables} atipicos excluidos)`
    : `Basado en ${rd.comparables} comparables activos en portales`;
  dt(p1, compsLabel, MX + 14, y + 68, 7.5, ib, GRAY);

  const barY = y + 84, barBW = CW - 100;
  const priceRange = (rd.priceHigh - rd.priceLow) || 1;
  const optPct     = Math.max(0.05, Math.min(0.95, (rd.priceOptimal - rd.priceLow) / priceRange));
  const optPx      = Math.round(barBW * optPct);
  fr(p1, MX + 14, barY, barBW, 10, hex("#E7EFEF"));
  fr(p1, MX + 14, barY, optPx, 10, TEAL);
  fr(p1, MX + 14 + optPx - Math.round(barBW * 0.06), barY, Math.round(barBW * 0.12), 10, AMBER);
  fr(p1, MX + 14 + optPx + Math.round(barBW * 0.06), barY, barBW - optPx - Math.round(barBW * 0.06), 10, TEAL);
  fr(p1, MX + 14 + optPx - 1, barY - 3, 3, 16, INK);
  dt(p1, eur(rd.priceLow),     MX + 14,              barY + 14, 8, ib, GRAY);
  dt(p1, `${eur(rd.priceOptimal)} pub.`, MX + 14 + Math.max(4, optPx - 30), barY + 14, 8, rb, AMBER);
  dt(p1, eur(rd.priceHigh),    MX + 14 + barBW - 40, barY + 14, 8, ib, GRAY);

  // Private vs dealer quick comparison row
  if (hasCompData) {
    const rowY  = barY + 32;
    const halfW = Math.floor((CW - 28) / 2);
    fr(p1, MX + 14, rowY, CW - 28, 30, hex("#F2F7F7"));
    ln(p1, MX + 14 + halfW, rowY, MX + 14 + halfW, rowY + 30, BORDER, 0.5);
    // Left: particular
    dt(p1, "MERCADO PARTICULAR", MX + 20, rowY + 5, 6, rb, TEAL);
    if (rd.privateMedian) {
      dt(p1, eur(rd.privateMedian), MX + 20, rowY + 14, 9.5, rb, TEAL);
      if (rd.privateCount) dt(p1, `${rd.privateCount} anunc.`, MX + 20 + rb.widthOfTextAtSize(eur(rd.privateMedian), 9.5) + 6, rowY + 17, 7, ib, GRAY);
    } else {
      dt(p1, "Sin datos suficientes", MX + 20, rowY + 14, 8, ib, GRAY);
    }
    // Right: concesionario
    const rxL = MX + 14 + halfW + 8;
    dt(p1, "CONCESIONARIOS", rxL, rowY + 5, 6, rb, GRAY);
    if (rd.dealerMedian) {
      const diff = rd.dealerMedian - rd.priceOptimal;
      dt(p1, eur(rd.dealerMedian), rxL, rowY + 14, 9.5, rb, INK);
      if (diff > 100) dt(p1, `(+${eur(diff)} mas)`, rxL + rb.widthOfTextAtSize(eur(rd.dealerMedian), 9.5) + 6, rowY + 17, 7, ib, GRAY);
      if (rd.dealerCount) dt(p1, `${rd.dealerCount} anunc.`, rxL, rowY + 25, 6.5, ib, LIGHT);
    } else {
      dt(p1, "Sin datos suficientes", rxL, rowY + 14, 8, ib, GRAY);
    }
  }

  y += hasCompData ? 200 : 166;

  // KPI cards — show absorption rate when available, else demand label
  const absLabel = rd.absorptionRate != null
    ? `${rd.absorptionRate} ud./sem.`
    : rd.demand;
  const absSubLabel = rd.absorptionRate != null ? "Absorcion de mercado" : "Nivel de demanda";
  const kpis = [
    { n: rd.usedFallback ? "–" : String(rd.comparables), l: "Unidades en portales", color: TEAL },
    { n: rd.days != null ? `${rd.days} d.` : "–",        l: "Dias medianos en cartera", color: TEAL },
    { n: absLabel,                                        l: absSubLabel, color: AMBER },
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

  if (rd.usedFallback || rd.byPortal.length === 0) {
    dt(p2, "Datos de mercado no disponibles", MX, y, 15, rb, INK); y += 22;
    dt(p2, "No se encontraron anuncios activos en portales para este vehiculo.", MX, y, 9, ib, GRAY); y += 18;
    fr(p2, MX, y, CW, 72, WARNBG, hex("#D08020"), 0.8);
    dt(p2, "La tasacion se ha calculado por curva de depreciacion estandar para", MX + 14, y + 12, 8.5, ib, WARN);
    dt(p2, `la marca ${rd.vehicle.brand || "indicada"} y ${rd.vehicle.year ? `vehiculos de ${rd.vehicle.year}` : "la antiguedad declarada"}.`, MX + 14, y + 26, 8.5, ib, WARN);
    dt(p2, "Para mayor precision busca comparables activos en Coches.net, AutoScout24 o Wallapop.", MX + 14, y + 42, 8.5, ib, WARN);
    dt(p2, "Cuando haya anuncios en el mercado el informe se recalculara automaticamente.", MX + 14, y + 56, 8.5, ib, WARN);
    y += 90;
  } else {
    dt(p2, "Donde se vende este coche?", MX, y, 15, rb, INK); y += 22;
    dt(p2, "Comparativa de precios y disponibilidad por portal activo.", MX, y, 8.5, ib, GRAY); y += 16;

    fr(p2, MX, y, CW, 22, BG, BORDER, 0.5);
    const tcols = [MX + 8, MX + 140, MX + 240, MX + 360, MX + 430];
    ["Portal", "Unidades", "Precio medio", "Dias prom.", "% mercado"].forEach((h, i) =>
      dt(p2, h.toUpperCase(), tcols[i], y + 5, 6.5, rb, LIGHT));
    y += 22;

    const totalUnits = rd.byPortal.reduce((s, r) => s + r.units, 0) || 1;
    rd.byPortal.slice(0, 6).forEach((row, i) => {
      fr(p2, MX, y, CW, 24, i % 2 === 0 ? WHITE : hex("#FAFAFA"), hex("#F0F0F0"), 0.3);
      dt(p2, row.portal,                                        tcols[0], y + 7, 9.5, rb, INK);
      dt(p2, String(row.units),                                 tcols[1], y + 7, 9, ib, GRAY);
      dt(p2, eur(row.avgPrice),                                 tcols[2], y + 7, 9, rb, INK);
      dt(p2, row.avgDays != null ? `${row.avgDays} d.` : "–",  tcols[3], y + 7, 9, ib, GRAY);
      const pct = Math.round((row.units / totalUnits) * 100);
      fr(p2, tcols[4], y + 8, 60, 8, hex("#E7EFEF"));
      fr(p2, tcols[4], y + 8, Math.round(60 * row.units / totalUnits), 8, TEAL);
      dt(p2, `${pct}%`, tcols[4] + 64, y + 9, 7, ib, GRAY);
      y += 24;
    });

    // Unit-weighted total (avoids mean-of-means bias)
    const totalAvgPrice = totalUnits > 0
      ? Math.round(rd.byPortal.reduce((s, r) => s + (r.avgPrice || 0) * r.units, 0) / totalUnits)
      : null;
    fr(p2, MX, y, CW, 24, hex("#FBF4E9"));
    dt(p2, "TOTAL",            tcols[0], y + 7, 9, rb, AMBER);
    dt(p2, String(totalUnits), tcols[1], y + 7, 9, rb, AMBER);
    dt(p2, eur(totalAvgPrice), tcols[2], y + 7, 9, rb, AMBER);
    y += 28;

    // Private vs dealer reference box
    if (rd.privateMedian && rd.dealerMedian) {
      fr(p2, MX, y, CW, 28, hex("#F2F7F7"), BORDER, 0.5);
      dt(p2, "Precio particular:", MX + 10, y + 8, 8.5, rb, TEAL);
      dt(p2, eur(rd.privateMedian), MX + 110, y + 8, 8.5, rb, TEAL);
      dt(p2, `(${rd.privateCount} anuncios)`, MX + 175, y + 8, 7.5, ib, GRAY);
      dt(p2, "Precio concesionario:", MX + 280, y + 8, 8.5, rb, GRAY);
      dt(p2, eur(rd.dealerMedian), MX + 390, y + 8, 8.5, rb, INK);
      dt(p2, `(${rd.dealerCount} anuncios)`, MX + 455, y + 8, 7.5, ib, GRAY);
      const diff = rd.dealerMedian - rd.privateMedian;
      if (diff > 0) dt(p2, `El dealer cobra de media ${eur(diff)} mas que el particular.`, MX + 10, y + 19, 7.5, ib, GRAY);
      y += 36;
    } else {
      y += 6;
    }

    dt(p2, "Distribucion de precios en el mercado", MX, y, 15, rb, INK); y += 22;
    dt(p2, "Concentracion de anuncios por tramo de precio (outliers excluidos).", MX, y, 8.5, ib, GRAY); y += 14;

    if (rd.histogram.length) {
      const maxCount = Math.max(...rd.histogram.map((b) => b.count));
      const barMaxW  = CW - 120;
      rd.histogram.forEach((bucket) => {
        const label = `${Math.round(bucket.from / 1000)}k-${Math.round(bucket.to / 1000)}k EUR`;
        const bW    = maxCount > 0 ? Math.round((bucket.count / maxCount) * barMaxW) : 0;
        const isOpt = rd.priceOptimal >= bucket.from && rd.priceOptimal < bucket.to;
        dt(p2, label, MX, y + 2, 8, ib, GRAY);
        fr(p2, MX + 66, y, barMaxW, 13, hex("#F0F0F0"));
        if (bW > 0) fr(p2, MX + 66, y, bW, 13, isOpt ? AMBER : TEAL);
        dt(p2, String(bucket.count), MX + 68 + barMaxW, y + 2, 8, ib, GRAY);
        if (isOpt) dt(p2, "<- tu precio", MX + 70 + bW, y + 3, 7, rb, AMBER);
        y += 18;
      });
    }
  }

  // Price trend section
  if (rd.priceTrend && !rd.usedFallback) {
    y += 14;
    dt(p2, "Tendencia de mercado", MX, y, 13, rb, INK); y += 16;
    const tr = rd.priceTrend;
    const trendColor = tr.direction === "up" ? GREEN : tr.direction === "down" ? RED : TEAL;
    const trendTag   = tr.direction === "up" ? "AL ALZA" : tr.direction === "down" ? "A LA BAJA" : "ESTABLE";
    fr(p2, MX, y, CW, 52, hex("#FAFAFA"), BORDER, 0.5);
    fr(p2, MX, y, 4, 52, trendColor);
    dt(p2, trendTag, MX + 14, y + 8, 11, rb, trendColor);
    const trendDetail = tr.direction === "stable"
      ? "Los precios de nuevos anuncios se mantienen estables vs. los de hace 6-8 semanas."
      : `Nuevos anuncios entran un ${tr.pctMonthly > 0 ? "+" : ""}${tr.pctMonthly}% vs. los de hace 6-8 semanas (${tr.slopeMonthly > 0 ? "+" : ""}${new Intl.NumberFormat("es-ES").format(tr.slopeMonthly)} EUR/mes estimado).`;
    const trendAdvice = tr.direction === "down"
      ? "Recomendacion: publica pronto, cada mes el mercado pierde valor en este modelo."
      : tr.direction === "up"
      ? "Recomendacion: puedes mantener precio, el mercado acompana la subida."
      : "Sin urgencia especial — precio de salida estable.";
    wrapText(trendDetail, 85).forEach((l, i) => dt(p2, l, MX + 14, y + 22 + i * 11, 8, ib, hex("#46535C")));
    dt(p2, trendAdvice, MX + 14, y + 40, 7.5, rb, trendColor, CW - 28);
    dt(p2, "(*) Comparativa entre anuncios activos de distintos periodos. Los ya vendidos dejan de ser visibles, lo que puede sesgar esta medida al alza.", MX + 14, y + 54, 5.8, ib, GRAY, CW - 28);
    y += 66;
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
    { tag: "VENTA RAPIDA", price: rd.priceLow,     t: rd.days ? `${Math.round(rd.days*0.5)}-${Math.round(rd.days*0.7)} d.` : "15-25 dias",  bg: hex("#F2F7F7"), tc: TEAL,             desc: "Precio competitivo. Ideal si necesitas liquidez." },
    { tag: "EQUILIBRADO",  price: rd.priceOptimal, t: rd.days ? `${Math.round(rd.days*0.8)}-${Math.round(rd.days*1.2)} d.` : "30-45 dias",  bg: hex("#FBF4E9"), tc: AMBER,            desc: "Precio de mediana de mercado. Mejor relacion tiempo/valor.", reco: true },
    { tag: "MAXIMO VALOR", price: rd.priceHigh,    t: rd.days ? `${Math.round(rd.days*1.4)}-${Math.round(rd.days*1.9)} d.` : "50-75 dias",  bg: hex("#F4F2F7"), tc: hex("#5B4B8A"),  desc: "Por encima de la mediana. Requiere paciencia." },
  ];
  const sW = (CW - 20) / 3;
  scenarios.forEach(({ tag, price, t, bg, tc, desc, reco }, i) => {
    const sx = MX + i * (sW + 10);
    fr(p3, sx, y, sW, 120, bg, reco ? AMBER : BORDER, reco ? 1.5 : 0.5);
    if (reco) { fr(p3, sx + sW - 90, y + 6, 80, 14, AMBER); dt(p3, "RECOMENDADO", sx + sW - 88, y + 9, 6, rb, WHITE); }
    dt(p3, tag,        sx + 10, y + 10, 7.5, rb, tc);
    dt(p3, eur(price), sx + 10, y + 22, 20,  rb, tc);
    dt(p3, t,          sx + 10, y + 50, 8,   ib, GRAY);
    ln(p3, sx + 10, y + 64, sx + sW - 10, y + 64, hex("#F0ECE3"), 0.5);
    wrapText(desc, 32).forEach((l, li) => dt(p3, l, sx + 10, y + 70 + li * 12, 8, ib, hex("#46535C")));
  });
  y += 138;

  // Adjustment factors — real values from linear regression (or depreciation curve)
  dt(p3, "Factores de ajuste calculados para este vehiculo", MX, y, 15, rb, INK); y += 22;
  dt(p3, rd.usedFallback
    ? "Ajustes aplicados sobre la curva de depreciacion estandar (sin comparables de mercado)."
    : "Impacto en precio calculado a partir de los comparables reales del mercado.",
    MX, y, 8.5, ib, GRAY); y += 16;

  const vehicleYear = rd.vehicle.year ? Number(rd.vehicle.year) : null;
  const vAge        = vehicleYear ? new Date().getFullYear() - vehicleYear : null;
  const vKm         = rd.vehicle.mileage != null ? Number(rd.vehicle.mileage) : null;

  const hasDmg  = rd.damageFactor < 0.99;
  const dmgPct  = Math.round((1 - rd.damageFactor) * 100);
  const dmgSrc  = rd.aiDamageFactor != null ? "calculado por IA" : "tabla estandar";
  const dmgImp  = hasDmg ? `-${dmgPct}% (${dmgSrc})` : "neutro";

  const adjs = rd.usedFallback
    ? [
        {
          f: "Depreciacion",
          imp: vAge != null ? `x${standardDepreciationFactor(vAge).toFixed(2)} (${vAge} anos)` : "–",
          c2: GRAY,
          n: `Curva estandar ${rd.vehicle.brand || ""} · ref. nuevo ~${eur(rd.fallbackRefPrice)}`,
        },
        {
          f: "Kilometraje",
          imp: vKm != null && vAge
            ? (vKm > vAge * 15000 ? eurSigned(Math.round(-(vKm - vAge * 15000) * 0.08)) : "neutro")
            : "–",
          c2: vKm != null && vAge && vKm > vAge * 15000 ? RED : GRAY,
          n: vKm != null
            ? `${new Intl.NumberFormat("es-ES").format(vKm)} km · media esperada ~${new Intl.NumberFormat("es-ES").format((vAge || 0) * 15000)} km`
            : "Km no declarado",
        },
        {
          f: "Estado / Danos",
          imp: dmgImp,
          c2: hasDmg ? RED : GRAY,
          n: hasDmg ? `${rd.vehicle.damageLevel || "Danos"} · factor ${rd.damageFactor.toFixed(2)}` : "Sin danos declarados",
        },
      ]
    : [
        {
          f: "Kilometraje",
          imp: Math.abs(rd.kmImpact) > 50 ? eurSigned(rd.kmImpact) : "neutro",
          c2: rd.kmImpact > 50 ? GREEN : rd.kmImpact < -50 ? RED : GRAY,
          n: vKm != null
            ? (rd.kmImpact > 50  ? `Bajo km vs. media de mercado (${new Intl.NumberFormat("es-ES").format(vKm)} km)`
             : rd.kmImpact < -50 ? `Alto km vs. media de mercado (${new Intl.NumberFormat("es-ES").format(vKm)} km)`
             :                     `Km en linea con el mercado (${new Intl.NumberFormat("es-ES").format(vKm)} km)`)
            : "Km no declarado",
        },
        {
          f: "Antiguedad",
          imp: Math.abs(rd.ageImpact) > 50 ? eurSigned(rd.ageImpact) : "neutro",
          c2: rd.ageImpact > 50 ? GREEN : rd.ageImpact < -50 ? RED : GRAY,
          n: vAge != null
            ? (rd.ageImpact > 50  ? `Vehiculo mas reciente que la media (${vAge} anos)`
             : rd.ageImpact < -50 ? `Vehiculo mas antiguo que la media (${vAge} anos)`
             :                      `Antiguedad en linea con el mercado (${vAge} anos)`)
            : "Ano no declarado",
        },
        {
          f: "Estado / Danos",
          imp: dmgImp,
          c2: hasDmg ? RED : GRAY,
          n: hasDmg ? `${rd.vehicle.damageLevel || "Danos"} · factor ${rd.damageFactor.toFixed(2)}` : "Sin danos declarados",
        },
      ];

  // Owner/history factor row
  const oa = rd.ownerAdj;
  if (oa.pct !== 0 || (rd.vehicle.owners || rd.vehicle.serviceHistory)) {
    const ownersLabel = rd.vehicle.owners === "1" ? "1 propietario"
      : rd.vehicle.owners === "2" ? "2 propietarios"
      : rd.vehicle.owners === "3" ? "3+ propietarios"
      : "";
    const histLabel = rd.vehicle.serviceHistory === "oficial" ? "historial oficial"
      : rd.vehicle.serviceHistory === "parcial" ? "historial parcial"
      : rd.vehicle.serviceHistory === "sin" ? "sin historial"
      : "";
    const detail = [ownersLabel, histLabel].filter(Boolean).join(" · ") || "Dato parcial";
    adjs.push({
      f: "Propietarios / Historial",
      imp: oa.pct !== 0 ? `${oa.pct > 0 ? "+" : ""}${oa.pct}%` : "neutro",
      c2: oa.pct > 0 ? GREEN : oa.pct < 0 ? RED : GRAY,
      n: detail,
    });
  }

  // Color factor row (only when color was provided)
  const ca = rd.colorAdj;
  if (rd.vehicle.color) {
    const colorName = rd.vehicle.color.charAt(0).toUpperCase() + rd.vehicle.color.slice(1);
    adjs.push(ca.pct !== 0
      ? { f: "Color", imp: `${ca.pct}%`, c2: ca.pct < 0 ? RED : GRAY,
          n: `${colorName} — menor liquidez vs. blanco/negro/plata (tarda mas en venderse)` }
      : { f: "Color", imp: "neutro", c2: GRAY,
          n: `${colorName} — color de alta liquidez en el mercado espanol` }
    );
  }

  // ZBE row in adjustment table
  if (rd.zbeFlag) {
    adjs.push({ f: "Restriccion ZBE", imp: "-8% a -15%", c2: RED, n: `${rd.zbeFlag.norm} · ${rd.zbeFlag.impact}` });
  }

  // Environmental label row — only when label reduces value (B or sin)
  if (rd.envLabel && (rd.envLabel.code === "B" || rd.envLabel.code === "sin")) {
    const impact = rd.envLabel.code === "sin" ? "-10% a -18%" : "-3% a -8%";
    adjs.push({ f: "Etiqueta DGT", imp: impact, c2: RED, n: `Etiqueta ${rd.envLabel.code} · ${rd.envLabel.detail}` });
  }

  // ITV row in adjustment table
  if (rd.itvWarning) {
    const impact = rd.itvWarning.level === "danger" ? "-5% a -12%" : "-1% a -3%";
    adjs.push({ f: "Estado ITV", imp: impact, c2: RED, n: rd.itvWarning.detail.slice(0, 80) });
  }

  fr(p3, MX, y, CW, 20, BG, BORDER, 0.5);
  [["FACTOR", 10], ["IMPACTO", 200], ["DETALLE", 310]].forEach(([h, dx]) =>
    dt(p3, h, MX + dx, y + 6, 6.5, rb, LIGHT));
  y += 20;

  adjs.forEach(({ f, imp, c2, n }, i) => {
    fr(p3, MX, y, CW, 22, i % 2 === 0 ? WHITE : hex("#FAFAFA"));
    dt(p3, f,   MX + 10,  y + 6, 9,   rb, INK);
    dt(p3, imp, MX + 210, y + 6, 9,   rb, c2);
    dt(p3, n,   MX + 320, y + 6, 7.5, ib, GRAY, CW - 330);
    y += 22;
  });

  // Real comparable listings
  const validSamples = (rd.samples || []).filter((s) => s.price > 0);
  if (validSamples.length > 0 && !rd.usedFallback) {
    y += 14;
    dt(p3, "Comparables activos en portales", MX, y, 13, rb, INK); y += 16;
    dt(p3, "Anuncios similares encontrados al generar este informe.", MX, y, 8, ib, GRAY); y += 12;

    fr(p3, MX, y, CW, 20, BG, BORDER, 0.5);
    const sc = [MX + 8, MX + 52, MX + 150, MX + 255, MX + 370];
    ["Ano", "Km", "Precio", "Version", "Portal"].forEach((h, i) =>
      dt(p3, h.toUpperCase(), sc[i], y + 5, 6.5, rb, LIGHT));
    y += 20;

    validSamples.slice(0, 5).forEach((s, i) => {
      fr(p3, MX, y, CW, 21, i % 2 === 0 ? WHITE : hex("#FAFAFA"));
      dt(p3, String(s.year || "–"),                                                            sc[0], y + 5, 8.5, ib, GRAY);
      dt(p3, s.mileage ? new Intl.NumberFormat("es-ES").format(s.mileage) + " km" : "–",      sc[1], y + 5, 8.5, ib, GRAY);
      dt(p3, eur(s.price),                                                                     sc[2], y + 5, 8.5, rb, INK);
      dt(p3, ((s.version || s.model || "–")).slice(0, 22),                                    sc[3], y + 5, 7.5, ib, GRAY, 108);
      dt(p3, (s.portal || "–").slice(0, 20),                                                  sc[4], y + 5, 7.5, ib, TEAL, 85);
      y += 21;
    });
  }

  footer(p3, null, ib);

  // ═══════════════════════════════════════════════════════
  //  PAGE 4 — IA + CONSEJOS + METODOLOGIA
  // ═══════════════════════════════════════════════════════
  const p4 = pdfDoc.addPage([W, H]);
  runhead(p4, vLabel, 4, rb, ib);
  y = 44;

  const ai = rd.aiAnalysis;

  if (ai) {
    dt(p4, "Analisis de Inteligencia de Mercado", MX, y, 15, rb, INK); y += 22;
    dt(p4, "Generado por IA a partir de los datos de mercado de tu vehiculo.", MX, y, 8.5, ib, GRAY); y += 14;

    fr(p4, MX, y, CW, 2, TEAL); y += 8;
    wrapText(ai.analisisMercado || "", 90).forEach((l) => { dt(p4, l, MX, y, 9, ib, hex("#46535C")); y += 13; });
    y += 8;

    if (Array.isArray(ai.factoresClave) && ai.factoresClave.length) {
      dt(p4, "Factores clave para este coche:", MX, y, 9, rb, INK); y += 14;
      ai.factoresClave.forEach((f) => {
        dt(p4, "•", MX, y, 9, rb, AMBER);
        wrapText(f, 86).forEach((l) => { dt(p4, l, MX + 12, y, 8.5, ib, hex("#46535C")); y += 12; });
        y += 2;
      });
      y += 6;
    }

    if (ai.margenNegociacion?.pct) {
      fr(p4, MX, y, CW, 28, hex("#F2F7F7"), BORDER, 0.5);
      dt(p4, `Margen de negociacion estimado: ${ai.margenNegociacion.pct}%`, MX + 10, y + 7, 9, rb, TEAL);
      if (ai.margenNegociacion.estrategia) dt(p4, ai.margenNegociacion.estrategia, MX + 10, y + 19, 8, ib, GRAY);
      y += 38;
    }

    dt(p4, "Consejos personalizados para tu vehiculo", MX, y, 13, rb, INK); y += 18;
    if (Array.isArray(ai.consejosPersonalizados)) {
      ai.consejosPersonalizados.forEach((tip, i) => {
        const cx  = MX + (i % 2) * (CW / 2 + 8);
        const tyR = y + Math.floor(i / 2) * 44;
        dt(p4, "+", cx, tyR, 10, rb, AMBER);
        wrapText(tip, 42).forEach((l, li) => dt(p4, l, cx + 14, tyR + li * 12, 8, ib, hex("#46535C")));
      });
      y += Math.ceil((ai.consejosPersonalizados.length || 0) / 2) * 44 + 10;
    }
  } else {
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
  const methodBase = rd.usedFallback
    ? "No se encontraron comparables activos en portales. El precio se ha estimado mediante curva de depreciacion estandar calibrada por segmento de marca, con ajuste por kilometraje relativo a la media esperada para la antiguedad declarada."
    : "Datos en tiempo real de los principales portales de venta de VO en Espana. Precio optimo = mediana de comparables con fence IQR x1.5 (Tukey) para eliminar atipicos. Ajustes por km y antiguedad derivados de regresion lineal sobre los propios comparables.";
  const methodDmg = rd.aiDamageFactor != null
    ? " El factor de danos ha sido calculado semanticamente por IA (Gemini) a partir de la descripcion real del vehiculo."
    : (rd.damageFactor < 1 ? " Factor de danos aplicado por tabla estandar (leve/moderado/grave)." : "");
  let my = y;
  wrapText(methodBase + methodDmg, 92).forEach((l) => { dt(p4, l, MX, my, 8, ib, hex("#46535C")); my += 12; });
  y = my + 14;

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
    desiredType:  "compra",
    brand:        String(vehicle.brand        || ""),
    model:        String(vehicle.model        || ""),
    version:      String(vehicle.version      || ""),
    fuel:         String(vehicle.fuel         || ""),
    transmission: String(vehicle.transmission || ""),
    year:    vehicle.year    ? Number(vehicle.year)    : null,
    mileage: vehicle.mileage ? Number(String(vehicle.mileage).replace(/\./g, "").replace(/,/g, ".")) : null,
    powerCv: vehicle.powerCv ? Number(vehicle.powerCv) : null,
  };

  const national = await getMarketPriceSnapshot(baseOptions);

  // Draft with damageFactor=1.0 so Gemini sees pure market/depreciation data
  // and can reason about the damage independently from final price
  const draftData = buildReportData(vehicle, national, 1.0);

  // Single Gemini call: market analysis + semantic damage factor
  const aiResult = await callGeminiAnalysis(draftData).catch(() => null);

  // Validate AI damage factor (accept only plausible range)
  const aiDf = (
    aiResult?.damageFactor != null &&
    typeof aiResult.damageFactor === "number" &&
    aiResult.damageFactor >= 0.60 &&
    aiResult.damageFactor <= 1.00
  ) ? aiResult.damageFactor : null;

  // Final report: AI damage factor when available, else hardcoded table
  const reportData         = buildReportData(vehicle, national, aiDf);
  reportData.aiAnalysis    = aiResult;
  reportData.aiDamageFactor = aiDf;

  const pdfBuffer = await buildPdf(reportData);
  return { pdfBuffer, reportData };
}

module.exports = { generateSellReport, buildReportData };
