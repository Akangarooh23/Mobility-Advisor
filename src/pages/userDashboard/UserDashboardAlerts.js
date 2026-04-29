import { useMemo, useState } from "react";

const EMPTY_ALERT_FORM = {
  mode: "ambos",
  brand: "",
  model: "",
  maxPrice: "",
  maxMileage: "",
  fuel: "",
  location: "",
  color: "",
  notifyByEmail: false,
  email: "",
};

function buildAlertChips(alert, formatCurrency) {
  return [
    alert?.modeLabel,
    alert?.brand ? `Marca ${alert.brand}` : "",
    alert?.model ? `Modelo ${alert.model}` : "",
    alert?.maxPrice ? `Hasta ${formatCurrency(Number(alert.maxPrice))}` : "",
    alert?.maxMileage ? `Hasta ${Number(alert.maxMileage).toLocaleString("es-ES")} km` : "",
    alert?.fuel || "",
    alert?.location ? `Zona ${alert.location}` : "",
    alert?.color ? `Color ${alert.color}` : "",
  ].filter(Boolean);
}

export default function UserDashboardAlerts({
  themeMode,
  isMobile = false,
  panelStyle,
  marketAlerts = [],
  marketAlertStatus = {},
  marketAlertMatches = {},
  currentUserEmail = "",
  onRemoveMarketAlert = () => {},
  onMarkAlertSeen = () => {},
  onOpenMarketplaceOffer = () => {},
  onOpenOffer = () => {},
  onBrowseMarketplace = () => {},
  onCreateMarketAlert = () => null,
  onSendAlertEmailDigest = () => {},
  emailDigestLoading = false,
  emailDigestFeedback = "",
  formatCurrency = (value) => `${Number(value || 0).toLocaleString("es-ES")} EUR`,
}) {
  const isDark = themeMode === "dark";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";
  const panelBorder = isDark ? "1px solid rgba(148,163,184,0.26)" : "1px solid rgba(59,130,246,0.34)";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.24)" : "1px solid rgba(37,99,235,0.3)";
  const sectionFrame = {
    background: isDark ? "rgba(2,6,23,0.34)" : "rgba(248,250,252,0.86)",
    border: isDark ? "1px solid rgba(148,163,184,0.22)" : "1px solid rgba(148,163,184,0.24)",
    borderRadius: 14,
    boxShadow: isDark
      ? "0 14px 26px rgba(2,6,23,0.28)"
      : "0 10px 20px rgba(15,23,42,0.06)",
  };

  const normalizedCurrentUserEmail = String(currentUserEmail || "").trim().toLowerCase();
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertForm, setAlertForm] = useState(EMPTY_ALERT_FORM);
  const [alertFeedback, setAlertFeedback] = useState("");
  const emailAlertCount = useMemo(
    () => marketAlerts.filter((alert) => alert?.notifyByEmail && String(alert?.email || normalizedCurrentUserEmail || "").trim()).length,
    [marketAlerts, normalizedCurrentUserEmail]
  );
  const totalNewMatches = useMemo(
    () =>
      marketAlerts.reduce((acc, alert) => {
        const matchInfo = marketAlertMatches?.[alert.id] || { count: 0 };
        const seenCount = Number(marketAlertStatus?.[alert.id]?.seenCount || 0);
        return acc + Math.max(Number(matchInfo.count || 0) - seenCount, 0);
      }, 0),
    [marketAlerts, marketAlertMatches, marketAlertStatus]
  );

  const updateAlertField = (key, value) => {
    setAlertForm((prev) => {
      if (key === "notifyByEmail") {
        return {
          ...prev,
          notifyByEmail: Boolean(value),
          email: value ? String(prev.email || normalizedCurrentUserEmail || "").trim().toLowerCase() : prev.email,
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const handleCreateAlert = () => {
    if (alertForm.notifyByEmail && !String(alertForm.email || normalizedCurrentUserEmail || "").trim()) {
      setAlertFeedback("Inicia sesión o indica un correo para activar el aviso por email de esta alerta.");
      return;
    }

    const createdAlert = onCreateMarketAlert(alertForm);

    if (!createdAlert) {
      setAlertFeedback("No se pudo guardar la alerta. Revisa los filtros y vuelve a intentarlo.");
      return;
    }

    setAlertFeedback(
      createdAlert.notifyByEmail && createdAlert.email
        ? `Alerta guardada con resumen por email para ${createdAlert.email}.`
        : "Alerta guardada: te avisaremos aquí cuando aparezcan ofertas nuevas que encajen."
    );
    setShowAlertForm(false);
    setAlertForm(EMPTY_ALERT_FORM);
    window.setTimeout(() => setAlertFeedback(""), 2400);
  };

  return (
    <section id="user-dashboard-alerts" style={{ ...panelStyle, ...sectionFrame, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: "0.6px" }}>ALERTAS DE PRECIO</div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: titleColor }}>Reglas activas y coincidencias</div>
          <div style={{ fontSize: 12, color: bodyColor, marginTop: 4 }}>
            Gestiona alertas, revisa nuevas coincidencias y actua en el marketplace.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(110,231,183,0.2)",
              color: "#065f46",
              borderRadius: 999,
              padding: "5px 9px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {marketAlerts.length} alertas activas
          </span>
          <span
            style={{
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(251,191,36,0.2)",
              color: "#92400e",
              borderRadius: 999,
              padding: "5px 9px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {totalNewMatches} novedades
          </span>
        </div>
      </div>

      <div
        style={{
          marginBottom: 14,
          background: cardBg,
          border: panelBorder,
          borderRadius: 12,
          padding: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: bodyColor }}>
            Crea alertas por tipo de oferta, marca/modelo, precio, kilometraje, combustible y zona.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
            <button
              type="button"
              onClick={onSendAlertEmailDigest}
              disabled={emailAlertCount === 0 || emailDigestLoading}
              style={{
                background: emailAlertCount > 0 ? "rgba(99,102,241,0.16)" : "rgba(148,163,184,0.12)",
                border: emailAlertCount > 0 ? "1px solid rgba(165,180,252,0.24)" : "1px solid rgba(148,163,184,0.18)",
                color: emailAlertCount > 0 ? "#312e81" : "#64748b",
                padding: "9px 11px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: emailAlertCount > 0 && !emailDigestLoading ? "pointer" : "not-allowed",
                width: isMobile ? "100%" : "auto",
              }}
            >
              {emailDigestLoading ? "Enviando…" : "Enviar resumen por email"}
            </button>
            <button
              type="button"
              onClick={() => setShowAlertForm((prev) => !prev)}
              style={{
                background: "linear-gradient(135deg,#10b981,#059669)",
                border: "none",
                color: "#ffffff",
                padding: "9px 11px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                width: isMobile ? "100%" : "auto",
              }}
            >
              {showAlertForm ? "Cerrar" : "Añadir alerta"}
            </button>
          </div>
        </div>

        {showAlertForm && (
          <>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(180px,1fr))" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Tipo de oferta
                <select value={alertForm.mode} onChange={(event) => updateAlertField("mode", event.target.value)} style={{ border: cardBorder, borderRadius: 10, padding: "9px 10px", background: isDark ? "#0f1b2d" : "#fff", color: titleColor }}>
                  <option value="ambos">Compra o renting</option>
                  <option value="compra">Compra</option>
                  <option value="renting">Renting</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Marca
                <input value={alertForm.brand} onChange={(event) => updateAlertField("brand", event.target.value)} placeholder="Toyota, BMW..." style={{ border: cardBorder, borderRadius: 10, padding: "9px 10px", background: isDark ? "#0f1b2d" : "#fff", color: titleColor }} />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Modelo
                <input value={alertForm.model} onChange={(event) => updateAlertField("model", event.target.value)} placeholder="Corolla, X1..." style={{ border: cardBorder, borderRadius: 10, padding: "9px 10px", background: isDark ? "#0f1b2d" : "#fff", color: titleColor }} />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Precio máximo (€)
                <input type="number" value={alertForm.maxPrice} onChange={(event) => updateAlertField("maxPrice", event.target.value)} placeholder="25000" style={{ border: cardBorder, borderRadius: 10, padding: "9px 10px", background: isDark ? "#0f1b2d" : "#fff", color: titleColor }} />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Kilometraje máximo
                <input type="number" value={alertForm.maxMileage} onChange={(event) => updateAlertField("maxMileage", event.target.value)} placeholder="60000" style={{ border: cardBorder, borderRadius: 10, padding: "9px 10px", background: isDark ? "#0f1b2d" : "#fff", color: titleColor }} />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Combustible
                <input value={alertForm.fuel} onChange={(event) => updateAlertField("fuel", event.target.value)} placeholder="Diésel, Híbrido..." style={{ border: cardBorder, borderRadius: 10, padding: "9px 10px", background: isDark ? "#0f1b2d" : "#fff", color: titleColor }} />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Localización
                <input value={alertForm.location} onChange={(event) => updateAlertField("location", event.target.value)} placeholder="Madrid, Valencia..." style={{ border: cardBorder, borderRadius: 10, padding: "9px 10px", background: isDark ? "#0f1b2d" : "#fff", color: titleColor }} />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#334155" }}>
                Color
                <input value={alertForm.color} onChange={(event) => updateAlertField("color", event.target.value)} placeholder="Blanco, gris..." style={{ border: cardBorder, borderRadius: 10, padding: "9px 10px", background: isDark ? "#0f1b2d" : "#fff", color: titleColor }} />
              </label>
            </div>

            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12, color: bodyColor, cursor: "pointer" }}>
              <input type="checkbox" checked={Boolean(alertForm.notifyByEmail)} onChange={(event) => updateAlertField("notifyByEmail", event.target.checked)} />
              Enviarme también un resumen por email
            </label>

            {alertForm.notifyByEmail && (
              <input
                type="email"
                value={alertForm.email}
                onChange={(event) => updateAlertField("email", event.target.value)}
                placeholder={normalizedCurrentUserEmail || "nombre@correo.com"}
                style={{ border: cardBorder, borderRadius: 10, padding: "9px 10px", background: isDark ? "#0f1b2d" : "#fff", color: titleColor }}
              />
            )}

            <button
              type="button"
              onClick={handleCreateAlert}
              style={{
                background: "rgba(37,99,235,0.14)",
                border: "1px solid rgba(96,165,250,0.24)",
                color: "#1e3a8a",
                padding: "9px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                width: isMobile ? "100%" : "fit-content",
              }}
            >
              Guardar alerta
            </button>
          </>
        )}

        {(alertFeedback || emailDigestFeedback) && (
          <div style={{ fontSize: 12, color: "#1d4ed8" }}>
            {emailDigestFeedback || alertFeedback}
          </div>
        )}
      </div>

      {marketAlerts.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {marketAlerts.map((alert) => {
            const alertEmail = String(alert?.email || normalizedCurrentUserEmail || "").trim().toLowerCase();
            const alertMatchInfo = marketAlertMatches?.[alert.id] || { count: 0, matches: [] };
            const seenCount = Number(marketAlertStatus?.[alert.id]?.seenCount || 0);
            const newMatchesCount = Math.max(Number(alertMatchInfo.count || 0) - seenCount, 0);
            const alertChips = buildAlertChips({ ...alert, email: alertEmail }, formatCurrency);

            return (
              <div
                key={alert.id}
                style={{
                  background: cardBg,
                  border: isDark ? "1px solid rgba(110,231,183,0.14)" : "1px solid rgba(16,185,129,0.3)",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: titleColor }}>{alert.title}</div>
                    <div style={{ fontSize: 11, color: bodyColor, marginTop: 3 }}>
                      {alert.createdAt} · {alert.status || "Activa"}
                    </div>
                    {alert.notifyByEmail && alertEmail && (
                      <div style={{ fontSize: 11, color: "#1d4ed8", marginTop: 4 }}>📧 {alertEmail}</div>
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {alertChips.map((chip) => (
                        <span
                          key={`${alert.id}-${chip}`}
                          style={{
                            background: "rgba(37,99,235,0.10)",
                            border: "1px solid rgba(96,165,250,0.18)",
                            color: "#1e3a8a",
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                          }}
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
                    {newMatchesCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onMarkAlertSeen(alert.id, alertMatchInfo.count)}
                        style={{
                          background: "rgba(245,158,11,0.12)",
                          border: "1px solid rgba(251,191,36,0.18)",
                          color: "#92400e",
                          padding: "8px 10px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          width: isMobile ? "100%" : "auto",
                        }}
                      >
                        Marcar revisada
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onMarkAlertSeen(alert.id, alertMatchInfo.count);
                        onBrowseMarketplace(alert);
                      }}
                      style={{
                        background: "rgba(16,185,129,0.12)",
                        border: "1px solid rgba(110,231,183,0.2)",
                        color: "#065f46",
                        padding: "8px 10px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        width: isMobile ? "100%" : "auto",
                      }}
                    >
                      Ir al marketplace
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveMarketAlert(alert.id)}
                      style={{
                        background: "rgba(239,68,68,0.12)",
                        border: "1px solid rgba(248,113,113,0.18)",
                        color: "#b91c1c",
                        padding: "8px 10px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        width: isMobile ? "100%" : "auto",
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    background: isDark ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.9)",
                    border: cardBorder,
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8", letterSpacing: "0.4px", marginBottom: 6 }}>
                    {alertMatchInfo.count === 1 ? "1 coincidencia ahora" : `${alertMatchInfo.count} coincidencias ahora`}
                  </div>
                  {alertMatchInfo.count > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {alertMatchInfo.matches.slice(0, 3).map((offer) => (
                        <div
                          key={`${alert.id}-${offer.id || offer.url || offer.title}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "center",
                            background: isDark ? "rgba(15,23,42,0.88)" : "rgba(241,245,249,0.9)",
                            border: isDark ? "1px solid rgba(148,163,184,0.24)" : cardBorder,
                            borderRadius: 10,
                            padding: "8px 10px",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: titleColor }}>{offer.title}</div>
                            <div style={{ fontSize: 11, color: bodyColor, marginTop: 2 }}>
                              {alert.mode === "renting" && Number(offer.rentingMonthly || 0) > 0
                                ? `${formatCurrency(offer.rentingMonthly)}/mes`
                                : formatCurrency(offer.price)}
                              {offer.location ? ` · ${offer.location}` : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onMarkAlertSeen(alert.id, alertMatchInfo.count);
                              if (offer?.id) {
                                onOpenMarketplaceOffer(offer);
                                return;
                              }
                              if (offer?.url) {
                                onOpenOffer(offer.url);
                                return;
                              }
                              onBrowseMarketplace(alert);
                            }}
                            style={{
                              background: "rgba(37,99,235,0.12)",
                              border: "1px solid rgba(96,165,250,0.2)",
                              color: "#1e3a8a",
                              padding: "8px 10px",
                              borderRadius: 10,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Ver oferta ↗
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      Aun no hay coincidencias con estos filtros. Seguimos vigilando el mercado.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            background: cardBg,
            border: panelBorder,
            borderRadius: 12,
            padding: 14,
            fontSize: 12,
            color: bodyColor,
          }}
        >
          Todavia no has creado alertas de mercado. Crea una desde Guardados para empezar a recibir coincidencias.
        </div>
      )}
    </section>
  );
}
