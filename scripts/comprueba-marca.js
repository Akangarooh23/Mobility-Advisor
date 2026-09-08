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
  "lib/api/import-offers-handler.js",
  "lib/api/billing-checkout-handler.js",
  "lib/inventoryStore.js",
  "api/auth.js",
  "api/send-alert-email.js",
  "lib/api/whatsapp-handler.js",
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

/**
 * Que todo lo del servidor al menos parsee.
 *
 * Parece de perogrullo y no lo es: `npm run build` solo compila el React de
 * `src/`, y las pruebas de `lib/` cargan lo que tocan, no todo. Un fichero de
 * `lib/api/` con un error de sintaxis pasa por delante de las dos cosas y solo
 * aparece en produccion, cuando Vercel intenta cargar la funcion y devuelve un
 * 500 —y no en un endpoint, sino en todos los que compartan bundle—.
 *
 * Paso justo eso: una barra invertida comida al reescribir una expresion
 * regular dejo `replace(//+$/, "")`, que abre un comentario de linea y se come
 * la llave siguiente. Tumbo /api/market, /api/funnel-event, /api/user-alerts,
 * /api/user-saved y /api/user-preferences a la vez.
 *
 * `node --check` es un analisis sintactico sin ejecutar nada: no importa el
 * modulo, asi que no toca la base ni lee variables de entorno.
 */
{
  const { execFileSync } = require("child_process");
  const paraRevisar = [];
  const recogeJs = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const camino = path.join(dir, e.name);
      if (e.isDirectory()) recogeJs(camino);
      else if (/\.js$/.test(e.name) && !/\.test\.js$/.test(e.name)) paraRevisar.push(camino);
    }
  };
  recogeJs(path.join(RAIZ, "lib"));
  recogeJs(path.join(RAIZ, "api"));
  for (const abs of paraRevisar) {
    try {
      execFileSync(process.execPath, ["--check", abs], { stdio: "pipe" });
    } catch (e) {
      const salida = String(e.stderr || e.stdout || e.message);
      const linea = /:(\d+)\n/.exec(salida);
      apunta(
        path.relative(RAIZ, abs).replace(/\\/g, "/"),
        linea ? Number(linea[1]) : 0,
        (salida.match(/SyntaxError.*/) || [""])[0],
        "no parsea: Vercel devolvera 500 en todos los endpoints de su bundle",
      );
    }
  }
}

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

    const sinComentario = linea.replace(/^\s*(\/\/|\*|\/\*).*/, "");
    // Sin distinguir mayusculas: el asunto del correo de recuperar contrasena
    // ponia "Carswise", con minuscula, y por eso paso por delante de esta
    // comprobacion sin que saltara nada durante toda la migracion.
    //
    // Aqui habia una excepcion para "CarsWise Check": era un producto que se
    // llamaba asi de verdad, asi que nombrarlo no era un descuido. Desde que
    // paso a ser PopCar Check, submarca de la casa, esa excepcion dejo de
    // proteger nada y solo servia para que el nombre viejo entrara sin que
    // saltara la comprobacion. Se ha quitado, y con ella el modulo cambio de
    // nombre a popcar-check-client.
    //
    // Lo que sigue exento: el dominio carswiseai, que tiene su propia regla mas
    // abajo porque como buzon sigue valiendo, y los nombres de variables de
    // entorno, que viven en Vercel tanto como aqui —renombrarlas es coordinar
    // dos proyectos a la vez y no las lee ningun cliente.
    const sinLoPermitido = sinComentario
      .replace(/carswiseai/gi, "")
      .replace(/process\.env\.[A-Z0-9_]+/g, "");
    if (/carswise/i.test(sinLoPermitido)) {
      apunta(rel, n, linea, "nombre antiguo escrito a mano");
    }

    // El dominio viejo como texto visible. Un mailto que ensena su propia
    // direccion no cuenta: el dominio sigue siendo suyo y ese buzon recibe.
    // Se quitan las direcciones antes de mirar lo que queda.
    const sinBuzones = sinComentario
      .replace(/mailto:[^"'\s>]+/g, "")
      .replace(/[\w.+-]+@[\w.-]+/g, "");
    if (/>[^<]*carswiseai\.com/.test(sinBuzones)) {
      apunta(rel, n, linea, "dominio antiguo visible en el texto del enlace");
    }
  });
}

/**
 * Los tres sitios donde vive el dominio tienen que decir lo mismo.
 *
 * Deberia haber uno solo y hay tres, por dos motivos que no se pueden quitar:
 * create-react-app monta un ModuleScopePlugin que prohibe importar nada de
 * fuera de `src/`, asi que el navegador no puede leer `lib/marca.js` y tiene su
 * gemelo en `src/marca.js`; y `public/index.html` es HTML estatico, donde no se
 * importa nada y el dominio va escrito a mano.
 *
 * Esto es justo lo que esta comprobacion existe para pillar. Un cambio de
 * dominio a medias no rompe nada visible —la web carga igual—: lo que queda mal
 * es el canonical y las tarjetas de compartir, que siguen nombrando el sitio
 * viejo, y de eso no se entera nadie hasta que alguien mira por que Google
 * indexa la direccion que no es.
 */
