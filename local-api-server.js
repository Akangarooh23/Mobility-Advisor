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
const findListingHandler = require("./api/find-listing");
const offerImageHandler = require("./api/offer-image");
const sendAlertEmailHandler = require("./api/send-alert-email");
const authHandler = require("./api/auth");
const authStatusHandler = require("./api/auth-status");
const vehicleCatalogHandler = require("./api/vehicle-catalog");
const attachmentFileHandler = require("./api/attachment-file");

const billingHandler = require("./api/billing");
const erpCatalogHandler = require("./api/erp-catalog");
const userHandler = require("./api/user");

const API_PORT = Number(process.env.API_PORT || process.env.PORT || 3001);

const handlers = {
  "/api/analyze": analyzeHandler,
  "/api/find-listing": findListingHandler,
  "/api/offer-image": offerImageHandler,
  "/api/send-alert-email": sendAlertEmailHandler,
  "/api/auth": authHandler,
  "/api/auth-status": authStatusHandler,
  "/api/vehicle-catalog": vehicleCatalogHandler,
  "/api/attachment-file": attachmentFileHandler,

  "/api/billing-checkout": billingHandler,
  "/api/billing-portal": billingHandler,
  "/api/billing-account": billingHandler,
  "/api/billing-webhook": billingHandler,
  "/api/erp-catalog": erpCatalogHandler,
  "/api/user-saved": userHandler,
  "/api/user-alerts": userHandler,
  "/api/user-preferences": userHandler,
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

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

  const handler = handlers[url.pathname];

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

server.listen(API_PORT, () => {
  console.log(`✅ Local API disponible en http://localhost:${API_PORT}`);
  console.log(`🔑 GEMINI_API_KEY ${process.env.GEMINI_API_KEY ? "detectada" : "no configurada"}`);
  console.log(`📧 RESEND_API_KEY ${process.env.RESEND_API_KEY ? "detectada" : "no configurada (modo local/simulado)"}`);
});

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
