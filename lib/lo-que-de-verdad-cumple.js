"use strict";

/**
 * El colador: solo sale lo que de verdad cumple lo que pidió el cliente.
 *
 * ## De dónde sale esto
 *
 * La búsqueda de ofertas tenía un suelo. Literalmente, con ese nombre en el
 * código: *«hard floor: always return at least 3 DB offers, even if strict
 * filters are too narrow»*. Cuando la búsqueda buena no llenaba los tres
 * huecos, se disparaban hasta cinco búsquedas de emergencia que iban soltando
 * criterios —primero el modelo, luego la marca, luego la provincia— hasta que
 * hubiera tres coches que enseñar.
 *
 * A quien pidió un compacto de gasolina en Madrid con 100.000 km como máximo le
 * salió de primera opción un **Isuzu Trooper de 1989 con 322.000 km, en
 * Umbrete (Sevilla)**. Nada había fallado: el sistema hizo exactamente lo que
 * se le había pedido, que era no quedarse corto de ofertas.
 *
 * ## La regla nueva
 *
 * Tres ofertas que encajan valen más que tres huecos llenos. Si solo hay una
 * que cumpla, sale una; si no hay ninguna, se dice. Ensanchar puede soltar el
 * **modelo o la marca** —para eso está, y una alternativa razonable es parte
 * del consejo— pero no puede soltar lo que el cliente ha dicho que no quiere.
 *
 * ## Por qué aquí y no en cada consulta
 *
 * Porque ya se intentó en cada consulta. Cada una de las seis llamadas
 * enumeraba sus criterios a mano y era cuestión de tiempo que una se dejara
 * alguno; ha pasado tres veces. Esto es lo último que tocan las ofertas antes
 * de salir por la pantalla: da igual qué búsqueda las trajo.
 *
 * Lo que no se cuela aquí no se cuela en ningún sitio.
 */

const { FORMAS_DE_LA_CARROCERIA } = require("./lo-que-busca-el-consejero");

const sinTildes = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const unNumero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Los límites que el cliente ha puesto y nadie puede levantar.
 *
 * Solo entra lo que él ha dicho: si no contestó al tope de kilómetros, aquí no
 * hay tope de kilómetros y no se descarta nada por eso.
 */
function losLimites({
  maxMileage,
  maxPrice,
  minPrice,
  provinciaFormas,
  transmission,
  sellerType,
  minPowerCv,
  country,
  bodyType,
} = {}) {
  return {
    maxMileage: unNumero(maxMileage),
    maxPrice: unNumero(maxPrice),
    minPrice: unNumero(minPrice),
    provincias: Array.isArray(provinciaFormas) && provinciaFormas.length
      ? provinciaFormas.map(sinTildes).filter(Boolean)
      : null,
    /*
     * El cambio se compara por el principio de la palabra: la columna trae
     * «Automatica» y el criterio viaja como «automat», que casa con las dos
     * escrituras. Ver EL_CAMBIO en el-encargo-de-busqueda.js.
     */
    cambio: sinTildes(transmission) || null,
    vendedor: sinTildes(sellerType) || null,
    minPowerCv: unNumero(minPowerCv),
    pais: String(country || "").trim().toUpperCase() || null,
    /*
     * La carrocería, con las formas en que aparece escrita.
     *
     * Hay 48 valores distintos en la columna y un «compacto» es también un
     * «berlina compacta» y un «hatchback», así que no se puede comparar el
     * nombre a secas. La tabla la mantiene lo-que-busca-el-consejero.js, que
     * es quien la usa para el WHERE.
     */
    carroceria: FORMAS_DE_LA_CARROCERIA[sinTildes(bodyType)] || null,
    laQuePidio: FORMAS_DE_LA_CARROCERIA[sinTildes(bodyType)] ? sinTildes(bodyType) : null,
  };
}

/**
 * Lo que el nombre del coche delata cuando la columna está vacía.
 *
 * El Audi TT Coupé que salió a quien pidió un compacto **no tiene carrocería en
 * la base**: lo único que dice que es un coupé es su propio nombre.
 *
 * La lista es corta a propósito, y no la tabla entera de formas. «sw», «mini» o
 * «van» aparecen dentro de nombres de coches que no son familiares, urbanos ni
 * furgonetas, y descartar por ahí escondería coches buenos. Estas palabras solo
 * salen en el nombre cuando el coche lo es de verdad.
 */
