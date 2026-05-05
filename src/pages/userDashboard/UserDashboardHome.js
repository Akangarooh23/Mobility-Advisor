import { useTranslation } from "react-i18next";

function buildActivityLog(pendingAlertNotifications, counts, t) {
  const log = [];
  pendingAlertNotifications.forEach((n) => {
    log.push({
      id: `alert-${n.id}`,
      icon: "🔔",
      label: t("dashboard.homeActivityAlertLabel", {
        title: n.title || t("dashboard.homeActivityAlertDefault"),
      }),
      detail: n.summary || "",
      section: "alerts",
      type: "alert",
    });
  });
  if (counts.vehicles > 0) {
    log.push({
      id: "act-garage",
      icon: "🚗",
      label: t("dashboard.homeActivityGarageLabel", { count: counts.vehicles }),
      detail: t("dashboard.homeActivityGarageDetail"),
      section: "vehicles",
      type: "garage",
    });
  }
  if (counts.valuations > 0) {
    log.push({
      id: "act-val",
      icon: "📋",
      label: t("dashboard.homeActivityValuationLabel", { count: counts.valuations }),
      detail: t("dashboard.homeActivityValuationDetail"),
      section: "valuations",
      type: "valuation",
    });
  }
  if (counts.saved > 0) {
    log.push({
      id: "act-saved",
      icon: "📌",
      label: t("dashboard.homeActivitySavedLabel", { count: counts.saved }),
      detail: t("dashboard.homeActivitySavedDetail"),
      section: "saved",
      type: "saved",
    });
  }
  return log.slice(0, 6);
}

