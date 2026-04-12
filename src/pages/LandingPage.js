export default function LandingPage({
  styles,
  totalSteps,
  blockColors,
  questionnaireDraft,
  onSelectAdvice,
  onResumeAdvice,
  onSelectDecision,
  onSelectSell,
  onSelectPortalVo,
}) {
  const draftAnsweredSteps = Number(questionnaireDraft?.answeredSteps || 0);
  const draftTotalSteps = Number(questionnaireDraft?.totalSteps || totalSteps || 0);
  const hasDraftAnswers = Object.keys(questionnaireDraft?.answers || {}).length > 0;
  const showResumeAdvice = (draftAnsweredSteps > 0 || hasDraftAnswers) && typeof onResumeAdvice === "function";

  return (
    <div style={{ ...styles.center, maxWidth: 1120, textAlign: "center" }}>
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

      {showResumeAdvice && (
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto 28px",
            padding: "14px 16px",
            borderRadius: 16,
            background: "rgba(37,99,235,0.10)",
            border: "1px solid rgba(96,165,250,0.24)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            textAlign: "left",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.4px", color: "#93c5fd", marginBottom: 4 }}>
              BORRADOR DISPONIBLE
            </div>
            <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 700 }}>
              Tienes un cuestionario a medias
            </div>
            <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>
              Llevabas {draftAnsweredSteps} de {draftTotalSteps} preguntas completadas.
            </div>
          </div>

          <button
            type="button"
            onClick={onResumeAdvice}
            style={{
              background: "linear-gradient(135deg,#2563EB,#1d4ed8)",
              border: "none",
              color: "white",
              padding: "11px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Continuar cuestionario
          </button>
        </div>
      )}
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
          onClick={onSelectAdvice}
          style={{
            ...styles.card(false),
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
          onClick={onSelectDecision}
          style={{
            ...styles.card(false),
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
              Filtra por marca, modelo, antigüedad y kilometraje para que la IA ordene las ofertas del mercado
              actual según valor, riesgo y coste final.
            </div>
          </div>
        </button>

        <button
          onClick={onSelectSell}
          style={{
            ...styles.card(false),
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
              La IA estima rango de precio, tendencia histórica, volumen de unidades similares y un informe
              entregable que luego se puede monetizar como servicio premium.
            </div>
          </div>
        </button>
      </div>

      <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={onSelectPortalVo}
          style={{
            background: "linear-gradient(135deg,#f59e0b,#d97706)",
            border: "none",
            color: "white",
            padding: "13px 18px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 14px 34px rgba(217,119,6,0.18)",
          }}
        >
          🏪 Ofertas VO únicas de nuestro portal
        </button>
      </div>

      <p style={{ marginTop: 18, fontSize: 12, color: "#334155" }}>
        Sin registro · Sin tarjeta · ~5 minutos
      </p>

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

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginTop: 36,
        }}
      >
        {Object.entries(blockColors).map(([name, color]) => (
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
  );
}
