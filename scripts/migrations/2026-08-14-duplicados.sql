-- ============================================================================
--  Un coche publicado varias veces deja de contarse varias veces
--  2026-08-14 · REVISAR ANTES DE APLICAR
-- ============================================================================
--
--  No borra nada, no modifica ninguna fila existente y no toca ninguna columna
--  que escriba otro proceso. Solo añade tres columnas nulas y sus índices.
--
--  ── Por qué columnas nuevas y no `is_active` ────────────────────────────────
--
--  Marcar las copias como inactivas sería lo evidente y NO aguanta: dos
--  procesos de n8n devuelven `is_active` a `true` solos.
--
--    · `mantenimiento-activas` corre cada día a las 07:00 y lo RECALCULA para
--      todas las ofertas a partir de `last_seen_at`.
--    · `flexicar-verificar-activas` lo pone a `TRUE` cada vez que comprueba que
--      la ficha sigue publicada.
--
--  La marca duraría menos de un día, y se desharía en silencio: el marketplace
--  volvería a enseñar los duplicados sin que nada avisara.
--
--  Además son dos preguntas distintas. `is_active` contesta "¿sigue vivo el
--  anuncio?"; `duplicate_of` contesta "¿es una copia de otro?". Fundirlas
--  dejaría sin saber por qué está oculta cada oferta.
--
--  ── Por qué sobreviven a los scrapers ───────────────────────────────────────
--
--  El upsert de n8n enumera sus columnas una a una en el `DO UPDATE SET`, así
--  que lo que no está en esa lista no se toca. De ahí una regla que conviene
--  que quede escrita: **ningún workflow debe añadir estas tres columnas a su
--  upsert.** Si alguna vez se hace, la deduplicación se borra cada noche.
--
--  ── Qué se oculta, medido el 14 de agosto ───────────────────────────────────
--
--    autoscout24   377.261 activas · 155.965 copias · 41,3 %
--    cochescom      81.981 activas ·   6.157 copias ·  7,5 %
--    milanuncios     4.739 activas ·      64 copias ·  1,4 %
--
--  Por marca el reparto es parejo —entre el 24 % y el 45 %— y ninguna se queda
--  sin catálogo. autocasion NO aparece: no publica `dealer_name`, así que sus
--  ofertas no entran en la huella y sus copias siguen visibles. Es un hueco
--  declarado, no un cero.
-- ============================================================================

BEGIN;

-- A quién representa esta oferta. NULL = es el canónico, o no tiene copias.
-- Se guarda el id de la oferta canónica, que es el id del portal.
ALTER TABLE moveadvisor_market_offers
  ADD COLUMN IF NOT EXISTS duplicate_of TEXT;

-- Todas las ubicaciones del grupo, solo en el canónico.
--
-- Se materializa a propósito, y no choca con "no tengas el mismo dato dos
-- veces": lo escribe UN solo proceso en el mismo momento en que decide el
-- grupo, así que no hay dos fuentes que puedan discrepar. Y el filtro por
-- ubicación de la web tiene que seguir siendo rápido sobre 600.000 filas.
ALTER TABLE moveadvisor_market_offers
  ADD COLUMN IF NOT EXISTS ubicaciones TEXT[];

-- Dónde está publicada cada copia: portal, url, vendedor y ciudad.
-- Es lo que la ficha del canónico enseña como "también está en...".
ALTER TABLE moveadvisor_market_offers
  ADD COLUMN IF NOT EXISTS apariciones JSONB;

-- Para "dame los canónicos" y para encontrar el grupo de uno dado.
CREATE INDEX IF NOT EXISTS ix_offers_duplicate_of
  ON moveadvisor_market_offers (duplicate_of);

-- Parcial: la consulta que de verdad se hace es "activas y no copia".
CREATE INDEX IF NOT EXISTS ix_offers_canonicas
  ON moveadvisor_market_offers (is_active)
  WHERE duplicate_of IS NULL;

-- GIN para que `'Málaga' = ANY(ubicaciones)` no recorra la tabla.
CREATE INDEX IF NOT EXISTS ix_offers_ubicaciones
  ON moveadvisor_market_offers USING GIN (ubicaciones);

COMMIT;

-- ============================================================================
--  Para deshacerla, si hiciera falta. No pierde nada que no se pueda recalcular.
-- ============================================================================
--
--  BEGIN;
--    DROP INDEX IF EXISTS ix_offers_ubicaciones;
--    DROP INDEX IF EXISTS ix_offers_canonicas;
--    DROP INDEX IF EXISTS ix_offers_duplicate_of;
--    ALTER TABLE moveadvisor_market_offers
--      DROP COLUMN IF EXISTS apariciones,
--      DROP COLUMN IF EXISTS ubicaciones,
--      DROP COLUMN IF EXISTS duplicate_of;
--  COMMIT;