function ActivityLog({ isDark, isMobile, panelStyle, cardBg, cardBorder, titleText, mutedText, pendingAlertNotifications, counts, onNavigate }) {
  const { t } = useTranslation();
  const entries = buildActivityLog(pendingAlertNotifications, counts, t);
  if (entries.length === 0) return null;

  const typeColor = {
    alert: "#2563eb",
    garage: "#0f766e",
    valuation: "#7c3aed",
    saved: "#d97706",
  };

  return (
    <div
      style={{
        ...panelStyle,
        marginBottom: 8,
        background: cardBg,
        border: cardBorder,
        borderRadius: 14,
        marginTop: 8,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#e2e8f0" : "#334155", marginBottom: 10, letterSpacing: "0.02em" }}>
        {t("dashboard.homeActivityTitle")}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onNavigate(entry.section)}
            style={{
              display: "grid",
              gridTemplateColumns: "30px minmax(0,1fr)",
              gap: 10,
              alignItems: "center",
              background: isDark ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.80)",
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 10,
              padding: "9px 10px",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            }}
          >
            <span
              style={{
                fontSize: 15,
                width: 30,
                height: 30,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                background: `${typeColor[entry.type] || "#64748b"}18`,
              }}
            >
              {entry.icon}
            </span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: titleText, lineHeight: 1.4 }}>{entry.label}</div>
              {entry.detail ? (
                <div style={{ fontSize: 11, color: mutedText, marginTop: 2 }}>{entry.detail}</div>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function UserDashboardHome({
  themeMode,
  isMobile = false,
  currentUser,
  counts,
  panelStyle,
  newAlertMatchesCount = 0,
  pendingAlertNotifications = [],
  emailDigestFeedback = "",
  emailDigestLoading = false,
  onNavigate,
  onMarkAllAlertsSeen = () => {},
  onSendAlertEmailDigest = () => {},
}) {
  const { t } = useTranslation();
  const isDark = themeMode === "dark";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.24)" : "1px solid rgba(37,99,235,0.3)";
  const titleText = isDark ? "#f8fafc" : "#0f172a";
  const mutedText = isDark ? "#cbd5e1" : "#475569";

  const stats = [
    { label: t("dashboard.homeStatAlerts"), value: counts.alerts, color: "#2563eb", key: "alerts" },
    { label: t("dashboard.homeStatValuations"), value: counts.valuations, color: "#7c3aed", key: "valuations" },
    { label: t("dashboard.homeStatVehicles"), value: counts.vehicles, color: "#0f766e", key: "vehicles" },
  ];
  const emailTargets = Array.from(
    new Set(
      pendingAlertNotifications
        .filter((notice) => notice.notifyByEmail && notice.email)
        .map((notice) => notice.email)
    )
  );

  const latestNotices = pendingAlertNotifications.slice(0, 3);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
        {stats.map((item) => (
          <div
            key={item.key}
            style={{
              background: isDark ? "rgba(15,23,42,0.88)" : "rgba(241,245,249,0.8)",
              border: cardBorder,
              borderRadius: 12,
              padding: isMobile ? 12 : 16,
              boxShadow: isDark
                ? "0 12px 20px rgba(2,6,23,0.3)"
                : "0 8px 16px rgba(15,23,42,0.07)",
            }}
          >
            <div style={{ fontSize: isMobile ? 30 : 34, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", letterSpacing: "-0.04em", lineHeight: 1 }}>
              {item.value}
            </div>
            <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#475569", marginTop: 8 }}>{item.label}</div>
            {item.key === "alerts" && newAlertMatchesCount > 0 && (
              <div style={{ fontSize: 11, color: "#047857", marginTop: 6, fontWeight: 700 }}>
                {t("dashboard.homeNewMatches", { count: newAlertMatchesCount })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          ...panelStyle,
          marginBottom: 8,
          background: cardBg,
          border: cardBorder,
          borderRadius: 14,
          boxShadow: isDark
            ? "0 16px 24px rgba(2,6,23,0.3)"
            : "0 10px 20px rgba(15,23,42,0.08)",
        }}
      >
        <div style={{ fontSize: 13, color: isDark ? "#e2e8f0" : "#334155", letterSpacing: "0.02em", marginBottom: 10, fontWeight: 700 }}>
          {t("dashboard.homeNewsTitle")}
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {latestNotices.length === 0 && (
            <div
              style={{
                background: isDark ? "rgba(15,23,42,0.84)" : "rgba(255,255,255,0.95)",
                border: cardBorder,
                borderRadius: 12,
                padding: 12,
                fontSize: 12,
                color: mutedText,
              }}
            >
              {t("dashboard.homeAllGood", { name: currentUser?.name || "usuario" })}
            </div>
          )}

          {latestNotices.map((notice, index) => {
            const icon = index === 0 ? "🔔" : index === 1 ? "📅" : "✅";
            const actionLabel = index === 0 ? t("dashboard.homeViewOffer") : index === 1 ? t("dashboard.homeBook") : t("dashboard.homeViewAnalysis");

            return (
              <div
                key={notice.id}
                style={{
                  background: isDark ? "rgba(15,23,42,0.90)" : "rgba(255,255,255,0.96)",
                  border: cardBorder,
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "34px minmax(0,1fr) auto",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 14,
                    background: isDark ? "rgba(59,130,246,0.18)" : "rgba(219,234,254,0.92)",
                  }}
                >
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: titleText }}>{notice.title}</div>
                  <div style={{ fontSize: 12, color: mutedText, marginTop: 2 }}>{notice.summary}</div>
                  {notice.notifyByEmail && notice.email && (
                    <div style={{ fontSize: 11, color: "#1d4ed8", marginTop: 4 }}>📧 {notice.email}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("saved")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    justifySelf: isMobile ? "start" : "end",
                    padding: 0,
                  }}
                >
                  {actionLabel}
                </button>
              </div>
            );
          })}
        </div>

        {emailDigestFeedback && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>
            {emailDigestFeedback}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
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
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("dashboard.homeOpenAlerts")}
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
                fontWeight: 700,
                cursor: emailDigestLoading ? "progress" : "pointer",
                opacity: emailDigestLoading ? 0.75 : 1,
              }}
            >
              {emailDigestLoading ? t("dashboard.homeSending") : t("dashboard.homeSendEmail")}
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
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("dashboard.homeMarkReviewed")}
            </button>
          )}
        </div>
      </div>

      {/* Actividad reciente */}
      <ActivityLog
        isDark={isDark}
        isMobile={isMobile}
        panelStyle={panelStyle}
        cardBg={cardBg}
        cardBorder={cardBorder}
        titleText={titleText}
        mutedText={mutedText}
        pendingAlertNotifications={pendingAlertNotifications}
        counts={counts}
        onNavigate={onNavigate}
      />
    </>
  );
}
