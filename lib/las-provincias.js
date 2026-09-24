/**
 * Las 52 provincias, y las mil formas en que las escriben los portales.
 *
 * ── Por qué hace falta ─────────────────────────────────────────────────────
 *
 * La columna `province` la rellena cada scraper con lo que trae su portal, y el
 * resultado en las 1.582.783 ofertas vivas son 3.461 valores distintos. Solo
 * bajando a minúsculas y quitando tildes bajan a 2.591: la mitad del desorden
 * es «MADRID» conviviendo con «Madrid» y «Málaga» con «MALAGA».
 *
 * El consejero filtra con `LIKE`, así que quien busca «Madrid» y quien busca
 * «madrid capital» reciben cosas distintas y nada lo avisa.
 *
 * ── Qué se normaliza y qué no ──────────────────────────────────────────────
 *
 * Esto convierte a una de las 52 provincias oficiales, o devuelve null. NO
 * inventa: si lo que llega es un municipio que no está en la lista de abajo, se
 * queda sin provincia, y eso es más honesto que asignarle una a ojo.
 *
 * Los municipios que sí están son los que salen en los datos con volumen. No es
 * un callejero de España -son 8.131 municipios- sino los que aparecen de
 * verdad: «Las Rozas», «Sant Andreu», «Paterna», «Alcalá de Guadaíra»...
 *
 * ── Los nombres dobles ─────────────────────────────────────────────────────
 *
 * Varias provincias tienen dos nombres oficiales o uno tradicional muy usado:
 * Bizkaia y Vizcaya, Girona y Gerona, A Coruña y La Coruña. Y varias se llaman
 * por su capital en los anuncios: Asturias como Oviedo, Cantabria como
 * Santander, La Rioja como Logroño. Todas van a la misma.
 */
"use strict";

