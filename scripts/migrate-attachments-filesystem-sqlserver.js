const {
  migrateAttachmentsToFilesystemSqlServer,
  shouldUseSqlServerMobility,
} = require("../lib/sqlserverMobilityStore");
const fs = require("fs");
const path = require("path");

function loadEnvFile(fileName) {
  const filePath = path.join(__dirname, "..", fileName);
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

function main() {
  if (!shouldUseSqlServerMobility()) {
    console.error("AUTH_PROVIDER no apunta a SQL Server. Configura AUTH_PROVIDER=sqlcmd-windows o mssql antes de migrar.");
    process.exit(1);
  }

  const summary = migrateAttachmentsToFilesystemSqlServer({ batchSize: 40 });
  console.log("Migracion de adjuntos completada:");
  console.log(JSON.stringify(summary, null, 2));
}

try {
  main();
} catch (error) {
  console.error("Error migrando adjuntos:", error?.message || error);
  process.exit(1);
}
