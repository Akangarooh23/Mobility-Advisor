-- ============================================================================
--  Dos garantias que no son la misma, y la fecha de intento del enriquecedor
--  2026-09-06
-- ============================================================================
--
--  En una ficha de Gamboa conviven dos numeros de garantia, y confundirlos es
--  prometerle a un cliente cinco años de lo que tiene uno:
--
--    - En la tabla de ficha tecnica, junto a Puertas y Nº dueños:
--        Garantia = 60 meses          -> la de la MARCA (Hyundai, coche de 2026)
--    - Pegado al precio, como reclamo comercial:
--        "12 meses de garantia, 100% cubierto con la garantia Gamboa"
--                                     -> la del CONCESIONARIO
--
--  La que vale para el cliente que compra en nuestro escaparate es la segunda,
--  y esa es la que va a `warranty_months`. La de la marca no se tira -es dato
--  real y ya lo estamos leyendo de la ficha- pero va a su propia columna.
--
--  `enrich_tried_at` es lo mismo que ya existe en moveadvisor_market_offers:
--  sin ella, una ficha que falla al enriquecerse se reintenta en cada pasada y
--  atasca la cola para siempre.
-- ============================================================================

ALTER TABLE moveadvisor_marketplace_vo_offers
  ADD COLUMN IF NOT EXISTS brand_warranty_months SMALLINT,
  ADD COLUMN IF NOT EXISTS enrich_tried_at       TIMESTAMPTZ;

-- La cola del enriquecedor: las de un concesionario que menos recientemente se
-- han intentado. NULLS FIRST porque las que no se han tocado nunca van primero.
CREATE INDEX IF NOT EXISTS ix_marketplace_vo_por_enriquecer
  ON moveadvisor_marketplace_vo_offers (portal, enrich_tried_at NULLS FIRST)
  WHERE is_active;

-- ============================================================================
--  Para deshacerla:
--    ALTER TABLE moveadvisor_marketplace_vo_offers
--      DROP COLUMN brand_warranty_months, DROP COLUMN enrich_tried_at;
-- ============================================================================
