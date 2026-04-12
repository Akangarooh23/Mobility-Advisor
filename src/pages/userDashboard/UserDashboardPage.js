import UserDashboardAppointments from "./UserDashboardAppointments";
import UserDashboardBilling from "./UserDashboardBilling";
import UserDashboardHome from "./UserDashboardHome";
import UserDashboardSaved from "./UserDashboardSaved";
import UserDashboardValuations from "./UserDashboardValuations";
import UserDashboardVehicles from "./UserDashboardVehicles";

function buildSections(counts, newAlertMatchesCount = 0) {
  return [
    {
      key: "home",
      label: "Resumen",
      icon: "⌂",
      count: null,
      title: "Home del panel",
      description: "Vista principal con el resumen de tu actividad y accesos rápidos a cada apartado.",
    },
    {
      key: "saved",
      label: "Guardadas",
      icon: "⭐",
      count: counts.saved,
      title: "Recomendaciones guardadas",
      description: "Consulta tus comparativas favoritas y activa alertas para detectar nuevas ofertas de compra o renting con tus filtros.",
      notice: newAlertMatchesCount > 0 ? `🔔 ${newAlertMatchesCount} nuevas` : null,
    },
    {
      key: "appointments",
      label: "Citas",
      icon: "🛠️",
      count: counts.appointments,
      title: "Citas y gestiones",
      description: "Controla tu agenda de taller, mantenimiento y revisiones de garantía.",
    },
    {
      key: "valuations",
      label: "Tasaciones",
      icon: "💶",
      count: counts.valuations,
      title: "Tasaciones e informes",
      description: "Revisa las valoraciones guardadas y el estado de tus informes de venta.",
    },
    {
      key: "billing",
      label: "Cuenta",
      icon: "💳",
      count: null,
      title: "Mi cuenta y facturacion",
      description: "Gestiona tus datos personales, suscripcion activa, facturas y metodo de pago desde un unico lugar.",
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
  onOpenOffer,
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
  const dashboardVehicleCount = userVehicleSections.reduce((acc, section) => acc + section.items.length, 0);
  const counts = {
    saved: savedComparisons.length + (Array.isArray(marketAlerts) ? marketAlerts.length : 0),
    appointments: dashboardAppointments.length,
    valuations: dashboardValuations.length,
    vehicles: dashboardVehicleCount,
  };
  const sections = buildSections(counts, newAlertMatchesCount);
  const activeUserDashboardSection =
    sections.find((section) => section.key === userDashboardPage) || sections[0];

  return (
    <div style={centerStyle}>
      <div style={{ ...blockBadgeStyle, marginBottom: 10 }}>👤 ÁREA PRIVADA DE USUARIO</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <h2
            style={{
              fontSize: "clamp(22px,4vw,30px)",
              fontWeight: 800,
              letterSpacing: "-1px",
              margin: "0 0 10px",
              color: "#f1f5f9",
            }}
          >
            Mi espacio MoveAdvisor
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: 0, maxWidth: 760 }}>
            La vista actual funciona como el home de tu panel. Desde la navegación superior puedes entrar en
            cada sección y verla en su propia página dentro del área privada.
          </p>
          {currentUser?.email && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#bfdbfe", fontWeight: 700 }}>
              Sesión activa: {currentUser.name || "Usuario"} · {currentUser.email}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {newAlertMatchesCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate("saved")}
              aria-label={`${newAlertMatchesCount} novedades en alertas`}
              style={{
                background: "linear-gradient(135deg,rgba(16,185,129,0.24),rgba(5,150,105,0.18))",
                border: "1px solid rgba(110,231,183,0.28)",
                color: "#ecfdf5",
                padding: "11px 16px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
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
              padding: "11px 16px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ⌂ Volver al inicio
          </button>
          <button
            type="button"
            onClick={onLogout}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#cbd5e1",
              padding: "11px 16px",
              borderRadius: 10,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ ...panelStyle, marginBottom: 18, padding: 14 }}>
        <div style={{ fontSize: 11, color: "#93c5fd", letterSpacing: "0.6px", marginBottom: 10 }}>
          NAVEGACIÓN DEL PANEL
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sections.map((section) => {
            const isActive = userDashboardPage === section.key;

            return (
              <button
                key={section.key}
                type="button"
                onClick={() => onNavigate(section.key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: isActive ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "rgba(37,99,235,0.08)",
                  border: isActive ? "none" : "1px solid rgba(96,165,250,0.2)",
                  color: "#eff6ff",
                  padding: "9px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span>{section.icon} {section.label}</span>
                {section.count !== null && (
                  <span
                    style={{
                      background: isActive ? "rgba(255,255,255,0.16)" : "rgba(148,163,184,0.18)",
                      padding: "2px 7px",
                      borderRadius: 999,
                      fontSize: 11,
                    }}
                  >
                    {section.count}
                  </span>
                )}
                {section.notice && (
                  <span
                    style={{
                      background: "rgba(16,185,129,0.16)",
                      border: "1px solid rgba(110,231,183,0.22)",
                      color: "#d1fae5",
                      padding: "2px 7px",
                      borderRadius: 999,
                      fontSize: 10,
                    }}
                  >
                    {section.notice}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          ...panelStyle,
          marginBottom: 18,
          background: "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(15,23,42,0.82))",
          border: "1px solid rgba(96,165,250,0.18)",
        }}
      >
        <div style={{ fontSize: 11, color: "#93c5fd", letterSpacing: "0.6px", marginBottom: 8 }}>
          VISTA ACTUAL
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f8fafc" }}>
              {activeUserDashboardSection.icon} {activeUserDashboardSection.title}
            </div>
            <p style={{ margin: "6px 0 0", color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, maxWidth: 760 }}>
              {activeUserDashboardSection.description}
            </p>
          </div>
          {userDashboardPage !== "home" && (
            <button
              type="button"
              onClick={() => onNavigate("home")}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0",
                padding: "9px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ← Volver al resumen
            </button>
          )}
        </div>
      </div>

      {userDashboardPage === "home" && (
        <UserDashboardHome
          counts={counts}
          sections={sections}
          panelStyle={panelStyle}
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

      {userDashboardPage === "appointments" && (
        <UserDashboardAppointments
          dashboardAppointments={dashboardAppointments}
          panelStyle={panelStyle}
          getOfferBadgeStyle={getOfferBadgeStyle}
          onRequestAppointment={onRequestAppointment}
        />
      )}

      {userDashboardPage === "valuations" && (
        <UserDashboardValuations
          dashboardValuations={dashboardValuations}
          panelStyle={panelStyle}
          getOfferBadgeStyle={getOfferBadgeStyle}
        />
      )}

      {userDashboardPage === "vehicles" && (
        <UserDashboardVehicles
          userVehicleSections={userVehicleSections}
          dashboardVehicleCount={dashboardVehicleCount}
          panelStyle={panelStyle}
          getOfferBadgeStyle={getOfferBadgeStyle}
        />
      )}

      {userDashboardPage === "billing" && (
        <UserDashboardBilling
          panelStyle={panelStyle}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
