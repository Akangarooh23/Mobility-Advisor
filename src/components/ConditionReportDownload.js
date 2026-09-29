import React, { useState } from "react";

/**
 * Descarga del informe de estado, cuando ya está terminado.
 *
 * ## Por qué ya no es un enlace
 *
 * Era `<a href={url} target="_blank">`, y el razonamiento era bueno: el
 * navegador sabe abrir un PDF, y así funcionan el clic derecho, «guardar como»
 * y compartir desde el móvil.
 *
 * El problema es lo que pasa cuando la respuesta **no** es un PDF. Una
 * navegación se lleva lo que venga y lo pinta tal cual, así que el usuario
 * acababa mirando una pestaña en blanco con esto dentro:
 *
 *     {"error": "Sesión no válida"}
 *
 * Sin botón de volver, sin saber si el fallo era suyo, y sin que quedara nada
 * en la pantalla de la que venía.
 *
 * Y hay una segunda razón, que es la que lo decide: una navegación **solo**
 * puede llevar la cookie. No puede poner cabeceras. La app de PopCar habla con
 * esta API a través de un relé que reenvía la sesión si viene en
 * `authorization` o en `x-popcar-cookie`, y un enlace no puede poner ninguna de
 * las dos. Con `fetch` sí, y el mismo botón sirve para la web y para la app.
 *
 * ## Lo que se pierde y lo que se gana
 *
 * Se pierde el clic derecho sobre el enlace. Se gana que el fichero se
 * **descargue** con su nombre en vez de abrirse, que es lo que pide quien
 * pulsa un botón que dice «descargar», y que un fallo se cuente aquí, debajo
 * del botón, en vez de en una pestaña ajena.
 */
export default function ConditionReportDownload({ url, compacto = false }) {
  const [bajando, setBajando] = useState(false);
  const [fallo, setFallo] = useState("");

  if (typeof url !== "string" || url.trim() === "") return null;

  async function baja() {
    if (bajando) return;
    setFallo("");
    setBajando(true);

    try {
      // `credentials: "include"` es lo que hace que viaje la sesión. La ruta
      // pública del informe no la necesita y no le molesta.
      const res = await fetch(url, { credentials: "include" });

      if (!res.ok) {
        /*
         * El servidor explica lo que pasa; se le hace caso en vez de inventar
         * un «algo ha fallado». Si la respuesta no es JSON legible, queda el
         * código, que al menos distingue un 401 de un 502.
         */
        let dice = "";
        try {
          const cuerpo = await res.json();
          dice = String(cuerpo?.error || "").trim();
        } catch {
          dice = "";
        }
        setFallo(
          dice
            || (res.status === 401
              ? "Tu sesión ha caducado. Vuelve a entrar y prueba otra vez."
              : `No hemos podido traer el informe (error ${res.status}).`)
        );
        return;
      }

      const blob = await res.blob();
      const enlace = document.createElement("a");
      const direccion = URL.createObjectURL(blob);
      enlace.href = direccion;
      enlace.download = "informe-de-estado.pdf";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      // Sin esto, el fichero se queda en memoria hasta que se cierre la pestaña.
      setTimeout(() => URL.revokeObjectURL(direccion), 60_000);
    } catch {
      setFallo("No hemos podido conectar. Comprueba la conexión y prueba otra vez.");
    } finally {
      setBajando(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 4, justifySelf: compacto ? undefined : "start", width: compacto ? "100%" : undefined }}>
      <button
        type="button"
        onClick={baja}
        disabled={bajando}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          background: "rgba(15,118,110,0.08)",
          border: "1px solid rgba(15,118,110,0.25)",
          color: "#0f766e",
          borderRadius: 8,
          padding: compacto ? "7px 10px" : "8px 12px",
          fontSize: compacto ? 11 : 12,
          fontWeight: 700,
          textAlign: "center",
          width: compacto ? "100%" : undefined,
          cursor: bajando ? "progress" : "pointer",
          opacity: bajando ? 0.7 : 1,
        }}
      >
        {bajando ? "Bajando…" : "Descargar el informe (PDF)"}
      </button>

      {fallo && (
        <span style={{ fontSize: compacto ? 10 : 11, color: "#b91c1c", lineHeight: 1.35 }}>
          {fallo}
        </span>
      )}
    </div>
  );
}
