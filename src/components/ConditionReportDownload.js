import React from "react";

/**
 * Descarga del informe de estado, cuando ya está terminado.
 *
 * Un enlace de verdad y no un botón con `fetch`: el navegador sabe abrir un
 * PDF, y así funcionan el clic derecho, "guardar como" y compartir desde el
 * móvil. Se abre en otra pestaña porque el usuario está a mitad de publicar y
 * perder el formulario por consultar el informe sería un mal cambio.
 *
 * El documento lo sirve nuestra API, que comprueba que el coche es del usuario
 * y lo pide a PopCar Check con la clave de servicio. Aquí no hay ningún token
 * de captura, ni debe haberlo.
 */
export default function ConditionReportDownload({ url, compacto = false }) {
  if (typeof url !== "string" || url.trim() === "") return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        textDecoration: "none",
        background: "rgba(15,118,110,0.08)",
        border: "1px solid rgba(15,118,110,0.25)",
        color: "#0f766e",
        borderRadius: 8,
        padding: compacto ? "7px 10px" : "8px 12px",
        fontSize: compacto ? 11 : 12,
        fontWeight: 700,
        textAlign: "center",
        width: compacto ? "100%" : undefined,
        justifySelf: compacto ? undefined : "start",
      }}
    >
      Descargar el informe (PDF)
    </a>
  );
}
