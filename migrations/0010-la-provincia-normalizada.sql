-- La provincia, en una de las 52 y no en tres mil formas.
--
-- `province` la rellena cada scraper con lo que trae su portal, y en las
-- 1.582.783 ofertas vivas eso son 3.461 valores distintos. Solo bajando a
-- minúsculas y quitando tildes se quedan en 2.591: la mitad del desorden es
-- «MADRID» conviviendo con «Madrid». El resto son municipios metidos entre las
-- provincias -«LAS ROZAS», «SANT ANDREU», «PATERNA»- y nombres invertidos al
-- estilo de un catálogo alfabético: «Coruña, A», «Palmas, Las».
--
-- El consejero filtra con LIKE sobre esa columna, así que quien busca «Madrid»
-- y quien busca «madrid capital» reciben cosas distintas y nada lo avisa.
--
-- ── Por qué una columna nueva y no machacar la que hay ──────────────────────
--
-- Porque son dos cosas distintas. `province` es lo que dice el portal: un
-- hecho, aunque venga sucio, y a veces trae el municipio, que es información
-- que no está en ningún otro sitio. `provincia` es nuestra interpretación.
--
-- Mezclarlas haría el cambio irreversible: «Las Rozas» pasaría a ser «Madrid»
-- y el municipio se perdería para siempre. Y cualquier consulta que hoy use el
-- valor crudo cambiaría de comportamiento sin que nadie lo note.
--
-- Es la misma razón por la que `visible` va aparte de `is_active`.
--
-- ── Lo que NO se rellena ────────────────────────────────────────────────────
--
-- Lo que no se reconoce se queda en NULL, a propósito. En España hay 8.131
-- municipios y en los datos salen unos 2.700 valores distintos en la cola
-- larga, con treinta o cuarenta filas cada uno. Meterlos todos sería un
-- callejero; asignarlos a ojo sería inventarse dónde está un coche.

ALTER TABLE moveadvisor_market_offers
  ADD COLUMN IF NOT EXISTS provincia varchar(40);

COMMENT ON COLUMN moveadvisor_market_offers.provincia IS
  'Una de las 52 provincias, normalizada desde province por lib/las-provincias.js. NULL = no se ha podido reconocer, y eso es una respuesta valida.';

/*
 * Índice para el filtro del buscador. Solo sobre lo visible y activo, que es
 * lo único que se filtra por provincia: un índice sobre la columna entera
 * ocuparía el doble para responder lo mismo.
 */
CREATE INDEX IF NOT EXISTS idx_market_offers_provincia
  ON moveadvisor_market_offers (provincia)
  WHERE is_active AND provincia IS NOT NULL;
