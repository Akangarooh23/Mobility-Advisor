"use strict";

/**
 * Preparar una oferta alemana para cruzarla contra Eurotax.
 *
 * Eurotax nos va a dar el CO2 y el valor de mercado de cada coche, que son las
 * dos cosas que hoy adivinamos: el impuesto de matriculacion se calcula con una
 * banda supuesta —ninguna oferta trae el CO2— y el ahorro se compara contra una
 * mediana de anuncios raspados.
 *
 * Para pedirle un coche hay que decirle cual, y ahi esta el trabajo. El campo
 * `version` **no es una version**: es el titular del anuncio aleman con la
 * publicidad dentro.
 *
 *   SEAT Alhambra | Style/1Hand/7Sitzer/Kamera/Navi/B-Xenon
 *   VW Eos        | 1.4**CABRIO **LEDER **TUV & AU NEU **
 *   Kia Optima    | Sportswagon GT /SCHECKHEFT/Lagerschaden
 *
 * Son 1.334 textos distintos para 1.568 coches: practicamente uno por anuncio.
 * Cruzar por ahi falla casi siempre.
 *
 * Lo que si sirve es **marca, modelo, ano, combustible y kW**, que estan al
 * 100 %. Eurotax indexa por kW, no por CV. Eso deja 586 combinaciones para
 * 1.568 coches, sobre 37 modelos.
 *
 * Y de la maraña del titular todavia se saca algo util: la cilindrada, que esta
 * en 928 de las 1.568 ofertas y cuya columna esta hoy vacia del todo, el codigo
 * del motor y la carroceria. Son los desempates cuando un mismo modelo, ano y
 * kW tiene mas de una version en el catalogo de Eurotax.
 */

