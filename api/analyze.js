const JSON5 = require("json5");
const { jsonrepair } = require("jsonrepair");

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

function extractJsonCandidate(rawText) {
  const text = String(rawText || "")
    .replace(/```json|```/gi, "")
    .trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function parseGeminiJson(text) {
  const candidate = sanitizeJsonStringContent(
    extractJsonCandidate(text)
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
  );

  try {
    return JSON.parse(candidate);
  } catch {}

  try {
    return JSON5.parse(candidate);
  } catch {}

  try {
    const repaired = jsonrepair(candidate);
    return JSON.parse(repaired);
  } catch {}

  try {
    const singleQuotedKeys = candidate.replace(/([{,]\s*)'([^'\\]+?)'\s*:/g, '$1"$2":');
    return JSON.parse(singleQuotedKeys);
  } catch {}

  try {
    const repaired = candidate
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:/g, '$1"$2":')
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    return JSON.parse(repaired);
  } catch {}

  return null;
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      code: "API_KEY_MISSING",
      error: "GEMINI_API_KEY is not configured",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // Descubre modelos compatibles con generateContent para evitar fallos por nombres no disponibles.
    const modelsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const modelsData = await modelsResponse.json();

    const availableModelNames = (modelsData?.models || [])
      .filter((model) => Array.isArray(model?.supportedGenerationMethods))
      .filter((model) => model.supportedGenerationMethods.includes("generateContent"))
      .map((model) => model.name)
      .filter(Boolean);

    const preferredModels = [
      "models/gemini-2.0-flash",
      "models/gemini-2.0-flash-lite",
      "models/gemini-1.5-flash",
      "models/gemini-1.5-pro",
    ];

    const orderedModels = [
      ...preferredModels.filter((name) => availableModelNames.includes(name)),
      ...availableModelNames.filter((name) => !preferredModels.includes(name) && name.includes("gemini")),
      ...availableModelNames.filter((name) => !name.includes("gemini")),
    ];

    if (orderedModels.length === 0) {
      return res.status(400).json({
        code: "MODEL_NOT_AVAILABLE",
        error: "Tu API key no tiene modelos compatibles con generateContent en v1beta.",
      });
    }

    async function generateContent(promptText) {
      const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          maxOutputTokens: 2200,
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      };

      let response;
      let data;
      let lastErrorStatus = 500;
      let lastErrorData = { error: "No se pudo completar la solicitud" };

      for (const modelName of orderedModels) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        data = await response.json();

        if (response.ok) {
          return { ok: true, data, modelName };
        }

        lastErrorStatus = response.status;
        lastErrorData = data;
      }

      return {
        ok: false,
        status: lastErrorStatus,
        data: lastErrorData,
      };
    }

    const generation = await generateContent(prompt);

    if (!generation.ok) {
      const lastErrorStatus = generation.status;
      const lastErrorData = generation.data;
      const errorMessage = lastErrorData?.error?.message || "";
      const isQuotaExceeded =
        lastErrorStatus === 429 ||
        /quota exceeded|rate limit|exceeded your current quota/i.test(errorMessage);

      if (isQuotaExceeded) {
        return res.status(429).json({
          code: "QUOTA_EXCEEDED",
          error:
            "Tu clave de Gemini no tiene cuota disponible ahora mismo. Crea otra API key en AI Studio o espera a que se reinicie la cuota.",
        });
      }

      return res.status(lastErrorStatus).json(lastErrorData);
    }

    // Normalizar respuesta al formato que espera App.js
    const text = generation.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = parseGeminiJson(text);

    if (parsed && isCompleteAdvisorResult(parsed)) {
      return res.status(200).json({ parsed: normalizeAdvisorResult(parsed) });
    }

    const repairPrompt = `${prompt}\n\nLa respuesta anterior ha llegado incompleta o con campos vacios. Repite el analisis y devuelve JSON VALIDO COMPLETO. Requisitos obligatorios:\n- No dejes ningun string vacio.\n- Incluye exactamente 3 ventajas.\n- Incluye exactamente 2 inconvenientes.\n- Incluye exactamente 2 alternativas con titulo, score y razon.\n- Incluye al menos 3 empresas_recomendadas reales en Espana.\n- Incluye consejo_experto, siguiente_paso y tco_aviso con contenido concreto.\n- Devuelve solo JSON.`;

    const repairedGeneration = await generateContent(repairPrompt);

    if (repairedGeneration.ok) {
      const repairedText = repairedGeneration.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const repairedParsed = parseGeminiJson(repairedText);

      if (repairedParsed && isCompleteAdvisorResult(repairedParsed)) {
        return res.status(200).json({ parsed: normalizeAdvisorResult(repairedParsed) });
      }
    }

    return res.status(502).json({
      code: "AI_INVALID_RESPONSE",
      error:
        "Gemini ha devuelto una respuesta no interpretable despues de varios intentos. Repite el analisis.",
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
