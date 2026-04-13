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
      <button type="button" onClick={onGoBack} style={{ ...secondaryBtnStyle, marginBottom: 18 }}>
        ← Volver
      </button>

      <div style={{ ...styles.blockBadge("Uso real"), marginBottom: 10 }}>🤖 AUTOGESTOR IA</div>
      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,4vw,36px)", color: "#f8fafc" }}>
        Centro de control integral del vehículo
      </h2>
      <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
        Centraliza eventos, documentos y vencimientos con recordatorios automáticos y trazabilidad completa.
      </p>

      <div className="ma-fade-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16, animationDelay: "60ms" }}>
        <label className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 10, background: "rgba(15,23,42,0.35)" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Matrícula</div>
          <input value={data.plate} onChange={(e) => setData((p) => ({ ...p, plate: e.target.value }))} style={styles.input} placeholder="1234ABC" />
        </label>
        <label className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 10, background: "rgba(15,23,42,0.35)" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>ITV</div>
          <input type="date" value={data.itvDate} onChange={(e) => setData((p) => ({ ...p, itvDate: e.target.value }))} style={styles.input} />
        </label>
        <label className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 10, background: "rgba(15,23,42,0.35)" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Renovación seguro</div>
          <input type="date" value={data.insuranceRenewal} onChange={(e) => setData((p) => ({ ...p, insuranceRenewal: e.target.value }))} style={styles.input} />
        </label>
        <label className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12, padding: 10, background: "rgba(15,23,42,0.35)" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Mantenimiento</div>
          <input type="date" value={data.maintenanceDate} onChange={(e) => setData((p) => ({ ...p, maintenanceDate: e.target.value }))} style={styles.input} />
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
        <div className="ma-card-interactive ma-fade-stagger" style={{ ...styles.panel, animationDelay: "180ms" }}>
          <div style={{ fontSize: 12, color: "#67e8f9", marginBottom: 6 }}>RECORDATORIOS ACTIVOS</div>
          {reminders.length === 0 ? (
            <div style={{ fontSize: 13, color: "#cbd5e1" }}>Completa al menos un campo para generar avisos.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {reminders.map((item) => (
                <div key={item} style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>
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
