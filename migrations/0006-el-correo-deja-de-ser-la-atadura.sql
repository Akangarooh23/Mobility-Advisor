-- --------------------------------------------------------------------------
-- 0006 · El correo deja de ser lo único que ata una fila a su dueño
--
-- Doce tablas guardan `user_email` al lado de `user_id`. Medido contra la base
-- de verdad, la foto es esta:
--
--   · 0 filas con un correo que no es de nadie,
--   · 0 filas donde la copia diga un correo distinto al del usuario,
--   · **604 registros de embudo** (de 1.811) con correo y **sin** `user_id`.
--
-- Es decir: la copia todavía no miente en ningún sitio, pero en esas 604 filas
-- es lo único que las ata a una persona. Y un correo es un dato que cambia.
-- Mientras siga siendo la atadura, el día que alguien cambie el suyo esas filas
-- dejan de ser suyas sin que nadie toque nada.
--
-- Esto las ata por el identificador, que es lo que no cambia. Ninguna queda
-- huérfana: las 604 tienen un correo que sí es de un usuario.
--
-- El correo **no se borra**: sigue habiendo registros de embudo de visitantes
-- sin cuenta, donde el correo es lo único que hay, y eso es legítimo. Lo que
-- cambia es que deja de ser el vínculo de los que sí tienen dueño.
-- --------------------------------------------------------------------------

UPDATE moveadvisor_funnel_events e
   SET user_id = u.id
  FROM moveadvisor_users u
 WHERE COALESCE(e.user_id, '') = ''
   AND COALESCE(e.user_email, '') <> ''
   AND lower(u.email) = lower(e.user_email);

COMMENT ON COLUMN moveadvisor_funnel_events.user_email IS
  'El correo del visitante. Para los que tienen cuenta manda user_id; este queda como dato del evento, no como vínculo.';
