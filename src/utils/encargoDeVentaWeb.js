/**
 * El formulario de «Nosotros lo vendemos por ti».
 *
 * Hasta ahora ese botón llevaba al formulario de contacto general: nombre,
 * apellido, correo, teléfono y un mensaje libre. Dos problemas.
 *
 * El primero es que **prometía otra cosa**. El botón dice «cuéntanos qué coche
 * tienes y en cuánto tiempo quieres venderlo», y luego no preguntaba ninguna de
 * las dos. Quien cogía el teléfono empezaba de cero sobre algo que el cliente ya
 * había accedido a contar.
 *
 * El segundo es que **no creaba nada**: mandaba un correo a una bandeja. Un
 * cliente que pide que le vendamos el coche no aparecía en ninguna pantalla.
 *
 * Aquí están las dos preguntas que sí hay que hacer y cómo viajan al ERP.
 */

/**
 * En cuánto tiempo quiere venderlo.
 *
 * Es la pregunta que decide la conversación: al que tiene prisa se le habla de
 * precio de salida y al que no, de precio máximo. Y es la que separa a quien va
 * a aceptar nuestro precio de quien no — que es justo lo que parte en dos la
 * penalización por cancelar.
 *
 * Cerrada y corta a propósito. Un campo libre da «lo antes posible», «depende» y
 * «cuando salga», que no se pueden ordenar ni contar.
 */
export const PLAZOS = [
  { clave: "ya", etiqueta: "Cuanto antes" },
  { clave: "1mes", etiqueta: "En un mes" },
  { clave: "3meses", etiqueta: "En dos o tres meses" },
  { clave: "sinprisa", etiqueta: "Sin prisa, busco el mejor precio" },
];

/** El tipo con el que entra en el ERP. */
export const TIPO = "venta_gestionada";

/** De dónde vino, para poder contar qué convierte. */
export const ORIGEN = "web-vender";

function nt(v) {
  return typeof v === "string" ? v.trim() : "";
}

export function pareceUnCorreo(v) {
  const s = nt(v);
  return s.length > 4 && s.length < 255 && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(s);
}

export function elPlazo(clave) {
  return PLAZOS.find((p) => p.clave === nt(clave)) || null;
}

/**
 * La matrícula, como se compara: sin espacios ni guiones y en mayúsculas.
 *
 * «8888LXR», «8888 LXR» y «8888-lxr» son el mismo coche, y quien la copia de un
 * papel se trae los espacios.
 */
