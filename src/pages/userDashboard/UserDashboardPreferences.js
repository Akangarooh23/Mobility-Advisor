import { useEffect, useMemo, useState } from "react";
import { putUserPreferencesJson } from "../../utils/apiClient";

const PREFERENCES_STORAGE_KEY = "movilidad-advisor.userDashboard.preferences.v1";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readPreferences() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    const parsed = JSON.parse(raw || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writePreferences(value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(value || {}));
  } catch {}
}

export default function UserDashboardPreferences({
  themeMode,
  isMobile = false,
  panelStyle,
  currentUser,
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

  const initialState = useMemo(
    () => ({
      fullName: normalizeText(currentUser?.name),
      email: normalizeText(currentUser?.email).toLowerCase(),
      language: "es",
      region: "es",
      notifyPriceAlerts: true,
      notifyAppointments: true,
      notifyAnalysisReady: true,
      weeklyDigest: true,
    }),
    [currentUser?.email, currentUser?.name]
  );

  const [form, setForm] = useState(initialState);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const persisted = readPreferences();
    if (!persisted) {
      setForm(initialState);
      return;
    }

    setForm((prev) => ({
      ...prev,
      ...persisted,
      fullName: normalizeText(persisted?.fullName || initialState.fullName),
      email: normalizeText(persisted?.email || initialState.email).toLowerCase(),
    }));
  }, [initialState]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const save = () => {
    writePreferences(form);
    void putUserPreferencesJson(form).catch(() => {});
    setFeedback("Preferencias guardadas correctamente.");
    if (typeof window !== "undefined") {
      window.setTimeout(() => setFeedback(""), 2200);
    }
  };

  const inputStyle = {
    width: "100%",
    background: isDark ? "#0f1b2d" : "#ffffff",
    border: cardBorder,
    borderRadius: 8,
    color: isDark ? "#f8fafc" : "#0f172a",
    padding: "8px 10px",
    fontSize: 12,
    boxSizing: "border-box",
  };

  const toggleButton = (checked) => ({
    background: checked ? "rgba(16,185,129,0.16)" : "rgba(148,163,184,0.12)",
    border: checked ? "1px solid rgba(110,231,183,0.24)" : "1px solid rgba(148,163,184,0.2)",
    color: checked ? "#065f46" : (isDark ? "#cbd5e1" : "#475569"),
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <section id="user-dashboard-preferences" style={{ ...panelStyle, ...sectionFrame, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.6px" }}>PREFERENCIAS</div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: titleColor }}>Ajustes de usuario y notificaciones</div>
          <div style={{ fontSize: 12, color: bodyColor, marginTop: 4 }}>
            Define idioma, region y como quieres recibir avisos.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))" }}>
        <div style={{ background: cardBg, border: panelBorder, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: titleColor, marginBottom: 8 }}>Perfil</div>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
              Nombre
              <input value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
              Email
              <input value={form.email} onChange={(event) => updateField("email", event.target.value)} style={inputStyle} />
            </label>
          </div>
        </div>

        <div style={{ background: cardBg, border: panelBorder, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: titleColor, marginBottom: 8 }}>Idioma y region</div>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
              Idioma
              <select value={form.language} onChange={(event) => updateField("language", event.target.value)} style={inputStyle}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: bodyColor }}>
              Region
              <select value={form.region} onChange={(event) => updateField("region", event.target.value)} style={inputStyle}>
                <option value="es">España</option>
                <option value="eu">Europa</option>
              </select>
            </label>
          </div>
        </div>

        <div style={{ gridColumn: isMobile ? "auto" : "1 / -1", background: cardBg, border: panelBorder, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: titleColor, marginBottom: 8 }}>Notificaciones</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" onClick={() => updateField("notifyPriceAlerts", !form.notifyPriceAlerts)} style={toggleButton(form.notifyPriceAlerts)}>
              Alertas de precio: {form.notifyPriceAlerts ? "ON" : "OFF"}
            </button>
            <button type="button" onClick={() => updateField("notifyAppointments", !form.notifyAppointments)} style={toggleButton(form.notifyAppointments)}>
              Citas y gestiones: {form.notifyAppointments ? "ON" : "OFF"}
            </button>
            <button type="button" onClick={() => updateField("notifyAnalysisReady", !form.notifyAnalysisReady)} style={toggleButton(form.notifyAnalysisReady)}>
              Analisis listos: {form.notifyAnalysisReady ? "ON" : "OFF"}
            </button>
            <button type="button" onClick={() => updateField("weeklyDigest", !form.weeklyDigest)} style={toggleButton(form.weeklyDigest)}>
              Resumen semanal: {form.weeklyDigest ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={save}
          style={{
            background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
            border: "none",
            color: "#ffffff",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            padding: "10px 12px",
            cursor: "pointer",
          }}
        >
          Guardar preferencias
        </button>
        {feedback && <span style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>{feedback}</span>}
      </div>
    </section>
  );
}
