"use strict";

/**
 * Los pasos del encargo y por dónde va, en un solo sitio.
 *
 * El panel y la app cuentan lo mismo a la misma persona, y hasta ahora lo
 * contaban **cada uno por su cuenta**: el panel en React y la app en TSX, en
 * dos repositorios distintos. Lo que el servidor compartía eran solo las
 * puertas —el coche, los papeles, la tasación—, y ésas no se han
 * desincronizado nunca. Todo lo demás —el mandato, la peritación, el precio,
 * y los titulares de «por dónde vas»— estaba escrito dos veces.
 *
 * Dos copias no se mantienen iguales. El 14-oct-2026, en una sola tarde:
 *
 * - «Ya pasó» se arregló en el panel y la app siguió sin decir nada.
 * - «Estamos preparando tu anuncio» dejó de ser verdad al entrar el precio en
 *   medio; se arregló en la app a las 18:55 y en el panel a las 19:40.
 * - La peritación entró en la lista del panel y en la app no está.
 *
 * Y la prueba más clara de que no es cuestión de cuidado: estas dos frases se
 * escribieron el mismo día, de una sentada, y ya se habían separado.
 *
 *     panel: «...preparamos tu anuncio y te avisamos.»
 *     app:   «...preparamos tu anuncio.»
 *
 * ## Lo que decide esto y lo que no
 *
 * Decide **qué pasos hay, en qué estado está cada uno y qué dicen**. No decide
 * cómo se pintan: el panel enseña el botón de subir dentro de la fila y la app
 * lleva a su pantalla de papeles. Por eso cada paso lleva una `accion` que
 * dice *qué se puede hacer*, no *qué botón dibujar*.
 *
 * ## Y por qué en el servidor y no en una librería compartida
 *
 * Porque la app va empaquetada: cambiar una palabra obliga a construir una APK
 * y a que alguien la instale. Hoy conviven dos versiones instaladas y la web,
 * y eso ya nos ha costado dos diagnósticos falsos. Mandándolo el servidor,
 * hasta una APK vieja dice lo nuevo.
 */

/**
 * El orden de los pasos, que es el orden de verdad.
 *
 * El mandato primero porque se le manda nada más hablar con él. Luego lo suyo
 * —coche, papeles, tasación…—, porque sin coche y sin papeles no hay nada que
 * peritar. Luego la peritación. Y el precio al final, porque se fija con lo
 * que diga la peritación: un coche «con reparos» no vale lo mismo que uno
 * limpio.
 */

/** Lo que falta para la peritación, según en qué punto esté. */
function faltaDeLaPeritacion(estado) {
  if (!estado) return "";
  /*
   * Si el taller lo tumbó, aquí no se cuenta por qué.
   *
   * Es lo único de todo esto que se resuelve hablando, y enterarse por una
   * línea del panel antes de esa llamada es la peor manera de enterarse.
   */
  if (estado.taller_hecho) return "Te llamamos para contarte el resultado.";
  if (estado.tiene_cita) return "Ya tienes día. Lo tienes justo debajo, con la dirección y la hora.";
  return "Es la revisión que nos permite anunciarlo como comprobado. Elige cómo prefieres hacerla.";
}

/**
 * Los pasos del encargo, en orden, con lo que falta de cada uno.
 *
 * @param {object} d
 * @param {Array}  d.puertas  Las que calcula `puertas-del-encargo`.
 * @param {object} d.mandato  `{ encargo_id, mandato_id, firmado }` o null.
 * @param {object} d.estado   `estado_encargo`: taller_hecho, taller_ok, tiene_cita, publicado.
 * @param {object} d.precio   `{ encargo_id, aceptada, importe }` o null.
 */
