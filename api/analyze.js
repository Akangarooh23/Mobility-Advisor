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

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1400,
        responseMimeType: "application/json",
      },
    };

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
        break;
      }

      lastErrorStatus = response.status;
      lastErrorData = data;
    }

    if (!response || !response.ok) {
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    try {
      const parsed = JSON.parse(text);
      return res.status(200).json({ parsed });
    } catch {
      // Si no viene JSON perfecto, el frontend aplica parsing tolerante.
    }

    return res.status(200).json({
      content: [{ type: "text", text }],
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
