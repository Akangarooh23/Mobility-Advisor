/**
 * La vista previa al compartir un anuncio, comprobada en frio.
 *
 * Cuando alguien pega en WhatsApp el enlace de un coche, el rastreador pide la
 * pagina y lee las meta de la cabecera. El handler mete las del coche, pero
 * index.html ya trae las suyas genericas, y las estaticas van antes en el
 * <head>: el rastreador se queda con la primera que encuentra. Durante meses,
 * compartir cualquier anuncio enseno el escarabajo y "PopCar - Tu coche. Todo,
 * mas facil." en vez del coche, su precio y su foto.
 *
 * Nadie lo iba a ver mirando la web: la pagina se ve perfecta en el navegador.
 * Solo se nota al compartirla, y entonces ya la ha visto el cliente.
 *
 * No hace falta ni red ni build: se aplica la funcion de verdad del handler
 * sobre el index.html de verdad y se cuenta lo que queda.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const INDEX = path.join(RAIZ, "public", "index.html");

const { sinMetasGenericas } = require(path.join(RAIZ, "lib", "api", "marketplace-og-handler"));

/** Las que el handler vuelve a poner con los datos del coche. Deben irse todas. */
const SE_VAN = [
  'property="og:title"',
  'property="og:description"',
  'property="og:image"',
  'property="og:url"',
  'property="og:site_name"',
  'property="og:type"',
  'name="twitter:title"',
  'name="twitter:description"',
  'name="twitter:image"',
  'name="twitter:card"',
  'name="description"',
];

/** Las que no tiene nada que ver y no se pueden llevar por delante. */
const SE_QUEDAN = ["<meta charset", 'name="viewport"', 'name="theme-color"'];

const original = fs.readFileSync(INDEX, "utf8");
const limpio = sinMetasGenericas(original);

const veces = (aguja, pajar) => pajar.split(aguja).length - 1;
const fallos = [];

for (const t of SE_VAN) {
  if (veces(t, limpio) > 0) {
    fallos.push(`sigue en la cabecera y el rastreador la leera antes que la nuestra: ${t}`);
  }
}

for (const t of SE_QUEDAN) {
  if (veces(t, original) > 0 && veces(t, limpio) === 0) {
    fallos.push(`se ha llevado por delante una meta que no tocaba: ${t}`);
  }
}

// Que la comprobacion no pase por no haber nada que comprobar.
const habia = SE_VAN.filter((t) => veces(t, original) > 0).length;
if (habia === 0) {
  fallos.push("index.html no declara ninguna meta og:/twitter:. O se han quitado de ahi, o esta comprobacion ya no mira donde debe.");
}

if (fallos.length) {
  console.error("[og] FALLA — la vista previa al compartir un anuncio no ensenara el coche:\n");
  fallos.forEach((f) => console.error("  · " + f));
  console.error("");
  process.exit(1);
}

console.log(`[og] OK: se limpian ${habia} meta genericas de index.html y el resto de la cabecera queda intacto.`);
