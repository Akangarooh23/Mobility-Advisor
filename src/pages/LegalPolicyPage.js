export default function LegalPolicyPage({
  styles,
  title,
  summary,
  updatedAt,
  sections = [],
  onGoBack,
  onGoHome,
}) {
  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <button
          type="button"
          onClick={onGoBack}
          style={{
            border: "1px solid rgba(148,163,184,0.35)",
            background: "rgba(15,23,42,0.5)",
            color: "#cbd5e1",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={onGoHome}
          style={{
            border: "1px solid rgba(56,189,248,0.4)",
            background: "rgba(14,116,144,0.2)",
            color: "#bae6fd",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ⌂ Ir al inicio
        </button>
      </div>

      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>DOCUMENTACIÓN LEGAL</div>
      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,36px)", color: "#f8fafc", letterSpacing: "-0.9px" }}>
        {title}
      </h2>
      <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>
        {summary}
      </p>
      <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: 12 }}>
        Última actualización: {updatedAt}
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {sections.map((section) => (
          <article
            key={section.heading}
            className="ma-card-soft"
            style={{
              border: "1px solid rgba(148,163,184,0.22)",
              borderRadius: 14,
              background: "rgba(15,23,42,0.55)",
              padding: "14px 12px",
            }}
          >
            <h3 style={{ margin: "0 0 8px", color: "#e2e8f0", fontSize: 16, fontWeight: 800 }}>
              {section.heading}
            </h3>
            {Array.isArray(section.paragraphs) && section.paragraphs.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} style={{ margin: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.7 }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
            {Array.isArray(section.bullets) && section.bullets.length > 0 && (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 6 }}>
                {section.bullets.map((item) => (
                  <li key={item} style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
