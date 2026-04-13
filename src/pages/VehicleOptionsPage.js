export default function VehicleOptionsPage({ styles, onSelectBuy, onSelectRenting, onSelectGuide, onGoHome }) {
  const timelineSteps = [
    "Seleccionas una opcion",
    "Respondes al CarAdvisor",
    "Analizamos el mercado en tiempo real",
    "Te ofrecemos 3 modelos",
    "Te agendamos una cita",
  ];

  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <style>
        {`
          .vehicle-flow-card {
            position: relative;
            overflow: hidden;
          }

          .vehicle-flow-card::after {
            content: "";
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 85% 10%, rgba(59,130,246,0.18), transparent 50%);
            pointer-events: none;
          }

          .vehicle-flow-axis {
            position: absolute;
            left: 17px;
            top: 16px;
            bottom: 16px;
            width: 2px;
            background: linear-gradient(180deg, rgba(59,130,246,0.25), rgba(56,189,248,0.65), rgba(20,184,166,0.35));
          }

          .vehicle-flow-item {
            position: relative;
            padding: 10px 12px 10px 42px;
            border-radius: 12px;
            border: 1px solid rgba(71,85,105,0.55);
            background: rgba(15,23,42,0.72);
            color: #dbeafe;
            opacity: 0;
            transform: translateY(12px);
            animation: vehicleFlowIn 0.45s ease forwards;
            transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
          }

          .vehicle-flow-item:hover {
            transform: translateY(-2px);
            border-color: rgba(56,189,248,0.72);
            background: rgba(15,23,42,0.88);
            box-shadow: 0 10px 24px rgba(2,6,23,0.35);
          }

          .vehicle-flow-dot {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            width: 14px;
            height: 14px;
            border-radius: 999px;
            border: 2px solid rgba(125,211,252,0.95);
            background: #0f172a;
            box-shadow: 0 0 0 0 rgba(14,165,233,0.45);
            animation: vehicleFlowPulse 1.8s ease-in-out infinite;
          }

          @keyframes vehicleFlowIn {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes vehicleFlowPulse {
            0% {
              box-shadow: 0 0 0 0 rgba(14,165,233,0.5);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(14,165,233,0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(14,165,233,0);
            }
          }

          @media (max-width: 640px) {
            .vehicle-flow-item {
              padding-right: 10px;
            }
          }
        `}
      </style>

      <button
        type="button"
        onClick={onGoHome}
        style={{
          border: "1px solid rgba(148,163,184,0.35)",
          background: "rgba(15,23,42,0.5)",
          color: "#cbd5e1",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        ← Volver al inicio
      </button>

      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,38px)", color: "#f8fafc", letterSpacing: "-0.9px" }}>
        Quiero un vehiculo
      </h2>
      <p style={{ margin: "0 0 22px", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
        Elige como quieres avanzar y te llevamos al flujo adecuado.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <button
          type="button"
          onClick={onSelectBuy}
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.card(false),
            padding: 18,
            border: "1px solid rgba(37,99,235,0.32)",
            background: "rgba(37,99,235,0.12)",
            color: "#f1f5f9",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: 8,
            minHeight: "clamp(140px, 24vw, 170px)",
            animationDelay: "40ms",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.25 }}>Quiero comprar un coche</div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.45 }}>
            Si ya tienes marca y modelo en mente, te ayudamos a localizar la mejor oferta.
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectRenting}
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.card(false),
            padding: 18,
            border: "1px solid rgba(14,165,233,0.34)",
            background: "rgba(14,165,233,0.12)",
            color: "#f1f5f9",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: 8,
            minHeight: "clamp(140px, 24vw, 170px)",
            animationDelay: "120ms",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.25 }}>Quiero hacer un Renting</div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.45 }}>
            Iniciamos el modo guiado para evaluar cuota, uso real y condiciones mas convenientes.
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectGuide}
          className="ma-card-interactive ma-fade-stagger"
          style={{
            ...styles.card(false),
            padding: 18,
            border: "1px solid rgba(16,185,129,0.34)",
            background: "rgba(16,185,129,0.12)",
            color: "#f1f5f9",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: 8,
            minHeight: "clamp(140px, 24vw, 170px)",
            animationDelay: "200ms",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.25 }}>Quiero que me Guíes</div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.45 }}>
            Te hacemos preguntas clave para recomendarte la opcion mas rentable para tu caso.
          </div>
        </button>
      </div>

      <div
        style={{
          margin: "22px 0 0",
          padding: "14px 14px 14px",
          borderRadius: 14,
          border: "1px solid rgba(148,163,184,0.24)",
          background: "linear-gradient(145deg, rgba(15,23,42,0.82), rgba(30,41,59,0.62))",
          animationDelay: "260ms",
        }}
        className="vehicle-flow-card ma-card-soft ma-fade-stagger"
      >
        <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 800, letterSpacing: "0.6px", marginBottom: 10 }}>
          ASI FUNCIONA
        </div>
        <div style={{ position: "relative", display: "grid", gap: 9 }}>
          <div className="vehicle-flow-axis" />
          {timelineSteps.map((label, index) => (
            <div
              key={label}
              className="vehicle-flow-item"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="vehicle-flow-dot" />
              <div style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 800, marginBottom: 3 }}>Paso {index + 1}</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.45 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
