import { useEffect, useMemo, useRef, useState } from "react";

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

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (!size) {
    return "0 KB";
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function writeGarageVehicles(currentUserEmail = "", items = []) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const safeItems = Array.isArray(items) ? items.slice(0, 20) : [];
    window.localStorage.setItem(getGarageStorageKey(currentUserEmail), JSON.stringify(safeItems));
  } catch {}
}

export default function UserDashboardVehicles({
  themeMode,
  userVehicleSections,
  dashboardVehicleCount,
  panelStyle,
  getOfferBadgeStyle,
  onRequestAppointment = () => {},
  onNavigate = () => {},
  onBrowseMarketplace = () => {},
  currentUserEmail = "",
}) {
  const isDark = themeMode === "dark";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";
  const panelBorder = isDark ? "1px solid rgba(148,163,184,0.26)" : "1px solid rgba(59,130,246,0.34)";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.24)" : "1px solid rgba(37,99,235,0.3)";
  const elevatedShadow = isDark ? "0 18px 30px rgba(2,6,23,0.4)" : "0 14px 28px rgba(15,23,42,0.08)";
  const subtleShadow = isDark ? "0 8px 16px rgba(2,6,23,0.28)" : "0 8px 18px rgba(15,23,42,0.06)";
  const inputBg = isDark ? "#0f1b2d" : "#ffffff";

  const [activeVehicleTab, setActiveVehicleTab] = useState("my-garage");
  const [myVehicles, setMyVehicles] = useState(() => readGarageVehicles(currentUserEmail));
  const [vehicleFeedback, setVehicleFeedback] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const [vehicleForm, setVehicleForm] = useState({
    nickname: "",
    brand: "",
    model: "",
    year: "",
    plate: "",
    mileage: "",
    fuel: "",
    policyCompany: "",
    notes: "",
  });
  const photoInputRef = useRef(null);
  const documentInputRef = useRef(null);

  const safeSections = useMemo(() => (Array.isArray(userVehicleSections) ? userVehicleSections : []), [userVehicleSections]);

  const totalVehiclesCount = dashboardVehicleCount + myVehicles.length;

  useEffect(() => {
    setMyVehicles(readGarageVehicles(currentUserEmail));
  }, [currentUserEmail]);

  useEffect(() => {
    writeGarageVehicles(currentUserEmail, myVehicles);
  }, [currentUserEmail, myVehicles]);

  useEffect(() => {
    if (activeVehicleTab === "overview" || activeVehicleTab === "my-garage") {
      return;
    }

    const exists = safeSections.some((section) => section.key === activeVehicleTab);
    if (!exists) {
      setActiveVehicleTab("overview");
    }
  }, [activeVehicleTab, safeSections]);

  const selectedSection = safeSections.find((section) => section.key === activeVehicleTab) || null;

  const vehicleTabs = [
    {
      key: "my-garage",
      title: "Mis vehículos",
      count: myVehicles.length,
    },
    ...safeSections.map((section) => ({
      key: section.key,
      title: section.title,
      count: Array.isArray(section.items) ? section.items.length : 0,
    })),
  ];

  const lifecycleTotals = safeSections.reduce(
    (acc, section) => {
      const size = Array.isArray(section.items) ? section.items.length : 0;

      if (section.key === "owned") {
        acc.owned += size;
      } else if (section.key === "active-sale") {
        acc.activeSale += size;
      } else if (section.key === "sold") {
        acc.sold += size;
      }

      return acc;
    },
    { owned: 0, activeSale: 0, sold: 0 }
  );

  const updateVehicleForm = (field, value) => {
    setVehicleForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addVehicleToGarage = () => {
    const brand = normalizeText(vehicleForm.brand);
    const model = normalizeText(vehicleForm.model);

    if (!brand || !model) {
      setVehicleFeedback("Añade al menos marca y modelo para guardar tu vehículo.");
      return;
    }

    const nickname = normalizeText(vehicleForm.nickname);
    const title = nickname || `${brand} ${model}`;

    const vehicle = {
      id: `garage-${Date.now()}`,
      title,
      brand,
      model,
      year: normalizeText(vehicleForm.year),
      plate: normalizeText(vehicleForm.plate),
      mileage: normalizeText(vehicleForm.mileage),
      fuel: normalizeText(vehicleForm.fuel),
      policyCompany: normalizeText(vehicleForm.policyCompany),
      notes: normalizeText(vehicleForm.notes),
      photos: pendingPhotos.map((file) => ({ name: file.name, size: Number(file.size || 0) })),
      documents: pendingDocuments.map((file) => ({ name: file.name, size: Number(file.size || 0) })),
      createdAt: new Date().toISOString(),
    };

    setMyVehicles((prev) => [vehicle, ...prev].slice(0, 20));
    setVehicleForm({
      nickname: "",
      brand: "",
      model: "",
      year: "",
      plate: "",
      mileage: "",
      fuel: "",
      policyCompany: "",
      notes: "",
    });
    setPendingPhotos([]);
    setPendingDocuments([]);
    setVehicleFeedback(`Vehículo ${title} guardado en Mis vehículos.`);
  };

  const removeVehicleFromGarage = (vehicleId) => {
    setMyVehicles((prev) => prev.filter((vehicle) => vehicle.id !== vehicleId));
    setVehicleFeedback("Vehículo eliminado de Mis vehículos.");
  };

  const handleVehicleAction = (action, vehicle) => {
    const vehicleLabel = vehicle?.title || `${vehicle?.brand || "Vehículo"} ${vehicle?.model || ""}`.trim();

    if (action === "appointment") {
      onRequestAppointment("workshop");
      setVehicleFeedback(`Cita solicitada para ${vehicleLabel}.`);
      return;
    }

    if (action === "valuation") {
      onNavigate("valuations");
      return;
    }

    if (action === "marketplace") {
      onBrowseMarketplace({
        brand: vehicle?.brand,
        model: vehicle?.model,
        fuel: vehicle?.fuel,
      });
      return;
    }

    if (action === "insurance") {
      setVehicleFeedback(`Gestión de seguro iniciada para ${vehicleLabel}.`);
    }
  };

  return (
    <section id="user-dashboard-vehicles" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#34d399", letterSpacing: "0.6px" }}>MIS VEHÍCULOS</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: titleColor }}>Hub de ciclo de vida de vehículos</div>
          <div style={{ fontSize: 12, color: bodyColor, marginTop: 4 }}>
            Controla en una sola vista tus coches comprados, activos en venta y operaciones cerradas.
          </div>
        </div>
        <span style={{ ...getOfferBadgeStyle("green"), fontSize: 11 }}>
          {totalVehiclesCount} registros
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(148,163,184,0.2)",
        }}
      >
        {vehicleTabs.map((tab) => {
          const count = Number(tab.count || 0);
          const isActive = activeVehicleTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveVehicleTab(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: isActive
                  ? "linear-gradient(135deg,#10b981,#059669)"
                  : isDark
                  ? "rgba(15,23,42,0.88)"
                  : "rgba(255,255,255,0.95)",
                border: isActive ? "none" : cardBorder,
                color: isActive ? "#ecfdf5" : isDark ? "#e2e8f0" : "#334155",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span>{tab.title}</span>
              <span style={{ background: isActive ? "rgba(255,255,255,0.16)" : "rgba(148,163,184,0.14)", borderRadius: 999, padding: "2px 7px", fontSize: 11 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {activeVehicleTab === "my-garage" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            {[
              ["Mis vehículos", myVehicles.length, "#2563eb"],
              ["Comprados", lifecycleTotals.owned, "#60a5fa"],
              ["Activos en venta", lifecycleTotals.activeSale, "#f59e0b"],
              ["Vendidos", lifecycleTotals.sold, "#34d399"],
            ].map(([label, value, color]) => (
              <div
                key={String(label)}
                style={{
                  background: isDark
                    ? "linear-gradient(155deg, rgba(15,23,42,0.94), rgba(30,41,59,0.9))"
                    : "linear-gradient(155deg, rgba(255,255,255,0.98), rgba(241,245,249,0.95))",
                  border: panelBorder,
                  boxShadow: subtleShadow,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: bodyColor, fontWeight: 700 }}>{label}</div>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      background: `${String(color)}22`,
                      border: `1px solid ${String(color)}66`,
                    }}
                  />
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: String(color), lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: isDark
                ? "linear-gradient(150deg, rgba(15,23,42,0.96), rgba(13,27,49,0.9))"
                : "linear-gradient(150deg, rgba(255,255,255,0.98), rgba(239,246,255,0.88))",
              border: panelBorder,
              boxShadow: elevatedShadow,
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: titleColor }}>Añadir vehículo propio</div>
                <div style={{ fontSize: 11, color: bodyColor, marginTop: 3 }}>Crea tu garage personal con fotos, documentación y acciones rápidas.</div>
              </div>
              <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, background: "rgba(37,99,235,0.1)", border: cardBorder, borderRadius: 999, padding: "5px 9px" }}>
                Máximo 20 vehículos
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Alias / nombre
                <input
                  value={vehicleForm.nickname}
                  onChange={(event) => updateVehicleForm("nickname", event.target.value)}
                  placeholder="Ejemplo: Coche familiar"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Marca
                <input
                  value={vehicleForm.brand}
                  onChange={(event) => updateVehicleForm("brand", event.target.value)}
                  placeholder="Marca"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Modelo
                <input
                  value={vehicleForm.model}
                  onChange={(event) => updateVehicleForm("model", event.target.value)}
                  placeholder="Modelo"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Año
                <input
                  value={vehicleForm.year}
                  onChange={(event) => updateVehicleForm("year", event.target.value)}
                  placeholder="2021"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Matrícula
                <input
                  value={vehicleForm.plate}
                  onChange={(event) => updateVehicleForm("plate", event.target.value)}
                  placeholder="1234 ABC"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Kilometraje
                <input
                  value={vehicleForm.mileage}
                  onChange={(event) => updateVehicleForm("mileage", event.target.value)}
                  placeholder="85000"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Combustible
                <input
                  value={vehicleForm.fuel}
                  onChange={(event) => updateVehicleForm("fuel", event.target.value)}
                  placeholder="Gasolina, Diésel, Híbrido..."
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
                Aseguradora
                <input
                  value={vehicleForm.policyCompany}
                  onChange={(event) => updateVehicleForm("policyCompany", event.target.value)}
                  placeholder="Compañía de seguro"
                  style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", marginTop: 10 }}>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Fotos del vehículo</div>
                <input
                  ref={photoInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(event) => setPendingPhotos(Array.from(event.target.files || []))}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    width: "100%",
                    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 10,
                    padding: "9px 12px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 10px 16px rgba(37,99,235,0.22)",
                  }}
                >
                  <span>Subir fotos</span>
                  <span style={{ fontSize: 11, opacity: 0.95 }}>{pendingPhotos.length} seleccionadas</span>
                </button>
                <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>JPG, PNG, WEBP · selección múltiple</span>
              </div>
              <div style={{ display: "grid", gap: 7, fontSize: 12, color: bodyColor }}>
                <div>Documentación (PDF/imagen)</div>
                <input
                  ref={documentInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={(event) => setPendingDocuments(Array.from(event.target.files || []))}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => documentInputRef.current?.click()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    width: "100%",
                    background: "linear-gradient(135deg,#0f766e,#0e7490)",
                    color: "#ecfeff",
                    border: "none",
                    borderRadius: 10,
                    padding: "9px 12px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 10px 16px rgba(14,116,144,0.2)",
                  }}
                >
                  <span>Subir documentos</span>
                  <span style={{ fontSize: 11, opacity: 0.95 }}>{pendingDocuments.length} seleccionados</span>
                </button>
                <span style={{ fontSize: 11, color: "#0f766e", fontWeight: 700 }}>PDF, JPG, PNG · selección múltiple</span>
              </div>
            </div>

            <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor, marginTop: 10 }}>
              Notas
              <textarea
                value={vehicleForm.notes}
                onChange={(event) => updateVehicleForm("notes", event.target.value)}
                placeholder="Añade observaciones relevantes del vehículo"
                rows={3}
                style={{ background: inputBg, border: cardBorder, borderRadius: 10, padding: "9px 10px", color: titleColor, resize: "vertical" }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <button
                type="button"
                onClick={addVehicleToGarage}
                style={{
                  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  boxShadow: "0 10px 18px rgba(37,99,235,0.24)",
                  padding: "10px 13px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Guardar en mis vehículos
              </button>
              <button
                type="button"
                onClick={() => setActiveVehicleTab("owned")}
                style={{
                  background: "rgba(37,99,235,0.1)",
                  color: "#1d4ed8",
                  border: cardBorder,
                  borderRadius: 10,
                  boxShadow: subtleShadow,
                  padding: "10px 13px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Ver estado en pipeline
              </button>
            </div>
            {vehicleFeedback && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>{vehicleFeedback}</div>
            )}
          </div>

          {myVehicles.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {myVehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  style={{
                    background: isDark
                      ? "linear-gradient(155deg, rgba(15,23,42,0.96), rgba(30,41,59,0.9))"
                      : "linear-gradient(155deg, rgba(255,255,255,0.99), rgba(239,246,255,0.86))",
                    border: panelBorder,
                    boxShadow: elevatedShadow,
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: titleColor }}>{vehicle.title}</div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: "#1d4ed8",
                            background: "rgba(37,99,235,0.12)",
                            border: cardBorder,
                            borderRadius: 999,
                            padding: "3px 7px",
                            letterSpacing: "0.2px",
                          }}
                        >
                          GARAGE
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: bodyColor, marginTop: 3 }}>
                        {vehicle.brand} {vehicle.model}
                        {vehicle.year ? ` · ${vehicle.year}` : ""}
                        {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                        {vehicle.mileage ? ` · ${vehicle.mileage} km` : ""}
                        {vehicle.fuel ? ` · ${vehicle.fuel}` : ""}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <span style={{ background: "rgba(37,99,235,0.12)", border: cardBorder, borderRadius: 999, padding: "4px 8px", fontSize: 11, color: "#1d4ed8" }}>
                          {Array.isArray(vehicle.photos) ? vehicle.photos.length : 0} fotos
                        </span>
                        <span style={{ background: "rgba(16,185,129,0.12)", border: cardBorder, borderRadius: 999, padding: "4px 8px", fontSize: 11, color: "#065f46" }}>
                          {Array.isArray(vehicle.documents) ? vehicle.documents.length : 0} documentos
                        </span>
                        <span style={{ background: "rgba(148,163,184,0.16)", border: cardBorder, borderRadius: 999, padding: "4px 8px", fontSize: 11, color: bodyColor }}>
                          Adjuntos: {formatBytes(
                            [...(Array.isArray(vehicle.photos) ? vehicle.photos : []), ...(Array.isArray(vehicle.documents) ? vehicle.documents : [])].reduce(
                              (acc, file) => acc + Number(file?.size || 0),
                              0
                            )
                          )}
                        </span>
                      </div>
                      {vehicle.policyCompany && (
                        <div style={{ fontSize: 11, color: "#0f766e", marginTop: 6 }}>
                          Seguro: {vehicle.policyCompany}
                        </div>
                      )}
                      {vehicle.notes && (
                        <div style={{ fontSize: 11, color: bodyColor, marginTop: 6, maxWidth: 620 }}>
                          {vehicle.notes}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2,minmax(130px,1fr))", minWidth: 280 }}>
                      <button
                        type="button"
                        onClick={() => handleVehicleAction("appointment", vehicle)}
                        style={{ background: "rgba(245,158,11,0.14)", border: "1px solid rgba(251,191,36,0.28)", color: "#92400e", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                      >
                        Solicitar cita
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVehicleAction("valuation", vehicle)}
                        style={{ background: "rgba(37,99,235,0.14)", border: "1px solid rgba(96,165,250,0.28)", color: "#1e3a8a", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                      >
                        Solicitar tasación
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVehicleAction("marketplace", vehicle)}
                        style={{ background: "rgba(16,185,129,0.14)", border: "1px solid rgba(110,231,183,0.28)", color: "#065f46", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                      >
                        Publicar en marketplace
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVehicleAction("insurance", vehicle)}
                        style={{ background: "rgba(14,116,144,0.14)", border: "1px solid rgba(103,232,249,0.28)", color: "#155e75", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                      >
                        Gestionar seguro
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVehicleFromGarage(vehicle.id)}
                        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(248,113,113,0.24)", color: "#b91c1c", borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left", gridColumn: "1 / -1" }}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              Todavía no tienes vehículos en tu área privada. Añade uno para empezar a gestionar citas, tasaciones, marketplace y seguro.
            </div>
          )}
        </div>
      )}

      {activeVehicleTab !== "overview" && selectedSection && (
        <div
          style={{
            background: cardBg,
            border: panelBorder,
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: titleColor }}>{selectedSection.title}</div>
            <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>
              {Array.isArray(selectedSection.items) ? selectedSection.items.length : 0} elementos
            </span>
          </div>

          {Array.isArray(selectedSection.items) && selectedSection.items.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {selectedSection.items.map((vehicle, index) => (
                <div
                  key={`${selectedSection.key}-${index}`}
                  style={{
                    background: isDark ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.92)",
                    border: cardBorder,
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: titleColor }}>{vehicle.title}</div>
                  <div style={{ fontSize: 12, color: bodyColor, marginTop: 3 }}>{vehicle.meta}</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: selectedSection.key === "active-sale" ? "#b45309" : "#047857", fontWeight: 700 }}>
                    {vehicle.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{selectedSection.empty}</div>
          )}
        </div>
      )}
    </section>
  );
}
