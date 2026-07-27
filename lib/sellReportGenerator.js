const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { getMarketPriceSnapshot, getPostgresPool } = require("./inventoryStore");

// Update this string on each commit that changes pool filtering, cascade, or pricing logic.
// Allows segmenting sell_report_telemetry rows by regime when analysing ratio distributions.
const SELL_REPORT_VERSION = 'ola3a';

function eur(value) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return new Intl.NumberFormat("es-ES").format(Math.round(value)) + " €";
}

function eurSigned(value) {
  if (!Number.isFinite(value)) return "-";
  const abs = new Intl.NumberFormat("es-ES").format(Math.abs(Math.round(value)));
  return value >= 0 ? `+${abs} €` : `-${abs} €`;
}

// â”€â”€ Factor de cierre por tramo de precio de publicación â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fuente: Query B sobre last_seen_at >= '2026-05-17', Flexicar, n=436 bajas limpias.
// Solo economy y mainstream tienen muestra suficiente (n>=20 por tramo, n<20 premium/luxury).
// El descuento real es mayor que el factor medido: sesgo de composición + desfase discovery
// apilan hacia arriba. Cifra es cota inferior, no punto central.
// Tramo decidido por precio de publicación final, con los mismos cortes que Query B.
const CLOSE_FACTORS = { economy: 0.954, mainstream: 0.969 };
function getClosingFactor(pricePublication) {
  if (pricePublication < 12000) return { tranche: 'economy',    factor: CLOSE_FACTORS.economy };
  if (pricePublication < 20000) return { tranche: 'mainstream', factor: CLOSE_FACTORS.mainstream };
  return null; // premium (20k-35k) y luxury (>35k): n insuficiente, sesgo domina
}

// â”€â”€ Damage factor (hardcoded fallback used when Gemini is unavailable) â”€â”€â”€â”€â”€â”€â”€â”€
function getDamageFactor(level = "") {
  const l = String(level).toLowerCase();
  if (l.includes("grave") || l.includes("major"))    return 0.84;
  if (l.includes("modera") || l.includes("moderate")) return 0.91;
  if (l.includes("leve") || l.includes("minor"))     return 0.97;
  return 1;
}

// â”€â”€ ZBE (Zero Emission Zone) restriction - Spain â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getZbeFlag(year, fuel) {
  const y = Number(year) || 0;
  const f = (fuel || "").toLowerCase();
  if (y > 0 && y <= 2014 && (f.includes("diesel") || f.includes("gasoil"))) {
    return {
      norm:   "Euro 5 (estimado)",
      detail: "Diesel matriculado hasta 2014 - sin acceso libre a las ZBE de Madrid, Barcelona y otras ciudades.",
      impact: "Reduce la demanda y el precio un 8-15% vs. equivalente Euro 6.",
    };
  }
  if (y > 0 && y <= 2000 && !f.includes("diesel") && !f.includes("electri") && !f.includes("hibrid")) {
    return {
      norm:   "Euro 3 (estimado)",
      detail: "Gasolina matriculada hasta 2000 - puede tener restricciones en ZBE avanzadas.",
      impact: "Consultar normativa local antes de fijar precio.",
    };
  }
  return null;
}

// â”€â”€ DGT environmental label - derived from year + fuel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getEnvLabel(year, fuel) {
  const y = Number(year) || 0;
  const f = (fuel || "").toLowerCase();
  if (f.includes("electri") || f.includes("hidrogen")) {
    return { code: "0",   hex: "#1A6B3C", bg: "#DCFCE7", detail: "Electrico/hidrogeno - acceso libre a todas las ZBE" };
  }
  if (f.includes("enchuf") || f.includes("plug") || f.includes("phev")) {
    return { code: "0",   hex: "#1A6B3C", bg: "#DCFCE7", detail: "Hibrido enchufable - acceso libre a ZBE" };
  }
  if (f.includes("hibrid") || f.includes("hybrid")) {
    return { code: "ECO", hex: "#0369A1", bg: "#E0F2FE", detail: "Hibrido - acceso preferente en ZBE, estacionamiento gratuito" };
  }
  const isDiesel = f.includes("diesel") || f.includes("gasoil");
  if (isDiesel) {
    if (y >= 2015) return { code: "C",   hex: "#1D4ED8", bg: "#DBEAFE", detail: "Etiqueta C (Euro 6) - circulacion normal salvo episodios de alta contaminacion" };
    if (y >= 2011) return { code: "B",   hex: "#92400E", bg: "#FEF3C7", detail: "Etiqueta B (Euro 5) - restringido en ZBE activas" };
    return             { code: "sin", hex: "#B91C1C", bg: "#FEE2E2", detail: "Sin etiqueta DGT - acceso muy limitado o nulo en ZBE" };
  }
  if (y >= 2006) return   { code: "C",   hex: "#1D4ED8", bg: "#DBEAFE", detail: "Etiqueta C - circulacion normal" };
  if (y >= 2000) return   { code: "B",   hex: "#92400E", bg: "#FEF3C7", detail: "Etiqueta B - posibles restricciones en ZBE" };
  return                  { code: "sin", hex: "#B91C1C", bg: "#FEE2E2", detail: "Sin etiqueta DGT" };
}

// â”€â”€ ITV status warning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getItvWarning(itvStatus) {
  const s = (itvStatus || "").toLowerCase().trim();
  if (s === "caducada") {
    return { level: "danger", label: "ITV CADUCADA", detail: "La ITV ha vencido - el comprador lo usara como argumento de descuento fuerte (coste ITV + posibles reparaciones)." };
  }
  if (s === "pronto") {
    return { level: "warn", label: "ITV proxima (<6 meses)", detail: "La ITV vence pronto - el comprador asumira ese gasto. Ajusta el precio aprox. 70-150 EUR a la baja o renuvala antes de vender." };
  }
  return null;
}

// â”€â”€ Color market liquidity factor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Owner count + service history factor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Depreciation fallback (used when comparables < 3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BRAND_TIERS = [
  {
    tier: "hypercar",
    refPrice: 1500000,
    brands: ["koenigsegg", "pagani", "bugatti", "czinger", "rimac"],
  },
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

