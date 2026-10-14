-- El índice de la 0024 no arreglaba nada. Se deshace.
--
-- La idea era: la consulta de Portales necesita `is_active`, `country`,
-- `price` y `last_checked_at` además de `portal`, así que metiéndolas DENTRO
-- del índice no haría falta salir de él -125 MB en vez de 4,4 GB- y el
-- recorrido de la tabla entera desaparecería.
--
-- Medido el 14-oct-2026, con el índice ya construido y válido: el
-- planificador siguió sin usarlo. Y forzándolo a usarlo, la misma consulta
-- pasó de 21 segundos a 162. Tenía razón él.
--
-- ── Por qué no servía ──────────────────────────────────────────────────────
--
-- Un índice que lo cubre todo solo vale si se puede leer SIN tocar la tabla, y
-- para eso Postgres necesita saber que esas filas son visibles para todos. Eso
-- lo dice el mapa de visibilidad, y en esta tabla solo el **45 %** de las
-- páginas lo están: la escriben los rastreadores a todas horas.
--
-- Así que el 55 % restante hay que ir a buscarlo a la tabla de todas formas,
-- fila a fila y en desorden. El plan lo deja por escrito: 1.413.286 visitas a
-- la tabla. Leer 4,4 GB de corrido sale más barato que dar millón y medio de
-- saltos, y por eso el recorrido completo gana.
--
-- Y aunque funcionara, no era el arreglo: esta consulta cuenta TODAS las
-- filas. No hay índice que evite leerlas; lo que hay que evitar es tener que
-- contarlas cuando alguien abre la pantalla. Eso se arregla guardando el
-- resultado, no indexando mejor.
--
-- ── Qué se deja ────────────────────────────────────────────────────────────
--
-- El índice simple que había antes, tal cual estaba en la 0001. No es para
-- Portales -ahí no se usa- sino para las consultas que SÍ filtran por un
-- portal concreto, que las hay en `inventoryStore.js` y en media docena de
-- guiones de mantenimiento.
--
-- Vuelve a costar unos 30 MB en vez de 125, y una tabla que recibe ofertas
-- nuevas todo el día paga cada índice en cada fila que entra.

DROP INDEX CONCURRENTLY IF EXISTS ix_market_offers_portal_cubre;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_market_offers_portal
  ON moveadvisor_market_offers USING btree (portal);
