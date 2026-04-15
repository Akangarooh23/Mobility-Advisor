/**
 * Auditoría end-to-end: Compra sin modelo claro
 * Simula 4 perfiles realistas de comprador y evalúa coherencia en cada capa.
 * Requiere la API local en http://localhost:3001
 * Uso: node scripts/buy-no-model-audit.js
 */

const ANALYZE_URL = "http://localhost:3001/api/analyze";
const LISTING_URL = "http://localhost:3001/api/find-listing";

const BRAND_TOKENS = {
  generalista_europea: ["seat", "volkswagen", "vw", "renault", "skoda", "peugeot", "citroen", "dacia", "opel"],
  asiatica_fiable: ["toyota", "kia", "hyundai", "nissan", "mazda", "honda", "lexus"],
  premium_alemana: ["bmw", "mercedes", "audi"],
  premium_escandinava: ["volvo"],
  nueva_china: ["byd", "mg", "xpeng", "omoda", "jaecoo"],
  sin_preferencia: [],
};

const FUEL_TOKENS = {
  hibrido_no_enchufable: ["hybrid", "hibrido", "hev", "mhev"],
  hibrido_enchufable: ["phev", "hybrid", "hibrido", "enchufable"],
  electrico_puro: ["electrico", "electric", "bev", "ev"],
  diesel: ["diesel", "tdi", "bluehdi", "dci", "crd"],
  gasolina: ["gasolina", "gasoline", "tsi", "tce", "gti", "tfsi"],
};

