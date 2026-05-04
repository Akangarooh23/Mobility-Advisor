export default function ResultsHeader({
  themeMode,
  result,
  confidenceLabel,
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
          Tu solución de movilidad óptima
        </h2>
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
  );
}