function getBrandSegmentInfo(brand = "") {
  const b = brand.toLowerCase().trim();
  for (const entry of BRAND_TIERS) {
    if (entry.brands.some((n) => b.includes(n) || n.includes(b))) {
      return { segment: entry.tier, matched: true };
    }
  }
  return { segment: 'mainstream', matched: false };
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

// â”€â”€ Confidence scoring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Report data builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // Single unconditional call - ratio market_median/depreciationEstimate persisted to telemetry
  const depreciationEst = estimatePriceByDepreciation(vehicle, refDate);

  let base, baseLow, baseHigh, usedFallback, fallbackRefPrice;

  if (comps >= 3 && median > 0) {
    usedFallback     = false;
    fallbackRefPrice = null;
    base     = median;
    baseLow  = p25;
    baseHigh = p75;
  } else {
    usedFallback = true;
    if (depreciationEst && depreciationEst.optimal > 0) {
      fallbackRefPrice = depreciationEst.refPrice;
      base     = depreciationEst.optimal;
      baseLow  = depreciationEst.low;
      baseHigh = depreciationEst.high;
    } else {
      fallbackRefPrice = null;
      base = baseLow = baseHigh = 0;
    }
  }

  // Usage impact from joint OLS (km + year) - 0 when on fallback path
  const usageImpact = !usedFallback ? (mkt.usageImpact ?? 0) : 0;
  // Backward compat when reading fixtures captured before Ola 1 (usageImpact not in snapshot)
  const legacyAdj = (mkt.kmImpact ?? 0) + (mkt.ageImpact ?? 0);
  const totalAdj  = mkt.usageImpact != null ? usageImpact : (!usedFallback ? legacyAdj : 0);

  // Color liquidity factor
  const colorAdj = getColorAdj(vehicle.color || "");
  // Owner count + service history factor
  const ownerAdj = getOwnerHistoryFactor(vehicle.owners, vehicle.serviceHistory);
  // Combined factor = df Ã— color Ã— owner, with a floor of 0.72 to protect against
  // compounding discounts that would produce absurdly low prices for cars in honest condition.
  const effectiveFactor = Math.max(0.72, df * colorAdj.factor * ownerAdj.factor);

  const priceOptimal = Math.max(0, Math.round((base     + totalAdj) * effectiveFactor));
  const priceLow     = Math.max(0, Math.round((baseLow  + Math.round(totalAdj * 0.70)) * effectiveFactor));
  const priceHigh    = Math.max(0, Math.round((baseHigh + Math.round(totalAdj * 1.25)) * effectiveFactor));
  const _closeInfo   = getClosingFactor(priceOptimal);

  return {
    vehicle,
    priceOptimal,
    priceLow,
    priceHigh,
    priceClose:   _closeInfo ? Math.round(priceOptimal * _closeInfo.factor) : null,
    closeTranche: _closeInfo?.tranche ?? null,
    comparables:  comps,
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
    usageImpact:     totalAdj,
    rawUsageImpact:  !usedFallback ? (mkt.rawUsageImpact ?? null) : null,
    usageCapApplied: !usedFallback && mkt.rawUsageImpact != null && Math.abs(mkt.rawUsageImpact) > Math.abs(totalAdj) + 1,
    usageUsedDefault: mkt.usageUsedDefault === undefined ? false : mkt.usageUsedDefault,
    kmAdvantagePct:  mkt.kmAdvantagePct ?? null,
    slopeKm:         mkt.slopeKm  ?? null,
    slopeYear:       mkt.slopeYear ?? null,
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
    depreciationEstimate: depreciationEst?.optimal ?? null,
    marketMedian:         median,
    aiAnalysis:           null,
  };
}

