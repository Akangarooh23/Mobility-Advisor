/**
 * Dónde hay que aterrizar cuando se llega desde «lo que te falta del encargo».
 *
 * Las filas del encargo enlazan a `/panel/vehiculos?matricula=8888LXR#papeles`.
 * Sin esto, esa dirección abre la lista de coches y ya: quien tiene tres coches
 * tiene que adivinar cuál, y luego buscar la sección. Mandar a la página y que
 * busque es lo mismo que no decirle dónde, que era el problema entero.
 *
 * Aquí solo se lee la dirección. Abrir el coche y bajar hasta la sección lo
 * hace la pantalla: esto es la parte que se puede probar sin navegador.
 */

/** Las secciones a las que sabemos llevar. Cualquier otra cosa no es un sitio. */
export const SECCIONES = ["datos", "documentos", "informe", "franjas"];

/** Cómo se comparan dos matrículas: sin espacios, sin guiones y en mayúsculas. */
export function comoSeCompara(matricula) {
  return String(matricula || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Qué pide la dirección: qué coche y qué parte.
 *
 * Devuelve siempre las dos claves, vacías si no vienen. Un `null` obligaría a
 * comprobarlo en cada uso y el día que se olvide una comprobación la pantalla
 * se cae al abrir el panel, que es la pantalla que más se abre.
 */
export function loQueLaUrlPide(busqueda = "", ancla = "") {
  let matricula = "";
  try {
    matricula = new URLSearchParams(String(busqueda || "")).get("matricula") || "";
  } catch {
    matricula = "";
  }
  const seccion = String(ancla || "").replace(/^#/, "").trim().toLowerCase();
  return {
    matricula: comoSeCompara(matricula),
    // Una sección que no conocemos se descarta: bajar a un sitio que no existe
    // deja la pantalla en un punto cualquiera y parece un fallo.
    seccion: SECCIONES.includes(seccion) ? seccion : "",
  };
}

/**
 * Cuál de sus coches es.
 *
 * Se compara normalizado porque la matrícula viaja en la dirección como la
 * escribió él —«8888 lxr»— y en la base está como la guardó, que no tiene por
 * qué ser igual.
 */
export function elCocheDeLaUrl(coches, matricula) {
  const busco = comoSeCompara(matricula);
  if (!busco) return null;
  return (coches || []).find((c) => comoSeCompara(c?.plate || c?.matricula) === busco) || null;
}

/** El identificador del ancla en la pantalla. */
export function elAnclaDe(seccion) {
  return SECCIONES.includes(seccion) ? `encargo-${seccion}` : "";
}
