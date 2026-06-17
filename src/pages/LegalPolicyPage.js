import { useTranslation } from "react-i18next";

export default function LegalPolicyPage({
  title,
  summary,
  updatedAt,
  sections = [],
  themeMode = "light",
  // legacy props — ignored in standalone mode
  styles,
  onGoBack,
  onGoHome,
}) {
  const { t } = useTranslation();
  const isDark = themeMode === "dark";

  const titleColor   = isDark ? "#f1f5f9" : "#0f172a";
  const summaryColor = isDark ? "#94a3b8"  : "#475569";
  const metaColor    = isDark ? "#64748b"  : "#94a3b8";
  const cardBg       = isDark ? "rgba(30,41,59,0.7)"  : "#ffffff";
  const cardBorder   = isDark ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.28)";
  const headingColor = isDark ? "#e2e8f0"  : "#1e293b";
  const bodyColor    = isDark ? "#cbd5e1"  : "#374151";
  const badgeBg      = isDark ? "rgba(59,130,246,0.14)" : "rgba(59,130,246,0.08)";
  const badgeBorder  = isDark ? "rgba(96,165,250,0.28)" : "rgba(59,130,246,0.22)";
  const badgeColor   = isDark ? "#93c5fd" : "#2563eb";
  const dividerColor = isDark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.2)";

  return (
    <div>
      {/* Badge */}
      <div style={{
        display: "inline-block",
        background: badgeBg,
        border: `1px solid ${badgeBorder}`,
        color: badgeColor,
        borderRadius: 999,
        padding: "4px 12px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        marginBottom: 20,
      }}>
        {t("legal.badge")}
      </div>

      {/* Title */}
      <h1 style={{
        margin: "0 0 12px",
        fontSize: "clamp(26px, 4vw, 38px)",
        fontWeight: 800,
        letterSpacing: "-0.03em",
        lineHeight: 1.15,
        color: titleColor,
      }}>
        {title}
      </h1>

      {/* Summary */}
      {summary && (
        <p style={{ margin: "0 0 8px", color: summaryColor, fontSize: 15, lineHeight: 1.7 }}>
          {summary}
        </p>
      )}

      {/* Updated date */}
      <p style={{ margin: "0 0 36px", color: metaColor, fontSize: 12 }}>
        {t("legal.lastUpdated", { date: updatedAt })}
      </p>

      <div style={{ height: 1, background: dividerColor, marginBottom: 32 }} />

      {/* Sections */}
      <div style={{ display: "grid", gap: 16 }}>
        {sections.map((section) => (
          <article
            key={section.heading}
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: 14,
              padding: "20px 24px",
              boxShadow: isDark
                ? "0 2px 12px rgba(0,0,0,0.2)"
                : "0 1px 6px rgba(15,23,42,0.06)",
            }}
          >
            <h2 style={{
              margin: "0 0 12px",
              color: headingColor,
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.4,
              borderBottom: `1px solid ${dividerColor}`,
              paddingBottom: 10,
            }}>
              {section.heading}
            </h2>

            {Array.isArray(section.paragraphs) && section.paragraphs.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                {section.paragraphs.map((paragraph, i) => (
                  <p key={i} style={{ margin: 0, color: bodyColor, fontSize: 13.5, lineHeight: 1.75 }}>
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {Array.isArray(section.bullets) && section.bullets.length > 0 && (
              <ul style={{ margin: Array.isArray(section.paragraphs) && section.paragraphs.length ? "12px 0 0" : "0", paddingLeft: 20, display: "grid", gap: 7 }}>
                {section.bullets.map((item, i) => (
                  <li key={i} style={{ color: bodyColor, fontSize: 13.5, lineHeight: 1.7 }}>
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
