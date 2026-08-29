-- Dos datos que faltaban en un expediente de importacion.
--
-- 1. Si la fianza esta cobrada.
--
--    Se guardaba lo que se le dijo —`deposit_quoted`— pero no si lo ha pagado.
--    Y ese es el paso que separa «una persona interesada» de «un coche que
--    vamos a comprar en Alemania»: hasta que no esta, no se compra nada.
--
--    Se guarda cuando se cobro, no un si/no: la fecha responde a las dos
--    preguntas y ademas dice cuanto lleva esperando quien puso el dinero.
--
-- 2. Cuando le hemos dicho que lo tendra.
--
--    Es la primera pregunta del cliente y la que mas veces repite. Sin un sitio
--    donde ponerla, la fecha vive en la cabeza de quien llamo, y cuando cambia
--    —que cambia— no hay forma de avisarle porque nadie sabe que se le dijo.
--
--    Es una estimacion y hay que tratarla como tal: se guarda para poder
--    contarle los cambios, no para prometer un dia exacto.

ALTER TABLE moveadvisor_market_leads
  ADD COLUMN IF NOT EXISTS deposit_paid_at   TIMESTAMPTZ;

ALTER TABLE moveadvisor_market_leads
  ADD COLUMN IF NOT EXISTS delivery_estimate DATE;

COMMENT ON COLUMN moveadvisor_market_leads.deposit_paid_at IS
  'Cuando se cobro la fianza de una importacion. Nulo mientras no este pagada.';
COMMENT ON COLUMN moveadvisor_market_leads.delivery_estimate IS
  'Fecha estimada de entrega que se le ha dicho al cliente. Estimacion, no promesa.';
