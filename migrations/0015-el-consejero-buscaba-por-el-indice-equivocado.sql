-- El consejero entraba por el índice del combustible y descartaba 27.146 filas
--
-- ## Lo que pasaba, con el plan delante
--
-- Con un perfil de SUV diésel premium alemán en Madrid, hasta 30.000 € y
-- 150.000 km, contar lo que cumple tardaba 56 segundos. El plan:
--
--     Index Scan using ix_mmo_activas_combustible
--       Index Cond: lower(COALESCE(fuel,'')) = ANY ('{diesel}')
--       Filter: precio, año, kilómetros, potencia, foto, PROVINCIA, marca,
--               carrocería... (doce filtros más)
--       Rows Removed by Filter: 27.146
--       Buffers: read=16.801 dirtied=15.929 written=15.318
--
-- Entraba por el combustible —el criterio menos selectivo que tenía índice— y
-- lo demás lo comprobaba a mano fila por fila. Y lo caro no era leer: era
-- ESCRIBIR. 15.318 páginas por consulta, 122 MB, porque cada lectura tiene que
-- asentar páginas que la carga masiva dejó sucias.
--
-- Había un índice de provincia, pero suelto: el planificador no combina dos
-- índices parciales aquí, así que elegía uno y descartaba con el resto.
--
-- ## Lo que hace este índice
--
-- Provincia y combustible juntos, con el precio detrás para que el rango
-- también entre en el índice. Es la forma exacta con la que busca el
-- consejero: el test pregunta de qué provincia lo quiere, qué motorización y
-- cuánto se quiere gastar.
--
-- Medido después, mismo perfil y misma consulta:
--
--     antes   56,2 s   ·  written=15.318
--     después  0,5 s   ·  written=5.157
--
-- Y de punta a punta, con el análisis y la búsqueda de ofertas completos:
--
--     Valencia   67 s -> 11 s
--     Madrid    122 s -> 25 s
--     Sevilla    28 s -> 26 s
--
-- ## Lo que NO arregla, dicho claro
--
-- A quien contesta «me da igual la provincia» no le sirve: sin provincia el
-- índice no se puede usar y esa búsqueda sigue en unos sesenta segundos. Y la
-- deuda de limpieza sigue ahí —301.507 registros muertos— solo que ahora se
-- tocan muchas menos páginas, así que se nota menos.
--
-- ## Por qué CONCURRENTLY
--
-- Porque la tabla la está escribiendo el scraper todo el rato y un índice
-- normal la bloquea mientras se construye. Tardó 142 segundos y ocupa 77 MB.
--
-- Y por qué se comprueba `indisvalid`: un intento anterior en este proyecto
-- dejó un índice inválido de 0 bytes, y `IF NOT EXISTS` lo daba por hecho.

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_mmo_activas_provincia_combustible
  ON moveadvisor_market_offers (
    lower(COALESCE(province, '')),
    lower(COALESCE(fuel, '')),
    price
  )
  WHERE COALESCE(is_active, true) = true;

-- Comprobación: tiene que decir que es válido. Si sale `f`, el índice se quedó
-- a medias y hay que borrarlo y repetirlo, porque así no lo usa nadie.
--
--   SELECT indisvalid FROM pg_index
--    WHERE indexrelid = 'ix_mmo_activas_provincia_combustible'::regclass;
