-- El telefono de quien tiene el coche, y por quien preguntar.
--
-- La regla del flujo de visitas es que a quien vende hay que llamarle a mano,
-- siempre: el sistema no le avisa ni al reservar, ni al confirmar, ni al mover,
-- ni al cancelar. Y su telefono no estaba guardado en ninguna parte.
--
-- Lo que habia era `source_url`, y no sirve para esto:
--
--   · De un concesionario si es su anuncio, con su telefono dentro.
--   · De ex-renting es un informe de inspeccion de DEKRA o una carpeta de
--     SharePoint: ni anuncio ni telefono, y algunos piden credenciales.
--   · De los coches que subimos nosotros no hay nada, porque no estan
--     anunciados en ningun sitio.
--
-- Asi que el telefono acababa dependiendo de que alguien se acordara.
--
-- Se rellena una vez por vendedor, no por coche: los 95 de Astara llevan el
-- mismo. Si algun dia hay muchos vendedores repetidos, esto se sube a una tabla
-- propia sin tocar lo que lo lee.
--
-- ESTO NO SE ENSENA EN POPCAR. Es un dato de trabajo interno: las consultas que
-- sirven el marketplace publico listan sus columnas una por una y no incluyen
-- estas dos, y hay una prueba que falla si alguien las anade.

ALTER TABLE moveadvisor_marketplace_vo_offers
  ADD COLUMN IF NOT EXISTS seller_phone   TEXT NOT NULL DEFAULT '';

ALTER TABLE moveadvisor_marketplace_vo_offers
  ADD COLUMN IF NOT EXISTS seller_contact TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN moveadvisor_marketplace_vo_offers.seller_phone IS
  'Telefono de quien vende. Uso interno del ERP: no sale nunca en el marketplace.';
COMMENT ON COLUMN moveadvisor_marketplace_vo_offers.seller_contact IS
  'Persona por la que preguntar. Uso interno del ERP: no sale nunca en el marketplace.';