/** Sin acentos, sin mayusculas y sin dobles espacios. */
function normaliza(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * La cilindrada que asoma en el titular: «1.6 TDICR», «2.2CRDi», «1,4 SERVICE».
 *
 * Se pide un limite por los dos lados porque en esos textos hay muchos numeros
 * que no son cilindradas: «1.Hand» (primer dueno), «11.2015» (una fecha),
 * «360°», «4WD». El limite de palabra y el rango de 0,6 a 8,0 litros dejan
 * fuera casi todo lo que no lo es.
 *
 * Devuelve `null` si no hay ninguna, que es distinto de cero: quiere decir que
 * el anuncio no la dice, no que el coche no tenga.
 */
function cilindradaDelTitular(texto) {
  const t = String(texto || "").replace(/,/g, ".");
  // Ni digito delante ni digito detras. El limite de palabra no vale: en
  // «2.2CRDI» la cilindrada va pegada a la letra, y ahi no hay limite.
  const encontradas = t.match(new RegExp("(?<![\\d.])\\d[.]\\d(?![\\d])", "g"));
  if (!encontradas) return null;
  for (const bruta of encontradas) {
    const n = Number(bruta);
    if (n >= 0.6 && n <= 8.0) return n;
  }
  return null;
}

/**
 * El codigo del motor, que en el grupo VAG y en Kia dice casi todo.
 *
 * TDI y CRDi son gasoleo, TSI y TFSI gasolina turbo, TGI gas natural, FSI y MPI
 * gasolina atmosferica. Cuando un modelo, ano y kW dan mas de una version en
 * Eurotax, esto suele partir el empate.
 */
const MOTORES = ["tdi", "tsi", "tfsi", "tgi", "crdi", "cdti", "fsi", "mpi", "gti", "gtd", "hdi", "dci"];

function motorDelTitular(texto) {
  const t = normaliza(texto);
  // El orden importa: «tfsi» contiene «fsi», y «tdi» no debe comerse a «gtd».
  const porLongitud = [...MOTORES].sort((a, b) => b.length - a.length);
  for (const m of porLongitud) {
    // Solo se ancla por delante: en los anuncios el codigo va pegado a lo que
    // sigue —«1.6 TDICR», «2.0TDI»— y pedir limite por detras los perdia.
    if (new RegExp(`(^|[^a-z])${m}`).test(t)) return m.toUpperCase();
  }
  return null;
}

/**
 * La carroceria, cuando el titular la dice.
 *
 * Un Leon y un Leon ST no emiten lo mismo, y el modelo llega igual en los dos.
 * Lo que viene en aleman se traduce aqui: no se le pide a Eurotax que entienda
 * «5-Turer».
 */
const CARROCERIAS = [
  [/\bst\b|sportstourer|sportourer|\bvariant\b|\bkombi\b|sportswagon/, "familiar"],
  [/\bsc\b|\bcoupe\b|3-turer|3 turer|dreiturer/, "3 puertas"],
  [/5-turer|5 turer|funfturer|\blim\b|limousine|\bsedan\b/, "5 puertas"],
  [/cabrio|roadster|\bcc\b/, "descapotable"],
];

function carroceriaDelTitular(texto) {
  const t = normaliza(texto);
  for (const [patron, nombre] of CARROCERIAS) if (patron.test(t)) return nombre;
  return null;
}

/**
 * El modelo, escrito de una sola manera.
 *
 * El anunciante aleman escribe «Ceed / cee'd» y «ProCeed / pro_cee'd»: la misma
 * cosa con dos ortografias pegadas por una barra. Se queda la primera, que es la
 * que usa el fabricante hoy, y se le quitan apostrofes y guiones bajos.
 *
 * Lo que **no** se junta: «Altea» y «Altea XL», «Golf» y «Golf Plus», «Passat» y
 * «Passat CC», «Niro» y «e-Niro». Son coches distintos, con emisiones distintas,
 * y juntarlos seria perder justo lo que buscamos.
 */
function modeloNormalizado(modelo) {
  const primera = String(modelo || "").split("/")[0];
  return primera.replace(/[_']/g, "").replace(/\s+/g, " ").trim();
}

/** Los combustibles, con el nombre que se usa dentro. */
function combustibleNormalizado(fuel) {
  const t = normaliza(fuel);
  if (/diesel|gasoleo/.test(t)) return "diesel";
  if (/electric|elektro/.test(t)) return "electrico";
  if (/hibrid|hybrid/.test(t)) return "hibrido";
  if (/\bgas\b|glp|gnc|cng|lpg|tgi/.test(t)) return "gas";
  if (/gasolina|benzin|petrol/.test(t)) return "gasolina";
  return t || null;
}

/**
 * La clave con la que se le pregunta a Eurotax.
 *
 * Cinco campos que estan al 100 % en el catalogo. `kW` y no `CV` porque es la
 * unidad europea y la que ellos indexan; el CV que traen los anuncios es una
 * conversion redondeada, y redondear dos veces separa coches que son el mismo.
 *
 * Devuelve `null` si falta cualquiera de los cinco. Media clave no sirve: cruza
 * con lo que no es.
 */
function claveDeCruce(oferta) {
  if (!oferta) return null;
  const marca = normaliza(oferta.brand);
  const modelo = normaliza(modeloNormalizado(oferta.model));
  const anio = Number(oferta.year);
  const combustible = combustibleNormalizado(oferta.fuel);
  const kw = Number(oferta.power_kw);
  if (!marca || !modelo || !anio || !combustible || !kw) return null;
  return [marca, modelo, anio, combustible, kw].join("|");
}

/**
 * Todo lo que sabemos decir de una oferta antes de preguntar.
 *
 * `confianza` dice con que seguridad se cruza, y esta aqui para poder contestar
 * despues si un precio es firme o estimado sin tener que adivinarlo:
 *
 * - `alta`  — clave completa y ademas cilindrada o motor para desempatar.
 * - `media` — clave completa y nada mas.
 * - `baja`  — falta algo de la clave: no se puede cruzar.
 */
function preparaParaEurotax(oferta) {
  const titular = [oferta && oferta.version, oferta && oferta.title].filter(Boolean).join(" ");
  const clave = claveDeCruce(oferta);
  const bruta = cilindradaDelTitular(titular);
  // Con la potencia delante se descarta el consumo disfrazado de motor.
  const cilindrada = cilindradaCreible(bruta, oferta && oferta.power_kw) ? bruta : null;
  const motor = motorDelTitular(titular);
  const desempata = cilindrada != null || motor != null;
  return {
    clave,
    marca: oferta ? String(oferta.brand || "").trim() : "",
    modelo: modeloNormalizado(oferta && oferta.model),
    anio: oferta && oferta.year != null ? Number(oferta.year) : null,
    combustible: combustibleNormalizado(oferta && oferta.fuel),
    kw: oferta && oferta.power_kw != null ? Number(oferta.power_kw) : null,
    cilindrada,
    motor,
    carroceria: carroceriaDelTitular(titular),
    confianza: !clave ? "baja" : desempata ? "alta" : "media",
  };
}


/**
 * Si esa cilindrada puede ser de verdad la de este coche.
 *
 * En los titulares alemanes hay un numero que se disfraza de cilindrada: el
 * **consumo**. «Polo IV Trendline 4.5l Euro 4» no lleva un motor de 4,5 litros,
 * lleva uno que gasta 4,5 cada cien. Por valor no se distinguen —un consumo y
 * una cilindrada viven en el mismo rango— asi que hay que mirar otra cosa.
 *
 * Se mira la potencia por litro, que tenemos al 100 %. Un motor de coche da
 * entre unos 25 kW/l —un diesel atmosferico viejo— y unos 120 —un deportivo
 * moderno. El Polo de arriba daria 10, que no existe; el Touareg 4.2 V8 da 54,
 * que es un V8 normal.
 *
 * Sin potencia no se puede juzgar, y entonces se deja pasar: descartar por no
 * poder comprobar tira dato bueno.
 */
function cilindradaCreible(litros, kw) {
  if (litros == null) return false;
  const potencia = Number(kw);
  if (!potencia || !Number.isFinite(potencia)) return true;
  const porLitro = potencia / Number(litros);
  return porLitro >= 20 && porLitro <= 150;
}

module.exports = {
  cilindradaDelTitular,
  cilindradaCreible,
  motorDelTitular,
  carroceriaDelTitular,
  modeloNormalizado,
  combustibleNormalizado,
  claveDeCruce,
  preparaParaEurotax,
};
