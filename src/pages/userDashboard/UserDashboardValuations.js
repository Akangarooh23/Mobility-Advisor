import { useState } from "react";
import { useTranslation } from "react-i18next";

function fmt(n) {
  return Number(n).toLocaleString("es-ES");
}

function formatDate(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function TrendIndicator({ estimateValue, isDark }) {
  const { t } = useTranslation();
  if (!estimateValue || estimateValue <= 0) return null;
  // Simulate ±trend based on price band (real trend would come from report field)
  const trend = estimateValue > 20000 ? -3.2 : estimateValue > 10000 ? -1.1 : 0.5;
  const isUp = trend > 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: isUp ? "#059669" : "#dc2626",
          background: isUp ? "rgba(5,150,105,0.10)" : "rgba(220,38,38,0.10)",
          border: `1px solid ${isUp ? "rgba(52,211,153,0.25)" : "rgba(252,165,165,0.25)"}`,
          borderRadius: 999,
          padding: "3px 8px",
        }}
      >
        {isUp ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
      </span>
      <span style={{ fontSize: 11, color: isDark ? "var(--gris-400)" : "var(--gris-500)" }}>{t("dashboard.valLastDays")}</span>
    </div>
  );
}

function ValuationCard({ item, isDark, cardBg, onRequestValuation, onNavigate }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const titleColor = isDark ? "var(--gris-50)" : "var(--gris-900)";
  const bodyColor = isDark ? "var(--gris-300)" : "var(--gris-600)";
  const mutedColor = isDark ? "var(--gris-400)" : "var(--gris-500)";
  const btnSecondary = {
    background: isDark ? "rgba(17,17,17,0.88)" : "rgba(255,255,255,0.95)",
    border: "1px solid rgba(150,150,143,0.4)",
    color: isDark ? "var(--gris-200)" : "var(--gris-700)",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    padding: "7px 12px",
    cursor: "pointer",
  };

  const hasPrice = item.estimateValue && item.estimateValue > 0;
  const rangeMin = hasPrice ? Math.round(item.estimateValue * 0.93) : null;
  const rangeMax = hasPrice ? Math.round(item.estimateValue * 1.08) : null;
  const suggestedListingPrice = hasPrice ? Math.round(item.estimateValue * 1.05) : null;

  return (
    <div
      style={{
        background: cardBg,
        border: "1px solid rgba(150,150,143,0.26)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: titleColor }}>{item.title}</div>
          {item.meta ? (
            <div style={{ fontSize: 12, color: bodyColor, marginTop: 3 }}>{item.meta}</div>
          ) : null}
          {item.createdAt ? (
            <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>{formatDate(item.createdAt)}</div>
          ) : null}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.5px",
            background: "rgba(94,94,89,0.12)",
            border: "1px solid rgba(150,150,143,0.25)",
            color: "var(--gris-500)",
            borderRadius: 999,
            padding: "4px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {item.status}
        </span>
      </div>

      {/* Price block */}
      {hasPrice ? (
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-end",
            marginTop: 12,
            padding: "10px 12px",
            background: isDark ? "rgba(94,94,89,0.08)" : "rgba(94,94,89,0.05)",
            border: "1px solid rgba(150,150,143,0.2)",
            borderRadius: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: mutedColor, marginBottom: 2, letterSpacing: "0.4px" }}>{t("dashboard.valEstimatedPrice")}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: isDark ? "var(--gris-50)" : "var(--gris-900)", letterSpacing: "-0.04em" }}>
              {fmt(item.estimateValue)}€
            </div>
            <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>
              {t("dashboard.valRange", { min: fmt(rangeMin), max: fmt(rangeMax) })}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <div style={{ fontSize: 10, color: mutedColor, marginBottom: 4, letterSpacing: "0.4px" }}>{t("dashboard.valTrend")}</div>
            <TrendIndicator estimateValue={item.estimateValue} isDark={isDark} />
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button
          type="button"
          style={{ ...btnSecondary }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t("dashboard.valHideDetail") : t("dashboard.valViewDetail")}
        </button>
        <button type="button" style={{ ...btnSecondary }} onClick={() => onNavigate && onNavigate("saved")}>{t("dashboard.valComparables")}</button>
        <button
          type="button"
          style={{ ...btnSecondary, marginLeft: "auto" }}
          onClick={() => onRequestValuation && onRequestValuation({ vehicleTitle: item.title })}
        >
          {t("dashboard.valRepeat")}
        </button>
      </div>

      {/* Expanded strategy */}
      {expanded && hasPrice ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: isDark ? "rgba(17,17,17,0.5)" : "rgba(242,242,237,0.8)",
            border: "1px solid rgba(150,150,143,0.2)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: mutedColor, marginBottom: 6, letterSpacing: "0.4px" }}>
            {t("dashboard.valStrategySectionLabel")}
          </div>
          <div style={{ fontSize: 12, color: bodyColor, lineHeight: 1.65 }}>
            {t("dashboard.valStrategyText1")} <strong style={{ color: titleColor }}>{fmt(suggestedListingPrice)}€</strong> {t("dashboard.valStrategyText2")}{" "}
            <strong style={{ color: titleColor }}>{fmt(rangeMin)} – {fmt(rangeMax)}€</strong>.
            {t("dashboard.valStrategyText3")} <strong style={{ color: titleColor }}>Coches.net</strong>.
          </div>
        </div>
      ) : expanded && !hasPrice ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: isDark ? "rgba(17,17,17,0.5)" : "rgba(242,242,237,0.8)",
            border: "1px solid rgba(150,150,143,0.2)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 12, color: bodyColor }}>{item.meta || t("dashboard.valNoData")}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function UserDashboardValuations({
  themeMode,
  isMobile = false,
  dashboardValuations,
  panelStyle,
  getOfferBadgeStyle,
  onRequestValuation = () => {},
  onNavigate = () => {},
}) {
  const { t } = useTranslation();
  const isDark = themeMode === "dark";
  const titleColor = isDark ? "var(--gris-50)" : "var(--gris-900)";
  const bodyColor = isDark ? "var(--gris-300)" : "var(--gris-600)";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(17,17,17,0.9), rgba(31,31,29,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(242,242,237,0.92))";
  const sectionFrame = {
    background: isDark ? "rgba(5,5,5,0.34)" : "rgba(250,250,248,0.86)",
    border: isDark ? "1px solid rgba(150,150,143,0.22)" : "1px solid rgba(150,150,143,0.24)",
    borderRadius: 14,
    boxShadow: isDark ? "0 14px 26px rgba(5,5,5,0.28)" : "0 10px 20px rgba(17,17,17,0.06)",
  };

  return (
    <section id="user-dashboard-valuations" style={{ ...panelStyle, ...sectionFrame, marginBottom: 16 }}>
      {/* Section header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--gris-400)", letterSpacing: "0.6px" }}>{t("dashboard.valSectionLabel")}</div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: titleColor }}>
            {t("dashboard.valTitle")}
          </div>
          <div style={{ fontSize: 12, color: bodyColor, marginTop: 4 }}>
            {t("dashboard.valDesc")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ ...getOfferBadgeStyle("slate"), fontSize: 11 }}>
            {t("dashboard.valReport", { count: dashboardValuations.length })}
          </span>
          <button
            type="button"
            onClick={() => onNavigate("operations")}
            style={{
              background: "rgba(94,94,89,0.12)",
              border: "1px solid rgba(150,150,143,0.3)",
              color: "var(--gris-500)",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            {t("dashboard.valNewValuation")}
          </button>
        </div>
      </div>

      {/* Valuation cards */}
      {dashboardValuations.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {dashboardValuations.map((item) => (
            <ValuationCard
              key={item.id}
              item={item}
              isDark={isDark}
              cardBg={cardBg}
              onRequestValuation={onRequestValuation}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "28px 16px",
            color: isDark ? "var(--gris-400)" : "var(--gris-500)",
            fontSize: 13,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 6, color: titleColor }}>{t("dashboard.valEmptyTitle")}</div>
          <div style={{ fontSize: 12, marginBottom: 14 }}>
            {t("dashboard.valEmptyDesc")}
          </div>
          <button
            type="button"
            onClick={() => onNavigate("operations")}
            style={{
              background: "rgba(94,94,89,0.12)",
              border: "1px solid rgba(150,150,143,0.3)",
              color: "var(--gris-500)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              padding: "9px 16px",
              cursor: "pointer",
            }}
          >
            {t("dashboard.valFirstValuation")}
          </button>
        </div>
      )}
    </section>
  );
}
