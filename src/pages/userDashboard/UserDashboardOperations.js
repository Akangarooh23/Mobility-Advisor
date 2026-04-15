import { useEffect, useMemo, useState } from "react";

function inferAppointmentStage(item = {}) {
  const text = `${item?.status || ""} ${item?.meta || ""}`.toLowerCase();

  if (text.includes("cerrad") || text.includes("finaliz") || text.includes("complet")) {
    return "closed";
  }

  if (text.includes("en curso") || text.includes("proceso") || text.includes("hoy")) {
    return "active";
  }

  return "pending";
}

function inferValuationStage(item = {}) {
  const text = `${item?.status || ""} ${item?.meta || ""}`.toLowerCase();

  if (text.includes("activa") || text.includes("publicad") || text.includes("seguimiento")) {
    return "active";
  }

  if (text.includes("cerrad") || text.includes("vendid") || text.includes("finaliz")) {
    return "closed";
  }

  return "pending";
}

export default function UserDashboardOperations({
  themeMode,
  dashboardAppointments,
  dashboardValuations,
  panelStyle,
  getOfferBadgeStyle,
  onRequestAppointment,
  initialTab = "appointments",
}) {
  const isDark = themeMode === "dark";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";
  const panelBorder = isDark ? "1px solid rgba(148,163,184,0.26)" : "1px solid rgba(59,130,246,0.34)";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.24)" : "1px solid rgba(37,99,235,0.3)";

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const appointmentActions = [
    { key: "workshop", label: "🛠️ Taller" },
    { key: "maintenance", label: "🔧 Mantenimiento" },
    { key: "certification", label: "✅ Garantía / calidad" },
  ];
  const visibleTabOptions =
    initialTab === "appointments"
      ? [["appointments", "Citas"]]
      : initialTab === "valuations"
      ? [["valuations", "Tasaciones"]]
      : [
          ["appointments", "Citas"],
          ["valuations", "Tasaciones"],
          ["all", "Todo"],
        ];

  const operationRows = useMemo(() => {
    const appointmentRows = (dashboardAppointments || []).map((item) => ({
      ...item,
      itemType: "appointment",
      itemTypeLabel: "Cita",
      stage: inferAppointmentStage(item),
    }));

    const valuationRows = (dashboardValuations || []).map((item) => ({
      ...item,
      itemType: "valuation",
      itemTypeLabel: "Tasación",
      stage: inferValuationStage(item),
    }));

    return [...appointmentRows, ...valuationRows];
  }, [dashboardAppointments, dashboardValuations]);

  const filteredRows = operationRows.filter((item) => {
    if (activeTab === "all") {
      return true;
    }

    return activeTab === "appointments" ? item.itemType === "appointment" : item.itemType === "valuation";
  });

  const stageSummary = operationRows.reduce(
    (acc, item) => {
      acc[item.stage] += 1;
      return acc;
    },
    { pending: 0, active: 0, closed: 0 }
  );

  return (
    <section id="user-dashboard-operations" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: "0.6px" }}>OPERACIONES</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: titleColor }}>Workflow de citas y tasaciones</div>
          <div style={{ fontSize: 12, color: bodyColor, marginTop: 4 }}>
            Gestiona agenda técnica y valoración comercial en una única línea operativa.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...getOfferBadgeStyle("amber"), fontSize: 11 }}>{dashboardAppointments.length} citas</span>
          <span style={{ ...getOfferBadgeStyle("slate"), fontSize: 11 }}>{dashboardValuations.length} tasaciones</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 12 }}>
        {[
          ["Pendientes", stageSummary.pending, "#f59e0b"],
          ["En curso", stageSummary.active, "#2563eb"],
          ["Cerradas", stageSummary.closed, "#059669"],
        ].map(([label, value, color]) => (
          <div
            key={String(label)}
            style={{
              background: cardBg,
              border: panelBorder,
              borderRadius: 12,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: String(color) }}>{value}</div>
            <div style={{ fontSize: 12, color: bodyColor }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {visibleTabOptions.map(([tabKey, label]) => {
          const isActive = activeTab === tabKey;
          return (
            <button
              key={String(tabKey)}
              type="button"
              onClick={() => setActiveTab(String(tabKey))}
              style={{
                background: isActive ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "transparent",
                border: isActive ? "none" : cardBorder,
                color: isActive ? "#eff6ff" : isDark ? "#cbd5e1" : "#334155",
                padding: "7px 11px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {appointmentActions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onRequestAppointment(option.key)}
            style={{
              background: "rgba(245,158,11,0.18)",
              border: "1px solid rgba(251,191,36,0.22)",
              color: "#92400e",
              padding: "7px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredRows.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {filteredRows.map((item) => (
            <div
              key={`${item.itemType}-${item.id}`}
              style={{
                background: cardBg,
                border: panelBorder,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: titleColor }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: bodyColor, marginTop: 3 }}>{item.meta}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: item.stage === "closed" ? "#059669" : item.stage === "active" ? "#1d4ed8" : "#b45309",
                      marginTop: 3,
                    }}
                  >
                    {item.status}
                    {item.requestedAt ? ` · ${item.requestedAt}` : ""}
                  </div>
                </div>
                <span
                  style={{
                    background: "rgba(148,163,184,0.14)",
                    borderRadius: 999,
                    padding: "5px 9px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: isDark ? "#e2e8f0" : "#334155",
                  }}
                >
                  {item.itemTypeLabel}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          No hay operaciones en esta vista todavía. Cuando tengas actividad, aparecerá aquí.
        </div>
      )}
    </section>
  );
}
