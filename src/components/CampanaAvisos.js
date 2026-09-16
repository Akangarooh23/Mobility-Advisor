/**
 * La campana de la cabecera: lo que tienes por delante, sin entrar al panel.
 *
 * ## Por qué ahora se despliega
 *
 * Era un botón que llevaba a Solicitudes y nada más. Con un número encima, eso
 * se lee como una promesa de enseñar algo — y si ya estabas en Solicitudes,
 * pulsarla no hacía nada. Un icono con un «5» que al pulsarlo no abre nada es
 * peor que no tener campana.
 *
 * El detalle completo sigue estando en Solicitudes. Esto es **el resumen**: qué
 * es y dónde se hace, para poder resolverlo desde donde estás — que es el
 * valor de una campana, verla mientras miras coches.
 *
 * ## Qué entra y qué no
 *
 * Las citas confirmadas y lo que le falta de su encargo. Nada que no tenga
 * fecha ni sea una tarea suya: una campana que siempre tiene un número deja de
 * mirarse en dos semanas, y entonces no avisa de nada.
 *
 * No se apaga a mano ni tiene «marcar como leído». Una cita desaparece cuando
 * pasa y una tarea cuando la hace. Lo que hay que gestionar para que deje de
 * avisar acaba ignorado.
 *
 * Cuando no hay nada, no se dibuja.
 */
import { useEffect, useRef, useState } from "react";
import { avisosProximos } from "../utils/avisosProximos";
import { lasQueLeFaltanDelEncargo, lasCitasDelTaller } from "../utils/avisosDelEncargo";

/** Cómo se dice lo que hay, sin sumar peras con manzanas. */
function elTexto(citas, encargo, taller) {
  const trozos = [];
  if (citas) trozos.push(citas === 1 ? "una cita próxima" : `${citas} citas próximas`);
  /*
   * La del taller se nombra aparte y no se suma a las citas.
   *
   * Una visita es alguien que viene a ver su coche; esto es él llevándolo a un
   * sitio. Contarlas juntas le haría prepararse para lo que no es.
   */
  if (taller) trozos.push(taller === 1 ? "una revisión en el taller" : `${taller} revisiones en el taller`);
  if (encargo) trozos.push(encargo === 1 ? "una cosa que traernos" : `${encargo} cosas que traernos`);
  return `Tienes ${trozos.join(" y ")}`;
}

/** «mañana a las 17:00», «el 24 de septiembre a las 10:30». */
function cuandoSeDice(cuando) {
  const dia = new Date(cuando);
  if (Number.isNaN(dia.getTime())) return "";
  const hoy = new Date();
  const soloDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((soloDia(dia) - soloDia(hoy)) / 86400000);
  const hora = dia.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (dias === 0) return `hoy a las ${hora}`;
  if (dias === 1) return `mañana a las ${hora}`;
  return `${dia.toLocaleDateString("es-ES", { day: "numeric", month: "long" })} a las ${hora}`;
}

export default function CampanaAvisos({ solicitudes = [], onAbrir, themeMode = "light" }) {
  const [abierta, setAbierta] = useState(false);
  const caja = useRef(null);

  const citas = avisosProximos(solicitudes);
  /*
   * Lo que le falta de su encargo cuenta aquí, y es la excepción a la regla de
   * arriba: sí se acaba. Son cosas concretas que él hace y que desaparecen
   * según las hace, no un estado permanente — y mientras no las traiga, su
   * coche no se puede publicar, que es lo que vino a pedirnos.
   */
  const pendientes = lasQueLeFaltanDelEncargo(solicitudes);
  /*
   * Y la cita del taller, que también tiene día y hora.
   *
   * Es lo único de las seis puertas que ponemos nosotros. Estaba solo dentro de
   * su solicitud, y a Solicitudes se entra a mirar: a una cita hay que llegar
   * antes del jueves, no cuando se acuerde de entrar.
   */
  const revisiones = lasCitasDelTaller(solicitudes);
  const cuantos = citas.length + revisiones.length + pendientes.length;

  /*
   * Se cierra al pulsar fuera y con Escape.
   *
   * Los dos: con el ratón se cierra pulsando fuera y con el teclado no habría
   * forma de salir sin ir a buscar el botón otra vez.
   */
  useEffect(() => {
    if (!abierta) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierta(false); };
    const escape = (e) => { if (e.key === "Escape") setAbierta(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierta]);

  if (!cuantos) return null;

  const isDark = themeMode === "dark";
  const texto = elTexto(citas.length, pendientes.length, revisiones.length);
  const fondo = isDark ? "#1c1c1c" : "#ffffff";
  const borde = isDark ? "rgba(150,150,143,0.28)" : "rgba(150,150,143,0.30)";
  const textoFuerte = isDark ? "var(--gris-100)" : "var(--gris-900)";
  const textoFlojo = isDark ? "var(--gris-400)" : "var(--gris-500)";

  /** Una fila del resumen. Con `href` es un enlace; sin él, lleva al panel. */
  const fila = (clave, titulo, detalle, href) => {
    const dentro = (
      <>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: textoFuerte }}>
          {titulo}
        </span>
        {detalle && (
          <span style={{ display: "block", fontSize: 11.5, color: textoFlojo, lineHeight: 1.4, marginTop: 1 }}>
            {detalle}
          </span>
        )}
      </>
    );
    const estilo = {
      display: "block", width: "100%", textAlign: "left",
      padding: "8px 12px", background: "transparent", border: "none",
      borderTop: `1px solid ${borde}`, cursor: "pointer", textDecoration: "none",
    };
    if (href) {
      return <a key={clave} href={href} style={estilo}>{dentro}</a>;
    }
    return (
      <button key={clave} type="button" style={estilo}
              onClick={() => { setAbierta(false); if (onAbrir) onAbrir(); }}>
        {dentro}
      </button>
    );
  };

  return (
    <div ref={caja} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        title={texto}
        aria-label={texto}
        aria-expanded={abierta}
        aria-haspopup="true"
        style={{
          position: "relative",
          background: "transparent",
          border: "none",
          padding: "6px 8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          lineHeight: 0,
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

      {abierta && (
        <div
          role="dialog"
          aria-label={texto}
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60,
            width: 288, maxWidth: "calc(100vw - 24px)",
            background: fondo, border: `1px solid ${borde}`, borderRadius: 12,
            boxShadow: "0 12px 28px rgba(17,17,17,0.16)", overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: textoFuerte }}>{texto}</div>
          </div>

          {citas.map((c) => fila(
            `cita-${c.id}`,
            c.titulo,
            cuandoSeDice(c.cuando),
            // A su cita si tiene testigo; si no, al panel.
            c.enlace || "",
          ))}

          {revisiones.map((r) => fila(
            r.id,
            r.pidio ? "Nos has pedido cambiar la cita del taller" : "Revisión en el taller",
            r.pidio
              ? "Te llamamos para darte otra fecha"
              : [cuandoSeDice(r.cuando), r.taller].filter(Boolean).join(" · "),
            // A su solicitud, que es donde está la cita entera y donde puede
            // decirnos que no puede ir.
            "",
          ))}

          {pendientes.map((p) => fila(
            p.id,
            p.nombre,
            /*
             * El coche va en el detalle y no en el título: con un solo encargo
             * abierto —lo normal— repetirlo en cada fila es ruido, pero con dos
             * «Los papeles» a secas no dice de cuál.
             */
            [p.falta, p.coche].filter(Boolean).join(" · "),
            p.url,
          ))}

          {fila("ver-todo", "Ver todo en Mis solicitudes", "", "")}
        </div>
      )}
    </div>
  );
}
