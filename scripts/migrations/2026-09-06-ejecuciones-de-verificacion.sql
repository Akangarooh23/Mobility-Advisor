-- ============================================================================
--  El parte de cada verificacion: cuantas fichas se miraron y hasta donde
--  2026-09-06
-- ============================================================================
--
--  El verificador de Milanuncios tiene un numero que no esta medido: cuantas
--  fichas seguidas aguanta el portal antes de sacar la pantalla de Imperva. De
--  ese numero salen la espera entre peticiones y el tamaño del lote, o sea si
--  se pueden repasar las 3.348 ofertas activas en un dia o en tres.
--
--  La idea es que el propio workflow lo mida: para en cuanto le bloquean y deja
--  escrito por cuantas iba. Pero ese apunte tenia que ir a algun sitio.
--
--  ── Por que no vale el registro de ejecuciones de n8n ──────────────────────
--
--  Porque para guardarlo habria que poner saveDataSuccessExecution a "all", y
--  eso guarda la salida de TODOS los nodos: 560 respuestas HTTP de 96 KB cada
--  una, o sea unos 54 MB por ejecucion, seis veces al dia. Guardar el parte
--  aparte cuesta una fila.
--
--  ── Para que sirve ─────────────────────────────────────────────────────────
--
--   - Ajustar el ritmo con datos: si sale bloqueado siempre por la ficha 40, se
--     sube la espera; si no se bloquea nunca, se baja y se va mas rapido.
--   - Ver si la deteccion de bajas funciona. Si `unclassified` es alto,
--     Milanuncios no devuelve 404 para los anuncios caducados y hay que
--     averiguar que devuelve; si `deactivated` es siempre 0, algo no encaja.
--   - Saber si el catalogo se esta repasando entero o solo a trozos.
--
--  Sirve para cualquier portal, no solo Milanuncios; de ahi la columna `portal`.
--  Es un historico a proposito: una fila por ejecucion, porque lo que interesa
--  es justamente la serie.
-- ============================================================================

CREATE TABLE IF NOT EXISTS moveadvisor_verify_runs (
  id            BIGSERIAL   PRIMARY KEY,
  portal        TEXT        NOT NULL,
  run_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Fichas que se llegaron a mirar de verdad. La pantalla de bloqueo NO cuenta:
  -- no es una ficha mirada, es que no nos dejaron mirar.
  checked       INTEGER     NOT NULL DEFAULT 0,

  -- El reparto de veredictos.
  alive         INTEGER     NOT NULL DEFAULT 0,  -- la ficha sigue publicada
  deactivated   INTEGER     NOT NULL DEFAULT 0,  -- 404 o 410: ya no existe
  unclassified  INTEGER     NOT NULL DEFAULT 0,  -- un 200 que no sabemos leer
  transient     INTEGER     NOT NULL DEFAULT 0,  -- 5xx o timeout: no dice nada

  -- Si la ejecucion acabo porque nos echaron. Con `checked` al lado, esta
  -- columna ES la medida: "aguanto 40 fichas con 20 segundos de espera".
  blocked       BOOLEAN     NOT NULL DEFAULT FALSE,
  wait_seconds  INTEGER
);

-- Siempre se pregunta lo mismo: las ultimas ejecuciones de un portal.
CREATE INDEX IF NOT EXISTS ix_verify_runs_portal_fecha
  ON moveadvisor_verify_runs (portal, run_at DESC);

-- Como se lee, que es para lo que existe:
--
--   SELECT run_at, checked, alive, deactivated, unclassified, blocked
--   FROM moveadvisor_verify_runs
--   WHERE portal = 'milanuncios' ORDER BY run_at DESC LIMIT 20;

-- ============================================================================
--  Para deshacerla:  DROP TABLE moveadvisor_verify_runs;
-- ============================================================================
