/**
 * Lo que le falta de su encargo, resumido para el resto del panel.
 *
 * Las cinco puertas se ven enteras en su solicitud. Esto es la versión de una
 * línea, que es lo que cabe en el resumen del home y en la campana.
 *
 * ## Por qué esto sí entra en la campana
 *
 * La campana deja fuera a propósito todo lo que no tiene fecha —peticiones de
 * información, alertas de mercado, novedades—, porque una campana que siempre
 * tiene un número deja de mirarse y entonces no avisa de nada.
 *
 * Esto es distinto y por eso entra: **se acaba**. Son cuatro cosas concretas
 * que él puede hacer y que desaparecen según las hace. No es un estado
 * permanente, es una lista que se vacía — y mientras no se vacíe, su coche no
 * se puede publicar, que es justo lo que vino a pedirnos.
 */

/**
 * Las solicitudes que son un encargo de venta, con todo lo que le falta.
 *
 * El mandato entra como una puerta más, igual que en la lista del panel. Si no
 * entrara, la campana diría «4» mientras la pantalla dice cinco — y la que
 * faltaría de contar sería justo la que decide si podemos vender por él.
 *
 * Se construye aquí y no en la pantalla porque son tres sitios los que tienen
 * que decir el mismo número: la campana, la línea del resumen y la lista.
 */
function losEncargos(solicitudes = []) {
  return (solicitudes || [])
    .filter((s) => s?.type === "venta_gestionada")
    .map((s) => {
      let meta = {};
      try { meta = JSON.parse(s?.meta || "{}"); } catch { meta = {}; }
      const puertas = Array.isArray(meta.puertas) ? meta.puertas : null;
      const mandato = meta.mandato || null;
      if (!puertas && !mandato) return null;

      const todas = mandato
        ? [{
          clave: "mandato",
          nombre: "El mandato firmado",
          abierta: Boolean(mandato.firmado),
          falta: "Fírmalo y súbelo desde tu panel",
        }, ...(puertas || [])]
        : puertas;

      return { id: s.id, titulo: s.title || "tu coche", puertas: todas };
    })
    .filter(Boolean);
}

/**
 * Qué le falta, en una línea.
 *
 * Devuelve `null` cuando no hay nada que decir: ni encargo, o encargo con todo
 * hecho. Un `null` es lo que permite que quien lo use no pinte nada — un objeto
 * con ceros obligaría a cada sitio a acordarse de comprobarlo.
 */
export function loQueLeFaltaDelEncargo(solicitudes = []) {
  const encargos = losEncargos(solicitudes);
  if (encargos.length === 0) return null;

  const pendientes = encargos
    .map((e) => ({ ...e, faltan: e.puertas.filter((p) => !p.abierta) }))
    .filter((e) => e.faltan.length > 0);
  if (pendientes.length === 0) return null;

  const cuantas = pendientes.reduce((n, e) => n + e.faltan.length, 0);
  const primero = pendientes[0];

  return {
    cuantas,
    coches: pendientes.length,
    titulo: primero.titulo,
    /** La primera que le falta, para poder nombrarla en vez de contar. */
    primera: primero.faltan[0],
  };
}

/** Cuántas cosas le faltan en total. Es lo que suma a la campana. */
export function cuantasLeFaltanDelEncargo(solicitudes = []) {
  const falta = loQueLeFaltaDelEncargo(solicitudes);
  return falta ? falta.cuantas : 0;
}

/**
 * Las que le faltan, una a una, para el desplegable de la campana.
 *
 * La línea del resumen cuenta y nombra la primera; aquí hacen falta todas, cada
 * una con a dónde lleva. Va en este fichero y no en la campana porque el
 * criterio de qué falta —y de que el mandato entra— tiene que estar en un solo
 * sitio: si se duplicara, la campana y la lista podrían decir cosas distintas.
 *
 * Lleva el coche en cada fila porque con dos encargos abiertos «Los papeles»
 * sin más no dice de cuál.
 */
