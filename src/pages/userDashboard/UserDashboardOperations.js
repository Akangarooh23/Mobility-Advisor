import { useEffect, useMemo, useState } from "react";
import { getGarageVehiclesJson } from "../../utils/apiClient";
import { readUserBillingState, writeUserBillingCheckoutIntent } from "../../utils/storage";

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

async function fetchGarageVehiclesFromApi(currentUserEmail = "") {
  const { response, data } = await getGarageVehiclesJson(normalizeText(currentUserEmail).toLowerCase());

  if (!response.ok) {
    throw new Error("No se pudo leer el garage desde la API");
  }

  return Array.isArray(data?.vehicles) ? data.vehicles : [];
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

function normalizePlanId(value = "") {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || "gratis";
}

function getPlanCoverage(planId = "gratis", managementType = "appointment", appointmentType = "workshop") {
  const normalizedPlanId = normalizePlanId(planId);

  const valuationCoverageByPlan = {
    gratis: { included: false, estimatedPrice: "59 EUR", note: "Pago por gestión" },
    bronce: { included: false, estimatedPrice: "39 EUR", note: "Descuento de plan aplicado" },
    plata: { included: true, estimatedPrice: "Incluida", note: "1 tasación incluida" },
    oro: { included: true, estimatedPrice: "Incluida", note: "Cupo de tasaciones incluido" },
    platino: { included: true, estimatedPrice: "Incluida", note: "Cupo alto incluido" },
  };

  const appointmentCoverageByPlan = {
    gratis: { included: false, estimatedPrice: "25 EUR", note: "Pago por gestión" },
    bronce: { included: false, estimatedPrice: "19 EUR", note: "Precio reducido por plan" },
    plata: { included: true, estimatedPrice: "Incluida", note: "Gestión asistida incluida" },
    oro: { included: true, estimatedPrice: "Incluida", note: "Gestión prioritaria incluida" },
    platino: { included: true, estimatedPrice: "Incluida", note: "Gestión premium incluida" },
  };

  const maintenanceExtra =
    managementType === "appointment" && normalizeText(appointmentType) === "maintenance"
      ? " · Incluye checklist preventivo"
      : "";

  if (managementType === "valuation") {
    return valuationCoverageByPlan[normalizedPlanId] || valuationCoverageByPlan.gratis;
  }

  const baseCoverage = appointmentCoverageByPlan[normalizedPlanId] || appointmentCoverageByPlan.gratis;
  return {
    ...baseCoverage,
    note: `${baseCoverage.note}${maintenanceExtra}`,
  };
}

function getSuggestedPlanForManagement(managementType = "appointment") {
  return managementType === "valuation" ? "plata" : "bronce";
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
  const [showManagementWizard, setShowManagementWizard] = useState(false);
  const [managementType, setManagementType] = useState(initialTab === "valuations" ? "valuation" : "appointment");
  const [managementVehicleId, setManagementVehicleId] = useState("");
  const [managementAppointmentType, setManagementAppointmentType] = useState("workshop");
  const [managementValuationSource, setManagementValuationSource] = useState("garage");
  const [appointmentFeedback, setAppointmentFeedback] = useState("");
  const [valuationFeedback, setValuationFeedback] = useState("");
  const [garageVehicles, setGarageVehicles] = useState(() => readGarageVehicles(currentUserEmail));
  const [billingPlanState, setBillingPlanState] = useState(() => readUserBillingState());

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const appointmentTypeOptions = [
    { key: "workshop", label: "Taller" },
    { key: "maintenance", label: "Mantenimiento" },
    { key: "insurance", label: "Seguro" },
    { key: "certification", label: "Garantía / calidad" },
  ];

  useEffect(() => {
    let disposed = false;

    const hydrateVehicles = async () => {
      const localVehicles = readGarageVehicles(currentUserEmail);
      if (!disposed) {
        setGarageVehicles(localVehicles);
      }

      try {
        const apiVehicles = await fetchGarageVehiclesFromApi(currentUserEmail);
        if (!disposed && Array.isArray(apiVehicles)) {
          setGarageVehicles(apiVehicles);
        }
      } catch {
        // Keep local fallback when API is unavailable.
      }
    };

    void hydrateVehicles();
    return () => {
      disposed = true;
    };
  }, [currentUserEmail]);

  useEffect(() => {
    if (activeTab !== "appointments") {
      setAppointmentFeedback("");
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "valuations") {
      setValuationFeedback("");
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refreshBillingState = () => {
      setBillingPlanState(readUserBillingState());
    };

    refreshBillingState();
    window.addEventListener("storage", refreshBillingState);
    return () => window.removeEventListener("storage", refreshBillingState);
  }, []);
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
      itemTypeLabel:
        normalizeText(item?.type) === "maintenance"
          ? "Mantenimiento"
          : normalizeText(item?.type) === "insurance"
          ? "Seguro"
          : "Cita",
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

  const garageVehiclesForValuation = useMemo(
    () => (Array.isArray(garageVehicles) ? garageVehicles.filter((vehicle) => normalizeText(vehicle?.id)) : []),
    [garageVehicles]
  );

  const currentPlanLabel = normalizeText(billingPlanState?.planLabel) || "Plan Gratis";
  const currentPlanId = normalizePlanId(billingPlanState?.planId);
  const managementCoverage = getPlanCoverage(currentPlanId, managementType, managementAppointmentType);

  const refreshGarageVehicles = async () => {
    let nextGarageVehicles = readGarageVehicles(currentUserEmail);

    try {
      nextGarageVehicles = await fetchGarageVehiclesFromApi(currentUserEmail);
    } catch {
      // Keep local fallback when API is unavailable.
    }

    setGarageVehicles(nextGarageVehicles);
    return nextGarageVehicles;
  };

  const openManagementWizard = async (type = activeTab === "valuations" ? "valuation" : "appointment") => {
    const nextGarageVehicles = await refreshGarageVehicles();
    setManagementType(type);
    setManagementVehicleId(nextGarageVehicles[0]?.id || "");
    setManagementAppointmentType("workshop");
    setManagementValuationSource("garage");
    setShowManagementWizard(true);
    setAppointmentFeedback("");
    setValuationFeedback("");
  };

  const submitManagementWizard = () => {
    if (managementType === "appointment") {
      const selectedVehicle = garageVehicles.find((vehicle) => vehicle.id === managementVehicleId);

      if (!selectedVehicle) {
        setAppointmentFeedback("Debes seleccionar uno de tus vehículos para pedir la cita.");
        return;
      }

      onRequestAppointment(managementAppointmentType, {
        vehicleId: selectedVehicle.id,
        vehicleTitle: selectedVehicle.title || `${selectedVehicle.brand || ""} ${selectedVehicle.model || ""}`.trim(),
        vehiclePlate: selectedVehicle.plate || "",
      });

      const selectedTypeLabel = appointmentTypeOptions.find((option) => option.key === managementAppointmentType)?.label || "Cita";
      const vehicleLabel = selectedVehicle.title || `${selectedVehicle.brand || ""} ${selectedVehicle.model || ""}`.trim();
      setAppointmentFeedback(
        managementCoverage.included
          ? `${selectedTypeLabel} solicitada para ${vehicleLabel}. Incluida en ${currentPlanLabel}.`
          : `${selectedTypeLabel} solicitada para ${vehicleLabel}. Servicio de pago por gestión (${managementCoverage.estimatedPrice}).`
      );
      setShowManagementWizard(false);
      return;
    }

    if (managementValuationSource === "scratch") {
      onRequestValuation();
      setValuationFeedback(
        managementCoverage.included
          ? `Nueva tasación iniciada desde cero. Incluida en ${currentPlanLabel}.`
          : `Nueva tasación iniciada desde cero. Gestión puntual (${managementCoverage.estimatedPrice}).`
      );
      setShowManagementWizard(false);
      return;
    }

    const selectedVehicle = garageVehiclesForValuation.find((vehicle) => vehicle.id === managementVehicleId);

    if (!selectedVehicle) {
      setValuationFeedback("Selecciona uno de tus vehículos para iniciar la tasación.");
      return;
    }

    onRequestValuation({
      vehicleId: selectedVehicle.id,
      vehicleTitle: selectedVehicle.title || `${selectedVehicle.brand || ""} ${selectedVehicle.model || ""}`.trim(),
      vehiclePlate: selectedVehicle.plate || "",
      brand: selectedVehicle.brand || "",
      model: selectedVehicle.model || "",
      year: selectedVehicle.year || "",
      mileage: selectedVehicle.mileage || "",
      fuel: selectedVehicle.fuel || "",
    });

    setValuationFeedback(
      managementCoverage.included
        ? `Nueva tasación iniciada para ${selectedVehicle.plate ? `matrícula ${selectedVehicle.plate}` : selectedVehicle.title || "tu vehículo"}. Incluida en ${currentPlanLabel}.`
        : `Nueva tasación iniciada para ${selectedVehicle.plate ? `matrícula ${selectedVehicle.plate}` : selectedVehicle.title || "tu vehículo"}. Gestión puntual (${managementCoverage.estimatedPrice}).`
    );
    setShowManagementWizard(false);
  };

  const goToBillingForManagement = () => {
    writeUserBillingCheckoutIntent({
      source: "operations-wizard",
      managementType,
      appointmentType: managementType === "appointment" ? managementAppointmentType : "",
      suggestedPlanId: getSuggestedPlanForManagement(managementType),
      estimatedPrice: managementCoverage.estimatedPrice,
      createdAt: new Date().toISOString(),
    });

    onNavigate("billing");
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

      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => openManagementWizard(activeTab === "valuations" ? "valuation" : "appointment")}
            style={{
              background: activeTab === "valuations" ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "linear-gradient(135deg,#f59e0b,#d97706)",
              border: "none",
              color: "#ffffff",
              padding: "9px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: activeTab === "valuations" ? "0 10px 18px rgba(37,99,235,0.24)" : "0 10px 18px rgba(217,119,6,0.24)",
              width: isMobile ? "100%" : "auto",
            }}
          >
            Nueva gestión
          </button>
        </div>

        {showManagementWizard && (
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
              Crea una gestión desde un único flujo: selecciona vehículo y tipo de servicio.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setManagementType("appointment")}
                style={{
                  background: managementType === "appointment" ? "linear-gradient(135deg,#f59e0b,#d97706)" : "transparent",
                  border: managementType === "appointment" ? "none" : cardBorder,
                  color: managementType === "appointment" ? "#ffffff" : isDark ? "#cbd5e1" : "#334155",
                  padding: "8px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cita / mantenimiento
              </button>
              <button
                type="button"
                onClick={() => setManagementType("valuation")}
                style={{
                  background: managementType === "valuation" ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "transparent",
                  border: managementType === "valuation" ? "none" : cardBorder,
                  color: managementType === "valuation" ? "#eff6ff" : isDark ? "#cbd5e1" : "#334155",
                  padding: "8px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Tasación
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Vehículo
                <select
                  value={managementVehicleId}
                  onChange={(event) => setManagementVehicleId(event.target.value)}
                  style={{
                    background: isDark ? "#0f1b2d" : "#ffffff",
                    border: cardBorder,
                    borderRadius: 10,
                    padding: "9px 10px",
                    color: titleColor,
                    fontSize: 12,
                  }}
                >
                  {garageVehiclesForValuation.length > 0 ? (
                    garageVehiclesForValuation.map((vehicle) => (
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

              {managementType === "appointment" ? (
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                  Tipo de cita
                  <select
                    value={managementAppointmentType}
                    onChange={(event) => setManagementAppointmentType(event.target.value)}
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
              ) : (
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                  Modo de tasación
                  <select
                    value={managementValuationSource}
                    onChange={(event) => setManagementValuationSource(event.target.value)}
                    style={{
                      background: isDark ? "#0f1b2d" : "#ffffff",
                      border: cardBorder,
                      borderRadius: 10,
                      padding: "9px 10px",
                      color: titleColor,
                      fontSize: 12,
                    }}
                  >
                    <option value="garage">Usar datos de Mis vehículos</option>
                    <option value="scratch">Empezar desde cero</option>
                  </select>
                </label>
              )}
            </div>

            <div
              style={{
                border: cardBorder,
                borderRadius: 10,
                padding: "10px 12px",
                background: managementCoverage.included
                  ? isDark
                    ? "rgba(16,185,129,0.16)"
                    : "rgba(16,185,129,0.1)"
                  : isDark
                  ? "rgba(245,158,11,0.16)"
                  : "rgba(245,158,11,0.1)",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: managementCoverage.included ? "#065f46" : "#92400e" }}>
                Cobertura de tu plan · {currentPlanLabel}
              </div>
              <div style={{ fontSize: 12, color: titleColor }}>
                {managementCoverage.included ? "Servicio incluido" : "Servicio de pago por gestión"} · {managementCoverage.estimatedPrice}
              </div>
              <div style={{ fontSize: 11, color: bodyColor }}>{managementCoverage.note}</div>
            </div>

            {garageVehiclesForValuation.length === 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: "#b45309" }}>
                  Primero sube al menos un vehículo en Mis vehículos para crear gestiones.
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
                onClick={submitManagementWizard}
                disabled={garageVehiclesForValuation.length === 0}
                style={{
                  background: garageVehiclesForValuation.length > 0 ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "rgba(148,163,184,0.24)",
                  border: "none",
                  color: garageVehiclesForValuation.length > 0 ? "#ffffff" : "#64748b",
                  padding: "9px 12px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: garageVehiclesForValuation.length > 0 ? "pointer" : "not-allowed",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                {managementCoverage.included ? "Incluido, continuar" : "Continuar como pago puntual"}
              </button>
              {!managementCoverage.included && (
                <button
                  type="button"
                  onClick={goToBillingForManagement}
                  style={{
                    background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
                    border: "none",
                    color: "#ffffff",
                    padding: "9px 12px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    width: isMobile ? "100%" : "auto",
                    boxShadow: "0 10px 18px rgba(2,132,199,0.22)",
                  }}
                >
                  Comprar gestión
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowManagementWizard(false)}
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

        {appointmentFeedback && <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>{appointmentFeedback}</div>}
        {valuationFeedback && <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>{valuationFeedback}</div>}
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
