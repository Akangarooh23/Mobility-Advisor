export default function AdviceIntroPage({ styles, pillars, onStart, onRestart }) {
  return (
    <div style={styles.center}>
      <style>
        {`
          .advice-intro-pillars {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 28px;
          }

          .advice-intro-pillar-card {
            --pillar-color: rgba(59,130,246,0.72);
            position: relative;
            overflow: hidden;
            border: 1px solid var(--pillar-color);
            background: linear-gradient(145deg, rgba(255,255,255,0.92), rgba(248,250,252,0.98));
            box-shadow: 0 0 0 1px rgba(255,255,255,0.82) inset, 0 10px 24px rgba(15,23,42,0.08), 0 0 18px color-mix(in srgb, var(--pillar-color) 28%, transparent);
            transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
            animation: adviceContourPulse 3.2s ease-in-out infinite;
          }

          .advice-intro-pillar-card:nth-child(1) {
            --pillar-color: rgba(37,99,235,0.74);
          }

          .advice-intro-pillar-card:nth-child(2) {
            --pillar-color: rgba(14,165,233,0.74);
          }

          .advice-intro-pillar-card:nth-child(3) {
            --pillar-color: rgba(16,185,129,0.74);
          }

          .advice-intro-pillar-card::before {
            content: "";
            position: absolute;
            inset: -1px;
            border-radius: 16px;
            border: 1px solid color-mix(in srgb, var(--pillar-color) 80%, white);
            box-shadow: 0 0 0 1px color-mix(in srgb, var(--pillar-color) 36%, transparent) inset;
            pointer-events: none;
            opacity: 0.85;
          }

          .advice-intro-pillar-card::after {
            content: "";
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 88% 8%, color-mix(in srgb, var(--pillar-color) 36%, white), rgba(56,189,248,0) 48%);
            pointer-events: none;
          }

          .advice-intro-pillar-card:hover,
          .advice-intro-pillar-card:focus-within {
            transform: translateY(-4px);
            border-color: color-mix(in srgb, var(--pillar-color) 90%, white);
            box-shadow: 0 0 0 1px color-mix(in srgb, var(--pillar-color) 40%, transparent) inset, 0 18px 34px rgba(14,116,144,0.16), 0 0 26px color-mix(in srgb, var(--pillar-color) 50%, transparent);
          }

          @keyframes adviceContourPulse {
            0% {
              box-shadow: 0 0 0 1px rgba(255,255,255,0.82) inset, 0 10px 24px rgba(15,23,42,0.08), 0 0 14px color-mix(in srgb, var(--pillar-color) 18%, transparent);
            }
            50% {
              box-shadow: 0 0 0 1px rgba(255,255,255,0.82) inset, 0 12px 26px rgba(15,23,42,0.1), 0 0 24px color-mix(in srgb, var(--pillar-color) 40%, transparent);
            }
            100% {
              box-shadow: 0 0 0 1px rgba(255,255,255,0.82) inset, 0 10px 24px rgba(15,23,42,0.08), 0 0 14px color-mix(in srgb, var(--pillar-color) 18%, transparent);
            }
          }

          @media (max-width: 860px) {
            .advice-intro-pillars {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>🎯 DECISIÓN CLARA</div>
      <h2
        style={{
          fontSize: "clamp(22px,4vw,30px)",
          fontWeight: 800,
          letterSpacing: "-1px",
          margin: "0 0 10px",
          color: "#000000",
        }}
      >
        Encontrar el coche con mejor relación calidad-precio
      </h2>
      <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
        Este flujo arranca el test de decisión y añade una capa de valor con financiación, TCO,
        garantías, pricing, señales de mercado y valor futuro antes de recomendar una compra o renting.
      </p>

      <div className="advice-intro-pillars">
        {pillars.map((pillar) => (
          <div key={pillar.title} style={styles.panel} className="advice-intro-pillar-card">
            <div style={{ fontSize: 13, fontWeight: 700, color: "#000000", marginBottom: 8 }}>
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