export function comoSeCompara(matricula) {
  return String(matricula ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Si eso parece una matrícula.
 *
 * Gemela de `pareceUnaMatricula` en `lib/coche-por-matricula.js`, y por la misma
 * razón que las dos `marca.js`: `src/` no puede importar de `lib/`. Que no se
 * separen lo vigila una prueba que pasa la misma lista de casos por las dos.
 *
 * Se acepta ancha a propósito —de seis a diez, con letras y números— porque
 * también hay coches con matrícula antigua. Rechazar la de alguien que quiere
 * vendernos su coche cuesta mucho más que dejar pasar una rara: lo segundo se
 * arregla en la llamada y lo primero le echa.
 */
export function pareceUnaMatricula(matricula) {
  const m = comoSeCompara(matricula);
  return m.length >= 6 && m.length <= 10 && /[0-9]/.test(m) && /[A-Z]/.test(m);
}

/**
 * Qué falta para poder mandarlo, en la frase que se le enseña.
 *
 * El coche se pide por **matrícula** y no como texto libre. «Volkswagen T-Roc R
 * line 2022» no identifica ningún coche: hay miles, y quien tiene que adivinar
 * cuál es es el que coge el teléfono — justo el que menos lo sabe.
 *
 * Con la matrícula, antes de marcar ya se sabe si ese coche tiene ficha o hay
 * que pedirla. Es lo que se pretendía sacar de obligar a registrarse, pero sin
 * la puerta: una matrícula te la sabes de memoria y está a la vista de todos en
 * el propio coche.
 *
 * Quien ha entrado y elige uno de los suyos no la escribe: ahí el coche ya está
 * identificado por su ficha, que es mejor todavía.
 */
export function faltaParaMandarlo({ vehicleId, matricula, plazo, nombre, telefono, email } = {}) {
  if (!nt(vehicleId) && !pareceUnaMatricula(matricula)) {
    return "Escribe la matrícula de tu coche.";
  }
  if (!elPlazo(plazo)) return "Dinos en cuánto tiempo quieres venderlo.";
  if (!nt(nombre)) return "Escribe tu nombre.";
  if (nt(telefono).replace(/\D/g, "").length < 9) return "Escribe un teléfono: te llamamos nosotros.";
  if (!pareceUnCorreo(email)) return "Escribe un correo válido.";
  return "";
}

/**
 * Lo que se manda al ERP.
 *
 * El plazo viaja en `contact_when`, que ya es el campo de detalles libres —en
 * renting lleva «Plazo: 36m · 15.000 km/año»—, con la misma forma de
 * «Etiqueta: valor» para que se lea igual en la ficha del lead.
 */
export function loQueSeManda({ coche, matricula, plazo, nombre, telefono, email }) {
  const p = elPlazo(plazo);
  const placa = comoSeCompara(matricula);
  return {
    type: TIPO,
    portal: ORIGEN,
    email: nt(email).toLowerCase(),
    name: nt(nombre),
    phone: nt(telefono),
    /*
     * El título es lo que se lee en la lista de leads. Cuando eligió uno de sus
     * coches, ahí va su nombre; cuando escribió la matrícula, va la matrícula,
     * que es lo único que sabemos y es más de lo que teníamos antes.
     */
    vehicle_title: nt(coche) || placa,
    /*
     * Y la matrícula aparte, normalizada, para que el ERP pueda mirar si ese
     * coche ya tiene ficha. Dentro del título no se puede buscar: ahí llega
     * como la escribió él, con sus espacios y sus guiones.
     */
    plate: placa || undefined,
    when: `Quiere vender: ${p ? p.etiqueta.toLowerCase() : "sin decir"}`,
  };
}


/**
 * La ruta de la guía de cómo dar de alta el coche.
 *
 * Escrita una vez: estaba en un solo sitio del formulario —dentro del aviso que
 * solo ve quien ha entrado y no tiene coches— y desde fuera no se llegaba a
 * ella por ningún lado.
 */
export const GUIA = "/como-subir-tu-coche";

/** Donde el cliente da de alta su coche. */
export const ALTA = "/panel/vehiculos";

/**
 * Y con la matrícula ya puesta, para que llegue con el campo relleno.
 *
 * Acaba de escribirla en el formulario: volver a pedírsela en la pantalla
 * siguiente es el tipo de detalle por el que la gente abandona a mitad. Sin
 * matrícula devuelve la ruta a secas, no una con un parámetro vacío.
 */
export function elAlta(matricula) {
  const m = comoSeCompara(matricula);
  return m ? `${ALTA}?matricula=${encodeURIComponent(m)}` : ALTA;
}

/**
 * Dónde se guarda la matrícula mientras el cliente entra o se registra.
 *
 * El que pulsa «crear la ficha de mi coche» casi nunca tiene sesión —es el que
 * llega de coches.net, y el que acaba de mandar el formulario sin registrarse—,
 * así que entre el enlace y la pantalla hay un login por medio.
 *
 * Y después del login la aplicación reescribe la dirección a su ruta canónica.
 * A veces coincide y la matrícula sobrevive; en otras ramas no. Depender de eso
 * es depender de por dónde entró, y el fallo no se ve: el cliente llega a la
 * pantalla correcta con el campo vacío y vuelve a escribir la matrícula que
 * acaba de escribir. Nadie reporta eso, simplemente cansa.
 *
 * `sessionStorage` y no `localStorage`: es de este viaje. Si mañana entra a dar
 * de alta otro coche, la matrícula de hoy no tiene que aparecerle.
 */
const DONDE = "popcar.matricula.alta";

/** Se guarda en cuanto se ve en la dirección, antes de que nadie la reescriba. */
export function recuerdaLaMatricula(busqueda) {
  if (typeof window === "undefined") return "";
  try {
    const s = typeof busqueda === "string" ? busqueda : window.location.search;
    const m = comoSeCompara(new URLSearchParams(s).get("matricula"));
    if (m) window.sessionStorage.setItem(DONDE, m);
    return m;
  } catch {
    return "";
  }
}

/**
 * Y se recupera al llegar.
 *
 * Se borra al leerla: es para rellenar el campo una vez. Si se quedara, el
 * siguiente coche que diera de alta nacería con la matrícula del anterior, que
 * es peor que el campo vacío — un campo vacío se rellena y uno mal puesto se
 * guarda.
 */
export function laMatriculaRecordada() {
  if (typeof window === "undefined") return "";
  try {
    const m = window.sessionStorage.getItem(DONDE) || "";
    if (m) window.sessionStorage.removeItem(DONDE);
    return comoSeCompara(m);
  } catch {
    return "";
  }
}

/**
 * Cómo se le llama al coche cuando se le repite lo que dijo.
 *
 * Es el único sitio donde ve lo que escribió. Si se equivocó al teclear la
 * matrícula, esta es la última oportunidad de que lo vea antes de que alguien
 * llame preguntando por un coche que no es el suyo.
 *
 * Manda el nombre sobre la matrícula: cuando eligió uno de sus coches, «Seat
 * Ibiza 2019 · 8888LXR» es lo que él reconoce; la matrícula sola solo la
 * reconoce quien la acaba de teclear.
 *
 * Cadena vacía si no hay nada que repetir, para que la pantalla no acabe
 * diciendo «por el ».
 */
export function elCocheQueDijo({ coche, matricula } = {}) {
  return nt(coche) || comoSeCompara(matricula);
}

/**
 * Qué se le dice después de mandarlo.
 *
 * Había un solo texto para todos y decía **«no tienes que hacer nada más»**.
 * Para quien ha entrado y ha elegido uno de sus coches es verdad. Para quien no
 * ha entrado no lo sabemos, y si resulta que no tiene la ficha creada, lo que
 * le espera es justo lo contrario: matrícula, seis fotos, permiso de
 * circulación, ficha técnica e ITV.
 *
 * Prometerle que no hay nada más y pedirle todo eso en la llamada es la manera
 * de que la llamada empiece mal. Se le dice antes, sin asustarle: no es un
 * requisito nuevo, es lo mismo que iba a tener que hacer igualmente.
 */
export function loQueLeQueda({ haySesion, eligioUnCoche } = {}) {
  /*
   * Solo cuando sabemos que el coche existe se promete que no queda nada. Y eso
   * solo se sabe si lo ha elegido de su lista: tener sesión no basta —puede
   * haber entrado y escrito el coche a mano— y en ese caso estamos igual de a
   * oscuras que sin sesión.
   */
  if (haySesion && eligioUnCoche) {
    return {
      texto:
        "No tienes que hacer nada más, y no hay ningún compromiso.",
      guia: false,
    };
  }
  /*
   * Y aquí no se acaba: aquí empieza.
   *
   * Esta pantalla era un acuse de recibo —«te llamamos, no hagas nada»— y es el
   * momento de más intención de todo el flujo: acaba de pulsar el botón. Lo que
   * hace falta para vender su coche —la ficha con fotos y papeles— la hace él,
   * y la hará mejor ahora que dentro de tres días cuando le llamemos.
   *
   * No es una condición para nada: si no la crea, se la pedimos en la llamada
   * como siempre. Es quitarle la espera a quien ya ha decidido.
   */
  return {
    texto:
      "Para venderlo necesitaremos la ficha de tu coche: unas fotos y los " +
      "papeles. Puedes irla creando ahora y así vamos con medio camino hecho — " +
      "y si lo prefieres, te lo explicamos en la llamada. No hay ningún compromiso.",
    guia: true,
  };
}
