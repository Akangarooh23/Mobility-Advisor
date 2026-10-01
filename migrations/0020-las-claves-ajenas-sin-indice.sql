-- Las claves ajenas que nadie había indexado, y por qué ahora es gratis
--
-- Postgres indexa sola la columna a la que **apunta** una clave ajena —es la clave
-- primaria de la otra tabla— pero **no** la columna que apunta. Y ahí hacen falta
-- dos veces:
--
--  1. **Al borrar el padre.** Con `ON DELETE CASCADE`, borrar un coche obliga a
--     Postgres a buscar sus hijos en cada tabla que lo referencia. Sin índice eso
--     es un recorrido entero de la tabla, una por cada hija. Borrar un coche con
--     seis hijas sin índice son seis recorridos.
--  2. **En la consulta natural.** «Las citas de este coche», «los seguros de este
--     coche»: todas filtran por esa misma columna.
--
-- ── Por qué ahora ──────────────────────────────────────────────────────────────
--
-- Porque hoy es gratis. Las tablas tienen entre 0 y 9 filas, así que crear los
-- índices es instantáneo y no hay que bloquear nada. Con tráfico habría que usar
-- `CONCURRENTLY` y pensar en el momento del día; ahora no.
--
-- Y porque cuesta más tarde: un índice sobre una tabla con millones de filas se
-- paga al crearlo y en cada escritura posterior. Estos son siete índices sobre
-- tablas vacías que empiezan a trabajar el día que haya datos.
--
-- ── Lo que NO entra aquí ───────────────────────────────────────────────────────
--
-- Falta una octava: `erp_tickets.user_id -> erp_users`. Es una tabla del ERP, y
-- ponerle el índice desde aquí sería repetir el problema que ya tiene esta base
-- —dos repositorios declarando lo mismo, ver docs/lo-que-cambiaria.md §19.1—. Esa
-- va en `apps/api/src/db/schema.ts` del otro lado.

CREATE INDEX IF NOT EXISTS ix_user_appointments_vehicle_id
  ON moveadvisor_user_appointments (vehicle_id);

CREATE INDEX IF NOT EXISTS ix_user_insurances_vehicle_id
  ON moveadvisor_user_insurances (vehicle_id);

CREATE INDEX IF NOT EXISTS ix_user_maintenances_vehicle_id
  ON moveadvisor_user_maintenances (vehicle_id);

CREATE INDEX IF NOT EXISTS ix_user_saved_offers_vehicle_id
  ON moveadvisor_user_saved_offers (vehicle_id);

CREATE INDEX IF NOT EXISTS ix_user_vehicle_states_vehicle_id
  ON moveadvisor_user_vehicle_states (vehicle_id);

CREATE INDEX IF NOT EXISTS ix_visit_bookings_availability_id
  ON vehicle_visit_bookings (availability_id);

CREATE INDEX IF NOT EXISTS ix_whatsapp_leads_pre_cliente_id
  ON whatsapp_leads (pre_cliente_id);
