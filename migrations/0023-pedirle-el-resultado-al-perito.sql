-- Pedirle el resultado a quien fue a ver el coche.
--
-- La peritación se confirma, se recuerda el día antes… y ahí se acaba. Pasada
-- la hora no vuelve a moverse nada: ni al cliente, que sigue leyendo
-- «Confirmada · lunes 5» tres días después, ni a nosotros, que no recibimos
-- ningún aviso de que esa visita ya fue y nadie la ha cerrado.
--
-- Pasó con el Opel Corsa 5228HNS: confirmada el 1-oct, recordada el 4 a las
-- 07:00, visita el 5 a las 12:00, y el 7 seguía en «Por llevar» sin resultado.
-- Nadie se había olvidado: es que no había nada que lo dijera.
--
-- ── Las dos columnas ───────────────────────────────────────────────────────
--
-- `resultado_pedido_at` es la gemela de `recordado_at`: marca que ya se le ha
-- pedido el resultado y evita pedírselo todas las mañanas. Se apunta DESPUÉS
-- de mandar el correo, nunca antes; al revés, un fallo del envío dejaría la
-- petición dada por hecha y el resultado no llegaría nunca.
--
-- `perito_email` existe porque el nombre del perito se escribe a mano. El
-- directorio de proveedores sí guarda correo, pero a un perito de un pueblo al
-- que se llama una vez nadie lo da de alta antes de mandarle el coche: sin
-- este campo, la petición automática solo funcionaría con los de plantilla, y
-- justo los de una sola vez son a los que más se les olvida contestar.

ALTER TABLE IF EXISTS erp_revisiones_taller
  ADD COLUMN IF NOT EXISTS resultado_pedido_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS perito_email        TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN erp_revisiones_taller.resultado_pedido_at IS
  'Cuando se le pidio el resultado a quien hizo la revision. Se apunta despues de mandarlo, como recordado_at.';

COMMENT ON COLUMN erp_revisiones_taller.perito_email IS
  'A donde se le pide el resultado cuando el perito no esta en el directorio de proveedores. Vacio = se usa el del proveedor, si lo hay.';
