-- La pantalla de portales recorría 4,4 GB para contar once filas.
--
-- «No se pudo cargar el análisis», medido el 13-oct-2026: la consulta que la
-- alimenta tarda entre 72 y 113 segundos -tres vueltas, no fue la caché- y la
-- función de Vercel se corta a los 30. La pantalla no llegaba a recibir nada.
--
-- Y de paso se llevaba por delante la tarea nocturna. En `/cron/kpis` esta
-- consulta va la primera, así que se gastaba el presupuesto entero y la
-- segunda -el precio contra el mercado- no llegaba a ejecutarse: su número
-- llevaba desde el 22 de septiembre sin moverse, y nadie lo sabía porque un
-- número viejo se ve igual que uno nuevo.
--
-- ── Por qué recorría la tabla entera ───────────────────────────────────────
--
-- Hay un índice por portal, pero la consulta necesita además `is_active`,
-- `country`, `price` y `last_checked_at`. Con el índice solo se sabe en qué
-- grupo cae cada fila; para lo demás hay que ir a buscarla al montón, 2,6
-- millones de veces, así que el planificador hace lo sensato: recorrerlo todo.
--
-- Con esas cuatro columnas DENTRO del índice ya no hace falta salir de él:
-- unos 150 MB en vez de 4,4 GB.
--
-- ── Por qué sustituye al que había y no se suma ────────────────────────────
--
-- Esta tabla ya tiene treinta índices y 2,4 GB de ellos, y la escriben los
-- rastreadores a todas horas: cada índice de más se paga en cada oferta que
-- entra. El nuevo tiene la misma clave que `ix_market_offers_portal`, así que
-- sirve para todo lo que servía aquél —filtrar por portal— y el viejo sobra.
--
-- Los dos CONCURRENTLY: la tabla se escribe mientras tanto y no se puede
-- bloquear. Eso los deja fuera de transacción, así que si el segundo fallara
-- quedaría el índice nuevo puesto y el viejo también: de más, nunca de menos.

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_market_offers_portal_cubre
  ON moveadvisor_market_offers (portal)
  INCLUDE (is_active, country, price, last_checked_at);

DROP INDEX CONCURRENTLY IF EXISTS ix_market_offers_portal;
