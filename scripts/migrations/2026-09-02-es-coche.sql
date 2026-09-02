-- ============================================================================
--  Qué anuncios de la categoría "coches" no son un coche
--  2026-09-02
-- ============================================================================
--
--  La categoría 100 de Wallapop se llama "Coches" y no solo trae coches. En la
--  base hay 126 autocaravanas guardadas como turismos —Benimar, McLouis,
--  Challenger, Adria— con precios de 55.000 a 85.000 €, y comprobando una
--  muestra salieron además una moto y un recambio de 180 €.
--
--  En el buscador son indistinguibles: mismo category_id, misma taxonomía,
--  mismos atributos. El scraper no puede filtrarlas con lo que recibe.
--
--  ── La regla ───────────────────────────────────────────────────────────────
--
--  Quien sí las distingue es la ficha: si no trae NI carrocería NI cambio, no
--  es un coche. Por separado no valen —el 11% de los coches reales no tiene
--  carrocería—, pero juntas no fallaron: sobre 247 fichas marcó 11, y las 11
--  eran ocho autocaravanas, una moto y un recambio. Ningún coche mal marcado.
--  Es el 4% del catálogo de Wallapop.
--
--  ── Por qué una columna y no is_active ─────────────────────────────────────
--
--  Lo obvio sería darlas de baja, y no se puede: el verificador pasa cada día,
--  ve que el anuncio existe, y las volvería a activar. Los dos se pelearían
--  indefinidamente. Y además sería mentira: el anuncio está vivo, lo que pasa
--  es que no es un coche.
--
--  ── Y la objeción, que conviene dejar escrita ──────────────────────────────
--
--  La migración de duplicados (2026-08-14) descartó añadir columnas a esta
--  tabla por buenas razones, y dos aplican aquí: los scrapers son dueños de
--  `moveadvisor_market_offers`, y esto es una inferencia nuestra, no un dato
--  del portal. Se acepta el riesgo porque la razón de más peso de aquel texto
--  —reescribir 600.000 filas cada noche— aquí no aplica: esto lo escribe el
--  enriquecedor una vez por oferta, junto a las columnas que ya toca.
--
--  Si la regla mejora y hay que remarcar todo, se pone la columna a NULL y la
--  vuelven a rellenar los enriquecedores en su siguiente vuelta.
-- ============================================================================

-- NULL a propósito, y sin DEFAULT: NULL significa "no lo hemos mirado", que es
-- la verdad para los otros diez portales. Poner TRUE por defecto afirmaría algo
-- que nadie ha comprobado, y en 791.906 ofertas.
--
-- Quien consulte usa COALESCE(es_coche, TRUE), igual que ya se hace con
-- is_active: lo no evaluado se trata como coche, que es lo que era hasta hoy.
ALTER TABLE moveadvisor_market_offers
  ADD COLUMN IF NOT EXISTS es_coche BOOLEAN;

COMMENT ON COLUMN moveadvisor_market_offers.es_coche IS
  'Inferencia propia: FALSE si la ficha del portal no trae ni carroceria ni cambio '
  '(autocaravanas, motos, recambios colados en la categoria de coches). '
  'NULL = no evaluado. Consultar siempre con COALESCE(es_coche, TRUE).';

-- Índice parcial y no completo: los FALSE son el 4%, así que ocupa poco y sirve
-- para la única pregunta que se va a hacer, "enséñame lo que no es un coche".
-- Un índice sobre toda la columna costaría lo mismo que la tabla para responder
-- lo que ya responde un recorrido secuencial.
CREATE INDEX IF NOT EXISTS ix_offers_no_es_coche
  ON moveadvisor_market_offers (portal)
  WHERE es_coche IS FALSE;

-- ── Relleno inicial ────────────────────────────────────────────────────────
--
-- Un anuncio con carrocería o con cambio ya demostró ser un coche: eso lo puso
-- el enriquecedor leyendo la ficha, no una suposición nuestra. Se marcan TRUE.
--
-- Los que no tienen ninguna de las dos se quedan en NULL en vez de marcarse
-- FALSE, porque no se distingue "la ficha dice que no tiene" de "todavía no ha
-- pasado el enriquecedor". Los irá marcando él según los visite.
UPDATE moveadvisor_market_offers
SET es_coche = TRUE
WHERE es_coche IS NULL
  AND (COALESCE(body_type, '') <> '' OR COALESCE(transmission, '') <> '');

-- ============================================================================
--  Para deshacerla:
--    DROP INDEX IF EXISTS ix_offers_no_es_coche;
--    ALTER TABLE moveadvisor_market_offers DROP COLUMN IF EXISTS es_coche;
-- ============================================================================
