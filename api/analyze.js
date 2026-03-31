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
      generationConfig: { maxOutputTokens: 1400 },
    };

    // 1.5 Flash suele estar disponible en cuentas gratuitas donde 2.0 puede tener cuota 0.
    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    let data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.error?.message || "";
      const isQuotaExceeded =
        response.status === 429 ||
        /quota exceeded|rate limit|exceeded your current quota/i.test(errorMessage);

      if (isQuotaExceeded) {
        return res.status(429).json({
          code: "QUOTA_EXCEEDED",
          error:
            "Tu clave de Gemini no tiene cuota disponible ahora mismo. Crea otra API key en AI Studio o espera a que se reinicie la cuota.",
        });
      }

      return res.status(response.status).json(data);
    }

    // Normalizar respuesta al formato que espera App.js
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return res.status(200).json({
      content: [{ type: "text", text }],
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
