-- Disponibilidad definida por el vendedor (particulares) o por CarsWise (ofertas ERP)
CREATE TABLE IF NOT EXISTS vehicle_visit_availability (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id   TEXT        NOT NULL,           -- id de moveadvisor_marketplace_vo_offers
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'available', -- available | booked | blocked
  source     VARCHAR(20) NOT NULL DEFAULT 'marketplace', -- marketplace | erp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vva_offer_status
  ON vehicle_visit_availability(offer_id, status, starts_at);

-- Reservas: el comprador elige un slot disponible
CREATE TABLE IF NOT EXISTS vehicle_visit_bookings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  availability_id   UUID        NOT NULL REFERENCES vehicle_visit_availability(id) ON DELETE CASCADE,
  offer_id          TEXT        NOT NULL,
  vehicle_title     TEXT        NOT NULL DEFAULT '',
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ NOT NULL,
  buyer_email       TEXT        NOT NULL,
  buyer_name        TEXT        NOT NULL DEFAULT '',
  buyer_phone       TEXT        NOT NULL DEFAULT '',
  seller_email      TEXT,                    -- null si la oferta es del ERP
  status            VARCHAR(20) NOT NULL DEFAULT 'confirmed', -- confirmed | rescheduled | cancelled
  token_buyer       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  token_seller      TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  notes             TEXT        DEFAULT '',
  source            VARCHAR(20) NOT NULL DEFAULT 'marketplace',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vvb_offer      ON vehicle_visit_bookings(offer_id);
CREATE INDEX IF NOT EXISTS idx_vvb_buyer      ON vehicle_visit_bookings(buyer_email);
CREATE INDEX IF NOT EXISTS idx_vvb_seller     ON vehicle_visit_bookings(seller_email);
CREATE INDEX IF NOT EXISTS idx_vvb_token_b    ON vehicle_visit_bookings(token_buyer);
CREATE INDEX IF NOT EXISTS idx_vvb_token_s    ON vehicle_visit_bookings(token_seller);
