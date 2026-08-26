export default function SeoStaticPage({ styles, badge = "Informacion", title, description, sections = [], onGoHome }) {
  const isDark = styles?.page?.color === "var(--gris-200)";
  const titleColor = isDark ? "var(--gris-50)" : "var(--gris-900)";
  const descriptionColor = isDark ? "var(--gris-300)" : "var(--gris-600)";
  const panelBg = isDark
    ? "linear-gradient(180deg, rgba(17,17,17,0.72), rgba(17,17,17,0.72))"
    : "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(250,250,248,0.94))";
  const panelBorder = isDark ? "1px solid rgba(150,150,143,0.24)" : "1px solid rgba(150,150,143,0.26)";
  const panelShadow = isDark ? "0 12px 30px rgba(5,5,5,0.28)" : "0 10px 28px rgba(17,17,17,0.08)";
  const sectionTitleColor = isDark ? "var(--gris-200)" : "var(--gris-900)";
  const bodyColor = isDark ? "var(--gris-300)" : "var(--gris-700)";

  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ ...styles.blockBadge("Vinculacion"), marginBottom: 8 }}>{badge.toUpperCase()}</div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,36px)", color: titleColor }}>{title}</h2>
          <p style={{ margin: 0, color: descriptionColor, fontSize: 14, lineHeight: 1.7, maxWidth: 760 }}>{description}</p>
        </div>
        <button
          type="button"
          onClick={onGoHome}
          style={{
            border: isDark ? "1px solid rgba(150,150,143,0.34)" : "1px solid rgba(150,150,143,0.28)",
            background: isDark ? "rgba(17,17,17,0.52)" : "rgba(255,255,255,0.9)",
            color: isDark ? "var(--gris-300)" : "var(--gris-700)",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            alignSelf: "flex-start",
            boxShadow: isDark ? "none" : "0 6px 18px rgba(17,17,17,0.08)",
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
              border: panelBorder,
              borderRadius: 14,
              background: panelBg,
              boxShadow: panelShadow,
              padding: "14px 12px",
            }}
          >
            <h3 style={{ margin: "0 0 8px", color: sectionTitleColor, fontSize: 16, fontWeight: 800 }}>{section.heading}</h3>
            {Array.isArray(section.paragraphs) && section.paragraphs.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} style={{ margin: 0, color: bodyColor, fontSize: 13, lineHeight: 1.7 }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
            {Array.isArray(section.bullets) && section.bullets.length > 0 && (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 6 }}>
                {section.bullets.map((item) => (
                  <li key={item} style={{ color: bodyColor, fontSize: 13, lineHeight: 1.6 }}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {Array.isArray(section.cards) && section.cards.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                {section.cards.map((card) => (
                  <div
                    key={`${section.heading}-${card.title}`}
                    style={{
                      border: isDark ? "1px solid rgba(207,207,200,0.24)" : "1px solid rgba(255,196,0,0.22)",
                      background: isDark
                        ? "linear-gradient(180deg, rgba(17,17,17,0.72), rgba(17,17,17,0.72))"
                        : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,248,0.96))",
                      borderRadius: 12,
                      padding: "12px 11px",
                      boxShadow: isDark ? "none" : "0 8px 20px rgba(17,17,17,0.08)",
                    }}
                  >
                    <div style={{ color: sectionTitleColor, fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                      {card.title}
                    </div>
                    {card.subtitle ? (
                      <div style={{ color: isDark ? "var(--gris-300)" : "var(--marca)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                        {card.subtitle}
                      </div>
                    ) : null}
                    {Array.isArray(card.lines) && card.lines.length > 0 ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {card.lines.map((line) => (
                          <p key={`${card.title}-${line}`} style={{ margin: 0, color: bodyColor, fontSize: 12, lineHeight: 1.6 }}>
                            {line}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
