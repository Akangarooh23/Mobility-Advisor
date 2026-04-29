import { useMemo, useState } from "react";
import { postAlertEmailDigestJson } from "../utils/apiClient";

export default function ServiceAutogestorPage({ styles, onGoBack, onGoHome, themeMode }) {
  const isDark = themeMode === "dark";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
    : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))";
  const inputBg = isDark ? "#0f1b2d" : "#ffffff";
  const inputText = isDark ? "#f8fafc" : "#0f172a";
  const titleColor = isDark ? "#f8fafc" : "#000000";
  const bodyColor = isDark ? "#cbd5e1" : "#334155";
  const secondaryBtnStyle = {
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(148,163,184,0.35)",
    color: "#cbd5e1",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  };

  const [data, setData] = useState({
    plate: "",
    itvDate: "",
    insuranceRenewal: "",
    maintenanceDate: "",
  });
  const [active, setActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState("");

  const reminders = useMemo(() => {
    if (!active) {
      return [];
    }

    const entries = [];
    if (data.itvDate) entries.push(`Recordatorio ITV: ${data.itvDate}`);
    if (data.insuranceRenewal) entries.push(`Renovación seguro: ${data.insuranceRenewal}`);
    if (data.maintenanceDate) entries.push(`Próximo mantenimiento: ${data.maintenanceDate}`);
    if (data.plate) entries.push(`Expediente digital activo para matrícula ${data.plate.toUpperCase()}`);
    return entries;
  }, [active, data]);

  async function activateAutoManager() {
    if (isSubmitting) {
      return;
    }

    setActive(true);
    setIsSubmitting(true);
    setSubmitFeedback("");

    try {
      const { response, data: apiData } = await postAlertEmailDigestJson({
        to: ["hola@carswise.es"],
        subject: `CarsWise · Solicitud AutoGestor${data.plate ? ` · ${data.plate.toUpperCase()}` : ""}`,
        text: [
          "Nueva solicitud del servicio AutoGestor.",
          `Matrícula: ${data.plate || "No indicada"}`,
          `ITV: ${data.itvDate || "No indicada"}`,
          `Renovación seguro: ${data.insuranceRenewal || "No indicada"}`,
          `Mantenimiento: ${data.maintenanceDate || "No indicado"}`,
        ].join("\n"),
      });

      if (!response.ok || !apiData?.ok) {
        throw new Error(apiData?.error || "No se pudo activar AutoGestor.");
      }

      setSubmitFeedback("Solicitud enviada. El equipo revisará los hitos y activará el seguimiento.");
    } catch (error) {
      setSubmitFeedback(error instanceof Error ? error.message : "No se pudo activar AutoGestor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <style>
        {`
          .service-field-card {
            border: 1px solid rgba(148,163,184,0.35);
            border-radius: 14px;
            padding: 12px;
            background: ${isDark
              ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
              : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))"};
            box-shadow: 0 8px 22px rgba(15,23,42,0.08);
            transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease;
          }

          .service-field-card:hover,
          .service-field-card:focus-within {
            transform: translateY(-2px);
            border-color: rgba(14,165,233,0.5);
            box-shadow: 0 14px 26px rgba(14,116,144,0.14);
          }

          .service-field-label {
            font-size: 12px;
            color: ${isDark ? "#cbd5e1" : "#334155"};
            font-weight: 700;
            margin-bottom: 6px;
          }
        `}
      </style>

      <button type="button" onClick={onGoBack} style={{ ...secondaryBtnStyle, marginBottom: 18 }}>
        ← Volver
      </button>

      <div style={{ ...styles.blockBadge("Uso real"), marginBottom: 10 }}>🤖 AUTOGESTOR IA</div>
      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,4vw,36px)", color: titleColor }}>
        Centro de control integral del vehículo
      </h2>
      <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
        Centraliza eventos, documentos y vencimientos con recordatorios automáticos y trazabilidad completa.
      </p>

      <div className="ma-fade-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16, animationDelay: "60ms" }}>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Matrícula</div>
          <input
            value={data.plate}
            onChange={(e) => setData((p) => ({ ...p, plate: e.target.value }))}
            style={{ ...styles.input, background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)" }}
            placeholder="1234ABC"
          />
        </label>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">ITV</div>
          <input
            type="date"
            value={data.itvDate}
            onChange={(e) => setData((p) => ({ ...p, itvDate: e.target.value }))}
            style={{ ...styles.input, background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)" }}
          />
        </label>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Renovación seguro</div>
          <input
            type="date"
            value={data.insuranceRenewal}
            onChange={(e) => setData((p) => ({ ...p, insuranceRenewal: e.target.value }))}
            style={{ ...styles.input, background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)" }}
          />
        </label>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Mantenimiento</div>
          <input
            type="date"
            value={data.maintenanceDate}
            onChange={(e) => setData((p) => ({ ...p, maintenanceDate: e.target.value }))}
            style={{ ...styles.input, background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)" }}
          />
        </label>
      </div>

      <div className="ma-fade-stagger" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, animationDelay: "130ms" }}>
        <button type="button" className="ma-card-soft" style={styles.btn} onClick={activateAutoManager} disabled={isSubmitting}>
          {isSubmitting ? "Activando..." : "Activar AutoGestor"}
        </button>
        <button type="button" className="ma-card-soft" style={secondaryBtnStyle} onClick={onGoHome}>
          Ir al inicio
        </button>
      </div>

      {submitFeedback ? (
        <div style={{ marginBottom: 16, fontSize: 13, color: submitFeedback.toLowerCase().includes("no se pudo") ? "#b91c1c" : bodyColor }}>
          {submitFeedback}
        </div>
      ) : null}

      {active && (
        <div
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.panel,
            animationDelay: "180ms",
            background: cardBg,
            border: "1px solid rgba(148,163,184,0.35)",
          }}
        >
          <div style={{ fontSize: 12, color: "#67e8f9", marginBottom: 6 }}>RECORDATORIOS ACTIVOS</div>
          {reminders.length === 0 ? (
            <div style={{ fontSize: 13, color: bodyColor }}>Completa al menos un campo para generar avisos.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {reminders.map((item) => (
                <div key={item} style={{ fontSize: 13, color: bodyColor, lineHeight: 1.5 }}>
                  • {item}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