export function lasQueLeFaltanDelEncargo(solicitudes = []) {
  return losEncargos(solicitudes).flatMap((e) =>
    e.puertas
      .filter((p) => !p.abierta)
      .map((p) => ({
        id: `${e.id}-${p.clave}`,
        coche: e.titulo,
        nombre: p.nombre,
        falta: p.falta || "",
        /*
         * A dónde lleva. El mandato no tiene `donde` a propósito: se sube desde
         * su solicitud, así que esa fila va allí.
         */
        url: p.donde?.url || "",
      }))
  );
}

/**
 * La línea del resumen del home.
 *
 * Con una sola cosa se la nombra —«Te falta la ITV»— porque nombrarla es lo
 * que hace que se pueda hacer ahora mismo. Con varias se cuenta y se nombra la
 * primera: una lista de cuatro en una línea no se lee.
 */
export function laLineaDelEncargo(solicitudes = []) {
  const falta = loQueLeFaltaDelEncargo(solicitudes);
  if (!falta) return null;

  const { cuantas, primera, titulo, coches } = falta;
  const deQue = coches > 1 ? `${coches} coches` : titulo;

  return {
    id: "encargo-pendiente",
    icon: "📋",
    label: cuantas === 1
      ? `Te queda una cosa para que vendamos ${deQue}`
      : `Te quedan ${cuantas} cosas para que vendamos ${deQue}`,
    detail: primera?.falta
      ? `${primera.nombre}: ${primera.falta}`
      : primera?.nombre || "",
    section: "solicitudes",
    type: "encargo",
  };
}

/**
 * Las citas del taller que todavía no han pasado.
 *
 * Es lo único de las seis puertas que ponemos nosotros, y tiene día y hora: por
 * eso entra en la campana, que deja fuera a propósito todo lo que no la tiene.
 * Que esté en su solicitud no basta — a Solicitudes se entra a mirar, y a esto
 * hay que llegar antes del jueves.
 *
 * Solo las futuras. Una cita pasada no avisa de nada y, si el taller no ha
 * contestado todavía, lo que hay que hacer es esperar, no volver a llevarlo.
 *
 * El servidor ya manda solo las que se le han contado al cliente y las que no
 * están hechas; aquí se filtra por fecha, que es lo único que cambia solo.
 */
export function lasCitasDelTaller(solicitudes = [], ahora = new Date()) {
  return (solicitudes || [])
    .filter((s) => s?.type === "venta_gestionada")
    .map((s) => {
      let meta = {};
      try { meta = JSON.parse(s?.meta || "{}"); } catch { meta = {}; }
      const cita = meta.taller;
      if (!cita || !cita.cita_at) return null;
      const cuando = new Date(cita.cita_at);
      if (Number.isNaN(cuando.getTime()) || cuando <= ahora) return null;
      return {
        id: `taller-${s.id}`,
        cuando,
        coche: s.title || "tu coche",
        taller: cita.taller || "",
        direccion: cita.direccion || "",
        /* Lo que ya haya pedido sobre ella: con una petición en marcha, lo que
           se le dice no es «llévalo el jueves» sino «te llamamos». */
        pidio: cita.cliente_pidio || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.cuando - b.cuando);
}

/**
 * La cita del taller en una línea, para el resumen del home.
 *
 * Va aparte de las visitas y no mezclada con ellas: una visita es alguien que
 * viene a ver su coche y esto es él llevándolo a un sitio. Llamarlas igual
 * —«tienes 2 visitas»— haría que se preparara para lo que no es.
 */
export function laLineaDeLaCitaDelTaller(solicitudes = [], ahora = new Date()) {
  const citas = lasCitasDelTaller(solicitudes, ahora);
  if (citas.length === 0) return null;

  const c = citas[0];
  const dia = c.cuando.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const hora = c.cuando.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  return {
    id: "cita-taller",
    icon: "🔧",
    label: c.pidio
      ? "Nos has pedido cambiar la cita del taller"
      : `Revisión en el taller el ${dia} a las ${hora}`,
    detail: c.pidio
      ? "Te llamamos para darte otra fecha"
      : [c.taller, c.direccion].filter(Boolean).join(" · ") || c.coche,
    section: "solicitudes",
    type: "cita-taller",
  };
}
