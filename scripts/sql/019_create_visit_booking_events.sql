-- El rastro de una visita: que se hizo, quien y cuando.
--
-- Hasta ahora una reserva solo tenia estado —pendiente, confirmada, cancelada—
-- y el estado no cuenta la historia. Quien abria una cita no podia saber si ya
-- se habia llamado al concesionario, si el cliente habia contestado, ni si al
-- concesionario se le habia avisado de que el cliente va a ir. Eso vivia en la
-- cabeza de quien lo hizo.
--
-- Cada paso deja una fila. El estado sigue siendo el de la reserva: esto no lo
-- sustituye, lo explica.
--
-- No se borra ninguna fila nunca. Un rastro del que se pueden quitar lineas
-- deja de servir para saber que paso.

CREATE TABLE IF NOT EXISTS visit_booking_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES vehicle_visit_bookings(id) ON DELETE CASCADE,
  -- Que paso. Los valores estan en lib/citas.js, no en un CHECK: la lista va a
  -- crecer y una migracion por cada paso nuevo es peor que una lista en codigo.
  evento      TEXT NOT NULL,
  -- Quien lo hizo: el correo del trabajador, 'cliente' o 'sistema'.
  actor       TEXT NOT NULL DEFAULT 'sistema',
  -- Lo que haga falta guardar del paso: las horas que propuso el concesionario,
  -- el motivo de una cancelacion, el texto que contesto el cliente.
  datos       JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Se lee siempre por reserva y en orden.
CREATE INDEX IF NOT EXISTS idx_visit_booking_events_reserva
  ON visit_booking_events (booking_id, created_at);
