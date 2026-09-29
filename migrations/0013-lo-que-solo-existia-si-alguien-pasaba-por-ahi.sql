-- Ocho tablas y cuatro columnas que solo existían si alguien pasaba por el
-- sitio exacto que las creaba.
--
-- ── Cómo se llegó aquí ─────────────────────────────────────────────────────
--
-- Veinticinco ficheros crean esquema dentro de las peticiones, con
-- `CREATE TABLE IF NOT EXISTS` y `ADD COLUMN IF NOT EXISTS`. Funciona: la
-- primera petición que pasa deja la tabla hecha. El problema es la que no
-- pasa, y el que depende de ella.
--
-- Cruzando lo que el código crea en caliente contra la base de producción y
-- contra `migrations/`, salieron tres grupos:
--
--   · 31 tablas que ya estaban declaradas en una migración. Su DDL en caliente
--     es redundante y se quitará aparte;
--   · 2 que existen en producción pero no están en ninguna migración
--     -`moveadvisor_workshop_blocks` y `moveadvisor_workshop_reservations`-:
--     una base nueva saldría sin ellas y nadie se enteraría hasta usarlas;
--   · y 6 que no existen ni en producción, porque su función nunca se ha
--     usado.
--
-- ── Y una avería de verdad, encontrada por el camino ───────────────────────
--
-- `lib/api/invoice-pdf-handler.js` pide estas columnas al leer una factura:
--
--     SELECT i.rectifica_numero, i.rectifica_fecha, i.rectifica_motivo,
--            u.nif_iva_verificado ...
--
-- Antes ejecuta un `ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- nif_iva_verificado`, pero de las tres `rectifica_*` no dice nada: ésas las
-- crea `ENSURE_RECTIFICATIVA`, y a ése solo lo ejecuta
-- `fianza-devolucion-handler`, que hasta el 24 de septiembre de 2026 no había
-- llegado a ejecutarse nunca porque le faltaba `INTERNAL_API_SECRET`.
--
-- Resultado: las columnas no existían, y la consulta contra producción contesta
--
--     column i.rectifica_numero does not exist
--
-- Es decir, **descargar una factura en PDF estaba roto**. Comprobado contra la
-- base, no deducido. Hay una factura en la tabla.
--
-- Esto es exactamente lo que pasa cuando el esquema depende de por dónde haya
-- pasado alguien: A necesita lo que crea B, y nadie escribió esa dependencia
-- en ningún sitio porque no hay ningún sitio donde escribirla.
--
-- ── Qué hace este fichero ──────────────────────────────────────────────────
--
-- Declarar las ocho tablas, las cuatro columnas y los índices que les faltaban,
-- con la misma forma que tenían en el código. Todo con `IF NOT EXISTS`: donde
-- ya está, no toca nada; donde no, lo deja hecho de una vez y para todos.

-- ── La avería: las cuatro columnas de la factura ───────────────────────────

ALTER TABLE moveadvisor_user_invoices
  ADD COLUMN IF NOT EXISTS rectifica_numero TEXT,
  ADD COLUMN IF NOT EXISTS rectifica_fecha  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rectifica_motivo TEXT;

COMMENT ON COLUMN moveadvisor_user_invoices.rectifica_numero IS
  'A que factura rectifica esta. Una rectificativa sin esto no es valida.';

ALTER TABLE moveadvisor_users
  ADD COLUMN IF NOT EXISTS nif_iva_verificado BOOLEAN;

COMMENT ON COLUMN moveadvisor_users.nif_iva_verificado IS
  'Alguien comprobo el NIF-IVA en VIES. NULL = no se ha comprobado, que no es lo mismo que estar mal.';

-- ── Las dos que existen en produccion y no estaban declaradas ──────────────

