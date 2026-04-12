const fs = require("fs");
const path = require("path");

const API_BASE_URL = (process.env.API_BASE_URL || "http://localhost:3003").replace(/\/$/, "");
const ENV_LOCAL_PATH = path.join(__dirname, "..", ".env.local");

function randomEmail(prefix = "strict") {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
}

function readEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    return {};
  }

  const content = fs.readFileSync(ENV_LOCAL_PATH, "utf8").replace(/^\uFEFF/, "");
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const idx = line.indexOf("=");
    if (idx < 0) {
      continue;
    }

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) {
      env[key] = value;
    }
  }

  return env;
}

async function postAuth(payload) {
  const response = await fetch(`${API_BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { response, data };
}

async function run() {
  const envLocal = readEnvLocal();
  const exposeResetCode = String(envLocal.AUTH_EXPOSE_RESET_CODE || "").toLowerCase() === "true";
  const requireDelivery = String(envLocal.AUTH_REQUIRE_EMAIL_DELIVERY || "").toLowerCase() === "true";

  if (!exposeResetCode) {
    throw new Error("AUTH_EXPOSE_RESET_CODE=true es obligatorio para test:auth-local:strict.");
  }

  if (!requireDelivery) {
    throw new Error("AUTH_REQUIRE_EMAIL_DELIVERY=true es obligatorio para test:auth-local:strict.");
  }

  const email = randomEmail("strict.delivery");
  const { response, data } = await postAuth({
    action: "request_password_reset",
    email,
  });

  if (response.ok) {
    console.log(
      "[auth-e2e:strict] OK: entrega real disponible en modo estricto (sin fallback local)."
    );
    return;
  }

  const message = String(data?.error || "").toLowerCase();
  const looksLikeDeliveryError =
    message.includes("resend") ||
    message.includes("delivery") ||
    message.includes("validation_error") ||
    message.includes("email");

  if (!looksLikeDeliveryError) {
    throw new Error(`Error inesperado en modo estricto: ${data?.error || response.status}`);
  }

  console.log("[auth-e2e:strict] OK: fallo de entrega detectado y propagado en modo estricto.");
}

run().catch((error) => {
  console.error("[auth-e2e:strict] FAIL:", error?.message || error);
  process.exit(1);
});
