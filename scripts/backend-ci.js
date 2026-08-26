const { spawnSync } = require("child_process");

function runScript(scriptName, env = process.env) {
  const result = spawnSync("npm", ["run", scriptName], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function isEnabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

try {
  // Primero la marca: no toca base de datos ni red, asi que si algo se ha
  // roto en los correos se ve antes de montar nada.
  runScript("test:marca");
  runScript("test:og");
  runScript("test:auth-local");

  // El test estricto comprueba que, con la entrega de correo exigida, el
  // reseteo de contrasena no cae en el codigo local de reserva. Eso pide una
  // API configurada justo al reves que la de los demas tests, asi que en CI
  // corre contra una segunda instancia. Sin STRICT_API_BASE_URL usa la misma
  // de siempre, que es lo que pasa en una maquina de desarrollo.
  runScript("test:auth-local:strict", {
    ...process.env,
    API_BASE_URL: process.env.STRICT_API_BASE_URL || process.env.API_BASE_URL,
  });
  runScript("test:auth-security-local");

  if (isEnabled(process.env.RUN_MOBILITY_BACKEND_TESTS)) {
    runScript("test:mobility-backend-local");
    console.log("[backend-ci] OK: marca, auth, seguridad y movilidad verificados.");
  } else {
    console.log("[backend-ci] OK: marca, auth y seguridad verificados. Movilidad SQL omitida por RUN_MOBILITY_BACKEND_TESTS!=true.");
  }
} catch (error) {
  console.error("[backend-ci] FAIL:", error?.message || error);
  process.exit(1);
}