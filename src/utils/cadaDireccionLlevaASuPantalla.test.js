/**
 * Cada dirección lleva a su pantalla.
 *
 * ## Por qué existe este fichero
 *
 * Esto es lo que decide en qué pantalla aterriza quien abre un enlace: el de un
 * coche que alguien compartió por WhatsApp, el de «confirma tu cita» que sale por
 * correo, el que Google tiene indexado.
 *
 * Y con 827 pruebas en el proyecto, **no había ni una** que cargara una dirección
 * y comprobara qué pantalla sale. No fue descuido: no se podía, porque estas
 * funciones eran privadas de un componente de 7.400 líneas.
 *
 * Esto no busca fallos. Es una **red**: describe lo que hoy hace la navegación,
 * para que mañana se pueda cambiar por dentro —darle un nombre al par
 * `setEntryMode`/`setStep`, o pasarse a un router de verdad— y se vea si algo
 * deja de hacer lo que hacía. Sin ella, ese cambio es a ciegas.
 *
 * Por eso varias pruebas fijan cosas que **no** son ideales, y lo dicen.
 */

import {
  PUBLIC_ROUTE_BY_ENTRY_MODE,
  ENTRY_MODE_BY_PUBLIC_ROUTE,
  RUTA_DEL_MERCADO,
  getPublicPathForEntryMode,
  normalizePublicPath,
  readMarketplaceVoIdFromPath,
  readVehicleDetailIdFromPath,
  resolveEntryModeFromPublicPath,
} from "./rutas";

const LAS_ENTRADAS = Object.entries(PUBLIC_ROUTE_BY_ENTRY_MODE);

/**
 * Las veinticuatro direcciones, escritas a mano.
 *
 * ## Por qué están copiadas aquí
 *
 * Al escribir este fichero probé si la red servía: cambié `/contacto` por
 * `/contacta` en la tabla y **las sesenta pruebas siguieron pasando**. Porque las
 * generaba con `test.each` desde la propia tabla, así que la tabla se comparaba
 * consigo misma. Una tautología: demostraba que la ida y la vuelta cuadran, no
 * que las direcciones sean las que están en Google, en los correos y en los
 * anuncios.
 *
 * Así que van copiadas. Duplicar una constante normalmente es un error; aquí es
 * el único modo de que un renombrado salte. Si esta lista y la tabla dejan de
 * coincidir, una de las dos está mal **y hay que mirar cuál**: puede ser que
 * alguien haya cambiado una dirección sin querer, o que la haya cambiado
 * queriendo y toque actualizar esto y avisar a quien lleve el SEO.
 */
const LAS_VEINTICUATRO = {
  aboutCarswise: "/sobre-popcar",
  plans: "/planes",
  portalVo: "/marketplace-vo",
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
  idCarsManage: "/mis-coches",
};

describe("las direcciones son exactamente éstas", () => {
  test("ni una más, ni una menos, ni una cambiada", () => {
    /*
     * Ésta es la prueba que faltaba, y la que atrapa un renombrado. Las demás
     * comprueban que el mecanismo funciona; ésta, que las direcciones son las
     * que la gente tiene guardadas.
     */
    expect(PUBLIC_ROUTE_BY_ENTRY_MODE).toEqual(LAS_VEINTICUATRO);
  });

  test.each(Object.entries(LAS_VEINTICUATRO))("%s -> %s resuelve de verdad", (modo, ruta) => {
    // Con las direcciones fijadas a mano, esto ya no se prueba contra sí mismo.
    expect(resolveEntryModeFromPublicPath(ruta)).toBe(modo);
  });
});

