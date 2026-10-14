-- Qué papeles del ERP puede ver el cliente, y que lo decida una persona.
--
-- Hoy la respuesta está escrita en el código: en `papeles-de-la-venta-handler`
-- hay una lista cerrada de dos —el mandato firmado y la aceptación del
-- precio— y todo lo demás que cuelgue de su encargo es invisible para él.
--
-- Esa lista cerrada está bien pensada y no se toca: en `erp_documentos` hay
-- notas nuestras y lo que suba quien lleve el expediente, y una lista abierta
-- acabaría enseñándole cualquier cosa que alguien guarde ahí mañana.
--
-- Lo que no cubre es el caso que aparece ahora: el **informe del perito**. Lo
-- ha pagado él —son sus 60 €—, es lo que justifica el precio que le vamos a
-- proponer, y hoy no hay forma de enseñárselo que no sea sacarlo al almacén
-- público, donde lo abre cualquiera con el enlace. Y lleva su dirección.
--
-- ── Por qué una marca por documento y no otra lista ───────────────────────
--
-- Porque «informe del perito» no es una categoría que se pueda abrir entera.
-- De esa misma visita puede colgar el informe que se le enseña y el
-- presupuesto interno de la reparación, que no. Lo que decide no es qué tipo
-- de papel es: es si alguien ha mirado ESE papel y ha dicho que sí.
--
-- ── Por qué FALSE por defecto ─────────────────────────────────────────────
--
-- Porque el fallo caro es el que no se nota. Un papel que debería verse y no
-- se ve provoca una llamada; uno que no debería y se ve no provoca nada —hasta
-- que lo provoca—. Así que nada se vuelve visible por descuido: hay que
-- pulsarlo.
--
-- Los dos de la lista cerrada siguen funcionando como hasta ahora, sin
-- necesidad de marcarlos: son los que él mismo firmó y subió.

ALTER TABLE erp_documentos
  ADD COLUMN IF NOT EXISTS visible_cliente BOOLEAN NOT NULL DEFAULT FALSE;

-- Quién lo marcó y cuándo. No es burocracia: el día que haya que explicar por
-- qué un cliente vio un papel, «lo marcó alguien, en algún momento» no es una
-- respuesta. Sin valor por defecto, que los de hoy no los marcó nadie.
ALTER TABLE erp_documentos
  ADD COLUMN IF NOT EXISTS visible_desde TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visible_por   TEXT;
