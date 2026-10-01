-- La peritación puede hacerse en casa del cliente, y la pide él.
--
-- Hasta ahora solo había una manera: alguien de Operaciones le daba cita en un
-- taller de la red, le avisaba por correo y el cliente llevaba el coche. Eso
-- deja fuera a quien no puede moverlo, y mete por medio un desplazamiento que
-- retrasa el anuncio: entre que se cuadra la hora con el taller y el cliente
-- puede ir, se van días en los que, para él, no se mueve nada.
--
-- Ahora puede elegir que vaya un perito a su dirección, y decir cuándo le
-- viene bien. Confirmamos nosotros.
--
-- ── Por qué en la misma tabla y no en una nueva ────────────────────────────
--
-- Lo que abre la puerta de publicar es una sola fila de esta tabla y una sola
-- función que la lee (`porQueNoEstaComprobado`, en el ERP). Si la visita a
-- domicilio viviera en otro sitio habría que bifurcar esa puerta, y por ahí es
-- por donde un día sale publicado un coche que nadie ha comprobado — que es
-- justo lo que esta revisión vino a impedir.
--
-- Una peritación es una peritación: cambia dónde se hace y quién la hace, no
-- lo que significa.
--
-- ── Las horas, en su propia tabla ──────────────────────────────────────────
--
-- Tres columnas `propuesta_1/2/3` serían más rápidas de escribir y peores el
-- día que proponga cuatro, o que queramos saber quién propuso cuál. Una fila
-- por franja también deja apuntado si la propuso él o nosotros, que es lo que
-- distingue «no le viene bien ninguna» de «no ha contestado».

ALTER TABLE IF EXISTS erp_revisiones_taller
  -- Vacío mientras no ha elegido, que no es lo mismo que «en taller».
  ADD COLUMN IF NOT EXISTS modalidad TEXT NOT NULL DEFAULT '',
  -- Quién va, cuando va alguien. Gemelas de `taller` y `taller_id`: el perito
  -- es un proveedor más, y su tipo «perito» ya existe desde las importaciones.
  ADD COLUMN IF NOT EXISTS perito    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS perito_id TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN erp_revisiones_taller.modalidad IS
  'Donde se hace: en_taller (el cliente lo lleva) o a_domicilio (va un perito). Vacio = todavia no ha elegido.';

CREATE TABLE IF NOT EXISTS erp_revisiones_taller_horas (
  id          BIGSERIAL PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES erp_revisiones_taller(id) ON DELETE CASCADE,
  -- Cuando puede. La hora va dentro: una franja sin hora no es una franja.
  empieza_at  TIMESTAMPTZ NOT NULL,
  /*
   * Quién la propuso.
   *
   * «cliente» son las que manda él desde la app o el panel; «nosotros», las
   * que le ofrecemos cuando ninguna suya encaja con la agenda del perito. Sin
   * esto, una lista vacía significa dos cosas —no ha contestado, o no le vale
   * ninguna— y son dos llamadas distintas.
   */
  la_puso     TEXT NOT NULL DEFAULT 'cliente',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE erp_revisiones_taller_horas IS
  'Las franjas en que se puede hacer la peritacion. Las propone el cliente y confirmamos nosotros eligiendo una.';

/*
 * Uno solo, y único: la misma franja no se propone dos veces.
 *
 * Sin esto, pulsar «enviar» dos veces -que es lo que pasa cuando la red va
 * lenta- deja seis franjas donde el cliente eligió tres, y quien tiene que
 * elegir una ve una lista con repetidos.
 *
 * Y sirve además para leerlas: se piden siempre por revisión y en orden, que
 * es justo por donde va.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ux_revisiones_horas_sin_repetir
  ON erp_revisiones_taller_horas (revision_id, empieza_at);
