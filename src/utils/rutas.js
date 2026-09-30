/**
 * Las direcciones públicas: qué pantalla es cada una, y al revés.
 *
 * ## Por qué esto es un módulo
 *
 * Estaba dentro de `App.js`, en funciones privadas que nadie podía llamar desde
 * fuera. Y esto es lo que decide en qué pantalla aterriza quien abre un enlace:
 * el de un coche que alguien compartió, el de «confirma tu cita» que sale por
 * correo, el que Google tiene indexado.
 *
 * Con 827 pruebas en el proyecto, **no había ni una** que cargara una dirección y
 * comprobara qué pantalla sale. No por descuido: no se podía, porque no había
 * manera de llamar a estas funciones sin montar un componente de 7.400 líneas.
 *
 * El lado del panel —`getUserDashboardPath` y `getUserDashboardPageFromPath`—
 * ya vivía en un módulo. El lado público no. Ahora los dos.
 *
 * ## Lo que NO hace
 *
 * Navegar. No sabe nada de React ni de `window`: recibe una cadena y devuelve
 * otra. Quien mueve la dirección del navegador y el estado es `App`.
 */

/**
 * La tabla, y la única: la vuelta se deriva de ella.
 *
 * Todas estas direcciones funcionan en una carga directa porque `vercel.json`
 * tiene un `/(.*)` que las manda a `index.html`. Si ese catch-all desaparece,
 * las veinticuatro dan 404 y no lo nota ninguna prueba de aquí.
 */
export const PUBLIC_ROUTE_BY_ENTRY_MODE = {
  aboutCarswise: "/sobre-popcar",
  plans: "/planes",
  portalVo: "/marketplace-vo",
  // (la apertura temporal de la ficha VO está justo debajo de este mapa)
  vehicleDetail: "/ficha-vehiculo",
  vehicleOptions: "/asesor-vehiculo",
  servicesSeo: "/servicios",
  blog: "/blog",
  blogCompraUsado: "/blog/guia-compra-coche-segunda-mano-espana",
  blogRentingCompra: "/blog/renting-vs-compra-2026-que-conviene-segun-tu-uso",
  viewingPropose: "/cita/proponer",
  viewingConfirm: "/cita/confirmar",
  empresas: "/empresas",
  comoFunciona: "/como-funciona",
  comparador: "/comparador",
  buscarCoche: "/buscar-coche",
  contact: "/contacto",
  legalNotice: "/aviso-legal",
  privacyPolicy: "/politica-privacidad",
  cookiePolicy: "/politica-cookies",
  termsConditions: "/terminos-condiciones",
  marketingPolicy: "/politica-comunicaciones",
  experianPolicy: "/politica-experian",
  experianTerms: "/condiciones-experian",
  /*
   * La pantalla del IDCar, que no tenía dirección.
   *
   * Se llegaba a ella solo por estado interno, así que no se podía enlazar: ni
   * desde «lo que te falta» de su encargo, ni desde un correo. Y es donde se
   * suben el permiso, la ficha técnica y la ITV, que es justo lo que más veces
   * hay que pedirle.
   */
  idCarsManage: "/mis-coches",
};

export const ENTRY_MODE_BY_PUBLIC_ROUTE = Object.entries(PUBLIC_ROUTE_BY_ENTRY_MODE).reduce(
  (acc, [entryMode, path]) => {
    acc[path] = entryMode;
    return acc;
  },
  {}
);

/** La dirección del mercado, que se compara en dos sitios. */
export const RUTA_DEL_MERCADO = "/marketplace-vo";

/**
 * Sin barra final y en minúsculas.
 *
 * Las dos cosas importan: `/Planes/` y `/planes` son la misma pantalla, y quien
 * escribe una dirección a mano o la copia de un correo pone de todo.
 */
export function normalizePublicPath(pathname = "") {
  const normalized = String(pathname || "").replace(/\/+$/, "").toLowerCase();
  return normalized || "/";
}