/** Minúsculas, sin tildes, sin espacios de más. La misma regla que el SQL. */
function plano(texto) {
  return String(texto || "")
    .toLowerCase()
    .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u").replace(/ç/g, "c").replace(/ñ/g, "n")
    .replace(/[^a-z0-9/ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Las 52, con el nombre que se le enseña a una persona. */
const PROVINCIAS = [
  "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila", "Badajoz",
  "Baleares", "Barcelona", "Bizkaia", "Burgos", "Cáceres", "Cádiz", "Cantabria",
  "Castellón", "Ceuta", "Ciudad Real", "Córdoba", "Cuenca", "Gipuzkoa", "Girona",
  "Granada", "Guadalajara", "Huelva", "Huesca", "Jaén", "La Coruña", "La Rioja",
  "Las Palmas", "León", "Lleida", "Lugo", "Madrid", "Málaga", "Melilla", "Murcia",
  "Navarra", "Ourense", "Palencia", "Pontevedra", "Salamanca", "Santa Cruz de Tenerife",
  "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo", "Valencia",
  "Valladolid", "Zamora", "Zaragoza",
];

/*
 * Cómo lo escriben los portales -> cómo lo llamamos.
 *
 * Las claves van ya en `plano()`: minúsculas y sin tildes. Lo que no está aquí
 * ni coincide con una de las 52 se queda sin provincia, a propósito.
 */
const FORMAS = {
  // Nombres dobles y tradicionales
  "a coruna": "La Coruña", "coruna": "La Coruña", "la coruna": "La Coruña",
  "vizcaya": "Bizkaia", "bilbao": "Bizkaia", "barakaldo": "Bizkaia", "getxo": "Bizkaia",
  "guipuzcoa": "Gipuzkoa", "san sebastian": "Gipuzkoa", "donostia": "Gipuzkoa", "irun": "Gipuzkoa",
  "araba": "Álava", "araba/alava": "Álava", "alava": "Álava", "vitoria": "Álava",
  "vitoria-gasteiz": "Álava",
  "gerona": "Girona", "lerida": "Lleida", "orense": "Ourense",
  "illes balears": "Baleares", "islas baleares": "Baleares", "baleares": "Baleares",
  "mallorca": "Baleares", "palma de mallorca": "Baleares", "palma": "Baleares",
  "ibiza": "Baleares", "menorca": "Baleares", "eivissa": "Baleares", "manacor": "Baleares",
  "castello": "Castellón", "castellon de la plana": "Castellón",
  "alacant": "Alicante", "alicante/alacant": "Alicante", "elche": "Alicante", "elx": "Alicante",
  "torrevieja": "Alicante", "benidorm": "Alicante", "orihuela": "Alicante",
  "valencia/valencia": "Valencia", "valencia": "Valencia",
  "tenerife": "Santa Cruz de Tenerife", "s c tenerife": "Santa Cruz de Tenerife",
  "santa cruz de tenerife": "Santa Cruz de Tenerife", "la laguna": "Santa Cruz de Tenerife",
  "arona": "Santa Cruz de Tenerife", "adeje": "Santa Cruz de Tenerife",
  "gran canaria": "Las Palmas", "telde": "Las Palmas", "arrecife": "Las Palmas",
  "lanzarote": "Las Palmas", "fuerteventura": "Las Palmas", "puerto del rosario": "Las Palmas",
  // Provincias que los anuncios llaman por su capital
  "oviedo": "Asturias", "gijon": "Asturias", "aviles": "Asturias", "principado de asturias": "Asturias",
  "santander": "Cantabria", "torrelavega": "Cantabria",
  "logrono": "La Rioja", "rioja": "La Rioja",
  "pamplona": "Navarra", "iruna": "Navarra", "tudela": "Navarra",
  "murcia/murcia": "Murcia", "cartagena": "Murcia", "lorca": "Murcia", "molina de segura": "Murcia",
  // Municipios grandes que salen en los datos
  "las rozas": "Madrid", "las rozas de madrid": "Madrid", "alcorcon": "Madrid",
  "mostoles": "Madrid", "leganes": "Madrid", "getafe": "Madrid", "fuenlabrada": "Madrid",
  "alcala de henares": "Madrid", "torrejon de ardoz": "Madrid", "pozuelo de alarcon": "Madrid",
  "san sebastian de los reyes": "Madrid", "alcobendas": "Madrid", "coslada": "Madrid",
  "rivas-vaciamadrid": "Madrid", "rivas vaciamadrid": "Madrid", "majadahonda": "Madrid",
  "parla": "Madrid", "torrejon": "Madrid", "colmenar viejo": "Madrid", "arganda del rey": "Madrid",
  "valdemoro": "Madrid", "moralzarzal": "Madrid", "villalbilla": "Madrid",
  "sant andreu": "Barcelona", "hospitalet de llobregat": "Barcelona",
  "l hospitalet de llobregat": "Barcelona", "badalona": "Barcelona", "terrassa": "Barcelona",
  "sabadell": "Barcelona", "mataro": "Barcelona", "santa coloma de gramenet": "Barcelona",
  "cornella de llobregat": "Barcelona", "sant cugat del valles": "Barcelona",
  "el prat de llobregat": "Barcelona", "granollers": "Barcelona", "manresa": "Barcelona",
  "vilanova i la geltru": "Barcelona", "rubi": "Barcelona", "castelldefels": "Barcelona",
  "paterna": "Valencia", "torrent": "Valencia", "gandia": "Valencia", "sagunto": "Valencia",
  "alcala de guadaira": "Sevilla", "dos hermanas": "Sevilla", "utrera": "Sevilla",
  "mairena del aljarafe": "Sevilla", "alcala de guadaira sevilla": "Sevilla",
  "jerez de la frontera": "Cádiz", "algeciras": "Cádiz", "san fernando": "Cádiz",
  "el puerto de santa maria": "Cádiz", "chiclana de la frontera": "Cádiz", "la linea": "Cádiz",
  "marbella": "Málaga", "fuengirola": "Málaga", "mijas": "Málaga", "velez-malaga": "Málaga",
  "torremolinos": "Málaga", "estepona": "Málaga", "benalmadena": "Málaga",
  "alhaurin el grande": "Málaga", "antequera": "Málaga",
  "vigo": "Pontevedra", "pontevedra/pontevedra": "Pontevedra",
  "santiago de compostela": "La Coruña", "ferrol": "La Coruña", "naron": "La Coruña",
  "el ejido": "Almería", "roquetas de mar": "Almería", "almeria/almeria": "Almería",
  "talavera de la reina": "Toledo", "illescas": "Toledo",
  "alzira": "Valencia", "massanassa": "Valencia", "alfaz del pi": "Alicante",
  "alfafar": "Valencia", "alaquas": "Valencia", "aldaia": "Valencia",
  "laguna de duero": "Valladolid", "petra": "Baleares",
  "ponferrada": "León", "burgos/burgos": "Burgos",
  // Los huérfanos con volumen que salieron al medir la cobertura
  "donosti": "Gipuzkoa", "alacant/alicante": "Alicante",
  "sant adria de besos": "Barcelona", "aranjuez": "Madrid",
  "arroyomolinos": "Madrid", "alpedrete": "Madrid", "collado villalba": "Madrid",
  "olias del rey": "Toledo", "las chafiras": "Santa Cruz de Tenerife",
  // Segunda vuelta, los siguientes diez por volumen
  "ribarroja del turia": "Valencia", "riba-roja de turia": "Valencia",
  "sedavi": "Valencia", "quart de poblet": "Valencia",
  "pinto": "Madrid", "rozas de puerto real": "Madrid",
  "sant boi de llobregat": "Barcelona", "reus": "Tarragona",
  "iurreta": "Bizkaia", "perillo-oleiros": "La Coruña", "oleiros": "La Coruña",
  // «BENALMÁDEMA» no es un sitio: es Benalmádena mal escrito, y son 523 filas.
  // Se recoge la falta en vez de perderlas.
  "benalmadema": "Málaga",

  /*
   * ── El residuo que salió al medir sobre 1,58 M de ofertas ────────────────
   *
   * Barrios, pedanías y abreviaturas. Cada uno con las filas que arrastraba el
   * 24-sep-2026, para que se vea que no son inventos: son los que pesaban.
   *
   * NO están los que de verdad son ambiguos, y eso es deliberado:
   *   «SAN JOSE» (123)       hay San José en Almería y en varias más
   *   «VELEZ» (156)          Vélez-Málaga o Vélez-Rubio, que es de Almería
   *   «Mijas - Algeciras» (122)  son dos pueblos de dos provincias distintas
   * Esos se quedan sin provincia, que es la respuesta honesta.
   */
  "sta c tenerife": "Santa Cruz de Tenerife",        // 3.298
  "el puerto de sta maria": "Cádiz",                 //   175, en dos grafías
  "llerona": "Barcelona",                            //   248, de Les Franqueses
  "jerez": "Cádiz",                                  //   225
  "zarandona": "Murcia",                             //   181, pedanía
  "cabrera del mar": "Barcelona",                    //   146, el INE dice «de Mar»
  "espinardo": "Murcia",                             //   133, pedanía
  "rivas": "Madrid",                                 //   129
  "algezares": "Murcia",                             //   118, pedanía
  "san boi de llobregat": "Barcelona",               //   108, en castellano
  "badal": "Barcelona",                              //   105, barrio
  "san pedro de alcantara": "Málaga",                //   104, de Marbella
  "ojos de garza": "Las Palmas",                     //    97, de Telde
  "puente tocinos": "Murcia",                        //    97, pedanía
  "trobajo del camino": "León",                      //    97, de San Andrés
  "galdakano": "Bizkaia",                            //    92, Galdakao mal escrito
  "martorelll": "Barcelona",                         //    88, Martorell con tres eles
  "enekuri": "Bizkaia",                              //    80, barrio
  "rural gijon": "Asturias",                         //    81
};

// Las 52 se reconocen por su propio nombre, además de por las formas de arriba.
const POR_NOMBRE = {};
for (const p of PROVINCIAS) POR_NOMBRE[plano(p)] = p;

/*
 * El callejero del INE: 8.955 nombres de municipio -> su provincia.
 *
 * Lo genera scripts/genera-municipios.js desde la relación oficial, y se mira
 * DESPUÉS de FORMAS, no antes. El orden importa: hay 20 nombres que existen en
 * dos provincias y el callejero los descarta, pero algunos de esos sí tienen
 * una respuesta buena en nuestros datos. «Arroyomolinos» está en Cáceres y en
 * Madrid; los 129 anuncios que tenemos son todos de Madrid, y eso está en
 * FORMAS. Lo mismo «Torrent», que es de Girona y de Valencia.
 *
 * FORMAS es lo que sabemos de NUESTROS datos. El callejero es lo que es España.
 */
const MUNICIPIOS = require("./los-municipios.json");

/*
 * Los dos primeros digitos de un codigo postal -> provincia.
 *
 * La misma tabla que usa scripts/genera-municipios.js para leer el callejero:
 * el CPRO del INE y el prefijo del codigo postal son el mismo numero.
 */
const POR_CODIGO = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Ávila",
  "06": "Badajoz", "07": "Baleares", "08": "Barcelona", "09": "Burgos", "10": "Cáceres",
  "11": "Cádiz", "12": "Castellón", "13": "Ciudad Real", "14": "Córdoba", "15": "La Coruña",
  "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa",
  "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida",
  "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia",
  "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas",
  "36": "Pontevedra", "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria",
  "40": "Segovia", "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel",
  "45": "Toledo", "46": "Valencia", "47": "Valladolid", "48": "Bizkaia", "49": "Zamora",
  "50": "Zaragoza", "51": "Ceuta", "52": "Melilla",
};

/** Las tres tablas, en orden de confianza. Devuelve null si no está en ninguna. */
function enLasTablas(p) {
  return POR_NOMBRE[p] || FORMAS[p] || MUNICIPIOS[p] || null;
}

/**
 * De lo que venga a una de las 52, o null.
 *
 * Devolver null es una respuesta válida y buscada: es mejor no saber la
 * provincia que inventársela. Con Andorra pasa justo eso -«Andorra la Vella»,
 * «Escaldes», «Encamp» salen en el catálogo- y lo correcto es no darles
 * ninguna, no la española más parecida.
 */
function laProvincia(texto) {
  const p = plano(texto);
  if (!p) return null;
  const directo = enLasTablas(p);
  if (directo) return directo;

  /*
   * Un código postal a secas: «28025» son 121 ofertas que traen el CP en el
   * campo de la ciudad.
   *
   * Los dos primeros dígitos de un código postal español SON el número de
   * provincia, del 01 al 52. No es una heurística, es la definición, así que
   * esto es exacto.
   *
   * Solo cuando el texto es EXACTAMENTE cinco dígitos, no cuando los lleva
   * dentro. «Calle Toledo 28005» daría Madrid por el CP y Toledo por el
   * repaso de abajo, y no quiero decidir esa pelea aquí; y un «15000» suelto
   * en una dirección puede ser un precio y no un CP de La Coruña.
   */
  if (/^[0-9]{5}$/.test(p)) return POR_CODIGO[p.slice(0, 2)] || null;


  const crudo = String(texto || "");

  /*
   * El nombre al revés, estilo catálogo: «Coruña, A» y «Palmas, Las».
   *
   * Son 3.209 filas entre las dos, y no es una rareza de un portal: es como se
   * ordenan alfabéticamente los nombres con artículo. Se resuelve dándole la
   * vuelta a la coma, que es una regla y no una lista: mañana aparecerá
   * «Rioja, La» y saldrá solo.
   *
   * Se hace sobre el texto CRUDO: plano() se come las comas, así que para
   * cuando llegásemos aquí «Coruña, A» ya sería «coruna a».
   */
  const coma = crudo.indexOf(",");
  if (coma !== -1) {
    const vuelta = enLasTablas(plano(crudo.slice(coma + 1) + " " + crudo.slice(0, coma)));
    if (vuelta) return vuelta;
  }

  /*
   * Los dos nombres oficiales, separados por barra: «Terrassa/Tarrasa»,
   * «Vitoria/Gasteiz», «San Sebastián/Donostia», «Alzira/Alcira».
   *
   * También es una regla. Se prueban las dos mitades y vale la primera que
   * salga: da igual cuál de los dos nombres conozcamos, porque las dos mitades
   * son el mismo sitio. La barra sobrevive a plano() a propósito -está en la
   * lista de caracteres que no se borran- justamente para esto.
   */
  if (p.indexOf("/") !== -1) {
    for (const mitad of p.split("/")) {
      const m = enLasTablas(mitad.trim());
      if (m) return m;
    }
  }


  /*
   * El guion, igual que la barra: «Donostia-San Sebastián», «MAHÓN - MENORCA»,
   * «TACO - LA LAGUNA», «Vélez-Málaga».
   *
   * Va DESPUÉS de buscar el nombre entero, siempre: hay municipios cuyo nombre
   * oficial lleva guion -«Alegría-Dulantzi», «Arraia-Maeztu», «Vila-real»- y
   * esos tienen que encontrarse tal cual antes de que nadie los parta.
   */
  if (p.indexOf("-") !== -1) {
    for (const mitad of p.split("-")) {
      const m = enLasTablas(mitad.trim());
      if (m) return m;
    }
  }

  /*
   * Último intento: «madrid capital», «sevilla provincia», «28 madrid». Se
   * mira si alguna de las 52 aparece como PALABRA dentro del texto, no como
   * trozo: sin eso, «leon» casaría dentro de «alcala de henares leones» y
   * «avila» dentro de «davila».
   *
   * Solo se prueba con las 52, nunca con los 8.955 municipios: buscar nombres
   * de pueblo sueltos dentro de una frase da falsos positivos a mansalva
   * -«Baños» es un municipio de Huesca y aparece en cualquier dirección-.
   */
  const palabras = new Set(p.split(" "));
  for (const nombre of PROVINCIAS) {
    const pn = plano(nombre);
    if (pn.indexOf(" ") === -1 ? palabras.has(pn) : p.indexOf(pn) !== -1) return nombre;
  }
  return null;
}

module.exports = { PROVINCIAS, FORMAS, MUNICIPIOS, POR_CODIGO, plano, laProvincia };
