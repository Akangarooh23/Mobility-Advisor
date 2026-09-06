-- ============================================================================
--  El catalogo del marketplace: lo que la ficha del concesionario si cuenta
--  2026-09-06
-- ============================================================================
--
--  `moveadvisor_marketplace_vo_offers` no es la tabla de datos de mercado. Son
--  dos cosas distintas y conviene no confundirlas:
--
--    moveadvisor_market_offers          798.547 filas. Wallapop, Milanuncios,
--                                       AutoScout24... Sirve para tasar.
--    moveadvisor_marketplace_vo_offers    4.472 filas. Gamboa, VIAN, Modrive.
--                                       Es el escaparate: lo que ve el cliente
--                                       y sobre lo que pide cita.
--
--  Esta migracion es de la segunda. Y sale de mirar una ficha de Gamboa al
--  lado de lo que guardamos: la ficha da catorce campos y la tabla solo tiene
--  sitio para siete.
--
--  ── Lo que se añade y por que ──────────────────────────────────────────────
--
--  Carroceria y puertas son filtros de busqueda de manual: nadie compra un
--  coche sin saber si es un SUV o un tres puertas. Plazas decide una compra
--  entera cuando hay familia. Y dueños anteriores y libro de servicio son
--  justo lo que mira quien duda entre dos coches parecidos.
--
--  Se añaden aunque hoy solo los rellene Gamboa. Una columna vacia no molesta
--  a nadie; volver a raspar 4.472 fichas dentro de tres meses porque no habia
--  donde meter el dato, si.
--
--  ── Y las dos fechas ───────────────────────────────────────────────────────
--
--  last_checked_at y last_seen_at no existian en esta tabla, y esa ausencia
--  explica una cifra que asusta: 4.449 coches marcados como disponibles para
--  comprar y CERO marcados como vendidos en toda la historia de la tabla.
--  Nadie comprueba nunca si siguen ahi. El 59% del catalogo -Modrive- llevaba
--  veinte dias sin refrescarse y sus URLs estaban todas rotas.
--
--  Con estas dos columnas, los verificadores por concesionario pueden hacer lo
--  mismo que ya hace el de Wallapop: pasar cada dia por cada oferta, y que
--  last_seen_at se congele solo en el ultimo dia en que el coche estaba.
-- ============================================================================

-- ── Lo que cuenta la ficha y no teniamos donde meter ────────────────────────

ALTER TABLE moveadvisor_marketplace_vo_offers
  -- 'Todoterreno', 'Berlina', 'Familiar'. Tal como lo dice el concesionario;
  -- normalizarlo es trabajo del enriquecedor, no de la columna.
  ADD COLUMN IF NOT EXISTS body_type        VARCHAR(60),
  ADD COLUMN IF NOT EXISTS doors            SMALLINT,
  ADD COLUMN IF NOT EXISTS seats            SMALLINT,
  ADD COLUMN IF NOT EXISTS previous_owners  SMALLINT,
  ADD COLUMN IF NOT EXISTS has_service_book BOOLEAN,
  -- 'Nacional: Si' en Gamboa. Importa para el precio: un importado vale menos.
  ADD COLUMN IF NOT EXISTS is_national      BOOLEAN,
  -- El equipamiento va en JSON y no en columnas porque es una lista abierta y
  -- distinta en cada coche: {"serie": [...], "opcional": [...]}. Gamboa lo
  -- publica separado en esas dos pestañas y esa separacion vale dinero -un
  -- extra opcional montado es lo que diferencia dos coches del mismo precio-.
  ADD COLUMN IF NOT EXISTS equipment        TEXT;

-- ── Las fechas que faltaban para poder verificar ────────────────────────────

ALTER TABLE moveadvisor_marketplace_vo_offers
  -- La ultima vez que fuimos a mirar, saliera lo que saliera.
  ADD COLUMN IF NOT EXISTS last_checked_at  TIMESTAMPTZ,
  -- La ultima vez que el coche SEGUIA publicado. En uno que desaparece, esta
  -- fecha se queda congelada en su ultimo dia bueno: es la fecha de baja, sin
  -- necesidad de una columna mas.
  ADD COLUMN IF NOT EXISTS last_seen_at     TIMESTAMPTZ;

-- Los verificadores piden siempre lo mismo: las de un concesionario que llevan
-- mas tiempo sin comprobar. NULLS FIRST porque las que no se han mirado nunca
-- son justo las que hay que mirar primero.
CREATE INDEX IF NOT EXISTS ix_marketplace_vo_por_verificar
  ON moveadvisor_marketplace_vo_offers (portal, last_checked_at NULLS FIRST)
  WHERE is_active;

-- ── Sobre no rellenar last_seen_at con la fecha de hoy ──────────────────────
--
-- Se quedan a NULL a proposito. Poner NOW() diria que hemos comprobado 4.472
-- coches que nadie ha mirado, y ademas los ordenaria todos iguales en la cola
-- del verificador. NULL es la verdad: no lo sabemos todavia.

-- ============================================================================
--  Para deshacerla:
--    ALTER TABLE moveadvisor_marketplace_vo_offers
--      DROP COLUMN body_type, DROP COLUMN doors, DROP COLUMN seats,
--      DROP COLUMN previous_owners, DROP COLUMN has_service_book,
--      DROP COLUMN is_national, DROP COLUMN equipment,
--      DROP COLUMN last_checked_at, DROP COLUMN last_seen_at;
-- ============================================================================
