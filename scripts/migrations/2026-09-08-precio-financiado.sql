-- El precio que anuncia Modrive no es el que se paga al contado.
--
-- El JSON-LD de sus fichas publica como `price` el precio de FINANCIAR SIN
-- ENTRADA. La ficha los enseña separados:
--
--     Precio al contado                        17.500 €
--     Financia sin entrada                     16.000 €
--     Descuento por financiar sin entrada      -1.500 €
--
-- Se miraron 12 fichas al azar el 2026-09-08 y en las 12 el precio guardado era
-- el financiado, entre 1.000 y 2.862 € por debajo del de contado (mediana
-- 2.000 €). O sea que el escaparate enseñaba las 1.988 ofertas de Modrive más
-- baratas de lo que cuestan, y contra Gamboa, VIAN, Wallapop y Milanuncios, que
-- publican precio de venta sin condiciones.
--
-- A partir de aquí `price` es el precio al contado -el comparable, el que ve el
-- cliente- y el financiado se guarda en esta columna, que no se pierde: es un
-- dato real del anuncio y sirve para enseñar «desde X € financiando».

ALTER TABLE moveadvisor_marketplace_vo_offers
  ADD COLUMN IF NOT EXISTS price_financed numeric;

COMMENT ON COLUMN moveadvisor_marketplace_vo_offers.price_financed IS
  'Precio si se financia con las condiciones del portal (Modrive: sin entrada). '
  'NULL si el portal no ofrece un precio distinto al de contado. '
  'El precio comparable, el que ordena y filtra el escaparate, es price.';
