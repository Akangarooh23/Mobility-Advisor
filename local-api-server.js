const http = require("http");
const fs = require("fs");
const path = require("path");

function loadEnvFile(fileName) {
  const filePath = path.join(__dirname, fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const analyzeHandler = require("./api/analyze");
const compareCarsHandler = require("./api/compare-cars");
const searchOffersHandler = require("./api/search-offers");
const findListingHandler = require("./api/find-listing");
const offerImageHandler = require("./api/offer-image");
const sendAlertEmailHandler = require("./api/send-alert-email");
const authHandler = require("./api/auth");
const vehicleCatalogHandler = require("./api/vehicle-catalog");
const viewingHandler = require("./lib/api/viewing-handler");
const marketHandler = require("./api/market");
const workshopsHandler = require("./api/workshops");
const serviceRequestsHandler = require("./lib/api/service-requests-handler");

const billingHandler = require("./api/billing");
const erpCatalogHandler = require("./api/erp-catalog");
const userHandler = require("./api/user");

const API_PORT = Number(process.env.API_PORT || process.env.PORT || 3001);

const handlers = {
  "/api/analyze": analyzeHandler,
  "/api/compare-cars": compareCarsHandler,
  "/api/search-offers": searchOffersHandler,
  "/api/find-listing": findListingHandler,
  "/api/offer-image": offerImageHandler,
  "/api/send-alert-email": sendAlertEmailHandler,
  "/api/auth": authHandler,
  "/api/auth-status": authHandler,
  "/api/vehicle-catalog": vehicleCatalogHandler,
  "/api/vehicle-publish": require("./lib/api/vehicle-publish-handler"),
  "/api/viewing-request": viewingHandler,
  "/api/viewing-propose": viewingHandler,
  "/api/viewing-confirm": viewingHandler,
  "/api/viewing-get": viewingHandler,
  "/api/marketplace-vo": marketHandler,
  "/api/attachment-file": userHandler,
  "/api/papel-del-coche": userHandler,
  "/api/workshops-nearby": workshopsHandler,
  "/api/workshop-availability": workshopsHandler,
  "/api/market-price": marketHandler,

  "/api/billing-checkout": billingHandler,
  "/api/billing-portal": billingHandler,
  "/api/billing-account": billingHandler,
  "/api/billing-webhook": billingHandler,
  "/api/erp-catalog": erpCatalogHandler,
  "/api/user-saved": userHandler,
  "/api/user-alerts": userHandler,
  "/api/user-preferences": userHandler,
  "/api/leads": userHandler,
  "/api/funnel-event": userHandler,
  "/api/service-requests": serviceRequestsHandler,
};

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function createResponseHelpers(res) {
  return {
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(payload) {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }

      res.end(JSON.stringify(payload));
      return payload;
    },
    end(payload) {
      res.end(payload);
      return payload;
    },
  };
}

function detectCompatibleApiOnPort(port) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/health",
        timeout: 1000,
      },
      (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          try {
            const payload = JSON.parse(body);
            resolve(Boolean(payload?.ok));
          } catch {
            resolve(false);
          }
        });
      }
    );

    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
  });
}

/**
 * Las reescrituras de `vercel.json`, leídas una vez.
 *
 * Solo las concretas: las que llevan `:parametro` o `(.*)` las sirve Vercel con su
 * propia semántica y aquí no se imitan -mentir sobre cómo enrutan sería peor que no
 * servirlas-.
 */
const REESCRITURAS = (() => {
  const mapa = new Map();
  let vercel;
  try {
    vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "vercel.json"), "utf8"));
  } catch (e) {
    console.warn(`⚠️  No se ha podido leer vercel.json (${e.message}): solo las rutas escritas a mano.`);
    return mapa;
  }

  for (const r of vercel.rewrites || []) {
    const origen = String(r.source || "");
    const destino = String(r.destination || "");
    if (!origen.startsWith("/api/")) continue;
    if (origen.includes("(") || origen.includes(":")) continue;      // comodines, no
    if (destino.includes(":") || destino.includes("$")) continue;    // con parámetros, no

    const [camino, consulta = ""] = destino.split("?");
    const fichero = camino.replace(/^\/api\//, "");
    const query = Object.fromEntries(new URLSearchParams(consulta).entries());
    mapa.set(origen, { fichero, query });
  }
  return mapa;
})();

