-- Recordarle que conteste si se lo queda.
--
-- Al acabar la visita se le manda «¿Te lo quedas?» con sus tres salidas, y ahi
-- se acababa: `followup_sent_at` impide repetirlo, asi que quien lo lee con el
-- movil en la mano y decide manana ya no tiene quien se lo recuerde. Y la
-- ventana para contestar es de catorce dias —«quiero comprarlo» deja de
-- funcionar pasados—, con lo que el unico aviso caia en la primera hora de
-- catorce dias.
--
-- Mientras tanto, quien vende se queda sin saber si aquel comprador sigue
-- interesado, y el coche esperando a una respuesta que nadie ha vuelto a pedir.
--
-- Esta columna es la marca del segundo aviso, a las 48 horas. No hay un tercero
-- a proposito: dos correos por una visita son un recordatorio, tres son
-- perseguir a alguien, y quien no contesta dos veces ya ha contestado.

ALTER TABLE vehicle_visit_bookings
  ADD COLUMN IF NOT EXISTS recordatorio_resultado_at TIMESTAMPTZ,
  -- Y las dos de las visitas que se quedan colgadas sin confirmar: al vendedor
  -- que no contesta a quien quiere ver su coche, y al comprador que no elige
  -- entre las horas que le propusieron. Una cada una, y solo una.
  ADD COLUMN IF NOT EXISTS recordatorio_vendedor_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recordatorio_horas_at TIMESTAMPTZ;

-- Las colgadas se buscan por estado y fecha de inicio.
CREATE INDEX IF NOT EXISTS idx_visit_bookings_pendientes
  ON vehicle_visit_bookings (starts_at)
  WHERE status = 'pending';