describe("la tabla entera, de ida y de vuelta", () => {
  test("hay veinticuatro pantallas con dirección", () => {
    /*
     * Si este número cambia sin que nadie toque este fichero, alguien añadió o
     * quitó una pantalla enlazable y conviene mirarlo: cada una es una dirección
     * que puede estar en un correo, en un anuncio o en Google.
     */
    expect(LAS_ENTRADAS).toHaveLength(24);
  });

  test.each(LAS_ENTRADAS)("%s se escribe %s, y esa dirección vuelve a %s", (modo, ruta) => {
    expect(getPublicPathForEntryMode(modo)).toBe(ruta);
    expect(resolveEntryModeFromPublicPath(ruta)).toBe(modo);
  });

  test("ninguna dirección se repite", () => {
    /*
     * La vuelta se deriva de la tabla con un `reduce`, así que dos pantallas con
     * la misma dirección no darían error: una se comería a la otra en silencio, y
     * la que perdiera se volvería inalcanzable por enlace.
     */
    const rutas = LAS_ENTRADAS.map(([, ruta]) => ruta);
    expect(new Set(rutas).size).toBe(rutas.length);
    expect(Object.keys(ENTRY_MODE_BY_PUBLIC_ROUTE)).toHaveLength(LAS_ENTRADAS.length);
  });

  test("y todas empiezan por barra y van en minúsculas", () => {
    // La vuelta compara contra una dirección normalizada: una con mayúsculas en
    // la tabla no la encontraría nunca.
    for (const [modo, ruta] of LAS_ENTRADAS) {
      expect(ruta.startsWith("/")).toBe(true);
      expect(ruta).toBe(ruta.toLowerCase());
      expect(ruta).not.toMatch(/\/$/);   // sin barra final, o la vuelta falla
      expect(modo).not.toBe("");
    }
  });
});

describe("las direcciones que salen por correo", () => {
  /*
   * Estas dos no son una pantalla más: son los enlaces de «proponemos esta hora»
   * y «confirma tu cita», que se mandan a gente que a lo mejor no ha entrado
   * nunca en la web. Si dejan de resolver, la cita se cae y nadie se entera.
   */
  test("proponer una cita", () => {
    expect(resolveEntryModeFromPublicPath("/cita/proponer")).toBe("viewingPropose");
  });

  test("confirmar una cita", () => {
    expect(resolveEntryModeFromPublicPath("/cita/confirmar")).toBe("viewingConfirm");
  });

  test("y la pantalla de sus coches, que se enlaza desde «lo que te falta»", () => {
    // Es donde se suben el permiso, la ficha técnica y la ITV.
    expect(resolveEntryModeFromPublicPath("/mis-coches")).toBe("idCarsManage");
  });
});

describe("las que están en Google", () => {
  test.each([
    ["/blog", "blog"],
    ["/blog/guia-compra-coche-segunda-mano-espana", "blogCompraUsado"],
    ["/blog/renting-vs-compra-2026-que-conviene-segun-tu-uso", "blogRentingCompra"],
    ["/servicios", "servicesSeo"],
    ["/como-funciona", "comoFunciona"],
  ])("%s sigue siendo %s", (ruta, modo) => {
    /*
     * Cambiar una de éstas no rompe la web: rompe el tráfico, que es peor porque
     * tarda semanas en notarse.
     */
    expect(resolveEntryModeFromPublicPath(ruta)).toBe(modo);
  });

  test("y una entrada del blog no se confunde con el blog", () => {
    // `/blog/...` está en la tabla como entrada propia, no se deduce del prefijo.
    expect(resolveEntryModeFromPublicPath("/blog")).toBe("blog");
    expect(resolveEntryModeFromPublicPath("/blog/guia-compra-coche-segunda-mano-espana"))
      .toBe("blogCompraUsado");
  });

  test("pero una entrada del blog que no existe no lleva a ninguna parte", () => {
    /*
     * Devuelve `null`, y `App` se queda en la portada. No es un 404 de verdad
     * —`vercel.json` sirve `index.html` para todo—, así que Google ve un 200 con
     * la portada. Queda fijado: es lo que pasa hoy.
     */
    expect(resolveEntryModeFromPublicPath("/blog/esta-entrada-no-existe")).toBeNull();
  });
});

