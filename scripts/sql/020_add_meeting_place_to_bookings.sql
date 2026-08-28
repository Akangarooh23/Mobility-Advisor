-- Donde es la visita y por quien hay que preguntar.
--
-- Una cita confirmada sin direccion no sirve: el cliente sabe el dia y la hora
-- pero no adonde ir. Y llegar preguntando por nadie, en un concesionario con
-- diez personas en la sala, es la otra mitad del problema.
--
-- Los leads ya guardaban estos dos datos —appointment_address y
-- appointment_contact— y sus recordatorios ya los pintan. Las reservas del
-- calendario no los tenian, asi que sus correos salian con esas dos filas
-- vacias.
--
-- Se rellenan al confirmar, que es cuando el trabajador acaba de hablar con el
-- concesionario y los tiene delante.

ALTER TABLE vehicle_visit_bookings
  ADD COLUMN IF NOT EXISTS meeting_place   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meeting_contact TEXT NOT NULL DEFAULT '';
