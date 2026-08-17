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
 * Con `true`, no se puede publicar en el Marketplace sin informe de estado
 * terminado. Decisión de producto: un anuncio sin estado documentado es lo que
 * hace que el comprador no pueda verificar nada a distancia.
 *
 * OJO mientras dure el desarrollo: la captura todavía no funciona de punta a
 * punta —faltan cámara, subida, anonimizado y análisis—, así que hoy ningún
 * coche puede alcanzar `informe_listo` y **no se puede publicar nada**. Es
 * deliberado y no hay usuarios reales. Ponerlo a `false` devuelve el requisito
 * a recomendación en los dos puntos de publicación a la vez.
 */
export const INFORME_OBLIGATORIO = true;

/** Estados en los que ya hay un informe utilizable. */
const LISTO = new Set(["informe_listo", "verificada", "publicada"]);

/**
 * Cuánto ha avanzado una sesión abierta.
 *
 * Se retoma la más avanzada, no la más reciente. Un coche puede acabar con
 * varias sesiones —se abre otra si la anterior se dio por cerrada— y ofrecer la
 * última por ser la última manda al usuario a una pantalla vacía teniendo las
 * dieciséis fotos hechas en otra. Con empate, la más nueva.
 */
const AVANCE = { iniciada: 1, capturando: 2, subida_completa: 3, procesando: 4 };

/** La sesión abierta que conviene retomar, o `null` si no hay ninguna. */
function mejorAbierta(lista) {
  const abiertas = (Array.isArray(lista) ? lista : []).filter((r) => texto(r.capture_url) !== "");
  if (abiertas.length === 0) return null;
  return abiertas.reduce((mejor, actual) =>
    (AVANCE[texto(actual.status)] || 0) > (AVANCE[texto(mejor.status)] || 0) ? actual : mejor
  );
}

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
  /**
   * Espejo de `porVehiculo` para leerlo desde `abrirCaptura` sin meterlo en sus
   * dependencias: si la función se recreara en cada consulta, los botones que
   * la tienen capturada abrirían con datos viejos.
   */
  const datosRef = useRef({});
  datosRef.current = porVehiculo;

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
      const informes = Array.isArray(data?.informes) ? data.informes : [];
      // El origen se aprende aquí y no al abrir: con el enlace directo no pasa
      // nadie por `abrirCaptura`, y sin origen conocido se descartaría el aviso
      // de que la captura ha terminado.
      const conUrl = informes.map((r) => texto(r.capture_url)).find((u) => u !== "");
      if (conUrl) {
        try { origenRef.current = new URL(conUrl).origin; } catch { /* enlace ilegible */ }
      }
      setPorVehiculo((prev) => ({ ...prev, [vid]: informes }));
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
   * La pestaña se abre **en el clic**, vacía, y se lleva a su destino cuando el
   * servidor responde. No es rebuscado: un `window.open` después de un `await`
   * ya no está dentro del gesto del usuario y el navegador lo bloquea —en el
   * móvil, siempre—, así que el botón se quedaba en "Abriendo..." sin abrir
   * nada. Abrir primero y navegar después es lo único que sobrevive al
   * bloqueador, y de paso el usuario ve enseguida que algo pasa.
   *
   * Sin `noopener` a propósito: sin `window.opener` no hay canal de vuelta y
   * la captura no podría avisar de que ha terminado. El origen del mensaje se
   * comprueba siempre antes de hacerle caso.
   */
  const abrirCaptura = useCallback(async (vehicleId) => {
    const vid = texto(vehicleId);
    if (!vid) return;
    const marcar = (estado) => setCarga((prev) => ({ ...prev, [vid]: estado }));

    /**
     * Si ya sabemos adónde ir, se va y punto.
     *
     * Cuando el informe está a medias, la consulta que pinta ese aviso ya trae
     * el enlace de la sesión abierta. Preguntarle otra vez al servidor solo
     * servía para meter un `await` entre el clic y el `window.open`, que es
     * justo lo que hace que el navegador lo bloquee. Sin espera, la apertura
     * ocurre dentro del gesto del usuario y no hay bloqueador que la pare.
     */
    const conocida = texto(mejorAbierta(datosRef.current[vid])?.capture_url);

    if (conocida) {
      const abierta = window.open(conocida, "_blank");
      if (!abierta) {
        marcar({
          status: "error",
          message: "El navegador ha bloqueado la ventana. Permite las ventanas emergentes de este sitio.",
        });
        return;
      }
      origenRef.current = new URL(conocida).origin;
      ventanaRef.current = abierta;
      try { abierta.focus(); } catch { /* algunos navegadores lo ignoran */ }
      marcar({ status: "ready", message: "" });
      void cargar(vid);
      return;
    }

    const ventana = window.open("", "_blank");
    if (ventana) {
      ventanaRef.current = ventana;
      try { ventana.focus(); } catch { /* algunos navegadores lo ignoran */ }
      try {
        ventana.document.write(
          '<!doctype html><meta charset="utf-8">' +
            '<title>Abriendo la captura</title>' +
            '<body style="margin:0;display:grid;place-items:center;height:100vh;' +
            'font:16px system-ui,sans-serif;color:#334155">Abriendo la captura…</body>'
        );
        ventana.document.close();
      } catch {
        // Un navegador quisquilloso con about:blank no es motivo para parar.
      }
    }

    marcar({ status: "opening", message: "" });
    try {
      const res = await fetch("/api/market?route=condition-report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: vid }),
        // El servidor encadena hasta dos llamadas a la captura, de ocho
        // segundos cada una. Pasado eso hay que decirlo, no seguir girando.
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !texto(data?.capture_url)) {
        if (ventana) ventana.close();
        ventanaRef.current = null;
        marcar({ status: "error", message: texto(data?.error) || "No se ha podido abrir la captura." });
        return;
      }

      origenRef.current = new URL(data.capture_url).origin;
      if (!ventana) {
        marcar({
          status: "error",
          message: "El navegador ha bloqueado la ventana. Permite las ventanas emergentes de este sitio.",
        });
        return;
      }
      // `replace` para que el atrás del móvil no vuelva a la pestaña en blanco.
      ventana.location.replace(data.capture_url);
      try { ventana.focus(); } catch { /* algunos navegadores lo ignoran */ }
      marcar({ status: "ready", message: "" });
      await cargar(vid);
    } catch (err) {
      if (ventana) ventana.close();
      ventanaRef.current = null;
      const agotado = err?.name === "TimeoutError" || err?.name === "AbortError";
      marcar({
        status: "error",
        message: agotado
          ? "La captura ha tardado demasiado en responder. Vuelve a intentarlo."
          : texto(err?.message) || "No se ha podido abrir la captura.",
      });
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
    const url = texto(mejorAbierta(lista)?.capture_url);
    return {
      lista,
      carga: carga[vid] || { status: "idle", message: "" },
      hecho,
      // Hay sesión abierta pero todavía no informe: se puede retomar.
      enCurso: !hecho && url !== "",
      /**
       * Enlace de la sesión abierta, si la hay. Que la pantalla lo tenga es lo
       * que permite ofrecer un enlace de verdad en vez de abrir por script.
       * Vacío cuando el informe ya está hecho: repetirlo abre sesión nueva.
       */
      url: hecho ? "" : url,
    };
  }, [porVehiculo, carga]);

  return { cargar, abrirCaptura, resumen };
}
