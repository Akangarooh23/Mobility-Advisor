-- Apuntar CUÁNDO se miró si un coche está dañado, no solo el resultado.
--
-- El 2026-09-13, de las 1.647 candidatas a publicar que el scoring no podía
-- tocar por no saber si estaban dañadas, 312 YA habían pasado por su ficha:
--
--     nunca han pasado por la ficha: 1.335
--     ficha vista pero sin el dato :   312
--
-- Esas 312 son fichas que se pidieron y no dieron el dato -murieron con un 410,
-- o el JSON no traía damageConditions-. Como el enriquecedor hace su cola con
-- «enrich_tried_at IS NULL», ya no vuelve a mirarlas nunca: se quedan con
-- is_damaged NULL para siempre y el escaparate no las publica jamás, aunque
-- sean buenas ofertas.
--
-- Por eso el comprobador de daños necesita su propia marca. Con ella la cola
-- puede decir «las que no sé si están dañadas y hace más de tres días que no lo
-- intento», que reintenta las caídas pasajeras sin repetir cada pasada las que
-- de verdad no traen el dato.

ALTER TABLE moveadvisor_market_offers
  ADD COLUMN IF NOT EXISTS damage_checked_at timestamptz;

COMMENT ON COLUMN moveadvisor_market_offers.damage_checked_at IS
  'Última vez que se pidió la ficha para mirar si está dañado. Se mueve aunque '
  'la ficha no diera el dato: es lo que evita reintentar en cada pasada las que '
  'nunca lo dan. Distinto de enrich_tried_at, que es de otra cola.';

-- La cola del comprobador: alemanas activas de las que aún no sabemos si están
-- dañadas. Sin este índice son 214.420 filas a recorrer cada pasada.
CREATE INDEX IF NOT EXISTS idx_market_offers_danos_pendientes
  ON moveadvisor_market_offers (damage_checked_at)
  WHERE country = 'DE' AND is_active AND is_damaged IS NULL;

-- Las ya comprobadas heredan la fecha en que se enriquecieron: es cuando se
-- miró su ficha de verdad. Sin esto, las 6.312 que ya tienen el dato entrarían
-- en la cola como si nadie las hubiera visto.
UPDATE moveadvisor_market_offers
   SET damage_checked_at = COALESCE(enrich_tried_at, updated_at, NOW())
 WHERE country = 'DE' AND is_damaged IS NOT NULL AND damage_checked_at IS NULL;
