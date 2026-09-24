"use strict";

/**
 * De qué provincia quiere el coche.
 *
 * ## Para qué
 *
 * La pantalla de resultados tenía un desplegable de ubicación **encima de las
 * ofertas ya elegidas**: filtraba doce coches que la base ya había decidido.
 * Preguntarlo en el test filtra en la base, que es donde hay millón y medio.
 *
 * ## Por qué hace falta una lista y no vale la columna
 *
 * Porque la columna `province` del pool está sucia. Medido: **3.444 valores
 * distintos** para cincuenta y dos provincias. «Madrid» y «MADRID» cuentan por
 * separado, y hay 11.600 ofertas cuya «provincia» es PATERNA, que es un pueblo
 * de Valencia.
 *
 * ## Y por qué se guardan las dos formas de cada nombre
 *
 * Esto empezó siendo un fallo mío: el filtro comparaba el nombre **sin tildes**
 * contra una columna que **sí las lleva**, así que buscar en Málaga no
 * encontraba ni una de las 44.469 ofertas malagueñas. Y no fallaba: devolvía
 * cero y seguía. Por eso cada provincia lleva sus dos escrituras y se comparan
 * las dos.
 */

/**
 * Las cincuenta y dos, con las formas en que aparecen escritas.
 *
 * El nombre es el que se le enseña; las formas son con lo que se busca. Se
 * incluye el nombre en catalán, gallego o euskera donde los portales lo usan
 * —Girona/Gerona, Lleida/Lérida, Bizkaia/Vizcaya— porque cada uno escribe el
 * suyo y el cliente no tiene por qué saber cuál toca.
 */
