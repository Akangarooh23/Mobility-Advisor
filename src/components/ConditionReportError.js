import React from "react";

/**
 * El fallo al abrir la captura, dicho en voz alta.
 *
 * Existe porque no estaba: de los cuatro sitios que ofrecen el informe de
 * estado, solo uno pintaba el error. En los otros tres el botón volvía a su
 * texto normal y el usuario veía un "Abriendo..." que no abría nada, sin
 * ninguna pista de por qué. Un componente compartido en vez de cuatro copias,
 * por la misma razón que el requisito de publicar vive en un solo hook.
 *
 * @param carga El `carga` que devuelve `resumen(vehicleId)` del hook.
 * @param anchoCompleto Para rejillas de varias columnas: ocupa la fila entera.
 */
export default function ConditionReportError({ carga, anchoCompleto = false }) {
  if (carga?.status !== "error") return null;

  const mensaje =
    typeof carga.message === "string" && carga.message.trim() !== ""
      ? carga.message.trim()
      : "No se ha podido abrir la captura. Vuelve a intentarlo.";

  return (
    <p
      role="alert"
      style={{
        margin: 0,
        fontSize: 12,
        lineHeight: 1.35,
        color: "#b91c1c",
        ...(anchoCompleto ? { gridColumn: "1 / -1" } : null),
      }}
    >
      ⚠️ {mensaje}
    </p>
  );
}
