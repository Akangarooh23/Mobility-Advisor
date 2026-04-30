import { useState } from "react";

export default function ServiceMonthlyPlanPage({ onGoBack, onGoHome }) {
  const cardStyle = {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #ece8df",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05),0 4px 20px rgba(0,0,0,0.04)",
  };

  const plans = [
    { name: "Basico", price: 29 },
    { name: "Completo", price: 49 },
    { name: "Premium", price: 79 },
  ];

  const [selectedPlan, setSelectedPlan] = useState(0);
  const selected = plans[selectedPlan];

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
          Servicios › <span style={{ color: "#d97706", fontWeight: 700 }}>Cuota Mensual</span>
        </div>
      </div>

      <section style={{ ...cardStyle, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: 4, background: "#d97706" }} />
        <div style={{ padding: "26px 28px" }}>
          <div
            style={{
              display: "inline-flex",
              border: "1px solid rgba(217,119,6,0.3)",
              color: "#b45309",
              background: "rgba(217,119,6,0.08)",
              borderRadius: 20,
              padding: "4px 11px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            D · Cuota Mensual
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(30px,3.1vw,40px)", letterSpacing: "-0.03em", lineHeight: 1.15, color: "#111" }}>
            Tu mantenimiento en una cuota fija mensual
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#868686", maxWidth: 760 }}>
            Paga una cuota mensual por el mantenimiento preventivo de tu coche y no te lleves mas sustos antes
            de vacaciones. Sin sorpresas, sin imprevistos. Con nosotros es posible.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {[
              "Cuota fija mensual",
              "Mantenimiento preventivo",
              "Sin permanencia",
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

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginBottom: 12 }}>
        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            Elige tu plan
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
            {plans.map((plan, idx) => (
              <button
                key={plan.name}
                type="button"
                onClick={() => setSelectedPlan(idx)}
                style={{
                  border: idx === selectedPlan ? "2px solid rgba(217,119,6,0.6)" : "1px solid #ece8df",
                  borderRadius: 10,
                  background: idx === selectedPlan ? "rgba(217,119,6,0.08)" : "#fafaf9",
                  padding: "11px 8px",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#4b4b4b" }}>{plan.name}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: "#1f2937", lineHeight: 1.1 }}>{plan.price}€</div>
                <div style={{ fontSize: 12, color: "#aaa" }}>/mes</div>
              </button>
            ))}
          </div>

          <div
            style={{
              borderRadius: 14,
              background: "linear-gradient(135deg,#ba7517,#c98120)",
              color: "#fff",
              padding: "18px 20px",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
              Plan {selected.name} · Cuota mensual
            </div>
            <div style={{ fontSize: 46, lineHeight: 1, fontWeight: 800, marginTop: 4 }}>{selected.price}€</div>
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>al mes · primer mes gratuito</div>
            <div style={{ display: "grid", gap: 6, fontSize: 14, lineHeight: 1.4 }}>
              {[
                "Cambio de aceite y filtro anual",
                "Revision preventiva de 20 puntos",
                "Alertas automaticas de mantenimiento",
                "Precio partner en talleres CarWise",
                "Acceso al panel Autogestor",
              ].map((item) => (
                <div key={item}>✓ {item}</div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
              Sin permanencia · Cancela cuando quieras
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#c0c0c0", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            ¿Que incluye tu cuota?
          </div>
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {[
              ["Aceite y filtros anuales", "Programado automaticamente cada ano"],
              ["Revision preventiva de 20 puntos", "Frenos, luces, liquidos, neumaticos, correas"],
              ["Recordatorios automaticos", "Nunca mas olvides una revision obligatoria"],
              ["Precio partner en talleres CarWise", "Descuento garantizado sobre precio de calle"],
              ["Planes ampliados disponibles", "ITV, neumaticos, garantia mecanica y mas"],
            ].map(([title, sub]) => (
              <div key={title} style={{ border: "1px solid #ece8df", borderRadius: 10, background: "#fafaf9", padding: "10px 12px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#4b4b4b", marginBottom: 2 }}>✓ {title}</div>
                <div style={{ fontSize: 13, color: "#9a9a9a" }}>{sub}</div>
              </div>
            ))}
          </div>

          <div style={{ border: "1px solid rgba(217,119,6,0.35)", borderRadius: 12, background: "rgba(217,119,6,0.08)", padding: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "#d97706", fontWeight: 800, marginBottom: 8 }}>
              Ahorro estimado anual
            </div>
            <div style={{ display: "grid", gap: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#888" }}>
                <span>Mantenimiento sin cuota</span>
                <span>~580€/ano</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#888" }}>
                <span>Con cuota {selected.name.toLowerCase()} CarWise</span>
                <span>~{selected.price * 12 - 24}€/ano</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#b45309", fontWeight: 800 }}>
                <span>Ahorro estimado</span>
                <span>~{580 - (selected.price * 12 - 24)}€/ano</span>
              </div>
            </div>
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
            Contratar plan {selected.name.toLowerCase()} · {selected.price}€/mes
          </div>
          <div style={{ fontSize: 13, color: "#a2a2a2", lineHeight: 1.45 }}>
            El primer mes es gratuito. Sin permanencia. Cancela en cualquier momento.
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
              background: "linear-gradient(135deg,#ba7517,#d18a1e)",
              color: "#fff",
              padding: "12px 20px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(186,117,23,0.3)",
            }}
          >
            Contratar cuota →
          </button>
        </div>
      </section>
    </div>
  );
}