const LO_QUE_DELATA_EL_NOMBRE = {
  coupe: ["coupe"],
  cabrio: ["cabrio", "descapotable", "roadster"],
  furgoneta: ["furgon"],
  pickup: ["pick up", "pickup", "pick-up"],
  monovolumen: ["monovolumen"],
  suv: ["todoterreno"],
};

/**
 * Por qué se descarta una oferta, o `null` si no se descarta.
 *
 * Devuelve el motivo y no un booleano porque hay que poder contarlos: cuando
 * una búsqueda deja dos ofertas de doce, lo que hay que saber es si fue el
 * presupuesto o los kilómetros.
 */
function porQueNoVale(oferta, limites) {
  const km = unNumero(oferta?.mileage);
  const precio = unNumero(oferta?.price);

  if (limites.maxMileage) {
    /*
     * Sin kilometros no se puede afirmar que cumpla.
     *
     * Quien ha dicho «hasta 100.000» esta diciendo que no quiere una
     * incognita: ensenarle un coche cuyo kilometraje no sabemos es hacerle la
     * comprobacion a el.
     */
    if (!km) return "kilometros desconocidos";
    if (km > limites.maxMileage) return "demasiados kilometros";
  }

  if (limites.maxPrice) {
    if (!precio) return "precio desconocido";
    if (precio > limites.maxPrice) return "por encima del presupuesto";
  }

  if (limites.minPrice && precio && precio < limites.minPrice) {
    return "por debajo del minimo";
  }

  if (limites.provincias) {
    const suya = sinTildes(oferta?.province);
    if (!suya) return "sin provincia";
    /*
     * `includes` y no `===` porque la columna trae cosas como «Madrid, Madrid»
     * o «28001 Madrid». Ver lib/de-donde-quiere-el-coche.js: hay 3.444 valores
     * distintos para cincuenta y dos provincias.
     */
    if (!limites.provincias.some((forma) => suya.includes(forma))) {
      return "de otra provincia";
    }
  }

  if (limites.cambio) {
    const suyo = sinTildes(oferta?.transmission);
    if (!suyo) return "cambio desconocido";
    if (!suyo.startsWith(limites.cambio)) return "otro cambio";
  }

  if (limites.vendedor) {
    const suyo = sinTildes(oferta?.sellerType || oferta?.seller_type);
    if (!suyo) return "vendedor desconocido";
    if (!suyo.includes(limites.vendedor)) return "otro vendedor";
  }

  if (limites.minPowerCv) {
    /*
     * La potencia esta en el 95% de las ofertas. Quien ha pedido 150 CV para
     * arrastrar una caravana no se puede llevar un coche cuya potencia no
     * sabemos, asi que el 5% restante se queda fuera solo cuando se pide.
     */
    const cv = unNumero(oferta?.powerCv ?? oferta?.power_cv);
    if (!cv) return "potencia desconocida";
    if (cv < limites.minPowerCv) return "menos potencia de la pedida";
  }

  if (limites.pais) {
    /*
     * Quien ha dicho «solo coches ya en Espana» no quiere el papeleo de
     * matricular uno aleman, y ademas su precio no es comparable: la mediana
     * con la que se juzga si esta bien de precio se calcula SOLO con coches ya
     * matriculados aqui, asi que un importado sale siempre por debajo del
     * mercado en parte porque le falta la matriculacion.
     */
    const suyo = String(oferta?.country || "").trim().toUpperCase();
    if (!suyo) return "no dicen de donde viene";
    if (suyo !== limites.pais) return "esta importado";
  }

  if (limites.carroceria) {
    /*
     * Un Audi TT Coupe a quien pidio un compacto.
     *
     * Salio en produccion, de tercera opcion. Las busquedas de emergencia
     * pueden soltar el modelo y la marca -para eso estan- pero la carroceria
     * la eligio el cliente de una lista que tiene «me da igual» de primera
     * opcion. Si la eligio, no es negociable.
     */
    const suya = sinTildes(oferta?.bodyType || oferta?.body_type);

    /*
     * Y aqui, al reves que con los kilometros: sin dato, pasa.
     *
     * Con los kilometros una incognita es un riesgo PARA QUIEN COMPRA, y por
     * eso se descarta. Aqui el hueco es NUESTRO -el anuncio no lo dice y el
     * scraper no lo ha deducido- y el WHERE ya ha filtrado por carroceria, asi
     * que descartarlo esconde coches buenos por un fallo de datos nuestro. Se
     * descarta solo lo que SE SABE que es de otro tipo, que es lo que dejaba
     * colarse al Audi TT.
     */
    if (suya) {
      if (!limites.carroceria.some((forma) => suya.includes(sinTildes(forma)))) {
        return "es otro tipo de coche";
      }
    } else {
      /*
       * Sin dato no pasa, y esto costó dos intentos entenderlo.
       *
       * Primero se descartaba, y parecía demasiado estricto. Luego se dejó
       * pasar, y volvió el Audi TT Coupé a una búsqueda de compactos; se
       * afinó mirando el nombre, y aun así se coló un **Audi A3 en una
       * búsqueda de SUV**, porque «A3» no delata nada.
       *
       * La razón de fondo es que el WHERE ya filtra por carrocería, así que
       * una oferta sin carrocería NO viene de la búsqueda buena: viene de una
       * de emergencia, que suelta ese criterio. Dejarla pasar es exactamente
       * lo que esas búsquedas no deben conseguir.
       *
       * El nombre sigue mirándose para poder decir el motivo con precisión.
       */
      const nombre = sinTildes(
        [oferta?.title, oferta?.brand, oferta?.model, oferta?.version].filter(Boolean).join(" ")
      );

      for (const tipo of Object.keys(LO_QUE_DELATA_EL_NOMBRE)) {
        if (tipo === limites.laQuePidio) continue;
        if (LO_QUE_DELATA_EL_NOMBRE[tipo].some((p) => nombre.includes(sinTildes(p)))) {
          return "es otro tipo de coche";
        }
      }

      return "no dicen que tipo de coche es";
    }
  }

  return null;
}

