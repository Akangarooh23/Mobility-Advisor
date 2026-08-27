-- Recordatorios para las visitas reservadas desde el marketplace.
--
-- Habia dos sistemas de visitas en paralelo: las citas que pone un trabajador
-- en un lead —moveadvisor_market_leads, con sus tres marcas de aviso— y las que
-- reserva el cliente con el calendario, que viven aqui. El cron de las 08:00
-- solo miraba la primera tabla, asi que quien reservaba desde el marketplace no
-- recibia ni el aviso de la vispera, ni el del dia, ni el de despues.
--
-- Estas tres columnas son las mismas que ya tiene la tabla de leads, para que el
-- cron pueda recorrer las dos fuentes con la misma logica: se apunta cuando se
-- mando cada aviso, y esa marca es la que impide mandarlo dos veces.

ALTER TABLE vehicle_visit_bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_day_of_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_sent_at        TIMESTAMPTZ;

-- El cron busca por fecha y estado; sin esto acaba leyendo la tabla entera.
CREATE INDEX IF NOT EXISTS idx_visit_bookings_recordatorios
  ON vehicle_visit_bookings (starts_at)
  WHERE status = 'confirmed';
