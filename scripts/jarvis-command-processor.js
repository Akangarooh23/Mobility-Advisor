/**
 * Command processor: el lado de CarsWise de la frontera con Jarvis.
 *
 * Jarvis decide y propone; aquí es donde se consigue el resultado. Este proceso
 * vive en el repo del negocio a propósito, porque es el negocio quien sabe qué
 * significa aplicar un comando y quién es el dueño de sus tablas.
 *
 * Dirección de la dependencia: CarsWise VA A BUSCAR el trabajo a la cola de
 * Jarvis. Jarvis no empuja nada. Por eso Jarvis no necesita saber dónde vive
 * este proceso, cómo se autentica ni cuándo está encendido.
 *
 *   Jarvis /claim  →  golden tests  →  UPDATE en nuestra BD  →  Jarvis /settle
 *
 * Uso:
 *   node scripts/jarvis-command-processor.js            (una pasada)
 *   node scripts/jarvis-command-processor.js --watch    (bucle)
 */

const { spawnSync } = require("child_process");
const path = require("path");
const { Pool } = require("pg");

const JARVIS_URL = process.env.JARVIS_API_URL || "http://127.0.0.1:4100";
const TOKEN = process.env.JARVIS_PROCESSOR_TOKEN || "";
const PROCESSOR_ID = process.env.JARVIS_PROCESSOR_ID || "carswise-processor";
const POLL_MS = Number(process.env.JARVIS_POLL_MS || 10000);
const BATCH = Number(process.env.JARVIS_BATCH || 10);

const SUPPORTED = new Set(["alias.merge.v1", "alias.unmerge.v1"]);

function log(message, extra) {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] ${message}${extra ? " " + JSON.stringify(extra) : ""}`);
}

async function jarvis(pathname, body) {
  const response = await fetch(`${JARVIS_URL}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      "X-Processor-Id": PROCESSOR_ID,
    },
    body: JSON.stringify(body || {}),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${pathname} → HTTP ${response.status}: ${(payload && payload.error) || "sin cuerpo"}`);
  }
  return payload;
}

/**
 * El invariante 1, hecho paso obligatorio: nada que alimente el motor de
 * precios se toca sin golden tests en verde.
 *
 * Corre ANTES de aplicar y en el proceso de CarsWise, no en el de Jarvis. Un
 * agente no puede saltárselo porque no es él quien lo ejecuta.
 */
function goldenTestsPass() {
  const runner = path.join(__dirname, "golden-tests", "run.js");
  const result = spawnSync(process.execPath, [runner], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
    timeout: 5 * 60 * 1000,
  });

  if (result.error) {
    return { ok: false, reason: `no se pudo ejecutar el runner: ${result.error.message}` };
  }
  if (result.status !== 0) {
    const tail = String(result.stdout || result.stderr || "").split("\n").slice(-15).join("\n");
    return { ok: false, reason: `golden tests en rojo (exit ${result.status})`, tail };
  }
  return { ok: true };
}

/** Misma normalización que resolveBrandWithAliases en lib/inventoryStore.js. */
function aliasKey(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Aplica el merge en NUESTRAS tablas, en una transacción.
 *
 * Idempotente a propósito: si el alias ya apunta al canónico correcto, no es un
 * error, es que el trabajo ya estaba hecho. Un procesador que muere después de
 * aplicar y antes de informar tiene que poder reintentar sin romper nada.
 */
async function applyAliasMerge(pool, payload, { active }) {
  const key = aliasKey(payload.alias);
  if (!key) throw new Error(`alias "${payload.alias}" se normaliza a vacío`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (payload.kind === "brand") {
      const existing = await client.query(
        "SELECT canonical_name, is_active FROM moveadvisor_brand_aliases WHERE alias_key = $1",
        [key]
      );

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO moveadvisor_brand_aliases (alias_key, canonical_name, is_active)
           VALUES ($1, $2, $3)`,
          [key, payload.canonical, active]
        );
      } else {
        await client.query(
          "UPDATE moveadvisor_brand_aliases SET canonical_name = $2, is_active = $3 WHERE alias_key = $1",
          [key, payload.canonical, active]
        );
      }
    } else {
      const brandKey = aliasKey(payload.canonical);
      const existing = await client.query(
        "SELECT canonical_name FROM moveadvisor_model_aliases WHERE brand_key = $1 AND alias_key = $2",
        [brandKey, key]
      );

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO moveadvisor_model_aliases (brand_key, alias_key, canonical_name, is_active)
           VALUES ($1, $2, $3, $4)`,
          [brandKey, key, payload.canonical, active]
        );
      } else {
        await client.query(
          `UPDATE moveadvisor_model_aliases SET canonical_name = $3, is_active = $4
           WHERE brand_key = $1 AND alias_key = $2`,
          [brandKey, key, payload.canonical, active]
        );
      }
    }

    await client.query("COMMIT");
    return { aliasKey: key, canonical: payload.canonical, active };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function processOne(pool, command) {
  if (!SUPPORTED.has(command.type)) {
    // Rechazar lo desconocido en vez de ignorarlo: un comando que nadie procesa
    // se queda colgado para siempre y nadie se entera.
    await jarvis(`/api/domain-commands/${command.id}/settle`, {
      status: "rejected",
      error: `Tipo no soportado por este procesador: ${command.type}`,
    });
    log("rechazado (tipo desconocido)", { id: command.id, type: command.type });
    return;
  }

  const golden = goldenTestsPass();
  if (!golden.ok) {
    await jarvis(`/api/domain-commands/${command.id}/settle`, {
      status: "rejected",
      error: `Invariante 1: ${golden.reason}`,
    });
    log("rechazado (golden en rojo)", { id: command.id, reason: golden.reason });
    return;
  }

  try {
    // unmerge = el mismo alias desactivado. No se borra la fila: el histórico
    // del dominio también tiene derecho a ser cierto.
    const active = command.type === "alias.merge.v1";
    const result = await applyAliasMerge(pool, command.payload, { active });

    await jarvis(`/api/domain-commands/${command.id}/settle`, { status: "applied", result });
    log("aplicado", { id: command.id, type: command.type, ...result });
  } catch (error) {
    await jarvis(`/api/domain-commands/${command.id}/settle`, {
      status: "failed",
      error: error.message,
    });
    log("fallido", { id: command.id, error: error.message });
  }
}

async function runOnce(pool) {
  const { commands } = await jarvis("/api/domain-commands/claim", { limit: BATCH });
  if (commands.length === 0) return 0;

  log(`reclamados ${commands.length}`);
  for (const command of commands) {
    await processOne(pool, command);
  }
  return commands.length;
}

async function main() {
  if (!TOKEN) {
    console.error("Falta JARVIS_PROCESSOR_TOKEN. El procesador no arranca sin credencial de cola.");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("Falta DATABASE_URL: sin base del negocio no hay nada que aplicar.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString, max: 4 });
  const watch = process.argv.includes("--watch");

  log(`procesador ${PROCESSOR_ID} contra ${JARVIS_URL}${watch ? ` (cada ${POLL_MS}ms)` : ""}`);

  if (!watch) {
    const n = await runOnce(pool);
    log(`fin: ${n} comandos`);
    await pool.end();
    return;
  }

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    log("cerrando");
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    try {
      await runOnce(pool);
    } catch (error) {
      // Un fallo de red no debe matar el procesador: la cola sigue ahí.
      log("error en la pasada", { error: error.message });
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

main().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
