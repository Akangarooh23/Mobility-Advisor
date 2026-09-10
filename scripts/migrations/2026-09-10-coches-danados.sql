-- Saber si un coche está dañado antes de ofrecérselo a nadie.
--
-- El 2026-09-10, al bajar el suelo del escaparate de importación de 12.000 a
-- 4.000 €, entraban 1.003 ofertas alemanas nuevas. Mirando qué eran:
--
--     5.500 €  2017  125.000 km   Land Rover Discovery Sport // MOTORSCHADEN
--     5.390 €  2018  189.378 km   Land Rover Discovery Sport ... Motorschaden
--     4.900 €  2021   87.000 km   Citroen Jumper Kasten
--
-- Por el título se detectaba un 5% de siniestrados y un 4% de «piezas» o motor
-- roto. Pero el primero de la lista -un Mercedes E 300 de 2024 a 11.900 €- no
-- decía nada en el título, y su ficha sí:
--
--     damageConditions : ["Dañado"]
--     isFinalPrice     : false
--     netPrice         : 10.000 €   (el anunciado lleva 19% de IVA deducible)
--
-- O sea que el título no basta: hay que leer la ficha. Estas columnas guardan lo
-- que AutoScout24 declara, para poder excluirlos sin adivinar.

ALTER TABLE moveadvisor_market_offers
  ADD COLUMN IF NOT EXISTS is_damaged   boolean,
  ADD COLUMN IF NOT EXISTS damage_note  text,
  ADD COLUMN IF NOT EXISTS had_accident boolean,
  ADD COLUMN IF NOT EXISTS price_is_net boolean;

COMMENT ON COLUMN moveadvisor_market_offers.is_damaged IS
  'El portal declara el coche como dañado. NULL = no lo hemos mirado todavía, '
  'que no es lo mismo que FALSE.';
COMMENT ON COLUMN moveadvisor_market_offers.damage_note IS
  'Lo que dice el portal, tal cual: "Dañado", "Accidentado", "Para piezas"...';
COMMENT ON COLUMN moveadvisor_market_offers.had_accident IS
  'El portal declara que ha tenido un accidente. Es distinto de is_damaged: un '
  'coche reparado puede tener accidente y no estar dañado.';
COMMENT ON COLUMN moveadvisor_market_offers.price_is_net IS
  'El precio anunciado NO es final: es neto, sin el IVA alemán del 19%. Típico '
  'de vehículos comerciales. Un precio neto comparado contra precios españoles '
  'con IVA inventa un ahorro del 19% que no existe.';

-- Para poder filtrar rápido en el scoring, que ya tarda 11 minutos.
CREATE INDEX IF NOT EXISTS idx_market_offers_danados
  ON moveadvisor_market_offers (country, is_damaged)
  WHERE country = 'DE';
