-- Dos trampas de la tabla de visitas, cerradas.
--
-- 1. Borrar un hueco borraba las visitas que colgaban de el.
--
--    La clave ajena estaba en ON DELETE CASCADE. Hoy no llega a pasar porque
--    las dos rutas que borran solo tocan huecos libres, pero eso es una
--    salvaguarda escrita en dos sitios del codigo: el dia que alguien anada una
--    tercera, o limpie a mano, se lleva por delante citas de gente.
--
--    Una visita no es un detalle de su hueco. Ahora el hueco puede irse y la
--    visita se queda, sin hueco: es exactamente lo que ha pasado, y se puede
--    contar. Por eso `availability_id` pasa a admitir nulo.
--
--    Las consultas que lo unian con un JOIN normal pasan a LEFT JOIN en el mismo
--    cambio; con INNER, una visita sin hueco desapareceria de la Agenda, que es
--    la otra forma de perderla.
--
-- 2. El estado por defecto era 'confirmed'.
--
--    Toda visita nace pendiente: que una hora este publicada no significa que el
--    concesionario haya dicho que si a esa visita. Hoy el unico sitio que
--    inserta lo pone a mano, pero el valor por defecto es una trampa esperando a
--    la siguiente linea de codigo que se olvide, y esa nacera confirmada sin que
--    nadie la haya aprobado.
--
--    Sin valor por defecto y con NOT NULL, olvidarse deja de ser posible: la
--    insercion falla en vez de mentir.

ALTER TABLE vehicle_visit_bookings ALTER COLUMN availability_id DROP NOT NULL;

ALTER TABLE vehicle_visit_bookings
  DROP CONSTRAINT IF EXISTS vehicle_visit_bookings_availability_id_fkey;

ALTER TABLE vehicle_visit_bookings
  ADD CONSTRAINT vehicle_visit_bookings_availability_id_fkey
  FOREIGN KEY (availability_id) REFERENCES vehicle_visit_availability(id)
  ON DELETE SET NULL;

ALTER TABLE vehicle_visit_bookings ALTER COLUMN status DROP DEFAULT;
