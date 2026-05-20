import { useTranslation } from "react-i18next";

const TYPE_ICON = {
  maintenance: "🔧",
  insurance:   "🛡️",
  suggestion:  "💡",
};

const CALENDAR_STATUS_COLOR = {
  Pendiente: { bg: "rgba(245,158,11,0.10)", color: "#92400e" },
  Activo:    { bg: "rgba(16,185,129,0.10)",  color: "#065f46" },
  Vencido:   { bg: "rgba(239,68,68,0.10)",   color: "#b91c1c" },
};

export default function UserDashboardAppointments({
  themeMode,
  dashboardAppointments,
  panelStyle,
  getOfferBadgeStyle,
  onRequestAppointment,
}) {
  const { t } = useTranslation();
  const isDark = themeMode === "dark";

  const bookings  = (dashboardAppointments || []).filter((a) => a.source === "booking");
  const reminders = (dashboardAppointments || []).filter((a) => a.source === "calendar" || a.source === "suggestion");

  function parseAppointmentMeta(meta = "") {
    const rawParts = String(meta || "").split(" · ").map((p) => p.trim()).filter(Boolean);
    const addressPart  = rawParts.find((p) => p.startsWith("Direccion:")) || "";
    const detailParts  = rawParts.filter((p) => p.startsWith("Taller:") || p.startsWith("Distancia:") || p.startsWith("Proveedor:"));
    const compactDetails = detailParts
      .map((p) => p.replace(/^Taller:\s*/, "").replace(/^Distancia:\s*/, "").replace(/^Proveedor:\s*/, ""))
      .join(" · ");
    const summary = rawParts.filter((p) => !detailParts.includes(p)).join(" · ");
    return { summary, details: compactDetails, address: addressPart.replace(/^Direccion:\s*/, "") };
  }

  const appointmentActions = [
    { key: "workshop",      label: t("dashboard.apptWorkshop") },
    { key: "maintenance",   label: t("dashboard.apptMaintenance") },
    { key: "insurance",     label: t("dashboard.apptInsurance") },
    { key: "certification", label: t("dashboard.apptCertification") },
  ];

  const cardBg = isDark
    ? "linear-gradient(160deg,rgba(15,23,42,0.9),rgba(30,41,59,0.82))"
    : "linear-gradient(160deg,rgba(255,255,255,0.96),rgba(241,245,249,0.92))";

  return (
    <section id="user-dashboard-appointments" style={{ ...panelStyle, marginBottom: 16 }}>

      {/* ── Mis citas (bookings reales) ───────────────────────────────────── */}
      <div style={{ marginBottom: reminders.length ? 24 : 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: "#fbbf24", letterSpacing: "0.6px", fontWeight: 700, textTransform: "uppercase" }}>
              {t("dashboard.apptSectionLabel")}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>
              {t("dashboard.apptTitle")}
            </div>
            <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", marginTop: 2 }}>
              Citas solicitadas a talleres y servicios
            </div>
          </div>
          <span style={{ ...getOfferBadgeStyle("amber"), fontSize: 11 }}>
            {t("dashboard.apptActive", { count: bookings.length })}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {appointmentActions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onRequestAppointment(option.key)}
              style={{
                background: "rgba(245,158,11,0.18)", border: "1px solid rgba(251,191,36,0.22)",
                color: "#92400e", padding: "7px 10px", borderRadius: 999,
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {bookings.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            {bookings.map((item) => {
              const parsed = parseAppointmentMeta(item.meta);
              return (
                <div key={item.id} style={{ background: cardBg, border: "1px solid rgba(148,163,184,0.26)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a" }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#475569", marginTop: 3 }}>{parsed.summary}</div>
                  {parsed.details && (
                    <div style={{ fontSize: 11, color: isDark ? "#93c5fd" : "#1d4ed8", marginTop: 4, fontWeight: 700 }}>
                      {t("dashboard.apptWorkshopMeta")}{parsed.details}
                    </div>
                  )}
                  {parsed.address && (
                    <div style={{ fontSize: 11, color: isDark ? "#cbd5e1" : "#334155", marginTop: 2 }}>
                      {t("dashboard.apptAddressMeta")}{parsed.address}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#b45309", marginTop: 3 }}>
                    {item.status}{item.requestedAt ? ` · ${item.requestedAt}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "1.5rem 1rem", background: isDark ? "rgba(255,255,255,0.03)" : "#fafafa", borderRadius: 10, border: `1px dashed ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}` }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🔧</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#94a3b8" : "#64748b" }}>Sin citas solicitadas</div>
            <div style={{ fontSize: 12, color: isDark ? "#64748b" : "#94a3b8", marginTop: 2 }}>
              Usa los botones de arriba para pedir cita en un taller o servicio.
            </div>
          </div>
        )}
      </div>

      {/* ── Avisos del calendario inteligente ────────────────────────────── */}
      {reminders.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0" }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", color: isDark ? "#64748b" : "#94a3b8", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              📅 Avisos del calendario
            </div>
            <div style={{ flex: 1, height: 1, background: isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0" }} />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {reminders.map((item) => {
              const icon = TYPE_ICON[item.type] || TYPE_ICON[item.source] || "📋";
              const statusStyle = CALENDAR_STATUS_COLOR[item.status] || { bg: "rgba(100,116,139,0.10)", color: "#475569" };
              return (
                <div
                  key={item.id}
                  style={{
                    background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0"}`,
                    borderRadius: 10, padding: "10px 14px",
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1.4, flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#f1f5f9" : "#1e293b" }}>{item.title}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: statusStyle.bg, color: statusStyle.color, whiteSpace: "nowrap" }}>
                        {item.status}
                      </span>
                    </div>
                    {item.meta && (
                      <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", marginTop: 2 }}>{item.meta}</div>
                    )}
                    {item.requestedAt && (
                      <div style={{ fontSize: 11, color: isDark ? "#64748b" : "#94a3b8", marginTop: 2 }}>{item.requestedAt}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
