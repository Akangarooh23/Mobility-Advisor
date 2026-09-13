/**
 * La campana de la cabecera: cuántas citas tienes por delante.
 *
 * Es un enlace, no un desplegable. El detalle ya está en Solicitudes, en su
 * bloque de arriba, y montar aquí un panel con su propio diseño sería duplicar
 * eso y tener luego que mantener los dos.
 *
 * No se apaga a mano ni tiene «marcar como leído»: una cita desaparece cuando
 * pasa. Lo que hay que gestionar para que deje de avisar acaba ignorado.
 *
 * Cuando no hay nada, no se dibuja. Un icono permanentemente apagado es ruido
 * en una cabecera que ya tiene bastante.
 */
import { cuantosAvisos } from "../utils/avisosProximos";
import { cuantasLeFaltanDelEncargo } from "../utils/avisosDelEncargo";

/** Cómo se dice lo que hay, sin sumar peras con manzanas. */
function elTexto(citas, encargo) {
  const trozos = [];
  if (citas) trozos.push(citas === 1 ? "una cita próxima" : `${citas} citas próximas`);
  if (encargo) trozos.push(encargo === 1 ? "una cosa que traernos" : `${encargo} cosas que traernos`);
  return `Tienes ${trozos.join(" y ")}`;
}

export default function CampanaAvisos({ solicitudes = [], onAbrir, themeMode = "light" }) {
  const citas = cuantosAvisos(solicitudes);
  /*
   * Lo que le falta de su encargo cuenta aquí, y es la excepción a la regla de
   * arriba: sí se acaba. Son cosas concretas que él hace y que desaparecen
   * según las hace, no un estado permanente — y mientras no las traiga, su
   * coche no se puede publicar, que es lo que vino a pedirnos.
   */
  const encargo = cuantasLeFaltanDelEncargo(solicitudes);
  const cuantos = citas + encargo;
  if (!cuantos) return null;

  const isDark = themeMode === "dark";
  const texto = elTexto(citas, encargo);

  return (
    <button
      type="button"
      onClick={onAbrir}
      title={texto}
      aria-label={texto}
      style={{
        position: "relative",
        background: "transparent",
        border: "none",
        padding: "6px 8px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        lineHeight: 0,
        flexShrink: 0,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
           stroke={isDark ? "var(--gris-300)" : "var(--gris-600)"} strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      <span
        style={{
          position: "absolute",
          top: 2,
          right: 2,
          minWidth: 16,
          height: 16,
          padding: "0 4px",
          borderRadius: 8,
          // La marca es #111111: el número tiene que ir en blanco.
          background: "var(--marca)",
          color: "#fff",
          fontSize: 10,
          fontWeight: 800,
          lineHeight: "16px",
          textAlign: "center",
        }}
      >
        {cuantos > 9 ? "9+" : cuantos}
      </span>
    </button>
  );
}