/**
 * Pasa las ofertas por el colador.
 *
 * Devuelve las que cumplen y el recuento de por qué se ha caído el resto, que
 * es lo que permite decirle al cliente «hay dos, y no tres, porque las otras se
 * salían de presupuesto» en vez de enseñarle un Isuzu.
 */
function loQueDeVerdadCumple(ofertas = [], criterios = {}) {
  const limites = losLimites(criterios);
  const cumplen = [];
  const descartes = {};

  for (const oferta of ofertas || []) {
    const motivo = porQueNoVale(oferta, limites);
    if (motivo) {
      descartes[motivo] = (descartes[motivo] || 0) + 1;
      continue;
    }
    cumplen.push(oferta);
  }

  return { cumplen, descartes, descartadas: (ofertas || []).length - cumplen.length };
}

/**
 * Lo que se le cuenta al cliente cuando salen menos de las que esperaba.
 *
 * Sin disculpas y sin esconderlo: el número que falta es información, no un
 * fallo. Saber que su presupuesto deja fuera el mercado entero es justo lo que
 * ha venido a averiguar.
 */
function loQueSeLeDice(cuantasSalen, descartes = {}) {
  const motivos = Object.entries(descartes)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!motivos.length) return null;

  const COMO_SE_DICE = {
    "demasiados kilometros": "tienen más kilómetros de los que pusiste",
    "kilometros desconocidos": "no dicen los kilómetros",
    "por encima del presupuesto": "se salen de tu presupuesto",
    "precio desconocido": "no publican el precio",
    "por debajo del minimo": "están por debajo del mínimo que marcaste",
    "de otra provincia": "están en otra provincia",
    "sin provincia": "no dicen dónde están",
    "otro cambio": "llevan el otro cambio",
    "cambio desconocido": "no dicen si son automáticas o manuales",
    "otro vendedor": "las vende otro tipo de vendedor",
    "vendedor desconocido": "no dicen quién las vende",
    "menos potencia de la pedida": "tienen menos potencia de la que pediste",
    "potencia desconocida": "no publican la potencia",
    "esta importado": "son importadas y hay que matricularlas aquí",
    "no dicen de donde viene": "no dicen si están matriculadas en España",
    "es otro tipo de coche": "son de otro tipo de coche",
    "no dicen que tipo de coche es": "no dicen qué tipo de coche son",
  };

  const principal = COMO_SE_DICE[motivos[0][0]] || "no encajan con lo que pediste";

  if (cuantasSalen === 0) {
    return `No hay ninguna oferta que cumpla lo que pediste: las que hay ${principal}.`;
  }

  const cuantas = cuantasSalen === 1 ? "una oferta que cumpla" : `${cuantasSalen} ofertas que cumplan`;
  return `He encontrado ${cuantas} todo lo que pediste. He dejado fuera el resto porque ${principal}.`;
}

module.exports = { loQueDeVerdadCumple, loQueSeLeDice, porQueNoVale, losLimites };
