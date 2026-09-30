-- Saber que n8n está vivo, y en minutos en vez de en días.
--
-- n8n se cayó tres veces la semana del 24 al 30 de septiembre de 2026 y las
-- tres se descubrieron por casualidad. El 28 y el 29 dejó 157 ejecuciones
-- encoladas que no arrancaron nunca, y el verificador de wallapop perdió trece
-- pasadas seguidas.
--
-- ── Por qué no bastaba lo que ya había ─────────────────────────────────────
--
-- lib/vigila-scrapers.js avisa cuando una fuente lleva DOS DÍAS sin raspar, y
-- corre una vez al día. Es la pregunta correcta a largo plazo -«¿ha dejado de
-- entrar catálogo?»- y por eso se escribió, después de quince días parado en
-- agosto. Pero con una comprobación diaria y un umbral de dos días, una parada
-- de hasta cuarenta y ocho horas se cuela entera sin que nadie la vea.
--
-- Y mira el DATO, no el PROCESO. Saber si n8n escucha en el 5678 se responde
-- en un segundo; saber si ha entrado catálogo tarda dos días por diseño.
--
-- ── Por qué hace falta una tabla y no basta con el guardián local ──────────
--
-- El guardián -scripts/vigila-n8n.js, en pm2 cada cinco minutos- comprueba el
-- puerto y levanta n8n si no responde. Eso convierte una parada de dos días en
-- una de cinco minutos, y no necesita a nadie.
--
-- Lo que NO puede cubrir es que la máquina entera esté apagada: si no hay
-- máquina, no hay guardián. Por eso cada pasada deja su latido aquí, y desde
-- fuera se puede ver que el último es de hace tres horas y avisar.
--
-- También sirve para una pregunta que hoy no tiene respuesta: cuántas veces se
-- cae n8n. Se sabía que pasaba; no cuánto.

CREATE TABLE IF NOT EXISTS moveadvisor_latidos_n8n (
  id          bigserial PRIMARY KEY,
  momento     timestamptz NOT NULL DEFAULT now(),
  vivo        boolean     NOT NULL,
  actuo       boolean     NOT NULL DEFAULT false,
  detalle     text        NOT NULL DEFAULT ''
);

COMMENT ON TABLE moveadvisor_latidos_n8n IS
  'Un latido por pasada del guardian (scripts/vigila-n8n.js, cada 5 min). vivo = n8n respondia en el 5678; actuo = hubo que levantarlo.';

/*
 * El índice es para la pregunta que se hace siempre: ¿cuándo fue el último
 * latido? Descendente porque siempre se pide el más reciente.
 */
CREATE INDEX IF NOT EXISTS idx_latidos_n8n_momento
  ON moveadvisor_latidos_n8n (momento DESC);

/*
 * La tabla se poda sola a los treinta días.
 *
 * Son 288 latidos al día -uno cada cinco minutos-, unos 8.600 al mes. Sin
 * podar serían 105.000 filas al año de un dato que no sirve pasado un mes, y
 * acabaría siendo otra tabla que nadie mira y que hay que limpiar a mano. Lo
 * hace el propio guardián en cada pasada.
 */
