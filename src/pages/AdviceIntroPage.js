export default function AdviceIntroPage({ styles, pillars, onStart, onRestart }) {
  return (
    <div style={styles.center}>
      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>🎯 DECISIÓN CLARA</div>
      <h2
        style={{
          fontSize: "clamp(22px,4vw,30px)",
          fontWeight: 800,
          letterSpacing: "-1px",
          margin: "0 0 10px",
          color: "#f1f5f9",
        }}
      >
        Encontrar el coche con mejor relación calidad-precio
      </h2>
      <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
        Este flujo arranca el test de decisión y añade una capa de valor con financiación, TCO,
        garantías, pricing, señales de mercado y valor futuro antes de recomendar una compra o renting.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {pillars.map((pillar) => (
          <div key={pillar.title} style={styles.panel}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
              {pillar.title}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
              {pillar.text}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onStart} style={styles.btn}>
          Empezar flujo de decisión →
        </button>
        <button
          onClick={onRestart}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8",
            padding: "12px 20px",
            borderRadius: 10,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
