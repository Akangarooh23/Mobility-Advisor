import { useState } from "react";

export default function SellOptionsPage({ styles, onSelectCertificate, onSelectReport, onGoBack }) {
  const isDark = styles?.page?.color === "#e2e8f0";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const mutedColor = isDark ? "#cbd5e1" : "#475569";
  const cardBackground = isDark ? "rgba(15,23,42,0.55)" : "#ffffff";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.26)" : "1px solid rgba(15,23,42,0.12)";
  const [openFlow, setOpenFlow] = useState(null);

  const toggleFlow = (flowKey) => {
    setOpenFlow((prev) => (prev === flowKey ? null : flowKey));
  };

  const flowA = [
    { title: "Introduce los datos de tu vehiculo", sub: "Matricula, marca, modelo, version, año y kilometros." },
    { title: "Analizamos el mercado en tiempo real", sub: "Precio medio actual y numero de unidades similares publicadas." },
    { title: "Recibes una referencia objetiva", sub: "Para vender por tu cuenta con mejor criterio y sin depender de una tasacion." },
  ];

  const flowB = [
    { title: "Revisamos el estado real del vehiculo", sub: "Certificacion previa para generar confianza desde el primer contacto." },
    { title: "Definimos el precio contigo", sub: "Con apoyo de datos de mercado y posicionamiento frente a otros anuncios." },
    { title: "Publicamos y gestionamos interesados", sub: "Filtrado de llamadas, coordinacion y seguimiento comercial." },
    { title: "Te acompañamos hasta el cierre", sub: "Soporte en documentacion, negociacion y venta final." },
  ];

  return (
    <div style={{ ...styles.center, maxWidth: 980, textAlign: "left" }}>
      <button
        type="button"
        onClick={onGoBack}
        style={{
          border: "1px solid rgba(148,163,184,0.35)",
          background: isDark ? "rgba(15,23,42,0.5)" : "rgba(148,163,184,0.16)",
          color: isDark ? "#cbd5e1" : "#475569",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        ← Volver
      </button>

      <div style={{ marginBottom: 10, marginTop: 4, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.18em", fontWeight: 800, color: "#2563eb", textTransform: "uppercase" }}>
          Venta
        </span>
        <span style={{ width: 34, height: 1, background: "rgba(37,99,235,0.5)" }} />
      </div>

      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,38px)", color: titleColor, letterSpacing: "-0.9px" }}>
        Quiero vender
      </h2>
      <p style={{ margin: "0 0 22px", color: mutedColor, fontSize: 14, lineHeight: 1.6, maxWidth: 720 }}>
        Tanto si quieres gestionar la venta tu mismo con informacion de mercado como si prefieres que lo hagamos por ti de principio a fin.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <article
          className="ma-card-interactive ma-fade-stagger"
          style={{
            position: "relative",
            border: cardBorder,
            borderRadius: 12,
            background: cardBackground,
            boxShadow: isDark ? "none" : "0 8px 22px rgba(15,23,42,0.05)",
            padding: "24px 22px 20px",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: 10,
            minHeight: "clamp(148px, 20vw, 178px)",
            animationDelay: "60ms",
            cursor: "pointer",
          }}
          role="button"
          tabIndex={0}
          onClick={() => toggleFlow("a")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleFlow("a");
            }
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: 20,
              border: "1px solid rgba(37,99,235,0.24)",
              background: "rgba(37,99,235,0.1)",
              color: "#2563eb",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Opcion A
          </span>
          <span
            style={{
              position: "absolute",
              top: 22,
              right: 20,
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid rgba(148,163,184,0.35)",
              color: "#64748b",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
            }}
          >
            &gt;
          </span>
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2, color: titleColor }}>
            Te damos la informacion para vender
          </div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.45 }}>
            No tasamos tu vehiculo, te damos informacion de mercado: precio medio actual y numero de unidades en venta en los principales portales.
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleFlow("a");
            }}
            style={{
              marginTop: 2,
              border: "1px solid rgba(37,99,235,0.28)",
              background: "rgba(37,99,235,0.08)",
              color: "#1d4ed8",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {openFlow === "a" ? "Ocultar" : "Ver mas"}
          </button>
        </article>

        <article
          className="ma-card-interactive ma-fade-stagger"
          style={{
            position: "relative",
            border: cardBorder,
            borderRadius: 12,
            background: cardBackground,
            boxShadow: isDark ? "none" : "0 8px 22px rgba(15,23,42,0.05)",
            padding: "24px 22px 20px",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: 10,
            minHeight: "clamp(148px, 20vw, 178px)",
            animationDelay: "150ms",
            cursor: "pointer",
          }}
          role="button"
          tabIndex={0}
          onClick={() => toggleFlow("b")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleFlow("b");
            }
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: 20,
              border: "1px solid rgba(37,99,235,0.24)",
              background: "rgba(37,99,235,0.1)",
              color: "#2563eb",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Opcion B
          </span>
          <span
            style={{
              position: "absolute",
              top: 22,
              right: 20,
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid rgba(148,163,184,0.35)",
              color: "#64748b",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
            }}
          >
            &gt;
          </span>
          <div style={{ fontWeight: 800, fontSize: "clamp(17px,5.2vw,20px)", lineHeight: 1.2, color: titleColor }}>
            Te ayudamos a vender como un profesional
          </div>
          <div style={{ fontSize: 12, color: mutedColor, lineHeight: 1.45 }}>
            Definimos el precio, publicamos en portales, filtramos llamadas, agendamos citas y gestionamos la venta completa por ti.
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleFlow("b");
            }}
            style={{
              marginTop: 2,
              border: "1px solid rgba(37,99,235,0.28)",
              background: "rgba(37,99,235,0.08)",
              color: "#1d4ed8",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {openFlow === "b" ? "Ocultar" : "Ver mas"}
          </button>
        </article>
      </div>

      {openFlow === "a" && (
        <section
          style={{
            marginTop: 14,
            border: cardBorder,
            background: isDark ? "rgba(15,23,42,0.7)" : "#f8fafc",
            borderRadius: 12,
            padding: "14px 14px 12px",
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: "#64748b", marginBottom: 10 }}>
            Flujo A - Informacion para vender
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {flowA.map((item, index) => (
              <div key={`a-${item.title}`} style={{ border: cardBorder, borderRadius: 10, background: cardBackground, padding: "9px 10px" }}>
                <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 700, marginBottom: 2 }}>Paso {index + 1}</div>
                <div style={{ fontSize: 13, color: titleColor, fontWeight: 700, lineHeight: 1.35 }}>{item.title}</div>
                {item.sub ? <div style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>{item.sub}</div> : null}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onSelectReport}
              style={{
                border: "1px solid rgba(37,99,235,0.25)",
                background: "linear-gradient(135deg,#2563eb,#3b82f6)",
                color: "#ffffff",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Acceder
            </button>
            <button
              type="button"
              onClick={() => setOpenFlow(null)}
              style={{
                border: "1px solid rgba(37,99,235,0.25)",
                background: "rgba(37,99,235,0.08)",
                color: "#1d4ed8",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Minimizar
            </button>
          </div>
        </section>
      )}

      {openFlow === "b" && (
        <section
          style={{
            marginTop: 14,
            border: cardBorder,
            background: isDark ? "rgba(15,23,42,0.7)" : "#f8fafc",
            borderRadius: 12,
            padding: "14px 14px 12px",
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: "#64748b", marginBottom: 10 }}>
            Flujo B - Venta asistida integral
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {flowB.map((item, index) => (
              <div key={`b-${item.title}`} style={{ border: cardBorder, borderRadius: 10, background: cardBackground, padding: "9px 10px" }}>
                <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 700, marginBottom: 2 }}>Paso {index + 1}</div>
                <div style={{ fontSize: 13, color: titleColor, fontWeight: 700, lineHeight: 1.35 }}>{item.title}</div>
                {item.sub ? <div style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>{item.sub}</div> : null}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onSelectCertificate}
              style={{
                border: "1px solid rgba(37,99,235,0.25)",
                background: "linear-gradient(135deg,#2563eb,#3b82f6)",
                color: "#ffffff",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Acceder
            </button>
            <button
              type="button"
              onClick={() => setOpenFlow(null)}
              style={{
                border: "1px solid rgba(37,99,235,0.25)",
                background: "rgba(37,99,235,0.08)",
                color: "#1d4ed8",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Minimizar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