function losPasos({ puertas = [], mandato = null, estado = null, precio = null } = {}) {
  const suyas = Array.isArray(puertas) ? puertas : [];
  const pasos = [];

  /*
   * El mandato es un paso más, y el primero.
   *
   * Estuvo en un recuadro aparte encima de la lista, y entonces el contador
   * decía «te quedan 4 cosas» cuando le quedaban cinco — y la que no contaba
   * era la más importante: sin el mandato firmado no podemos vender por él ni
   * cobrarle nada.
   */
  if (mandato) {
    pasos.push({
      clave: "mandato",
      nombre: "El mandato firmado",
      abierta: Boolean(mandato.firmado),
      falta: mandato.mandato_id
        ? `Te lo mandamos por correo (${mandato.mandato_id}). Fírmalo y súbelo aquí.`
        : "Te lo mandamos por correo. Fírmalo y súbelo aquí.",
      opcional: false,
      accion: { tipo: "firmar", cual: "mandato", encargo_id: mandato.encargo_id || "" },
    });
  }

  for (const p of suyas) pasos.push({ ...p, accion: p.accion || null });

  /*
   * La peritación, entre lo suyo y el precio.
   *
   * Vivía solo en un recuadro debajo de la lista, así que la lista contaba
   * «6 de 6» y debajo quedaba un paso entero sin contar: el que la mira para
   * saber por dónde va no veía que existiera, y una vez hecha no quedaba
   * rastro. El recuadro cuenta el momento; la lista cuenta el camino.
   */
  if (estado) {
    pasos.push({
      clave: "peritacion",
      nombre: "La peritación",
      abierta: Boolean(estado.taller_hecho && estado.taller_ok),
      falta: faltaDeLaPeritacion(estado),
      opcional: false,
      // Elegir modalidad solo tiene sentido mientras no haya nada en marcha.
      accion: estado.taller_hecho || estado.tiene_cita
        ? null
        : { tipo: "elegir_peritacion" },
    });
  }

  /*
   * Y el precio de salida, el último, y **solo cuando se le ha mandado**.
   *
   * Si estuviera desde el principio, la lista diría «8 de 9» durante semanas
   * por una fila que él no puede tocar, y una lista con una casilla imposible
   * deja de leerse como una lista de cosas que hacer.
   *
   * No es papeleo nuestro: firmarlo es lo único que le deja retirar el encargo
   * sin pagar nada pasados los treinta días. Por eso el texto dice lo que
   * gana, no lo que le pedimos.
   */
  if (precio) {
    pasos.push({
      clave: "precio",
      nombre: "El precio de salida",
      abierta: Boolean(precio.aceptada),
      falta: precio.importe
        ? `Te hemos mandado el documento (${precio.importe}). Fírmalo y súbelo aquí: el anuncio sale con este precio, y así puedes retirar el encargo sin pagar nada pasados 30 días desde que lo publiquemos.`
        : "Te hemos mandado el documento por correo. Fírmalo y súbelo aquí.",
      opcional: false,
      accion: { tipo: "firmar", cual: "precio", encargo_id: precio.encargo_id || "" },
    });
  }

  return pasos;
}

/**
 * Cuántos van y cuántos quedan, contando solo lo que para el anuncio.
 *
 * El contador decía «te quedan 4 cosas para que podamos publicarlo» metiendo
 * dentro el seguro y el historial de revisiones, que no paran nada: un coche
 * se publica y se vende sin ellos. Le estábamos diciendo que su coche no salía
 * por una factura de hace tres años.
 */
function laCuenta(pasos) {
  const obligatorios = (pasos || []).filter((p) => !p.opcional);
  const faltan = obligatorios.filter((p) => !p.abierta).length;
  return { faltan, hechas: obligatorios.length - faltan, total: obligatorios.length };
}

/**
 * Lo que le falta **antes** del precio, que no es lo mismo que lo que le falta.
 *
 * El contador de arriba cuenta todo lo que queda, el precio incluido, y eso
 * está bien: es lo que falta para publicar. Pero decidir si el coche ya está
 * listo para la peritación con ese mismo número es otra cosa, porque el precio
 * va **después**.
 *
 * Con el precio dentro de esa cuenta, en cuanto se le mandaba el papel el
 * panel volvía a tratar el encargo como si no hubiera traído nada y le ofrecía
 * elegir una peritación ya hecha — y esos botones piden otra visita.
 */
function faltanAntesDelPrecio(pasos) {
  return (pasos || []).filter((p) => !p.opcional && !p.abierta && p.clave !== "precio" && p.clave !== "peritacion").length;
}