describe("lo que se escribe raro", () => {
  test("la barra final da igual", () => {
    expect(resolveEntryModeFromPublicPath("/planes/")).toBe("plans");
    expect(resolveEntryModeFromPublicPath("/planes///")).toBe("plans");
  });

  test("y las mayúsculas también, para una pantalla sin id", () => {
    // Quien copia una dirección de un correo o la teclea pone de todo.
    expect(resolveEntryModeFromPublicPath("/PLANES")).toBe("plans");
    expect(resolveEntryModeFromPublicPath("/Sobre-PopCar")).toBe("aboutCarswise");
  });

  test("la raíz no es ninguna pantalla con nombre", () => {
    // Es la portada, y se representa con `null`, no con una entrada de la tabla.
    expect(resolveEntryModeFromPublicPath("/")).toBeNull();
    expect(resolveEntryModeFromPublicPath("")).toBeNull();
  });

  test("y normalizar deja la raíz como raíz, no como cadena vacía", () => {
    /*
     * Si devolviera `""`, el `startsWith` de la ficha compararía contra `"/"` y
     * cualquier dirección sería la ficha de un coche.
     */
    expect(normalizePublicPath("")).toBe("/");
    expect(normalizePublicPath("/")).toBe("/");
    expect(normalizePublicPath(null)).toBe("/");
    expect(normalizePublicPath(undefined)).toBe("/");
  });

  test("una pantalla que no existe no lleva a ninguna parte", () => {
    expect(resolveEntryModeFromPublicPath("/esto-no-existe")).toBeNull();
  });
});

describe("el panel no lo decide esta tabla", () => {
  test("todo lo que empieza por /panel devuelve null", () => {
    /*
     * El panel tiene su propia tabla, en `offerHelpers`. Si esto contestara algo,
     * las dos se pelearían por la misma dirección y ganaría la que corriera
     * después.
     */
    for (const ruta of ["/panel", "/panel/", "/panel/mis-coches", "/panel/valoraciones"]) {
      expect(resolveEntryModeFromPublicPath(ruta)).toBeNull();
    }
  });

  test("ninguna dirección pública empieza por /panel, y eso es lo que hay que vigilar", () => {
    /*
     * Al probar la red quité el `if (startsWith("/panel")) return null` y las
     * pruebas siguieron pasando. Y con razón: ninguna dirección pública empieza
     * por `/panel`, así que sin el guardia se cae igualmente en el `|| null` del
     * final. El guardia es defensivo, no activo, y por resultado no se puede
     * distinguir.
     *
     * Lo que sí se puede vigilar es la condición que lo haría necesario. Si algún
     * día alguien mete `/panel-algo` en la tabla pública, esta prueba salta y hay
     * que decidir quién manda en esa dirección.
     */
    const debajoDelPanel = Object.values(PUBLIC_ROUTE_BY_ENTRY_MODE)
      .filter((ruta) => normalizePublicPath(ruta).startsWith("/panel"));

    expect(debajoDelPanel).toEqual([]);
  });
});

describe("el enlace de una oferta, que es el que la gente comparte", () => {
  test("lleva a la ficha de la oferta, no al listado", () => {
    /*
     * Sin esto, el enlace que alguien manda por WhatsApp abriría el listado
     * entero y el coche del que hablaba no se vería.
     */
    expect(resolveEntryModeFromPublicPath("/marketplace-vo/idcar-1234")).toBe("portalVoDetail");
  });

  test("y el listado sin id sigue siendo el listado", () => {
    expect(resolveEntryModeFromPublicPath(RUTA_DEL_MERCADO)).toBe("portalVo");
    expect(resolveEntryModeFromPublicPath("/marketplace-vo/")).toBe("portalVo");
  });

  test("del enlace se saca el id", () => {
    expect(readMarketplaceVoIdFromPath("/marketplace-vo/idcar-1234")).toBe("idcar-1234");
  });

  test("y se descodifica, que los ids de importación traen de todo", () => {
    expect(readMarketplaceVoIdFromPath("/marketplace-vo/imp%2F99%20b")).toBe("imp/99 b");
  });

  test("un id mal escapado se devuelve tal cual, no se tira el enlace", () => {
    /*
     * `decodeURIComponent` lanza con un `%` suelto. Más vale buscar un id raro
     * —y no encontrarlo— que perder la dirección entera.
     */
    expect(readMarketplaceVoIdFromPath("/marketplace-vo/100%")).toBe("100%");
  });

  test("y lo que viene detrás de una interrogación no es el id", () => {
    // Las campañas añaden `?utm_source=...` a los enlaces que reparten.
    expect(readMarketplaceVoIdFromPath("/marketplace-vo/idcar-1234?utm_source=wa"))
      .toBe("idcar-1234");
  });

  test("sin id, cadena vacía", () => {
    for (const ruta of ["/marketplace-vo", "/marketplace-vo/", "/planes", "/", ""]) {
      expect(readMarketplaceVoIdFromPath(ruta)).toBe("");
    }
  });

  test("y las mayúsculas no impiden sacar el id", () => {
    expect(readMarketplaceVoIdFromPath("/MARKETPLACE-VO/idcar-1234")).toBe("idcar-1234");
  });
});

