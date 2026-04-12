const { spawnSync } = require("child_process");

function runNpmScript(scriptName) {
  const result = spawnSync(`npm run ${scriptName}`, {
    stdio: "inherit",
    shell: true,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

try {
  runNpmScript("test:auth-local");
  runNpmScript("test:auth-local:strict");
  console.log("[auth-e2e:all] OK: checks normal y strict completados.");
} catch (error) {
  console.error("[auth-e2e:all] FAIL:", error?.message || error);
  process.exit(1);
}
