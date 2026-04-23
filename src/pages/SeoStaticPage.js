export default function SeoStaticPage({ styles, badge = "Informacion", title, description, sections = [], onGoHome }) {
  const isDark = styles?.page?.color === "#e2e8f0";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const descriptionColor = isDark ? "#cbd5e1" : "#475569";
  const panelBg = isDark
    ? "linear-gradient(180deg, rgba(15,23,42,0.72), rgba(8,15,30,0.72))"
    : "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.94))";
  const panelBorder = isDark ? "1px solid rgba(148,163,184,0.24)" : "1px solid rgba(148,163,184,0.26)";
  const panelShadow = isDark ? "0 12px 30px rgba(2,6,23,0.28)" : "0 10px 28px rgba(15,23,42,0.08)";
  const sectionTitleColor = isDark ? "#e2e8f0" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#334155";

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
            border: isDark ? "1px solid rgba(148,163,184,0.34)" : "1px solid rgba(148,163,184,0.28)",
            background: isDark ? "rgba(15,23,42,0.52)" : "rgba(255,255,255,0.9)",
            color: isDark ? "#cbd5e1" : "#334155",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            alignSelf: "flex-start",
            boxShadow: isDark ? "none" : "0 6px 18px rgba(15,23,42,0.08)",
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
                      border: isDark ? "1px solid rgba(125,211,252,0.24)" : "1px solid rgba(59,130,246,0.22)",
                      background: isDark
                        ? "linear-gradient(180deg, rgba(15,23,42,0.72), rgba(8,15,30,0.72))"
                        : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
                      borderRadius: 12,
                      padding: "12px 11px",
                      boxShadow: isDark ? "none" : "0 8px 20px rgba(15,23,42,0.08)",
                    }}
                  >
                    <div style={{ color: sectionTitleColor, fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                      {card.title}
                    </div>
                    {card.subtitle ? (
                      <div style={{ color: isDark ? "#7dd3fc" : "#2563eb", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
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
