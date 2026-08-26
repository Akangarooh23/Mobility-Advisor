/**
 * La marca del servidor, comprobada en frio.
 *
 * `lib/marca.js` es el unico sitio donde se escribe como se llama esto y a que
 * dominio apunta. Todo lo que el cliente lee —el pie de un correo, el asunto,
 * el organizador de una invitacion de calendario— tiene que salir de ahi.
 *
 * No necesita base de datos ni red: lee los ficheros. Existe porque el paso de
 * CarsWise a PopCar se hizo con un script de sustitucion, y un script de
 * sustitucion se come las comillas de un `href` sin avisar a nadie. Un correo
 * con `href=MARCA.sitioUrl` sale igual de bien de Resend y llega roto.
 *
 * Las dos comprobaciones que importan miran la forma, no el contenido:
 * un atributo que perdio las comillas, y un `${...}` dentro de una cadena de
 * comillas normales —que no interpola: imprime el texto crudo—. Para la
 * segunda hace falta saber si una linea cae dentro de una plantilla de varias
 * lineas, asi que el fichero se recorre caracter a caracter.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

/** Los ficheros que redactan algo que acaba delante de un cliente. */
const REDACTAN = [
  "lib/viewingStore.js",
  "lib/api/viewing-handler.js",
  "lib/api/leads-handler.js",
  "lib/api/import-lead-handler.js",
  "lib/api/cron-alert-check-handler.js",
  "lib/api/cron-appointment-reminders-handler.js",
  "lib/api/cron-condition-report-ready-handler.js",
  "lib/api/service-requests-handler.js",
  "lib/api/visit-availability-handler.js",
  "lib/api/billing-webhook-handler.js",
  "lib/api/marketplace-og-handler.js",
];

/**
 * Devuelve las lineas donde hay un `${` dentro de una cadena de comillas
 * normales. Recorre el fuente entero porque una plantilla puede abrirse en la
 * linea 200 y cerrarse en la 240, y desde una linea suelta no hay forma de
 * saber en cual de las dos situaciones estas.
 */
function interpolacionesMuertas(fuente) {
  const encontradas = [];
  let linea = 1;
  let i = 0;
  // Pila de contextos de plantilla: al entrar en `${` volvemos a codigo.
  let estado = "codigo";
  const pila = [];
  let anterior = "";

  while (i < fuente.length) {
    const c = fuente[i];
    const sig = fuente[i + 1];
    if (c === "\n") linea++;

    if (estado === "codigo") {
      if (c === "/" && sig === "/") { estado = "linea"; i += 2; continue; }
      if (c === "/" && sig === "*") { estado = "bloque"; i += 2; continue; }
      if (c === "/" && /[(,=:[!&|?{};+\-*%~^]/.test(anterior)) { estado = "regex"; i++; continue; }
      if (c === "'" || c === '"') { estado = c; i++; continue; }
      if (c === "`") { estado = "plantilla"; i++; continue; }
      if (c === "}" && pila.length) { estado = pila.pop(); i++; continue; }
      if (!/\s/.test(c)) anterior = c;
      i++;
      continue;
    }

    if (c === "\\") { i += 2; continue; }

    if (estado === "linea") { if (c === "\n") estado = "codigo"; i++; continue; }
    if (estado === "bloque") { if (c === "*" && sig === "/") { estado = "codigo"; i += 2; continue; } i++; continue; }
    if (estado === "regex") { if (c === "/" || c === "\n") estado = "codigo"; i++; continue; }

    if (estado === "'" || estado === '"') {
      if (c === estado) { estado = "codigo"; anterior = c; i++; continue; }
      if (c === "$" && sig === "{") { encontradas.push(linea); i += 2; continue; }
      i++;
      continue;
    }

    if (estado === "plantilla") {
      if (c === "`") { estado = "codigo"; anterior = c; i++; continue; }
      if (c === "$" && sig === "{") { pila.push("plantilla"); estado = "codigo"; i += 2; continue; }
      i++;
      continue;
    }

    i++;
  }
  return encontradas;
}

const fallos = [];
const apunta = (fichero, n, texto, motivo) =>
  fallos.push(`${fichero}:${n}  ${motivo}\n      ${String(texto).trim().slice(0, 110)}`);

for (const rel of REDACTAN) {
  const abs = path.join(RAIZ, rel);
  if (!fs.existsSync(abs)) { apunta(rel, 0, "", "el fichero ya no esta donde dice esta comprobacion"); continue; }

  const fuente = fs.readFileSync(abs, "utf8");
  const lineas = fuente.split(/\r?\n/);

  if (/\bMARCA\./.test(fuente) && !/require\(["'][^"']*marca["']\)/.test(fuente)) {
    apunta(rel, 0, "", "usa MARCA pero no la requiere");
  }

  for (const n of interpolacionesMuertas(fuente)) {
    apunta(rel, n, lineas[n - 1], "interpolacion dentro de una cadena que no es plantilla");
  }

  lineas.forEach((linea, i) => {
    const n = i + 1;

    // Un atributo interpolado que perdio las comillas: `href=MARCA.sitioUrl`.
    // El navegador lo lee literal y el enlace no lleva a ninguna parte.
    if (/\b(href|src|action|content)=[A-Za-z_$][\w$]*\./.test(linea)) {
      apunta(rel, n, linea, "atributo HTML sin comillas ni interpolacion");
    }

    // Se permite nombrar a CarsWise Check: ese producto se llama asi de verdad
    // y es otro sitio. Lo que no vale es firmar un correo con el nombre viejo.
    const sinComentario = linea.replace(/^\s*(\/\/|\*|\/\*).*/, "");
    if (/CarsWise/.test(sinComentario.replace(/CarsWise Check/g, ""))) {
      apunta(rel, n, linea, "nombre antiguo escrito a mano");
    }

    // El dominio viejo como texto visible. Como destino de un enlace o como
    // buzon sigue valiendo: el dominio es suyo y los correos llegan.
    if (/>[^<]*carswiseai\.com/.test(sinComentario)) {
      apunta(rel, n, linea, "dominio antiguo visible en el texto del enlace");
    }
  });
}

if (fallos.length) {
  console.error("[marca] FALLA — el servidor no habla siempre por lib/marca.js:\n");
  fallos.forEach((f) => console.error("  " + f + "\n"));
  process.exit(1);
}

console.log(`[marca] OK: ${REDACTAN.length} ficheros redactan con lib/marca.js, ninguna interpolacion muerta y ningun atributo sin comillas.`);
