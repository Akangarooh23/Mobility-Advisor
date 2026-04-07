import { useEffect, useState, useRef } from "react";
import {
  SiAudi,
  SiBmw,
  SiHyundai,
  SiKia,
  SiMg,
  SiNissan,
  SiRenault,
  SiSeat,
  SiSkoda,
  SiToyota,
  SiVolkswagen,
  SiVolvo,
} from "react-icons/si";

const ANALYZE_API_ENDPOINT = "/api/analyze";
const LISTING_API_ENDPOINT = "/api/find-listing";

function countAnsweredSteps(answers) {
  return STEPS.reduce((acc, stepConfig) => {
    const value = answers?.[stepConfig.id];

    if (Array.isArray(value)) {
      return acc + (value.length > 0 ? 1 : 0);
    }

    return acc + (value ? 1 : 0);
  }, 0);
}

function sanitizeJsonStringContent(input) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (const ch of input) {
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString && (ch === "\n" || ch === "\r")) {
      result += "\\n";
      continue;
    }

    result += ch;
  }

  return result;
}

function parseAdvisorJson(rawText) {
  const text = String(rawText || "").replace(/```json|```/gi, "").trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  const jsonSlice =
    firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
      ? text.slice(firstBrace, lastBrace + 1)
      : text;

  const base = sanitizeJsonStringContent(
    jsonSlice
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
  );

  // Intento 1: JSON estricto
  try {
    return JSON.parse(base);
  } catch {}

  // Intento 2: convertir claves con comillas simples a dobles
  const singleQuotedKeys = base.replace(/([{,]\s*)'([^'\\]+?)'\s*:/g, '$1"$2":');
  try {
    return JSON.parse(singleQuotedKeys);
  } catch {}

  // Intento 3: comillar claves sin comillas y normalizar strings con comillas simples
  const repaired = singleQuotedKeys
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:/g, '$1"$2":')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  return JSON.parse(repaired);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function normalizeAlternative(item) {
  return {
    tipo: normalizeText(item?.tipo),
    score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
    titulo: normalizeText(item?.titulo),
    razon: normalizeText(item?.razon),
  };
}

function normalizeAdvisorResult(value) {
  const main = value?.solucion_principal || {};

  return {
    alineacion_pct: Number.isFinite(Number(value?.alineacion_pct)) ? Number(value.alineacion_pct) : 0,
    solucion_principal: {
      tipo: normalizeText(main.tipo),
      score: Number.isFinite(Number(main.score)) ? Number(main.score) : 0,
      titulo: normalizeText(main.titulo),
      resumen: normalizeText(main.resumen),
      ventajas: normalizeStringArray(main.ventajas),
      inconvenientes: normalizeStringArray(main.inconvenientes),
      coste_estimado: normalizeText(main.coste_estimado),
      empresas_recomendadas: normalizeStringArray(main.empresas_recomendadas),
      etiqueta_dgt: normalizeText(main.etiqueta_dgt),
      tension_principal: normalizeText(main.tension_principal),
    },
    alternativas: Array.isArray(value?.alternativas)
      ? value.alternativas.map(normalizeAlternative).filter((item) => item.titulo || item.razon)
      : [],
    tco_aviso: normalizeText(value?.tco_aviso),
    consejo_experto: normalizeText(value?.consejo_experto),
    siguiente_paso: normalizeText(value?.siguiente_paso),
    propulsiones_viables: normalizeStringArray(value?.propulsiones_viables),
  };
}

function isCompleteAdvisorResult(value) {
  const normalized = normalizeAdvisorResult(value);
  const main = normalized.solucion_principal;

  return Boolean(
    normalized.alineacion_pct > 0 &&
      main.tipo &&
      main.score > 0 &&
      main.titulo &&
      main.resumen &&
      main.ventajas.length >= 2 &&
      main.inconvenientes.length >= 1 &&
      main.coste_estimado &&
      main.empresas_recomendadas.length >= 1 &&
      normalized.alternativas.length >= 1 &&
      normalized.tco_aviso &&
      normalized.consejo_experto &&
      normalized.siguiente_paso &&
      normalized.propulsiones_viables.length >= 1
  );
}

async function readApiResponse(response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html") || trimmed.startsWith("<")) {
    const error = new Error(
      typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)
        ? "El endpoint /api/analyze no estaba respondiendo como API en local. Reinicia el servidor y vuelve a probar el test."
        : "El endpoint /api/analyze ha devuelto HTML en lugar de JSON. Revisa el despliegue y la configuracion de la API."
    );
    error.code = "NON_JSON_API_RESPONSE";
    throw error;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const error = new Error("La respuesta del analisis no tiene un JSON valido.");
    error.code = "INVALID_API_RESPONSE";
    throw error;
  }
}

