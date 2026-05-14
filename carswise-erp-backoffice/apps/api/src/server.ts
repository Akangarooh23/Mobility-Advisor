import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { ticketsRouter } from "./routes/tickets.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { marketRouter } from "./routes/market.js";
import { withUser } from "./middleware/auth.js";
import { initStore } from "./data/store.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const apiRootEnv = path.resolve(currentDir, "..", ".env");
const apiRootEnvLocal = path.resolve(currentDir, "..", ".env.local");
const backofficeRootEnv = path.resolve(currentDir, "..", "..", "..", ".env");
const backofficeRootEnvLocal = path.resolve(currentDir, "..", "..", "..", ".env.local");
const parentRepoRootEnv = path.resolve(currentDir, "..", "..", "..", "..", ".env");
const parentRepoRootEnvLocal = path.resolve(currentDir, "..", "..", "..", "..", ".env.local");

// Load env files from broader scope to narrower scope without overriding existing values.
dotenv.config({ path: parentRepoRootEnvLocal });
dotenv.config({ path: parentRepoRootEnv });
dotenv.config({ path: backofficeRootEnvLocal });
dotenv.config({ path: backofficeRootEnv });
dotenv.config({ path: apiRootEnvLocal });
dotenv.config({ path: apiRootEnv });

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5174" }));
app.use(express.json({ limit: "12mb" }));
app.use(withUser);

app.use("/api", healthRouter);
app.use("/api", authRouter);
app.use("/api", usersRouter);
app.use("/api", ticketsRouter);
app.use("/api", appointmentsRouter);
app.use("/api", marketRouter);

async function start() {
  await initStore();

  app.listen(port, () => {
    console.log(`carswise-erp-api listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("carswise-erp-api failed to start");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
