/**
 * Las etapas de una importacion estan escritas tres veces, en dos repositorios.
 *
 * El ERP es quien pone el estado y esta web es quien lo reparte en pestanas. Si
 * el ERP anade una etapa y aqui no se entera, esa solicitud no encaja en
 * ninguna regla: no cae en ninguna pestana y **desaparece del panel del
 * cliente**. Paso el 30 de agosto, justo despues de que alguien pagara cuatro
 * mil euros, y volvio a asomar en septiembre por otra puerta.
 *
 * Nada lo impide hoy: son dos repositorios distintos, con dos despliegues
 * distintos, y el que anade la etapa en el ERP no tiene por que saber que aqui
 * hay una lista que decir lo mismo.
 *
 * Las tres copias:
 *
 *   1. `src/utils/gruposSolicitudes.js` aqui — la que decide la pestana.
 *   2. `apps/web/src/pages/LeadsPage.tsx` en el ERP — la escalera que se ve.
 *   3. `apps/api/src/routes/leads.ts` en el ERP — lo que la API deja guardar.
 *
 * La 3 es mas corta a proposito: «Pendiente» y «Contactado» le llegan por la
 * lista general de estados, asi que solo enumera las cinco de importacion. Se
 * comprueba que sean **el final** de la escalera, no que sean todas.
 *
 * El ERP se busca al lado —`../carswise-erp-backoffice`— o donde diga la
 * variable ERP_REPO. Si no esta, esto falla en vez de pasar de largo: una
 * comprobacion que se salta sola cuando no encuentra lo que iba a mirar es
 * peor que no tenerla, porque sale en verde.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const ERP = process.env.ERP_REPO || path.join(RAIZ, "..", "carswise-erp-backoffice");

const fallos = [];

/** Saca un array de literales de texto de una declaracion `const NOMBRE = [...]`. */
function listaDe(fuente, nombre, fichero) {
  const decl = new RegExp("(?:export\\s+)?const\\s+" + nombre + "\\s*(?::[^=]+)?=\\s*\\[([^\\]]*)\\]");
  const m = fuente.match(decl);
  if (!m) {
    fallos.push(`no encuentro ${nombre} en ${fichero}. O se ha renombrado, o esta comprobacion ya no mira donde debe.`);
    return null;
  }
  const trozos = m[1].match(/'([^']*)'|"([^"]*)"/g) || [];
  return trozos.map((t) => t.slice(1, -1));
}

function lee(fichero, queEs) {
  try {
    return fs.readFileSync(fichero, "utf8");
  } catch (err) {
    fallos.push(`no puedo leer ${queEs}: ${fichero}\n     ${err.message}`);
    return null;
  }
}

// ── Las tres copias ──────────────────────────────────────────────────────────

const AQUI = path.join(RAIZ, "src", "utils", "gruposSolicitudes.js");
const ERP_PANTALLA = path.join(ERP, "apps", "web", "src", "pages", "LeadsPage.tsx");
const ERP_API = path.join(ERP, "apps", "api", "src", "routes", "leads.ts");

if (!fs.existsSync(ERP)) {
  console.error("[etapas] FALLA — no encuentro el repositorio del ERP.\n");
  console.error(`  Buscaba en: ${ERP}`);
  console.error("  Clonalo al lado de este, o di donde esta:  ERP_REPO=ruta npm run test:etapas\n");
  console.error("  Sin el ERP delante esto no comprueba nada, y por eso no pasa en verde.\n");
  process.exit(1);
}

const fAqui = lee(AQUI, "la lista de esta web");
const fPantalla = lee(ERP_PANTALLA, "la escalera del ERP");
const fApi = lee(ERP_API, "los estados que acepta la API del ERP");

const aqui = fAqui && listaDe(fAqui, "ETAPAS_IMPORTACION", "src/utils/gruposSolicitudes.js");
const pantalla = fPantalla && listaDe(fPantalla, "PASOS_IMPORTACION", "apps/web/src/pages/LeadsPage.tsx");
const api = fApi && listaDe(fApi, "ESTADOS_IMPORTACION", "apps/api/src/routes/leads.ts");

