import { useEffect, useState } from "react";
import UserDashboardBilling from "./UserDashboardBilling";
import UserDashboardHome from "./UserDashboardHome";
import UserDashboardOperations from "./UserDashboardOperations";
import UserDashboardSaved from "./UserDashboardSaved";
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

function buildSections(counts, newAlertMatchesCount = 0) {
  return [
    {
      key: "home",
      label: "Inicio",
      icon: "⌂",
      count: null,
      title: "Inicio del panel",
      description: "Vista principal con el estado de tu actividad, tareas pendientes y accesos rápidos.",
    },
    {
      key: "saved",
      label: "Oportunidades",
      icon: "⭐",
      count: counts.saved,
      title: "Oportunidades guardadas y alertas",
      description: "Gestiona comparativas favoritas, alertas y nuevas coincidencias del mercado en un solo bloque.",
      notice: newAlertMatchesCount > 0 ? `🔔 ${newAlertMatchesCount} nuevas` : null,
    },
    {
      key: "appointments",
      label: "Citas",
      icon: "🛠️",
      count: counts.appointments,
      title: "Operaciones · citas",
      description: "Controla agenda de taller, mantenimiento y revisiones de garantía.",
    },
    {
      key: "valuations",
      label: "Tasaciones",
      icon: "💶",
      count: counts.valuations,
      title: "Operaciones · tasaciones",
      description: "Revisa valoraciones guardadas y el estado de informes vinculados a venta.",
    },
    {
      key: "billing",
      label: "Cuenta",
      icon: "💳",
      count: null,
      title: "Cuenta y facturación",
      description: "Gestiona perfil, suscripción, facturas y método de pago desde un único lugar.",
    },
    {
      key: "vehicles",
      label: "Vehículos",
      icon: "🚗",
      count: counts.vehicles,
      title: "Mis vehículos",
      description: "Sigue los coches comprados, vendidos o activos en venta desde tu área privada.",
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
  const cardBg = isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.95)";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";
  const sectionShell = {
    ...panelStyle,
    border: isDark ? "1px solid rgba(59,130,246,0.25)" : "1px solid rgba(96,165,250,0.28)",
    borderRadius: 18,
    boxShadow: isDark
      ? "0 22px 42px rgba(2,6,23,0.38)"
      : "0 18px 34px rgba(30,64,175,0.08)",
    backdropFilter: "blur(8px)",
  };
  const dashboardVehicleCount = userVehicleSections.reduce((acc, section) => acc + section.items.length, 0);
  const totalVehiclesCount = dashboardVehicleCount + garageVehicleCount;
  const counts = {
    saved: savedComparisons.length + (Array.isArray(marketAlerts) ? marketAlerts.length : 0),
    appointments: dashboardAppointments.length,
    valuations: dashboardValuations.length,
    vehicles: totalVehiclesCount,
  };
  const sections = buildSections(counts, newAlertMatchesCount);
  const topNavSections = [
    ...sections.filter((section) => section.key !== "billing"),
    ...sections.filter((section) => section.key === "billing"),
  ];

  return (
    <div style={centerStyle}>
      <div style={{ ...blockBadgeStyle, marginBottom: 12 }}>👤 ÁREA PRIVADA DE USUARIO</div>

      <div
        style={{
          ...sectionShell,
          marginBottom: 18,
          padding: isMobile ? 12 : 18,
          background: isDark
            ? "radial-gradient(1200px 380px at -10% -30%, rgba(37,99,235,0.34), rgba(15,23,42,0.96))"
            : "radial-gradient(1200px 380px at -10% -30%, rgba(147,197,253,0.52), rgba(255,255,255,0.98))",
        }}
      >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <h2
            style={{
              fontSize: isMobile ? "clamp(22px,8vw,28px)" : "clamp(24px,4vw,34px)",
              fontWeight: 800,
              letterSpacing: "-1.2px",
              margin: "0 0 8px",
              color: titleColor,
            }}
          >
            Mi espacio CarsWise
          </h2>
          <p style={{ color: bodyColor, fontSize: isMobile ? 13 : 14, lineHeight: 1.7, margin: 0, maxWidth: 760, fontWeight: 500 }}>
            Panel unificado para gestionar oportunidades, operaciones, vehículos y cuenta en un solo flujo.
          </p>
          {currentUser?.email && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#2563eb", fontWeight: 700 }}>
              Sesión activa: {currentUser.name || "Usuario"} · {currentUser.email}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
          {newAlertMatchesCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate("saved")}
              aria-label={`${newAlertMatchesCount} novedades en alertas`}
              style={{
                background: "linear-gradient(135deg,rgba(16,185,129,0.24),rgba(5,150,105,0.18))",
                border: "1px solid rgba(110,231,183,0.28)",
                color: "#065f46",
                padding: "11px 14px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 10px 20px rgba(5,150,105,0.18)",
                width: isMobile ? "100%" : "auto",
              }}
            >
              🔔 {newAlertMatchesCount} {newAlertMatchesCount === 1 ? "novedad" : "novedades"} en alertas
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            style={{
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
              border: "none",
              color: "#ffffff",
              padding: "11px 14px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 12px 24px rgba(29,78,216,0.24)",
              width: isMobile ? "100%" : "auto",
            }}
          >
            ⌂ Volver al inicio
          </button>
          <button
            type="button"
            onClick={onLogout}
            style={{
              background: cardBg,
              border: "1px solid rgba(148,163,184,0.3)",
              color: isDark ? "#e2e8f0" : "#334155",
              padding: "11px 14px",
              borderRadius: 12,
              fontSize: 12,
              cursor: "pointer",
              width: isMobile ? "100%" : "auto",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(6,minmax(0,1fr))", gap: 10 }}>
        {topNavSections
          .map((section) => (
            <button
              key={`top-nav-${section.key}`}
              type="button"
              onClick={() => onNavigate(section.key)}
              style={{
                background: isDark ? "rgba(15,23,42,0.76)" : "rgba(255,255,255,0.9)",
                border: isDark ? "1px solid rgba(148,163,184,0.24)" : "1px solid rgba(37,99,235,0.32)",
                borderRadius: 16,
                padding: isMobile ? "10px" : "11px 11px 10px",
                textAlign: "left",
                cursor: "pointer",
                boxShadow: isDark
                  ? "0 12px 22px rgba(2,6,23,0.34)"
                  : "0 10px 20px rgba(30,64,175,0.12)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: titleColor }}>
                  {section.icon} {section.key === "home" ? "Resumen" : section.label}
                </div>
                {section.count !== null && (
                  <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>{section.count}</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: bodyColor, lineHeight: 1.45 }}>{section.description}</div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>
                {section.key === "home" ? "Ir al inicio →" : "Abrir sección →"}
              </div>
            </button>
          ))}
      </div>
      </div>

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
    </div>
  );
}