function MercedesLogo({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <path d="M12 5.2v6.8M12 12l-5.8 3.4M12 12l5.8 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BydLogo({ size = 14 }) {
  return (
    <svg viewBox="0 0 36 24" width={size} height={size} fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="31" height="17" rx="8.5" stroke="currentColor" strokeWidth="2" />
      <text x="18" y="15.2" textAnchor="middle" fontSize="9.2" fontWeight="700" fontFamily="Segoe UI, Arial, sans-serif" fill="currentColor">
        BYD
      </text>
    </svg>
  );
}

function XPengLogo({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M4.5 8.2 9.5 12l2.5-1.7L14.5 12l5-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 12v4.8M14.5 12v4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ─────────────────────────────────────────
// STEPS — todas las preguntas del marco
// ─────────────────────────────────────────
const STEPS = [
  // BLOQUE 1 — PERFIL BASE
  {
    id: "perfil",
    block: "Perfil",
    blockIcon: "👤",
    question: "¿Para quién es la movilidad?",
    subtitle: "Esto nos ayuda a personalizar el análisis completo",
    type: "cards",
    options: [
      { value: "particular", label: "Para mí / familia", icon: "👤", desc: "Uso personal o familiar" },
      { value: "empresa", label: "Para mi empresa", icon: "🏢", desc: "Flota o vehículo de empresa" },
      { value: "autonomo", label: "Soy autónomo", icon: "💼", desc: "Uso mixto profesional / personal" },
    ],
  },
  {
    id: "flexibilidad",
    block: "Vinculación",
    blockIcon: "🤝",
    question: "¿Qué relación prefieres con el vehículo?",
    subtitle: "Cada modelo tiene implicaciones financieras y de riesgo muy distintas",
    type: "cards",
    options: [
      { value: "propiedad_contado", label: "Comprar al contado", icon: "💶", desc: "Mayor poder negociador, capital inmovilizado" },
      { value: "propiedad_financiada", label: "Comprar financiado", icon: "📝", desc: "Pago a plazos, coche mío al final" },
      { value: "renting", label: "Renting (cuota fija)", icon: "📅", desc: "Todo incluido, sin propiedad" },
      { value: "flexible", label: "Lo más flexible posible", icon: "⚡", desc: "Pagar solo cuando uso o suscripción" },
    ],
  },
  // BLOQUE 0 — DIMENSIÓN ENERGÉTICA (muy determinante)
  {
    id: "propulsion_preferida",
    block: "Energía",
    blockIcon: "⚡",
    question: "¿Qué motorización prefieres?",
    subtitle: "Es una decisión clave porque condiciona coste total, etiqueta DGT, ZBE y uso real",
    type: "cards",
    options: [
      { value: "electrico_puro", label: "Eléctrico puro (BEV)", icon: "⚡", desc: "Etiqueta CERO — recarga 100% eléctrica" },
      { value: "hibrido_no_enchufable", label: "Híbrido no enchufable (HEV)", icon: "🔋", desc: "Etiqueta ECO — sin enchufe, muy eficiente en ciudad" },
      { value: "hibrido_enchufable", label: "Híbrido enchufable (PHEV)", icon: "🔌", desc: "Etiqueta CERO/ECO según autonomía — requiere hábito de carga" },
      { value: "microhibrido", label: "Microhíbrido (MHEV)", icon: "⚙️", desc: "Etiqueta ECO — apoyo eléctrico ligero al motor térmico" },
      { value: "gasolina", label: "Gasolina", icon: "⛽", desc: "Suele encajar en kilometrajes medios o bajos" },
      { value: "diesel", label: "Diésel", icon: "🛢️", desc: "Más interesante con kilometrajes altos y trayectos largos" },
      { value: "glp_gnc", label: "GLP / GNC", icon: "🟢", desc: "Alternativa de menor coste por km donde hay infraestructura" },
      { value: "indiferente_motor", label: "Sin preferencia", icon: "🤷", desc: "Priorizo que el análisis elija lo óptimo" },
    ],
  },
  {
    id: "horizonte",
    block: "Capacidad",
    blockIcon: "📅",
    question: "¿Cuánto tiempo piensas quedarte con el vehículo?",
    subtitle: "Condiciona qué riesgos son más relevantes para ti",
    type: "cards",
    options: [
      { value: "menos_2", label: "Menos de 2 años", icon: "⚡", desc: "Maxima flexibilidad, depreciación muy relevante" },
      { value: "2_3", label: "2 - 3 años", icon: "🚗", desc: "Plazo corto con foco en valor de reventa" },
      { value: "3_5", label: "3 - 5 años", icon: "📊", desc: "Equilibrio entre cuota, uso y riesgo" },
      { value: "5_7", label: "5 - 7 años", icon: "🛠️", desc: "Empieza a pesar más el mantenimiento" },
      { value: "mas_7", label: "Mas de 7 años", icon: "🏠", desc: "Propiedad larga: fiabilidad y costes futuros clave" },
      { value: "no_claro", label: "Aun no lo tengo claro", icon: "🤔", desc: "Necesito una opcion flexible mientras decido" },
    ],
  },

  // BLOQUE 2 — USO Y NECESIDADES
  {
    id: "km_anuales",
    block: "Uso real",
    blockIcon: "🛣️",
    question: "¿Cuántos kilómetros haces al año aproximadamente?",
    subtitle: "Condiciona la amortización de cada tipo de motor",
    type: "cards",
    options: [
      { value: "menos_10k", label: "Menos de 10.000 km", icon: "🐢", desc: "Uso muy puntual" },
      { value: "10k_20k", label: "10.000 – 20.000 km", icon: "🚶", desc: "Uso moderado" },
      { value: "mas_20k", label: "Más de 20.000 km", icon: "🚀", desc: "Uso intensivo" },
    ],
  },
  {
    id: "entorno_uso",
    block: "Uso real",
    blockIcon: "🗺️",
    question: "¿Cuál es tu entorno de conducción dominante?",
    subtitle: "Incluye tu contexto de ciudad/zona (ZBE), consumo real y tipo de uso",
    type: "cards",
    options: [
      { value: "ciudad", label: "Ciudad principalmente", icon: "🏙️", desc: "Tráfico, atascos, aparcamiento" },
      { value: "interurbano", label: "Carretera interurbana", icon: "🛤️", desc: "Tramos mixtos, pueblos" },
      { value: "autopista", label: "Autopista / largo radio", icon: "🛣️", desc: "Viajes frecuentes >100 km" },
      { value: "mixto", label: "Todo por igual", icon: "🔄", desc: "Sin un entorno claro" },
    ],
  },
  {
    id: "uso_principal",
    block: "Uso real",
    blockIcon: "🎯",
    question: "¿Para qué lo usas principalmente?",
    subtitle: "Selecciona todas las que apliquen",
    type: "multi",
    options: [
      { value: "trabajo_diario", label: "Ir al trabajo cada día", icon: "🏃" },
      { value: "viajes_ocio", label: "Viajes de ocio o vacaciones", icon: "✈️" },
      { value: "visitas_clientes", label: "Visitar clientes / reuniones", icon: "🤝" },
      { value: "compras_recados", label: "Compras y recados puntuales", icon: "🛒" },
      { value: "familia", label: "Llevar familia / niños", icon: "👨‍👩‍👧" },
      { value: "remolque", label: "Remolcar (caravana, tráiler)", icon: "🚚" },
    ],
  },

  // BLOQUE 3 — CAPACIDAD REQUERIDA
  {
    id: "ocupantes",
    block: "Capacidad",
    blockIcon: "💺",
    question: "¿Qué combinación de plazas y maletero necesitas habitualmente?",
    subtitle: "Así recogemos en una sola respuesta el espacio para personas y carga diaria",
    type: "cards",
    options: [
      { value: "2_plazas_maletero_pequeno", label: "1-2 plazas + maletero pequeño", icon: "👤", desc: "Uso individual o pareja" },
      { value: "5_plazas_maletero_medio", label: "3-5 plazas + maletero medio", icon: "👨‍👩‍👧", desc: "Uso familiar equilibrado" },
      { value: "7_plazas_maletero_grande", label: "6-7 plazas + maletero grande", icon: "🚐", desc: "Familia numerosa o mucho equipaje" },
    ],
  },
  // BLOQUE 4 — PREFERENCIAS DE PRODUCTO
  {
    id: "marca_preferencia",
    block: "Preferencias",
    blockIcon: "🏷️",
    question: "¿Tienes preferencia de marca?",
    subtitle: "Las gamas de entrada premium suelen ofrecer peor relación valor/precio",
    type: "cards",
    options: [
      {
        value: "generalista_europea",
        label: "Generalista europea",
        icon: "🔧",
        desc: "Precio equilibrado y red de talleres amplia",
        brandChips: [
          { short: "VW", tone: "#1d4ed8", label: "Volkswagen" },
          { short: "SE", tone: "#0f172a", label: "Seat" },
          { short: "RE", tone: "#f59e0b", label: "Renault" },
          { short: "SK", tone: "#16a34a", label: "Skoda" },
        ],
      },
      {
        value: "asiatica_fiable",
        label: "Asiática enfocada en fiabilidad",
        icon: "🛡️",
        desc: "Muy buena reputación en consumo y durabilidad",
        brandChips: [
          { short: "TY", tone: "#ef4444", label: "Toyota" },
          { short: "HY", tone: "#0ea5e9", label: "Hyundai" },
          { short: "KI", tone: "#dc2626", label: "Kia" },
          { short: "NS", tone: "#64748b", label: "Nissan" },
        ],
      },
      {
        value: "premium_alemana",
        label: "Premium alemana",
        icon: "⭐",
        desc: "Imagen, tecnología y coste superior de mantenimiento",
        brandChips: [
          { short: "BM", tone: "#2563eb", label: "BMW" },
          { short: "MB", tone: "#111827", label: "Mercedes" },
          { short: "AU", tone: "#6b7280", label: "Audi" },
        ],
      },
      {
        value: "premium_escandinava",
        label: "Premium escandinava",
        icon: "❄️",
        desc: "Seguridad y confort como prioridad",
        brandChips: [{ short: "VO", tone: "#0284c7", label: "Volvo" }],
      },
      {
        value: "nueva_china",
        label: "Marca emergente (china)",
        icon: "🆕",
        desc: "Equipamiento alto por precio y fuerte enfoque electrificado",
        brandChips: [
          { short: "BY", tone: "#dc2626", label: "BYD" },
          { short: "MG", tone: "#ef4444", label: "MG" },
          { short: "XP", tone: "#111827", label: "XPeng" },
        ],
      },
      {
        value: "sin_preferencia",
        label: "Sin preferencia de marca",
        icon: "🤷",
        desc: "Priorizo coste total, fiabilidad y uso real",
      },
    ],
  },
  {
    id: "vehiculo_actual",
    block: "Restricciones",
    blockIcon: "🔁",
    question: "¿Tienes vehículo actual para entregar o vender?",
    subtitle: "La tasación real puede ser muy distinta al precio emocional",
    type: "cards",
    options: [
      { value: "si_entrego", label: "Sí, lo entrego al comprar", icon: "🔄", desc: "Reduce el diferencial a financiar" },
      { value: "si_vendo", label: "Sí, lo vendo aparte", icon: "💶", desc: "Más control sobre el precio" },
      { value: "no", label: "No tengo vehículo actual", icon: "0️⃣", desc: "Primera compra o ya vendido" },
    ],
  },
];

// ─────────────────────────────────────────
// MOBILITY TYPES
// ─────────────────────────────────────────
const MOBILITY_TYPES = {
  compra_contado: { label: "Compra al Contado", icon: "🔑", color: "#2563EB" },
  compra_financiada: { label: "Compra Financiada", icon: "📝", color: "#7C3AED" },
  renting_largo: { label: "Renting a Largo Plazo", icon: "📅", color: "#059669" },
  renting_corto: { label: "Renting a Corto Plazo", icon: "🗓️", color: "#D97706" },
  rent_a_car: { label: "Rent a Car", icon: "🏢", color: "#DC2626" },
  carsharing: { label: "Carsharing", icon: "🔄", color: "#0891B2" },
  carpooling: { label: "Carpooling", icon: "🤝", color: "#65A30D" },
  transporte_publico: { label: "Transporte Público", icon: "🚇", color: "#9333EA" },
  micromovilidad: { label: "Micromovilidad", icon: "🛴", color: "#E11D48" },
};

// ─────────────────────────────────────────
// BLOCK COLORS
// ─────────────────────────────────────────
const BLOCK_COLORS = {
  "Perfil": "#2563EB",
  "Uso real": "#059669",
  "Capacidad": "#D97706",
  "Preferencias": "#7C3AED",
  "Energía": "#0891B2",
  "Financiero": "#DC2626",
  "Restricciones": "#9333EA",
  "Vinculación": "#E11D48",
  "Riesgo": "#65A30D",
};

const BRAND_LOGOS = {
  Volkswagen: { icon: SiVolkswagen, color: "#0a58ca" },
  Seat: { icon: SiSeat, color: "#6b7280" },
  Renault: { icon: SiRenault, color: "#f59e0b" },
  Skoda: { icon: SiSkoda, color: "#16a34a" },
  Toyota: { icon: SiToyota, color: "#ef4444" },
  Hyundai: { icon: SiHyundai, color: "#0ea5e9" },
  Kia: { icon: SiKia, color: "#dc2626" },
  Nissan: { icon: SiNissan, color: "#64748b" },
  BMW: { icon: SiBmw, color: "#2563eb" },
  Mercedes: { icon: MercedesLogo, color: "#111827" },
  Audi: { icon: SiAudi, color: "#6b7280" },
  Volvo: { icon: SiVolvo, color: "#0284c7" },
  BYD: { icon: BydLogo, color: "#dc2626" },
  MG: { icon: SiMg, color: "#ef4444" },
  XPeng: { icon: XPengLogo, color: "#111827" },
};

const MARKET_BRANDS = {
  Toyota: ["Corolla", "C-HR", "Yaris", "RAV4"],
  Renault: ["Clio", "Captur", "Megane", "Austral"],
  Seat: ["Ibiza", "Leon", "Arona", "Ateca"],
  Volkswagen: ["Polo", "Golf", "T-Roc", "Tiguan"],
  Peugeot: ["208", "2008", "308", "3008"],
  BMW: ["Serie 1", "Serie 3", "X1", "X3"],
  Audi: ["A1", "A3", "Q2", "Q3"],
  Mercedes: ["Clase A", "Clase C", "GLA", "GLC"],
  Volvo: ["XC40", "XC60", "S60", "V60"],
  Kia: ["Ceed", "Niro", "Sportage", "EV6"],
  Hyundai: ["i20", "i30", "Tucson", "Kona"],
  Nissan: ["Micra", "Qashqai", "X-Trail", "Juke"],
  Skoda: ["Fabia", "Octavia", "Kamiq", "Kodiaq"],
  Citroen: ["C3", "C4", "C5 Aircross", "Berlingo"],
  Dacia: ["Sandero", "Duster", "Jogger", "Spring"],
  MG: ["ZS", "HS", "MG4", "Marvel R"],
};

const TOTAL_PURCHASE_OPTIONS = [
  { value: "hasta_10000", label: "Hasta 10.000 €", amount: 10000 },
  { value: "10000_20000", label: "10.000 - 20.000 €", amount: 20000 },
  { value: "20000_30000", label: "20.000 - 30.000 €", amount: 30000 },
  { value: "30000_45000", label: "30.000 - 45.000 €", amount: 45000 },
  { value: "mas_45000", label: "Más de 45.000 €", amount: 55000 },
];

const MONTHLY_BUDGET_OPTIONS = [
  { value: "hasta_200", label: "Hasta 200 €/mes" },
  { value: "200_400", label: "200 - 400 €/mes" },
  { value: "400_700", label: "400 - 700 €/mes" },
  { value: "mas_700", label: "Más de 700 €/mes" },
];

const INCOME_STABILITY_OPTIONS = [
  { value: "fijos_estables", label: "Fijos y estables" },
  { value: "fijos_variable", label: "Fijos + variable" },
  { value: "variables_autonomo", label: "Variables / autónomo" },
];

const FINANCE_AMOUNT_OPTIONS = [
  { value: "hasta_10000", label: "Hasta 10.000 €", amount: 10000 },
  { value: "10000_15000", label: "10.000 - 15.000 €", amount: 15000 },
  { value: "15000_25000", label: "15.000 - 25.000 €", amount: 25000 },
  { value: "25000_40000", label: "25.000 - 40.000 €", amount: 40000 },
  { value: "mas_40000", label: "Más de 40.000 €", amount: 50000 },
];

const ENTRY_AMOUNT_OPTIONS = [
  { value: "sin_entrada", label: "Sin entrada", amount: 0 },
  { value: "hasta_5000", label: "Hasta 5.000 €", amount: 5000 },
  { value: "5000_10000", label: "5.000 - 10.000 €", amount: 10000 },
  { value: "10000_15000", label: "10.000 - 15.000 €", amount: 15000 },
  { value: "mas_15000", label: "Más de 15.000 €", amount: 20000 },
];

const AGE_FILTER_OPTIONS = [
  { value: "all", label: "Sin límite de antigüedad" },
  { value: "2", label: "Hasta 2 años" },
  { value: "4", label: "Hasta 4 años" },
  { value: "6", label: "Hasta 6 años" },
  { value: "8", label: "Hasta 8 años" },
];

const MILEAGE_FILTER_OPTIONS = [
  { value: "all", label: "Sin límite de kilometraje" },
  { value: "20000", label: "Hasta 20.000 km" },
  { value: "50000", label: "Hasta 50.000 km" },
  { value: "80000", label: "Hasta 80.000 km" },
  { value: "120000", label: "Hasta 120.000 km" },
];

const SELL_FUEL_OPTIONS = ["Gasolina", "Diésel", "Híbrido", "PHEV", "Eléctrico"];

const ADVISOR_PILLARS = [
  {
    title: "Financiación",
    text: "Analizamos ahorro disponible, cuota razonable, scoring previo y si tiene más sentido préstamo al consumo, financiera de punto de venta o renting.",
  },
  {
    title: "TCO real",
    text: "Proyectamos mantenimiento preventivo, averías probables, seguros, IVTM, combustible, parking y otros costes mensuales más allá del precio de compra.",
  },
  {
    title: "Garantías",
    text: "Valoramos la cobertura de marca y vendedor, el riesgo jurídico y la opción de defensa o extensión de garantía para proteger la operación.",
  },
  {
    title: "Pricing",
    text: "Usamos inteligencia de mercado para leer rango de precios, rotación, días anunciados y calidad de oferta en compra y renting.",
  },
  {
    title: "Mercado y sesgos",
    text: "Aplicamos señales de mercado y fiabilidad para penalizar motorizaciones o versiones con incidencias recurrentes y premiar las más sólidas.",
  },
  {
    title: "Valor futuro",
    text: "Estimamos depreciación y valor de salida probable según canal, demanda, volumen en renting y comportamiento del VO.",
  },
];

function getOptionAmount(options, value) {
  return options.find((option) => option.value === value)?.amount || 0;
}

function estimateMonthlyPayment(amount, months = 72, annualRate = 0.0899) {
  if (!amount) {
    return 0;
  }

  const monthlyRate = annualRate / 12;
  const factor = Math.pow(1 + monthlyRate, months);
  return Math.round((amount * monthlyRate * factor) / (factor - 1));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildOfferRanking({ brand, model, acquisition, condition, ageFilter, mileageFilter }) {
  const basePriceByBrand = {
    Toyota: 23900,
    Renault: 21400,
    Seat: 20600,
    Volkswagen: 25400,
    Peugeot: 22600,
    BMW: 36800,
    Audi: 38200,
    Mercedes: 39900,
    Volvo: 36400,
    Kia: 24800,
    Hyundai: 24100,
    Nissan: 23200,
    Skoda: 22900,
    Citroen: 21500,
    Dacia: 18900,
    MG: 22100,
  };

  const basePrice = basePriceByBrand[brand] || 24500;
  const ageLimit = ageFilter === "all" ? 6 : Number(ageFilter);
  const mileageLimit = mileageFilter === "all" ? 90000 : Number(mileageFilter);
  const acquisitionDelta = acquisition === "contado" ? -600 : acquisition === "financiado" ? 400 : acquisition === "mixto" ? 150 : 0;
  const conditionDelta = condition === "nuevo" ? 0 : condition === "seminuevo" ? -3200 : -6200;

  return [0, 1, 2].map((index) => {
    const age = Math.max(0, ageLimit - index);
    const mileage = Math.max(10000, mileageLimit - index * 14000);
    const price = Math.max(8900, basePrice + acquisitionDelta + conditionDelta - index * 1800);
    const score = Math.max(74, 93 - index * 6);

    return {
      id: `${brand}-${model}-${index}`,
      title: `${brand} ${model} ${condition === "nuevo" ? "nuevo" : condition === "seminuevo" ? "seminuevo" : "VO certificado"}`,
      price,
      monthly: acquisition === "contado" ? null : estimateMonthlyPayment(Math.max(4000, price * 0.75 - index * 600)),
      age,
      mileage,
      score,
      seller: index === 0 ? "Concesionario oficial" : index === 1 ? "Broker especializado" : "Multimarca certificado",
      insight:
        index === 0
          ? "Mejor equilibrio entre precio, equipamiento y rotación de mercado."
          : index === 1
          ? "Oferta competitiva, pero conviene revisar comisiones y coste financiero asociado."
          : "Alternativa de ahorro con más kilometraje, útil si prima presupuesto sobre valor futuro.",
    };
  });
}

function buildSellEstimate({ brand, model, year, mileage, fuel, sellerType }) {
  const currentYear = 2026;
  const age = Math.max(0, currentYear - Number(year || currentYear));
  const km = Number(mileage || 0);
  const base = 28000 - age * 1700 - km * 0.045;
  const fuelAdjust = fuel === "Híbrido" || fuel === "PHEV" ? 1200 : fuel === "Eléctrico" ? 1800 : fuel === "Diésel" ? -900 : 0;
  const channelAdjust = sellerType === "particular" ? 900 : sellerType === "profesional" ? 0 : -600;
  const center = Math.max(3500, Math.round(base + fuelAdjust + channelAdjust));

  return {
    targetPrice: center,
    lowPrice: Math.max(2900, center - 1200),
    highPrice: center + 1300,
    similarUnits: Math.max(14, 86 - age * 7),
    trend: age <= 3 ? "Mercado estable con demanda activa" : "Mayor sensibilidad a kilometraje y mantenimiento",
    report:
      `${brand} ${model}: recomendamos salir a mercado cerca de ${formatCurrency(center)} y argumentar mantenimiento, equipamiento y trazabilidad para sostener precio.`,
  };
}

// ─────────────────────────────────────────
// APP
// ─────────────────────────────────────────
export default function App() {
  const [entryMode, setEntryMode] = useState(null);
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState({});
  const [multiSelected, setMultiSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [error, setError] = useState(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [decisionAnswers, setDecisionAnswers] = useState({
    operation: "",
    acquisition: "",
    hasBrand: "",
    brand: "",
    model: "",
    condition: "",
    monthlyBudget: "",
    cashBudget: "",
    financeAmount: "",
    entryAmount: "",
    ageFilter: "all",
    mileageFilter: "all",
  });
  const [sellAnswers, setSellAnswers] = useState({
    brand: "",
    model: "",
    year: "",
    mileage: "",
    fuel: "Gasolina",
    sellerType: "particular",
  });
  const [listingFilters, setListingFilters] = useState({
    company: "",
    budget: "",
    income: "",
  });
  const [listingResult, setListingResult] = useState(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState(null);
  const resultRef = useRef(null);

  const currentStep = STEPS[step];
  const totalSteps = STEPS.length;

  useEffect(() => {
    if (entryMode !== "consejo" || step < 0 || step >= totalSteps) {
      setMultiSelected([]);
      return;
    }

    const stepConfig = STEPS[step];
    if (stepConfig.type === "multi") {
      const saved = answers[stepConfig.id];
      setMultiSelected(Array.isArray(saved) ? saved : []);
      return;
    }

    setMultiSelected([]);
  }, [entryMode, step, totalSteps, answers]);

  useEffect(() => {
    if (!result) {
      return;
    }

    setListingFilters({
      company: result.solucion_principal?.empresas_recomendadas?.[0] || "",
      budget: "",
      income: "",
    });
    setListingResult(null);
    setListingError(null);
    setListingLoading(false);
  }, [result]);

  const resetListingDiscovery = () => {
    setListingFilters({ company: "", budget: "", income: "" });
    setListingResult(null);
    setListingError(null);
    setListingLoading(false);
  };

  const handleSingle = (value) => {
    const newAnswers = { ...answers, [currentStep.id]: value };
    setAnswers(newAnswers);
    setTimeout(() => {
      if (step < totalSteps - 1) setStep(step + 1);
      else analyzeWithAI(newAnswers);
    }, 280);
  };

  const handleMultiToggle = (value) => {
    setMultiSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleMultiNext = () => {
    const newAnswers = { ...answers, [currentStep.id]: multiSelected };
    setAnswers(newAnswers);
    setMultiSelected([]);
    if (step < totalSteps - 1) setStep(step + 1);
    else analyzeWithAI(newAnswers);
  };

  const goToPreviousStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const restartQuestionnaire = () => {
    setStep(0);
    setAnswers({});
    setMultiSelected([]);
    setResult(null);
    setError(null);
    setApiKeyMissing(false);
    setLoading(false);
    resetListingDiscovery();
  };

  const handleTellMeNow = () => {
    if (answeredSteps === 0) {
      return;
    }

    if (answeredSteps < totalSteps) {
      const proceed = window.confirm(
        "Todavia no has completado todo el formulario. Podemos darte una recomendacion util ahora, pero sera una estimacion menos precisa que si respondes todas las preguntas. ¿Quieres continuar de todos modos?"
      );

      if (!proceed) {
        return;
      }
    }

    const draftAnswers =
      currentStep?.type === "multi"
        ? { ...answers, [currentStep.id]: multiSelected }
        : { ...answers };

    analyzeWithAI(draftAnswers);
  };

  const searchRealListing = async (nextFilters = listingFilters) => {
    if (!result) {
      return;
    }

    const requiresBudget = ["renting_largo", "renting_corto"].includes(
      result.solucion_principal?.tipo
    );

    if (!nextFilters.company || (requiresBudget && !nextFilters.budget)) {
      return;
    }

    setListingLoading(true);
    setListingError(null);
    setListingResult(null);

    try {
      const response = await fetch(LISTING_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          result,
          answers,
          filters: nextFilters,
        }),
      });

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo encontrar un anuncio real ahora mismo.");
      }

      setListingResult(data.listing || null);
    } catch (err) {
      setListingError(err.message || "No se pudo encontrar un anuncio real ahora mismo.");
    } finally {
      setListingLoading(false);
    }
  };

  const updateListingFilter = (key, value) => {
    const nextFilters = {
      ...listingFilters,
      [key]: value,
    };

    setListingFilters(nextFilters);
    setListingError(null);

    const requiresBudget = ["renting_largo", "renting_corto"].includes(
      result?.solucion_principal?.tipo
    );

    if (nextFilters.company && (!requiresBudget || nextFilters.budget)) {
      void searchRealListing(nextFilters);
      return;
    }

    setListingResult(null);
  };

  const analyzeWithAI = async (finalAnswers) => {
    setStep(99);
    setLoading(true);
    setError(null);
    setApiKeyMissing(false);
    resetListingDiscovery();

    // Simulate thinking phases for UX
    const phases = [
      "Evaluando patrón de uso real...",
      "Calculando TCO estimado...",
      "Analizando etiqueta DGT y ZBE...",
      "Detectando tensiones activas...",
      "Calculando zona de intersección...",
      "Generando recomendación personalizada...",
    ];

    let phaseIndex = 0;
    setLoadingPhase(0);
    const phaseInterval = setInterval(() => {
      phaseIndex = (phaseIndex + 1) % phases.length;
      setLoadingPhase(phaseIndex);
    }, 1800);

    try {
      const answersSummary = STEPS.map((stepConfig) => {
        const value = finalAnswers[stepConfig.id];
        const normalizedValue = Array.isArray(value) ? value.join(", ") : value || "No indicado";
        return `- ${stepConfig.question}: ${normalizedValue}`;
      }).join("\n");

      const prompt = `Eres un asesor experto en movilidad en Espana. Analiza este perfil y responde SOLO con JSON valido, sin markdown ni texto adicional.

Debes devolver exactamente esta estructura:
{
  "alineacion_pct": 78,
  "solucion_principal": {
    "tipo": "compra_contado|compra_financiada|renting_largo|renting_corto|rent_a_car|carsharing|carpooling|transporte_publico|micromovilidad",
    "score": 85,
    "titulo": "titulo atractivo y especifico",
    "resumen": "2-3 frases explicando por que es la mejor opcion para este perfil concreto",
    "ventajas": ["ventaja 1 especifica", "ventaja 2", "ventaja 3"],
    "inconvenientes": ["inconveniente 1 real", "inconveniente 2"],
    "coste_estimado": "rango realista en EUR/mes incluyendo todos los costes",
    "empresas_recomendadas": ["empresa real en Espana 1", "empresa 2", "empresa 3"],
    "etiqueta_dgt": "CERO|ECO|C|B|No aplica",
    "tension_principal": "descripcion de la tension mas relevante detectada entre deseos y realidad"
  },
  "alternativas": [
    { "tipo": "...", "score": 70, "titulo": "...", "razon": "1-2 frases con argumento concreto" },
    { "tipo": "...", "score": 60, "titulo": "...", "razon": "1-2 frases con argumento concreto" }
  ],
  "tco_aviso": "aviso concreto sobre el TCO real estimado para este perfil en Espana",
  "consejo_experto": "consejo practico muy especifico para Espana que normalmente no se conoce",
  "siguiente_paso": "accion concreta que deberia hacer esta semana",
  "propulsiones_viables": ["hibrido suave", "PHEV", "electrico"]
}

Criterios de analisis:
- Considera financiacion, TCO, restricciones ZBE, viabilidad de electrificacion, depreciacion y riesgo.
- Prioriza opciones realistas en Espana para el perfil dado.
- Si recomiendas electrico puro, explicita claramente los requisitos de carga y validalos en el siguiente paso.
- Si recomiendas compra financiada, indica que la validacion de capacidad financiera y scoring se hara en el siguiente paso sobre el shortlist de coches.
- Si recomiendas renting, indica que la validacion de cuota mensual objetivo y estabilidad de ingresos se hara al final como siguiente paso.
- Valora flexibilidad vs propiedad y horizonte temporal.

Perfil del usuario:
${answersSummary}`;

      const response = await fetch(ANALYZE_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          answers: finalAnswers,
        }),
      });

      const data = await readApiResponse(response);
      clearInterval(phaseInterval);

      if (!response.ok) {
        if (data.code === "API_KEY_MISSING") {
          setApiKeyMissing(true);
          setLoading(false);
          return;
        }

        throw new Error(data.error?.message || data.error || "Error desconocido");
      }

      if (data.parsed && typeof data.parsed === "object") {
        const normalizedResult = normalizeAdvisorResult(data.parsed);

        if (!isCompleteAdvisorResult(normalizedResult)) {
          throw new Error("La IA ha devuelto un analisis incompleto. Intentalo de nuevo.");
        }

        setResult(normalizedResult);
        setLoading(false);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        return;
      }

      const text = data.content?.map((i) => i.text || "").join("") || "";
      const parsed = normalizeAdvisorResult(parseAdvisorJson(text));

      if (!isCompleteAdvisorResult(parsed)) {
        throw new Error("La IA ha devuelto un analisis incompleto. Intentalo de nuevo.");
      }

      setResult(parsed);
      setLoading(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      clearInterval(phaseInterval);
      setError(`Error: ${err.message}`);
      setLoading(false);
      setStep(totalSteps - 1);
    }
  };

  const restart = () => {
    setEntryMode(null);
    setStep(-1);
    setAnswers({});
    setMultiSelected([]);
    setResult(null);
    setError(null);
    setApiKeyMissing(false);
    setLoading(false);
    resetListingDiscovery();
    setDecisionAnswers({
      operation: "",
      acquisition: "",
      hasBrand: "",
      brand: "",
      model: "",
      condition: "",
      monthlyBudget: "",
      cashBudget: "",
      financeAmount: "",
      entryAmount: "",
      ageFilter: "all",
      mileageFilter: "all",
    });
    setSellAnswers({
      brand: "",
      model: "",
      year: "",
      mileage: "",
      fuel: "Gasolina",
      sellerType: "particular",
    });
  };

  const updateDecisionAnswer = (key, value) => {
    setDecisionAnswers((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "brand") {
        next.model = "";
      }

      if (key === "operation") {
        next.acquisition = "";
        next.monthlyBudget = "";
        next.cashBudget = "";
        next.financeAmount = "";
        next.entryAmount = "";
        next.ageFilter = "all";
        next.mileageFilter = "all";
      }

      if (key === "acquisition") {
        next.monthlyBudget = "";
        next.cashBudget = "";
        next.financeAmount = "";
        next.entryAmount = "";
        next.ageFilter = "all";
        next.mileageFilter = "all";
      }

      if (key === "hasBrand" && value === "no") {
        next.brand = "";
        next.model = "";
      }

      return next;
    });
  };

  const decisionModels = decisionAnswers.brand ? MARKET_BRANDS[decisionAnswers.brand] || [] : [];
  const estimatedFinanceMonthly = estimateMonthlyPayment(
    getOptionAmount(FINANCE_AMOUNT_OPTIONS, decisionAnswers.financeAmount)
  );
  const estimatedMixedMonthly = estimateMonthlyPayment(
    getOptionAmount(FINANCE_AMOUNT_OPTIONS, decisionAnswers.financeAmount)
  );
  const needsMonthlyBudget = decisionAnswers.operation === "renting";
  const needsCashBudget = decisionAnswers.operation === "comprar" && decisionAnswers.acquisition === "contado";
  const needsFinanceAmount =
    decisionAnswers.operation === "comprar" &&
    (decisionAnswers.acquisition === "financiado" || decisionAnswers.acquisition === "mixto");
  const needsEntryAmount = decisionAnswers.operation === "comprar" && decisionAnswers.acquisition === "mixto";
  const decisionFlowReady =
    decisionAnswers.operation &&
    decisionAnswers.acquisition &&
    decisionAnswers.hasBrand &&
    (!needsMonthlyBudget || decisionAnswers.monthlyBudget) &&
    (!needsCashBudget || decisionAnswers.cashBudget) &&
    (!needsFinanceAmount || decisionAnswers.financeAmount) &&
    (!needsEntryAmount || decisionAnswers.entryAmount) &&
    (decisionAnswers.hasBrand === "no" || (decisionAnswers.brand && decisionAnswers.model));
  const rankedOffers =
    decisionFlowReady && decisionAnswers.hasBrand === "si"
      ? buildOfferRanking({
          brand: decisionAnswers.brand,
          model: decisionAnswers.model,
          acquisition: decisionAnswers.acquisition,
          condition: decisionAnswers.condition || "seminuevo",
          ageFilter: decisionAnswers.ageFilter,
          mileageFilter: decisionAnswers.mileageFilter,
        })
      : [];
  const sellModels = sellAnswers.brand ? MARKET_BRANDS[sellAnswers.brand] || [] : [];
  const sellEstimate =
    sellAnswers.brand && sellAnswers.model && sellAnswers.year && sellAnswers.mileage
      ? buildSellEstimate(sellAnswers)
      : null;

  const progress =
    step >= 0 && step < totalSteps
      ? ((step + 1) / totalSteps) * 100
      : step === 99 || result || apiKeyMissing
      ? 100
      : 0;

  const loadingTexts = [
    "Evaluando patrón de uso real...",
    "Calculando TCO estimado...",
    "Analizando etiqueta DGT y ZBE...",
    "Detectando tensiones activas...",
    "Calculando zona de intersección...",
    "Generando recomendación personalizada...",
  ];

  const draftAnswers =
    entryMode === "consejo" && currentStep?.type === "multi"
      ? { ...answers, [currentStep.id]: multiSelected }
      : answers;
  const answeredSteps = countAnsweredSteps(draftAnswers);
  const remainingQuestions = Math.max(totalSteps - answeredSteps, 0);
  const completionPct = Math.min(100, Math.round((answeredSteps / totalSteps) * 100));

  // ─── STYLES ───────────────────────────────
  const s = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(160deg,#060d1a 0%,#0a1628 50%,#050e1c 100%)",
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      color: "#e2e8f0",
    },
    header: {
      padding: "18px 28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      position: "sticky",
      top: 0,
      background: "rgba(6,13,26,0.92)",
      backdropFilter: "blur(12px)",
      zIndex: 100,
    },
    progressBar: { height: 3, background: "rgba(255,255,255,0.06)" },
    progressFill: {
      height: "100%",
      width: `${progress}%`,
      background: "linear-gradient(90deg,#2563EB,#059669,#0891B2)",
      transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
      borderRadius: "0 2px 2px 0",
    },
    center: { maxWidth: 620, margin: "0 auto", padding: "48px 20px 80px" },
    btn: {
      background: "linear-gradient(135deg,#2563EB,#1d4ed8)",
      border: "none",
      color: "white",
      padding: "14px 36px",
      borderRadius: 12,
      fontSize: 15,
      fontWeight: 600,
      cursor: "pointer",
      transition: "opacity 0.2s, transform 0.15s",
    },
    card: (selected) => ({
      background: selected ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.025)",
      border: selected ? "1px solid rgba(37,99,235,0.45)" : "1px solid rgba(255,255,255,0.07)",
      borderRadius: 13,
      padding: "14px 18px",
      cursor: "pointer",
      textAlign: "left",
      display: "flex",
      alignItems: "center",
      gap: 14,
      width: "100%",
      color: "inherit",
      marginBottom: 9,
      transition: "all 0.18s ease",
    }),
    blockBadge: (block) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: `${BLOCK_COLORS[block] || "#2563EB"}18`,
      border: `1px solid ${BLOCK_COLORS[block] || "#2563EB"}30`,
      color: BLOCK_COLORS[block] || "#2563EB",
      padding: "4px 12px",
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.6px",
      marginBottom: 16,
    }),
    select: {
      width: "100%",
      background: "#0f1b2d",
      color: "#f8fafc",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      padding: "12px 14px",
      outline: "none",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
    },
    panel: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: 18,
    },
  };

  // ─── RENDER ───────────────────────────────
  return (
    <div style={s.page}>
      {/* HEADER */}
      <header style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "linear-gradient(135deg,#2563EB,#059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            🚗
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>MoveAdvisor</div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.8px" }}>
              SPAIN MOBILITY PLATFORM
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {step >= 0 && step < totalSteps && (
            <div style={{ fontSize: 12, color: "#475569" }}>
              {step + 1} / {totalSteps}
            </div>
          )}
          {step >= 0 && (
            <button
              onClick={restart}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#94a3b8",
                padding: "5px 13px",
                borderRadius: 7,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ← Volver al home
            </button>
          )}
        </div>
      </header>

      {/* PROGRESS */}
      <div style={s.progressBar}>
        <div style={s.progressFill} />
      </div>

      {/* ── LANDING ── */}
      {step === -1 && !entryMode && (
        <div style={{ ...s.center, maxWidth: 1120, textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(37,99,235,0.1)",
              border: "1px solid rgba(37,99,235,0.22)",
              padding: "5px 14px",
              borderRadius: 100,
              fontSize: 11,
              color: "#60a5fa",
              marginBottom: 28,
              letterSpacing: "0.6px",
            }}
          >
            ✨ ASESOR INTELIGENTE DE MOVILIDAD · ESPAÑA
          </div>
          <h1
            style={{
              fontSize: "clamp(30px,6vw,52px)",
              fontWeight: 800,
              letterSpacing: "-2px",
              margin: "0 0 18px",
              background: "linear-gradient(135deg,#f1f5f9 30%,#64748b)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1.1,
            }}
          >
            ¿Cuál es tu mejor<br />opción de movilidad?
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "#64748b",
              lineHeight: 1.7,
              maxWidth: 440,
              margin: "0 auto 36px",
            }}
          >
            Elige primero si ya sabes lo que quieres o si necesitas que te guiemos. A partir de ahí,
            activamos el flujo adecuado para comparar ofertas o recomendarte la mejor solución.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: 16,
              marginTop: 28,
              textAlign: "left",
            }}
          >
            <button
              onClick={() => {
                setEntryMode("consejo");
                setStep(-1);
              }}
              style={{
                ...s.card(false),
                padding: 22,
                background: "rgba(37,99,235,0.08)",
                border: "1px solid rgba(37,99,235,0.22)",
              }}
            >
              <span style={{ fontSize: 28, minWidth: 40 }}>🎯</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9", marginBottom: 6 }}>
                  Quiero que me ayudes a encontrar el coche con mejor relación calidad-precio
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                  Te hacemos las preguntas del marco completo y te devolvemos una recomendación
                  personalizada con análisis de uso real, coste total, riesgo y siguiente paso.
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setEntryMode("decision");
                setStep(-1);
              }}
              style={{
                ...s.card(false),
                padding: 22,
                background: "rgba(5,150,105,0.08)",
                border: "1px solid rgba(5,150,105,0.22)",
              }}
            >
              <span style={{ fontSize: 28, minWidth: 40 }}>🧭</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9", marginBottom: 6 }}>
                  Tengo claro qué marca y modelo quiero, ayúdame a encontrar la mejor oferta
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                  Filtra por marca, modelo, antigüedad y kilometraje para ordenar las ofertas del mercado
                  actual de mejor a peor según valor, riesgo y coste final.
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setEntryMode("sell");
                setStep(-1);
              }}
              style={{
                ...s.card(false),
                padding: 22,
                background: "rgba(217,119,6,0.08)",
                border: "1px solid rgba(217,119,6,0.22)",
              }}
            >
              <span style={{ fontSize: 28, minWidth: 40 }}>💶</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9", marginBottom: 6 }}>
                  Quiero vender mi coche, ayúdame a saber el precio al que debo ofertarlo
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                  Estimamos rango de precio, tendencia histórica, volumen de unidades similares y el informe
                  entregable que luego se puede monetizar como servicio premium.
                </div>
              </div>
            </button>

          </div>
          <p style={{ marginTop: 18, fontSize: 12, color: "#334155" }}>
            Sin registro · Sin tarjeta · ~5 minutos
          </p>

          {/* Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 12,
              marginTop: 52,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              paddingTop: 36,
            }}
          >
            {[
              [String(totalSteps), "Preguntas del marco"],
              ["9+", "Opciones de movilidad"],
              ["IA", "Análisis personalizado"],
            ].map(([n, l]) => (
              <div key={l}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#2563EB" }}>{n}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Blocks preview */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
              marginTop: 36,
            }}
          >
            {Object.entries(BLOCK_COLORS).map(([name, color]) => (
              <span
                key={name}
                style={{
                  background: `${color}15`,
                  border: `1px solid ${color}28`,
                  color,
                  padding: "4px 12px",
                  borderRadius: 100,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {step === -1 && entryMode === "consejo" && (
        <div style={s.center}>
          <div style={{ ...s.blockBadge("Vinculación"), marginBottom: 10 }}>🎯 DECISIÓN CLARA</div>
          <h2
            style={{
              fontSize: "clamp(22px,4vw,30px)",
              fontWeight: 800,
              letterSpacing: "-1px",
              margin: "0 0 10px",
              color: "#f1f5f9",
            }}
          >
            Encontrar el coche con mejor relación calidad-precio
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
            Este flujo arranca el test de decisión y añade una capa de valor con financiación, TCO,
            garantías, pricing, señales de mercado y valor futuro antes de recomendar una compra o renting.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
              gap: 12,
              marginBottom: 28,
            }}
          >
            {ADVISOR_PILLARS.map((pillar) => (
              <div key={pillar.title} style={s.panel}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
                  {pillar.title}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                  {pillar.text}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => setStep(0)}
              style={s.btn}
            >
              Empezar flujo de decisión →
            </button>
            <button
              onClick={restart}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8",
                padding: "12px 20px",
                borderRadius: 10,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      {step === -1 && entryMode === "decision" && (
        <div style={s.center}>
          <div style={{ ...s.blockBadge("Vinculación"), marginBottom: 10 }}>🧭 OFERTAS DE MERCADO</div>
          <h2
            style={{
              fontSize: "clamp(22px,4vw,30px)",
              fontWeight: 800,
              letterSpacing: "-1px",
              margin: "0 0 10px",
              color: "#f1f5f9",
            }}
          >
            Afina marca, modelo y condiciones para ordenar las ofertas
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
            Aquí priorizamos el mercado actual para una necesidad ya concreta. Puedes filtrar por modalidad,
            estado, antigüedad y kilometraje antes de ver un ranking de oportunidades.
          </p>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, letterSpacing: "0.6px" }}>
              1. TIPO DE OPERACIÓN
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
              {[
                ["comprar", "Compra", "🔑"],
                ["renting", "Renting", "📅"],
              ].map(([value, label, icon]) => (
                <button
                  key={value}
                  style={s.card(decisionAnswers.operation === value)}
                  onClick={() => updateDecisionAnswer("operation", value)}
                >
                  <span style={{ fontSize: 22, minWidth: 30 }}>{icon}</span>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, letterSpacing: "0.6px" }}>
              2. MODALIDAD
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
              {(decisionAnswers.operation === "renting"
                ? [
                    ["particular", "Renting particular", "👤"],
                    ["empresa", "Renting empresa", "🏢"],
                    ["flexible", "Renting flexible", "⚡"],
                  ]
                : [
                    ["contado", "Compra al contado", "💶"],
                    ["financiado", "Compra financiada", "📝"],
                    ["mixto", "Entrada + financiación", "📊"],
                  ]).map(([value, label, icon]) => (
                <button
                  key={value}
                  style={s.card(decisionAnswers.acquisition === value)}
                  onClick={() => updateDecisionAnswer("acquisition", value)}
                >
                  <span style={{ fontSize: 22, minWidth: 30 }}>{icon}</span>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, letterSpacing: "0.6px" }}>
              3. MARCA Y MODELO
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 10 }}>
              {[
                ["si", "Sí, ya sé marca y modelo", "🏷️"],
                ["no", "No, solo sé el tipo de operación", "🧭"],
              ].map(([value, label, icon]) => (
                <button
                  key={value}
                  style={s.card(decisionAnswers.hasBrand === value)}
                  onClick={() => updateDecisionAnswer("hasBrand", value)}
                >
                  <span style={{ fontSize: 22, minWidth: 30 }}>{icon}</span>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                </button>
              ))}
            </div>

            {decisionAnswers.hasBrand === "si" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Marca</div>
                  <select
                    value={decisionAnswers.brand}
                    onChange={(event) => updateDecisionAnswer("brand", event.target.value)}
                    style={s.select}
                  >
                    <option value="">Selecciona marca</option>
                    {Object.keys(MARKET_BRANDS).map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Modelo</div>
                  <select
                    value={decisionAnswers.model}
                    onChange={(event) => updateDecisionAnswer("model", event.target.value)}
                    disabled={!decisionAnswers.brand}
                    style={{
                      ...s.select,
                      opacity: decisionAnswers.brand ? 1 : 0.55,
                    }}
                  >
                    <option value="">Selecciona modelo</option>
                    {decisionModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Vehículo</div>
              <select
                value={decisionAnswers.condition}
                onChange={(event) => updateDecisionAnswer("condition", event.target.value)}
                style={s.select}
              >
                <option value="">Nuevo u ocasión</option>
                <option value="nuevo">Nuevo</option>
                <option value="seminuevo">Seminuevo</option>
                <option value="ocasion">Ocasión</option>
              </select>
            </div>
            {needsMonthlyBudget && (
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Cuota objetivo</div>
                <select
                  value={decisionAnswers.monthlyBudget}
                  onChange={(event) => updateDecisionAnswer("monthlyBudget", event.target.value)}
                  style={s.select}
                >
                  <option value="">Presupuesto mensual</option>
                  {MONTHLY_BUDGET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {needsCashBudget && (
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Presupuesto total</div>
                <select
                  value={decisionAnswers.cashBudget}
                  onChange={(event) => updateDecisionAnswer("cashBudget", event.target.value)}
                  style={s.select}
                >
                  <option value="">Importe total de compra</option>
                  {TOTAL_PURCHASE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {needsFinanceAmount && (
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                  {decisionAnswers.acquisition === "mixto" ? "Importe a financiar" : "Cuánto necesitas financiar"}
                </div>
                <select
                  value={decisionAnswers.financeAmount}
                  onChange={(event) => updateDecisionAnswer("financeAmount", event.target.value)}
                  style={s.select}
                >
                  <option value="">Selecciona importe a financiar</option>
                  {FINANCE_AMOUNT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {needsEntryAmount && (
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Entrada disponible</div>
                <select
                  value={decisionAnswers.entryAmount}
                  onChange={(event) => updateDecisionAnswer("entryAmount", event.target.value)}
                  style={s.select}
                >
                  <option value="">Selecciona la entrada</option>
                  {ENTRY_AMOUNT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {decisionAnswers.hasBrand === "si" && (
              <>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Antigüedad máxima</div>
                  <select
                    value={decisionAnswers.ageFilter}
                    onChange={(event) => updateDecisionAnswer("ageFilter", event.target.value)}
                    style={s.select}
                  >
                    {AGE_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Kilometraje máximo</div>
                  <select
                    value={decisionAnswers.mileageFilter}
                    onChange={(event) => updateDecisionAnswer("mileageFilter", event.target.value)}
                    style={s.select}
                  >
                    {MILEAGE_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {decisionAnswers.operation === "comprar" && decisionAnswers.acquisition === "financiado" && decisionAnswers.financeAmount && (
            <div
              style={{
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.18)",
                borderRadius: 14,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 11, color: "#c4b5fd", letterSpacing: "0.6px", marginBottom: 6 }}>
                ESTIMACIÓN DE CUOTA
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f5f3ff", marginBottom: 6 }}>
                ~{estimatedFinanceMonthly} €/mes
              </div>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
                Estimación orientativa para una financiación a 72 meses con un coste financiero aproximado del 8,99% TIN.
              </p>
            </div>
          )}

          {decisionAnswers.operation === "comprar" && decisionAnswers.acquisition === "mixto" && decisionAnswers.entryAmount && decisionAnswers.financeAmount && (
            <div
              style={{
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.18)",
                borderRadius: 14,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 11, color: "#c4b5fd", letterSpacing: "0.6px", marginBottom: 6 }}>
                ESTIMACIÓN DE CUOTA CON ENTRADA
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f5f3ff", marginBottom: 6 }}>
                ~{estimatedMixedMonthly} €/mes
              </div>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
                Con una entrada de {ENTRY_AMOUNT_OPTIONS.find((option) => option.value === decisionAnswers.entryAmount)?.label || "0 €"} y el importe a financiar seleccionado.
              </p>
            </div>
          )}

          {decisionFlowReady ? (
            <div
              style={{
                background: "rgba(37,99,235,0.08)",
                border: "1px solid rgba(37,99,235,0.18)",
                borderRadius: 14,
                padding: 18,
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: "0.6px", marginBottom: 8 }}>
                SIGUIENTE PASO DEL FLUJO
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
                {decisionAnswers.hasBrand === "si"
                  ? `Buscar la mejor oferta para ${decisionAnswers.brand} ${decisionAnswers.model}`
                  : "Comparar las mejores opciones del mercado para tu operación"}
              </div>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
                Con esto ya podemos pasar a un ranking de ofertas, aplicar filtros como financiación,
                estado, antigüedad o kilometraje y priorizar las opciones con mejor relación valor/precio.
              </p>
            </div>
          ) : (
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 18 }}>
              Completa al menos la operación, la modalidad y si ya tienes clara la marca/modelo.
            </p>
          )}

          {rankedOffers.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: "0.6px", marginBottom: 10 }}>
                RANKING DE OFERTAS DETECTADAS
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {rankedOffers.map((offer, index) => (
                  <div key={offer.id} style={s.panel}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 4 }}>
                          #{index + 1} EN EL MERCADO ACTUAL · SCORE {offer.score}/100
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
                          {offer.title}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                          {offer.seller} · {offer.age} años · {offer.mileage.toLocaleString("es-ES")} km
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 21, fontWeight: 800, color: "#f1f5f9" }}>
                          {formatCurrency(offer.price)}
                        </div>
                        {offer.monthly ? (
                          <div style={{ fontSize: 12, color: "#60a5fa", marginTop: 4 }}>
                            ~{offer.monthly} €/mes
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#60a5fa", marginTop: 4 }}>
                            Compra directa
                          </div>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                      {offer.insight}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setEntryMode("consejo");
                setStep(0);
              }}
              style={s.btn}
            >
              Cambiar al flujo de decisión →
            </button>
            <button
              onClick={restart}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8",
                padding: "12px 20px",
                borderRadius: 10,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      {step === -1 && entryMode === "sell" && (
        <div style={s.center}>
          <div style={{ ...s.blockBadge("Pricing"), marginBottom: 10 }}>💶 VALORACIÓN DE VEHÍCULO</div>
          <h2
            style={{
              fontSize: "clamp(22px,4vw,30px)",
              fontWeight: 800,
              letterSpacing: "-1px",
              margin: "0 0 10px",
              color: "#f1f5f9",
            }}
          >
            Calcula el precio de salida de tu coche
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
            La propuesta se alinea con un informe tipo Motoreto: precio medio, tendencia histórica,
            stock de coches similares y una horquilla de salida para publicar con criterio.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Marca</div>
              <select
                value={sellAnswers.brand}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, brand: event.target.value, model: "" }))}
                style={s.select}
              >
                <option value="">Selecciona marca</option>
                {Object.keys(MARKET_BRANDS).map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Modelo</div>
              <select
                value={sellAnswers.model}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, model: event.target.value }))}
                disabled={!sellAnswers.brand}
                style={{ ...s.select, opacity: sellAnswers.brand ? 1 : 0.55 }}
              >
                <option value="">Selecciona modelo</option>
                {sellModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Año</div>
              <select
                value={sellAnswers.year}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, year: event.target.value }))}
                style={s.select}
              >
                <option value="">Selecciona año</option>
                {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Kilometraje</div>
              <select
                value={sellAnswers.mileage}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, mileage: event.target.value }))}
                style={s.select}
              >
                <option value="">Selecciona kilometraje</option>
                <option value="20000">Hasta 20.000 km</option>
                <option value="50000">20.000 - 50.000 km</option>
                <option value="80000">50.000 - 80.000 km</option>
                <option value="120000">80.000 - 120.000 km</option>
                <option value="160000">Más de 120.000 km</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Combustible</div>
              <select
                value={sellAnswers.fuel}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, fuel: event.target.value }))}
                style={s.select}
              >
                {SELL_FUEL_OPTIONS.map((fuel) => (
                  <option key={fuel} value={fuel}>
                    {fuel}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Canal de venta</div>
              <select
                value={sellAnswers.sellerType}
                onChange={(event) => setSellAnswers((prev) => ({ ...prev, sellerType: event.target.value }))}
                style={s.select}
              >
                <option value="particular">Particular</option>
                <option value="profesional">Profesional</option>
                <option value="entrega">Entrega en concesionario</option>
              </select>
            </div>
          </div>

          {sellEstimate && (
            <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
              <div style={s.panel}>
                <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 6, letterSpacing: "0.6px" }}>
                  PRECIO OBJETIVO DE SALIDA
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>
                  {formatCurrency(sellEstimate.targetPrice)}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                  Rango razonable de publicación entre {formatCurrency(sellEstimate.lowPrice)} y {formatCurrency(sellEstimate.highPrice)}.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                <div style={s.panel}>
                  <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
                    COCHES SIMILARES ACTIVOS
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9" }}>{sellEstimate.similarUnits}</div>
                </div>
                <div style={s.panel}>
                  <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
                    TENDENCIA DE MERCADO
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{sellEstimate.trend}</div>
                </div>
              </div>

              <div style={s.panel}>
                <div style={{ fontSize: 11, color: "#34d399", marginBottom: 6, letterSpacing: "0.6px" }}>
                  RESUMEN DEL INFORME ENTREGABLE
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
                  {sellEstimate.report} Aquí podemos monetizar una versión premium con benchmark histórico,
                  días en mercado, comparables y recomendación de estrategia comercial.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={restart} style={s.btn}>
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      {/* ── QUESTIONS ── */}
      {entryMode === "consejo" && step >= 0 && step < totalSteps && currentStep && (
        <div style={s.center}>
          <div style={s.blockBadge(currentStep.block)}>
            {currentStep.blockIcon} {currentStep.block.toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: "#334155", letterSpacing: "1px", marginBottom: 6 }}>
            PREGUNTA {step + 1} DE {totalSteps}
          </div>
          <h2
            style={{
              fontSize: "clamp(18px,4vw,26px)",
              fontWeight: 700,
              letterSpacing: "-0.6px",
              margin: "0 0 8px",
              color: "#f1f5f9",
              lineHeight: 1.3,
            }}
          >
            {currentStep.question}
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
            {currentStep.subtitle}
          </p>

          <div
            style={{
              background: "rgba(14,165,233,0.08)",
              border: "1px solid rgba(14,165,233,0.2)",
              borderRadius: 12,
              padding: 12,
              marginBottom: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: "#bae6fd", fontWeight: 600 }}>
                ✅ Te quedan {remainingQuestions} pregunta{remainingQuestions === 1 ? "" : "s"}
              </div>
              <div style={{ fontSize: 12, color: "#7dd3fc" }}>
                {completionPct}% completado
              </div>
            </div>
            <div
              style={{
                marginTop: 8,
                height: 4,
                borderRadius: 4,
                background: "rgba(255,255,255,0.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${completionPct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg,#22d3ee,#2563eb)",
                  transition: "width 0.35s ease",
                }}
              />
            </div>
          </div>

          {currentStep.options.map((opt) => {
            const selected =
              currentStep.type === "multi"
                ? multiSelected.includes(opt.value)
                : answers[currentStep.id] === opt.value;
            return (
              <button
                key={opt.value}
                style={s.card(selected)}
                onClick={() =>
                  currentStep.type === "multi"
                    ? handleMultiToggle(opt.value)
                    : handleSingle(opt.value)
                }
              >
                <span style={{ fontSize: 22, minWidth: 30 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: selected ? "#93c5fd" : "#e2e8f0",
                    }}
                  >
                    {opt.label}
                  </div>
                  {opt.desc && (
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{opt.desc}</div>
                  )}
                  {Array.isArray(opt.brandChips) && opt.brandChips.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {opt.brandChips.map((chip) => {
                        const logo = BRAND_LOGOS[chip.label];
                        const LogoIcon = logo?.icon;

                        return (
                          <span
                            key={`${opt.value}-${chip.short}`}
                            title={chip.label || chip.short}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.2px",
                              color: "#f8fafc",
                              background: logo?.color || chip.tone || "#334155",
                              border: "1px solid rgba(255,255,255,0.18)",
                            }}
                          >
                            {LogoIcon ? <LogoIcon size={14} /> : chip.short}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selected && (
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      background: "#2563EB",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}

          {currentStep.type === "multi" && (
            <button
              onClick={handleMultiNext}
              disabled={multiSelected.length === 0}
              style={{
                ...s.btn,
                width: "100%",
                marginTop: 14,
                opacity: multiSelected.length === 0 ? 0.35 : 1,
              }}
            >
              {multiSelected.length === 0
                ? "Selecciona al menos una opción"
                : `Continuar (${multiSelected.length} seleccionada${multiSelected.length > 1 ? "s" : ""}) →`}
            </button>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={goToPreviousStep}
              disabled={step === 0}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#cbd5e1",
                padding: "9px 14px",
                borderRadius: 9,
                fontSize: 12,
                cursor: step === 0 ? "not-allowed" : "pointer",
                opacity: step === 0 ? 0.45 : 1,
              }}
            >
              ← Volver a la pregunta anterior
            </button>

            <button
              onClick={restartQuestionnaire}
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#fecaca",
                padding: "9px 14px",
                borderRadius: 9,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ↺ Reiniciar preguntas
            </button>

            <button
              onClick={handleTellMeNow}
              disabled={answeredSteps === 0}
              style={{
                background: "linear-gradient(135deg,#0ea5e9,#2563eb)",
                border: "none",
                color: "white",
                padding: "9px 14px",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                cursor: answeredSteps === 0 ? "not-allowed" : "pointer",
                opacity: answeredSteps === 0 ? 0.45 : 1,
              }}
            >
              ⚡ ¡Dímelo ya!
            </button>
          </div>
        </div>
      )}

      {/* ── LOADING ── */}
      {step === 99 && loading && (
        <div style={{ ...s.center, textAlign: "center" }}>
          {/* Animated brain */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 22,
              background: "linear-gradient(135deg,#2563EB,#059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              margin: "0 auto 28px",
              boxShadow: "0 0 40px rgba(37,99,235,0.3)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            🧠
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.5px" }}>
            Analizando tu perfil de movilidad
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>
            Aplicando el marco de decisión estructurado a tus respuestas
          </p>

          {/* Phase indicator */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "14px 20px",
              marginBottom: 28,
              minHeight: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 16 }}>⚙️</span>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>{loadingTexts[loadingPhase]}</span>
          </div>

          {/* Steps checklist */}
          <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto 32px" }}>
            {[
              "Mundo del deseo analizado",
              "Mundo de la realidad analizado",
              "Tensiones activas detectadas",
              "Zona de intersección calculada",
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                  opacity: loadingPhase > i ? 1 : 0.3,
                  transition: "opacity 0.5s",
                }}
              >
                <span style={{ color: loadingPhase > i ? "#34d399" : "#475569", fontSize: 14 }}>
                  {loadingPhase > i ? "✓" : "○"}
                </span>
                <span style={{ fontSize: 13, color: loadingPhase > i ? "#94a3b8" : "#334155" }}>
                  {item}
                </span>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#2563EB",
                  animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── API KEY MISSING ── */}
      {apiKeyMissing && (
        <div style={{ ...s.center, textAlign: "center" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              margin: "0 auto 24px",
            }}
          >
            🔑
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, letterSpacing: "-0.5px" }}>
            Falta la API Key de Gemini
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, maxWidth: 420, margin: "0 auto 28px" }}>
            El análisis de IA está listo pero necesita tu clave de API para funcionar. Hemos procesado
            correctamente tus {totalSteps} respuestas — solo falta conectar el motor de inteligencia artificial.
          </p>

          {/* Instruction box */}
          <div
            style={{
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 14,
              padding: 24,
              textAlign: "left",
              marginBottom: 24,
              maxWidth: 480,
              margin: "0 auto 24px",
            }}
          >
            <div
              style={{ fontSize: 11, color: "#fbbf24", fontWeight: 600, marginBottom: 12, letterSpacing: "0.6px" }}
            >
              📋 CÓMO CONFIGURARLO
            </div>
            {[
              { step: "1", text: "Ve a aistudio.google.com/apikey y crea una API Key" },
              { step: "2", text: "En Vercel, entra en Settings -> Environment Variables" },
              { step: "3", text: 'Crea GEMINI_API_KEY con tu clave: "AIza..."' },
              { step: "4", text: "Haz redeploy y vuelve a intentarlo" },
            ].map(({ step: n, text }) => (
              <div
                key={n}
                style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(245,158,11,0.2)",
                    border: "1px solid rgba(245,158,11,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fbbf24",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {n}
                </div>
                <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Code snippet */}
          <div
            style={{
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10,
              padding: "12px 18px",
              fontFamily: "monospace",
              fontSize: 12,
              color: "#7dd3fc",
              textAlign: "left",
              marginBottom: 28,
              maxWidth: 480,
              margin: "0 auto 28px",
              overflowX: "auto",
            }}
          >
            <span style={{ color: "#475569" }}>{"Variable en Vercel"}</span>
            <br />
            <span style={{ color: "#e2e8f0" }}>GEMINI_API_KEY</span>{" "}
            <span style={{ color: "#60a5fa" }}>= </span>
            <span style={{ color: "#34d399" }}>"AIza..."</span>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={restart}
              style={{
                ...s.btn,
              }}
            >
              🔄 Repetir el análisis
            </button>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8",
                padding: "12px 22px",
                borderRadius: 10,
                fontSize: 14,
                cursor: "pointer",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              🔑 Obtener API Key de Gemini
            </a>
          </div>

          {/* Summary of answers */}
          <div
            style={{
              marginTop: 40,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              padding: 20,
              textAlign: "left",
              maxWidth: 480,
              margin: "40px auto 0",
            }}
          >
            <div
              style={{ fontSize: 11, color: "#475569", fontWeight: 600, marginBottom: 12, letterSpacing: "0.6px" }}
            >
              ✅ TUS {totalSteps} RESPUESTAS ESTÁN GUARDADAS
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px 16px",
              }}
            >
              {STEPS.slice(0, 8).map((s) => {
                const val = answers[s.id];
                if (!val) return null;
                const display = Array.isArray(val) ? val.join(", ") : val;
                return (
                  <div key={s.id} style={{ fontSize: 11 }}>
                    <span style={{ color: "#334155" }}>{s.blockIcon} </span>
                    <span style={{ color: "#60a5fa" }}>{display}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {result &&
        (() => {
          const mt =
            MOBILITY_TYPES[result.solucion_principal?.tipo] || {
              label: "Movilidad",
              icon: "🚗",
              color: "#2563EB",
            };
          const isElectricOutcome =
            result.solucion_principal?.etiqueta_dgt === "CERO" ||
            (result.propulsiones_viables || []).some((p) => /electric/i.test(String(p)));
          const isBuyOrFinanceOutcome = ["compra_contado", "compra_financiada"].includes(
            result.solucion_principal?.tipo
          );
          const isRentingOutcome = ["renting_largo", "renting_corto"].includes(
            result.solucion_principal?.tipo
          );
          const canSearchListing = Boolean(
            listingFilters.company && (!isRentingOutcome || listingFilters.budget)
          );
          return (
            <div ref={resultRef} style={s.center}>
              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(5,150,105,0.1)",
                    border: "1px solid rgba(5,150,105,0.22)",
                    padding: "5px 14px",
                    borderRadius: 100,
                    fontSize: 11,
                    color: "#34d399",
                    marginBottom: 14,
                    letterSpacing: "0.6px",
                  }}
                >
                  ✅ ANÁLISIS COMPLETADO · {result.alineacion_pct || result.solucion_principal?.score}% ALINEACIÓN
                </div>
                <h2
                  style={{
                    fontSize: "clamp(20px,4vw,30px)",
                    fontWeight: 800,
                    letterSpacing: "-1px",
                    margin: 0,
                    color: "#f1f5f9",
                  }}
                >
                  Tu solución de movilidad óptima
                </h2>
              </div>

              {/* Main card */}
              <div
                style={{
                  background: `${mt.color}14`,
                  border: `1px solid ${mt.color}30`,
                  borderRadius: 18,
                  padding: 24,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 13,
                      background: `${mt.color}20`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    {mt.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: mt.color,
                        letterSpacing: "0.8px",
                        marginBottom: 4,
                        fontWeight: 600,
                      }}
                    >
                      RECOMENDACIÓN PRINCIPAL · {result.solucion_principal?.score}% COINCIDENCIA
                    </div>
                    <h3
                      style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}
                    >
                      {result.solucion_principal?.titulo}
                    </h3>
                    <p
                      style={{ margin: 0, color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}
                    >
                      {result.solucion_principal?.resumen}
                    </p>
                  </div>
                </div>

                {/* Score bar */}
                <div
                  style={{
                    height: 5,
                    background: "rgba(255,255,255,0.07)",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${result.solucion_principal?.score}%`,
                      background: mt.color,
                      borderRadius: 3,
                    }}
                  />
                </div>

                {/* Pros/Cons */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                    gap: 14,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#475569",
                        marginBottom: 8,
                        fontWeight: 600,
                        letterSpacing: "0.6px",
                      }}
                    >
                      ✅ VENTAJAS
                    </div>
                    {(result.solucion_principal?.ventajas || []).map((v, i) => (
                      <div
                        key={i}
                        style={{ fontSize: 12, color: "#94a3b8", marginBottom: 5, lineHeight: 1.4 }}
                      >
                        → {v}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#475569",
                        marginBottom: 8,
                        fontWeight: 600,
                        letterSpacing: "0.6px",
                      }}
                    >
                      ⚠️ A TENER EN CUENTA
                    </div>
                    {(result.solucion_principal?.inconvenientes || []).map((v, i) => (
                      <div
                        key={i}
                        style={{ fontSize: 12, color: "#94a3b8", marginBottom: 5, lineHeight: 1.4 }}
                      >
                        → {v}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div
                  style={{
                    padding: 14,
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>
                        COSTE ESTIMADO
                      </div>
                      <div style={{ fontWeight: 700, color: mt.color, fontSize: 14 }}>
                        {result.solucion_principal?.coste_estimado}
                      </div>
                    </div>
                    {result.solucion_principal?.etiqueta_dgt &&
                      result.solucion_principal.etiqueta_dgt !== "No aplica" && (
                        <div>
                          <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>
                            ETIQUETA DGT
                          </div>
                          <div style={{ fontWeight: 700, color: "#34d399", fontSize: 14 }}>
                            {result.solucion_principal.etiqueta_dgt}
                          </div>
                        </div>
                      )}
                  </div>
                  {result.propulsiones_viables && (
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#475569",
                          marginBottom: 6,
                          letterSpacing: "0.6px",
                        }}
                      >
                        PROPULSIONES VIABLES
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {result.propulsiones_viables.map((p) => (
                          <span
                            key={p}
                            style={{
                              background: "rgba(5,150,105,0.15)",
                              border: "1px solid rgba(5,150,105,0.25)",
                              padding: "2px 9px",
                              borderRadius: 100,
                              fontSize: 11,
                              color: "#34d399",
                            }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 10,
                      color: "#475569",
                      marginBottom: 6,
                      letterSpacing: "0.6px",
                    }}
                  >
                    PLATAFORMAS EN ESPAÑA
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {(result.solucion_principal?.empresas_recomendadas || []).map((e) => (
                      <span
                        key={e}
                        style={{
                          background: `${mt.color}18`,
                          border: `1px solid ${mt.color}28`,
                          padding: "2px 9px",
                          borderRadius: 100,
                          fontSize: 11,
                          color: "#cbd5e1",
                        }}
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tension */}
              {result.solucion_principal?.tension_principal && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.07)",
                    border: "1px solid rgba(239,68,68,0.18)",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#f87171",
                      marginBottom: 6,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    ⚡ TENSIÓN DETECTADA EN TU PERFIL
                  </div>
                  <p
                    style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}
                  >
                    {result.solucion_principal.tension_principal}
                  </p>
                </div>
              )}

              {/* TCO */}
              {result.tco_aviso && (
                <div
                  style={{
                    background: "rgba(245,158,11,0.07)",
                    border: "1px solid rgba(245,158,11,0.18)",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#fbbf24",
                      marginBottom: 6,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    📊 AVISO TCO — COSTE REAL ESTIMADO
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                    {result.tco_aviso}
                  </p>
                </div>
              )}

              {isElectricOutcome && (
                <div
                  style={{
                    background: "rgba(14,165,233,0.08)",
                    border: "1px solid rgba(14,165,233,0.22)",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#67e8f9",
                      marginBottom: 8,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    🔌 VALIDACION RAPIDA DE CARGA (SI VAS A ELECTRICO)
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {[
                      "¿Puedes cargar en casa o en tu plaza al menos 2-3 veces por semana?",
                      "¿Tienes un punto publico fiable cerca de casa o trabajo?",
                      "¿Tus viajes largos encajan con paradas de recarga cada 2-3 horas?",
                    ].map((item) => (
                      <div key={item} style={{ fontSize: 12, color: "#bae6fd", lineHeight: 1.5 }}>
                        □ {item}
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "#7dd3fc", lineHeight: 1.5 }}>
                    Si marcas menos de 2 puntos, conviene priorizar hibrido HEV/PHEV antes que electrico puro.
                  </p>
                </div>
              )}

              {isBuyOrFinanceOutcome && (
                <div
                  style={{
                    background: "rgba(37,99,235,0.08)",
                    border: "1px solid rgba(37,99,235,0.22)",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#93c5fd",
                      marginBottom: 8,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    🧾 SIGUIENTE PASO: VALIDACION FINANCIERA (SOLO SI COMPRAS / FINANCIAS)
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {[
                      "Capital inicial disponible para entrada (si aplica)",
                      "Cuota maxima comoda segun ingresos netos reales",
                      "Estabilidad de ingresos y endeudamiento mensual actual",
                      "Pre-scoring financiero antes de cerrar modelo/version",
                    ].map((item) => (
                      <div key={item} style={{ fontSize: 12, color: "#bfdbfe", lineHeight: 1.5 }}>
                        □ {item}
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "#93c5fd", lineHeight: 1.5 }}>
                    Este bloque se hace despues de tener shortlist de coches, para evitar pedir datos financieros
                    demasiado pronto si finalmente la mejor via no es compra/financiacion.
                  </p>
                </div>
              )}

              {isRentingOutcome && (
                <div
                  style={{
                    background: "rgba(5,150,105,0.08)",
                    border: "1px solid rgba(5,150,105,0.22)",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#6ee7b7",
                      marginBottom: 8,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    📅 SIGUIENTE PASO: VALIDACION DE CUOTA (SOLO SI RENTING)
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#a7f3d0", lineHeight: 1.5 }}>
                    ¿Cuanto puedes destinar al vehiculo al mes?
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {MONTHLY_BUDGET_OPTIONS.map((option) => {
                      const selected = listingFilters.budget === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateListingFilter("budget", option.value)}
                          style={{
                            background: selected ? "rgba(16,185,129,0.28)" : "rgba(5,150,105,0.15)",
                            border: selected
                              ? "1px solid rgba(110,231,183,0.55)"
                              : "1px solid rgba(5,150,105,0.28)",
                            padding: "4px 10px",
                            borderRadius: 100,
                            fontSize: 11,
                            color: "#d1fae5",
                            cursor: "pointer",
                            fontWeight: selected ? 700 : 500,
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: "10px 0 6px", fontSize: 12, color: "#a7f3d0", lineHeight: 1.5 }}>
                    ¿Como es la estabilidad de tus ingresos?
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {INCOME_STABILITY_OPTIONS.map((option) => {
                      const selected = listingFilters.income === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateListingFilter("income", option.value)}
                          style={{
                            background: selected ? "rgba(16,185,129,0.28)" : "rgba(5,150,105,0.15)",
                            border: selected
                              ? "1px solid rgba(110,231,183,0.55)"
                              : "1px solid rgba(5,150,105,0.28)",
                            padding: "4px 10px",
                            borderRadius: 100,
                            fontSize: 11,
                            color: "#d1fae5",
                            cursor: "pointer",
                            fontWeight: selected ? 700 : 500,
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "#6ee7b7", lineHeight: 1.5 }}>
                    Al pinchar en las opciones lanzamos una busqueda para localizar una oferta real alineada con tu resultado.
                  </p>
                </div>
              )}

              <div
                style={{
                  background: "linear-gradient(135deg,rgba(14,165,233,0.16),rgba(37,99,235,0.08))",
                  border: "1px solid rgba(96,165,250,0.32)",
                  borderRadius: 16,
                  padding: 18,
                  marginBottom: 14,
                  boxShadow: "0 18px 45px rgba(37,99,235,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#7dd3fc",
                    marginBottom: 8,
                    fontWeight: 700,
                    letterSpacing: "0.7px",
                  }}
                >
                  🚀 SIGUIENTE PASO ACCIONABLE · CLICA Y TE TRAIGO UN ANUNCIO REAL
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>
                  {result.siguiente_paso}
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                  Selecciona la plataforma recomendada {isRentingOutcome ? "y tu franja de cuota" : ""}.
                  En cuanto pinches, buscamos una unica {isRentingOutcome ? "oferta real de renting" : "opcion real de compra"} publicada en la web.
                </p>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#bfdbfe", marginBottom: 8, letterSpacing: "0.5px" }}>
                    PLATAFORMA RECOMENDADA
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(result.solucion_principal?.empresas_recomendadas || []).map((company) => {
                      const selected = listingFilters.company === company;

                      return (
                        <button
                          key={company}
                          type="button"
                          onClick={() => updateListingFilter("company", company)}
                          style={{
                            background: selected ? "rgba(59,130,246,0.24)" : "rgba(15,23,42,0.35)",
                            border: selected
                              ? "1px solid rgba(147,197,253,0.7)"
                              : "1px solid rgba(148,163,184,0.22)",
                            color: selected ? "#eff6ff" : "#cbd5e1",
                            padding: "7px 12px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {company}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => searchRealListing(listingFilters)}
                    disabled={!canSearchListing || listingLoading}
                    style={{
                      background: canSearchListing && !listingLoading
                        ? "linear-gradient(135deg,#0ea5e9,#2563eb)"
                        : "rgba(148,163,184,0.2)",
                      border: "none",
                      color: "white",
                      padding: "10px 14px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: canSearchListing && !listingLoading ? "pointer" : "not-allowed",
                      opacity: canSearchListing && !listingLoading ? 1 : 0.6,
                    }}
                  >
                    {listingLoading ? "Buscando anuncio real..." : "🔎 Buscar anuncio real ahora"}
                  </button>
                  {!canSearchListing && (
                    <span style={{ fontSize: 11, color: "#bfdbfe", alignSelf: "center" }}>
                      {isRentingOutcome
                        ? "Elige plataforma y cuota para activar la búsqueda."
                        : "Elige una plataforma para activar la búsqueda."}
                    </span>
                  )}
                </div>

                {listingError && (
                  <div
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      fontSize: 12,
                      color: "#fecaca",
                    }}
                  >
                    {listingError}
                  </div>
                )}

                {listingResult && (
                  <div
                    style={{
                      background: "rgba(2,6,23,0.42)",
                      border: "1px solid rgba(96,165,250,0.22)",
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#67e8f9",
                        marginBottom: 6,
                        fontWeight: 700,
                        letterSpacing: "0.6px",
                      }}
                    >
                      {listingResult.listingType === "renting" ? "📅 OFERTA REAL DE RENTING" : "🚗 ANUNCIO REAL DE COMPRA"} · {listingResult.source || "Web externa"}
                      {Number.isFinite(Number(listingResult.profileScore))
                        ? ` · ENCAJE ${listingResult.profileScore}/100`
                        : ""}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
                          {listingResult.title}
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                          {listingResult.description || "Hemos seleccionado esta opcion por encaje con tu resultado y disponibilidad actual en la web."}
                        </p>
                      </div>
                      {listingResult.price && (
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>
                          {listingResult.price}
                        </div>
                      )}
                    </div>
                    {listingResult.matchReason && (
                      <p style={{ margin: "0 0 10px", fontSize: 11, color: "#93c5fd", lineHeight: 1.5 }}>
                        Encaje detectado: {listingResult.matchReason}
                      </p>
                    )}
                    {Array.isArray(listingResult.whyMatches) && listingResult.whyMatches.length > 0 && (
                      <div
                        style={{
                          background: "rgba(37,99,235,0.1)",
                          border: "1px solid rgba(147,197,253,0.25)",
                          borderRadius: 12,
                          padding: 12,
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: "#bfdbfe",
                            marginBottom: 7,
                            fontWeight: 700,
                            letterSpacing: "0.6px",
                          }}
                        >
                          🧠 POR QUE SE HA ELEGIDO ESTE COCHE
                        </div>
                        <div style={{ display: "grid", gap: 5 }}>
                          {listingResult.whyMatches.map((reason, index) => (
                            <div
                              key={`${listingResult.url || "listing"}-why-${index}`}
                              style={{ fontSize: 11, color: "#dbeafe", lineHeight: 1.5 }}
                            >
                              • {reason}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a
                        href={listingResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: "linear-gradient(135deg,#10b981,#059669)",
                          color: "white",
                          textDecoration: "none",
                          padding: "9px 13px",
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Abrir anuncio ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => searchRealListing(listingFilters)}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "#cbd5e1",
                          padding: "9px 13px",
                          borderRadius: 10,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Buscar otra opcion
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Alternatives */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {(result.alternativas || []).map((alt, i) => {
                  const mt2 = MOBILITY_TYPES[alt.tipo] || {
                    label: alt.tipo,
                    icon: "🚗",
                    color: "#64748b",
                  };
                  return (
                    <div
                      key={i}
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}
                      >
                        <span style={{ fontSize: 18 }}>{mt2.icon}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0" }}>
                            {alt.titulo}
                          </div>
                          <div style={{ fontSize: 11, color: mt2.color }}>
                            {alt.score}% coincidencia
                          </div>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                        {alt.razon}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Expert + listing follow-up */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                  gap: 10,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    background: "rgba(234,179,8,0.07)",
                    border: "1px solid rgba(234,179,8,0.18)",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#eab308",
                      marginBottom: 7,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    💡 CONSEJO DE EXPERTO
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                    {result.consejo_experto}
                  </p>
                </div>
                <div
                  style={{
                    background: "rgba(16,185,129,0.07)",
                    border: "1px solid rgba(16,185,129,0.18)",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#34d399",
                      marginBottom: 7,
                      fontWeight: 600,
                      letterSpacing: "0.6px",
                    }}
                  >
                    {listingResult ? "✅ OFERTA REAL PRESELECCIONADA" : "🧭 BÚSQUEDA DE OFERTA REAL"}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                    {listingResult
                      ? `${listingResult.title}${listingResult.price ? ` · ${listingResult.price}` : ""}`
                      : "Selecciona arriba una plataforma y, si aplica, tu franja de cuota para traerte una unica opcion real publicada en la web."}
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(5,150,105,0.08))",
                  border: "1px solid rgba(37,99,235,0.18)",
                  borderRadius: 16,
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>
                  ¿Quieres asesoramiento personalizado?
                </h3>
                <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: 13 }}>
                  Nuestros especialistas pueden ayudarte a comparar ofertas concretas y conseguir
                  las mejores condiciones
                </p>
                <div
                  style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}
                >
                  <button style={s.btn}>📞 Hablar con un asesor</button>
                  <button
                    onClick={restart}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#94a3b8",
                      padding: "12px 20px",
                      borderRadius: 10,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    🔄 Repetir análisis
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ── ERROR ── */}
      {error && (
        <div
          style={{
            maxWidth: 500,
            margin: "60px auto",
            padding: "0 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.22)",
              borderRadius: 14,
              padding: 24,
            }}
          >
            <p style={{ color: "#fca5a5", marginBottom: 16, fontSize: 13 }}>{error}</p>
            <button
              onClick={() => analyzeWithAI(answers)}
              style={{
                background: "#dc2626",
                border: "none",
                color: "white",
                padding: "10px 20px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL STYLES */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 40px rgba(37,99,235,0.3); }
          50% { box-shadow: 0 0 60px rgba(37,99,235,0.55); }
        }
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        select {
          font-family: inherit;
          color-scheme: dark;
        }
        select option {
          background: #0f1b2d;
          color: #f8fafc;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}