// Que no pase por no haber encontrado nada que comparar.
if (aqui && aqui.length === 0) fallos.push("ETAPAS_IMPORTACION esta vacia aqui: no hay nada que comparar.");
if (pantalla && pantalla.length === 0) fallos.push("PASOS_IMPORTACION esta vacia en el ERP: no hay nada que comparar.");
if (api && api.length === 0) fallos.push("ESTADOS_IMPORTACION esta vacia en el ERP: no hay nada que comparar.");

// ── 1 · La escalera del ERP y la de aqui, la misma y en el mismo orden ───────

if (aqui && pantalla && aqui.length && pantalla.length) {
  if (aqui.join(" > ") !== pantalla.join(" > ")) {
    const sobran = aqui.filter((e) => !pantalla.includes(e));
    const faltan = pantalla.filter((e) => !aqui.includes(e));
    fallos.push(
      "la escalera de importacion no dice lo mismo en los dos sitios:\n" +
        `     aqui  (gruposSolicitudes.js): ${aqui.join(" > ")}\n` +
        `     ERP   (LeadsPage.tsx):        ${pantalla.join(" > ")}` +
        (faltan.length ? `\n     el ERP tiene etapas que aqui no existen: ${faltan.join(", ")} — una solicitud en ese estado no cae en ninguna pestana y desaparece del panel` : "") +
        (sobran.length ? `\n     aqui hay etapas que el ERP ya no usa: ${sobran.join(", ")}` : "") +
        (!faltan.length && !sobran.length ? "\n     son las mismas pero en distinto orden" : "")
    );
  }
}

// ── 2 · Lo que la API deja guardar tiene que ser el final de la escalera ─────

if (api && pantalla && api.length && pantalla.length) {
  const cola = pantalla.slice(pantalla.length - api.length);
  if (cola.join(" > ") !== api.join(" > ")) {
    fallos.push(
      "los estados que acepta la API no son el final de la escalera:\n" +
        `     API      (leads.ts):     ${api.join(" > ")}\n` +
        `     final de (LeadsPage):   ${cola.join(" > ")}\n` +
        "     si la API acepta un estado que la escalera no tiene, se puede guardar algo que nadie sabe pintar"
    );
  }
}

// ── 3 · Cada etapa tiene su pestana, y es una de las que existen ─────────────

if (aqui && aqui.length) {
  // Se usa la funcion de verdad, no una copia: si cambia, esto cambia con ella.
  const fuente = fs.readFileSync(AQUI, "utf8");
  const comoCJS = fuente
    .replace(/export const/g, "const")
    .replace(/export function/g, "function");
  const modulo = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", comoCJS + "\nmodule.exports = { grupoDeImportacion, PESTANAS };")(
    modulo,
    modulo.exports
  );
  const { grupoDeImportacion, PESTANAS } = modulo.exports;

  for (const etapa of aqui) {
    const grupo = grupoDeImportacion(etapa);
    if (grupo === null) {
      fallos.push(`la etapa «${etapa}» no tiene pestana: una solicitud ahi desaparece del panel del cliente`);
    } else if (!PESTANAS.includes(grupo)) {
      fallos.push(`la etapa «${etapa}» manda a la pestana «${grupo}», que no existe`);
    }
  }

  // La ultima etapa es la entrega, y su sitio es Contratadas y no Finalizadas:
  // ya es un coche suyo, no una visita que paso. Esta escrito en los manuales
  // del ERP, asi que cambiarlo aqui sin tocarlos deja el manual mintiendo.
  const ultima = aqui[aqui.length - 1];
  const donde = grupoDeImportacion(ultima);
  if (donde !== "contratadas") {
    fallos.push(
      `la ultima etapa («${ultima}») deberia caer en «contratadas» y cae en «${donde}».\n` +
        "     Es lo que dicen los manuales del ERP (marketplace-vo-importacion.md y\n" +
        "     prueba-importacion.md). Si el cambio es a proposito, hay que tocarlos."
    );
  }
}

// ── Resultado ────────────────────────────────────────────────────────────────

if (fallos.length) {
  console.error("[etapas] FALLA — el ERP y el panel del cliente no dicen lo mismo:\n");
  fallos.forEach((f) => console.error("  · " + f + "\n"));
  process.exit(1);
}

console.log(
  `[etapas] OK: las ${aqui.length} etapas coinciden en los tres sitios ` +
    `(${aqui.join(" > ")}), cada una tiene su pestana y la entrega cae en contratadas.`
);
