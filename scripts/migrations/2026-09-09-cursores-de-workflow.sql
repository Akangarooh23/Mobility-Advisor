-- Un sitio donde los workflows guarden por dónde iban.
--
-- El scraper alemán recorre 45 marcas, unas pocas por pasada, y lleva la cuenta
-- en $getWorkflowStaticData('global'). Eso vive dentro del workflow, y se
-- reinicia cada vez que se reimporta.
--
-- El 2026-09-09 se reimportó tres veces en una tarde -para arreglar el cron, el
-- id del sub-workflow y los reintentos de Postgres- y las tres pasadas
-- empezaron por la marca 9. Dos horas de reloj releyendo Audi, que ya estaba
-- entero: 6 ofertas nuevas cada cinco minutos en vez de mil.
--
-- Y no era solo la reimportación: una pasada que se corta a medias -Neon
-- reciclando la conexión- también deja el cursor donde estaba.
--
-- Aquí sobrevive a todo: a reimportar, a reiniciar n8n y a que se caiga una
-- pasada.

CREATE TABLE IF NOT EXISTS moveadvisor_cursores (
  clave       text PRIMARY KEY,
  valor       integer     NOT NULL DEFAULT 0,
  actualizado timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE moveadvisor_cursores IS
  'Por dónde iba cada workflow que recorre un catálogo por trozos. '
  'La clave la elige el workflow; el valor es un índice dentro de su propia lista.';

-- El scraper alemán arranca donde lo dejó la última pasada de verdad. Hoy tiene
-- hechas Audi (9), BMW (13) y Mercedes-Benz (47), que son las tres primeras de
-- su lista, así que la siguiente pasada debe empezar por la cuarta.
INSERT INTO moveadvisor_cursores (clave, valor)
VALUES ('as24_de_marca', 3)
ON CONFLICT (clave) DO NOTHING;
