import { useMemo, useState } from "react";

export default function ServiceAutogestorPage({ styles, onGoBack, onGoHome }) {
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

  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <style>
        {`
          .service-field-card {
            border: 1px solid rgba(148,163,184,0.35);
            border-radius: 14px;
            padding: 12px;
            background: linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92));
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
            color: #334155;
            font-weight: 700;
            margin-bottom: 6px;
          }
        `}
      </style>

      <button type="button" onClick={onGoBack} style={{ ...secondaryBtnStyle, marginBottom: 18 }}>
        ← Volver
      </button>

      <div style={{ ...styles.blockBadge("Uso real"), marginBottom: 10 }}>🤖 AUTOGESTOR IA</div>
      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,4vw,36px)", color: "#000000" }}>
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
            style={{ ...styles.input, background: "#ffffff", color: "#0f172a", border: "1px solid rgba(148,163,184,0.45)" }}
            placeholder="1234ABC"
          />
        </label>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">ITV</div>
          <input
            type="date"
            value={data.itvDate}
            onChange={(e) => setData((p) => ({ ...p, itvDate: e.target.value }))}
            style={{ ...styles.input, background: "#ffffff", color: "#0f172a", border: "1px solid rgba(148,163,184,0.45)" }}
          />
        </label>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Renovación seguro</div>
          <input
            type="date"
            value={data.insuranceRenewal}
            onChange={(e) => setData((p) => ({ ...p, insuranceRenewal: e.target.value }))}
            style={{ ...styles.input, background: "#ffffff", color: "#0f172a", border: "1px solid rgba(148,163,184,0.45)" }}
          />
        </label>
        <label className="service-field-card ma-card-soft">
          <div className="service-field-label">Mantenimiento</div>
          <input
            type="date"
            value={data.maintenanceDate}
            onChange={(e) => setData((p) => ({ ...p, maintenanceDate: e.target.value }))}
            style={{ ...styles.input, background: "#ffffff", color: "#0f172a", border: "1px solid rgba(148,163,184,0.45)" }}
          />
        </label>
      </div>

      <div className="ma-fade-stagger" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, animationDelay: "130ms" }}>
        <button type="button" className="ma-card-soft" style={styles.btn} onClick={() => setActive(true)}>
          Activar AutoGestor
        </button>
        <button type="button" className="ma-card-soft" style={secondaryBtnStyle} onClick={onGoHome}>
          Ir al inicio
        </button>
      </div>

      {active && (
        <div
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.panel,
            animationDelay: "180ms",
            background: "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))",
            border: "1px solid rgba(148,163,184,0.35)",
          }}
        >
          <div style={{ fontSize: 12, color: "#67e8f9", marginBottom: 6 }}>RECORDATORIOS ACTIVOS</div>
          {reminders.length === 0 ? (
            <div style={{ fontSize: 13, color: "#334155" }}>Completa al menos un campo para generar avisos.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {reminders.map((item) => (
                <div key={item} style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
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
