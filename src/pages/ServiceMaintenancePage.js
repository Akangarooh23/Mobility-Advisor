import { useMemo, useState } from "react";
import { postAlertEmailDigestJson } from "../utils/apiClient";

const PLAN_BASE = {
  esencial: 29,
  completo: 49,
  premium: 79,
};

export default function ServiceMaintenancePage({ styles, onGoBack, onGoHome, themeMode }) {
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

  const [plan, setPlan] = useState("completo");
  const [km, setKm] = useState("15000");
  const [carAge, setCarAge] = useState("4");
  const [showPlan, setShowPlan] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState("");

  const estimate = useMemo(() => {
    const annualKm = Number(km || 0);
    const age = Number(carAge || 0);
    const kmFactor = annualKm > 25000 ? 22 : annualKm > 18000 ? 14 : 8;
    const ageFactor = age > 8 ? 18 : age > 5 ? 11 : 6;
    const monthly = PLAN_BASE[plan] + kmFactor + ageFactor;

    return {
      monthly,
      yearly: monthly * 12,
      emergencyAvoided: Math.round(monthly * 0.45),
    };
  }, [plan, km, carAge]);

  async function requestMaintenancePlan() {
    if (isSubmitting) {
      return;
    }

    setShowPlan(true);
    setIsSubmitting(true);
    setSubmitFeedback("");

    try {
      const { response, data } = await postAlertEmailDigestJson({
        to: ["hola@carswise.es"],
        subject: "CarsWise · Solicitud mantenimiento",
        text: [
          "Nueva solicitud de plan de mantenimiento.",
          `Plan: ${plan}`,
          `Km anuales: ${km}`,
          `Edad del coche: ${carAge}`,
          `Cuota estimada: ${estimate.monthly} EUR/mes`,
          `Total anual estimado: ${estimate.yearly} EUR`,
        ].join("\n"),
      });

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo registrar la solicitud.");
      }

      setSubmitFeedback("Solicitud enviada. El equipo revisará tu propuesta de mantenimiento.");
    } catch (error) {
      setSubmitFeedback(error instanceof Error ? error.message : "No se pudo registrar la solicitud.");
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

      <div style={{ ...styles.blockBadge("Pricing"), marginBottom: 10 }}>🔧 MANTENIMIENTO</div>
      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,4vw,36px)", color: titleColor }}>
        Cuota mensual de mantenimiento
      </h2>
      <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
        Evita picos de gasto agrupando revisiones, mano de obra y piezas en una cuota previsible.
      </p>

      <div className="ma-fade-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16, animationDelay: "60ms" }}>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Plan</div>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            style={{ ...styles.select, background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)" }}
          >
            <option value="esencial">Esencial</option>
            <option value="completo">Completo</option>
            <option value="premium">Premium</option>
          </select>
        </label>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Km anuales</div>
          <input
            value={km}
            onChange={(e) => setKm(e.target.value)}
            style={{ ...styles.input, background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)" }}
          />
        </label>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Edad del coche (años)</div>
          <input
            value={carAge}
            onChange={(e) => setCarAge(e.target.value)}
            style={{ ...styles.input, background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)" }}
          />
        </label>
      </div>

      <div className="ma-fade-stagger" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, animationDelay: "130ms" }}>
        <button type="button" className="ma-card-soft" style={styles.btn} onClick={requestMaintenancePlan} disabled={isSubmitting}>
          {isSubmitting ? "Enviando..." : "Ver cuota recomendada"}
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

      {showPlan && (
        <div
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.panel,
            animationDelay: "180ms",
            background: cardBg,
            border: "1px solid rgba(148,163,184,0.35)",
          }}
        >
          <div style={{ fontSize: 12, color: "#67e8f9", marginBottom: 6 }}>PROPUESTA</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: titleColor, marginBottom: 8 }}>
            {estimate.monthly} €/mes ({plan})
          </div>
          <div style={{ color: bodyColor, fontSize: 13, lineHeight: 1.6 }}>
            Total anual estimado: {estimate.yearly} € · Coste imprevisto amortizado estimado: {estimate.emergencyAvoided} €/mes.
          </div>
        </div>
      )}
    </div>
  );
}
