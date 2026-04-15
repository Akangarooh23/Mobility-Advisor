const API_URL = "http://localhost:3001/api/find-listing";

const BRAND_KEYWORDS = {
  premium_alemana: ["bmw", "audi", "mercedes"],
  premium_escandinava: ["volvo"],
  generalista_europea: ["seat", "volkswagen", "renault", "skoda", "peugeot", "citroen", "dacia"],
  asiatica_fiable: ["toyota", "kia", "hyundai", "nissan", "mazda", "honda", "lexus"],
  nueva_china: ["byd", "mg", "xpeng", "omoda", "jaecoo"],
};

function detectDesiredType(solutionType = "") {
  const value = String(solutionType || "").toLowerCase();
  return value.includes("rent") || value.includes("carsharing") ? "renting" : "compra";
}

function hasAnyToken(text, tokens = []) {
  const normalized = String(text || "").toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function topListingSummary(resp) {
  const top = resp?.listing || (Array.isArray(resp?.listings) ? resp.listings[0] : null) || null;
  return {
    title: top?.title || "",
    source: top?.source || "",
    listingType: top?.listingType || "",
    profileScore: Number(top?.profileScore || 0),
    rankingScore: Number(top?.rankingScore || 0),
    fallback: Boolean(top?.isFallbackMatch),
    synthetic: Boolean(top?.synthetic),
    url: top?.url || "",
  };
}

function evaluateScenario(scenario, responseJson) {
  const desiredType = detectDesiredType(scenario.result.solucion_principal.tipo);
  const top = topListingSummary(responseJson);
  const list = Array.isArray(responseJson?.listings) ? responseJson.listings : [];

  const checks = [];

  checks.push({
    name: "Hay al menos una oferta",
    pass: list.length > 0,
    detail: `offers=${list.length}`,
  });

  checks.push({
    name: "Tipo de oferta coherente con flujo",
    pass: top.listingType === desiredType,
    detail: `expected=${desiredType}, got=${top.listingType || "N/A"}`,
  });

  const brandPriority = Number(scenario.answers?.ponderacion_score_personalizada?.marca_preferencia || 3);
  const brandTokens = BRAND_KEYWORDS[scenario.answers?.marca_preferencia] || [];
  if (brandPriority >= 5 && brandTokens.length > 0) {
    checks.push({
      name: "Marca prioritaria respetada en top offer",
      pass: hasAnyToken(`${top.title} ${top.url}`, brandTokens),
      detail: `tokens=${brandTokens.join(",")}`,
    });
  }

  if (scenario.answers?.modelo_objetivo) {
    const modelTokens = String(scenario.answers.modelo_objetivo)
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    checks.push({
      name: "Modelo objetivo reflejado",
      pass: hasAnyToken(`${top.title} ${top.url}`, modelTokens),
      detail: `modelo=${scenario.answers.modelo_objetivo}`,
    });
  }

  const passCount = checks.filter((c) => c.pass).length;
  return {
    scenario: scenario.name,
    flow: scenario.flow,
    top,
    coverage: responseJson?.searchCoverage || null,
    checks,
    score: `${passCount}/${checks.length}`,
  };
}

async function runScenario(scenario) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      result: scenario.result,
      answers: scenario.answers,
      filters: scenario.filters,
    }),
  });

  const json = await response.json();
  return evaluateScenario(scenario, json);
}

const baseFilters = { budget: "400_700", income: "fijos_estables" };

