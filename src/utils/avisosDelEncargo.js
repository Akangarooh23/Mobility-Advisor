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
