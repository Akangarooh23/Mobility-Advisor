import React from "react";

/**
 * «Ver el coche en tu espacio»: el esquema de daños puesto en el suelo, a escala.
 *
 * Está aquí, junto a la descarga del PDF, porque es el único sitio al que el
 * usuario llega cuando el informe ya está hecho. La pantalla del informe en
 * CarsWise Check vive detrás del enlace de captura, y ese enlace deja de
 * ofrecerse en cuanto la sesión termina — a propósito, para que nadie reabra un
 * expediente cerrado. Sin esta puerta, la vista en 3D no tenía ninguna.
 *
 * No hay visor propio ni motor 3D: los dos sistemas traen el suyo —Quick Look
 * en iOS, Scene Viewer en Android— y se abren con un enlace. Cada uno lee un
 * formato distinto y no hay atajo, de ahí `.usdz` y `.glb` del mismo modelo.
 *
 * En ordenador no hay botón —la realidad aumentada necesita la cámara del
 * teléfono— pero sí un aviso de que existe. Antes no se pintaba nada, y eso
 * hacía la función invisible: quien entra desde el escritorio no tiene forma de
 * saber que en el móvil hay algo más, así que nunca lo prueba. Un botón muerto
 * es peor que nada; un renglón que dice dónde se abre, no.
 */

/** El rótulo dibujado, porque en iOS el enlace no admite texto suelto (ver abajo). */
const ROTULO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 22">
  <g fill="none" stroke="#0f766e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6.8V4.4A1.5 1.5 0 0 1 4.4 3H6.8"/>
    <path d="M15.2 3h2.4A1.5 1.5 0 0 1 19 4.4v2.4"/>
    <path d="M19 15.2v2.4a1.5 1.5 0 0 1-1.4 1.4h-2.4"/>
    <path d="M6.8 19H4.4A1.5 1.5 0 0 1 3 17.6v-2.4"/>
    <path d="M11 7.4 14.6 9.2v3.6L11 14.6 7.4 12.8V9.2z"/>
    <path d="M11 11 14.6 9.2M11 11 7.4 9.2M11 11v3.6"/>
  </g>
  <text x="27" y="15" fill="#0f766e" font-size="12" font-weight="700"
        font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">Ver el coche en tu espacio</text>
</svg>`;

const ROTULO_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ROTULO)}`;

function detectarSistema() {
  if (typeof navigator === "undefined") return "ninguno";
  const ua = navigator.userAgent || "";
  // El iPad se declara Macintosh desde iPadOS 13; lo que lo delata es el táctil.
  const esIpad = /Macintosh/.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;
  if (/iPhone|iPod|iPad/.test(ua) || esIpad) return "ios";
  if (/Android/.test(ua)) return "android";
  return "ninguno";
}

export default function ConditionReportAr({ base, titulo = "Esquema de daños", compacto = false }) {
  if (typeof base !== "string" || base.trim() === "") return null;

  const sistema = detectarSistema();

  if (sistema === "ninguno") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: compacto ? 11 : 11.5,
          color: "#6b7280",
          lineHeight: 1.35,
          width: compacto ? "100%" : undefined,
        }}
      >
        Vista en 3D sobre el suelo de tu garaje: se abre desde el móvil, en esta misma pantalla
      </span>
    );
  }

  const raiz = typeof window !== "undefined" ? window.location.origin : "";
  const usdz = `${raiz}${base}/coche.usdz`;
  const glb = `${raiz}${base}/coche.glb`;

  // Scene Viewer es otra aplicación de Android: necesita la dirección completa,
  // porque quien descarga el fichero no es esta página.
  const parametros = new URLSearchParams({ file: glb, mode: "ar_preferred", title: titulo });
  const escena =
    `intent://arvr.google.com/scene-viewer/1.0?${parametros.toString()}` +
    `#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;` +
    `S.browser_fallback_url=${encodeURIComponent(glb)};end;`;

  const estilo = {
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
  };

  if (sistema === "ios") {
    /**
     * Quick Look solo reconoce el enlace si su único hijo es un `<img>`. Con un
     * `<span>` de texto al lado deja de abrir el visor y se baja el fichero
     * como una descarga cualquiera, así que el rótulo va dentro de la imagen.
     */
    return (
      <a rel="ar" href={usdz} style={estilo} aria-label="Ver el coche en tu espacio">
        <img src={ROTULO_URI} alt="Ver el coche en tu espacio" style={{ height: 20 }} />
      </a>
    );
  }

  return (
    <a href={escena} style={estilo}>
      Ver el coche en tu espacio
    </a>
  );
}