describe("la ficha de vehículo", () => {
  test("una dirección con id es la ficha de ese coche", () => {
    expect(resolveEntryModeFromPublicPath("/ficha-vehiculo/abc123")).toBe("vehicleDetail");
    expect(readVehicleDetailIdFromPath("/ficha-vehiculo/abc123")).toBe("abc123");
  });

  test("y sin id es la pantalla de fichas", () => {
    expect(resolveEntryModeFromPublicPath("/ficha-vehiculo")).toBe("vehicleDetail");
    expect(readVehicleDetailIdFromPath("/ficha-vehiculo")).toBe("");
  });

  test("también se descodifica", () => {
    expect(readVehicleDetailIdFromPath("/ficha-vehiculo/seat%20leon")).toBe("seat leon");
  });

  test("y un id mal escapado se devuelve tal cual", () => {
    expect(readVehicleDetailIdFromPath("/ficha-vehiculo/50%")).toBe("50%");
  });

  test("ESTA sí distingue mayúsculas, y la del mercado no", () => {
    /*
     * Una asimetría real, y lo que hace es esto: `resolveEntryModeFromPublicPath`
     * normaliza y reconoce `/Ficha-Vehiculo/abc` como la ficha de un coche; luego
     * esto no le saca el id, no hay `?vd=` del que tirar, y la pantalla acaba
     * cayendo al mercado. O sea, una dirección de coche escrita con mayúsculas
     * lleva al listado en vez de al coche.
     *
     * Los enlaces que reparte la web van en minúsculas, así que a esto solo se
     * llega escribiendo a mano. Se fija como está: si alguien lo arregla, que sea
     * a propósito y con esta prueba delante.
     */
    expect(resolveEntryModeFromPublicPath("/Ficha-Vehiculo/abc123")).toBe("vehicleDetail");
    expect(readVehicleDetailIdFromPath("/Ficha-Vehiculo/abc123")).toBe("");

    // Y la del mercado, en el mismo caso, sí lo saca.
    expect(readMarketplaceVoIdFromPath("/MARKETPLACE-VO/abc123")).toBe("abc123");
  });
});

describe("una pantalla sin dirección", () => {
  test("cae en la raíz", () => {
    /*
     * La mayoría de las pantallas no tienen dirección: el cuestionario, el
     * consejero, los servicios. Se llega por estado interno y la dirección se
     * queda en la portada.
     */
    expect(getPublicPathForEntryMode("consejo")).toBe("/");
    expect(getPublicPathForEntryMode("sell")).toBe("/");
    expect(getPublicPathForEntryMode("userDashboard")).toBe("/");
    expect(getPublicPathForEntryMode("")).toBe("/");
    expect(getPublicPathForEntryMode(undefined)).toBe("/");
  });

  test("y «portalVoDetail» tampoco la tiene, aunque sea una pantalla", () => {
    /*
     * Su dirección se construye con el id —`/marketplace-vo/<id>`— así que no
     * puede estar en la tabla. Por eso `resolveEntryModeFromPublicPath` la
     * deduce del prefijo y no del mapa, y por eso pedirle su ruta da la raíz.
     */
    expect(getPublicPathForEntryMode("portalVoDetail")).toBe("/");
    expect(resolveEntryModeFromPublicPath("/marketplace-vo/algo")).toBe("portalVoDetail");
  });
});

describe("y el módulo no sabe nada de React ni del navegador", () => {
  test("no toca window", () => {
    /*
     * Es lo que permite probarlo sin montar nada. Si alguien mete un
     * `window.location` aquí, esta red deja de poder correr.
     */
    const fuente = require("fs").readFileSync(require("path").join(__dirname, "rutas.js"), "utf8");

    expect(fuente).not.toContain("window.");
    expect(fuente).not.toContain("useState");
    expect(fuente).not.toContain("from \"react\"");
  });
});
