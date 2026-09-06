-- ============================================================================
--  El texto del anuncio, aparte de la oferta
--  2026-09-06
-- ============================================================================
--
--  Los portales dan menos datos estructurados de los que parece, y lo que falta
--  suele estar escrito en la descripcion. Milanuncios manda tres etiquetas
--  -kilometros, año y combustible- y nada mas: ni potencia, ni cambio, ni
--  carroceria. Todo eso esta en una descripcion de 1.296 caracteres de media que
--  viene en el 100% de los anuncios, y de la que se puede sacar el cambio en el
--  48% y el color en el 10%.
--
--  Hasta hoy esa descripcion se leia y se tiraba, porque no habia donde ponerla.
--
--  ── Por que una tabla y no una columna ─────────────────────────────────────
--
--   1. `moveadvisor_market_offers` pesa 2,6 GB. Las descripciones de las 536.659
--      ofertas activas son ~524 MB: un 20% mas en la tabla que consultan la web
--      y la tasacion, para un texto que ninguna de las dos lee.
--
--   2. `raw_payload` no vale: lo vacia el trigger trg_drop_raw_payload, puesto a
--      proposito despues de que Flexicar metiera ahi el JSON entero del vehiculo
--      y el SQL se fuera a 285 KB por pagina hasta quedarse el runner sin
--      memoria. Ese trigger es una defensa, no un estorbo.
--
--   3. Separada se puede vaciar entera sin tocar las ofertas. Si algun dia sobra
--      -o crece mas de lo previsto- es un TRUNCATE y nada mas se entera.
--
--  ── Para que sirve ─────────────────────────────────────────────────────────
--
--  Para que los enriquecedores puedan RELEER. Hoy, si se mejora una expresion
--  regular, hay que esperar a que el scraper vuelva a pasar por la oferta: en
--  Milanuncios son 68 dias. Con el texto guardado, mejorar una expresion y
--  volver a aplicarla al catalogo entero cuesta una consulta.
--
--  Eso importa especialmente donde raspar es caro. Milanuncios bloquea por
--  comportamiento, asi que cada pagina que se trae hay que exprimirla; y sus
--  fichas de detalle estan detras de Imperva y devuelven la pagina de desafio
--  con un HTTP 200, o sea que no hay segunda oportunidad de ir a mirar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS moveadvisor_offer_texts (
  -- El id de la oferta, tal cual: 'mil_612690753', 'wp_9jdw93g3446k'.
  offer_id      TEXT PRIMARY KEY,

  -- Redundante con la oferta a proposito: permite limpiar o contar por portal
  -- sin unir con una tabla de 800.000 filas.
  portal        TEXT NOT NULL,

  -- El texto tal como lo publico el vendedor. Los scrapers lo recortan a 8.000
  -- caracteres: por encima de eso no hay dato util, solo listas de extras.
  descripcion   TEXT NOT NULL,

  capturado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "Dame los textos de este portal", que es como los leen los enriquecedores.
CREATE INDEX IF NOT EXISTS ix_offer_texts_portal
  ON moveadvisor_offer_texts (portal);

-- Sin FOREIGN KEY, por lo mismo que la tabla de duplicados: un ON DELETE CASCADE
-- se llevaria filas por delante sin dejar rastro si un scraper borrara una
-- oferta. La limpieza se hace a proposito y a mano:
--
--   DELETE FROM moveadvisor_offer_texts t
--   WHERE NOT EXISTS (SELECT 1 FROM moveadvisor_market_offers o
--                     WHERE o.id = t.offer_id AND COALESCE(o.is_active, TRUE));
--
-- Eso acota la tabla a las ofertas vivas, que hoy son 536.659 de 798.547.

-- ============================================================================
--  Para deshacerla:  DROP TABLE moveadvisor_offer_texts;
-- ============================================================================
