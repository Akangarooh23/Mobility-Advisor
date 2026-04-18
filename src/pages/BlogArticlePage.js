export default function BlogArticlePage({ styles, article, onGoBlog, onGoHome }) {
  if (!article) {
    return null;
  }

  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <button
          type="button"
          onClick={onGoBlog}
          style={{
            border: "1px solid rgba(148,163,184,0.34)",
            background: "rgba(15,23,42,0.52)",
            color: "#cbd5e1",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Volver al blog
        </button>
        <button
          type="button"
          onClick={onGoHome}
          style={{
            border: "1px solid rgba(125,211,252,0.36)",
            background: "rgba(14,165,233,0.12)",
            color: "#bae6fd",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Ir al inicio
        </button>
      </div>

      <article className="ma-card-soft" style={{ border: "1px solid rgba(148,163,184,0.22)", borderRadius: 16, background: "rgba(15,23,42,0.55)", padding: "16px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#67e8f9", fontWeight: 800, letterSpacing: "0.5px" }}>{article.category}</span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{article.publishedAt} · {article.readTime}</span>
        </div>
        <h1 style={{ margin: "0 0 10px", color: "#f8fafc", fontSize: "clamp(26px, 4vw, 36px)", lineHeight: 1.25 }}>
          {article.title}
        </h1>
        <p style={{ margin: "0 0 14px", color: "#cbd5e1", fontSize: 14, lineHeight: 1.75 }}>
          {article.intro}
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          {article.sections.map((section) => (
            <section key={section.heading} style={{ borderTop: "1px solid rgba(148,163,184,0.2)", paddingTop: 10 }}>
              <h2 style={{ margin: "0 0 8px", color: "#e2e8f0", fontSize: 18 }}>{section.heading}</h2>
              {Array.isArray(section.paragraphs) && section.paragraphs.length > 0 && (
                <div style={{ display: "grid", gap: 8 }}>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} style={{ margin: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.75 }}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
              {Array.isArray(section.bullets) && section.bullets.length > 0 && (
                <ul style={{ margin: "0", paddingLeft: 18, display: "grid", gap: 6 }}>
                  {section.bullets.map((item) => (
                    <li key={item} style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.65 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <p style={{ margin: "14px 0 0", color: "#bae6fd", fontSize: 13, lineHeight: 1.75, fontWeight: 700 }}>
          {article.conclusion}
        </p>
      </article>
    </div>
  );
}
