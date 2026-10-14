-- El índice de la 0024 se creó inválido, y el aplicador lo dio por bueno.
--
-- La 0024 salió con un `✓ (203 ms)`. Construir un índice sobre 2,6 millones
-- de filas no son 203 ms, y en efecto no se construyó: quedó marcado como
-- INVÁLIDO —existiendo, con 0 bytes y sin usarlo nadie—. Y como su segunda
-- sentencia sí tiró el índice viejo, la tabla se quedó sin ninguno de los dos.
--
-- ── Por qué pasó ───────────────────────────────────────────────────────────
--
-- `DATABASE_URL` apunta al punto `-pooler` de Neon, que es un PgBouncer en
-- modo transacción. Reparte las consultas entre sesiones compartidas, que es
-- justo lo que una web necesita.
--
-- Pero `CREATE INDEX CONCURRENTLY` se construye en VARIAS transacciones de la
-- MISMA sesión, esperando entre ellas a que terminen las que estaban abiertas.
-- Con el pooler cada una puede caer en una sesión distinta, así que el proceso
-- no llega a completarse. Y no da error: Postgres contesta que sí y deja el
-- índice inválido. Un fallo que se anuncia como éxito.
--
-- Ya está arreglado donde tenía que estarlo: el aplicador se conecta al punto
-- directo —sin `-pooler`— y, antes de apuntar una migración como aplicada,
-- comprueba que no haya quedado ningún índice inválido.
--
-- ── Por qué un fichero nuevo y no editar la 0024 ───────────────────────────
--
-- Porque la 0024 está apuntada como aplicada, y editar una migración ya
-- aplicada es exactamente lo que el aplicador vigila: lo que corre en
-- producción dejaría de ser lo que pone el fichero. Las migraciones solo se
-- añaden. Lo que se arregla con una migración se arregla con otra migración.
--
-- ── El orden importa ───────────────────────────────────────────────────────
--
-- Primero tirar el inválido y después crearlo. Al revés no haría nada: el
-- `IF NOT EXISTS` vería que ya existe uno con ese nombre —el roto— y lo daría
-- por hecho, que es cómo estos fallos se vuelven permanentes y silenciosos.

DROP INDEX CONCURRENTLY IF EXISTS ix_market_offers_portal_cubre;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_market_offers_portal_cubre
  ON moveadvisor_market_offers (portal)
  INCLUDE (is_active, country, price, last_checked_at);
