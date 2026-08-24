import { useTranslation } from "react-i18next";

export default function LoadingAnalysisPage({ styles, loadingTexts, loadingPhase, themeMode }) {
  const isDark = themeMode === "dark";
  const { t } = useTranslation();

  return (
    <div style={{ ...styles.center, textAlign: "center" }}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 22,
          background: "linear-gradient(135deg,var(--marca),#059669)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          margin: "0 auto 28px",
          boxShadow: "0 0 40px rgba(37,99,235,0.3)",
          animation: "pulse 2s ease-in-out infinite",
        }}
      >
        🧠
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.5px", color: isDark ? "var(--gris-50)" : "var(--gris-900)" }}>
        {t("loading.title")}
      </h2>
      <p style={{ color: isDark ? "var(--gris-300)" : "var(--gris-500)", fontSize: 14, marginBottom: 32 }}>
        {t("loading.subtitle")}
      </p>

      <div
        style={{
          background: isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.95)",
          border: isDark ? "1px solid rgba(148,163,184,0.34)" : "1px solid rgba(148,163,184,0.24)",
          borderRadius: 12,
          padding: "14px 20px",
          marginBottom: 28,
          minHeight: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 16 }}>⚙️</span>
        <span style={{ fontSize: 13, color: isDark ? "var(--gris-200)" : "var(--gris-600)" }}>{loadingTexts[loadingPhase]}</span>
      </div>

      <div style={{ textAlign: "left", maxWidth: 320, margin: "0 auto 32px" }}>
        {[
          t("loading.step1"),
          t("loading.step2"),
          t("loading.step3"),
          t("loading.step4"),
        ].map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
              opacity: loadingPhase > i ? 1 : 0.3,
              transition: "opacity 0.5s",
            }}
          >
            <span style={{ color: loadingPhase > i ? "#34d399" : isDark ? "var(--gris-400)" : "var(--gris-600)", fontSize: 14 }}>
              {loadingPhase > i ? "✓" : "○"}
            </span>
            <span style={{ fontSize: 13, color: loadingPhase > i ? (isDark ? "var(--gris-200)" : "var(--gris-700)") : isDark ? "var(--gris-400)" : "var(--gris-500)" }}>
              {item}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--marca)",
              animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
