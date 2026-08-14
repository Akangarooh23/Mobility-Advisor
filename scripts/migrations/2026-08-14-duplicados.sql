-- ============================================================================
--  Qué anuncios son el mismo coche
--  2026-08-14
-- ============================================================================
--
--  ── Por qué una tabla aparte y no columnas en las ofertas ───────────────────
--
--  La primera versión añadía `duplicate_of`, `ubicaciones` y `apariciones` a
--  `moveadvisor_market_offers`. Se descartó por cuatro motivos, y el primero es
--  el que decide:
--
--   1. El proceso corre CADA NOCHE y tendría que limpiar y volver a marcar:
--      600.000 filas reescritas cada madrugada en la tabla más caliente del
--      sistema. Postgres no actualiza en sitio —crea una versión nueva y deja
--      la vieja muerta—, así que hincharía la tabla que usan la web y la
--      tasación. Con esta tabla es TRUNCATE más 220.000 inserciones en algo
--      pequeño, y la grande no se toca.
--
--   2. Los scrapers son dueños de `moveadvisor_market_offers`. Cada columna
--      añadida ahí es una apuesta a que ningún workflow futuro la incluya en su
--      upsert, y esas apuestas se pierden en silencio.
--
--   3. Es una INFERENCIA nuestra, no un dato del portal. Separadas, siempre se
--      puede contestar "¿qué dijo el portal exactamente?" sin desenredar nada.
--
--   4. La huella va a cambiar —quedan 29.610 grupos entre portales con precio
--      distinto—. Rehacer una tabla pequeña es barato; reescribir la grande no.
--
--  Y de propina la migración deja de dar miedo: crear una tabla vacía y sus
--  índices no bloquea a nadie, así que ni siquiera hace falta CONCURRENTLY.
-- ============================================================================

CREATE TABLE IF NOT EXISTS moveadvisor_offer_duplicates (
  -- Cada anuncio del grupo, incluido el canónico, que se apunta a sí mismo.
  -- Que el canónico esté también permite responder "¿cuál es el grupo de éste?"
  -- con una sola consulta, sin casos especiales.
  offer_id      TEXT PRIMARY KEY,

  -- A quién representa. Si offer_id = canonical_id, éste ES el canónico.
  canonical_id  TEXT NOT NULL,

  -- La clave que los agrupó. Guardarla permite auditar POR QUÉ se unieron sin
  -- tener que reconstruir la huella a mano tres meses después.
  huella        TEXT NOT NULL,

  -- Solo en el canónico: todas las ubicaciones del grupo, para que el filtro
  -- de la web devuelva el coche por cualquiera de ellas.
  ubicaciones   TEXT[],

  -- Solo en el canónico: portal, url, vendedor, ciudad y precio de cada copia.
  -- Es lo que la ficha enseña como "también está en...".
  apariciones   JSONB,

  agrupado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 'huella.v1' o el email de quien lo decidió a mano. Un grupo decidido por
  -- una persona no se puede deshacer por una pasada automática.
  agrupado_por  TEXT NOT NULL
);

-- "Dame el grupo de este canónico"
CREATE INDEX IF NOT EXISTS ix_dups_canonical
  ON moveadvisor_offer_duplicates (canonical_id);

-- "Dame solo los canónicos" — la consulta del marketplace
CREATE INDEX IF NOT EXISTS ix_dups_solo_canonicos
  ON moveadvisor_offer_duplicates (offer_id)
  WHERE offer_id = canonical_id;

-- Para que `'Málaga' = ANY(ubicaciones)` no recorra la tabla
CREATE INDEX IF NOT EXISTS ix_dups_ubicaciones
  ON moveadvisor_offer_duplicates USING GIN (ubicaciones);

-- Sin FOREIGN KEY a propósito: un ON DELETE CASCADE se llevaría filas por
-- delante sin dejar rastro si un scraper borrara una oferta, y el proceso
-- nocturno reconstruye esta tabla entera de todas formas.

-- ============================================================================
--  Para deshacerla:  DROP TABLE moveadvisor_offer_duplicates;
-- ============================================================================
