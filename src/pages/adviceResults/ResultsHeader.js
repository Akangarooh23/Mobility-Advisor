export default function ResultsHeader({
  themeMode,
  isOffersResultView,
  result,
  confidenceLabel,
  showOffersPage,
  showAnalysisPage,
  shouldOfferValuationPrompt,
  valuationPromptTitle,
  valuationPromptText,
  openSellValuationFromOffers,
}) {
  const isDark = themeMode === "dark";

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: isDark ? "rgba(16,185,129,0.16)" : "rgba(5,150,105,0.1)",
            border: isDark ? "1px solid rgba(110,231,183,0.3)" : "1px solid rgba(5,150,105,0.22)",
            padding: "5px 14px",
            borderRadius: 100,
            fontSize: 11,
            color: isDark ? "#86efac" : "#047857",
            marginBottom: 14,
            letterSpacing: "0.6px",
          }}
        >
          ✅ ANÁLISIS COMPLETADO · {result.alineacion_pct || result.solucion_principal?.score}% ALINEACIÓN{confidenceLabel}
        </div>
        <h2
          style={{
            fontSize: "clamp(20px,4vw,30px)",
            fontWeight: 800,
            letterSpacing: "-1px",
            margin: 0,
            color: isDark ? "#f8fafc" : "#0f172a",
          }}
        >
          {isOffersResultView ? "Tus ofertas recomendadas" : "Tu solución de movilidad óptima"}
        </h2>
      </div>

      {!isOffersResultView ? (
        <div
          style={{
            background: isDark ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.95)",
            border: isDark ? "1px solid rgba(96,165,250,0.26)" : "1px solid rgba(37,99,235,0.2)",
            borderRadius: 16,
            padding: 18,
            marginBottom: 18,
            textAlign: "center",
            boxShadow: isDark ? "0 14px 30px rgba(2,6,23,0.34)" : "0 14px 30px rgba(37,99,235,0.1)",
          }}
        >
          <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155", marginBottom: 10, lineHeight: 1.6 }}>
            Ya tienes el análisis completo. Cuando quieras, entra en una vista separada con solo tus ofertas ordenadas por encaje real.
          </div>
          <button
            type="button"
            onClick={showOffersPage}
            style={{
              background: "linear-gradient(135deg,#10b981,#059669)",
              border: "none",
              color: "white",
              padding: "12px 20px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 12px 30px rgba(16,185,129,0.18)",
            }}
          >
            🚗 Ver tus ofertas
          </button>
        </div>
      ) : (
        <>
          <div
            style={{
                background: isDark ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.95)",
                border: isDark ? "1px solid rgba(125,211,252,0.26)" : "1px solid rgba(14,165,233,0.2)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 18,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              boxShadow: isDark ? "0 12px 26px rgba(2,6,23,0.32)" : "0 12px 26px rgba(14,165,233,0.08)",
            }}
          >
            <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155", lineHeight: 1.6, textAlign: "left", flex: 1, minWidth: 240 }}>
              Aquí ves solo las ofertas del test: la destacada y las alternativas, con el motivo de selección y su ajuste con tus respuestas.
            </div>
            <button
              type="button"
              onClick={showAnalysisPage}
              style={{
                background: isDark ? "rgba(30,41,59,0.86)" : "rgba(241,245,249,0.9)",
                border: isDark ? "1px solid rgba(148,163,184,0.36)" : "1px solid rgba(148,163,184,0.28)",
                color: isDark ? "#e2e8f0" : "#334155",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ← Volver al análisis
            </button>
          </div>

          {shouldOfferValuationPrompt && (
            <div
              style={{
                background: isDark ? "rgba(120,53,15,0.3)" : "rgba(245,158,11,0.08)",
                border: isDark ? "1px solid rgba(251,191,36,0.34)" : "1px solid rgba(251,191,36,0.24)",
                borderRadius: 16,
                padding: 16,
                marginBottom: 18,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
                boxShadow: isDark ? "0 12px 26px rgba(2,6,23,0.3)" : "0 12px 26px rgba(217,119,6,0.1)",
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 10, color: isDark ? "#fcd34d" : "#92400e", marginBottom: 6, fontWeight: 800, letterSpacing: "0.6px" }}>
                  💶 TASACIÓN RECOMENDADA
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 4 }}>
                  {valuationPromptTitle}
                </div>
                <div style={{ fontSize: 12, color: isDark ? "#fde68a" : "#92400e", lineHeight: 1.6 }}>
                  {valuationPromptText}
                </div>
              </div>
              <button
                type="button"
                onClick={openSellValuationFromOffers}
                style={{
                  background: "linear-gradient(135deg,#f59e0b,#d97706)",
                  border: "none",
                  color: "white",
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 12px 30px rgba(217,119,6,0.16)",
                }}
              >
                Ir a la tasación →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