function normalizeAccents(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// ─── Perfiles ───────────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    name: "P1 – Particular · Financiada · Híbrido · Ciudad · Asiática · No sabe modelo",
    persona: "María, 34 años. Trabaja en Madrid, aparca en garaje comunitario, hace 12.000 km/año por ciudad y algo de ronda. Sin vehículo actual. Quiere financiarse pero no gastar más de 320 €/mes.",
    advisorContext: "buy",
    answers: {
      perfil: "particular",
      flexibilidad: "propiedad_financiada",
      propulsion_preferida: ["hibrido_no_enchufable"],
      horizonte_tenencia: "5_7",
      antiguedad_vehiculo_buscada: ["2_4_anos", "4_7_anos"],
      uso_km_anuales: "10k_20k",
      entorno_uso: "ciudad",
      uso_principal: ["trabajo_diario", "compras_recados"],
      ocupantes: "5_plazas_maletero_medio",
      marca_preferencia: "asiatica_fiable",
      vehiculo_actual: "no",
      ponderacion_score_personalizada: {
        marca_preferencia: 3,
        propulsion_preferida: 5,
        flexibilidad: 4,
        antiguedad_vehiculo_buscada: 2,
        ocupantes: 1,
      },
    },
    checks: {
      solutionTypeMustBe: ["compra_financiada", "compra_contado"],
      brandPriority: 3,
      brandKey: "asiatica_fiable",
      fuelPriority: 5,
      fuelKeys: ["hibrido_no_enchufable"],
      minScore: 70,
    },
  },
  {
    name: "P2 – Particular · Financiada · Diésel · Autopista · Familiar 7 plazas · Generalista",
    persona: "Carlos, 42 años. Familia con 3 hijos. 28.000 km/año en autopista. Quiere un coche grande que dure 5-7 años. Tiene un coche para entregar. Prioriza espacio y diésel por autonomía.",
    advisorContext: "buy",
    answers: {
      perfil: "particular",
      flexibilidad: "propiedad_financiada",
      propulsion_preferida: ["diesel"],
      horizonte_tenencia: "5_7",
      antiguedad_vehiculo_buscada: ["0_2_anos", "2_4_anos"],
      uso_km_anuales: "20k_35k",
      entorno_uso: "autopista",
      uso_principal: ["trabajo_diario", "familia", "viajes_ocio"],
      ocupantes: "7_plazas_maletero_grande",
      marca_preferencia: "generalista_europea",
      vehiculo_actual: "si_entrego",
      ponderacion_score_personalizada: {
        marca_preferencia: 2,
        propulsion_preferida: 4,
        flexibilidad: 3,
        antiguedad_vehiculo_buscada: 3,
        ocupantes: 5,
      },
    },
    checks: {
      solutionTypeMustBe: ["compra_financiada", "compra_contado"],
      brandPriority: 2,
      brandKey: "generalista_europea",
      fuelPriority: 4,
      fuelKeys: ["diesel"],
      minScore: 65,
    },
  },
  {
    name: "P3 – Joven · Sin preferencia · Gasolina · Poco uso · Compra contado · Cobertura es lo más",
    persona: "Alejandro, 26 años. Vive en ciudad media, menos de 8.000 km/año, solo para fines de semana. Puede pagar contado hasta 12.000 €. No le importa la marca. Quiere algo fiable y barato.",
    advisorContext: "buy",
    answers: {
      perfil: "particular",
      flexibilidad: "propiedad_contado",
      propulsion_preferida: ["gasolina"],
      horizonte_tenencia: "3_5",
      antiguedad_vehiculo_buscada: ["4_7_anos", "mas_7_anos"],
      uso_km_anuales: "menos_10k",
      entorno_uso: "ciudad",
      uso_principal: ["compras_recados", "viajes_ocio"],
      ocupantes: "2_plazas_maletero_pequeno",
      marca_preferencia: "sin_preferencia",
      vehiculo_actual: "no",
      ponderacion_score_personalizada: {
        marca_preferencia: 1,
        propulsion_preferida: 2,
        flexibilidad: 5,
        antiguedad_vehiculo_buscada: 4,
        ocupantes: 3,
      },
    },
    checks: {
      solutionTypeMustBe: ["compra_contado", "compra_financiada"],
      brandPriority: 1,
      brandKey: "sin_preferencia",
      fuelPriority: 2,
      fuelKeys: ["gasolina"],
      minScore: 60,
    },
  },
  {
    name: "P4 – Autónomo · Financiada · Premium Alemana · Mixto · Alto KM · Marca es prioridad máxima",
    persona: "Luis, 48 años. Autónomo, visitas a clientes. 30.000 km/año. Quiere imagen premium. Prefiere BMW o Audi. Dispuesto a pagar cuota más alta. No tiene claro qué modelo exacto.",
    advisorContext: "buy",
    answers: {
      perfil: "autonomo",
      flexibilidad: "propiedad_financiada",
      propulsion_preferida: ["hibrido_no_enchufable", "diesel"],
      horizonte_tenencia: "3_5",
      antiguedad_vehiculo_buscada: ["0_2_anos", "2_4_anos"],
      uso_km_anuales: "20k_35k",
      entorno_uso: "mixto",
      uso_principal: ["visitas_clientes", "trabajo_diario"],
      ocupantes: "5_plazas_maletero_medio",
      marca_preferencia: "premium_alemana",
      vehiculo_actual: "si_entrego",
      ponderacion_score_personalizada: {
        marca_preferencia: 5,
        propulsion_preferida: 4,
        flexibilidad: 3,
        antiguedad_vehiculo_buscada: 3,
        ocupantes: 2,
      },
    },
    checks: {
      solutionTypeMustBe: ["compra_financiada", "compra_contado"],
      brandPriority: 5,
      brandKey: "premium_alemana",
      fuelPriority: 4,
      fuelKeys: ["hibrido_no_enchufable", "diesel"],
      minScore: 70,
    },
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function hasAnyToken(text, tokens) {
  const h = normalizeAccents(text);
  return tokens.some((t) => h.includes(t));
}

function hasFuelToken(text, fuelKeys) {
  const tokens = fuelKeys.flatMap((k) => FUEL_TOKENS[k] || []);
  return hasAnyToken(text, tokens);
}

function hasBrandToken(text, brandKey) {
  const tokens = BRAND_TOKENS[brandKey] || [];
  if (!tokens.length) return null; // sin_preferencia – skip
  return hasAnyToken(text, tokens);
}

function post(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

function buildPromptSummary(answers, stepConfig) {
  // Quick local reconstruction of what the AI receives
  const lines = [];
  lines.push(`Perfil: ${answers.perfil}`);
  lines.push(`Vinculación: ${answers.flexibilidad}`);
  lines.push(`Motorización: ${(answers.propulsion_preferida || []).join(", ")}`);
  lines.push(`Horizonte tenencia: ${answers.horizonte_tenencia}`);
  lines.push(`Antigüedad deseada: ${(answers.antiguedad_vehiculo_buscada || []).join(", ")}`);
  lines.push(`Km anuales: ${answers.uso_km_anuales}`);
  lines.push(`Entorno: ${answers.entorno_uso}`);
  lines.push(`Uso principal: ${(answers.uso_principal || []).join(", ")}`);
  lines.push(`Ocupantes: ${answers.ocupantes}`);
  lines.push(`Marca: ${answers.marca_preferencia}`);
  lines.push(`Vehículo actual: ${answers.vehiculo_actual}`);
  const pw = answers.ponderacion_score_personalizada || {};
  lines.push(`Ponderaciones: marca=${pw.marca_preferencia}, motor=${pw.propulsion_preferida}, compra=${pw.flexibilidad}, antigüedad=${pw.antiguedad_vehiculo_buscada}, plazas=${pw.ocupantes}`);
  return lines.join("\n");
}

async function buildAnalyzePrompt(answers, advisorContext) {
  // Mirrors what buildAdviceAnalysisPrompt does but we only need context for the test
  const summary = buildPromptSummary(answers);
  return summary;
}

// ─── Runner ─────────────────────────────────────────────────────────────────

async function runScenario(scenario) {
  const { name, persona, answers, advisorContext, checks } = scenario;
  const log = [];
  const issues = [];
  const improvements = [];

  console.log(`\n${"═".repeat(70)}`);
  console.log(`🧑 ${name}`);
  console.log(`   ${persona}`);
  console.log(`${"─".repeat(70)}`);

  // ── Step 1: Call /api/analyze ──────────────────────────────────────────
  console.log("  › Llamando /api/analyze...");
  let aiResult = null;
  try {
    const promptSummary = buildPromptSummary(answers);
    const aiRaw = await post(ANALYZE_URL, {
      prompt: `Eres un asesor experto en movilidad en España. Analiza este perfil y responde SOLO con JSON válido, sin markdown ni texto adicional.\n\nPerfil:\n${promptSummary}\n\nContexto: el usuario entra por la vía de COMPRA. Devuelve solucion_principal.tipo solo como compra_contado o compra_financiada.\n\nDevuelve este esquema mínimo:\n{\n  "alineacion_pct": 78,\n  "solucion_principal": {\n    "tipo": "compra_financiada",\n    "score": 82,\n    "titulo": "titulo especifico",\n    "resumen": "resumen 2-3 frases",\n    "ventajas": ["v1", "v2"],\n    "inconvenientes": ["i1"],\n    "coste_estimado": "XXX - YYY EUR/mes",\n    "empresas_recomendadas": ["empresa1", "empresa2"],\n    "etiqueta_dgt": "ECO",\n    "tension_principal": "tension"\n  },\n  "score_desglose": { "encaje_uso": 22, "coste_total": 18, "flexibilidad": 16, "viabilidad_real": 14, "ajuste_preferencias": 12 },\n  "propulsiones_viables": ["lista"],\n  "alternativas": [{ "tipo": "compra_contado", "score": 60, "titulo": "alt", "razon": "r" }],\n  "comparador_final": [],\n  "transparencia": { "confianza_nivel": "alta", "confianza_motivo": "m", "supuestos_clave": [], "validaciones_pendientes": [] },\n  "plan_accion": { "semaforo": "verde", "estado": "ok", "resumen": "r", "acciones": [], "alertas_rojas": [] },\n  "tco_aviso": "aviso",\n  "tco_detalle": { "concepto_base": "cuota", "entrada_inicial": 3000, "base_mensual": 300, "seguro": 55, "energia": 60, "mantenimiento": 35, "extras": 20, "total_mensual": 470, "total_anual": 5640, "nota": "n" },\n  "consejo_experto": "consejo",\n  "siguiente_paso": "paso",\n  "por_que_gana": ["m1", "m2"]\n}`,
    });

    aiResult = aiRaw?.parsed ?? aiRaw;

    if (!aiResult?.solucion_principal?.tipo) {
      issues.push("❌ CRÍTICO: /api/analyze no devolvió solucion_principal.tipo");
    } else {
      const tipo = aiResult.solucion_principal.tipo;
      console.log(`  ✓ Solución IA: ${tipo} · "${aiResult.solucion_principal.titulo || "sin título"}"`);

      // Check solution type coherence
      if (!checks.solutionTypeMustBe.includes(tipo)) {
        issues.push(`❌ INCOHERENCIA TIPO: esperado ${checks.solutionTypeMustBe.join(" o ")}, recibido "${tipo}"`);
      } else {
        log.push(`✓ Tipo solución coherente: ${tipo}`);
      }

      // Check score
      const score = Number(aiResult.solucion_principal.score || 0);
      if (score < checks.minScore) {
        improvements.push(`⚠️ SCORE BAJO: solucion_principal.score=${score} (mínimo esperado ${checks.minScore}) — ¿el perfil está bien representado en el prompt?`);
      } else {
        log.push(`✓ Score AI = ${score}`);
      }

      // Check propulsiones_viables coherence
      const propViables = (aiResult.propulsiones_viables || []).join(" ").toLowerCase();
      if (checks.fuelPriority >= 4) {
        const fuelOk = hasFuelToken(propViables, checks.fuelKeys);
        if (!fuelOk) {
          issues.push(`❌ MOTORIZACIÓN IGNORADA: propulsiones_viables="${propViables}" no incluye ${checks.fuelKeys.join(" ni ")} (prioridad=${checks.fuelPriority})`);
        } else {
          log.push(`✓ Motorización respetada en propulsiones_viables`);
        }
      }

      // Check TCO desglose
      const tco = aiResult.tco_detalle;
      if (!tco || !tco.total_mensual) {
        improvements.push(`⚠️ TCO VACÍO: tco_detalle.total_mensual no presente — el usuario no verá desglose de costes`);
      } else {
        log.push(`✓ TCO desglose presente: ${tco.total_mensual} €/mes (base=${tco.base_mensual}, seguro=${tco.seguro}, energía=${tco.energia})`);
      }

      // Check alternativas
      if (!Array.isArray(aiResult.alternativas) || aiResult.alternativas.length === 0) {
        improvements.push(`⚠️ SIN ALTERNATIVAS: el usuario no tiene opciones de comparación`);
      } else {
        log.push(`✓ ${aiResult.alternativas.length} alternativa(s) generada(s)`);
      }

      // Check plan_accion semaforo
      const semaforo = aiResult.plan_accion?.semaforo;
      if (!semaforo) {
        improvements.push(`⚠️ PLAN DE ACCIÓN VACÍO: falta semaforo/acciones`);
      } else {
        log.push(`✓ Semáforo: ${semaforo}`);
      }

      // Check empresas_recomendadas
      const empresas = aiResult.solucion_principal.empresas_recomendadas || [];
      if (empresas.length === 0) {
        improvements.push(`⚠️ SIN EMPRESAS RECOMENDADAS: el backend no sabrá a qué proveedores buscar`);
      } else {
        log.push(`✓ Empresas recomendadas: ${empresas.slice(0, 3).join(", ")}`);
      }
    }
  } catch (err) {
    issues.push(`❌ ERROR /api/analyze: ${err.message}`);
  }

  // ── Step 2: Call /api/find-listing ────────────────────────────────────
  if (aiResult?.solucion_principal?.tipo) {
    console.log("  › Llamando /api/find-listing...");
    try {
      const listingRaw = await post(LISTING_URL, {
        result: aiResult,
        answers,
        filters: { budget: "300_500", income: "fijos_estables" },
      });

      const topListing = listingRaw?.listing;
      const allListings = listingRaw?.listings || [];
      const coverage = listingRaw?.searchCoverage;

      if (!topListing?.title) {
        issues.push(`❌ CRÍTICO: /api/find-listing no devolvió ninguna oferta`);
      } else {
        const topTitle = topListing.title;
        const topType = topListing.listingType;
        const isSynthetic = Boolean(topListing.synthetic);
        console.log(`  ✓ Top oferta: "${topTitle}" [${topType}${isSynthetic ? " · sintética" : " · real"}]`);
        console.log(`     source=${topListing.source} profileScore=${topListing.profileScore} rankScore=${topListing.rankingScore}`);

        // Type coherence
        const desiredType = checks.solutionTypeMustBe.includes("compra_contado") ? "compra" : "compra";
        if (topType !== desiredType) {
          issues.push(`❌ TIPO INCORRECTO EN OFERTA: esperado "${desiredType}", recibido "${topType}"`);
        } else {
          log.push(`✓ Tipo de oferta correcto: ${topType}`);
        }

        // Brand coherence (only if priority >= 4)
        if (checks.brandPriority >= 4 && checks.brandKey !== "sin_preferencia") {
          const brandOk = hasBrandToken(topTitle + " " + (topListing.url || ""), checks.brandKey);
          if (!brandOk) {
            issues.push(`❌ MARCA NO RESPETADA EN TOP: prioridad=${checks.brandPriority}, grupo="${checks.brandKey}", top="${topTitle}"`);
          } else {
            log.push(`✓ Marca respetada en top oferta (prioridad ${checks.brandPriority})`);
          }
        } else if (checks.brandPriority < 4) {
          log.push(`~ Marca no prioritaria (${checks.brandPriority}/5) — no verificada`);
        }

        // Fuel coherence in top offer (only if priority >= 4)
        if (checks.fuelPriority >= 4) {
          const haystack = topTitle.toLowerCase() + " " + (topListing.description || "").toLowerCase();
          const fuelOk = hasFuelToken(haystack, checks.fuelKeys);
          if (!fuelOk && !isSynthetic) {
            improvements.push(`⚠️ MOTORIZACIÓN NO VISIBLE EN OFERTA TOP: prioridad=${checks.fuelPriority}, esperado=${checks.fuelKeys.join("|")}, título="${topTitle}"`);
          } else if (!isSynthetic) {
            log.push(`✓ Motorización coherente en top oferta`);
          } else {
            log.push(`~ Top oferta es sintética — no se puede verificar motorización en título`);
          }
        }

        // Synthetic ratio
        const syntheticCount = allListings.filter((l) => l.synthetic).length;
        const realCount = allListings.length - syntheticCount;
        if (allListings.length > 0 && syntheticCount === allListings.length) {
          improvements.push(`⚠️ 100% SINTÉTICAS: todas las ofertas son fallback sintético (${allListings.length} total). No se encontró stock real.`);
        } else {
          log.push(`✓ ${realCount} oferta(s) real(es) + ${syntheticCount} sintética(s) de ${allListings.length} total`);
        }

        // matchReason quality
        const matchReason = topListing.matchReason || "";
        if (matchReason.length < 30) {
          improvements.push(`⚠️ matchReason MUY CORTO: "${matchReason}" — el usuario no entiende por qué apareció esta oferta`);
        } else {
          log.push(`✓ matchReason presente (${matchReason.length} chars)`);
        }

        // Coverage stats
        if (coverage) {
          log.push(`✓ Cobertura: ${coverage.visitedProviderPages} páginas · ${coverage.visitedCompanyCount}/${coverage.configuredCompanyCount} proveedores · ${coverage.duckduckgoQueriesAttempted} DDG queries`);
        }

        // All offers same provider?
        const providers = new Set(allListings.map((l) => l.source).filter(Boolean));
        if (providers.size === 1 && allListings.length > 1) {
          improvements.push(`⚠️ DIVERSIDAD BAJA: todas las ofertas vienen del mismo proveedor (${[...providers][0]})`);
        }
      }
    } catch (err) {
      issues.push(`❌ ERROR /api/find-listing: ${err.message}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n  ── LOG ──");
  log.forEach((l) => console.log(`  ${l}`));

  if (improvements.length) {
    console.log("\n  ── MEJORAS SUGERIDAS ──");
    improvements.forEach((m) => console.log(`  ${m}`));
  }

  if (issues.length) {
    console.log("\n  ── PROBLEMAS DETECTADOS ──");
    issues.forEach((i) => console.log(`  ${i}`));
  }

  return {
    name,
    passed: issues.length === 0,
    issues,
    improvements,
    logCount: log.length,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log("\n🔍 AUDITORÍA: Compra sin modelo claro — 4 perfiles realistas");
  console.log(`   API: ${ANALYZE_URL.replace("/api/analyze", "")} · ${new Date().toLocaleTimeString("es-ES")}\n`);

  const results = [];
  for (const scenario of SCENARIOS) {
    const r = await runScenario(scenario);
    results.push(r);
  }

  // Final summary
  console.log(`\n${"═".repeat(70)}`);
  console.log("RESUMEN GLOBAL");
  console.log("═".repeat(70));
  const passed = results.filter((r) => r.passed).length;
  const totalIssues = results.reduce((a, r) => a + r.issues.length, 0);
  const totalImprovements = results.reduce((a, r) => a + r.improvements.length, 0);
  console.log(`  Escenarios OK:      ${passed}/${results.length}`);
  console.log(`  Problemas críticos: ${totalIssues}`);
  console.log(`  Mejoras sugeridas:  ${totalImprovements}\n`);
  results.forEach((r) => {
    const icon = r.passed ? "✓" : r.issues.length ? "✗" : "~";
    const tag = r.issues.length ? ` [${r.issues.length} ERRORES]` : r.improvements.length ? ` [${r.improvements.length} mejoras]` : "";
    console.log(`  ${icon} ${r.name}${tag}`);
  });
  console.log("═".repeat(70));

  if (totalIssues > 0) {
    process.exit(1);
  }
})();
