-- --------------------------------------------------------------------------
-- 0004 · El número no se gasta al volver a guardar
--
-- La 0003 pone el número en un disparador BEFORE INSERT. Lo que no tuvo en
-- cuenta es cómo se guarda un coche desde el panel:
--
--   INSERT INTO moveadvisor_user_vehicles (…) VALUES (…)
--   ON CONFLICT (id) DO UPDATE SET …
--
-- Postgres ejecuta los disparadores BEFORE INSERT **antes** de saber si hay
-- conflicto. Así que cada vez que alguien corrige los kilómetros de su coche se
-- pediría un número nuevo, se descartaría por el conflicto, y el contador se
-- quedaría arriba: con tres coches guardados un par de veces cada uno, el
-- siguiente IDCar sería el IDC-0009. Un número con huecos no es un número
-- correlativo, es un número casi ordenado, que es peor porque parece bueno.
--
-- Esto no se ve hasta que alguien pregunta por qué falta el IDC-0004.
--
-- El arreglo: antes de pedir número, mirar si esa fila ya existe. Si existe, se
-- queda con el suyo —lo que además evita que un reguardado le cambie el número
-- a un coche que ya está en un contrato— y no se toca el contador.
--
-- Se usa SQL dinámico con el nombre de la tabla porque el disparador es el
-- mismo para las cinco. Todas se identifican por `id`.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION pon_el_numero() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_ya TEXT;
BEGIN
  IF NEW.numero IS NOT NULL AND NEW.numero <> '' THEN
    RETURN NEW;
  END IF;

  -- ¿Ya hay una fila con ese identificador? Entonces esto es un reguardado.
  EXECUTE format('SELECT numero FROM %I WHERE id = $1', TG_TABLE_NAME)
     INTO v_ya
    USING NEW.id;

  IF v_ya IS NOT NULL AND v_ya <> '' THEN
    NEW.numero := v_ya;
    RETURN NEW;
  END IF;

  NEW.numero := siguiente_numero(TG_ARGV[0], TG_ARGV[1]::BOOLEAN);
  RETURN NEW;
END $$;

COMMENT ON FUNCTION pon_el_numero() IS
  'Pone el número de negocio al dar de alta. En un upsert respeta el que ya había y no gasta contador.';
