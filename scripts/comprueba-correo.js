/**
 * De donde sale el correo y a donde vuelve, comprobado en frio.
 *
 * Dos cosas que no se ven en ninguna pantalla y que solo se notan cuando ya es
 * tarde: que un envio se haya quedado resolviendo el remitente por su cuenta
 * —y salga con una direccion distinta al resto— y que un correo a un cliente
 * no lleve reply_to.
 *
 * Lo segundo importa porque el remitente es un buzon que no existe: popcar.tech
 * no tiene MX. Un cliente que responde a su factura escribe a la nada. No
 * rebota a nadie del equipo, no aparece en ninguna bandeja: se pierde.
 *
 * Los envios internos se quedan fuera a proposito. Ahi el reply_to util seria
 * el del lead, no el de soporte, y eso es otra conversacion.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

/** Ficheros que mandan correo. */
const ENVIAN = [
  "lib/viewingStore.js",
  "lib/api/viewing-handler.js",
  "lib/api/leads-handler.js",
  "lib/api/import-lead-handler.js",
  "lib/api/cron-alert-check-handler.js",
  "lib/api/cron-appointment-reminders-handler.js",
  "lib/api/cron-condition-report-ready-handler.js",
  "lib/api/service-requests-handler.js",
  "lib/api/billing-webhook-handler.js",
  "api/auth.js",
  "api/send-alert-email.js",
];

/** Un envio es interno si va a una de estas. No lleva reply_to. */
const INTERNOS = /INTERNAL_LEADS_EMAIL|internalEmail|INTERNAL_ALERT_EMAIL|OPS_EMAIL/;

const fallos = [];

for (const rel of ENVIAN) {
  const abs = path.join(RAIZ, rel);
  if (!fs.existsSync(abs)) { fallos.push(`${rel}: ya no esta donde dice esta comprobacion`); continue; }

  const fuente = fs.readFileSync(abs, "utf8");
  const lineas = fuente.split(/\r?\n/);

  // 1. Nadie resuelve el remitente por su cuenta.
  lineas.forEach((linea, i) => {
    const sinComentario = linea.replace(/^\s*\/\/.*/, "");
    if (/process\.env\.(RESEND_FROM_EMAIL|ALERT_EMAIL_FROM)/.test(sinComentario)) {
      // El destinatario de los avisos internos si puede mirar la variable.
      if (/INTERNAL_ALERT_EMAIL/.test(sinComentario)) return;
      fallos.push(`${rel}:${i + 1}  resuelve el remitente a mano en vez de llamar a remitente()\n      ${linea.trim().slice(0, 100)}`);
    }
  });

  // 2. Todo envio a un cliente lleva reply_to.
  //
  //    Se ancla en el `from`, no en el `JSON.stringify`: hay envios que arman
  //    el objeto antes y lo mandan despues —`const payload = {...}` y luego
  //    `JSON.stringify(payload)`—, y mirando la llamada no se ve nada.
  const RE = /\bfrom\s*[,:][\s\S]{0,320}/g;
  let m;
  let envio = 0;
  while ((m = RE.exec(fuente)) !== null) {
    const trozo = m[0];
    if (!/\bto\s*:/.test(trozo)) continue;       // no es el payload de un correo
    envio++;
    // Se recorta en el `to:` para no arrastrar el payload siguiente.
    const hastaTo = trozo.slice(0, trozo.search(/\bto\s*:/) + 60);
    if (INTERNOS.test(hastaTo)) continue;        // interno: no aplica
    if (/reply_to/.test(hastaTo)) continue;      // ya lo lleva
    const prim = hastaTo.split(/\r?\n/).slice(0, 3).join(" ").replace(/\s+/g, " ").trim().slice(0, 95);
    fallos.push(`${rel}  envio ${envio} a un cliente sin reply_to: la respuesta se perderia\n      ${prim}`);
  }
}

// 3. Que la funcion exista y de algo.
const { respuestaA, remitente, MARCA } = require(path.join(RAIZ, "lib", "marca"));
for (const [nombre, fn] of [["remitente", remitente], ["respuestaA", respuestaA]]) {
  if (typeof fn !== "function") { fallos.push(`lib/marca.js no exporta ${nombre}()`); continue; }
  if (!String(fn() || "").includes("@")) fallos.push(`${nombre}() no devuelve una direccion: ${fn()}`);
}
if (!MARCA.correoSoporte || !MARCA.correoSoporte.includes("@")) {
  fallos.push("MARCA.correoSoporte no es una direccion; respuestaA() se quedaria sin valor de reserva");
}

if (fallos.length) {
  console.error("[correo] FALLA:\n");
  fallos.forEach((f) => console.error("  · " + f + "\n"));
  process.exit(1);
}

console.log(`[correo] OK: ${ENVIAN.length} ficheros, un solo remitente y ningun correo a cliente sin reply_to.`);
