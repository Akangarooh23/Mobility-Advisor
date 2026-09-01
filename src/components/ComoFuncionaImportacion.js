import React from "react";

/**
 * Qué pasa después de depositar el dinero.
 *
 * Nadie transfiere veinte mil euros sin saber qué compra, y esto no es una
 * señal: es **el coche entero más nuestro servicio**. PopCar no le vende el
 * coche —se lo vende el concesionario alemán— así que ese dinero es del
 * vendedor desde el principio. Lo que ponemos nosotros es no soltárselo hasta
 * que uno de los nuestros está delante del coche y confirma que es el que se
 * anunció.
 *
 * Eso es lo que hay que decir aquí, y es lo que decía mal: hablaba de una
 * fianza del 30 %, que era el modelo anterior, cuando comprábamos el coche y
 * se lo vendíamos nosotros.
 *
 * Los pasos son los del expediente: los mismos que el cliente va a ver marcarse
 * en su panel y los mismos que se manejan en el ERP. Aquí no se promete nada
 * que el sistema no siga después.
 */
const PASOS = [
  ["Depositas el importe", "El coche y nuestro servicio, en una cuenta de depósito. Te emitimos factura del servicio en el momento."],
  ["Vamos a verlo a Alemania", "Uno de los nuestros lo revisa en persona y confirma que es el que se anunció. Hasta entonces el vendedor no cobra nada."],
  ["Se libera el pago y se hace el pedido", "El coche queda a tu nombre. La fecha de entrega la da el vendedor al aceptar el pedido."],
  ["Transporte", "El coche viaja hasta España, con parada en Zaragoza para homologarlo y prepararlo."],
  ["Trámites", "ITV de homologación, impuesto de matriculación y matrícula española. Nos ocupamos nosotros."],
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
        Si el coche no es el que se anunció, o ya no está, se te devuelve entero.
        Antes de pagar puedes esperar a que te llamemos: te lo explicamos y
        confirmamos la disponibilidad.
      </div>
    </div>
  );
}
