const API_BASE_URL = (process.env.API_BASE_URL || "http://localhost:3003").replace(/\/$/, "");

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

async function getAuthStatus() {
  const response = await fetch(`${API_BASE_URL}/api/auth-status?security=1`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
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
  const syntheticEmailKey = `ratelimit-${Date.now()}`;
  const statuses = [];
  let retryAfter = "";

  for (let i = 0; i < 4; i += 1) {
    const { response } = await postAuth({
      action: "request_password_reset",
      email: syntheticEmailKey,
    });

    statuses.push(response.status);
    if (response.status === 429) {
      retryAfter = response.headers.get("retry-after") || "";
      break;
    }
  }

  if (statuses.length < 4) {
    throw new Error(`No se alcanzaron suficientes intentos para validar rate-limit. statuses=${statuses.join(",")}`);
  }

  const expectedPrefix = [200, 200, 200];
  for (let i = 0; i < expectedPrefix.length; i += 1) {
    if (statuses[i] !== expectedPrefix[i]) {
      throw new Error(`Comportamiento inesperado antes del límite. statuses=${statuses.join(",")}`);
    }
  }

  if (statuses[3] !== 429) {
    throw new Error(`No se aplicó rate-limit en el cuarto intento. statuses=${statuses.join(",")}`);
  }

  if (!retryAfter) {
    throw new Error("La respuesta 429 no incluyó cabecera Retry-After.");
  }

  const { response: statusResp, data: statusData } = await getAuthStatus();
  if (!statusResp.ok) {
    throw new Error(`No se pudo leer auth-status security: HTTP ${statusResp.status}`);
  }

  const limiterTracked = Number(statusData?.security?.request?.limiterByEmail?.trackedKeys || 0);
  if (limiterTracked < 1) {
    throw new Error("El snapshot de seguridad no refleja actividad del limitador por email.");
  }

  console.log(`[auth-security] OK: rate-limit activo (statuses=${statuses.join(",")}, retry-after=${retryAfter}).`);
}

run().catch((error) => {
  console.error("[auth-security] FAIL:", error?.message || error);
  process.exit(1);
});
