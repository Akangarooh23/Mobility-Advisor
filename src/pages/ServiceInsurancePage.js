import { useMemo, useState } from "react";

export default function ServiceInsurancePage({ styles, onGoBack, onGoHome }) {
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

  const [form, setForm] = useState({
    vehicleValue: "22000",
    annualKm: "15000",
    coverage: "terceros_ampliado",
    driverAge: "35",
  });
  const [showQuote, setShowQuote] = useState(false);

  const quote = useMemo(() => {
    const value = Number(form.vehicleValue || 0);
    const km = Number(form.annualKm || 0);
    const age = Number(form.driverAge || 0);

    const base = form.coverage === "todo_riesgo" ? 92 : form.coverage === "terceros_ampliado" ? 56 : 42;
    const valueFactor = Math.min(35, Math.round(value / 1800));
    const kmFactor = Math.min(28, Math.round(km / 1800));
    const ageFactor = age < 25 ? 30 : age < 30 ? 16 : 8;

    const monthlyMarket = base + valueFactor + kmFactor + ageFactor;
    const monthlyB2Cars = Math.max(29, Math.round(monthlyMarket * 0.82));

    return {
      monthlyMarket,
      monthlyB2Cars,
      yearlySavings: (monthlyMarket - monthlyB2Cars) * 12,
    };
  }, [form]);

  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <button type="button" onClick={onGoBack} style={{ ...secondaryBtnStyle, marginBottom: 18 }}>
        ← Volver
      </button>

      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>🛡️ SEGURO COLECTIVO</div>
      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,4vw,36px)", color: "#f8fafc" }}>
        Negociación de seguro en bloque
      </h2>
      <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
        Agrupamos muchos particulares para negociar como una gran flota y conseguir mejores condiciones.
      </p>

      <div className="ma-fade-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16, animationDelay: "60ms" }}>
        <label className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 10, background: "rgba(15,23,42,0.35)" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Valor aproximado del coche (€)</div>
          <input value={form.vehicleValue} onChange={(e) => setForm((p) => ({ ...p, vehicleValue: e.target.value }))} style={styles.input} />
        </label>
        <label className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 10, background: "rgba(15,23,42,0.35)" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Km al año</div>
          <input value={form.annualKm} onChange={(e) => setForm((p) => ({ ...p, annualKm: e.target.value }))} style={styles.input} />
        </label>
        <label className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 10, background: "rgba(15,23,42,0.35)" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Edad conductor principal</div>
          <input value={form.driverAge} onChange={(e) => setForm((p) => ({ ...p, driverAge: e.target.value }))} style={styles.input} />
        </label>
        <label className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 10, background: "rgba(15,23,42,0.35)" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Cobertura</div>
          <select value={form.coverage} onChange={(e) => setForm((p) => ({ ...p, coverage: e.target.value }))} style={styles.select}>
            <option value="terceros">Terceros</option>
            <option value="terceros_ampliado">Terceros ampliado</option>
            <option value="todo_riesgo">Todo riesgo</option>
          </select>
        </label>
      </div>

      <div className="ma-fade-stagger" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, animationDelay: "130ms" }}>
        <button type="button" className="ma-card-soft" style={styles.btn} onClick={() => setShowQuote(true)}>
          Calcular oferta colectiva
        </button>
        <button type="button" className="ma-card-soft" style={secondaryBtnStyle} onClick={onGoHome}>
          Ir al inicio
        </button>
      </div>

      {showQuote && (
        <div className="ma-card-interactive ma-fade-stagger" style={{ ...styles.panel, animationDelay: "180ms" }}>
          <div style={{ fontSize: 12, color: "#67e8f9", marginBottom: 6 }}>ESTIMACIÓN INSTANTÁNEA</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>
            Cuota estimada B2Cars: {quote.monthlyB2Cars} €/mes
          </div>
          <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
            Mercado: {quote.monthlyMarket} €/mes · Ahorro potencial anual: {quote.yearlySavings} €.
          </div>
        </div>
      )}
    </div>
  );
}
