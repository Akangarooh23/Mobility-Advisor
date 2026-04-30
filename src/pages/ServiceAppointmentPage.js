import { useState } from "react";

export default function ServiceAppointmentPage({ onGoBack, onGoHome }) {
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #ece8df",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(0,0,0,0.04)",
  };

  const revisionTypes = [
    ["Revision menor", "Aceite + filtros"],
    ["Revision mayor", "Completa de marca"],
    ["Revision de frenos", "Pastillas y discos"],
    ["Neumaticos", "Cambio o equilibrado"],
    ["Revision ITV", "Pre-ITV incluida"],
  ];

  const workshops = [
    ["AutoCenter Norte", "2.3 km · Disponible hoy 15:00h", "Ahorras 34€ vs precio normal", "155€"],
    ["TallerFast Madridejos", "4.1 km · Disponible manana 10:00h", "Ahorras 22€ vs precio normal", "167€"],
    ["ServicioRapido Sur", "5.8 km · Disponible en 2 dias", "Ahorras 41€ vs precio normal", "148€"],
    ["Taller Oficial VAG", "7.2 km · Disponible en 3 dias", "Ahorras 18€ vs precio normal", "171€"],
  ];

  const [selectedRevision, setSelectedRevision] = useState(0);
  const [selectedWorkshop, setSelectedWorkshop] = useState(0);

  const selectedName = workshops[selectedWorkshop][0];
  const selectedPrice = workshops[selectedWorkshop][3];
  const selectedRevisionName = revisionTypes[selectedRevision][0];

  return (
    <div style={{ width: "100%", maxWidth: 1040, margin: "0 auto", color: "#1a1a1a", padding: "0 8px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button
          type="button"
          onClick={onGoBack}
          style={{
            border: "1px solid #ece8df",
            background: "#ffffff",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12,
            color: "#888",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ← Volver
        </button>
        <div style={{ fontSize: 12, color: "#b8b8b8" }}>
          Servicios › <span style={{ color: "#8b5cf6", fontWeight: 700 }}>Cita Mantenimientos</span>
        </div>
      </div>

      <section style={{ ...cardStyle, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: 4, background: "#8b5cf6" }} />
        <div style={{ padding: "26px 28px" }}>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid rgba(139,92,246,0.3)",
              color: "#7c3aed",
              background: "rgba(139,92,246,0.08)",
              borderRadius: 20,
              padding: "4px 11px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            C · Cita Mantenimientos
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(30px,3.1vw,40px)", letterSpacing: "-0.03em", lineHeight: 1.15, color: "#111" }}>
            Precios de acuerdo, no de particular
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#868686", maxWidth: 760 }}>
            Aprovecha nuestros acuerdos con talleres partner para conseguir precios mas reducidos que como cliente
            particular. Agenda tu proxima revision en segundos a traves de CarWise.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {[
              "Precios negociados",
              "Cita en 2 clics",
              "Talleres verificados",
            ].map((pill) => (
              <span
                key={pill}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#a0a0a0",
                  border: "1px solid #efebe4",
                  background: "#fafaf9",
                  padding: "5px 12px",
                  borderRadius: 30,
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginBottom: 12 }}>
        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            Tipo de revision
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {revisionTypes.map((item, idx) => (
              <button
                key={item[0]}
                type="button"
                onClick={() => setSelectedRevision(idx)}
                style={{
                  border: idx === selectedRevision ? "2px solid rgba(139,92,246,0.7)" : "1px solid #ece8df",
                  borderRadius: 10,
                  background: idx === selectedRevision ? "rgba(139,92,246,0.07)" : "#fafaf9",
                  textAlign: "left",
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3b3b3b" }}>{item[0]}</div>
                <div style={{ fontSize: 12, color: "#9a9a9a" }}>{item[1]}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            Talleres partner cerca de ti
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {workshops.map((item, idx) => (
              <button
                key={item[0]}
                type="button"
                onClick={() => setSelectedWorkshop(idx)}
                style={{
                  border: idx === selectedWorkshop ? "1px solid rgba(139,92,246,0.35)" : "1px solid #ece8df",
                  borderRadius: 10,
                  background: idx === selectedWorkshop ? "rgba(139,92,246,0.08)" : "#fafaf9",
                  textAlign: "left",
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: idx === selectedWorkshop ? "#7c3aed" : "#3b3b3b" }}>{item[0]}</div>
                <div style={{ fontSize: 12, color: "#9a9a9a", marginTop: 2 }}>{item[1]}</div>
                <div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 2, fontWeight: 700 }}>{item[2]}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            Resumen de precio
          </div>
          <div style={{ border: "1px solid rgba(139,92,246,0.28)", borderRadius: 12, background: "rgba(139,92,246,0.08)", padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {selectedRevisionName} · {selectedName}
            </div>
            <div style={{ fontSize: 13, color: "#b9b9b9", marginTop: 6 }}>PVP: 189€</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
              <div style={{ fontSize: 14, color: "#8b5cf6", fontWeight: 700 }}>✓ Ahorras 34€ con CarWise</div>
              <div style={{ fontSize: 30, color: "#7c3aed", fontWeight: 800, lineHeight: 1 }}>{selectedPrice}</div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              "Aceite sintetico 5W30 incluido",
              "Filtros de aceite y aire",
              "Revision de 20 puntos",
              "Informe digital del estado",
              "Sin sorpresas en el precio final",
            ].map((item) => (
              <div key={item} style={{ fontSize: 14, color: "#636363", lineHeight: 1.35 }}>✓ {item}</div>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "18px 20px",
        }}
      >
        <div>
          <div style={{ fontSize: 18, color: "#303030", fontWeight: 700, marginBottom: 3 }}>
            Confirmar cita en {selectedName}
          </div>
          <div style={{ fontSize: 13, color: "#a2a2a2", lineHeight: 1.45 }}>
            {selectedRevisionName} · Hoy a las 15:00h · {selectedPrice} (incluye IVA)
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onGoBack}
            style={{ border: "none", background: "transparent", color: "#bbb", fontSize: 14, cursor: "pointer" }}
          >
            ← Volver
          </button>
          <button
            type="button"
            onClick={onGoHome}
            style={{
              border: "none",
              borderRadius: 14,
              background: "linear-gradient(135deg,#7c3aed,#8b5cf6)",
              color: "#fff",
              padding: "12px 20px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(124,58,237,0.3)",
            }}
          >
            Confirmar cita →
          </button>
        </div>
      </section>
    </div>
  );
}
