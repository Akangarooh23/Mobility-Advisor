import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function ServiceMonthlyPlanPage({ onGoBack, onGoHome }) {
  const { t } = useTranslation();

  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #ece8df",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(0,0,0,0.04)",
  };

  const plans = [
    { nameKey: "service.monthlyPlanBasic", price: 29 },
    { nameKey: "service.monthlyPlanComplete", price: 49 },
    { nameKey: "service.monthlyPlanPremium", price: 79 },
  ];

  const [selectedPlan, setSelectedPlan] = useState(0);
  const selected = plans[selectedPlan];

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
          {t("common.backArrow")}
        </button>
        <div style={{ fontSize: 12, color: "#b8b8b8" }}>
          {t("service.monthlyPageBreadcrumbParent")} › <span style={{ color: "#d97706", fontWeight: 700 }}>{t("service.monthlyPageBreadcrumb")}</span>
        </div>
      </div>

      <section style={{ ...cardStyle, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: 4, background: "#d97706" }} />
        <div style={{ padding: "26px 28px" }}>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid rgba(217,119,6,0.3)",
              color: "#b45309",
              background: "rgba(217,119,6,0.08)",
              borderRadius: 20,
              padding: "4px 11px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {t("service.monthlyPageBadge")}
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(30px,3.1vw,40px)", letterSpacing: "-0.03em", lineHeight: 1.15, color: "#111" }}>
            {t("service.serviceMonthlyTitle")}
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#868686", maxWidth: 760 }}>
            {t("service.monthlyPageDesc")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {[
              t("service.monthlyPill1"),
              t("service.monthlyPill2"),
              t("service.monthlyPill3"),
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
        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            {t("service.monthlyChoosePlan")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
            {plans.map((plan, idx) => (
              <button
                key={plan.nameKey}
                type="button"
                onClick={() => setSelectedPlan(idx)}
                style={{
                  border: idx === selectedPlan ? "2px solid rgba(217,119,6,0.6)" : "1px solid #ece8df",
                  borderRadius: 10,
                  background: idx === selectedPlan ? "rgba(217,119,6,0.08)" : "#fafaf9",
                  padding: "11px 8px",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#4b4b4b" }}>{t(plan.nameKey)}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: "#1f2937", lineHeight: 1.1 }}>{plan.price}€</div>
                <div style={{ fontSize: 12, color: "#aaa" }}>/{t("service.monthlyPeriod")}</div>
              </button>
            ))}
          </div>

          <div
            style={{
              borderRadius: 14,
              background: "linear-gradient(135deg,#ba7517,#c98120)",
              color: "#fff",
              padding: "18px 20px",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
              {t("service.monthlyCardLabel", { name: t(selected.nameKey) })}
            </div>
            <div style={{ fontSize: 46, lineHeight: 1, fontWeight: 800, marginTop: 4 }}>{selected.price}€</div>
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>{t("service.monthlyCardSubLabel")}</div>
            <div style={{ display: "grid", gap: 6, fontSize: 14, lineHeight: 1.4 }}>
              {[
                t("service.monthlyCardItem1"),
                t("service.monthlyCardItem2"),
                t("service.monthlyCardItem3"),
                t("service.monthlyCardItem4"),
                t("service.monthlyCardItem5"),
              ].map((item) => (
                <div key={item}>✓ {item}</div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
              {t("service.monthlyNoCommit")}
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            {t("service.monthlyIncludedHeader")}
          </div>
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {[
              [t("service.monthlyInclude1Title"), t("service.monthlyInclude1Desc")],
              [t("service.monthlyInclude2Title"), t("service.monthlyInclude2Desc")],
              [t("service.monthlyInclude3Title"), t("service.monthlyInclude3Desc")],
              [t("service.monthlyInclude4Title"), t("service.monthlyInclude4Desc")],
              [t("service.monthlyInclude5Title"), t("service.monthlyInclude5Desc")],
            ].map(([title, sub]) => (
              <div key={title} style={{ border: "1px solid #ece8df", borderRadius: 10, background: "#fafaf9", padding: "10px 12px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#4b4b4b", marginBottom: 2 }}>✓ {title}</div>
                <div style={{ fontSize: 13, color: "#9a9a9a" }}>{sub}</div>
              </div>
            ))}
          </div>

          <div style={{ border: "1px solid rgba(217,119,6,0.35)", borderRadius: 12, background: "rgba(217,119,6,0.08)", padding: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "#d97706", fontWeight: 800, marginBottom: 8 }}>
              {t("service.monthlySavingsHeader")}
            </div>
            <div style={{ display: "grid", gap: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#888" }}>
                <span>{t("service.monthlySavingsWithout")}</span>
                <span>{t("service.monthlySavingsWithoutAmount")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#888" }}>
                <span>{t("service.monthlySavingsWith", { name: t(selected.nameKey).toLowerCase() })}</span>
                <span>{t("service.monthlySavingsWithAmount", { amount: selected.price * 12 - 24 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#b45309", fontWeight: 800 }}>
                <span>{t("service.monthlySavingsLabel")}</span>
                <span>{t("service.monthlySavingsWithAmount", { amount: 580 - (selected.price * 12 - 24) })}</span>
              </div>
            </div>
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
          <div style={{ fontSize: 18, color: "#303030", fontWeight: 700, marginBottom: 3 }}>
            {t("service.monthlyCtaTitle", { name: t(selected.nameKey).toLowerCase(), price: selected.price })}
          </div>
          <div style={{ fontSize: 13, color: "#a2a2a2", lineHeight: 1.45 }}>
            {t("service.monthlyCtaDesc")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onGoBack}
            style={{ border: "none", background: "transparent", color: "#bbb", fontSize: 14, cursor: "pointer" }}
          >
            {t("common.backArrow")}
          </button>
          <button
            type="button"
            onClick={onGoHome}
            style={{
              border: "none",
              borderRadius: 14,
              background: "linear-gradient(135deg,#ba7517,#d18a1e)",
              color: "#fff",
              padding: "12px 20px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(186,117,23,0.3)",
            }}
          >
            {t("service.monthlyCtaButton")}
          </button>
        </div>
      </section>
    </div>
  );
}