export function getPublicPathForEntryMode(entryMode = "") {
  return PUBLIC_ROUTE_BY_ENTRY_MODE[entryMode] || "/";
}

/**
 * Qué pantalla es esta dirección, o `null` si no es ninguna de las públicas.
 *
 * El orden de las comprobaciones es el que hay, y no da igual:
 *
 *   · `/panel...` devuelve `null` a propósito. El panel tiene su propia tabla
 *     (`getUserDashboardPageFromPath`), y si esto contestara algo, las dos se
 *     pelearían por la misma dirección;
 *   · una dirección **debajo** de la ficha —`/ficha-vehiculo/algo`— es la ficha
 *     de un coche concreto, no la pantalla de fichas;
 *   · y una debajo del mercado —`/marketplace-vo/algo`— es la ficha de una
 *     oferta, que es otra pantalla distinta. Sin esto, el enlace que la gente
 *     comparte llevaría al listado.
 */
export function resolveEntryModeFromPublicPath(pathname = "") {
  const normalizedPath = normalizePublicPath(pathname);
  if (normalizedPath.startsWith("/panel")) {
    return null;
  }

  const vehicleDetailBasePath = normalizePublicPath(getPublicPathForEntryMode("vehicleDetail"));
  if (vehicleDetailBasePath !== "/" && normalizedPath.startsWith(`${vehicleDetailBasePath}/`)) {
    return "vehicleDetail";
  }

  const marketplaceVoBasePath = normalizePublicPath(RUTA_DEL_MERCADO);
  if (normalizedPath.startsWith(`${marketplaceVoBasePath}/`)) {
    return "portalVoDetail";
  }

  return ENTRY_MODE_BY_PUBLIC_ROUTE[normalizedPath] || null;
}

/**
 * El id de la oferta que trae `/marketplace-vo/<id>`, o `""`.
 *
 * Se descodifica porque los ids llevan guiones y, en los de importación, cosas
 * que se escapan. Si la descodificación falla se devuelve el trozo tal cual:
 * más vale buscar un id raro que tirar el enlace entero.
 */
export function readMarketplaceVoIdFromPath(pathname = "") {
  const base = RUTA_DEL_MERCADO;
  const raw = String(pathname || "").replace(/\/+$/, "");
  if (!raw.toLowerCase().startsWith(`${base}/`)) return "";
  const segment = raw.slice(base.length + 1).split("?")[0];
  if (!segment) return "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Y el de `/ficha-vehiculo/<id>`.
 *
 * OJO con una diferencia que se conserva porque es comportamiento: ésta compara
 * **respetando mayúsculas** y la del mercado no. `/MARKETPLACE-VO/abc` da su id;
 * `/Ficha-Vehiculo/abc` devuelve `""`.
 *
 * Y eso sí se nota, aunque poco. `resolveEntryModeFromPublicPath` normaliza, así
 * que reconoce `/Ficha-Vehiculo/abc` como la ficha de un coche; luego esto no le
 * saca el id, no hay `?vd=` del que tirar, y la pantalla acaba cayendo al
 * mercado. O sea: una dirección de coche escrita con mayúsculas lleva al listado
 * en vez de al coche.
 *
 * Los enlaces que reparte la web los monta `buildVehicleDetailSharePath` en
 * minúsculas, así que a esto solo se llega escribiendo a mano. Se deja como está
 * —cambiarlo es cambiar comportamiento— y queda probado para que se vea.
 */
export function readVehicleDetailIdFromPath(pathname = "") {
  const basePath = getPublicPathForEntryMode("vehicleDetail");
  const rawPath = String(pathname || "").replace(/\/+$/, "") || "/";

  if (!rawPath.startsWith(`${basePath}/`)) {
    return "";
  }

  const encodedId = rawPath.slice(basePath.length + 1);
  if (!encodedId) {
    return "";
  }

  try {
    return decodeURIComponent(encodedId);
  } catch {
    return encodedId;
  }
}
