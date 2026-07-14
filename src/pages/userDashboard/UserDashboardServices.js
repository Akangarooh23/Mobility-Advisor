import { useState, useEffect } from "react";
import {
  getServiceRequestsJson,
  postServiceRequestJson,
  getGarageVehiclesJson,
} from "../../utils/apiClient";

const SERVICE_TYPES = [
  { key: "itv",        label: "ITV",                       icon: "🔍" },
  { key: "aceite",     label: "Aceite y filtros",           icon: "🛢️" },
  { key: "revision",   label: "Revisión general",           icon: "🔧" },
  { key: "frenos",     label: "Frenos",                     icon: "🛑" },
  { key: "neumaticos", label: "Neumáticos",                 icon: "🔄" },
  { key: "cristales",  label: "Cristales / parabrisas",     icon: "🪟" },
  { key: "diagnosis",  label: "Diagnosis electrónica",      icon: "💻" },
  { key: "carroceria", label: "Carrocería y pintura",       icon: "🎨" },
  { key: "otro",       label: "Otro",                       icon: "➕" },
];

const PARTNERS = [
  { key: "mejor_precio", label: "Mejor precio disponible" },
  { key: "norauto",      label: "Norauto" },
  { key: "midas",        label: "Midas" },
  { key: "carglass",     label: "Carglass" },
  { key: "euromaster",   label: "Euromaster" },
];

const PROVINCES = [
  "Álava","Albacete","Alicante","Almería","Asturias","Ávila","Badajoz","Barcelona","Burgos",
  "Cáceres","Cádiz","Cantabria","Castellón","Ciudad Real","Córdoba","La Coruña","Cuenca",
  "Gerona","Granada","Guadalajara","Guipúzcoa","Huelva","Huesca","Islas Baleares","Jaén",
  "La Rioja","Las Palmas","León","Lérida","Lugo","Madrid","Málaga","Murcia","Navarra",
  "Orense","Palencia","Pontevedra","Salamanca","Santa Cruz de Tenerife","Segovia","Sevilla",
  "Soria","Tarragona","Teruel","Toledo","Valencia","Valladolid","Vizcaya","Zamora","Zaragoza",
  "Ceuta","Melilla",
];