const marcaServidor = fs.readFileSync(path.join(RAIZ, "lib/marca.js"), "utf8");
const marcaCliente = fs.readFileSync(path.join(RAIZ, "src/marca.js"), "utf8");

// Sin \b delante: no hace falta. Ninguna clave es prefijo de otra seguida de
// dos puntos —tras `sitio` en `sitioUrl` viene una U, no un `:`—, asi que la
// propia forma de la busqueda ya las distingue.
const literal = (fuente, clave) => {
  const m = new RegExp(clave + '\\s*[:=]\\s*"([^"]*)"').exec(fuente);
  return m ? m[1] : null;
};

for (const [servidor, cliente] of [
  ["nombre", "NOMBRE"],
  ["sitio", "SITIO"],
  ["sitioUrl", "SITIO_URL"],
  ["dominio", "DOMINIO"],
  ["dominioAnterior", "DOMINIO_ANTERIOR"],
  ["correoContacto", "CORREO_CONTACTO"],
  ["dominioUid", "DOMINIO_UID"],
]) {
  const a = literal(marcaServidor, servidor);
  const b = literal(marcaCliente, cliente);
  if (a === null) apunta("lib/marca.js", 0, "", `falta ${servidor}`);
  else if (b === null) apunta("src/marca.js", 0, "", `falta ${cliente}`);
  else if (a !== b) apunta("src/marca.js", 0, `${cliente} = "${b}"`, `no dice lo mismo que lib/marca.js ${servidor} = "${a}"`);
}

/**
 * Los estaticos solo pueden nombrar el dominio vigente.
 *
 * Son tres y ninguno puede importar nada: index.html lleva el canonical y las
 * etiquetas de compartir, robots.txt dice donde esta el sitemap, y sitemap.xml
 * lista las doce URLs. Si nombran otro dominio no falla nada visible, y por eso
 * el sitemap llevaba desde el paso de CarsWise a PopCar apuntando entero a
 * carswiseai.com sin que se notara: Google descarta un sitemap cuyas URLs estan
 * en un dominio distinto del que lo sirve, asi que simplemente no hacia nada.
 *
 * Se miran solo las direcciones nuestras. Las de schema.org o las de una fuente
 * son de otros y no se tocan. Y se reconocen por las dos marcas, no solo por
 * "popcar": buscando la marca nueva, un carswiseai.com se colaba entero.
 */
