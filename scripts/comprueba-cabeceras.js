/**
 * Que los tres sitios sigan sirviendo sus cabeceras de seguridad.
 *
 * Se ponen en el `vercel.json` de cada proyecto, y desde ahí hay tres maneras
 * de perderlas sin que nadie lo note: alguien reescribe el fichero, alguien
 * cambia el proyecto de sitio, o alguien añade una regla de `headers` nueva que
 * pisa a la de antes —en Vercel gana la primera que casa, no se suman—. Y una
 * cabecera que falta no da ningún error: el sitio funciona igual de bien y deja
 * de estar protegido.
 *
 *   npm run test:cabeceras
 *
 * Mira los sitios publicados, así que necesita internet. Si uno no contesta, lo
 * dice y no falla: no poder preguntar no es lo mismo que la respuesta sea mala.
 */
"use strict";

const SITIOS = [
  ["la web", "https://www.popcar.com.es/"],
  ["la app", "https://app.popcar.com.es/"],
  ["el ERP", "https://carswise-erp-backoffice-api.vercel.app/"],
];

/** Lo que tiene que venir, y lo que como mínimo tiene que decir. */
const OBLIGATORIAS = [
  ["strict-transport-security", /max-age=\d{6,}/, "sin esto el navegador acepta entrar por http"],
  ["x-content-type-options", /nosniff/i, "sin esto el navegador adivina el tipo de un fichero"],
  ["x-frame-options", /deny|sameorigin/i, "sin esto se puede montar un clickjacking"],
  ["referrer-policy", /strict-origin|no-referrer/i, "sin esto un enlace saliente regala el token de la URL"],
  ["content-security-policy", /frame-ancestors\s+'none'/i, "sin frame-ancestors, la de arriba no vale en navegadores nuevos"],
];

async function main() {
  const fallos = [];
  const nosePudo = [];

  for (const [nombre, url] of SITIOS) {
    let res;
    try {
      res = await fetch(url, { redirect: "manual" });
    } catch (e) {
      nosePudo.push(`${nombre}: no contesta (${e.message})`);
      continue;
    }

    console.log(`  ${nombre} (${res.status})`);
    for (const [cabecera, esperado, porque] of OBLIGATORIAS) {
      const valor = res.headers.get(cabecera);
      const bien = valor && esperado.test(valor);
      console.log(`    ${bien ? "OK  " : "MAL "} ${cabecera.padEnd(26)} ${valor || "(no viene)"}`);
      if (!bien) fallos.push(`${nombre}: ${cabecera} — ${porque}`);
    }
  }

  if (nosePudo.length) {
    console.log("\n  No se ha podido preguntar a:");
    for (const n of nosePudo) console.log("    · " + n);
  }

  if (fallos.length) {
    console.error("\n[cabeceras] FALTAN:\n");
    for (const f of fallos) console.error("  · " + f);
    console.error("\n  Se ponen en el vercel.json de cada proyecto. Ver docs/cabeceras-de-seguridad.md");
    process.exit(1);
  }

  console.log("\n[cabeceras] OK: los tres sitios sirven las cinco.");
}

main().catch((e) => { console.error(e); process.exit(1); });