/**
 * Por dónde va el encargo: un titular, un detalle y a dónde lleva.
 *
 * Uno solo cada vez y excluyentes: dos líneas de estado obligan a decidir cuál
 * es la buena, y la que sobra siempre es la que está desactualizada.
 *
 * Devuelve `null` cuando no hay nada que contar, que es tan importante como lo
 * demás:
 *
 * - **Con cosas suyas por traer**, porque lo que tiene que leer es qué le
 *   falta; «estamos preparando tu anuncio» encima de «te faltan dos cosas» se
 *   contradice con ella, y gana la que menos trabajo da.
 * - **Con la cita puesta**, porque esa cita se enseña entera —día, hora y
 *   sitio— en su propia caja, y dos veces lo mismo obliga a elegir.
 * - **Con el precio mandado y sin firmar**, porque esa línea ya está en la
 *   lista con su importe y su botón.
 *
 * @param {object} d  Lo mismo que `losPasos`, más `peritacion` y `cita`.
 */
function laFase({ estado = null, precio = null, cita = null, pasos = [] } = {}) {
  if (!estado) return null;
  if (faltanAntesDelPrecio(pasos) > 0) return null;

  if (estado.publicado) {
    return {
      titulo: "Tu coche ya está anunciado",
      detalle: "A partir de aquí las llamadas entran por nosotros: filtramos y solo te pasamos las visitas que valen la pena.",
      a: estado.anuncio_url || "",
    };
  }

  if (estado.taller_hecho && estado.taller_ok) {
    /*
     * Pasada la peritación, lo siguiente es el precio y no el anuncio.
     *
     * Esto decía «Ya está todo comprobado, estamos preparando tu anuncio» y
     * dejó de ser verdad: en medio está el papel del precio, que firma él.
     * Decirle que el trabajo es nuestro cuando es suyo es la forma de que no
     * lo haga.
     */
    if (!precio) {
      return {
        titulo: "Peritación hecha",
        detalle: "Ya está todo comprobado. Ahora te mandamos el precio de salida para que lo aceptes, y publicamos tu anuncio.",
        a: "",
      };
    }
    if (!precio.aceptada) return null;
    return {
      titulo: "Ya está todo",
      detalle: "Precio aceptado y coche comprobado. Estamos preparando tu anuncio y te avisamos en cuanto salga.",
      a: "",
    };
  }

  /*
   * Y si el taller lo tumbó, aquí no se dice nada. Dos razones.
   *
   * Una: ya lo dice su paso en la lista —«Te llamamos para contarte el
   * resultado»—, y repetirlo son dos mensajes para una cosa. Además el de la
   * lista aguanta mejor: sale aunque le falten cosas por traer, que es cuando
   * esta caja se calla.
   *
   * Y dos, que es la de fondo: esta caja es verde. «Peritación hecha» en
   * verde sobre un coche que el taller no deja vender dice justo lo
   * contrario de lo que ha pasado.
   */
  if (estado.taller_hecho) return null;

  /*
   * Y la visita que ya pasó y todavía no tiene resultado.
   *
   * No se dice «hecha»: que pase la hora no prueba que nadie viera el coche.
   * Se dice lo que de verdad falta, que es nuestro. Sin esto, la visita
   * desaparecía al día siguiente como si no hubiera existido, porque la
   * tarjeta de la cita solo enseña las futuras.
   */
  if (cita && cita.cita_at && new Date(String(cita.cita_at)).getTime() < Date.now()) {
    return {
      titulo: String(cita.modalidad || "") === "a_domicilio"
        ? "Ya hemos visto tu coche"
        : "Tu coche ya ha pasado la revisión",
      detalle: "Estamos apuntando el resultado. En cuanto esté, preparamos tu anuncio y te avisamos.",
      a: "",
    };
  }

  // Con la cita por llegar, su propia caja lo cuenta entero.
  if (estado.tiene_cita) return null;

  return null;
}

module.exports = { losPasos, laCuenta, faltanAntesDelPrecio, laFase, faltaDeLaPeritacion };
