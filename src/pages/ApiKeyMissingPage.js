export default function ApiKeyMissingPage({ styles, totalSteps, answers, steps, onRestart }) {
  return (
    <div style={{ ...styles.center, textAlign: "center" }}>
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
          { step: "2", text: "En local, crea un archivo .env.local en la raíz del proyecto" },
          { step: "3", text: 'Escribe GEMINI_API_KEY="AIza..." dentro del archivo' },
          { step: "4", text: "Reinicia npm start y vuelve a intentarlo" },
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
        <span style={{ color: "#475569" }}>{"Variable local (.env.local)"}</span>
        <br />
        <span style={{ color: "#e2e8f0" }}>GEMINI_API_KEY</span>{" "}
        <span style={{ color: "#60a5fa" }}>= </span>
        <span style={{ color: "#34d399" }}>
          "AIza..."
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={onRestart} style={styles.btn}>
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
          {steps.slice(0, 8).map((s) => {
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
  );
}
