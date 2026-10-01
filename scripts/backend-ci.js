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
  runScript("test:correo");
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

  /*
   * Aquí había una rama más, tras `RUN_MOBILITY_BACKEND_TESTS`, que lanzaba
   * `test:mobility-backend-local`. Esa prueba consultaba tablas
   * `dbo.MoveAdvisorUser…` por `sqlcmd` y su mensaje de éxito era «OK: endpoints
   * persisted data in SQL Server without fallback». No podía pasar, y la variable
   * que la activaba estaba en `false` en el único sitio que la ponía.
   */
  console.log("[backend-ci] OK: marca, auth y seguridad verificados.");
} catch (error) {
  console.error("[backend-ci] FAIL:", error?.message || error);
  process.exit(1);
}