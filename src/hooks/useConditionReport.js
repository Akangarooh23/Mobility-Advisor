import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Informe de estado (CarsWise Check) para el flujo de publicación.
 *
 * Lo usan los dos sitios desde los que se publica —el IDCar y el panel de
 * vehículos— y por eso vive aquí: el requisito para publicar tiene que ser el
 * mismo se entre por donde se entre, y dos copias de esta lógica acabarían
 * divergiendo.
 *
 * Aquí solo se maneja la referencia al expediente. El informe vive en la base
 * de CarsWise Check, cuyo esquema impide afirmar mecánica sin verificación
 * física y ata cada daño a una pieza de lista cerrada.
 */

/**
 * Con `true`, no se puede publicar en el Marketplace sin informe de estado.
 *
 * Tiene que seguir en `false` hasta que la captura funcione de punta a punta
 * —cámara, subida, anonimizado y análisis—. El candado antes que la llave
 * dejaría el Marketplace sin poder publicar ni un coche, porque hoy nadie
 * puede llegar a tener informe. Mientras tanto se enseña como recomendación,
 * con su botón para hacerlo.
 */
export const INFORME_OBLIGATORIO = false;

/** Estados en los que ya hay un informe utilizable. */
const LISTO = new Set(["informe_listo", "verificada", "publicada"]);

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

const ETIQUETAS = {
  iniciada: ["Sesión abierta, sin fotos todavía", "Session open, no photos yet"],
  capturando: ["Captura en curso", "Capture in progress"],
  subida_completa: ["Fotos subidas", "Photos uploaded"],
  procesando: ["Analizando las fotos", "Analysing the photos"],
  informe_listo: ["Informe de estado listo", "Condition report ready"],
  verificada: ["Verificado en taller", "Verified at a workshop"],
  publicada: ["Expediente publicado", "File published"],
  caducada: ["Enlace caducado", "Link expired"],
  anulada: ["Sesión cancelada", "Session cancelled"],
};

/** El panel es solo en español; el IDCar es bilingüe. De ahí el parámetro. */
export function etiquetaEstado(status, enIngles = false) {
  const par = ETIQUETAS[texto(status)];
  if (!par) return texto(status);
  return enIngles ? par[1] : par[0];
}

/**
 * @param alTerminar Se llama cuando la captura avisa de que ha terminado, por
 *   si la pantalla quiere decir algo. Se guarda en una referencia para que
 *   pasar una función nueva en cada render no reenganche el escuchador.
 */
export function useConditionReport(alTerminar) {
  const [porVehiculo, setPorVehiculo] = useState({});
  const [carga, setCarga] = useState({});
  const ventanaRef = useRef(null);
  const origenRef = useRef("");
  /** Vehículos ya consultados: son los que se refrescan al volver la captura. */
  const conocidosRef = useRef(new Set());
  const alTerminarRef = useRef(alTerminar);
  alTerminarRef.current = alTerminar;

  const cargar = useCallback(async (vehicleId) => {
    const vid = texto(vehicleId);
    if (!vid) return;
    conocidosRef.current.add(vid);
    setCarga((prev) => ({ ...prev, [vid]: { status: "loading", message: "" } }));
    try {
      const res = await fetch(`/api/market?route=condition-report&vehicleId=${encodeURIComponent(vid)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCarga((prev) => ({ ...prev, [vid]: { status: "error", message: texto(data?.error) } }));
        return;
      }
      setPorVehiculo((prev) => ({ ...prev, [vid]: Array.isArray(data?.informes) ? data.informes : [] }));
      setCarga((prev) => ({ ...prev, [vid]: { status: "ready", message: "" } }));
    } catch (err) {
      setCarga((prev) => ({ ...prev, [vid]: { status: "error", message: texto(err?.message) } }));
    }
  }, []);

  const refrescarConocidos = useCallback(() => {
    conocidosRef.current.forEach((vid) => { void cargar(vid); });
  }, [cargar]);

  /**
   * Abre la captura en una pestaña nueva.
   *
   * Sin `noopener` a propósito: sin `window.opener` no hay canal de vuelta y
   * la captura no podría avisar de que ha terminado. El origen del mensaje se
   * comprueba siempre antes de hacerle caso.
   */
  const abrirCaptura = useCallback(async (vehicleId) => {
    const vid = texto(vehicleId);
    if (!vid) return;
    const marcar = (estado) => setCarga((prev) => ({ ...prev, [vid]: estado }));
    marcar({ status: "opening", message: "" });
    try {
      const res = await fetch("/api/market?route=condition-report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: vid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !texto(data?.capture_url)) {
        marcar({ status: "error", message: texto(data?.error) || "No se ha podido abrir la captura." });
        return;
      }

      origenRef.current = new URL(data.capture_url).origin;
      ventanaRef.current = window.open(data.capture_url, "carswise-check");
      if (!ventanaRef.current) {
        marcar({
          status: "error",
          message: "El navegador ha bloqueado la ventana. Permite las ventanas emergentes de este sitio.",
        });
        return;
      }
      marcar({ status: "ready", message: "" });
      await cargar(vid);
    } catch (err) {
      marcar({ status: "error", message: texto(err?.message) });
    }
  }, [cargar]);

  useEffect(() => {
    const alRecibirMensaje = (evento) => {
      if (!origenRef.current || evento.origin !== origenRef.current) return;
      if (evento.data?.tipo !== "carswise-check:fin") return;
      refrescarConocidos();
      if (typeof alTerminarRef.current === "function") alTerminarRef.current(evento.data);
    };
    window.addEventListener("message", alRecibirMensaje);
    return () => window.removeEventListener("message", alRecibirMensaje);
  }, [refrescarConocidos]);

  // Red de seguridad: cerrar la pestaña no significa haber terminado, pero sí
  // que conviene refrescar por si el mensaje no llegó.
  useEffect(() => {
    const temporizador = window.setInterval(() => {
      const ventana = ventanaRef.current;
      if (!ventana || !ventana.closed) return;
      ventanaRef.current = null;
      refrescarConocidos();
    }, 1500);
    return () => window.clearInterval(temporizador);
  }, [refrescarConocidos]);

  /** Lo que necesita saber cualquier pantalla que pinte el informe. */
  const resumen = useCallback((vehicleId) => {
    const vid = texto(vehicleId);
    const lista = porVehiculo[vid] || [];
    const hecho = lista.some((r) => LISTO.has(texto(r.status)));
    return {
      lista,
      carga: carga[vid] || { status: "idle", message: "" },
      hecho,
      // Hay sesión abierta pero todavía no informe: se puede retomar.
      enCurso: !hecho && lista.some((r) => texto(r.capture_url)),
    };
  }, [porVehiculo, carga]);

  return { cargar, abrirCaptura, resumen };
}
