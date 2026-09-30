import { rutaApi } from "./apiClient";

/**
 * Cuando la web se rompe en el móvil de alguien, que se sepa.
 *
 * ## Qué no se veía
 *
 * Nada de esto. Todo lo que hay de seguimiento vive del lado del servidor, así que
 * si a alguien se le queda la pantalla **en blanco** —un error de JavaScript en
 * una pantalla concreta, con un coche concreto— no se enteraba nadie. Esa persona
 * se va y no escribe.
 *
 * Y es el fallo más caro que hay, porque no deja rastro: no hay un 500 en los
 * registros, no hay una petición fallida, no hay nada. Solo alguien que no vuelve.
 *
 * ## Los dos sitios por donde se escapa un error en React
 *
 *   · **`error`** —lo que se lanza y nadie recoge, incluidos los errores de
 *     carga de un `chunk` que no llega;
 *   · **`unhandledrejection`** —una promesa que falla sin `catch`. Es el caso
 *     más común aquí, porque casi todo lo que hace la web es pedir algo.
 *
 * Los límites de esto, dichos:
 *
 *   · un error dentro del renderizado de React **no** llega a `window.onerror`
 *     de forma fiable; para eso hace falta un `ErrorBoundary`, que es otra cosa
 *     y va aparte;
 *   · y la pila vendrá **ilegible**, porque el JavaScript de producción está
 *     minificado: en vez de `abreLaFichaDelCoche` se verá `a.b is not a function
 *     en chunk.js:1:48219`. Por eso se manda contexto —la pantalla, la dirección—
 *     que en la práctica dice más que la pila.
 *
 * ## Lo que hace para no ser parte del problema
 *
 *   · **no se manda dos veces lo mismo**: un error en un `useEffect` se repite en
 *     cada renderizado, y sin esto un solo móvil mandaría miles de peticiones;
 *   · **como mucho diez por sesión**, y luego calla;
 *   · **`keepalive`**, para que el aviso salga aunque la persona cierre la
 *     pestaña justo después, que es exactamente lo que hace quien ve una pantalla
 *     en blanco;
 *   · y **nunca lanza**. Un avisador de fallos que falla deja dos errores donde
 *     había uno.
 */

/** Cuántos se mandan por sesión antes de callar. */
const TOPE_POR_SESION = 10;

/** Lo que se considera «el mismo error» para no repetirlo. */
const yaMandados = new Set();
let cuantos = 0;

/** Quién lo está sufriendo, si hay sesión. Lo pone la aplicación. */
let dameElContexto = () => ({});

/**
 * La aplicación dice cómo saber en qué pantalla está y quién la usa.
 *
 * Se pasa una función y no un objeto porque esto se instala una vez al arrancar y
 * la pantalla cambia cada dos por tres.
 */
export function elContextoLoDa(fn) {
  if (typeof fn === "function") dameElContexto = fn;
}

function laHuella(donde, mensaje) {
  return `${donde}::${String(mensaje || "").slice(0, 200)}`;
}

/**
 * Manda un fallo. Se puede llamar a mano desde un `catch` que antes callaba.
 *
 * Devuelve `true` si se mandó, `false` si se calló por repetido o por tope.
 */
export function avisaDeUnFallo(donde, error, extra = {}) {
  try {
    if (typeof window === "undefined") return false;
    if (cuantos >= TOPE_POR_SESION) return false;

    const mensaje = error instanceof Error ? error.message : String(error ?? "");
    const huella = laHuella(donde, mensaje);
    if (yaMandados.has(huella)) return false;

    yaMandados.add(huella);
    cuantos += 1;

    let delADonde = {};
    try {
      delADonde = dameElContexto() || {};
    } catch {
      delADonde = {};
    }

    const paquete = {
      donde: String(donde || "navegador: sin sitio"),
      mensaje,
      pila: error instanceof Error && typeof error.stack === "string"
        ? error.stack.split("\n").slice(0, 8).join("\n")
        : null,
      direccion: window.location?.href || "",
      pantalla: delADonde.pantalla || "",
      quien: delADonde.quien || "",
      version: delADonde.version || "",
      contexto: { ...(delADonde.contexto || {}), ...(extra || {}) },
    };

    /*
     * `keepalive` es lo que hace que esto sirva: quien ve una pantalla en blanco
     * cierra la pestaña, y sin esto el navegador cancela la petición a medias y el
     * fallo se pierde justo en el caso que más importa.
     */
    void fetch(rutaApi("/api/error"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paquete),
      keepalive: true,
    }).catch(() => {
      /*
       * Y si ni esto se puede mandar —sin red, o es la propia API la que está
       * caída— no se hace nada más. Reintentar desde una web que ya está rota es
       * empeorarlo.
       */
    });

    return true;
  } catch {
    // Un avisador de fallos que falla deja dos errores donde había uno.
    return false;
  }
}

/**
 * Se engancha a los dos sitios por donde se escapa un error. Se llama una vez.
 *
 * Devuelve la función que lo desengancha, que es lo que esperan las pruebas y lo
 * que usa el efecto que lo instala.
 */
export function enganchaLosAvisos() {
  if (typeof window === "undefined") return () => {};

  const alFallar = (evento) => {
    avisaDeUnFallo(
      "navegador: error sin recoger",
      evento?.error || evento?.message || "error sin detalle",
      {
        fichero: evento?.filename || undefined,
        linea: evento?.lineno || undefined,
      }
    );
  };

  const alFallarUnaPromesa = (evento) => {
    avisaDeUnFallo("navegador: promesa sin recoger", evento?.reason || "promesa rechazada sin motivo");
  };

  window.addEventListener("error", alFallar);
  window.addEventListener("unhandledrejection", alFallarUnaPromesa);

  return () => {
    window.removeEventListener("error", alFallar);
    window.removeEventListener("unhandledrejection", alFallarUnaPromesa);
  };
}

/** Para las pruebas: vuelve a empezar la cuenta. */
export function olvidaLoMandado() {
  yaMandados.clear();
  cuantos = 0;
  dameElContexto = () => ({});
}

export { TOPE_POR_SESION };