// â”€â”€ Gemini: market analysis + semantic damage factor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function callGeminiAnalysis(rd) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const v         = rd.vehicle;
  const hasDamage = v.damageLevel && !String(v.damageLevel).toLowerCase().includes("sin");
  const damageCtx = hasDamage
    ? `\nDAÑOS: nivel "${v.damageLevel}"${v.damageDescription ? `, descripcion: "${v.damageDescription}"` : ""}. Calcula el factor de descuento apropiado (campo damageFactor, rango 0.60-0.99).`
    : `\nESTADO: Sin daños declarados. damageFactor debe ser 1.00.`;

  const marketCtx = rd.usedFallback
    ? "Sin comparables activos - estimacion por depreciacion estandar."
    : `Precio optimo ${rd.priceOptimal}€ · Rango ${rd.priceLow}€-${rd.priceHigh}€ · ${rd.comparables} comparables · Confianza ${rd.confidence}%${rd.days ? ` · ${rd.days} dias medianos en cartera` : ""}`;

  const prompt = `Eres un analista experto en el mercado de vehículos de ocasión en España.

VEHÍCULO: ${v.brand || ""} ${v.model || ""} ${v.version || ""} | Año ${v.year || "-"} | ${v.mileage ? new Intl.NumberFormat("es-ES").format(v.mileage) + " km" : "km no indicados"} | ${v.fuel || "combustible no indicado"}${damageCtx}
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

// â”€â”€ pdf-lib helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  dt(page, "CarsWise", MX, 18, 10, rb, INK);
  dt(page, ".", MX + rb.widthOfTextAtSize("CarsWise", 10) - 1, 18, 10, rb, AMBER);
  dt(page, `${vLabel.toUpperCase()} \xB7 PAG. ${pageNum}`, W - MX - rb.widthOfTextAtSize(`${vLabel.toUpperCase()} \xB7 PAG. ${pageNum}`, 7), 20, 7, ib, LIGHT);
  ln(page, MX, 32, W - MX, 32, AMBER, 0.8);
}

function footer(page, text, ib) {
  const t = text || "CarsWise AI \xB7 www.carswiseai.com \xB7 Valido 30 dias desde su emision.";
  ln(page, MX, 820, W - MX, 820, BORDER, 0.5);
  dt(page, t, MX, 826, 6.5, ib, LIGHT);
}

// â”€â”€ Percentile of priceOptimal within histogram â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function computePercentile(histogram, price) {
  if (!histogram || !histogram.length) return null;
  const total = histogram.reduce((s, b) => s + b.count, 0);
  if (!total) return null;
  let below = 0, inBucket = 0;
  for (const b of histogram) {
    if (price >= b.to) { below += b.count; }
    else if (price >= b.from && price < b.to) { inBucket = b.count; break; }
  }
  return Math.round(((below + inBucket * 0.5) / total) * 100);
}

// â”€â”€ Future price projection via depreciation table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function projectDepreciation(priceToday, ageYears, monthsAhead) {
  if (ageYears == null || ageYears < 0) return null;
  const today  = standardDepreciationFactor(ageYears);
  if (!today) return null;
  return Math.max(0, Math.round(priceToday * (standardDepreciationFactor(ageYears + monthsAhead / 12) / today)));
}

// â”€â”€ PDF builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function buildPdf(rd) {
  const pdfDoc = await PDFDocument.create();
  const rb = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const ib = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const vehicleYear = rd.vehicle.year ? Number(rd.vehicle.year) : null;
  const vAge        = vehicleYear ? new Date().getFullYear() - vehicleYear : null;
  const vKm         = rd.vehicle.mileage != null ? Number(rd.vehicle.mileage) : null;
  const vLabel      = [rd.vehicle.brand, rd.vehicle.model, vehicleYear ? String(vehicleYear) : ""].filter(Boolean).join(" ");
  const percentile  = computePercentile(rd.histogram, rd.priceOptimal);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  PAGE 1 - PORTADA
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const p1 = pdfDoc.addPage([W, H]);

  // Header: white bg, amber divider
  dt(p1, "CarsWise", MX, 22, 14, rb, INK);
  dt(p1, ".", MX + rb.widthOfTextAtSize("CarsWise", 14) - 1, 22, 14, rb, AMBER);
  dt(p1, "TASACION E INTELIGENCIA DE MERCADO", W - MX - rb.widthOfTextAtSize("TASACION E INTELIGENCIA DE MERCADO", 7), 22, 7, ib, LIGHT);
  ln(p1, MX, 36, W - MX, 36, AMBER, 1);
  dt(p1, "Informe de tasacion", MX, 52, 22, rb, INK);
  dt(p1, "Generado el " + rd.generatedAt, MX, 78, 8, ib, GRAY);

  let y = 96;

  // ZBE warning
  if (rd.zbeFlag) {
    fr(p1, MX, y, CW, 36, hex("#FEF2F2"), hex("#DC2626"), 0.8);
    dt(p1, "ATENCION: RESTRICCION ZBE", MX + 10, y + 8, 8, rb, hex("#991B1B"));
    dt(p1, rd.zbeFlag.detail, MX + 10, y + 20, 7.5, ib, hex("#991B1B"), CW - 20);
    y += 44;
  }

  // ITV warning
  if (rd.itvWarning) {
    const itvBg  = rd.itvWarning.level === "danger" ? hex("#FEF2F2") : hex("#FFFBEE");
    const itvBrd = rd.itvWarning.level === "danger" ? hex("#DC2626") : AMBER;
    const itvInk = rd.itvWarning.level === "danger" ? hex("#991B1B") : hex("#7A3B0A");
    fr(p1, MX, y, CW, 36, itvBg, itvBrd, 0.8);
    dt(p1, "âš   " + rd.itvWarning.label.toUpperCase() + ".", MX + 10, y + 8, 8, rb, itvInk);
    dt(p1, rd.itvWarning.detail, MX + 10, y + 20, 7.5, ib, itvInk, CW - 20);
    y += 44;
  }

  // Fallback notice
  if (rd.usedFallback) {
    fr(p1, MX, y, CW, 26, hex("#FFF4E0"), hex("#D08020"), 0.8);
    dt(p1, "Sin comparables activos \xB7 precio estimado por curva de depreciacion estandar", MX + 10, y + 8, 8, rb, hex("#7A3B0A"));
    y += 34;
  }

  // Vehicle card
  fr(p1, MX, y, CW, 100, WHITE, BORDER, 0.7);
  dt(p1, vLabel, MX + 14, y + 14, 15, rb, INK);
  if (rd.vehicle.plate) {
    const plateText = rd.vehicle.plate.toUpperCase();
    const plateW = rb.widthOfTextAtSize(plateText, 8) + 14;
    fr(p1, MX + 14, y + 32, plateW, 16, hex("#E4E8EC"));
    dt(p1, plateText, MX + 21, y + 36, 8, rb, hex("#46535C"));
  }
  if (rd.envLabel) {
    const el = rd.envLabel;
    const bSz = el.code === "ECO" ? 36 : 24;
    const bX  = MX + CW - bSz - 12;
    fr(p1, bX, y + 8, bSz, bSz, hex(el.bg), hex(el.hex), 0.8);
    dt(p1, el.code, bX + (bSz - rb.widthOfTextAtSize(el.code, 8.5)) / 2, y + 8 + (bSz - 8) / 2, 8.5, rb, hex(el.hex));
  }
  const specs5 = [
    ["ANO",         String(vehicleYear || "-")],
    ["KILOMETROS",  vKm != null ? new Intl.NumberFormat("es-ES").format(vKm) : "-"],
    ["COMBUSTIBLE", rd.vehicle.fuel         || "-"],
    ["TRANSMISION", rd.vehicle.transmission || "-"],
    ["ESTADO",      rd.vehicle.damageLevel  || "Sin danos"],
  ];
  const specW5 = CW / 5;
  specs5.forEach(([k, v], i) => {
    const sx = MX + i * specW5 + 14;
    if (i > 0) ln(p1, MX + i * specW5, y + 56, MX + i * specW5, y + 96, BORDER, 0.4);
    dt(p1, k, sx, y + 58, 6, ib, LIGHT);
    dt(p1, v, sx, y + 70, 9.5, rb, INK, specW5 - 18);
  });
  y += 110;

  // Hero verdict block (teal)
  const TEAL_DARK = hex("#0d4f4d");
  const verdictH = 130;
  fr(p1, MX, y, CW, verdictH, TEAL);
  dt(p1, "PRECIO DE PUBLICACION RECOMENDADO", MX + 14, y + 12, 6.5, rb, hex("#9ECFCD"));
  dt(p1, eur(rd.priceOptimal), MX + 14, y + 24, 34, rb, WHITE);
  const cbX = MX + CW - 74, cbY = y + 10;
  fr(p1, cbX, cbY, 60, 46, TEAL_DARK);
  dt(p1, rd.confidence + "%", cbX + (60 - rb.widthOfTextAtSize(rd.confidence + "%", 18)) / 2, cbY + 6, 18, rb, WHITE);
  dt(p1, "CONFIANZA", cbX + (60 - ib.widthOfTextAtSize("CONFIANZA", 6.5)) / 2, cbY + 34, 6.5, ib, hex("#9ECFCD"));
  const compsLabel = rd.usedFallback
    ? "Estimacion por curva estandar " + (rd.vehicle.brand || "")
    : rd.rawComparables > rd.comparables
    ? "Basado en " + rd.comparables + " comparables validos \xB7 " + (rd.rawComparables - rd.comparables) + " atipico" + (rd.rawComparables - rd.comparables > 1 ? "s" : "") + " excluido" + (rd.rawComparables - rd.comparables > 1 ? "s" : "") + " \xB7 mercado nacional"
    : "Basado en " + rd.comparables + " comparables activos \xB7 mercado nacional";
  dt(p1, compsLabel, MX + 14, y + 68, 7.5, ib, hex("#9ECFCD"), CW - 90);
  const barY = y + 82, barW = CW - 100;
  const priceRange = (rd.priceHigh - rd.priceLow) || 1;
  const optPct     = Math.max(0.05, Math.min(0.95, (rd.priceOptimal - rd.priceLow) / priceRange));
  const optPx      = Math.round(barW * optPct);
  fr(p1, MX + 14, barY, barW, 8, hex("#1a5c5a"));
  fr(p1, MX + 14, barY, optPx, 8, hex("#4AADAA"));
  fr(p1, MX + 14 + optPx - Math.round(barW * 0.05), barY - 1, Math.round(barW * 0.10), 10, AMBER);
  fr(p1, MX + 14 + optPx - 1, barY - 4, 2, 16, WHITE);
  dt(p1, "Venta rapida",   MX + 14, barY + 13, 7, ib, hex("#9ECFCD"));
  dt(p1, eur(rd.priceLow), MX + 14, barY + 22, 8, rb, hex("#9ECFCD"));
  dt(p1, "Recomendado",    MX + 14 + Math.max(2, optPx - 28), barY + 13, 7, rb, WHITE);
  dt(p1, eur(rd.priceOptimal), MX + 14 + Math.max(2, optPx - 28), barY + 22, 8, rb, WHITE);
  dt(p1, "Maximo valor",   MX + 14 + barW - 56, barY + 13, 7, ib, hex("#9ECFCD"));
  dt(p1, eur(rd.priceHigh), MX + 14 + barW - 56, barY + 22, 8, rb, hex("#9ECFCD"));
  y += verdictH + 8;

  // Closing price block (amber)
  if (rd.priceClose) {
    fr(p1, MX, y, CW, 50, hex("#FFFBF0"), AMBER, 1.0);
    dt(p1, "PRECIO ESTIMADO DE CIERRE", MX + 14, y + 10, 7, rb, AMBER);
    dt(p1, "Orientativo \xB7 anuncios de este segmento que salieron del mercado", MX + 14, y + 24, 6.5, ib, hex("#9B6010"));
    const closeStr = eur(rd.priceClose);
    dt(p1, closeStr, W - MX - 14 - rb.widthOfTextAtSize(closeStr, 18), y + 16, 18, rb, INK);
    y += 58;
  }

  // 3 KPI cards
  const kpis = [
    { n: percentile != null ? "P" + percentile : "-", l: "POSICION DE TU PRECIO",  s: percentile != null ? "Por encima del " + percentile + "% del mercado" : "Sin datos",          c: INK },
    { n: rd.usedFallback ? "-" : String(rd.comparables),        l: "UNIDADES EN PORTALES",   s: "Oferta activa del modelo",            c: TEAL },
    { n: rd.demand === "ALTO" ? "Alto" : rd.demand === "MEDIO" ? "Medio" : "Bajo", l: "NIVEL DE DEMANDA", s: rd.demand === "ALTO" ? "Rotacion sobre la media" : rd.demand === "MEDIO" ? "Demanda normal" : "Rotacion baja", c: rd.demand === "ALTO" ? GREEN : rd.demand === "BAJO" ? RED : TEAL },
  ];
  const kW = (CW - 16) / 3;
  kpis.forEach(function(kpi, i) {
    const kx = MX + i * (kW + 8);
    fr(p1, kx, y, kW, 66, WHITE, BORDER, 0.5);
    dt(p1, kpi.l, kx + 10, y + 8,  6,  ib, LIGHT);
    dt(p1, kpi.n, kx + 10, y + 20, 22, rb, kpi.c);
    dt(p1, kpi.s, kx + 10, y + 52, 7,  ib, GRAY, kW - 20);
  });

  footer(p1, "CarsWise AI \xB7 www.carswiseai.com \xB7 Valido 30 dias desde su emision.", ib);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  PAGE 2 - MERCADO
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const p2 = pdfDoc.addPage([W, H]);
  runhead(p2, vLabel, 2, rb, ib);
  y = 46;

  if (rd.usedFallback || rd.byPortal.length === 0) {
    dt(p2, "Datos de mercado no disponibles", MX, y, 15, rb, INK); y += 22;
    fr(p2, MX, y, CW, 64, hex("#FFF4E0"), hex("#D08020"), 0.8);
    dt(p2, "La tasacion se ha calculado por curva de depreciacion estandar.", MX + 14, y + 10, 8.5, ib, hex("#7A3B0A"));
    dt(p2, "Para mayor precision busca comparables activos en Coches.net, AutoScout24 o Wallapop.", MX + 14, y + 26, 8.5, ib, hex("#7A3B0A"));
    dt(p2, "Cuando haya anuncios en el mercado el informe se recalculara automaticamente.", MX + 14, y + 42, 8.5, ib, hex("#7A3B0A"));
    y += 80;
  } else {
    // Portal table
    dt(p2, "\xBFDonde se vende este coche?", MX, y, 15, rb, INK); y += 20;
    dt(p2, "Comparativa de precios y disponibilidad por portal activo.", MX, y, 8.5, ib, GRAY); y += 14;

    fr(p2, MX, y, CW, 20, BG, BORDER, 0.5);
    dt(p2, "PORTAL",           MX + 8,   y + 5, 6.5, rb, LIGHT);
    dt(p2, "UNIDADES",         MX + 148, y + 5, 6.5, rb, LIGHT);
    dt(p2, "PRECIO MEDIO",     MX + 220, y + 5, 6.5, rb, LIGHT);
    dt(p2, "CUOTA DE MERCADO", MX + 340, y + 5, 6.5, rb, LIGHT);
    y += 20;

    const totalUnits = rd.byPortal.reduce(function(s, r) { return s + r.units; }, 0) || 1;
    rd.byPortal.slice(0, 6).forEach(function(row, i) {
      fr(p2, MX, y, CW, 22, i % 2 === 0 ? WHITE : hex("#FAFAFA"), hex("#F0F0F0"), 0.3);
      dt(p2, row.portal,        MX + 8,   y + 6, 9.5, rb, INK);
      dt(p2, String(row.units), MX + 148, y + 6, 9,   ib, GRAY);
      dt(p2, eur(row.avgPrice), MX + 220, y + 6, 9,   rb, INK);
      const pct = Math.round((row.units / totalUnits) * 100);
      fr(p2, MX + 340, y + 7, 130, 8, hex("#E7EFEF"));
      if (pct > 0) fr(p2, MX + 340, y + 7, Math.round(130 * row.units / totalUnits), 8, TEAL);
      dt(p2, pct + "%", MX + 476, y + 7, 7.5, ib, GRAY);
      y += 22;
    });

    const totalAvgPrice = Math.round(rd.byPortal.reduce(function(s, r) { return s + (r.avgPrice || 0) * r.units; }, 0) / totalUnits);
    fr(p2, MX, y, CW, 22, hex("#FBF4E9"));
    dt(p2, "Total ponderado", MX + 8,   y + 6, 9, rb, AMBER);
    dt(p2, String(totalUnits), MX + 148, y + 6, 9, rb, AMBER);
    dt(p2, eur(totalAvgPrice), MX + 220, y + 6, 9, rb, AMBER);
    y += 30;

    // Price histogram
    dt(p2, "Distribucion de precios en el mercado", MX, y, 15, rb, INK); y += 20;
    dt(p2, "Concentracion de anuncios por tramo (atipicos excluidos). Tu precio recomendado en ambar.", MX, y, 8.5, ib, GRAY); y += 14;

    if (rd.histogram.length) {
      const maxCount = Math.max.apply(null, rd.histogram.map(function(b) { return b.count; }));
      const barMaxW  = CW - 130;
      rd.histogram.forEach(function(bucket) {
        const label = Math.round(bucket.from / 1000) + "k-" + Math.round(bucket.to / 1000) + "k €";
        const bW    = maxCount > 0 ? Math.round((bucket.count / maxCount) * barMaxW) : 0;
        const isOpt = rd.priceOptimal >= bucket.from && rd.priceOptimal < bucket.to;
        dt(p2, label, MX, y + 3, 8, ib, isOpt ? AMBER : GRAY);
        fr(p2, MX + 72, y, barMaxW, 14, hex("#F0F0F0"));
        if (bW > 0) fr(p2, MX + 72, y, bW, 14, isOpt ? AMBER : hex("#CBE5E4"));
        dt(p2, String(bucket.count), MX + 74 + barMaxW, y + 3, 8, ib, GRAY);
        if (isOpt) dt(p2, "â—„ tu", MX + 74 + bW + 4, y + 4, 7.5, rb, AMBER);
        y += 20;
      });
    }
    y += 8;

    // Market velocity
    dt(p2, "Velocidad del mercado", MX, y, 15, rb, INK); y += 18;
    dt(p2, "Como de rapido se mueve este modelo, y que significa para tu venta.", MX, y, 8.5, ib, GRAY); y += 14;

    const mvW = (CW - 16) / 3;
    const pvdDiff = rd.dealerMedian && rd.privateMedian ? Math.round(((rd.privateMedian - rd.dealerMedian) / rd.dealerMedian) * 100) : null;
    const tr = rd.priceTrend;
    const mv2c = tr ? (tr.direction === "up" ? GREEN : tr.direction === "down" ? RED : TEAL) : GRAY;
    const mvItems = [
      { n: pvdDiff != null ? (pvdDiff > 0 ? "+" : "") + pvdDiff + "%" : "-", l: "PARTICULAR VS. CONCESIONARIO", s: pvdDiff != null ? (pvdDiff < 0 ? "Los particulares publican mas barato" : "Dealers publican mas barato") : "Sin datos de segmentacion", c: INK },
      { n: tr ? (tr.direction === "up" ? "Al alza" : tr.direction === "down" ? "A la baja" : "Estable") : "-", l: "TENDENCIA DE PRECIO", s: tr ? "\xB1" + Math.abs(tr.pctMonthly || 0).toFixed(1) + "% mensual en 8 semanas" : "Sin datos de tendencia", c: mv2c },
      { n: rd.comparables > 0 ? (rd.comparables >= 80 ? "Alta" : rd.comparables >= 30 ? "Media" : "Baja") : "-", l: "PRESION DE OFERTA", s: rd.comparables > 0 ? rd.comparables + " activos para demanda " + (rd.demand === "ALTO" ? "alta" : rd.demand === "MEDIO" ? "media" : "baja") : "Sin comparables", c: TEAL },
    ];
    mvItems.forEach(function(mv, i) {
      const mx2 = MX + i * (mvW + 8);
      fr(p2, mx2, y, mvW, 56, WHITE, BORDER, 0.5);
      dt(p2, mv.l, mx2 + 10, y + 8,  6,  rb, LIGHT);
      dt(p2, mv.n, mx2 + 10, y + 20, 15, rb, mv.c);
      dt(p2, mv.s, mx2 + 10, y + 44, 7,  ib, GRAY, mvW - 20);
    });
  }

  footer(p2, null, ib);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  PAGE 3 - ESTRATEGIA + FACTORES + COMPARABLES
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const p3 = pdfDoc.addPage([W, H]);
  runhead(p3, vLabel, 3, rb, ib);
  y = 46;

  // Strategy scenarios
  dt(p3, "Estrategia de venta", MX, y, 15, rb, INK); y += 18;
  dt(p3, "Tres escenarios segun tu objetivo. El recomendado equilibra precio y tiempo.", MX, y, 8.5, ib, GRAY); y += 16;

  const scenarios = [
    { tag: "VENTA RAPIDA",  price: rd.priceLow,     t: rd.days ? Math.round(rd.days*0.5) + "-" + Math.round(rd.days*0.7) + " dias" : "15-25 dias",  bg: WHITE,          bc: BORDER, tc: TEAL,  desc: "Precio competitivo. Ideal si necesitas liquidez pronto." },
    { tag: "* RECOMENDADO", price: rd.priceOptimal, t: rd.days ? Math.round(rd.days*0.8) + "-" + Math.round(rd.days*1.2) + " dias" : "30-45 dias",  bg: hex("#F8FBF8"), bc: TEAL,   tc: TEAL,  desc: "Mejor relacion entre precio y tiempo de venta.", reco: true },
    { tag: "MAXIMO VALOR",  price: rd.priceHigh,    t: rd.days ? Math.round(rd.days*1.4) + "-" + Math.round(rd.days*1.9) + " dias" : "50-75 dias",  bg: WHITE,          bc: BORDER, tc: GRAY,  desc: "Por encima de la mediana. Requiere paciencia." },
  ];
  const sW = (CW - 16) / 3;
  scenarios.forEach(function(sc, i) {
    const sx = MX + i * (sW + 8);
    fr(p3, sx, y, sW, 110, sc.bg, sc.bc, sc.reco ? 1.5 : 0.5);
    dt(p3, sc.tag, sx + 10, y + 10, 7.5, rb, sc.reco ? TEAL : sc.tc);
    dt(p3, eur(sc.price), sx + 10, y + 22, 20, rb, sc.reco ? TEAL : INK);
    // time-to-sell estimate omitted: rd.days is scraped_at-based, not real market days
    ln(p3, sx + 10, y + 64, sx + sW - 10, y + 64, BORDER, 0.5);
    wrapText(sc.desc, 30).forEach(function(l, li) { dt(p3, l, sx + 10, y + 70 + li * 12, 8, ib, hex("#46535C")); });
  });
  y += 126;

  // Adjustment factors table
  dt(p3, "Factores de ajuste de este vehiculo", MX, y, 15, rb, INK); y += 18;
  dt(p3, rd.usedFallback ? "Ajustes sobre la curva de depreciacion estandar." : "Como cada caracteristica mueve el precio respecto a la media del mercado.", MX, y, 8.5, ib, GRAY); y += 14;

  const hasDmg = rd.damageFactor < 0.99;
  const dmgPct = Math.round((1 - rd.damageFactor) * 100);
  const dmgSrc = rd.aiDamageFactor != null ? "calculado por IA" : "tabla estandar";

  const adjs = rd.usedFallback
    ? [
        { f: "Depreciacion",   imp: vAge != null ? "x" + standardDepreciationFactor(vAge).toFixed(2) + " (" + vAge + " anos)" : "-", c2: GRAY, n: "Curva estandar " + (rd.vehicle.brand || "") + " \xB7 ref. nuevo ~" + eur(rd.fallbackRefPrice) },
        { f: "Kilometraje",    imp: vKm && vAge ? (vKm > vAge*15000 ? eurSigned(Math.round(-(vKm - vAge*15000)*0.08)) : "neutro") : "-", c2: vKm && vAge && vKm > vAge*15000 ? RED : GRAY, n: vKm ? new Intl.NumberFormat("es-ES").format(vKm) + " km \xB7 media esperada ~" + new Intl.NumberFormat("es-ES").format((vAge||0)*15000) + " km" : "Km no declarado" },
        { f: "Estado / Danos", imp: hasDmg ? "-" + dmgPct + "% (" + dmgSrc + ")" : "neutro", c2: hasDmg ? RED : GRAY, n: hasDmg ? (rd.vehicle.damageLevel || "Danos") + " \xB7 factor " + rd.damageFactor.toFixed(2) : "Sin danos declarados" },
      ]
    : [
        {
          f: "Ajuste por uso",
          imp: Math.abs(rd.usageImpact) > 50 ? eurSigned(rd.usageImpact) : "neutro",
          c2: rd.usageImpact > 50 ? GREEN : rd.usageImpact < -50 ? RED : GRAY,
          n: rd.usageUsedDefault
            ? (vKm != null ? new Intl.NumberFormat("es-ES").format(vKm) + " km" + (rd.kmAdvantagePct != null && rd.kmAdvantagePct > 60 ? " \xB7 menos km que el " + rd.kmAdvantagePct + "% del mercado" : "") + " \xB7 " : "") + (vAge != null ? vAge + " anos \xB7 " : "") + "estimado por segmento" + (rd.usageCapApplied ? " \xB7 tope de segmento" : "")
            : (rd.usageImpact > 50 ? (vKm != null ? new Intl.NumberFormat("es-ES").format(vKm) + " km, muy por debajo de la media de sus comparables" : "Km y antiguedad favorables vs. mercado") + (rd.usageCapApplied ? " \xB7 tope de segmento" : "")
               : rd.usageImpact < -50 ? "Km elevado o antiguedad alta vs. mercado" + (rd.usageCapApplied ? " \xB7 tope de segmento" : "")
               : "Km y antiguedad en linea con el mercado"),
        },
        { f: "Estado / Danos", imp: hasDmg ? "-" + dmgPct + "% (" + dmgSrc + ")" : "neutro", c2: hasDmg ? RED : GRAY, n: hasDmg ? (rd.vehicle.damageLevel || "Danos") + " \xB7 factor " + rd.damageFactor.toFixed(2) : "Sin danos declarados" },
      ];

  const oa = rd.ownerAdj;
  if (oa.pct !== 0 || rd.vehicle.owners || rd.vehicle.serviceHistory) {
    const ownL = rd.vehicle.owners === "1" ? "1 propietario" : rd.vehicle.owners === "2" ? "2 propietarios" : rd.vehicle.owners === "3" ? "3+ propietarios" : "";
    const histL = rd.vehicle.serviceHistory === "oficial" ? "historial oficial completo" : rd.vehicle.serviceHistory === "parcial" ? "historial parcial" : rd.vehicle.serviceHistory === "sin" ? "sin historial" : "";
    adjs.push({ f: "Propietarios e historial", imp: oa.pct !== 0 ? (oa.pct > 0 ? "+" : "") + oa.pct + "%" : "neutro", c2: oa.pct > 0 ? GREEN : oa.pct < 0 ? RED : GRAY, n: [ownL, histL].filter(Boolean).join(" \xB7 ") || "Dato parcial" });
  }
  if (rd.vehicle.color) {
    const ca = rd.colorAdj;
    const colorName = rd.vehicle.color.charAt(0).toUpperCase() + rd.vehicle.color.slice(1);
    adjs.push(ca.pct !== 0
      ? { f: "Color", imp: ca.pct + "%", c2: ca.pct < 0 ? RED : GRAY, n: colorName + " - menor liquidez vs. blanco/negro/plata" }
      : { f: "Color", imp: "neutro", c2: GRAY, n: colorName + " - color de alta liquidez en el mercado espanol" });
  }
  if (rd.zbeFlag) adjs.push({ f: "Restriccion ZBE", imp: "-8% a -15%", c2: RED, n: rd.zbeFlag.norm + " \xB7 " + rd.zbeFlag.impact });
  if (rd.envLabel && (rd.envLabel.code === "B" || rd.envLabel.code === "sin")) {
    adjs.push({ f: "Etiqueta DGT", imp: rd.envLabel.code === "sin" ? "-10% a -18%" : "-3% a -8%", c2: RED, n: "Etiqueta " + rd.envLabel.code + " \xB7 " + rd.envLabel.detail });
  }
  if (rd.itvWarning) adjs.push({ f: "Estado ITV", imp: rd.itvWarning.level === "danger" ? "-5% a -12%" : "-1% a -3%", c2: RED, n: rd.itvWarning.detail.slice(0, 80) });

  fr(p3, MX, y, CW, 20, BG, BORDER, 0.5);
  dt(p3, "FACTOR",   MX + 10,  y + 6, 6.5, rb, LIGHT);
  dt(p3, "IMPACTO",  MX + 200, y + 6, 6.5, rb, LIGHT);
  dt(p3, "DETALLE",  MX + 310, y + 6, 6.5, rb, LIGHT);
  y += 20;

  adjs.forEach(function(adj, i) {
    fr(p3, MX, y, CW, 22, i % 2 === 0 ? WHITE : hex("#FAFAFA"));
    dt(p3, adj.f,   MX + 10,  y + 6, 9,   rb, INK);
    dt(p3, adj.imp, MX + 210, y + 6, 9,   rb, adj.c2);
    dt(p3, adj.n,   MX + 320, y + 6, 7.5, ib, GRAY, CW - 330);
    y += 22;
  });

  // Comparables
  const validSamples = (rd.samples || []).filter(function(s) { return s.price > 0; });
  if (validSamples.length > 0 && !rd.usedFallback) {
    y += 14;
    dt(p3, "Comparables activos ahora mismo", MX, y, 13, rb, INK); y += 14;
    dt(p3, "Anuncios similares encontrados al generar este informe.", MX, y, 8, ib, GRAY); y += 12;
    fr(p3, MX, y, CW, 20, BG, BORDER, 0.5);
    dt(p3, "ANO",     MX + 8,   y + 5, 6.5, rb, LIGHT);
    dt(p3, "KM",      MX + 52,  y + 5, 6.5, rb, LIGHT);
    dt(p3, "PRECIO",  MX + 148, y + 5, 6.5, rb, LIGHT);
    dt(p3, "VERSION", MX + 248, y + 5, 6.5, rb, LIGHT);
    dt(p3, "PORTAL",  MX + 390, y + 5, 6.5, rb, LIGHT);
    y += 20;
    validSamples.slice(0, 5).forEach(function(s, i) {
      fr(p3, MX, y, CW, 22, i % 2 === 0 ? WHITE : hex("#FAFAFA"));
      dt(p3, String(s.year || "-"),                                                            MX + 8,   y + 6, 8.5, ib, GRAY);
      dt(p3, s.mileage ? new Intl.NumberFormat("es-ES").format(s.mileage) + " km" : "-",      MX + 52,  y + 6, 8.5, ib, GRAY);
      dt(p3, eur(s.price),                                                                          MX + 148, y + 6, 8.5, rb, INK);
      dt(p3, (s.version || s.model || "-").replace(/\s*\(\d+\s*(?:cv|kw)[^)]*\)\s*$/i, "").trim().slice(0, 28), MX + 248, y + 6, 7.5, ib, GRAY, 130);
      dt(p3, (s.portal || "-").slice(0, 18),                                                  MX + 390, y + 6, 7.5, ib, TEAL, 100);
      y += 22;
    });
  }

  footer(p3, null, ib);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  PAGE 4 - PROYECCION Y EVOLUCION
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const p4 = pdfDoc.addPage([W, H]);
  runhead(p4, vLabel, 4, rb, ib);
  y = 46;

  // Depreciation curve
  dt(p4, "\xBFVender ahora o esperar?", MX, y, 15, rb, INK); y += 18;
  dt(p4, "Valor estimado de tu vehiculo en los proximos 24 meses, segun la depreciacion de su segmento.", MX, y, 8.5, ib, GRAY); y += 14;

  const chartH = 130, chartW = CW, chartX = MX;
  const chartY = y;
  fr(p4, chartX, chartY, chartW, chartH, hex("#FAFAFA"), BORDER, 0.5);

  const proj6  = vAge != null ? projectDepreciation(rd.priceOptimal, vAge, 6)  : null;
  const proj12 = vAge != null ? projectDepreciation(rd.priceOptimal, vAge, 12) : null;
  const proj24 = vAge != null ? projectDepreciation(rd.priceOptimal, vAge, 24) : null;
  const projPts = [rd.priceOptimal, proj6, proj12, proj24].filter(function(p) { return p != null; });
  const projLabels = ["Hoy", "+6 meses", "+12 meses", "+24 meses"].slice(0, projPts.length);

  if (projPts.length >= 2) {
    const minP = Math.min.apply(null, projPts) * 0.92;
    const maxP = Math.max.apply(null, projPts) * 1.05;
    const prng = maxP - minP || 1;
    const innerW = chartW - 80, innerX = chartX + 55, innerY = chartY + 12, innerH = chartH - 36;

    [0, 0.5, 1].forEach(function(t) {
      const gPrice = Math.round(minP + t * prng);
      const gy = innerY + Math.round((1 - t) * innerH);
      ln(p4, innerX, gy, innerX + innerW, gy, hex("#EBEBEB"), 0.4);
      dt(p4, eur(gPrice), chartX + 4, gy, 6.5, ib, LIGHT);
    });

    const ptXs = projLabels.map(function(_, i) { return Math.round(innerX + (i / (projLabels.length - 1)) * innerW); });
    const ptYs = projPts.map(function(p) { return Math.round(innerY + (1 - (p - minP) / prng) * innerH); });

    for (var ci = 0; ci < ptXs.length - 1; ci++) {
      ln(p4, ptXs[ci], ptYs[ci], ptXs[ci + 1], ptYs[ci + 1], TEAL, 1.5);
    }

    projPts.forEach(function(p, i) {
      const dotColor = i === 0 ? AMBER : TEAL;
      fr(p4, ptXs[i] - 4, ptYs[i] - 4, 8, 8, dotColor);
      dt(p4, eur(p), ptXs[i] - 14, ptYs[i] - 16, 7.5, rb, i === 0 ? AMBER : INK);
      dt(p4, projLabels[i], ptXs[i] - 18, chartY + chartH - 18, 7, ib, GRAY);
    });
  } else {
    dt(p4, "Proyeccion no disponible (ano del vehiculo no indicado)", chartX + 20, chartY + chartH / 2, 9, ib, GRAY);
  }
  y += chartH + 8;

  if (proj6 != null) {
    const loss6 = rd.priceOptimal - proj6;
    fr(p4, MX, y, CW, 28, hex("#F8F8F8"), BORDER, 0.4);
    dt(p4, "Esperar seis meses supone perder en torno a " + eur(loss6) + " de valor. La depreciacion es mas pronunciada en los primeros meses y se suaviza despues.", MX + 12, y + 8, 8, ib, hex("#46535C"), CW - 24);
    y += 36;
  }
  y += 10;

  // Time-to-sell bar: omitted until listed_at is populated.
  // rd.days comes from COALESCE(listed_at, scraped_at); since listed_at is NULL
  // across the entire table, the value measures days-in-our-DB, not days-on-portal.
  // Showing it with the current label would be a false measurement.
  y += 10;

  // Comparable listings with days-published column: omitted until listed_at is populated.
  // The "days published" data is not available (listed_at NULL across moveadvisor_market_offers).
  // The comparables table is already shown on page 3; repeating it here without new columns adds no value.

  footer(p4, null, ib);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  PAGE 5 - COMO VENDER MEJOR + METODOLOGIA
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const p5 = pdfDoc.addPage([W, H]);
  runhead(p5, vLabel, 5, rb, ib);
  y = 46;

  const ai = rd.aiAnalysis;
  if (ai) {
    dt(p5, "Analisis de Inteligencia de Mercado", MX, y, 15, rb, INK); y += 22;
    dt(p5, "Generado por IA a partir de los datos de mercado de tu vehiculo.", MX, y, 8.5, ib, GRAY); y += 14;
    fr(p5, MX, y, CW, 2, TEAL); y += 8;
    wrapText(ai.analisisMercado || "", 90).forEach(function(l) { dt(p5, l, MX, y, 9, ib, hex("#46535C")); y += 13; });
    y += 8;
    if (Array.isArray(ai.factoresClave) && ai.factoresClave.length) {
      dt(p5, "Factores clave:", MX, y, 9, rb, INK); y += 14;
      ai.factoresClave.forEach(function(f) {
        dt(p5, "\xb7", MX, y, 9, rb, AMBER);
        wrapText(f, 86).forEach(function(l) { dt(p5, l, MX + 12, y, 8.5, ib, hex("#46535C")); y += 12; });
        y += 2;
      });
      y += 6;
    }
    if (ai.margenNegociacion && ai.margenNegociacion.pct) {
      fr(p5, MX, y, CW, 28, hex("#F2F7F7"), BORDER, 0.5);
      dt(p5, "Margen de negociacion estimado: " + ai.margenNegociacion.pct + "%", MX + 10, y + 7, 9, rb, TEAL);
      if (ai.margenNegociacion.estrategia) dt(p5, ai.margenNegociacion.estrategia, MX + 10, y + 19, 8, ib, GRAY);
      y += 38;
    }
    dt(p5, "Consejos personalizados para tu vehiculo", MX, y, 13, rb, INK); y += 18;
    if (Array.isArray(ai.consejosPersonalizados)) {
      ai.consejosPersonalizados.forEach(function(tip, i) {
        const cx = MX + (i % 2) * (CW / 2 + 8), tyR = y + Math.floor(i / 2) * 44;
        dt(p5, "+", cx, tyR, 10, rb, AMBER);
        wrapText(tip, 42).forEach(function(l, li) { dt(p5, l, cx + 14, tyR + li * 12, 8, ib, hex("#46535C")); });
      });
      y += Math.ceil((ai.consejosPersonalizados.length || 0) / 2) * 44 + 10;
    }
  } else {
    dt(p5, "Como vender mejor", MX, y, 15, rb, INK); y += 18;
    dt(p5, "Recomendaciones para maximizar el precio y reducir el tiempo de venta.", MX, y, 8.5, ib, GRAY); y += 18;
    const tips = [
      ["Limpieza a fondo",    "Un vehiculo limpio, dentro y fuera, mejora la percepcion de valor un 10-15%."],
      ["Fotos profesionales", "Luz natural, fondo neutro y 8-10 angulos distintos, incluido el interior."],
      ["Historial al dia",    "Revisiones y documentos en orden generan confianza y justifican el precio."],
      ["Precio de salida",    "Empieza en " + eur(rd.priceOptimal) + " para dejar margen de negociacion sin ahuyentar visitas."],
      ["Varios portales",     "Presencia en AutoScout24, coches.com y Wallapop multiplica el alcance."],
      ["Responde rapido",     "Contestar en menos de 1 hora aumenta un 60% la tasa de visita."],
    ];
    tips.forEach(function(tip, i) {
      const col = i % 2, row = Math.floor(i / 2);
      const tx = MX + col * (CW / 2 + 8), tyR = y + row * 52;
      fr(p5, tx, tyR, CW / 2 - 4, 46, WHITE, BORDER, 0.5);
      dt(p5, tip[0], tx + 12, tyR + 10, 9, rb, INK);
      wrapText(tip[1], 38).forEach(function(l, li) { dt(p5, l, tx + 12, tyR + 22 + li * 11, 8, ib, hex("#46535C")); });
    });
    y += Math.ceil(tips.length / 2) * 52 + 16;
  }

  dt(p5, "Metodologia y fuentes", MX, y, 13, rb, INK); y += 18;
  const methodBase = rd.usedFallback
    ? "No se encontraron comparables activos en portales. El precio se ha estimado mediante curva de depreciacion estandar calibrada por segmento de marca, con ajuste por kilometraje relativo a la media esperada para la antiguedad declarada."
    : "Datos en tiempo real de los principales portales de VO en Espana. El precio recomendado es la mediana de los comparables tras un filtrado de atipicos (Tukey, IQR x1,5), sobre un conjunto equilibrado en antiguedad para que tu vehiculo quede centrado en la muestra. El ajuste por uso combina kilometraje y antiguedad frente a los comparables reales. El precio estimado de cierre es orientativo: se basa en el ultimo precio publicado de anuncios similares que salieron del mercado, no en el precio final de la transaccion, que no es observable publicamente. Es una estimacion preliminar por segmento de precio.";
  const methodDmg = rd.aiDamageFactor != null
    ? " Factor de danos calculado por IA (Gemini) a partir de la descripcion real del vehiculo."
    : (rd.damageFactor < 1 ? " Factor de danos por tabla estandar (leve/moderado/grave)." : "");
  var my = y;
  wrapText(methodBase + methodDmg, 92).forEach(function(l) { dt(p5, l, MX, my, 8, ib, hex("#46535C")); my += 12; });
  y = my + 14;

  fr(p5, MX, y, CW, 68, BG, BORDER, 0.5);
  const disc = "AVISO LEGAL: Este informe tiene caracter informativo y no constituye una tasacion pericial oficial. Los precios son estimaciones basadas en datos de mercado publicos en el momento de la consulta. CarsWise AI no garantiza la venta al precio indicado ni asume responsabilidad por decisiones tomadas a partir de este informe. Valido 30 dias desde la fecha de emision.";
  wrapText(disc, 95).forEach(function(l, i) { dt(p5, l, MX + 12, y + 10 + i * 11, 7.5, ib, GRAY); });

  footer(p5, "CarsWise AI \xB7 " + rd.generatedAt + " \xB7 www.carswiseai.com", ib);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // Diagnostic tuple - logged on every production tasación for observability
  const mkt = national.market || {};
  const effectiveFactor = Math.max(0.72, reportData.damageFactor * (reportData.colorAdj?.factor ?? 1) * (reportData.ownerAdj?.factor ?? 1));
  console.log("[SELL_REPORT]", JSON.stringify({
    brand:          vehicle.brand,
    model:          vehicle.model,
    slopeKm:        mkt.slopeKm        ?? null,
    slopeYear:      mkt.slopeYear      ?? null,
    usageUsedDefault: mkt.usageUsedDefault === undefined ? false : mkt.usageUsedDefault,
    usageImpact:    mkt.usageImpact     ?? null,
    rawUsageImpact: mkt.rawUsageImpact  ?? null,
    medKm:          mkt.usageMedianKm  ?? null,
    medYr:          mkt.usageMedianYr  ?? null,
    n:              national.comparables ?? 0,
    usedFallback:   reportData.usedFallback,
    cascadeRelaxed: national.cascadeRelaxed,
    damageFactor:   reportData.damageFactor,
    effectiveFactor,
  }));

  // Telemetry INSERT - awaited with 250 ms timeout so it executes in serverless
  // environments where fire-and-forget promises are frozen after the response is sent.
  const { segment: usageSegment, matched: segmentMatched } = getBrandSegmentInfo(vehicle.brand);
  try {
    const pgPool = getPostgresPool();
    if (pgPool) {
      // Both sides of the race must never reject - otherwise the loser becomes an
      // unhandled rejection. Query gets its own .catch(); timeout resolves (not rejects).
      const q = pgPool.query(
        `INSERT INTO sell_report_telemetry
           (brand, model, slope_km, slope_year, usage_used_default,
            usage_impact, raw_usage_impact, med_km, med_yr, n,
            used_fallback, cascade_relaxed, damage_factor, effective_factor,
            market_median, depreciation_estimate,
            usage_segment, segment_matched, model_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          vehicle.brand,
          vehicle.model,
          mkt.slopeKm        ?? null,
          mkt.slopeYear      ?? null,
          mkt.usageUsedDefault === undefined ? false : mkt.usageUsedDefault,
          mkt.usageImpact    ?? null,
          mkt.rawUsageImpact ?? null,
          mkt.usageMedianKm  ?? null,
          mkt.usageMedianYr  ?? null,
          national.comparables ?? 0,
          reportData.usedFallback,
          JSON.stringify(national.cascadeRelaxed),
          reportData.damageFactor,
          effectiveFactor,
          reportData.marketMedian,
          reportData.depreciationEstimate,
          usageSegment,
          segmentMatched,
          SELL_REPORT_VERSION,
        ]
      ).catch(() => {});
      await Promise.race([q, new Promise(resolve => setTimeout(resolve, 250))]);
    }
  } catch (_e) {
    console.error('[SELL_REPORT_TELEMETRY] INSERT failed:', _e?.message ?? _e);
  }

  const pdfBuffer = await buildPdf(reportData);
  return { pdfBuffer, reportData };
}

module.exports = { generateSellReport, buildReportData, buildPdf, BRAND_TIERS, getClosingFactor, CLOSE_FACTORS };
