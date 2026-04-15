export default function UserDashboardHome({
  themeMode,
  counts,
  sections,
  panelStyle,
  newAlertMatchesCount = 0,
  pendingAlertNotifications = [],
  emailDigestFeedback = "",
  emailDigestLoading = false,
  onNavigate,
  onMarkAllAlertsSeen = () => {},
  onSendAlertEmailDigest = () => {},
}) {
  const isDark = themeMode === "dark";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";

  const stats = [
    { label: "Guardadas", value: counts.saved, color: "#60a5fa" },
    { label: "Citas", value: counts.appointments, color: "#fbbf24" },
    { label: "Tasaciones", value: counts.valuations, color: "#c084fc" },
    { label: "Vehículos", value: counts.vehicles, color: "#34d399" },
  ];
  const emailTargets = Array.from(
    new Set(
      pendingAlertNotifications
        .filter((notice) => notice.notifyByEmail && notice.email)
        .map((notice) => notice.email)
    )
  );

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
        {stats.map((item) => (
          <div
            key={item.label}
            style={{
              background: cardBg,
              border: "1px solid rgba(148,163,184,0.26)",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155", marginTop: 4 }}>{item.label}</div>
            {item.label === "Guardadas" && newAlertMatchesCount > 0 && (
              <div style={{ fontSize: 11, color: "#047857", marginTop: 6, fontWeight: 700 }}>
                🔔 {newAlertMatchesCount} novedades
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          ...panelStyle,
          marginBottom: 18,
          background: isDark
            ? "linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.9))"
            : "linear-gradient(135deg,rgba(16,185,129,0.10),rgba(255,255,255,0.96))",
          border: "1px solid rgba(148,163,184,0.26)",
        }}
      >
        <div style={{ fontSize: 11, color: "#047857", letterSpacing: "0.6px", marginBottom: 8 }}>
          BANDEJA DE AVISOS
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>🔔 Mercado bajo vigilancia</div>
            <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#334155", marginTop: 4, lineHeight: 1.6 }}>
              {pendingAlertNotifications.length > 0
                ? `Tienes ${newAlertMatchesCount} ${newAlertMatchesCount === 1 ? "novedad pendiente" : "novedades pendientes"} en tus alertas.`
                : "No hay avisos nuevos ahora mismo. Tus alertas siguen vigilando el mercado por ti."}
            </div>
            {emailTargets.length > 0 && (
              <div style={{ fontSize: 11, color: "#1d4ed8", marginTop: 6 }}>
                📧 Resumen por email a {emailTargets.join(", ")}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => onNavigate("saved")}
              style={{
                background: "rgba(37,99,235,0.10)",
                border: "1px solid rgba(96,165,250,0.28)",
                color: "#1e3a8a",
                padding: "9px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Abrir alertas
            </button>
            {emailTargets.length > 0 && (
              <button
                type="button"
                onClick={onSendAlertEmailDigest}
                disabled={emailDigestLoading}
                style={{
                  background: "rgba(99,102,241,0.16)",
                  border: "1px solid rgba(165,180,252,0.24)",
                  color: "#3730a3",
                  padding: "9px 12px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: emailDigestLoading ? "progress" : "pointer",
                  opacity: emailDigestLoading ? 0.75 : 1,
                }}
              >
                {emailDigestLoading ? "Enviando…" : "Enviar resumen por email"}
              </button>
            )}
            {pendingAlertNotifications.length > 0 && (
              <button
                type="button"
                onClick={onMarkAllAlertsSeen}
                style={{
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(251,191,36,0.2)",
                  color: "#92400e",
                  padding: "9px 12px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Marcar todo como revisado
              </button>
            )}
          </div>
        </div>

        {emailDigestFeedback && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>
            {emailDigestFeedback}
          </div>
        )}

        {pendingAlertNotifications.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {pendingAlertNotifications.slice(0, 3).map((notice) => (
              <div
                key={notice.id}
                style={{
                  background: isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.95)",
                  border: "1px solid rgba(148,163,184,0.24)",
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a" }}>{notice.title}</div>
                <div style={{ fontSize: 11, color: isDark ? "#cbd5e1" : "#475569", marginTop: 4 }}>{notice.summary}</div>
                {notice.notifyByEmail && notice.email && (
                  <div style={{ fontSize: 11, color: "#1d4ed8", marginTop: 4 }}>📧 {notice.email}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        {sections
          .filter((section) => section.key !== "home")
          .map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => onNavigate(section.key)}
              style={{
                ...panelStyle,
                textAlign: "left",
                cursor: "pointer",
                background: cardBg,
                border: "1px solid rgba(148,163,184,0.26)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>
                  {section.icon} {section.label}
                </div>
                <span style={{ fontSize: 11, color: "#1d4ed8" }}>{section.count}</span>
              </div>
              <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#475569", lineHeight: 1.6 }}>
                {section.description}
              </div>
              {section.notice && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#047857", fontWeight: 700 }}>
                  {section.notice}
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>
                Abrir sección →
              </div>
            </button>
          ))}
      </div>
    </>
  );
}
