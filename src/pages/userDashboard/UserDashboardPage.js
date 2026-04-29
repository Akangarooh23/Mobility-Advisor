import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import UserDashboardBilling from "./UserDashboardBilling";
import UserDashboardAlerts from "./UserDashboardAlerts";
import UserDashboardHome from "./UserDashboardHome";
import UserDashboardOperations from "./UserDashboardOperations";
import UserDashboardPreferences from "./UserDashboardPreferences";
import UserDashboardSaved from "./UserDashboardSaved";
import UserDashboardValuations from "./UserDashboardValuations";
import UserDashboardVehicles from "./UserDashboardVehicles";
import { getGarageVehiclesJson } from "../../utils/apiClient";

const GARAGE_STORAGE_PREFIX = "movilidad-advisor.userGarage.v1";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getGarageStorageKey(currentUserEmail = "") {
  const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
  return normalizedEmail ? `${GARAGE_STORAGE_PREFIX}.${normalizedEmail}` : GARAGE_STORAGE_PREFIX;
}

function readGarageVehiclesCount(currentUserEmail = "") {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const raw = window.localStorage.getItem(getGarageStorageKey(currentUserEmail));
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id).length : 0;
  } catch {
    return 0;
  }
}

function buildSections(counts, t, newAlertMatchesCount = 0) {
  return [
    {
      key: "home",
      label: t("dashboardPage.homeLabel"),
      icon: "⌂",
      count: null,
      title: t("dashboardPage.homeTitle"),
      description: t("dashboardPage.homeDescription"),
    },
    {
      key: "saved",
      label: t("dashboardPage.savedLabel"),
      icon: "⭐",
      count: counts.saved,
      title: t("dashboardPage.savedTitle"),
      description: t("dashboardPage.savedDescription"),
      notice: newAlertMatchesCount > 0 ? t("dashboardPage.newAlertsNotice", { count: newAlertMatchesCount }) : null,
    },
    {
      key: "alerts",
      label: t("dashboardPage.alertsLabel", { defaultValue: "Alertas" }),
      icon: "🔔",
      count: counts.alerts,
      title: t("dashboardPage.alertsTitle", { defaultValue: "Alertas de mercado" }),
      description: t("dashboardPage.alertsDescription", {
        defaultValue: "Controla tus alertas y revisa coincidencias nuevas en el marketplace.",
      }),
    },
    {
      key: "appointments",
      label: t("dashboardPage.appointmentsLabel"),
      icon: "🛠️",
      count: counts.appointments,
      title: t("dashboardPage.appointmentsTitle"),
      description: t("dashboardPage.appointmentsDescription"),
    },
    {
      key: "valuations",
      label: t("dashboardPage.valuationsLabel"),
      icon: "💶",
      count: counts.valuations,
      title: t("dashboardPage.valuationsTitle"),
      description: t("dashboardPage.valuationsDescription"),
    },
    {
      key: "billing",
      label: t("dashboardPage.billingLabel"),
      icon: "💳",
      count: null,
      title: t("dashboardPage.billingTitle"),
      description: t("dashboardPage.billingDescription"),
    },
    {
      key: "preferences",
      label: t("dashboardPage.preferencesLabel", { defaultValue: "Preferencias" }),
      icon: "⚙️",
      count: null,
      title: t("dashboardPage.preferencesTitle", { defaultValue: "Preferencias de cuenta" }),
      description: t("dashboardPage.preferencesDescription", {
        defaultValue: "Configura idioma, region y avisos del panel.",
      }),
    },
    {
      key: "vehicles",
      label: t("dashboardPage.vehiclesLabel"),
      icon: "🚗",
      count: counts.vehicles,
      title: t("dashboardPage.vehiclesTitle"),
      description: t("dashboardPage.vehiclesDescription"),
    },
  ];
}

