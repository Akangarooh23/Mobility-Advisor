const { spawn } = require("child_process");
const net = require("net");

const isWindows = process.platform === "win32";
const children = [];
let shuttingDown = false;

function runTask(label, command, extraEnv = {}, options = {}) {
  const {
    restartOnFailure = false,
    maxRestarts = 0,
    restartDelayMs = 700,
  } = options;

  const env = { ...process.env, ...extraEnv };
  let restartCount = 0;

  function spawnChild() {
    const child = isWindows
      ? spawn("cmd.exe", ["/c", command], {
          cwd: __dirname,
          stdio: "inherit",
          env,
        })
      : spawn("sh", ["-c", command], {
          cwd: __dirname,
          stdio: "inherit",
          env,
        });

    child.on("exit", (code) => {
      if (shuttingDown) {
        return;
      }

      if (code && code !== 0) {
        if (restartOnFailure && restartCount < maxRestarts) {
          restartCount += 1;
          console.error(`⚠️ ${label} terminó con código ${code}. Reintento ${restartCount}/${maxRestarts}...`);
          setTimeout(spawnChild, restartDelayMs);
          return;
        }

        console.error(`❌ ${label} terminó con código ${code}`);
        shutdown(code);
      }
    });

    children.push(child);
    return child;
  }

  return spawnChild();
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const finalize = (value) => {
      try {
        socket.destroy();
      } catch {}
      resolve(value);
    };

    socket.setTimeout(500);
    socket.once("connect", () => finalize(true));
    socket.once("timeout", () => finalize(false));
    socket.once("error", () => finalize(false));

    socket.connect(port, "127.0.0.1");
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(exitCode), 300);
}

async function start() {
  console.log("🚀 Iniciando frontend y API local sin Vercel...");

  const apiPort = Number(process.env.API_PORT || "3001");
  const apiAlreadyRunning = Number.isFinite(apiPort) ? await isPortListening(apiPort) : false;

  if (apiAlreadyRunning) {
    console.log(`ℹ️ API detectada en http://localhost:${apiPort}. Se reutiliza proceso existente.`);
  } else {
    runTask(
      "API local",
      "npm run start:api",
      { API_PORT: String(apiPort || 3001), PORT: String(apiPort || 3001) },
      { restartOnFailure: true, maxRestarts: 2, restartDelayMs: 900 }
    );
  }

  const requestedFrontendPort = Number(process.env.PORT || "3002");
  let frontendPort = Number.isFinite(requestedFrontendPort) ? requestedFrontendPort : 3002;

  while (await isPortListening(frontendPort)) {
    frontendPort += 1;
  }

  if (frontendPort !== requestedFrontendPort) {
    console.log(`ℹ️ Puerto frontend ${requestedFrontendPort} ocupado. Se usa ${frontendPort}.`);
  }

  runTask("Frontend", "npm run start:web", {
    PORT: String(frontendPort),
    BROWSER: process.env.BROWSER || "none",
  });
}

start().catch((error) => {
  console.error("❌ Error iniciando local-dev:", error instanceof Error ? error.message : error);
  shutdown(1);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
