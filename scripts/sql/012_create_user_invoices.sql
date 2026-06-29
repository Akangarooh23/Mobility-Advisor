CREATE TABLE IF NOT EXISTS moveadvisor_user_invoices (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  number      TEXT,
  cw_invoice_number TEXT,
  date        TIMESTAMPTZ,
  amount      NUMERIC(10,2) DEFAULT 0,
  status      TEXT,
  pdf_url     TEXT DEFAULT '',
  cw_pdf_url  TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invoices_email ON moveadvisor_user_invoices (lower(email));
