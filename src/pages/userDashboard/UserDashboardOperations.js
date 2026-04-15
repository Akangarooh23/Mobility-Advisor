import { useEffect, useMemo, useState } from "react";

const GARAGE_STORAGE_PREFIX = "movilidad-advisor.userGarage.v1";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getGarageStorageKey(currentUserEmail = "") {
  const normalizedEmail = normalizeText(currentUserEmail).toLowerCase();
  return normalizedEmail ? `${GARAGE_STORAGE_PREFIX}.${normalizedEmail}` : GARAGE_STORAGE_PREFIX;
}

function readGarageVehicles(currentUserEmail = "") {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getGarageStorageKey(currentUserEmail));
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id) : [];
  } catch {
    return [];
  }
}

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
  isMobile = false,
  dashboardAppointments,
  dashboardValuations,
  panelStyle,
  getOfferBadgeStyle,
  onRequestAppointment,
  onRequestValuation = () => {},
  onNavigate = () => {},
  currentUserEmail = "",
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
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentType, setAppointmentType] = useState("workshop");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [appointmentFeedback, setAppointmentFeedback] = useState("");
  const [garageVehicles, setGarageVehicles] = useState(() => readGarageVehicles(currentUserEmail));

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const appointmentTypeOptions = [
    { key: "workshop", label: "Taller" },
    { key: "maintenance", label: "Mantenimiento" },
    { key: "certification", label: "Garantía / calidad" },
  ];

  useEffect(() => {
    setGarageVehicles(readGarageVehicles(currentUserEmail));
  }, [currentUserEmail]);

  useEffect(() => {
    if (activeTab !== "appointments") {
      setShowAppointmentForm(false);
      setAppointmentFeedback("");
    }
  }, [activeTab]);
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

  const openAppointmentForm = () => {
    const nextGarageVehicles = readGarageVehicles(currentUserEmail);
    setGarageVehicles(nextGarageVehicles);
    setSelectedVehicleId(nextGarageVehicles[0]?.id || "");
    setAppointmentType("workshop");
    setShowAppointmentForm(true);
    setAppointmentFeedback("");
  };

  const submitAppointmentRequest = () => {
    const selectedVehicle = garageVehicles.find((vehicle) => vehicle.id === selectedVehicleId);

    if (!selectedVehicle) {
      setAppointmentFeedback("Debes seleccionar uno de tus vehículos para pedir la cita.");
      return;
    }

    onRequestAppointment(appointmentType, {
      vehicleId: selectedVehicle.id,
      vehicleTitle: selectedVehicle.title || `${selectedVehicle.brand || ""} ${selectedVehicle.model || ""}`.trim(),
      vehiclePlate: selectedVehicle.plate || "",
    });

    const selectedTypeLabel = appointmentTypeOptions.find((option) => option.key === appointmentType)?.label || "Cita";
    const vehicleLabel = selectedVehicle.title || `${selectedVehicle.brand || ""} ${selectedVehicle.model || ""}`.trim();
    setAppointmentFeedback(`${selectedTypeLabel} solicitada para ${vehicleLabel}.`);
    setShowAppointmentForm(false);
  };

  return (
    <section id="user-dashboard-operations" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: "0.6px" }}>OPERACIONES</div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: titleColor }}>Workflow de citas y tasaciones</div>
          <div style={{ fontSize: 12, color: bodyColor, marginTop: 4 }}>
            Gestiona agenda técnica y valoración comercial en una única línea operativa.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...getOfferBadgeStyle("amber"), fontSize: 11 }}>{dashboardAppointments.length} citas</span>
          <span style={{ ...getOfferBadgeStyle("slate"), fontSize: 11 }}>{dashboardValuations.length} tasaciones</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 12 }}>
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

      {activeTab === "valuations" ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            type="button"
            onClick={onRequestValuation}
            style={{
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
              border: "none",
              color: "#ffffff",
              padding: "9px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 10px 18px rgba(37,99,235,0.24)",
              width: isMobile ? "100%" : "auto",
            }}
          >
            Nueva tasación
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={openAppointmentForm}
              style={{
                background: "linear-gradient(135deg,#f59e0b,#d97706)",
                border: "none",
                color: "#ffffff",
                padding: "9px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 10px 18px rgba(217,119,6,0.24)",
                width: isMobile ? "100%" : "auto",
              }}
            >
              Pedir cita
            </button>
          </div>

          {showAppointmentForm && (
            <div
              style={{
                background: cardBg,
                border: panelBorder,
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, color: bodyColor }}>
                Selecciona tipo de cita y uno de tus vehículos para enviar la solicitud.
              </div>

              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))" }}>
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                  Tipo de cita
                  <select
                    value={appointmentType}
                    onChange={(event) => setAppointmentType(event.target.value)}
                    style={{
                      background: isDark ? "#0f1b2d" : "#ffffff",
                      border: cardBorder,
                      borderRadius: 10,
                      padding: "9px 10px",
                      color: titleColor,
                      fontSize: 12,
                    }}
                  >
                    {appointmentTypeOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                  Vehículo
                  <select
                    value={selectedVehicleId}
                    onChange={(event) => setSelectedVehicleId(event.target.value)}
                    style={{
                      background: isDark ? "#0f1b2d" : "#ffffff",
                      border: cardBorder,
                      borderRadius: 10,
                      padding: "9px 10px",
                      color: titleColor,
                      fontSize: 12,
                    }}
                  >
                    {garageVehicles.length > 0 ? (
                      garageVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.title || `${vehicle.brand || ""} ${vehicle.model || ""}`.trim()}
                          {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                        </option>
                      ))
                    ) : (
                      <option value="">No hay vehículos en Mis vehículos</option>
                    )}
                  </select>
                </label>
              </div>

              {garageVehicles.length === 0 && (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12, color: "#b45309" }}>
                    Primero sube al menos un vehículo en Mis vehículos para poder pedir cita.
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate("vehicles")}
                    style={{
                      background: "rgba(37,99,235,0.12)",
                      border: "1px solid rgba(96,165,250,0.24)",
                      color: "#1e3a8a",
                      padding: "8px 10px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      width: isMobile ? "100%" : "fit-content",
                    }}
                  >
                    Ir a Mis vehículos
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={submitAppointmentRequest}
                  disabled={garageVehicles.length === 0}
                  style={{
                    background: garageVehicles.length > 0 ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "rgba(148,163,184,0.24)",
                    border: "none",
                    color: garageVehicles.length > 0 ? "#ffffff" : "#64748b",
                    padding: "9px 12px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: garageVehicles.length > 0 ? "pointer" : "not-allowed",
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  Confirmar cita
                </button>
                <button
                  type="button"
                  onClick={() => setShowAppointmentForm(false)}
                  style={{
                    background: "rgba(148,163,184,0.14)",
                    border: cardBorder,
                    color: isDark ? "#e2e8f0" : "#334155",
                    padding: "9px 12px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {appointmentFeedback && (
            <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>{appointmentFeedback}</div>
          )}
        </div>
      )}

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
