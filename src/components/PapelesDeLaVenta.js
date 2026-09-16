import { useEffect, useState } from "react";
import { rutaApi } from "../utils/apiClient";

/**
 * Lo que el cliente ha firmado de este coche, para volver a bajárselo.
 *
 * Firma el mandato y la aceptación del precio, los sube, y desaparecen: se
 * guardan en el cajón privado y los enseña el ERP, que es nuestro. Del suyo no
 * quedaba copia — y son los dos papeles que dicen qué ha aceptado y por cuánto
 * sale su coche. El día que discuta una factura lo tendría todo nuestro y nada
 * suyo.
 *
 * ## Por qué es un componente y no dos bloques
 *
 * La ficha de un coche está escrita **dos veces**: una en el garaje
 * (`/mis-coches`) y otra en el panel (`/panel/vehiculos`). Son dos pantallas
 * distintas con las mismas secciones, y la primera versión de esto acabó solo en
 * una — la que yo miraba, no la que mira ella. Con el bloque escrito una vez, el
 * día que se añada algo aparece en las dos o en ninguna.
 */
/*
 * El nombre empieza por «use» y no por «usa» porque es un hook y la regla de
 * React lo exige por el nombre: con «usa» no reconoce que lo es y se queja de
 * que se llaman hooks fuera de un componente.
 */
export function usePapelesDeLaVenta(vehicleId, activo = true) {
  const [papeles, setPapeles] = useState([]);

  useEffect(() => {
    if (!vehicleId || !activo) { setPapeles([]); return undefined; }
    let vigente = true;
    void (async () => {
      try {
        const res = await fetch(
          rutaApi(`/api/papeles-venta?coche=${encodeURIComponent(vehicleId)}`),
          { credentials: "include" },
        );
        const dato = await res.json().catch(() => ({}));
        if (!vigente) return;
        setPapeles(res.ok && Array.isArray(dato?.data?.papeles) ? dato.data.papeles : []);
      } catch {
        // Que esto falle no puede dejarle sin la ficha del coche.
        if (vigente) setPapeles([]);
      }
    })();
    return () => { vigente = false; };
  }, [vehicleId, activo]);

  return papeles;
}

const elDia = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
};

/** La lista, sin caja: cada pantalla la mete en la suya. */
export default function PapelesDeLaVenta({ papeles = [], borde = "1px solid rgba(150,150,143,0.28)", colorFlojo = "var(--gris-500)" }) {
  if (!papeles.length) return null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {papeles.map((p) => (
        <div key={p.id} style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          border: borde, borderRadius: 10, padding: "10px 12px",
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{p.que_es}</div>
            <div style={{ fontSize: 11.5, color: colorFlojo }}>
              {p.nombre}{elDia(p.cuando) ? ` · ${elDia(p.cuando)}` : ""}
            </div>
          </div>
          {/*
            * Un enlace y no un botón: el servidor contesta con una dirección que
            * caduca a los cinco minutos, y dejar que el navegador la siga es lo
            * que hace que la descarga funcione igual en el móvil que en el
            * ordenador.
            */}
          <a href={rutaApi(`/api/papeles-venta?id=${encodeURIComponent(p.id)}`)}
             style={{
               fontSize: 12.5, fontWeight: 700, textDecoration: "none",
               border: borde, borderRadius: 8, padding: "6px 10px", color: "inherit",
             }}>
            Descargar
          </a>
        </div>
      ))}
    </div>
  );
}
