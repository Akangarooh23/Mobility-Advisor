export default function ResultsHeader({
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
  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
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
          ✅ ANÁLISIS COMPLETADO · {result.alineacion_pct || result.solucion_principal?.score}% ALINEACIÓN{confidenceLabel}
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
          {isOffersResultView ? "Tus ofertas recomendadas" : "Tu solución de movilidad óptima"}
        </h2>
      </div>

      {!isOffersResultView ? (
        <div
          style={{
            background: "linear-gradient(135deg,rgba(37,99,235,0.14),rgba(14,165,233,0.08))",
            border: "1px solid rgba(96,165,250,0.24)",
            borderRadius: 16,
            padding: 18,
            marginBottom: 18,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 12, color: "#dbeafe", marginBottom: 10, lineHeight: 1.6 }}>
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
              background: "rgba(14,165,233,0.08)",
              border: "1px solid rgba(125,211,252,0.22)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 18,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "#dbeafe", lineHeight: 1.6, textAlign: "left", flex: 1, minWidth: 240 }}>
              Aquí ves solo las ofertas del test: la destacada y las alternativas, con el motivo de selección y su ajuste con tus respuestas.
            </div>
            <button
              type="button"
              onClick={showAnalysisPage}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e2e8f0",
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
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(251,191,36,0.24)",
                borderRadius: 16,
                padding: 16,
                marginBottom: 18,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 10, color: "#fbbf24", marginBottom: 6, fontWeight: 800, letterSpacing: "0.6px" }}>
                  💶 TASACIÓN RECOMENDADA
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>
                  {valuationPromptTitle}
                </div>
                <div style={{ fontSize: 12, color: "#fde68a", lineHeight: 1.6 }}>
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