export default function UserDashboardPage({
  themeMode,
  centerStyle,
  blockBadgeStyle,
  panelStyle,
  userDashboardPage,
  savedComparisons,
  marketAlerts,
  marketAlertStatus,
  currentUser,
  marketAlertMatches,
  newAlertMatchesCount,
  pendingAlertNotifications,
  emailDigestFeedback,
  emailDigestLoading,
  dashboardAppointments,
  dashboardValuations,
  userVehicleSections,
  onNavigate,
  onRestart,
  onLogout,
  onRequestAppointment,
  onUpdateAppointmentStatus = () => {},
  onRequestValuation = () => {},
  onOpenOffer,
  onOpenMarketplaceOffer,
  onRemoveSavedComparison,
  onCreateMarketAlert,
  onRemoveMarketAlert,
  onMarkAlertSeen,
  onMarkAllAlertsSeen,
  onSendAlertEmailDigest,
  onBrowseMarketplace,
  getOfferBadgeStyle,
  formatCurrency,
  getSavedComparisonHref,
}) {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.innerWidth < 900;
  });
  const [garageVehicleCount, setGarageVehicleCount] = useState(() => readGarageVehiclesCount(currentUser?.email || ""));

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth < 900);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let disposed = false;
    const currentUserEmail = normalizeText(currentUser?.email).toLowerCase();

    const refreshGarageCount = async () => {
      setGarageVehicleCount(readGarageVehiclesCount(currentUserEmail));

      if (!currentUserEmail) {
        return;
      }

      try {
        const { response, data } = await getGarageVehiclesJson(currentUserEmail);

        if (!response.ok) {
          return;
        }

        if (!disposed) {
          const count = Array.isArray(data?.vehicles) ? data.vehicles.length : 0;
          setGarageVehicleCount(count);
        }
      } catch {
        // Keep localStorage fallback when API is unavailable.
      }
    };

    void refreshGarageCount();

    const storageListener = (event) => {
      if (!event?.key || event.key === getGarageStorageKey(currentUserEmail)) {
        setGarageVehicleCount(readGarageVehiclesCount(currentUserEmail));
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", storageListener);
    }

    return () => {
      disposed = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", storageListener);
      }
    };
  }, [currentUser?.email]);

  const isDark = themeMode === "dark";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";
  const shellBorder = isDark ? "1px solid rgba(148,163,184,0.24)" : "1px solid rgba(148,163,184,0.26)";
  const shellBackground = isDark
    ? "linear-gradient(160deg, rgba(8,15,30,0.98), rgba(15,23,42,0.94))"
    : "linear-gradient(160deg, rgba(255,255,255,0.99), rgba(248,250,252,0.96))";
  const sectionShell = {
    ...panelStyle,
    border: shellBorder,
    borderRadius: 18,
    boxShadow: isDark
      ? "0 24px 44px rgba(2,6,23,0.42)"
      : "0 16px 34px rgba(15,23,42,0.10)",
    backdropFilter: "blur(8px)",
  };
  const dashboardVehicleCount = userVehicleSections.reduce((acc, section) => acc + section.items.length, 0);
  const totalVehiclesCount = dashboardVehicleCount + garageVehicleCount;
  const counts = {
    saved: savedComparisons.length + (Array.isArray(marketAlerts) ? marketAlerts.length : 0),
    alerts: Array.isArray(marketAlerts) ? marketAlerts.length : 0,
    appointments: dashboardAppointments.length,
    valuations: dashboardValuations.length,
    vehicles: totalVehiclesCount,
  };
  const sections = buildSections(counts, t, newAlertMatchesCount);
  const navMain = ["home", "saved", "alerts", "vehicles", "valuations", "appointments"];
  const navAccount = ["billing", "preferences"];
  const navSectionsMain = sections.filter((section) => navMain.includes(section.key));
  const navSectionsAccount = sections.filter((section) => navAccount.includes(section.key));

  const renderNavItem = (section) => {
    const isActive = userDashboardPage === section.key;
    return (
      <button
        key={`side-nav-${section.key}`}
        type="button"
        onClick={() => onNavigate(section.key)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 10,
          border: isActive
            ? "1px solid rgba(59,130,246,0.40)"
            : (isDark ? "1px solid rgba(148,163,184,0.14)" : "1px solid rgba(148,163,184,0.24)"),
          background: isActive
            ? (isDark ? "rgba(37,99,235,0.20)" : "rgba(37,99,235,0.10)")
            : (isDark ? "rgba(15,23,42,0.76)" : "rgba(255,255,255,0.84)"),
          color: isActive ? "#1d4ed8" : (isDark ? "#e2e8f0" : "#334155"),
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: isActive ? 800 : 600 }}>
          {section.icon} {section.key === "home" ? t("dashboardPage.summaryLabel") : section.label}
        </span>
        {section.count !== null && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: isActive ? "#1d4ed8" : (isDark ? "#bfdbfe" : "#334155"),
            }}
          >
            {section.count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={centerStyle}>
      <div style={{ ...blockBadgeStyle, marginBottom: 12 }}>{t("dashboardPage.privateAreaBadge")}</div>
      <div
        style={{
          ...sectionShell,
          background: shellBackground,
          overflow: "hidden",
          padding: 0,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "240px minmax(0,1fr)", minHeight: 520 }}>
          <aside
            style={{
              borderRight: isMobile ? "none" : shellBorder,
              borderBottom: isMobile ? shellBorder : "none",
              background: isDark ? "rgba(2,6,23,0.46)" : "rgba(248,250,252,0.92)",
              padding: isMobile ? 12 : 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#2563eb", marginBottom: 14 }}>
              CarsWise
            </div>

            <div style={{ fontSize: 11, letterSpacing: "0.08em", color: isDark ? "#94a3b8" : "#64748b", marginBottom: 8 }}>
              MI PANEL
            </div>
            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              {navSectionsMain.map(renderNavItem)}
            </div>

            <div style={{ height: 1, background: isDark ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.26)", margin: "12px 0" }} />

            <div style={{ fontSize: 11, letterSpacing: "0.08em", color: isDark ? "#94a3b8" : "#64748b", marginBottom: 8 }}>
              CUENTA
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {navSectionsAccount.map(renderNavItem)}
              <button
                type="button"
                onClick={onRestart}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: isDark ? "1px solid rgba(148,163,184,0.18)" : "1px solid rgba(148,163,184,0.24)",
                  background: isDark ? "rgba(15,23,42,0.76)" : "rgba(255,255,255,0.84)",
                  color: isDark ? "#e2e8f0" : "#334155",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ⌂ {t("dashboardPage.backHome")}
              </button>
              <button
                type="button"
                onClick={onLogout}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.30)",
                  background: isDark ? "rgba(127,29,29,0.24)" : "rgba(254,226,226,0.74)",
                  color: isDark ? "#fecaca" : "#b91c1c",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                ↩ {t("dashboardPage.logout")}
              </button>
            </div>
          </aside>

          <main style={{ padding: isMobile ? 12 : 18 }}>
            <div
              style={{
                border: shellBorder,
                borderRadius: 14,
                background: isDark ? "rgba(15,23,42,0.70)" : "rgba(255,255,255,0.96)",
                padding: isMobile ? 10 : "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 12, color: bodyColor }}>
                carswise.es/panel
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#1d4ed8",
                    background: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.24)",
                    borderRadius: 999,
                    padding: "4px 10px",
                  }}
                >
                  Plan Gratis
                </span>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#1d4ed8",
                    background: "rgba(59,130,246,0.14)",
                    border: "1px solid rgba(59,130,246,0.26)",
                  }}
                >
                  {(currentUser?.name || "U").slice(0, 1).toUpperCase()}
                </span>
                <span style={{ fontSize: 13, color: titleColor, fontWeight: 600 }}>
                  {currentUser?.name || t("dashboardPage.userFallback")}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <h2
                style={{
                  fontSize: isMobile ? 22 : 28,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  margin: "0 0 6px",
                  color: titleColor,
                }}
              >
                {userDashboardPage === "home"
                  ? `Buenos dias, ${currentUser?.name || t("dashboardPage.userFallback")}`
                  : sections.find((section) => section.key === userDashboardPage)?.title || t("dashboardPage.title")}
              </h2>
              <p style={{ margin: 0, color: bodyColor, fontSize: 13 }}>
                {sections.find((section) => section.key === userDashboardPage)?.description || t("dashboardPage.subtitle")}
              </p>
            </div>

            {newAlertMatchesCount > 0 && (
              <button
                type="button"
                onClick={() => onNavigate("alerts")}
                aria-label={t("dashboardPage.alertsAriaLabel", { count: newAlertMatchesCount })}
                style={{
                  background: "linear-gradient(135deg,rgba(16,185,129,0.24),rgba(5,150,105,0.18))",
                  border: "1px solid rgba(110,231,183,0.28)",
                  color: "#065f46",
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 10px 20px rgba(5,150,105,0.18)",
                  marginBottom: 12,
                }}
              >
                {t("dashboardPage.alertsButton", { count: newAlertMatchesCount })}
              </button>
            )}

            {userDashboardPage === "home" && (
        <UserDashboardHome
          themeMode={themeMode}
          counts={counts}
          panelStyle={panelStyle}
          isMobile={isMobile}
          newAlertMatchesCount={newAlertMatchesCount}
          pendingAlertNotifications={pendingAlertNotifications}
          emailDigestFeedback={emailDigestFeedback}
          emailDigestLoading={emailDigestLoading}
          onNavigate={onNavigate}
          onMarkAllAlertsSeen={onMarkAllAlertsSeen}
          onSendAlertEmailDigest={onSendAlertEmailDigest}
          currentUser={currentUser}
        />
      )}

            {userDashboardPage === "saved" && (
        <UserDashboardSaved
          themeMode={themeMode}
          isMobile={isMobile}
          savedComparisons={savedComparisons}
          marketAlerts={marketAlerts}
          marketAlertStatus={marketAlertStatus}
          marketAlertMatches={marketAlertMatches}
          currentUserEmail={currentUser?.email || ""}
          panelStyle={panelStyle}
          getOfferBadgeStyle={getOfferBadgeStyle}
          formatCurrency={formatCurrency}
          getSavedComparisonHref={getSavedComparisonHref}
          onOpenOffer={onOpenOffer}
          onOpenMarketplaceOffer={onOpenMarketplaceOffer}
          onRemoveSavedComparison={onRemoveSavedComparison}
          onCreateMarketAlert={onCreateMarketAlert}
          onRemoveMarketAlert={onRemoveMarketAlert}
          onMarkAlertSeen={onMarkAlertSeen}
          onSendAlertEmailDigest={onSendAlertEmailDigest}
          emailDigestLoading={emailDigestLoading}
          emailDigestFeedback={emailDigestFeedback}
          onBrowseMarketplace={onBrowseMarketplace}
          onNavigate={onNavigate}
        />
      )}

            {userDashboardPage === "alerts" && (
        <UserDashboardAlerts
          themeMode={themeMode}
          isMobile={isMobile}
          panelStyle={panelStyle}
          marketAlerts={marketAlerts}
          marketAlertStatus={marketAlertStatus}
          marketAlertMatches={marketAlertMatches}
          currentUserEmail={currentUser?.email || ""}
          onRemoveMarketAlert={onRemoveMarketAlert}
          onMarkAlertSeen={onMarkAlertSeen}
          onOpenMarketplaceOffer={onOpenMarketplaceOffer}
          onOpenOffer={onOpenOffer}
          onBrowseMarketplace={onBrowseMarketplace}
          onCreateMarketAlert={onCreateMarketAlert}
          onSendAlertEmailDigest={onSendAlertEmailDigest}
          emailDigestLoading={emailDigestLoading}
          emailDigestFeedback={emailDigestFeedback}
          formatCurrency={formatCurrency}
        />
      )}

            {userDashboardPage === "valuations" && (
        <UserDashboardValuations
          themeMode={themeMode}
          isMobile={isMobile}
          dashboardValuations={dashboardValuations}
          panelStyle={panelStyle}
          getOfferBadgeStyle={getOfferBadgeStyle}
          onRequestValuation={onRequestValuation}
          onNavigate={onNavigate}
        />
      )}

            {(userDashboardPage === "appointments" || userDashboardPage === "valuations") && (
        <UserDashboardOperations
          themeMode={themeMode}
          isMobile={isMobile}
          dashboardAppointments={dashboardAppointments}
          dashboardValuations={dashboardValuations}
          panelStyle={panelStyle}
          getOfferBadgeStyle={getOfferBadgeStyle}
          onRequestAppointment={onRequestAppointment}
          onRequestValuation={onRequestValuation}
          onNavigate={onNavigate}
          currentUserEmail={currentUser?.email || ""}
          initialTab={userDashboardPage === "valuations" ? "valuations" : "appointments"}
        />
      )}

            {userDashboardPage === "vehicles" && (
        <UserDashboardVehicles
          themeMode={themeMode}
          isMobile={isMobile}
          dashboardAppointments={dashboardAppointments}
          userVehicleSections={userVehicleSections}
          dashboardVehicleCount={dashboardVehicleCount}
          panelStyle={panelStyle}
          getOfferBadgeStyle={getOfferBadgeStyle}
          onRequestAppointment={onRequestAppointment}
          onRequestValuation={onRequestValuation}
          onUpdateAppointmentStatus={onUpdateAppointmentStatus}
          onNavigate={onNavigate}
          onBrowseMarketplace={onBrowseMarketplace}
          currentUserEmail={currentUser?.email || ""}
        />
      )}

            {userDashboardPage === "billing" && (
        <UserDashboardBilling
          themeMode={themeMode}
          isMobile={isMobile}
          panelStyle={panelStyle}
          currentUser={currentUser}
        />
      )}

            {userDashboardPage === "preferences" && (
        <UserDashboardPreferences
          themeMode={themeMode}
          isMobile={isMobile}
          panelStyle={panelStyle}
          currentUser={currentUser}
        />
      )}
          </main>
        </div>
      </div>
    </div>
  );
}
