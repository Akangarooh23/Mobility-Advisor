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
  runScript("test:auth-all-local");
  runScript("test:auth-security-local");

  if (isEnabled(process.env.RUN_MOBILITY_BACKEND_TESTS)) {
    runScript("test:mobility-backend-local");
    console.log("[backend-ci] OK: auth, security y movilidad verificados.");
  } else {
    console.log("[backend-ci] OK: auth y seguridad verificados. Movilidad SQL omitida por RUN_MOBILITY_BACKEND_TESTS!=true.");
  }
} catch (error) {
  console.error("[backend-ci] FAIL:", error?.message || error);
  process.exit(1);
}