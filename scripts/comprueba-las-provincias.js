/**
 * Comprueba lib/las-provincias.js.
 *
 *   npm run test:provincias
 *
 * No toca la base y no baja nada: la tabla de conversión es una función pura y
 * se prueba como tal. Corre en menos de un segundo, que es la gracia.
 *
 * ── Qué vigila, y por qué cada cosa ────────────────────────────────────────
 *
 *   - QUE NINGUNA REGLA SEA LETRA MUERTA. Una clave de FORMAS escrita con
 *     mayúscula o con tilde no casa nunca, porque se busca sobre el texto ya
 *     aplanado. No da error: simplemente no hace nada, y la provincia se pierde
 *     en silencio. Lo mismo una clave que ya es el nombre de una provincia y
 *     apunta a otra distinta: se mira POR_NOMBRE primero y FORMAS no llega a
 *     consultarse.
 *
 *   - QUE NO SE INVENTE NADA. El destino de toda forma tiene que ser una de las
 *     52. Un «Malaga» sin tilde en el VALOR -no en la clave- mete en la base una
 *     provincia número 53 que no casa con ninguna otra fila.
 *
 *   - QUE NO ASIGNE POR PARECIDO. «Davila» no es Ávila y «Leonardo» no es León.
 *     El repaso final busca la provincia como PALABRA justamente por esto, y es
 *     el sitio por donde se rompería si alguien lo cambia por un indexOf.
 *
 *   - QUE LA REGLA DE LA COMA SEA UNA REGLA. «Coruña, A» y «Palmas, Las» están
 *     resueltas por la vuelta de la coma, no por una entrada en la lista. La
 *     prueba usa «Rioja, La», que NO está en ningún sitio: si alguien sustituye
 *     la regla por dos entradas a mano, esta falla.
 */
"use strict";

const { PROVINCIAS, FORMAS, MUNICIPIOS, POR_CODIGO, plano, laProvincia } = require("../lib/las-provincias");

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

console.log("\n  la lista de las 52");
comprueba("son 52", PROVINCIAS.length === 52, PROVINCIAS.length + " nombres");
comprueba("ninguna repetida", new Set(PROVINCIAS).size === 52);
const planos = PROVINCIAS.map(plano);
comprueba("ni repetida al aplanar", new Set(planos).size === 52,
  "sin tildes tambien son " + new Set(planos).size);

console.log("\n  cada provincia se reconoce a si misma");
const noSeReconocen = PROVINCIAS.filter((p) => laProvincia(p) !== p);
comprueba("por su nombre exacto", noSeReconocen.length === 0, noSeReconocen.join(", ") || "las 52");
const maltratadas = PROVINCIAS.filter((p) => laProvincia("  " + p.toUpperCase() + "  ") !== p);
comprueba("en mayusculas y con espacios de mas", maltratadas.length === 0, maltratadas.join(", "));
const sinTilde = PROVINCIAS.filter((p) => laProvincia(plano(p)) !== p);
comprueba("y sin tildes", sinTilde.length === 0, sinTilde.join(", "));

console.log("\n  la tabla de formas");
const oficiales = new Set(PROVINCIAS);
const destinoRaro = Object.entries(FORMAS).filter(([, v]) => !oficiales.has(v));
comprueba("toda forma acaba en una de las 52", destinoRaro.length === 0,
  destinoRaro.map(([k, v]) => k + " -> " + v).join(", ") || Object.keys(FORMAS).length + " formas");
const sinAplanar = Object.keys(FORMAS).filter((k) => plano(k) !== k);
comprueba("ninguna clave sin aplanar (no casaria nunca)", sinAplanar.length === 0,
  sinAplanar.join(", "));
const tapadas = Object.entries(FORMAS).filter(([k, v]) => planos.indexOf(k) !== -1 && plano(v) !== k);
comprueba("ninguna clave la tapa el nombre de otra provincia", tapadas.length === 0,
  tapadas.map(([k, v]) => k + " -> " + v).join(", "));
const noLlegan = Object.entries(FORMAS).filter(([k, v]) => laProvincia(k) !== v);
comprueba("todas las formas llegan a su destino", noLlegan.length === 0,
  noLlegan.map(([k, v]) => k + " da " + laProvincia(k) + " y no " + v).slice(0, 5).join(" | "));

console.log("\n  los nombres al reves, por la coma");
comprueba("Coruna, A", laProvincia("Coruña, A") === "La Coruña", String(laProvincia("Coruña, A")));
comprueba("Palmas, Las", laProvincia("Palmas, Las") === "Las Palmas", String(laProvincia("Palmas, Las")));
/*
 * «Rioja, La» no está en FORMAS ni en PROVINCIAS: solo sale bien si la vuelta
 * de la coma es una regla de verdad. Es la prueba de que lo es.
 */