const scenarios = [
  {
    name: "Comprar - No sé modelo",
    flow: "compra",
    result: {
      solucion_principal: {
        tipo: "compra_financiada",
        titulo: "Compra financiada recomendada",
        empresas_recomendadas: ["Autohero", "Flexicar"],
      },
      propulsiones_viables: ["diesel", "gasolina eficiente"],
    },
    answers: {
      flexibilidad: "propiedad_financiada",
      marca_preferencia: "premium_alemana",
      propulsion_preferida: ["diesel"],
      ocupantes: "5_plazas_maletero_medio",
      entorno_uso: "autopista",
      uso_km_anuales: "10k_20k",
      antiguedad_vehiculo_buscada: ["2_4_anos"],
      ponderacion_score_personalizada: {
        marca_preferencia: 5,
        propulsion_preferida: 4,
        flexibilidad: 3,
        antiguedad_vehiculo_buscada: 2,
        ocupantes: 1,
      },
    },
    filters: baseFilters,
  },
  {
    name: "Comprar - Sí modelo claro",
    flow: "compra",
    result: {
      solucion_principal: {
        tipo: "compra_financiada",
        titulo: "Compra financiada premium",
        empresas_recomendadas: ["Autohero", "Coches.net"],
      },
      propulsiones_viables: ["diesel", "hibrido"],
    },
    answers: {
      flexibilidad: "propiedad_financiada",
      marca_preferencia: "premium_alemana",
      marca_objetivo: "BMW",
      modelo_objetivo: "BMW X1",
      propulsion_preferida: ["diesel"],
      ocupantes: "5_plazas_maletero_medio",
      entorno_uso: "autopista",
      uso_km_anuales: "20k_35k",
      antiguedad_vehiculo_buscada: ["2_4_anos", "4_7_anos"],
      ponderacion_score_personalizada: {
        marca_preferencia: 5,
        propulsion_preferida: 4,
        flexibilidad: 3,
        antiguedad_vehiculo_buscada: 2,
        ocupantes: 1,
      },
    },
    filters: baseFilters,
  },
  {
    name: "Renting - No sé modelo",
    flow: "renting",
    result: {
      solucion_principal: {
        tipo: "renting_largo",
        titulo: "Renting recomendado",
        empresas_recomendadas: ["Ayvens", "Arval", "Northgate"],
      },
      propulsiones_viables: ["hibrido", "diesel"],
    },
    answers: {
      flexibilidad: "renting",
      marca_preferencia: "premium_alemana",
      propulsion_preferida: ["diesel"],
      ocupantes: "5_plazas_maletero_medio",
      entorno_uso: "autopista",
      uso_km_anuales: "10k_20k",
      antiguedad_vehiculo_buscada: ["2_4_anos"],
      ponderacion_score_personalizada: {
        marca_preferencia: 5,
        propulsion_preferida: 4,
        flexibilidad: 3,
        antiguedad_vehiculo_buscada: 2,
        ocupantes: 1,
      },
    },
    filters: baseFilters,
  },
  {
    name: "Renting - Sí modelo claro",
    flow: "renting",
    result: {
      solucion_principal: {
        tipo: "renting_largo",
        titulo: "Renting premium recomendado",
        empresas_recomendadas: ["Ayvens", "Arval"],
      },
      propulsiones_viables: ["diesel", "hibrido"],
    },
    answers: {
      flexibilidad: "renting",
      marca_preferencia: "premium_alemana",
      marca_objetivo: "Audi",
      modelo_objetivo: "Audi A3",
      propulsion_preferida: ["diesel"],
      ocupantes: "5_plazas_maletero_medio",
      entorno_uso: "interurbano",
      uso_km_anuales: "10k_20k",
      antiguedad_vehiculo_buscada: ["2_4_anos"],
      ponderacion_score_personalizada: {
        marca_preferencia: 5,
        propulsion_preferida: 4,
        flexibilidad: 3,
        antiguedad_vehiculo_buscada: 2,
        ocupantes: 1,
      },
    },
    filters: baseFilters,
  },
  {
    name: "Guíame - No lo tengo claro",
    flow: "guia",
    result: {
      solucion_principal: {
        tipo: "renting_largo",
        titulo: "Guía personalizada de movilidad",
        empresas_recomendadas: ["Ayvens", "Autohero", "Coches.net"],
      },
      propulsiones_viables: ["hibrido", "gasolina"],
    },
    answers: {
      flexibilidad: "no_tengo_claro",
      marca_preferencia: "generalista_europea",
      propulsion_preferida: ["hibrido_no_enchufable", "gasolina"],
      ocupantes: "5_plazas_maletero_medio",
      entorno_uso: "mixto",
      uso_km_anuales: "10k_20k",
      antiguedad_vehiculo_buscada: ["0_2_anos", "2_4_anos"],
      ponderacion_score_personalizada: {
        marca_preferencia: 1,
        propulsion_preferida: 2,
        flexibilidad: 5,
        antiguedad_vehiculo_buscada: 3,
        ocupantes: 4,
      },
    },
    filters: baseFilters,
  },
];

(async () => {
  const results = [];

  for (const scenario of scenarios) {
    try {
      const output = await runScenario(scenario);
      results.push(output);
    } catch (error) {
      results.push({
        scenario: scenario.name,
        flow: scenario.flow,
        error: String(error?.message || error),
      });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalScenarios: results.length,
    passedScenarios: results.filter((r) => !r.error && r.checks?.every((c) => c.pass)).length,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
})();
