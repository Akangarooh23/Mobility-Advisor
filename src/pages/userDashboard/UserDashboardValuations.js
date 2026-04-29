import { useState } from "react";

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
      <span style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#64748b" }}>últimos 30 días</span>
    </div>
  );
}

function ValuationCard({ item, isDark, cardBg, onRequestValuation, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";
  const mutedColor = isDark ? "#94a3b8" : "#64748b";
  const btnSecondary = {
    background: isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.95)",
    border: "1px solid rgba(148,163,184,0.4)",
    color: isDark ? "#e2e8f0" : "#334155",
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
        border: "1px solid rgba(148,163,184,0.26)",
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
            background: "rgba(124,58,237,0.12)",
            border: "1px solid rgba(167,139,250,0.25)",
            color: "#7c3aed",
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
            background: isDark ? "rgba(124,58,237,0.08)" : "rgba(124,58,237,0.05)",
            border: "1px solid rgba(167,139,250,0.2)",
            borderRadius: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: mutedColor, marginBottom: 2, letterSpacing: "0.4px" }}>PRECIO ESTIMADO</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", letterSpacing: "-0.04em" }}>
              {fmt(item.estimateValue)}€
            </div>
            <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>
              Rango: {fmt(rangeMin)} – {fmt(rangeMax)}€
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <div style={{ fontSize: 10, color: mutedColor, marginBottom: 4, letterSpacing: "0.4px" }}>TENDENCIA</div>
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
          {expanded ? "Ocultar detalle" : "Ver detalle"}
        </button>
        <button type="button" style={{ ...btnSecondary }} onClick={() => onNavigate && onNavigate("saved")}>Ver comparables</button>
        <button
          type="button"
          style={{ ...btnSecondary, marginLeft: "auto" }}
          onClick={() => onRequestValuation && onRequestValuation({ vehicleTitle: item.title })}
        >
          Repetir valoración
        </button>
      </div>

      {/* Expanded strategy */}
      {expanded && hasPrice ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: isDark ? "rgba(15,23,42,0.5)" : "rgba(241,245,249,0.8)",
            border: "1px solid rgba(148,163,184,0.2)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: mutedColor, marginBottom: 6, letterSpacing: "0.4px" }}>
            ESTRATEGIA DE VENTA SUGERIDA
          </div>
          <div style={{ fontSize: 12, color: bodyColor, lineHeight: 1.65 }}>
            Publica a <strong style={{ color: titleColor }}>{fmt(suggestedListingPrice)}€</strong> y ajusta 500€ cada semana
            si no recibes contactos. Rango de negociación estimado:{" "}
            <strong style={{ color: titleColor }}>{fmt(rangeMin)} – {fmt(rangeMax)}€</strong>.
            Mejor canal para tu segmento de precio: <strong style={{ color: titleColor }}>Coches.net</strong>.
          </div>
        </div>
      ) : expanded && !hasPrice ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: isDark ? "rgba(15,23,42,0.5)" : "rgba(241,245,249,0.8)",
            border: "1px solid rgba(148,163,184,0.2)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 12, color: bodyColor }}>{item.meta || "Sin datos adicionales para este informe."}</div>
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
  const isDark = themeMode === "dark";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";
  const sectionFrame = {
    background: isDark ? "rgba(2,6,23,0.34)" : "rgba(248,250,252,0.86)",
    border: isDark ? "1px solid rgba(148,163,184,0.22)" : "1px solid rgba(148,163,184,0.24)",
    borderRadius: 14,
    boxShadow: isDark ? "0 14px 26px rgba(2,6,23,0.28)" : "0 10px 20px rgba(15,23,42,0.06)",
  };

  return (
    <section id="user-dashboard-valuations" style={{ ...panelStyle, ...sectionFrame, marginBottom: 16 }}>
      {/* Section header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "#c084fc", letterSpacing: "0.6px" }}>MIS TASACIONES</div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: titleColor }}>
            Valoraciones e informes guardados
          </div>
          <div style={{ fontSize: 12, color: bodyColor, marginTop: 4 }}>
            Historial de tasaciones, precios estimados y estrategias de venta.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ ...getOfferBadgeStyle("slate"), fontSize: 11 }}>
            {dashboardValuations.length} {dashboardValuations.length === 1 ? "informe" : "informes"}
          </span>
          <button
            type="button"
            onClick={() => onNavigate("operations")}
            style={{
              background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(167,139,250,0.3)",
              color: "#7c3aed",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            + Nueva valoración
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
            color: isDark ? "#94a3b8" : "#64748b",
            fontSize: 13,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 6, color: titleColor }}>Sin valoraciones aún</div>
          <div style={{ fontSize: 12, marginBottom: 14 }}>
            Tasa tu coche para conocer su precio de mercado actual y la estrategia de venta óptima.
          </div>
          <button
            type="button"
            onClick={() => onNavigate("operations")}
            style={{
              background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(167,139,250,0.3)",
              color: "#7c3aed",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              padding: "9px 16px",
              cursor: "pointer",
            }}
          >
            Hacer mi primera valoración →
          </button>
        </div>
      )}
    </section>
  );
}
