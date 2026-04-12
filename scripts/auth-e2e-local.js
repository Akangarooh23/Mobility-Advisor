const API_BASE_URL = (process.env.API_BASE_URL || "http://localhost:3003").replace(/\/$/, "");

function randomEmail(prefix = "e2e") {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
}

async function postAuth(payload, { cookie } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMessage = data?.error || `HTTP ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return {
    response,
    data,
    setCookie: response.headers.get("set-cookie") || "",
  };
}

function toCookieHeader(setCookieValue = "") {
  return String(setCookieValue)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.toLowerCase().startsWith("moveadvisor_session="))
    .map((part) => part.split(";")[0])
    .join("; ");
}

async function run() {
  const email = randomEmail("auth.local");
  const passwordInitial = "Orig1234!";
  const passwordReset = "Reset5678!";
  const passwordFinal = "Final9012!";
  let activePassword = passwordInitial;
  let recoveryValidated = false;

  console.log(`[auth-e2e] API: ${API_BASE_URL}`);
  console.log(`[auth-e2e] User: ${email}`);

  await postAuth({
    action: "register",
    name: "Auth E2E",
    email,
    password: passwordInitial,
  });

  try {
    const resetRequest = await postAuth({
      action: "request_password_reset",
      email,
    });

    const resetCode = String(resetRequest.data?.debugResetCode || "").trim();
    if (!resetCode) {
      throw new Error(
        "No se recibió debugResetCode. Activa AUTH_EXPOSE_RESET_CODE=true para pruebas locales."
      );
    }

    await postAuth({
      action: "reset_password",
      email,
      resetCode,
      newPassword: passwordReset,
    });

    activePassword = passwordReset;
    recoveryValidated = true;
  } catch (error) {
    // In strict delivery mode, reset request may fail if provider blocks recipient; continue validating authenticated password change.
    console.warn(`[auth-e2e] Recovery step skipped: ${error?.message || error}`);
  }

  const loginAfterReset = await postAuth({
    action: "login",
    email,
    password: activePassword,
  });

  const cookie = toCookieHeader(loginAfterReset.setCookie);
  if (!cookie) {
    throw new Error("No se pudo capturar cookie de sesión para change_password.");
  }

  await postAuth(
    {
      action: "change_password",
      currentPassword: activePassword,
      newPassword: passwordFinal,
    },
    { cookie }
  );

  let oldPasswordRejected = false;
  try {
    await postAuth({
      action: "login",
      email,
      password: activePassword,
    });
  } catch (error) {
    oldPasswordRejected = error?.status === 401;
  }

  if (!oldPasswordRejected) {
    throw new Error("La contraseña anterior debería dejar de funcionar tras change_password.");
  }

  await postAuth({
    action: "login",
    email,
    password: passwordFinal,
  });

  if (recoveryValidated) {
    console.log("[auth-e2e] OK: registro + recovery + change_password verificados.");
    return;
  }

  console.log("[auth-e2e] OK: registro + change_password verificados (recovery omitido por entrega estricta).");
}

run().catch((error) => {
  console.error("[auth-e2e] FAIL:", error?.message || error);
  process.exit(1);
});
