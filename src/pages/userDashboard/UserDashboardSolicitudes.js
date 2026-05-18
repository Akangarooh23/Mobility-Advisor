export default function UserDashboardSolicitudes({
  themeMode,
  userSolicitudes = [],
  panelStyle,
  getOfferBadgeStyle,
}) {
  const isDark = themeMode === "dark";

  const TYPE_LABEL = {
    info:     "Solicitar info",
    visit:    "Agendar visita",
    question: "Preguntar",
  };
  const TYPE_COLOR = {
    info:     { bg: "rgba(59,130,246,0.12)", color: "#1d4ed8", border: "rgba(59,130,246,0.25)" },
    visit:    { bg: "rgba(16,185,129,0.12)", color: "#065f46", border: "rgba(16,185,129,0.25)" },
    question: { bg: "rgba(139,92,246,0.12)", color: "#5b21b6", border: "rgba(139,92,246,0.25)" },
  };
  const STATUS_COLOR = {
    Pendiente:    { bg: "rgba(245,158,11,0.12)",  color: "#92400e" },
    Contactado:   { bg: "rgba(59,130,246,0.12)",  color: "#1d4ed8" },
    "En proceso": { bg: "rgba(139,92,246,0.12)",  color: "#5b21b6" },
    Cerrado:      { bg: "rgba(16,185,129,0.12)",  color: "#065f46" },
    Descartado:   { bg: "rgba(100,116,139,0.10)", color: "#475569" },
  };

  function parseMeta(raw) {
    try { return JSON.parse(raw || "{}"); } catch { return {}; }
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return iso; }
  }

  function formatAppointmentDate(dateStr) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } catch { return dateStr; }
  }

  return (
    <section style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "#3b82f6", letterSpacing: "0.6px", fontWeight: 700, textTransform: "uppercase" }}>Mis solicitudes</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>Solicitudes de vehículos</div>
          <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", marginTop: 2 }}>Información, visitas y consultas sobre coches que te han interesado</div>
        </div>
        <span style={{ ...getOfferBadgeStyle("blue"), fontSize: 11 }}>{userSolicitudes.length} solicitud{userSolicitudes.length !== 1 ? "es" : ""}</span>
      </div>

      {userSolicitudes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: isDark ? "#64748b" : "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: isDark ? "#94a3b8" : "#64748b" }}>Sin solicitudes aún</div>
          <div style={{ fontSize: 12 }}>Cuando solicites información o visita para un vehículo aparecerá aquí.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {userSolicitudes.map((item) => {
            const meta = parseMeta(item.meta);
            const typeStyle = TYPE_COLOR[item.type] || TYPE_COLOR.info;
            const statusStyle = STATUS_COLOR[item.status] || { bg: "rgba(100,116,139,0.10)", color: "#475569" };
            const hasResponse = meta.erp_response || meta.appointment_date;
            const isVisit = item.type === "visit";

            return (
              <div
                key={item.id}
                style={{
                  background: isDark ? "rgba(15,23,42,0.7)" : "#ffffff",
                  border: `1px solid ${hasResponse ? (isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe") : (isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0")}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", alignItems: "start" }}>
                  <div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{
                        display: "inline-block", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                        background: typeStyle.bg, color: typeStyle.color, border: `1px solid ${typeStyle.border}`,
                      }}>
                        {TYPE_LABEL[item.type] || item.type}
                      </span>
                      <span style={{
                        display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                        background: statusStyle.bg, color: statusStyle.color,
                      }}>
                        {item.status || "Pendiente"}
                      </span>
                      {meta.notified_at && (
                        <span style={{
                          display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                          background: "rgba(16,185,129,0.12)", color: "#065f46",
                        }}>
                          ✓ Respondido
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 3 }}>
                      {item.title || "Vehículo"}
                    </div>
                    {meta.vehicle_url && (
                      <a href={meta.vehicle_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none" }}>
                        Ver anuncio →
                      </a>
                    )}
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 11, color: isDark ? "#64748b" : "#94a3b8" }}>{formatDate(item.createdAt)}</div>
                    {meta.portal && (
                      <div style={{ fontSize: 10, color: isDark ? "#475569" : "#cbd5e1", marginTop: 2, textTransform: "capitalize" }}>{meta.portal}</div>
                    )}
                  </div>
                </div>

                {/* Respuesta / Cita confirmada */}
                {hasResponse && (
                  <div style={{
                    background: isDark ? "rgba(37,99,235,0.12)" : "#eff6ff",
                    border: `1px solid ${isDark ? "rgba(59,130,246,0.25)" : "#bfdbfe"}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                  }}>
                    {isVisit && meta.appointment_date ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", marginBottom: 6 }}>
                          ✅ Cita confirmada
                        </div>
                        <div style={{ fontSize: 13, color: isDark ? "#bfdbfe" : "#1e40af", display: "grid", gap: 3 }}>
                          <div>📅 {formatAppointmentDate(meta.appointment_date)}</div>
                          {meta.appointment_time && <div>⏰ {meta.appointment_time}</div>}
                          {meta.appointment_address && <div>📍 {meta.appointment_address}</div>}
                          {meta.appointment_contact && <div>👤 Pregunta por <strong>{meta.appointment_contact}</strong></div>}
                        </div>
                        {meta.erp_response && (
                          <div style={{ marginTop: 8, fontSize: 12, color: isDark ? "#93c5fd" : "#1e40af", borderTop: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, paddingTop: 8 }}>
                            {meta.erp_response}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", marginBottom: 4 }}>
                          💬 Respuesta de CarsWise
                        </div>
                        <div style={{ fontSize: 13, color: isDark ? "#bfdbfe" : "#1e40af", whiteSpace: "pre-wrap" }}>
                          {meta.erp_response}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