const LAS_PROVINCIAS = [
  { valor: "alava", nombre: "Álava", formas: ["alava", "álava", "araba"] },
  { valor: "albacete", nombre: "Albacete", formas: ["albacete"] },
  { valor: "alicante", nombre: "Alicante", formas: ["alicante", "alacant"] },
  { valor: "almeria", nombre: "Almería", formas: ["almeria", "almería"] },
  { valor: "asturias", nombre: "Asturias", formas: ["asturias", "oviedo"] },
  { valor: "avila", nombre: "Ávila", formas: ["avila", "ávila"] },
  { valor: "badajoz", nombre: "Badajoz", formas: ["badajoz"] },
  { valor: "baleares", nombre: "Baleares", formas: ["baleares", "balears", "mallorca", "ibiza"] },
  { valor: "barcelona", nombre: "Barcelona", formas: ["barcelona"] },
  { valor: "burgos", nombre: "Burgos", formas: ["burgos"] },
  { valor: "caceres", nombre: "Cáceres", formas: ["caceres", "cáceres"] },
  { valor: "cadiz", nombre: "Cádiz", formas: ["cadiz", "cádiz"] },
  { valor: "cantabria", nombre: "Cantabria", formas: ["cantabria", "santander"] },
  { valor: "castellon", nombre: "Castellón", formas: ["castellon", "castellón", "castello"] },
  { valor: "ceuta", nombre: "Ceuta", formas: ["ceuta"] },
  { valor: "ciudad_real", nombre: "Ciudad Real", formas: ["ciudad real"] },
  { valor: "cordoba", nombre: "Córdoba", formas: ["cordoba", "córdoba"] },
  { valor: "cuenca", nombre: "Cuenca", formas: ["cuenca"] },
  { valor: "girona", nombre: "Girona", formas: ["girona", "gerona"] },
  { valor: "granada", nombre: "Granada", formas: ["granada"] },
  { valor: "guadalajara", nombre: "Guadalajara", formas: ["guadalajara"] },
  { valor: "gipuzkoa", nombre: "Gipuzkoa", formas: ["gipuzkoa", "guipuzcoa", "guipúzcoa", "san sebastian"] },
  { valor: "huelva", nombre: "Huelva", formas: ["huelva"] },
  { valor: "huesca", nombre: "Huesca", formas: ["huesca"] },
  { valor: "jaen", nombre: "Jaén", formas: ["jaen", "jaén"] },
  { valor: "a_coruna", nombre: "A Coruña", formas: ["a coruna", "a coruña", "la coruna", "la coruña", "coruña"] },
  { valor: "la_rioja", nombre: "La Rioja", formas: ["la rioja", "rioja", "logroño", "logrono"] },
  { valor: "las_palmas", nombre: "Las Palmas", formas: ["las palmas", "gran canaria", "fuerteventura", "lanzarote"] },
  { valor: "leon", nombre: "León", formas: ["leon", "león"] },
  { valor: "lleida", nombre: "Lleida", formas: ["lleida", "lerida", "lérida"] },
  { valor: "lugo", nombre: "Lugo", formas: ["lugo"] },
  { valor: "madrid", nombre: "Madrid", formas: ["madrid"] },
  { valor: "malaga", nombre: "Málaga", formas: ["malaga", "málaga"] },
  { valor: "melilla", nombre: "Melilla", formas: ["melilla"] },
  { valor: "murcia", nombre: "Murcia", formas: ["murcia", "cartagena"] },
  { valor: "navarra", nombre: "Navarra", formas: ["navarra", "nafarroa", "pamplona"] },
  { valor: "ourense", nombre: "Ourense", formas: ["ourense", "orense"] },
  { valor: "palencia", nombre: "Palencia", formas: ["palencia"] },
  { valor: "pontevedra", nombre: "Pontevedra", formas: ["pontevedra", "vigo"] },
  { valor: "salamanca", nombre: "Salamanca", formas: ["salamanca"] },
  { valor: "tenerife", nombre: "Santa Cruz de Tenerife", formas: ["tenerife", "santa cruz", "la palma", "gomera", "hierro"] },
  { valor: "segovia", nombre: "Segovia", formas: ["segovia"] },
  { valor: "sevilla", nombre: "Sevilla", formas: ["sevilla"] },
  { valor: "soria", nombre: "Soria", formas: ["soria"] },
  { valor: "tarragona", nombre: "Tarragona", formas: ["tarragona", "reus"] },
  { valor: "teruel", nombre: "Teruel", formas: ["teruel"] },
  { valor: "toledo", nombre: "Toledo", formas: ["toledo"] },
  { valor: "valencia", nombre: "Valencia", formas: ["valencia", "valència"] },
  { valor: "valladolid", nombre: "Valladolid", formas: ["valladolid"] },
  { valor: "bizkaia", nombre: "Bizkaia", formas: ["bizkaia", "vizcaya", "bilbao"] },
  { valor: "zamora", nombre: "Zamora", formas: ["zamora"] },
  { valor: "zaragoza", nombre: "Zaragoza", formas: ["zaragoza"] },
];

/** Lo que contesta quien no quiere atarse a ninguna. */
const CUALQUIERA = "cualquier_provincia";

const porValor = new Map(LAS_PROVINCIAS.map((p) => [p.valor, p]));

/**
 * Las formas con las que buscar esa provincia, o nada.
 *
 * Nada significa que no se filtra: ni cuando ha dicho que le da igual, ni
 * cuando la respuesta no es ninguna de las que conocemos. Filtrar por una
 * provincia que no sabemos escribir devolvería cero ofertas y el cliente no
 * tendría forma de saber por qué.
 */
function comoSeBusca(respuesta) {
  const valor = String(respuesta ?? "").trim();
  if (!valor || valor === CUALQUIERA) return null;
  const provincia = porValor.get(valor);
  return provincia ? provincia.formas : null;
}

/** Las opciones del desplegable, con «me da igual» la primera. */
function lasOpciones() {
  return [
    {
      value: CUALQUIERA,
      label: "Me da igual, de cualquier provincia",
      icon: "🇪🇸",
      desc: "Más ofertas entre las que elegir",
    },
    ...LAS_PROVINCIAS.map((p) => ({ value: p.valor, label: p.nombre, icon: "📍" })),
  ];
}

module.exports = { LAS_PROVINCIAS, CUALQUIERA, comoSeBusca, lasOpciones };
