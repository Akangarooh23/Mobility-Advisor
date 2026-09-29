-- Las cinco columnas de campaña en la solicitud de visita.
--
-- ── Cómo apareció esto ─────────────────────────────────────────────────────
--
-- Quitando el `CREATE TABLE` y el `ALTER TABLE` que `lib/solicitud-de-visita.js`
-- ejecutaba dentro de la petición. Antes de quitar nada se comprobó, columna a
-- columna, que todo lo que el código creaba en caliente estuviera declarado en
-- `migrations/`. Salió limpio: 145 columnas, ninguna suelta.
--
-- Pero la comprobación no las veía todas. Estas cinco no se escriben enteras en
-- el código, se generan:
--
--     const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
--
--     ALTER TABLE vehicle_visit_requests
--       ${UTM.map((c) => `ADD COLUMN IF NOT EXISTS ${c} VARCHAR(255) ...`).join(',')}
--
-- Al buscar `ADD COLUMN IF NOT EXISTS <nombre>` en el fuente, ahí no hay ningún
-- nombre: hay un `${c}`. Así que pasaron por debajo de la red.
--
-- Contra la base de producción sí se ven, y dicen lo que pasaba:
--
--   · `vehicle_visit_bookings` las tiene las cinco, y las declara la migración
--     base `0001`;
--   · `vehicle_visit_requests` **no tiene ninguna**, porque esa tabla se creó de
--     cero con la migración `0013` y el CREATE que se copió allí tampoco las
--     lleva: las añadía el ALTER de al lado.
--
-- Es decir: quitar ese ALTER sin esto habría dejado la solicitud de visita sin
-- saber de dónde vino quien la pidió, y sin que fallara nada — la consulta que
-- las escribe habría reventado la primera vez, que es justo el tipo de avería
-- que no se ve hasta que la sufre un cliente.
--
-- ── Para qué sirven ────────────────────────────────────────────────────────
--
-- Para saber qué campaña trajo a quien pide ver un coche. Van con DEFAULT ''
-- y NOT NULL como sus gemelas de `vehicle_visit_bookings`, para que las dos
-- tablas se lean igual y una solicitud vieja no salga con nulos.

ALTER TABLE vehicle_visit_requests
  ADD COLUMN IF NOT EXISTS utm_source   VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_medium   VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_content  VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_term     VARCHAR(255) NOT NULL DEFAULT '';
