-- Los fallos se quedan en casa
--
-- ## Qué no había
--
-- Ninguna forma de enterarse de un fallo. Ni seguimiento de errores, ni avisos:
-- 16 `catch {}` y 35 `.catch(() => {})` que se tragaban el error del todo, y ocho
-- `console.error` que van a los registros de Vercel, que caducan y no avisan a
-- nadie.
--
-- El sistema de detección de fallos era Ana mirando la pantalla. Y ya falló dos
-- veces: el PDF de factura llevaba roto en producción y el aviso de cookies no
-- salía; las dos se descubrieron por casualidad.
--
-- ## Por qué una tabla y no Sentry
--
-- Porque las tres piezas difíciles ya están: recoger es un endpoint, agrupar es
-- un `GROUP BY` y avisar es un cron con Resend —y ya hay siete crons corriendo—.
-- Y porque un error del navegador lleva la pantalla, el coche que se estaba
-- mirando y a veces el correo de quien lo sufrió: mandarlo a un servidor de otra
-- empresa es un tratamiento de datos que hay que documentar, con su encargado y
-- su transferencia internacional. Para una empresa que va a operar en varios
-- países, «los errores están en mi Neon, en Europa» es una respuesta más limpia.
--
-- Además no hay cupo. Los planes gratuitos tienen tope de errores al mes, y el
-- día que algo se rompa de verdad es justo el día que genera cincuenta mil.
--
-- ## Lo que decide el agrupado
--
-- `huella` es lo que convierte líneas sueltas en información: «este fallo, 400
-- veces, 87 personas, desde el martes a las 14:20». Se calcula de `donde` más el
-- mensaje sin los números —un id o un importe distinto no son dos fallos— y es lo
-- que se cuenta y lo que decide si hay que avisar.

CREATE TABLE IF NOT EXISTS moveadvisor_errores (
  id             BIGSERIAL PRIMARY KEY,
  cuando         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- "servidor" o "navegador". Los dos lados caen en la misma tabla para poder
  -- ver de un golpe si un fallo del navegador viene de uno del servidor.
  lado           TEXT NOT NULL,

  -- Qué estaba pasando, en dos o tres palabras y con su sitio:
  -- "vehicle-publish: guardar el precio".
  donde          TEXT NOT NULL,
  mensaje        TEXT NOT NULL DEFAULT '',

  -- Lo que permite agrupar: `donde` + el mensaje sin números.
  huella         TEXT NOT NULL,

  -- Código de Postgres cuando lo hay: 23505 clave duplicada, 42P01 tabla que no
  -- existe, 57014 consulta cancelada por tiempo. Dice más que el mensaje.
  codigo         TEXT,
  pila           TEXT,

  -- Ids y datos con los que buscar el caso. Sin correos enteros: `registra` los
  -- tapa antes de llegar aquí.
  contexto       JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Solo del navegador.
  pantalla       TEXT,
  direccion      TEXT,
  navegador      TEXT,

  -- Con el correo tapado —an***@popcar.es—, que es lo que permite contar
  -- personas afectadas sin guardar la dirección.
  quien          TEXT,

  -- Para saber si un fallo lo trajo el despliegue de ayer.
  version        TEXT,

  -- Lo pone el cron cuando ya ha avisado de esta huella, para no repetir.
  avisado_en     TIMESTAMPTZ
);

-- La consulta del cron y de la pantalla: lo de las últimas horas, agrupado.
CREATE INDEX IF NOT EXISTS ix_errores_huella_cuando
  ON moveadvisor_errores (huella, cuando DESC);

-- Y la de «qué ha pasado hoy», que es como se mira cuando algo va mal.
CREATE INDEX IF NOT EXISTS ix_errores_cuando
  ON moveadvisor_errores (cuando DESC);

/*
 * Las huellas de las que queda algo por avisar.
 *
 * Parcial a propósito: en cuanto se avisa, la fila sale del índice. Así el índice
 * mide lo pendiente y no la tabla entera, que crece sin parar.
 */
CREATE INDEX IF NOT EXISTS ix_errores_sin_avisar
  ON moveadvisor_errores (huella)
  WHERE avisado_en IS NULL;
