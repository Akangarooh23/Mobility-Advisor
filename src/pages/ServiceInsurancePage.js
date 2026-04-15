import { useMemo, useState } from "react";

export default function ServiceInsurancePage({ styles, onGoBack, onGoHome, themeMode }) {
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

      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>🛡️ SEGURO COLECTIVO</div>
      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,4vw,36px)", color: titleColor }}>
        Negociación de seguro en bloque
      </h2>
      <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
        Agrupamos muchos particulares para negociar como una gran flota y conseguir mejores condiciones.
      </p>

      <div className="ma-fade-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16, animationDelay: "60ms" }}>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Valor aproximado del coche (€)</div>
          <input
            value={form.vehicleValue}
            onChange={(e) => setForm((p) => ({ ...p, vehicleValue: e.target.value }))}
            style={{ ...styles.input, background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)" }}
          />
        </label>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Km al año</div>
          <input
            value={form.annualKm}
            onChange={(e) => setForm((p) => ({ ...p, annualKm: e.target.value }))}
            style={{ ...styles.input, background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)" }}
          />
        </label>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Edad conductor principal</div>
          <input
            value={form.driverAge}
            onChange={(e) => setForm((p) => ({ ...p, driverAge: e.target.value }))}
            style={{ ...styles.input, background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)" }}
          />
        </label>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Cobertura</div>
          <select
            value={form.coverage}
            onChange={(e) => setForm((p) => ({ ...p, coverage: e.target.value }))}
            style={{ ...styles.select, background: inputBg, color: inputText, border: "1px solid rgba(148,163,184,0.45)" }}
          >
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
        <div
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.panel,
            animationDelay: "180ms",
            background: cardBg,
            border: "1px solid rgba(148,163,184,0.35)",
          }}
        >
          <div style={{ fontSize: 12, color: "#67e8f9", marginBottom: 6 }}>ESTIMACIÓN INSTANTÁNEA</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: titleColor, marginBottom: 8 }}>
            Cuota estimada B2Cars: {quote.monthlyB2Cars} €/mes
          </div>
          <div style={{ color: bodyColor, fontSize: 13, lineHeight: 1.6 }}>
            Mercado: {quote.monthlyMarket} €/mes · Ahorro potencial anual: {quote.yearlySavings} €.
          </div>
        </div>
      )}
    </div>
  );
}
