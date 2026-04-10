const { spawn } = require("child_process");

const isWindows = process.platform === "win32";
const children = [];
let shuttingDown = false;

function runTask(label, command, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
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
      console.error(`❌ ${label} terminó con código ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
  return child;
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

console.log("🚀 Iniciando frontend y API local sin Vercel...");
runTask("API local", "npm run start:api", { PORT: process.env.API_PORT || "3001" });
runTask("Frontend", "npm run start:web", {
  PORT: process.env.PORT || "3002",
  BROWSER: process.env.BROWSER || "none",
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