CREATE TABLE IF NOT EXISTS moveadvisor_workshop_reservations (
  id           TEXT PRIMARY KEY,
  workshop_id  TEXT NOT NULL,
  proveedor    TEXT NOT NULL DEFAULT '',
  dia          DATE NOT NULL,
  hora         TEXT NOT NULL,
  estado       TEXT NOT NULL DEFAULT 'booked',
  user_email   TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una hora reservada es una hora reservada: la anulada no estorba a la
-- siguiente, y por eso el indice solo mira las vivas.
CREATE UNIQUE INDEX IF NOT EXISTS moveadvisor_workshop_reservations_hueco
  ON moveadvisor_workshop_reservations (workshop_id, dia, hora)
  WHERE estado = 'booked';

CREATE TABLE IF NOT EXISTS moveadvisor_workshop_blocks (
  id           TEXT PRIMARY KEY,
  workshop_id  TEXT NOT NULL,
  proveedor    TEXT NOT NULL DEFAULT '',
  dia          DATE NOT NULL,
  -- Nulo = el dia entero. Con hora = solo ese hueco.
  hora         TEXT,
  motivo       TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS moveadvisor_workshop_blocks_dia
  ON moveadvisor_workshop_blocks (workshop_id, dia)
  WHERE hora IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS moveadvisor_workshop_blocks_hueco
  ON moveadvisor_workshop_blocks (workshop_id, dia, hora)
  WHERE hora IS NOT NULL;

-- ── Las visitas: el sitio y la solicitud ───────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicle_visit_places (
  offer_id      TEXT PRIMARY KEY,
  direccion     TEXT NOT NULL DEFAULT '',
  codigo_postal TEXT NOT NULL DEFAULT '',
  ciudad        TEXT NOT NULL DEFAULT '',
  contacto      TEXT NOT NULL DEFAULT '',
  notas         TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vehicle_visit_places IS
  'Donde se ve el coche. La parte de atras existe desde hace tiempo; el panel todavia no tiene donde escribirlo.';

CREATE TABLE IF NOT EXISTS vehicle_visit_requests (
  id               TEXT PRIMARY KEY,
  offer_id         TEXT NOT NULL,
  availability_id  TEXT NOT NULL,
  buyer_email      TEXT NOT NULL,
  buyer_name       TEXT NOT NULL DEFAULT '',
  buyer_phone      TEXT NOT NULL DEFAULT '',
  notes            TEXT NOT NULL DEFAULT '',
  source           TEXT NOT NULL DEFAULT 'marketplace',
  quiere_financiar BOOLEAN NOT NULL DEFAULT FALSE,
  token            TEXT NOT NULL,
  expira_at        TIMESTAMPTZ NOT NULL,
  confirmada_at    TIMESTAMPTZ,
  booking_id       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_visit_requests_token
  ON vehicle_visit_requests (token);

-- ── Los avisos al movil ────────────────────────────────────────────────────

-- La clave es el token y no el correo: un cliente puede tener la app en dos
-- moviles y hay que avisar a los dos.
CREATE TABLE IF NOT EXISTS moveadvisor_push_devices (
  token       TEXT        PRIMARY KEY,
  user_email  TEXT        NOT NULL,
  platform    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moveadvisor_push_devices_email
  ON moveadvisor_push_devices (lower(user_email));

-- ── WhatsApp ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pre_clientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT NOT NULL UNIQUE,
  name            TEXT,
  email           TEXT,
  gdpr_consent    BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_consent_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL UNIQUE,
  flow       TEXT NOT NULL DEFAULT 'general',
  step       TEXT NOT NULL DEFAULT 'start',
  context    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Va despues de pre_clientes, que la referencia.
CREATE TABLE IF NOT EXISTS whatsapp_leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          TEXT NOT NULL,
  pre_cliente_id UUID REFERENCES pre_clientes(id),
  user_email     TEXT,
  tipo           TEXT NOT NULL,
  sub_tipo       TEXT,
  sub_fuente     TEXT,
  oferta_id      TEXT,
  criterios      JSONB NOT NULL DEFAULT '{}',
  prioridad      TEXT NOT NULL DEFAULT 'normal',
  estado         TEXT NOT NULL DEFAULT 'nuevo',
  transcript     JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
