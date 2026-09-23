/**
 * Lo que ya nos pidió, para no dejar que lo pida otra vez sin saberlo.
 *
 * Juan pidió que le vendiéramos su Lancia a las 22:40:06 y otra vez a las
 * 22:40:46. No fue un doble clic —el botón se bloquea mientras envía— sino que
 * volvió a la página y la encontró **vacía**, igual que la primera vez, sin una
 * sola señal de que su solicitud existía ya. Desde donde él estaba, no había
 * pasado nada; lo razonable era volver a pedirlo.
 *
 * En el servidor hay una red que impide apuntarlo dos veces
 * (`lib/lead-repetido.js`). Esto es lo otro: que no tenga que caer en la red.
 * La página se acuerda y se lo dice antes de que rellene nada.
 *
 * ## Qué es «la suya»
 *
 * La solicitud de vender **este** coche que todavía espera algo. El coche se
 * reconoce por su identificador cuando lo eligió de su garaje, y por la
 * matrícula cuando la escribió a mano, que son las dos maneras en que un coche
 * llega a una solicitud.
 *
 * Si ya se atendió y se cerró, no cuenta: volver a escribir entonces es una
 * solicitud de verdad y el formulario tiene que dejarle.
 */

/** El tipo de solicitud del que habla esto: «nosotros lo vendemos por ti». */
export const TIPO_VENTA = "venta_gestionada";

/**
 * Los estados en los que una solicitud ya no espera nada.
 *
 * Gemela de `YA_NO_ESPERA` en `lib/lead-repetido.js`, y por la misma razón que
 * las dos `marca.js`: `src/` no puede importar de `lib/`. Que no se separen lo
 * vigila una prueba que compara las dos listas.
 */
export const YA_NO_ESPERA = ["Cerrado", "Vendido", "Entregado", "Cancelado", "Descartado"];

function nt(v) {
  return typeof v === "string" ? v.trim() : "";
}

/** La matrícula como se compara: sin espacios ni guiones y en mayúsculas. */
function comoSeCompara(matricula) {
  return String(matricula ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Lo que el panel guarda como texto dentro de `meta`, sin reventar si viene mal. */
function elMeta(solicitud) {
  const m = solicitud?.meta;
  if (!m) return {};
  if (typeof m === "object") return m;
  try {
    return JSON.parse(m) || {};
  } catch {
    return {};
  }
}

/** Si esa solicitud todavía espera algo de nosotros. */
export function sigueViva(solicitud) {
  return !YA_NO_ESPERA.includes(nt(solicitud?.status));
}

/**
 * Las matrículas por las que se reconoce el coche de una solicitud.
 *
 * Una va suelta en `meta.matricula_encargo`. La otra está dentro del título
 * —«Lancia Ypsilon 2005 · 0296DYJ»—, que es lo único que hay cuando la escribió
 * a mano y todavía no se ha cruzado con ningún coche del garaje.
 */
function susMatriculas(solicitud) {
  const meta = elMeta(solicitud);
  const delTitulo = nt(solicitud?.title).split("·").pop();
  return [comoSeCompara(meta.matricula_encargo), comoSeCompara(delTitulo)].filter(Boolean);
}

/**
 * La solicitud viva de vender **este** coche, si la hay.
 *
 * Sin coche identificado no devuelve nada: bloquear el formulario porque tiene
 * una solicitud de otro coche sería peor que el problema que arregla.
 */
export function laDeEsteCoche(solicitudes, { vehicleId = "", matricula = "" } = {}) {
  const id = nt(vehicleId);
  const mat = comoSeCompara(matricula);
  if (!id && !mat) return null;

  return (Array.isArray(solicitudes) ? solicitudes : []).find((s) => {
    if (nt(s?.type) !== TIPO_VENTA || !sigueViva(s)) return false;
    if (id && nt(s?.vehicle_id) === id) return true;
    return Boolean(mat) && susMatriculas(s).includes(mat);
  }) || null;
}

/**
 * La última que sigue viva, sea del coche que sea.
 *
 * Es para el aviso de arriba —«ya nos pediste vender tu Lancia»— que se enseña
 * antes de que elija nada. No bloquea: si lo que quiere es vender otro coche,
 * que lo pida.
 */
export function laMasRecienteViva(solicitudes) {
  return (Array.isArray(solicitudes) ? solicitudes : [])
    .filter((s) => nt(s?.type) === TIPO_VENTA && sigueViva(s))
    .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))[0] || null;
}

/** El día en que la pidió, para poder decírselo. */
export function cuandoLaPidio(solicitud) {
  const d = new Date(solicitud?.createdAt || 0);
  if (!solicitud?.createdAt || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

/**
 * Por dónde va, en una frase que valga para él.
 *
 * «Pendiente» y «Contactado» son palabras del ERP; lo que él necesita saber es
 * si tiene que hacer algo o esperar. Cualquier estado que no esté aquí cae en
 * el mismo sitio, que es el que sirve para todos: la tenemos y seguimos.
 */
export function porDondeVa(solicitud) {
  const estado = nt(solicitud?.status);
  if (estado === "Pendiente") return "Te llamamos para hablar de tu coche.";
  if (estado === "Contactado") return "Ya hemos hablado contigo y seguimos con ello.";
  return "La tenemos y seguimos con ella.";
}
