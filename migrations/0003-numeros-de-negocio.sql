-- --------------------------------------------------------------------------
-- 0003 · Los números de negocio
--
-- Un cliente era `074a51b3-c8d8-470a-ac11-333ed2439784` y un IDCar
-- `idcar-1790076532522-w3hajh`. Eso vale para la máquina y no vale para una
-- persona: nadie dice eso por teléfono ni lo escribe en un contrato.
--
-- A partir de aquí cada uno tiene además su número: **CLI-0001**, **IDC-0001**,
-- **ENC-2026-0001**. Correlativo, empieza en 1 y crece.
--
-- ── Tres cosas que no son lo mismo ────────────────────────────────────────
--
--  · La **clave** (`id`) no se toca. Es lo que une las filas y está metida
--    dentro de las rutas de los ficheros del coche y en las referencias de
--    PopCar Check: cambiarla obligaría a mudar ficheros y recolocar informes, y
--    no compra nada.
--  · El **número** es esto: para verlo y para decirlo.
--  · Lo que viaja en una dirección sigue siendo la clave, que es impredecible.
--    Un `/idcars/3` deja recorrer el inventario entero probando números — es
--    exactamente el agujero que tenían las facturas de proveedor,
--    `PROV-2026-001.pdf` y a partir de ahí todas las demás.
--
-- ── Por qué un contador y no una secuencia ────────────────────────────────
--
-- Una secuencia de Postgres deja huecos por diseño: si algo se deshace, el
-- número se pierde igual. Para un número que sale en un papel eso no vale, y
-- para una factura además no es legal. El contador vive en una tabla y se
-- incrementa dentro de la misma transacción que la fila, que es lo que ya hace
-- `nextInvoiceNumber` con las facturas desde hace meses. Esto es ese patrón,
-- puesto donde faltaba.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS numeracion (
  serie  TEXT    NOT NULL,
  -- 0 para las series que no se reinician cada año, como los clientes.
  anio   INTEGER NOT NULL,
  ultimo BIGINT  NOT NULL DEFAULT 0,
  PRIMARY KEY (serie, anio)
);

COMMENT ON TABLE numeracion IS
  'Contadores de los números de negocio. Se tocan solo con siguiente_numero().';

/*
 * El siguiente número de una serie.
 *
 * El INSERT … ON CONFLICT DO UPDATE … RETURNING es una sola operación: dos
 * altas a la vez no se pueden llevar el mismo número, y no hace falta bloquear
 * nada a mano.
 */
CREATE OR REPLACE FUNCTION siguiente_numero(
  p_serie TEXT, p_con_anio BOOLEAN DEFAULT FALSE, p_digitos INTEGER DEFAULT 4
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_anio INTEGER;
  v_n    BIGINT;
BEGIN
  v_anio := CASE WHEN p_con_anio THEN EXTRACT(YEAR FROM NOW())::INTEGER ELSE 0 END;

  INSERT INTO numeracion (serie, anio, ultimo)
  VALUES (p_serie, v_anio, 1)
  ON CONFLICT (serie, anio) DO UPDATE SET ultimo = numeracion.ultimo + 1
  RETURNING ultimo INTO v_n;

  RETURN p_serie || '-'
      || CASE WHEN p_con_anio THEN v_anio || '-' ELSE '' END
      || lpad(v_n::TEXT, p_digitos, '0');
END $$;

/*
 * Pone el número al dar de alta, si no viene puesto.
 *
 * Va en un disparador y no en el código de la aplicación porque las altas se
 * hacen desde tres sitios —la web, la app y el ERP— y desde más de un fichero
 * en cada uno. Puesto aquí, no hay forma de dar de alta un cliente sin número
 * ni de que a alguien se le olvide al escribir la siguiente pantalla.
 *
 * Los argumentos son la serie y si lleva año: TG_ARGV[0] y TG_ARGV[1].
 */
CREATE OR REPLACE FUNCTION pon_el_numero() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := siguiente_numero(TG_ARGV[0], TG_ARGV[1]::BOOLEAN);
  END IF;
  RETURN NEW;
END $$;

-- ── Clientes: CLI-0001, y no se reinicia nunca ────────────────────────────

ALTER TABLE moveadvisor_users ADD COLUMN IF NOT EXISTS numero TEXT;

WITH orden AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
    FROM moveadvisor_users WHERE numero IS NULL OR numero = ''
)
UPDATE moveadvisor_users u
   SET numero = 'CLI-' || lpad(o.n::TEXT, 4, '0')
  FROM orden o WHERE o.id = u.id;

INSERT INTO numeracion (serie, anio, ultimo)
SELECT 'CLI', 0, count(*) FROM moveadvisor_users
ON CONFLICT (serie, anio) DO UPDATE SET ultimo = GREATEST(numeracion.ultimo, EXCLUDED.ultimo);

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_numero ON moveadvisor_users (numero);
ALTER TABLE moveadvisor_users ALTER COLUMN numero SET NOT NULL;

DROP TRIGGER IF EXISTS pon_numero ON moveadvisor_users;
CREATE TRIGGER pon_numero BEFORE INSERT ON moveadvisor_users
  FOR EACH ROW EXECUTE FUNCTION pon_el_numero('CLI', 'false');

-- ── IDCars: IDC-0001, tampoco se reinicia ─────────────────────────────────

ALTER TABLE moveadvisor_user_vehicles ADD COLUMN IF NOT EXISTS numero TEXT;

WITH orden AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
    FROM moveadvisor_user_vehicles WHERE numero IS NULL OR numero = ''
)
UPDATE moveadvisor_user_vehicles v
   SET numero = 'IDC-' || lpad(o.n::TEXT, 4, '0')
  FROM orden o WHERE o.id = v.id;