const STATUS_LABELS = {
  pending:    "Pendiente",
  in_review:  "En revisión",
  contacted:  "Contactado",
  scheduled:  "Cita confirmada",
  closed:     "Cerrado",
};
const STATUS_COLORS = {
  pending:    { bg: "rgba(245,158,11,0.12)", color: "#92400e" },
  in_review:  { bg: "rgba(139,92,246,0.12)", color: "#5b21b6" },
  contacted:  { bg: "rgba(59,130,246,0.12)", color: "#1d4ed8" },
  scheduled:  { bg: "rgba(16,185,129,0.15)", color: "#065f46" },
  closed:     { bg: "rgba(100,116,139,0.12)", color: "#475569" },
};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default function UserDashboardServices({ themeMode, panelStyle, currentUser }) {
  const isDark = themeMode === "dark";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";
  const cardBg = isDark ? "rgba(15,23,42,0.70)" : "rgba(255,255,255,0.96)";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.18)" : "1px solid rgba(148,163,184,0.26)";

  const [tab, setTab] = useState("new");
  const [vehicles, setVehicles] = useState([]);
  const [pastRequests, setPastRequests] = useState([]);
  const [loadingPast, setLoadingPast] = useState(false);

  // Form state
  const [serviceType, setServiceType] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleTitle, setVehicleTitle] = useState("");
  const [partner, setPartner] = useState("mejor_precio");
  const [province, setProvince] = useState("");
  const [dates, setDates] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  const userEmail = currentUser?.email || "";

  useEffect(() => {
    if (!userEmail) return;
    getGarageVehiclesJson(userEmail)
      .then(({ response, data }) => {
        if (response.ok && Array.isArray(data?.vehicles)) {
          setVehicles(data.vehicles.filter((v) => v && v.id));
        }
      })
      .catch(() => {});
  }, [userEmail]);

  useEffect(() => {
    if (tab !== "history" || !userEmail) return;
    setLoadingPast(true);
    getServiceRequestsJson()
      .then(({ response, data }) => {
        if (response.ok && Array.isArray(data?.requests)) setPastRequests(data.requests);
      })
      .catch(() => {})
      .finally(() => setLoadingPast(false));
  }, [tab, userEmail]);

  function handleVehicleChange(e) {
    const id = e.target.value;
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    setVehicleTitle(v ? [v.brand, v.model, v.year].filter(Boolean).join(" ") : "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!serviceType) { setError("Selecciona el tipo de servicio."); return; }
    setError("");
    setSubmitting(true);
    try {
      const { response, data } = await postServiceRequestJson({
        service_type: serviceType,
        vehicle_id: vehicleId || null,
        vehicle_title: vehicleTitle || null,
        preferred_partner: partner,
        preferred_province: province || null,
        preferred_dates: dates || null,
        notes: notes || null,
      });
      if (!response.ok) throw new Error(data?.error || "Error al enviar.");
      setSubmitted({ id: data.id, service_type: serviceType });
      setServiceType(""); setVehicleId(""); setVehicleTitle("");
      setPartner("mejor_precio"); setProvince(""); setDates(""); setNotes("");
    } catch (err) {
      setError(err.message || "Error desconocido.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 12px",
    borderRadius: 8,
    border: isDark ? "1px solid rgba(148,163,184,0.28)" : "1px solid #cbd5e1",
    background: isDark ? "rgba(15,23,42,0.60)" : "#fff",
    color: isDark ? "#e2e8f0" : "#0f172a",
    fontSize: 14,
    outline: "none",
  };

  const labelStyle = { fontSize: 12, fontWeight: 700, color: bodyColor, marginBottom: 4, display: "block" };

  return (
    <div>
      {/* Hero banner */}
      <div
        style={{
          background: isDark
            ? "linear-gradient(135deg,rgba(30,64,175,0.36),rgba(79,70,229,0.28))"
            : "linear-gradient(135deg,rgba(219,234,254,0.9),rgba(224,231,255,0.7))",
          border: isDark ? "1px solid rgba(99,102,241,0.30)" : "1px solid rgba(99,102,241,0.22)",
          borderRadius: 14,
          padding: "20px 22px",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.09em", color: "#6366f1", marginBottom: 6 }}>
          TARIFA PROFESIONAL CARSWISE
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: isDark ? "#e0e7ff" : "#1e1b4b", marginBottom: 6 }}>
          Precios de taller para profesionales y flotas
        </div>
        <div style={{ fontSize: 13, color: isDark ? "#a5b4fc" : "#4338ca", lineHeight: 1.5 }}>
          Accede a tarifas negociadas para flotas y gestores de flota — normalmente un{" "}
          <strong>15–30% por debajo del precio de mostrador</strong>. Nuestro equipo gestiona
          la cita y el precio directamente con el taller.
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { key: "new", label: "Nueva solicitud" },
          { key: "history", label: "Mis solicitudes" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: tab === t.key
                ? "1px solid rgba(99,102,241,0.40)"
                : (isDark ? "1px solid rgba(148,163,184,0.18)" : "1px solid #e2e8f0"),
              background: tab === t.key
                ? (isDark ? "rgba(99,102,241,0.22)" : "rgba(224,231,255,0.9)")
                : (isDark ? "rgba(15,23,42,0.60)" : "#fff"),
              color: tab === t.key ? "#4338ca" : bodyColor,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* NEW REQUEST FORM */}
      {tab === "new" && (
        <div
          style={{
            background: cardBg,
            border: cardBorder,
            borderRadius: 14,
            padding: "22px 20px",
          }}
        >
          {submitted ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: titleColor, marginBottom: 8 }}>
                Solicitud enviada
              </div>
              <div style={{ fontSize: 13, color: bodyColor, marginBottom: 20 }}>
                Recibirás confirmación por email en <strong>24–48h hábiles</strong>.
                Nuestro equipo gestionará precio y disponibilidad con el taller.
              </div>
              <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", marginBottom: 20 }}>
                Ref: {submitted.id}
              </div>
              <button
                type="button"
                onClick={() => setSubmitted(null)}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "1px solid rgba(99,102,241,0.40)",
                  background: isDark ? "rgba(99,102,241,0.18)" : "rgba(224,231,255,0.9)",
                  color: "#4338ca",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Nueva solicitud
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Service type */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Tipo de servicio *</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8 }}>
                  {SERVICE_TYPES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setServiceType(s.key)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 10,
                        border: serviceType === s.key
                          ? "2px solid #6366f1"
                          : (isDark ? "1px solid rgba(148,163,184,0.22)" : "1px solid #e2e8f0"),
                        background: serviceType === s.key
                          ? (isDark ? "rgba(99,102,241,0.28)" : "rgba(224,231,255,0.95)")
                          : (isDark ? "rgba(15,23,42,0.50)" : "#f8fafc"),
                        color: serviceType === s.key ? "#4338ca" : bodyColor,
                        fontSize: 12,
                        fontWeight: serviceType === s.key ? 800 : 600,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle */}
              {vehicles.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Vehículo (opcional)</label>
                  <select style={inputStyle} value={vehicleId} onChange={handleVehicleChange}>
                    <option value="">Sin especificar</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {[v.brand, v.model, v.year, v.license_plate].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Partner + Province */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Taller preferido</label>
                  <select style={inputStyle} value={partner} onChange={(e) => setPartner(e.target.value)}>
                    {PARTNERS.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Provincia</label>
                  <select style={inputStyle} value={province} onChange={(e) => setProvince(e.target.value)}>
                    <option value="">Cualquier provincia</option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Fechas preferidas (opcional)</label>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="Ej: semana del 15/07, mañanas, flexible..."
                  value={dates}
                  onChange={(e) => setDates(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Observaciones (opcional)</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                  placeholder="Detalles adicionales, síntomas, historial de revisiones..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {error && (
                <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>
              )}

              <button
                type="submit"
                disabled={submitting || !serviceType}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: 10,
                  border: "none",
                  background: submitting || !serviceType
                    ? (isDark ? "rgba(99,102,241,0.30)" : "rgba(99,102,241,0.35)")
                    : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: submitting || !serviceType ? "default" : "pointer",
                  letterSpacing: "-0.01em",
                }}
              >
                {submitting ? "Enviando…" : "Solicitar con tarifa profesional"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* HISTORY */}
      {tab === "history" && (
        <div>
          {loadingPast ? (
            <div style={{ color: bodyColor, fontSize: 13, padding: "24px 0" }}>Cargando solicitudes…</div>
          ) : pastRequests.length === 0 ? (
            <div
              style={{
                background: cardBg, border: cardBorder, borderRadius: 14,
                padding: "36px 20px", textAlign: "center",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 14, color: bodyColor }}>Todavía no tienes solicitudes de servicio.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {pastRequests.map((r) => {
                const svc = SERVICE_TYPES.find((s) => s.key === r.service_type);
                const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                return (
                  <div
                    key={r.id}
                    style={{
                      background: cardBg, border: cardBorder, borderRadius: 12,
                      padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start",
                    }}
                  >
                    <div style={{ fontSize: 22, lineHeight: 1 }}>{svc?.icon || "🔧"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: titleColor }}>
                          {svc?.label || r.service_type}
                        </span>
                        <span
                          style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                            background: sc.bg, color: sc.color,
                          }}
                        >
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </div>
                      {r.vehicle_title && (
                        <div style={{ fontSize: 12, color: bodyColor, marginBottom: 2 }}>
                          {r.vehicle_title}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: isDark ? "#64748b" : "#94a3b8" }}>
                        {[r.preferred_partner, r.preferred_province].filter(Boolean).join(" · ")}{" "}
                        · {formatDate(r.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
