-- La fianza que se le dijo al cliente en una solicitud de importacion.
--
-- Al pedir un coche de importacion se le manda un correo con la cifra: el 30%
-- del precio mas el coste de traerlo. Esa cifra se calculaba al vuelo y no se
-- guardaba en ninguna parte.
--
-- Dos problemas, y el segundo es el gordo:
--
--   · Quien atiende el lead en el ERP no ve lo que se le prometio.
--   · El precio de la oferta puede cambiar —o la oferta puede dejar de estar
--     publicada—, y entonces ya no hay forma de saber que numero se le dio.
--     Con 1.568 ofertas publicadas y una fianza media de unos 2.200 euros, eso
--     es una discusion con un cliente que no se puede ganar.
--
-- Se guarda lo que se dijo, no lo que se calcularia hoy: es un dato historico,
-- como el importe de una factura.

ALTER TABLE moveadvisor_market_leads
  ADD COLUMN IF NOT EXISTS deposit_quoted NUMERIC(10,2);

COMMENT ON COLUMN moveadvisor_market_leads.deposit_quoted IS
  'La fianza que se le dijo al cliente al pedir la importacion. Historico: no se recalcula.';
