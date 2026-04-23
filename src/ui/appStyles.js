import { BLOCK_COLORS } from "./branding";

export function createAppStyles(progress = 0, themeMode = "light") {
  const isDark = themeMode === "dark";

  return {
    page: {
      minHeight: "100vh",
      background: isDark
        ? "linear-gradient(160deg,#060d1a 0%,#0a1628 50%,#050e1c 100%)"
        : "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)",
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      color: isDark ? "#e2e8f0" : "#0f172a",
    },
    header: {
      padding: "12px 10px 12px 2px", // minimal left padding
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "none",
      position: "sticky",
      top: 0,
      background: isDark ? "rgba(6,13,26,0.92)" : "rgba(255,255,255,0.95)",
      backdropFilter: "blur(12px)",
      zIndex: 100,
    },
    progressBar: {
      height: 4,
      background: "linear-gradient(90deg, #2563eb 0%, #22c55e 100%)",
      boxShadow: "0 1px 8px rgba(37,99,235,0.2)",
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      width: `${progress}%`,
      background: "linear-gradient(90deg, rgba(255,255,255,0.28), rgba(255,255,255,0.12))",
      transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
      borderRadius: "0 4px 4px 0",
    },
    center: {
      width: "min(1380px, calc(100vw - 20px))",
      maxWidth: 1380,
      margin: "0 auto",
      padding: "clamp(22px,5vw,40px) 10px clamp(48px,10vw,72px)",
    },
    btn: {
      background: "linear-gradient(135deg,#2563EB,#1d4ed8)",
      border: "none",
      color: "white",
      padding: "14px 36px",
      borderRadius: 12,
      fontSize: 15,
      fontWeight: 600,
      cursor: "pointer",
      transition: "opacity 0.2s, transform 0.15s",
    },
    card: (selected) => ({
      background: selected
        ? "rgba(37,99,235,0.12)"
        : isDark
          ? "rgba(255,255,255,0.025)"
          : "rgba(255,255,255,0.92)",
      border: selected
        ? "1px solid rgba(37,99,235,0.45)"
        : isDark
          ? "1px solid rgba(255,255,255,0.07)"
          : "1px solid rgba(148,163,184,0.24)",
      borderRadius: 13,
      padding: "14px 18px",
      cursor: "pointer",
      textAlign: "left",
      display: "flex",
      alignItems: "center",
      gap: 14,
      width: "100%",
      color: "inherit",
      marginBottom: 9,
      transition: "all 0.18s ease",
    }),
    blockBadge: (block) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: `${BLOCK_COLORS[block] || "#2563EB"}18`,
      border: `1px solid ${BLOCK_COLORS[block] || "#2563EB"}30`,
      color: BLOCK_COLORS[block] || "#2563EB",
      padding: "4px 12px",
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.6px",
      marginBottom: 16,
    }),
    select: {
      width: "100%",
      background: isDark ? "#0f1b2d" : "#ffffff",
      color: isDark ? "#f8fafc" : "#0f172a",
      border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(148,163,184,0.3)",
      borderRadius: 10,
      padding: "12px 14px",
      outline: "none",
      boxShadow: isDark ? "inset 0 1px 0 rgba(255,255,255,0.03)" : "none",
    },
    input: {
      width: "100%",
      background: isDark ? "#0f1b2d" : "#ffffff",
      color: isDark ? "#f8fafc" : "#0f172a",
      border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(148,163,184,0.3)",
      borderRadius: 10,
      padding: "12px 14px",
      outline: "none",
      boxShadow: isDark ? "inset 0 1px 0 rgba(255,255,255,0.03)" : "none",
    },
    panel: {
      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.92)",
      border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(148,163,184,0.24)",
      borderRadius: 16,
      padding: 18,
    },
  };
}
