-- Lo que se le enseña a un cliente deja de estar repartido por tres sitios.
--
-- `is_active` dice «sigue a la venta en el portal»: es un hecho del mundo, y lo
-- escriben los verificadores. «Se la enseñamos a alguien» es una decisión
-- nuestra, y hasta hoy vivía en tres filtros que no se conocían entre sí:
--
--   * el `soloPresentables` del consejero -foto, precio, km, es_coche-,
--   * la tabla moveadvisor_offer_duplicates, que el consejero mira y el
--     buscador no,
--   * y el buscador, que hasta el 24-sep-2026 no filtraba NADA: su base entera
--     era `is_active AND country = 'ES'`. Por eso salían tarjetas con el hueco
--     de la foto, T-Roc «a 301 €» -que son cuotas mensuales- y el mismo coche
--     seis veces seguidas.
--
-- Ya existe este patrón para el otro lado: `import_published` decide qué coche
-- alemán se ofrece, y lo calcula lib/coste-importacion.js. Esto es su hermano
-- para el mercado español.
--
-- ── UNA SOLA COSA ESCRIBE ESTA COLUMNA ──────────────────────────────────────
--
-- scripts/recalcula-visibles.js, y nadie más. No es una preferencia de estilo:
-- `import_published` lo escribían DOS -el nodo del scoring con una regla y
-- coste-importacion.js con otra- y cada día a las 13:10 uno despublicaba lo que
-- había publicado el otro. El catálogo estuvo semanas ofreciendo ahorros que no
-- existían.
--
-- ── Y lo que decide una persona no lo deshace una pasada ────────────────────
--
-- `visible_a_mano` es la misma idea que el `agrupado_por` de la tabla de
-- duplicados: si alguien ha decidido que una oferta concreta no se enseña, el
-- recálculo nocturno la respeta.

ALTER TABLE moveadvisor_market_offers
  ADD COLUMN IF NOT EXISTS visible boolean;

ALTER TABLE moveadvisor_market_offers
  ADD COLUMN IF NOT EXISTS visible_motivo varchar(40);

ALTER TABLE moveadvisor_market_offers
  ADD COLUMN IF NOT EXISTS visible_desde timestamptz;

ALTER TABLE moveadvisor_market_offers
  ADD COLUMN IF NOT EXISTS visible_a_mano boolean NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN moveadvisor_market_offers.visible IS
  'Si se le puede enseñar a un cliente. NULL = todavia no se ha decidido. Lo escribe SOLO scripts/recalcula-visibles.js.';
COMMENT ON COLUMN moveadvisor_market_offers.visible_motivo IS
  'Por que no se enseña: duplicada, sin_foto, precio_bajo, km_imposible, no_es_coche, danada. Vacio cuando visible.';
COMMENT ON COLUMN moveadvisor_market_offers.visible_desde IS
  'Cuando se tomo la decision. Sirve para ver si el recalculo lleva dias sin pasar.';
COMMENT ON COLUMN moveadvisor_market_offers.visible_a_mano IS
  'Alguien lo decidio a mano. El recalculo automatico no lo toca.';

/*
 * El indice es parcial: al buscador solo le interesa lo visible, y esa es la
 * mitad larga de la tabla. Un indice sobre la columna entera ocuparia el doble
 * para responder lo mismo.
 */
CREATE INDEX IF NOT EXISTS idx_market_offers_visibles
  ON moveadvisor_market_offers (portal, brand, model)
  WHERE visible AND is_active;