const NUESTRO = /^https:\/\/[^/]*(popcar|carswise)/i;
const sitioUrlVigente = literal(marcaServidor, "sitioUrl");
if (sitioUrlVigente) {
  for (const rel of ["public/index.html", "public/robots.txt", "public/sitemap.xml"]) {
    const abs = path.join(RAIZ, rel);
    if (!fs.existsSync(abs)) { apunta(rel, 0, "", "el fichero ya no esta donde dice esta comprobacion"); continue; }
    fs.readFileSync(abs, "utf8").split(/\r?\n/).forEach((linea, i) => {
      for (const url of linea.match(/https:\/\/[^"'<>\s]+/g) || []) {
        if (!NUESTRO.test(url)) continue;
        if (!url.startsWith(sitioUrlVigente)) {
          apunta(rel, i + 1, linea, `apunta a un dominio propio que ya no es ${sitioUrlVigente}`);
        }
      }
    });
  }
}

/**
 * Ninguna pantalla puede ofrecer una direccion que no recibe.
 *
 * Habia veintiocho repartidas por los textos legales y por el pie de las
 * pantallas de cita: soporte@ y privacidad@carswiseai.com, y hola@carswise.es
 * —esta ultima recogia ademas el formulario de contacto—. Ninguno de los dos
 * dominios tiene registro MX y carswise.es ni siquiera resuelve, asi que todo
 * lo que un cliente escribiera ahi se perdia sin rebotar a ningun sitio
 * visible.
 *
 * El servidor ya estaba limpio; lo que se quedo atras fue el navegador, que no
 * puede leer lib/marca.js. Por eso se comprueba aparte y desde fuera: se mira
 * el texto de src/, no lo que diga la marca.
 *
 * Las pruebas quedan fuera: sus direcciones son de mentira a proposito y no
 * las ve nadie.
 */
/**
 * Todas las rutas del sitemap tienen que existir de verdad.
 *
 * No se puede comprobar pidiendolas por HTTP: el vercel.json reenvia todo a
 * index.html, asi que `/esto-no-existe` responde 200 con el mismo HTML que la
 * portada. Un 404 no ocurre nunca y el 200 no dice nada. La unica fuente fiable
 * es la tabla de rutas de la aplicacion.
 *
 * Una ruta muerta en el sitemap no rompe la web: la ensena vacia a quien llegue
 * desde Google, que es peor, porque nadie la ve desde dentro.
 */
const rutasDeLaApp = () => {
  const app = fs.readFileSync(path.join(RAIZ, "src/App.js"), "utf8");
  const bloque = /const PUBLIC_ROUTE_BY_ENTRY_MODE = \{([\s\S]*?)\n\};/.exec(app);
  if (!bloque) return null;
  const rutas = new Set(["/"]);
  for (const m of bloque[1].matchAll(/:\s*"([^"]+)"/g)) rutas.add(m[1]);
  return rutas;
};

const rutas = rutasDeLaApp();
if (!rutas) {
  apunta("src/App.js", 0, "", "no encuentro PUBLIC_ROUTE_BY_ENTRY_MODE: esta comprobacion ya no mira nada");
} else {
  const sitemap = fs.readFileSync(path.join(RAIZ, "public/sitemap.xml"), "utf8");
  sitemap.split(/\r?\n/).forEach((linea, i) => {
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(linea);
    if (!loc) return;
    let camino;
    try { camino = new URL(loc[1]).pathname; } catch { return; }
    const limpio = camino.length > 1 ? camino.replace(/\/$/, "") : camino;
    if (!rutas.has(limpio)) {
      apunta("public/sitemap.xml", i + 1, linea, "ruta que la aplicacion no sirve: Google la indexaria vacia");
    }
  });
}

/**
 * Ningun correo personal escrito a mano, en ninguna parte.
 *
 * Habia uno: el Gmail de quien escribio los scripts de Norauto, metido en la
 * cabecera User-Agent de tres peticiones a nominatim.openstreetmap.org. Se lo
 * estaba mandando a un tercero en cada llamada, y este repositorio es publico.
 *
 * La regla mira el proveedor y no una direccion concreta a proposito: escribir
 * aqui la que se quiere evitar es volver a publicarla. Un buzon de gmail o de
 * hotmail es de una persona por definicion; el de una empresa lleva su dominio.
 *
 * Se recorre todo lo que se ejecuta, no solo src/: el que habia vivia en
 * scripts/, que es donde nadie mira.
 */
const CORREO_PERSONAL = /[\w.+-]+@(?:gmail|hotmail|outlook|yahoo|icloud|live|protonmail)\.[a-z.]+/i;

for (const carpeta of ["src", "lib", "api", "scripts"]) {
  const raizCarpeta = path.join(RAIZ, carpeta);
  if (!fs.existsSync(raizCarpeta)) continue;
  recorre(raizCarpeta, (abs) => {
    const rel = path.relative(RAIZ, abs).replace(/\\/g, "/");
    fs.readFileSync(abs, "utf8").split(/\r?\n/).forEach((linea, i) => {
      const m = CORREO_PERSONAL.exec(linea);
      if (m) apunta(rel, i + 1, linea, `correo personal escrito a mano (${m[0].split("@")[1]})`);
    });
  });
}

const DOMINIOS_MUERTOS = /[\w.+-]+@(?:carswiseai\.com|carswise\.es)/;

function recorre(dir, visita) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const camino = path.join(dir, entrada.name);
    if (entrada.isDirectory()) recorre(camino, visita);
    // Los .json son las traducciones: ahi tambien se escriben direcciones, y
    // el bundle se las lleva igual. `inquiries@carswise.es` estaba en el pie
    // de es.json y en.json y no lo vio nadie porque solo se miraban los .js.
    else if (/\.(jsx?|json)$/.test(entrada.name) && !/\.test\.jsx?$/.test(entrada.name)) visita(camino);
  }
}

recorre(path.join(RAIZ, "src"), (abs) => {
  const rel = path.relative(RAIZ, abs).replace(/\\/g, "/");
  fs.readFileSync(abs, "utf8").split(/\r?\n/).forEach((linea, i) => {
    // El comentario de src/marca.js las nombra para explicar por que no estan.
    if (/^\s*(\/\/|\*|\/\*)/.test(linea)) return;
    if (DOMINIOS_MUERTOS.test(linea)) {
      apunta(rel, i + 1, linea, "direccion de un dominio sin MX: lo que se mande ahi no llega");
    }
  });
});

if (fallos.length) {
  console.error("[marca] FALLA — el servidor no habla siempre por lib/marca.js:\n");
  fallos.forEach((f) => console.error("  " + f + "\n"));
  process.exit(1);
}

console.log(
  `[marca] OK: ${REDACTAN.length} ficheros redactan con lib/marca.js, ninguna interpolacion muerta, ` +
  `ningun atributo sin comillas, las dos marcas dicen lo mismo, los tres estaticos ` +
  `(index.html, robots.txt, sitemap.xml) nombran el dominio vigente, el sitemap solo lista rutas que existen, ` +
  `src/ no ofrece ninguna direccion sin MX y no hay ningun correo personal escrito a mano.`,
);
