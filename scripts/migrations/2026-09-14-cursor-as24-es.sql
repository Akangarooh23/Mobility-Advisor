-- El cursor de marcas del scraper español.
--
-- El orquestador recorre 45 marcas, 3 por pasada, y apunta aquí por dónde va.
-- La consulta que lo guarda es un UPDATE, así que la fila tiene que existir:
-- sin ella el UPDATE no toca nada, el cursor se queda en 0 para siempre y
-- todas las pasadas releen las tres primeras marcas.
--
-- Antes el reparto iba por día de la semana (i % 7 === día). Eso tenía dos
-- problemas: si una pasada se caía, esas marcas no se volvían a mirar hasta la
-- semana siguiente; y una ejecución a mano repetía justo lo del día.

INSERT INTO moveadvisor_cursores (clave, valor)
VALUES ('as24_es_marca', 0)
ON CONFLICT (clave) DO NOTHING;
