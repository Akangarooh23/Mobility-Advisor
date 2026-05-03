const testAnswers = {
  perfil: "particular",
  flexibilidad: "propiedad_financiada",
  uso_principal: ["trabajo_diario", "familia"],
  entorno_uso: "mixto",
  km_anuales: "10k_20k",
  ocupantes: "5_plazas_maletero_medio",
  marca_preferencia: "asiatica_fiable",
  propulsion_preferida: "hibrido_no_enchufable",
  marca_objetivo: "",
  modelo_objetivo: "",
  horizonte: "5_7",
  garaje: "sin_garaje",
  zbe_impacto: "alta",
  cuota_mensual: "300_500",
  capital_propio: "menos_5k",
  ponderacion_score_personalizada: {
    marca_preferencia: 4,
    propulsion_preferida: 5,
    ocupantes: 4,
    antiguedad_vehiculo_buscada: 3
  }
};

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

(async () => {
  const analysisPrompt = "Analiza este perfil de movilidad y recomienda la mejor estrategia.";
  const analyzeResp = await postJson("http://127.0.0.1:3001/api/analyze", {
    prompt: analysisPrompt,
    answers: testAnswers,
    advisorContext: "buy"
  });

  if (analyzeResp.status !== 200 || !analyzeResp.json?.parsed) {
    console.log(JSON.stringify({
      step: "analyze",
      status: analyzeResp.status,
      bodyPreview: analyzeResp.text.slice(0, 500)
    }, null, 2));
    return;
  }

  const parsed = analyzeResp.json.parsed;
  const recommended = Array.isArray(parsed.vehiculos_recomendados) ? parsed.vehiculos_recomendados : [];

  const listingResp = await postJson("http://127.0.0.1:3001/api/find-listing", {
    result: parsed,
    answers: testAnswers,
    filters: {
      location: "toda_espana",
      fuel: "",
      inventoryOnly: true
    }
  });

  const listingJson = listingResp.json || {};
  const listings = Array.isArray(listingJson.listings) ? listingJson.listings : [];

  console.log(JSON.stringify({
    analyze: {
      status: analyzeResp.status,
      tipo: parsed?.solucion_principal?.tipo || null,
      titulo: parsed?.solucion_principal?.titulo || null,
      propulsiones_viables: parsed?.propulsiones_viables || [],
      vehiculos_recomendados_count: recommended.length,
      vehiculos_recomendados: recommended.map((v) => `${v.marca} ${v.modelo}`)
    },
    listings: {
      status: listingResp.status,
      count: listings.length,
      top_titles: listings.map((l) => l.title),
      top_sources: listings.map((l) => l.source),
      synthetic_flags: listings.map((l) => !!l.synthetic),
      searchCoverage: listingJson.searchCoverage || null
    }
  }, null, 2));
})();
