import { useTranslation } from "react-i18next";

export default function ServiceInsurancePage({ onGoBack, onGoHome }) {
  const { t } = useTranslation();
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #ece8df",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(0,0,0,0.04)",
  };

  const strengths = [
    t("service.insuranceStrength1"),
    t("service.insuranceStrength2"),
    t("service.insuranceStrength3"),
    t("service.insuranceStrength4"),
  ];

  const weaknesses = [
    t("service.insuranceWeakness1"),
    t("service.insuranceWeakness2"),
    t("service.insuranceWeakness3"),
    t("service.insuranceWeakness4"),
  ];

  const bars = [
    [t("service.insuranceCovLabel1"), 100, t("service.insuranceCovScore1"), "#22c55e"],
    [t("service.insuranceCovLabel2"), 62, t("service.insuranceCovScore2"), "#38bdf8"],
    [t("service.insuranceCovLabel3"), 83, t("service.insuranceCovScore3"), "#22d3ee"],
    [t("service.insuranceCovLabel4"), 40, t("service.insuranceCovScore4"), "#f59e0b"],
    [t("service.insuranceCovLabel5"), 18, t("service.insuranceCovScore5"), "#ef4444"],
    [t("service.insuranceCovLabel6"), 70, t("service.insuranceCovScore6"), "#38bdf8"],
  ];

  return (
    <div style={{ width: "100%", maxWidth: 1040, margin: "0 auto", color: "#1a1a1a", padding: "0 8px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button
          type="button"
          onClick={onGoBack}
          style={{
            border: "1px solid #ece8df",
            background: "#ffffff",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12,
            color: "#888",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {t("service.insuranceBack")}
        </button>
        <div style={{ fontSize: 12, color: "#b8b8b8" }}>
          {t("service.insuranceBreadcrumbParent")} › <span style={{ color: "#06b6d4", fontWeight: 700 }}>{t("service.insuranceBreadcrumb")}</span>
        </div>
      </div>

      <section style={{ ...cardStyle, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: 4, background: "#06b6d4" }} />
        <div style={{ padding: "26px 28px" }}>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid rgba(6,182,212,0.3)",
              color: "#0891b2",
              background: "rgba(6,182,212,0.08)",
              borderRadius: 20,
              padding: "4px 11px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {t("service.insurancePageBadge")}
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(30px,3.1vw,40px)", letterSpacing: "-0.03em", lineHeight: 1.15, color: "#111" }}>
            {t("service.insuranceTitle")}
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#868686", maxWidth: 760 }}>
            {t("service.insurancePageDesc")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {[
              t("service.insurancePill1"),
              t("service.insurancePill2"),
              t("service.insurancePill3"),
            ].map((pill) => (
              <span
                key={pill}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#a0a0a0",
                  border: "1px solid #efebe4",
                  background: "#fafaf9",
                  padding: "5px 12px",
                  borderRadius: 30,
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ ...cardStyle, padding: 22 }}>
            <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
              {t("service.insuranceUploadLabel")}
            </div>
            <div
              style={{
                border: "1.5px dashed #e5e0d8",
                borderRadius: 14,
                padding: "44px 20px",
                textAlign: "center",
                background: "#fdfcfa",
              }}
            >
              <div style={{ fontSize: 34, marginBottom: 10 }}>📄</div>
              <div style={{ fontSize: 20, color: "#777", fontWeight: 700, marginBottom: 4 }}>{t("service.insuranceDragTitle")}</div>
              <div style={{ fontSize: 13, color: "#b2b2b2", marginBottom: 8 }}>{t("service.insuranceDragSubtitle")}</div>
              <div style={{ fontSize: 12, color: "#bbb", fontWeight: 700 }}>{t("service.insuranceDragFormats")}</div>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 22 }}>
            <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
              {t("service.insuranceCoverageLabel")}
            </div>
            {bars.map(([label, val, score, color]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                <div style={{ width: 118, fontSize: 13, color: "#888" }}>{label}</div>
                <div style={{ flex: 1, height: 6, background: "#f0ece4", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${val}%`, height: 6, background: color }} />
                </div>
                <div style={{ width: 42, textAlign: "right", fontSize: 13, fontWeight: 700, color: "#777" }}>{score}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 22 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            {t("service.insuranceSummaryLabel")}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[
              [t("service.insuranceTabStrengths"), true],
              [t("service.insuranceTabWeaknesses"), false],
              [t("service.insuranceTabComparison"), false],
            ].map(([label, active]) => (
              <span
                key={label}
                style={{
                  borderRadius: 20,
                  padding: "5px 11px",
                  fontSize: 12,
                  fontWeight: 700,
                  border: "1px solid #e6e6e6",
                  background: active ? "rgba(6,182,212,0.08)" : "#fafaf9",
                  color: active ? "#0891b2" : "#b2b2b2",
                }}
              >
                {label}
              </span>
            ))}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#22c55e", marginBottom: 6 }}>{t("service.insuranceStrengthsHeader")}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {strengths.map((item) => (
                <div key={item} style={{ fontSize: 14, color: "#5f5f5f", lineHeight: 1.45 }}>✓ {item}</div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b", marginBottom: 6 }}>{t("service.insuranceWeaknessesHeader")}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {weaknesses.map((item) => (
                <div key={item} style={{ fontSize: 14, color: "#666", lineHeight: 1.45 }}>▲ {item}</div>
              ))}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(6,182,212,0.35)",
              background: "rgba(6,182,212,0.08)",
              borderRadius: 12,
              padding: "12px 13px",
              color: "#0e7490",
              fontSize: 13,
              lineHeight: 1.5,
              fontWeight: 600,
            }}
          >
            {t("service.insuranceRecommendation")}
          </div>
        </div>
      </section>

      <section
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "18px 20px",
        }}
      >
        <div>
          <div style={{ fontSize: 18, color: "#303030", fontWeight: 700, marginBottom: 3 }}>{t("service.insuranceCtaTitle")}</div>
          <div style={{ fontSize: 13, color: "#a2a2a2", lineHeight: 1.45 }}>
            {t("service.insuranceCtaDesc")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onGoBack}
            style={{ border: "none", background: "transparent", color: "#bbb", fontSize: 14, cursor: "pointer" }}
          >
            {t("service.insuranceBack")}
          </button>
          <button
            type="button"
            onClick={onGoHome}
            style={{
              border: "none",
              borderRadius: 14,
              background: "linear-gradient(135deg,#06b6d4,#22d3ee)",
              color: "#fff",
              padding: "12px 20px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(6,182,212,0.3)",
            }}
          >
            {t("service.insuranceCtaButton")}
          </button>
        </div>
      </section>
    </div>
  );
}
