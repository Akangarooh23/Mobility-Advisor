-- Devolver la fianza de una importacion.
--
-- La fianza se devuelve si al final no se hace el pedido, asi que hay que poder
-- deshacer un cobro y que quede escrito. Tres datos:
--
--   · `deposit_payment_ref`  el pago en Stripe. Sin esto no se puede devolver:
--     no habria a que cargo aplicar la devolucion. Se guarda al cobrarla.
--   · `deposit_refunded_at`  cuando se devolvio. Nulo mientras no se devuelva.
--   · `deposit_refund_ref`   la devolucion en Stripe, para poder cuadrarla con
--     su extracto sin buscar a mano.
--
-- No se borra el cobro ni se pone la fianza a cero: lo que paso, paso. Un
-- expediente cuenta lo que ocurrio, y aqui ocurrieron dos cosas —se cobro y se
-- devolvio—, cada una con su fecha y su factura.

ALTER TABLE moveadvisor_market_leads
  ADD COLUMN IF NOT EXISTS deposit_payment_ref TEXT;

ALTER TABLE moveadvisor_market_leads
  ADD COLUMN IF NOT EXISTS deposit_refunded_at TIMESTAMPTZ;

ALTER TABLE moveadvisor_market_leads
  ADD COLUMN IF NOT EXISTS deposit_refund_ref  TEXT;

COMMENT ON COLUMN moveadvisor_market_leads.deposit_payment_ref IS
  'El cobro de la fianza en Stripe (payment_intent). Sin el no se puede devolver.';
COMMENT ON COLUMN moveadvisor_market_leads.deposit_refunded_at IS
  'Cuando se devolvio la fianza. Nulo si no se ha devuelto.';
COMMENT ON COLUMN moveadvisor_market_leads.deposit_refund_ref IS
  'La devolucion en Stripe, para cuadrarla con el extracto.';
