export default function SeoStaticPage({ styles, badge = "Informacion", title, description, sections = [], onGoHome }) {
  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ ...styles.blockBadge("Vinculacion"), marginBottom: 8 }}>{badge.toUpperCase()}</div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,36px)", color: "#f8fafc" }}>{title}</h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>{description}</p>
        </div>
        <button
          type="button"
          onClick={onGoHome}
          style={{
            border: "1px solid rgba(148,163,184,0.34)",
            background: "rgba(15,23,42,0.52)",
            color: "#cbd5e1",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Volver al inicio
        </button>
      </div>

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
            <h3 style={{ margin: "0 0 8px", color: "#e2e8f0", fontSize: 16, fontWeight: 800 }}>{section.heading}</h3>
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