comprueba("Rioja, La  (no esta en ninguna lista: sale por la regla)",
  laProvincia("Rioja, La") === "La Rioja", String(laProvincia("Rioja, La")));
comprueba("y con la coma pegada y en mayusculas",
  laProvincia("CORUÑA,A") === "La Coruña", String(laProvincia("CORUÑA,A")));

console.log("\n  lo que lleva la provincia dentro");
comprueba("madrid capital", laProvincia("madrid capital") === "Madrid");
comprueba("Sevilla provincia", laProvincia("Sevilla provincia") === "Sevilla");
comprueba("28 - MADRID", laProvincia("28 - MADRID") === "Madrid");
comprueba("Ciudad Real (dos palabras)", laProvincia("Ciudad Real provincia") === "Ciudad Real");

console.log("\n  lo que NO debe reconocer");
/*
 * Cada uno de estos lleva dentro las letras de una provincia. Si el repaso
 * final dejara de mirar palabras enteras, los cuatro pasarian a tener
 * provincia, y seria una provincia inventada.
 */
const enganos = [["Davila", "Ávila"], ["Leonardo", "León"], ["Lugones", "Lugo"],
  ["Sorianos", "Soria"]];
for (const [texto, quien] of enganos) {
  comprueba(texto + " no es " + quien, laProvincia(texto) === null, String(laProvincia(texto)));
}
const vacios = ["", "   ", null, undefined, "-", "España", "Portugal", "Lisboa", "Sin especificar"];
for (const v of vacios) {
  comprueba("null para " + JSON.stringify(v), laProvincia(v) === null, String(laProvincia(v)));
}


console.log("\n  el callejero del INE");
comprueba("hay 9.000 nombres largos", Object.keys(MUNICIPIOS).length > 8500,
  Object.keys(MUNICIPIOS).length.toLocaleString("es") + " nombres");
const destinoMalo = Object.entries(MUNICIPIOS).filter(([, v]) => !oficiales.has(v));
comprueba("todo municipio acaba en una de las 52", destinoMalo.length === 0,
  destinoMalo.slice(0, 5).map(([k, v]) => k + " -> " + v).join(", "));
const muniSinAplanar = Object.keys(MUNICIPIOS).filter((k) => plano(k) !== k);
comprueba("ninguna clave sin aplanar", muniSinAplanar.length === 0,
  muniSinAplanar.slice(0, 5).join(", "));
/*
 * El callejero se mira DESPUÉS de FORMAS. Importa porque hay nombres que
 * existen en dos provincias: el generador los descarta, pero algunos sí tienen
 * respuesta buena en nuestros datos y están puestos a mano.
 */
comprueba("FORMAS manda sobre el callejero: Arroyomolinos es Madrid, no Cáceres",
  laProvincia("Arroyomolinos") === "Madrid", String(laProvincia("Arroyomolinos")));
comprueba("y Torrent es Valencia, no Girona",
  laProvincia("Torrent") === "Valencia", String(laProvincia("Torrent")));
/*
 * Los 20 nombres que están en dos provincias no pueden salir del callejero:
 * con el nombre a secas no hay forma de saber cuál es.
 */
const ambiguos = ["sancti-spiritus", "mieres", "cieza", "fonfria", "villaescusa", "rebollar"];
const colados = ambiguos.filter((a) => MUNICIPIOS[a]);
comprueba("los nombres de dos provincias no entran en el callejero", colados.length === 0,
  colados.map((a) => a + " -> " + MUNICIPIOS[a]).join(", "));

console.log("\n  municipios de verdad, de los que salían sin reconocer");
const pueblos = [["ALMENDRALEJO", "Badajoz"], ["ERANDIO", "Bizkaia"], ["ASTORGA", "León"],
  ["ZARATAN", "Valladolid"], ["Figueres", "Girona"], ["CORIA DEL RIO", "Sevilla"],
  ["UBEDA", "Jaén"], ["Lliçà de Vall", "Barcelona"], ["XATIVA", "Valencia"],
  ["Boadilla del Monte", "Madrid"], ["Viator", "Almería"], ["PALAFRUGELL", "Girona"]];
for (const [q, e] of pueblos) {
  comprueba(q + " -> " + e, laProvincia(q) === e, String(laProvincia(q)));
}

console.log("\n  los dos nombres con barra");
/*
 * «Terrassa/Tarrasa» y compañía. Es una regla -se parten las dos mitades- y no
 * una lista, así que vale cualquiera de los dos nombres.
 */
const barras = [["Terrassa/Tarrasa", "Barcelona"], ["Vitoria/Gasteiz", "Álava"],
  ["San Sebastián/Donostia", "Gipuzkoa"], ["Alzira/Alcira", "Valencia"],
  ["Alcoy/Alcoi", "Alicante"], ["Vila Real/Villarreal", "Castellón"]];
