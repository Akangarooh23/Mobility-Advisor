import { useMemo, useState } from "react";

const PLAN_BASE = {
  esencial: 29,
  completo: 49,
  premium: 79,
};

export default function ServiceMaintenancePage({ styles, onGoBack, onGoHome }) {
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

  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <button type="button" onClick={onGoBack} style={{ ...secondaryBtnStyle, marginBottom: 18 }}>
        ← Volver
      </button>

      <div style={{ ...styles.blockBadge("Pricing"), marginBottom: 10 }}>🔧 MANTENIMIENTO</div>
      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,4vw,36px)", color: "#f8fafc" }}>
        Cuota mensual de mantenimiento
      </h2>
      <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
        Evita picos de gasto agrupando revisiones, mano de obra y piezas en una cuota previsible.
      </p>

      <div className="ma-fade-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16, animationDelay: "60ms" }}>
        <label className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 10, background: "rgba(15,23,42,0.35)" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Plan</div>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} style={styles.select}>
            <option value="esencial">Esencial</option>
            <option value="completo">Completo</option>
            <option value="premium">Premium</option>
          </select>
        </label>
        <label className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 10, background: "rgba(15,23,42,0.35)" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Km anuales</div>
          <input value={km} onChange={(e) => setKm(e.target.value)} style={styles.input} />
        </label>
        <label className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 10, background: "rgba(15,23,42,0.35)" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Edad del coche (años)</div>
          <input value={carAge} onChange={(e) => setCarAge(e.target.value)} style={styles.input} />
        </label>
      </div>

      <div className="ma-fade-stagger" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, animationDelay: "130ms" }}>
        <button type="button" className="ma-card-soft" style={styles.btn} onClick={() => setShowPlan(true)}>
          Ver cuota recomendada
        </button>
        <button type="button" className="ma-card-soft" style={secondaryBtnStyle} onClick={onGoHome}>
          Ir al inicio
        </button>
      </div>

      {showPlan && (
        <div className="ma-card-interactive ma-fade-stagger" style={{ ...styles.panel, animationDelay: "180ms" }}>
          <div style={{ fontSize: 12, color: "#67e8f9", marginBottom: 6 }}>PROPUESTA</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>
            {estimate.monthly} €/mes ({plan})
          </div>
          <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
            Total anual estimado: {estimate.yearly} € · Coste imprevisto amortizado estimado: {estimate.emergencyAvoided} €/mes.
          </div>
        </div>
      )}
    </div>
  );
}
