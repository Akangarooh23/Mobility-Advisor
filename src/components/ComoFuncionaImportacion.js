import React from "react";

/**
 * Qué pasa después de pagar la fianza.
 *
 * Nadie paga mil euros sin saber qué compra. Antes del botón solo se decía que
 * la fianza es del 30 % y que se devuelve si no se hace el pedido; el resto del
 * proceso —el pedido a Alemania, el transporte, los trámites para poder
 * matricularlo aquí— no aparecía por ningún sitio, y es lo que explica por qué
 * esto tarda y por qué hace falta la fianza para empezar.
 *
 * Los pasos son los del expediente: los mismos que el cliente va a ver marcarse
 * en su panel y los mismos que se manejan en el ERP. Aquí no se promete nada
 * que el sistema no siga después.
 */
const PASOS = [
  ["Pagas la fianza", "El 30 % del precio. Te emitimos factura en el momento."],
  ["Hacemos el pedido a Alemania", "Confirmamos que el coche sigue disponible y lo reservamos a tu nombre. Hasta aquí no hay fecha de entrega: la da el vendedor al aceptar el pedido."],
  ["Transporte", "El coche viaja hasta España."],
  ["Trámites", "Impuesto de matriculación, ITV si toca y matrícula española. Nos ocupamos nosotros."],
  ["Entrega", "Te lo entregamos matriculado y listo para circular."],
];

export default function ComoFuncionaImportacion({ isDark = false, compacto = false }) {
  const tenue = isDark ? "var(--gris-400)" : "var(--gris-500)";
  const fuerte = isDark ? "var(--gris-100)" : "var(--gris-900)";

  return (
    <div
      style={{
        textAlign: "left",
        background: isDark ? "rgba(255,255,255,0.04)" : "var(--gris-50)",
        border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid var(--gris-200)",
        borderRadius: 10,
        padding: compacto ? "10px 12px" : "12px 14px",
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 800, color: fuerte, marginBottom: 8 }}>
        Cómo funciona
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
        {PASOS.map(([titulo, detalle], i) => (
          <li key={titulo} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span
              style={{
                flexShrink: 0, width: 17, height: 17, borderRadius: 999,
                background: isDark ? "rgba(255,255,255,0.12)" : "var(--gris-200)",
                color: fuerte, fontSize: 10, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 11.5, lineHeight: 1.5, color: tenue }}>
              <strong style={{ color: fuerte, fontWeight: 700 }}>{titulo}.</strong> {detalle}
            </span>
          </li>
        ))}
      </ol>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: tenue, marginTop: 9, paddingTop: 9, borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid var(--gris-200)" }}>
        Si el coche ya no está o al final no se hace el pedido, se te devuelve la
        fianza entera. Antes de pagar puedes esperar a que te llamemos: te lo
        explicamos y confirmamos la disponibilidad.
      </div>
    </div>
  );
}