for (const [q, e] of barras) {
  comprueba(q + " -> " + e, laProvincia(q) === e, String(laProvincia(q)));
}
/* El INE escribe «Vila-real» con guion y no lo escribe así nadie más. */
comprueba("y el guion oficial da igual: Vitoria Gasteiz sin guion",
  laProvincia("Vitoria Gasteiz") === "Álava", String(laProvincia("Vitoria Gasteiz")));

console.log("\n  Andorra no es una provincia española");
/*
 * Salen 640 anuncios andorranos en el catálogo. Con 9.066 nombres de municipio
 * dentro, el riesgo es que alguno case por parecido y les pongamos Lleida.
 */
for (const a of ["Andorra La Vella", "Escaldes", "Encamp", "Sant Julià de Lòria", "La Massana"]) {
  comprueba(a + " sigue sin provincia", laProvincia(a) === null, String(laProvincia(a)));
}


console.log("\n  el código postal, que es exacto");
comprueba("los 52 prefijos estan", Object.keys(POR_CODIGO).length === 52);
const codMalo = Object.values(POR_CODIGO).filter((v) => !oficiales.has(v));
comprueba("y todos apuntan a una de las 52", codMalo.length === 0, codMalo.join(", "));
comprueba("ninguna provincia se repite en la tabla de codigos",
  new Set(Object.values(POR_CODIGO)).size === 52);
for (const [q, e] of [["28025", "Madrid"], ["08001", "Barcelona"], ["15001", "La Coruña"],
  ["52001", "Melilla"], ["01001", "Álava"]]) {
  comprueba(q + " -> " + e, laProvincia(q) === e, String(laProvincia(q)));
}
/* Del 53 al 99 no hay provincia, y cuatro o seis dígitos no son un CP. */
for (const q of ["99999", "53001", "00123", "2802", "280255"]) {
  comprueba(q + " no es un codigo postal valido", laProvincia(q) === null, String(laProvincia(q)));
}

console.log("\n  el guion");
for (const [q, e] of [["Donostia-San Sebastián", "Gipuzkoa"], ["MAHÓN - MENORCA", "Baleares"],
  ["TACO - LA LAGUNA", "Santa Cruz de Tenerife"], ["Vélez-Málaga", "Málaga"]]) {
  comprueba(q + " -> " + e, laProvincia(q) === e, String(laProvincia(q)));
}
/*
 * LA PARTE DELICADA. Hay municipios cuyo nombre oficial LLEVA guion, y tienen
 * que encontrarse enteros antes de que la regla los parta. Si alguien mueve el
 * corte por guion por encima de la búsqueda del nombre completo, estos tres
 * dejan de salir y nadie se entera.
 */
for (const [q, e] of [["Alegría-Dulantzi", "Álava"], ["Arraia-Maeztu", "Álava"],
  ["Vila-real", "Castellón"]]) {
  comprueba("el nombre entero manda sobre el guion: " + q,
    laProvincia(q) === e, String(laProvincia(q)));
}

console.log("\n  el residuo que sí se resolvió, y el que no");
for (const [q, e] of [["Sta. C. Tenerife", "Santa Cruz de Tenerife"],
  ["EL PUERTO DE STA MARÍA", "Cádiz"], ["MARTORELLL", "Barcelona"], ["GALDAKANO", "Bizkaia"],
  ["TROBAJO DEL CAMINO", "León"], ["Rural Gijón", "Asturias"], ["ZARANDONA", "Murcia"]]) {
  comprueba(q + " -> " + e, laProvincia(q) === e, String(laProvincia(q)));
}
/*
 * Y los que se dejan sin provincia A PROPÓSITO, porque son de verdad ambiguos.
 * Si algún día alguien los "arregla", esto le dirá que está eligiendo a ojo.
 */
for (const q of ["SAN JOSE", "VELEZ"]) {
  comprueba(q + " es ambiguo y se queda sin provincia",
    laProvincia(q) === null, String(laProvincia(q)));
}

console.log("\n  que no se caiga con nada");
const raros = [0, 42, {}, [], true, "a".repeat(5000), "(.*)+", "Madrid\u0000", "\\", "%"];
let revento = null;
for (const r of raros) {
  try { laProvincia(r); } catch (e) { revento = JSON.stringify(String(r)).slice(0, 30) + ": " + e.message; }
}
comprueba("aguanta numeros, objetos, regex y basura", revento === null, revento || raros.length + " entradas");
comprueba("plano() es idempotente",
  PROVINCIAS.every((p) => plano(plano(p)) === plano(p)));
comprueba("y da lo mismo siempre",
  laProvincia("MÁLAGA") === laProvincia("malaga") && laProvincia("malaga") === "Málaga");

console.log("\n  " + (fallos ? fallos + " FALLOS" : "todo en orden") + "\n");
process.exit(fallos ? 1 : 0);
