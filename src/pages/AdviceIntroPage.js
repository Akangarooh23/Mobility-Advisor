import { useState } from "react";

export default function AdviceIntroPage({ styles, pillars, onStart, onRestart }) {
  const isDark = styles?.page?.color === "#e2e8f0";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const mutedColor = isDark ? "#cbd5e1" : "#334155";
  const cardBackground = isDark ? "rgba(15,23,42,0.62)" : "rgba(255,255,255,0.92)";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.24)" : "1px solid rgba(15,23,42,0.14)";
  const [showAnalysis, setShowAnalysis] = useState(false);

  const checklist = [
    "Uso y desplazamientos",
    "Entorno y zona",
    "Presupuesto",
    "Prioridades de compra",
    "Preferencias de vehículo",
  ];

  const badges = ["3-5 minutos", "Sin registro previo", "Resultado inmediato"];

  return (
    <div style={{ ...styles.center, maxWidth: 1180, textAlign: "left" }}>
      <style>
        {`
          .cw-advice-intro-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
            gap: 26px;
            align-items: start;
          }

          .cw-advice-analysis-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-top: 20px;
          }

          .cw-advice-analysis-card {
            border-radius: 18px;
            padding: 16px 16px 14px;
            border: 1px solid rgba(125, 211, 252, 0.34);
            background: linear-gradient(145deg, rgba(255,255,255,0.96), rgba(239,246,255,0.92));
            box-shadow: 0 14px 34px rgba(37,99,235,0.08);
          }

          .cw-advice-analysis-card:nth-child(3n + 1) {
            background: linear-gradient(145deg, rgba(255,255,255,0.96), rgba(219,234,254,0.92));
          }

          .cw-advice-analysis-card:nth-child(3n + 2) {
            background: linear-gradient(145deg, rgba(255,255,255,0.96), rgba(224,242,254,0.92));
          }

          .cw-advice-analysis-card:nth-child(3n + 3) {
            background: linear-gradient(145deg, rgba(255,255,255,0.96), rgba(220,252,231,0.9));
          }

          @media (max-width: 900px) {
            .cw-advice-intro-grid {
              grid-template-columns: 1fr;
            }

            .cw-advice-analysis-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      <div className="cw-advice-intro-grid">
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: "#0f172a", textTransform: "uppercase", marginBottom: 16 }}>
            Antes de empezar
          </div>

          <h2
            style={{
              margin: "0 0 14px",
              fontSize: "clamp(34px,5vw,56px)",
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              color: titleColor,
              fontWeight: 800,
              maxWidth: 620,
            }}
          >
            Cuentanos <span style={{ color: "#2563eb" }}>como es tu vida</span>
            <br />
            y encontramos tu coche ideal
          </h2>

          <p style={{ margin: "0 0 22px", color: mutedColor, fontSize: 15, lineHeight: 1.75, maxWidth: 520 }}>
            Unas pocas preguntas sobre tus desplazamientos, entorno y prioridades. Sin tecnicismos. Analizamos el mercado en tiempo real con ese perfil y te presentamos las mejores opciones.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
            {badges.map((badge) => (
              <span
                key={badge}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: cardBorder,
                  background: "rgba(255,255,255,0.9)",
                  color: "#0f172a",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span style={{ fontSize: 11, color: "#64748b" }}>◌</span>
                {badge}
              </span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={onStart}
              style={{
                border: "1px solid rgba(37,99,235,0.24)",
                background: "linear-gradient(135deg,#2563eb,#14b8a6)",
                color: "#ffffff",
                borderRadius: 12,
                padding: "14px 18px",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                minWidth: 194,
                textAlign: "left",
                boxShadow: "0 12px 26px rgba(37,99,235,0.18)",
              }}
            >
              Empezar CarWise Test
            </button>

            <button
              type="button"
              onClick={onRestart}
              style={{
                border: "1px solid rgba(20,184,166,0.24)",
                background: "#ffffff",
                color: "#0f766e",
                borderRadius: 12,
                padding: "14px 18px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Volver al inicio
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <section
            style={{
              border: cardBorder,
              background: cardBackground,
              borderRadius: 16,
              padding: "18px 18px 16px",
              boxShadow: isDark ? "none" : "0 10px 26px rgba(15,23,42,0.06)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0f172a", marginBottom: 14 }}>
              El test incluye
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {checklist.map((item, index) => (
                <div key={item} style={{ display: "grid", gridTemplateColumns: "28px 1fr", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: "1px solid rgba(37,99,235,0.28)",
                      background: "rgba(37,99,235,0.08)",
                      color: "#2563eb",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ fontSize: 15, color: titleColor, fontWeight: 600 }}>{item}</div>
                </div>
              ))}
            </div>
          </section>

          <button
            type="button"
            onClick={() => setShowAnalysis((prev) => !prev)}
            style={{
              border: cardBorder,
              background: "#ffffff",
              color: titleColor,
              borderRadius: 14,
              padding: "16px 18px",
              display: "grid",
              gridTemplateColumns: "28px 1fr auto",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 800,
              boxShadow: isDark ? "none" : "0 10px 24px rgba(15,23,42,0.05)",
            }}
          >
            <span style={{ color: "#64748b", fontSize: 13 }}>◌</span>
            <span>Como funciona el analisis?</span>
            <span style={{ color: "#0f766e" }}>{showAnalysis ? "−" : "+"}</span>
          </button>
        </div>
      </div>

      {showAnalysis && (
        <div className="cw-advice-analysis-grid">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="cw-advice-analysis-card">
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
                {pillar.title}
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: mutedColor, lineHeight: 1.65 }}>
                {pillar.text}
              </p>
            </article>
          ))}
        </div>
      )}

      <div style={{ marginTop: 34, paddingTop: 14, borderTop: "1px solid rgba(148,163,184,0.2)", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: mutedColor, fontSize: 13, fontWeight: 600 }}>
          <span style={{ fontSize: 11 }}>◌</span>
          Tus respuestas no se almacenan sin tu permiso
        </div>
        <div style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: index === 0 ? "#0f766e" : "rgba(148,163,184,0.35)",
                display: "inline-block",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