INSERT INTO numeracion (serie, anio, ultimo)
SELECT 'IDC', 0, count(*) FROM moveadvisor_user_vehicles
ON CONFLICT (serie, anio) DO UPDATE SET ultimo = GREATEST(numeracion.ultimo, EXCLUDED.ultimo);

CREATE UNIQUE INDEX IF NOT EXISTS ux_vehiculos_numero ON moveadvisor_user_vehicles (numero);
ALTER TABLE moveadvisor_user_vehicles ALTER COLUMN numero SET NOT NULL;

DROP TRIGGER IF EXISTS pon_numero ON moveadvisor_user_vehicles;
CREATE TRIGGER pon_numero BEFORE INSERT ON moveadvisor_user_vehicles
  FOR EACH ROW EXECUTE FUNCTION pon_el_numero('IDC', 'false');

-- ── Encargos de venta: ENC-2026-0001, por año ─────────────────────────────

ALTER TABLE erp_encargos_venta ADD COLUMN IF NOT EXISTS numero TEXT;

WITH orden AS (
  SELECT id, EXTRACT(YEAR FROM created_at)::INTEGER AS anio,
         row_number() OVER (PARTITION BY EXTRACT(YEAR FROM created_at)
                            ORDER BY created_at, id) AS n
    FROM erp_encargos_venta WHERE numero IS NULL OR numero = ''
)
UPDATE erp_encargos_venta e
   SET numero = 'ENC-' || o.anio || '-' || lpad(o.n::TEXT, 4, '0')
  FROM orden o WHERE o.id = e.id;

INSERT INTO numeracion (serie, anio, ultimo)
SELECT 'ENC', EXTRACT(YEAR FROM created_at)::INTEGER, count(*)
  FROM erp_encargos_venta GROUP BY 2
ON CONFLICT (serie, anio) DO UPDATE SET ultimo = GREATEST(numeracion.ultimo, EXCLUDED.ultimo);

CREATE UNIQUE INDEX IF NOT EXISTS ux_encargos_numero ON erp_encargos_venta (numero);
ALTER TABLE erp_encargos_venta ALTER COLUMN numero SET NOT NULL;

DROP TRIGGER IF EXISTS pon_numero ON erp_encargos_venta;
CREATE TRIGGER pon_numero BEFORE INSERT ON erp_encargos_venta
  FOR EACH ROW EXECUTE FUNCTION pon_el_numero('ENC', 'true');

-- ── Leads: LEAD-2026-0001, por año ────────────────────────────────────────

ALTER TABLE moveadvisor_market_leads ADD COLUMN IF NOT EXISTS numero TEXT;

WITH orden AS (
  SELECT id, EXTRACT(YEAR FROM created_at)::INTEGER AS anio,
         row_number() OVER (PARTITION BY EXTRACT(YEAR FROM created_at)
                            ORDER BY created_at, id) AS n
    FROM moveadvisor_market_leads WHERE numero IS NULL OR numero = ''
)
UPDATE moveadvisor_market_leads l
   SET numero = 'LEAD-' || o.anio || '-' || lpad(o.n::TEXT, 4, '0')
  FROM orden o WHERE o.id = l.id;

INSERT INTO numeracion (serie, anio, ultimo)
SELECT 'LEAD', EXTRACT(YEAR FROM created_at)::INTEGER, count(*)
  FROM moveadvisor_market_leads GROUP BY 2
ON CONFLICT (serie, anio) DO UPDATE SET ultimo = GREATEST(numeracion.ultimo, EXCLUDED.ultimo);

CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_numero ON moveadvisor_market_leads (numero);
ALTER TABLE moveadvisor_market_leads ALTER COLUMN numero SET NOT NULL;

DROP TRIGGER IF EXISTS pon_numero ON moveadvisor_market_leads;
CREATE TRIGGER pon_numero BEFORE INSERT ON moveadvisor_market_leads
  FOR EACH ROW EXECUTE FUNCTION pon_el_numero('LEAD', 'true');

-- ── Visitas: VIS-2026-0001, por año ───────────────────────────────────────

ALTER TABLE vehicle_visit_bookings ADD COLUMN IF NOT EXISTS numero TEXT;

WITH orden AS (
  SELECT id, EXTRACT(YEAR FROM created_at)::INTEGER AS anio,
         row_number() OVER (PARTITION BY EXTRACT(YEAR FROM created_at)
                            ORDER BY created_at, id) AS n
    FROM vehicle_visit_bookings WHERE numero IS NULL OR numero = ''
)
UPDATE vehicle_visit_bookings b
   SET numero = 'VIS-' || o.anio || '-' || lpad(o.n::TEXT, 4, '0')
  FROM orden o WHERE o.id = b.id;

INSERT INTO numeracion (serie, anio, ultimo)
SELECT 'VIS', EXTRACT(YEAR FROM created_at)::INTEGER, count(*)
  FROM vehicle_visit_bookings GROUP BY 2
ON CONFLICT (serie, anio) DO UPDATE SET ultimo = GREATEST(numeracion.ultimo, EXCLUDED.ultimo);

CREATE UNIQUE INDEX IF NOT EXISTS ux_visitas_numero ON vehicle_visit_bookings (numero);
ALTER TABLE vehicle_visit_bookings ALTER COLUMN numero SET NOT NULL;

DROP TRIGGER IF EXISTS pon_numero ON vehicle_visit_bookings
;
CREATE TRIGGER pon_numero BEFORE INSERT ON vehicle_visit_bookings
  FOR EACH ROW EXECUTE FUNCTION pon_el_numero('VIS', 'true');