/** El manejador de una reescritura, cargado al pedirlo por primera vez. */
const cargados = new Map();
function reescrituraDe(camino) {
  const r = REESCRITURAS.get(camino);
  if (!r) return null;

  if (!cargados.has(r.fichero)) {
    try {
      cargados.set(r.fichero, require(`./api/${r.fichero}`));
    } catch (e) {
      // Que se vea cuál falló y por qué, en vez de un 404 que no explica nada.
      console.error(`❌ ${camino} -> api/${r.fichero}: ${e.message}`);
      cargados.set(r.fichero, null);
    }
  }
  const handler = cargados.get(r.fichero);
  return handler ? { handler, query: r.query } : null;
}

/**
 * El manejador de `/api/<nombre>`, si existe `api/<nombre>.js`.
 *
 * Es el comodín de `vercel.json` imitado. Solo nombres sencillos: nada de barras ni de
 * `..`, porque esto resuelve una ruta del sistema de ficheros a partir de una URL y eso
 * es como se lee un fichero que no toca.
 */
function porSuNombre(camino) {
  const m = /^\/api\/([a-z0-9][a-z0-9-]*)$/i.exec(camino);
  if (!m) return null;
  const nombre = m[1];

  if (!cargados.has(nombre)) {
    const fichero = path.join(__dirname, "api", `${nombre}.js`);
    if (!fs.existsSync(fichero)) { cargados.set(nombre, null); return null; }
    try {
      cargados.set(nombre, require(fichero));
    } catch (e) {
      console.error(`❌ ${camino} -> api/${nombre}.js: ${e.message}`);
      cargados.set(nombre, null);
    }
  }
  return cargados.get(nombre) || null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      apiPort: API_PORT,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasEmailConfig: Boolean(process.env.RESEND_API_KEY),
    });
    return;
  }

  /*
   * El reparto, con `vercel.json` como fuente de la verdad.
   *
   * ## Por qué
   *
   * El mapa `handlers` de arriba está escrito a mano, y `vercel.json` tiene **49
   * reescrituras**. Medido el 1-oct-2026: de las 42 rutas concretas, **21 devolvían el
   * 404 de este servidor**. O sea que la mitad de la API no existía en desarrollo.
   *
   * Entre las que faltaban: `/api/error` -el recogedor de fallos del navegador, que en
   * local no grababa nada-, `/api/invoice-pdf`, las dos del pago de la fianza, los
   * papeles de la venta -`mandato-firmado`, `papeles-venta`, `clausula-precio`-,
   * `/api/whatsapp`, `/api/ping` y los seis crons.
   *
   * Eso no es una incomodidad: es la razón de que **nadie recorriera esos caminos
   * nunca**. Y el día que se recorrieron -arrancando la aplicación, no barriendo
   * código- apareció que cualquier filtro de la búsqueda devolvía un 500 en
   * producción. Un servidor de desarrollo que no sirve la mitad de la API es un
   * servidor que garantiza que no se pruebe la mitad de la aplicación.
   *
   * ## Cómo
   *
   * Se leen las reescrituras y se arma el reparto a partir de ellas. Una reescritura
   * como
   *
   *     /api/viewing-get  ->  /api/user?route=viewing-get
   *
   * se convierte en «carga `api/user` y pon `route=viewing-get` en la consulta», que
   * es exactamente lo que hace Vercel.
   *
   * El mapa de arriba **gana**: lo que esté puesto a mano se respeta, porque alguna
   * ruta local apunta a un manejador distinto a propósito. Esto solo rellena huecos.
   *
   * Y los manejadores se cargan al usarse, no al arrancar: cargar los 49 en el
   * arranque haría de este servidor lo que `api/market.js` era antes de `enrutador.js`
   * -311 módulos y 313 ms-, y además un fallo de sintaxis en cualquier manejador
   * impediría arrancar para probar los demás.
   */
  let handler = handlers[url.pathname];

  if (!handler) {
    const derivada = reescrituraDe(url.pathname);
    if (derivada) {
      handler = derivada.handler;
      for (const [k, v] of Object.entries(derivada.query)) {
        if (!url.searchParams.has(k)) url.searchParams.set(k, v);
      }
    }
  }

  /*
   * Y el comodín, que es la última regla de `vercel.json`:
   *
   *     { "source": "/api/(.*)", "destination": "/api/$1" }
   *
   * Eso sirve **cualquier fichero de `api/` por su nombre**, haya o no una reescritura
   * concreta para él. Y hay cuatro endpoints que viven **solo** de esa regla:
   *
   *     /api/visit-availability       las citas de visita, entera
   *     /api/workshops                los talleres
   *     /api/erp-appointment
   *     /api/user-erp-appointments
   *
   * `visit-availability` no es poca cosa: son dieciocho rutas, todo el camino de pedir
   * una visita, proponer hora, confirmar y cancelar. Sin esta regla seguía sin existir en
   * desarrollo, y la primera versión de este arreglo decía «42 de 42» porque solo contaba
   * las reescrituras concretas. Medir lo que te has propuesto medir no es lo mismo que
   * medir lo que importa.
   */
  if (!handler) {
    handler = porSuNombre(url.pathname);
  }

  if (!handler) {
    sendJson(res, 404, { error: "Not Found" });
    return;
  }

  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks).toString("utf8");
    let parsedBody = rawBody;

    if (rawBody && String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }
    }

    const requestLike = {
      method: req.method,
      headers: req.headers,
      body: parsedBody,
      rawBody,
      query: Object.fromEntries(url.searchParams.entries()),
      url: req.url,
    };

    const responseLike = createResponseHelpers(res);

    await handler(requestLike, responseLike);

    if (!res.writableEnded) {
      res.end();
    }
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/*
 * Solo se levanta si se ejecuta; si se importa, no.
 *
 * Hace falta para poder **probar el reparto sin arrancar un servidor**. La alternativa
 * era que la prueba volviera a derivar el mapa de `vercel.json` con sus propias reglas,
 * y entonces no estaría comprobando este fichero: estaría comprobando una copia de él,
 * que es lo mismo que no comprobar nada. Hoy ya me ha costado ocho botones tener la
 * misma regla escrita dos veces.
 */
if (require.main === module) {
  server.listen(API_PORT, () => {
    console.log(`✅ Local API disponible en http://localhost:${API_PORT}`);
    console.log(`🔑 GEMINI_API_KEY ${process.env.GEMINI_API_KEY ? "detectada" : "no configurada"}`);
    console.log(`📧 RESEND_API_KEY ${process.env.RESEND_API_KEY ? "detectada" : "no configurada (modo local/simulado)"}`);
  });
}

module.exports = { REESCRITURAS, reescrituraDe, porSuNombre, handlers };

server.on("error", async (error) => {
  if (error && error.code === "EADDRINUSE") {
    const compatibleApiRunning = await detectCompatibleApiOnPort(API_PORT);

    if (compatibleApiRunning) {
      console.log(`ℹ️ API local ya activa en http://localhost:${API_PORT}. Se reutiliza proceso existente.`);
      process.exit(0);
      return;
    }

    console.error(`❌ No se pudo iniciar la API: el puerto ${API_PORT} ya está en uso por otro proceso.`);
    process.exit(1);
    return;
  }

  console.error("❌ Error iniciando la API local:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
