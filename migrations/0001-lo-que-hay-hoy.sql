-- --------------------------------------------------------------------------
-- 0001 · Lo que ya había
--
-- Generado por scripts/saca-el-esquema.mjs leyendo la base de verdad.
-- No se escribe a mano: si hay que cambiar algo, se hace en una migración
-- nueva, no aquí. Este fichero es la foto del día en que se empezó a llevar
-- la cuenta.
--
-- 94 tablas.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS erp_anuncios_de_portal (
  id text NOT NULL,
  vehicle_id character varying(64) NOT NULL,
  portal text NOT NULL,
  url text NOT NULL,
  publicado_at timestamp with time zone DEFAULT now() NOT NULL,
  publicado_por text DEFAULT ''::text NOT NULL,
  retirado_at timestamp with time zone,
  retirado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_appointments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id text NOT NULL,
  agent text,
  workshop_id uuid,
  workshop_name text,
  scheduled_at timestamp with time zone NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'scheduled'::text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id text,
  payload jsonb,
  ip text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_calculos_guardados (
  clave text NOT NULL,
  valor jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_documentos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ambito text NOT NULL,
  ambito_id text NOT NULL,
  papel text DEFAULT ''::text NOT NULL,
  nombre text NOT NULL,
  tipo text NOT NULL,
  ruta text NOT NULL,
  tamano integer DEFAULT 0 NOT NULL,
  subido_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_encargos_venta (
  id text NOT NULL,
  vehicle_id character varying(64) NOT NULL,
  cliente_email text DEFAULT ''::text NOT NULL,
  cliente_nombre text DEFAULT ''::text NOT NULL,
  estado text DEFAULT 'recogiendo'::text NOT NULL,
  firmado_at timestamp with time zone,
  vence_at timestamp with time zone,
  precio_acordado numeric(12,2),
  fee_gestion numeric(12,2),
  fee_cancelacion numeric(12,2),
  avisado_at timestamp with time zone,
  cerrado_at timestamp with time zone,
  motivo_cierre text DEFAULT ''::text NOT NULL,
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  libre_desde timestamp with time zone,
  acepto_el_precio boolean DEFAULT false NOT NULL,
  precio_referencia numeric(12,2),
  lead_id text,
  mandato_id text,
  firma_como text,
  firma_nota text,
  contrato_id text,
  vendedor_dni text,
  vendedor_domicilio text,
  comprador_nombre text,
  comprador_dni text,
  comprador_domicilio text,
  bastidor text,
  precio_venta numeric(12,2),
  clausula_id text,
  clausula_enviada_at timestamp with time zone,
  clausula_firmada_at timestamp with time zone,
  publicado_at timestamp with time zone,
  clausula_precio numeric(12,2),
  venta_estado text,
  venta_booking_id text,
  venta_iniciada_at timestamp with time zone,
  venta_anulada_at timestamp with time zone,
  venta_motivo_anulacion text,
  comprador_email text,
  comprador_telefono text,
  venta_financia boolean,
  financiacion_estado text,
  financiacion_entidad text,
  financiacion_importe numeric(12,2),
  financiacion_decidida_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS erp_gastos_pedido (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pedido_id text NOT NULL,
  concepto text NOT NULL,
  proveedor text DEFAULT ''::text NOT NULL,
  importe numeric(12,2) DEFAULT 0 NOT NULL,
  fecha date,
  notas text DEFAULT ''::text NOT NULL,
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  base numeric(12,2),
  iva numeric(5,2),
  regimen text DEFAULT 'nacional'::text NOT NULL,
  que text DEFAULT 'nuestro'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_inventory (
  id text NOT NULL,
  sku text NOT NULL,
  model text NOT NULL,
  status text NOT NULL,
  price_eur numeric(12,2) NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_invoices (
  id text NOT NULL,
  invoice text NOT NULL,
  customer text NOT NULL,
  due_at date NOT NULL,
  status text NOT NULL,
  amount_eur numeric(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_kpis (
  id text NOT NULL,
  kpi text NOT NULL,
  value text NOT NULL,
  target text NOT NULL,
  variation text NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_lead_documentos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id text NOT NULL,
  nombre text NOT NULL,
  tipo text NOT NULL,
  ruta text NOT NULL,
  tamano integer DEFAULT 0 NOT NULL,
  subido_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_lead_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id text NOT NULL,
  operator text NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_leads (
  id text NOT NULL,
  lead text NOT NULL,
  source text NOT NULL,
  status text NOT NULL,
  owner text NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_password_resets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS erp_pedido_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pedido_id text NOT NULL,
  operador text NOT NULL,
  campo text NOT NULL,
  antes text,
  despues text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_pedidos (
  id text NOT NULL,
  origen text NOT NULL,
  estado text DEFAULT 'Borrador'::text NOT NULL,
  proveedor text DEFAULT ''::text NOT NULL,
  vehiculo_titulo text DEFAULT ''::text NOT NULL,
  vehiculo_id text DEFAULT ''::text NOT NULL,
  matricula text DEFAULT ''::text NOT NULL,
  bastidor text DEFAULT ''::text NOT NULL,
  importe numeric(12,2),
  cliente_email text DEFAULT ''::text NOT NULL,
  lead_id text,
  fecha_estimada date,
  fecha_pedido timestamp with time zone,
  fecha_confirmado timestamp with time zone,
  fecha_recepcion timestamp with time zone,
  notas text DEFAULT ''::text NOT NULL,
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  comprobaciones jsonb DEFAULT '{}'::jsonb NOT NULL,
  recepcion jsonb DEFAULT '{}'::jsonb NOT NULL,
  titularidad text DEFAULT 'popcar'::text NOT NULL,
  revender_antes_de date,
  factura_proveedor text DEFAULT ''::text NOT NULL,
  factura_pagada_el date
);

CREATE TABLE IF NOT EXISTS erp_peritacion_danos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  peritacion_id text NOT NULL,
  pieza text DEFAULT ''::text NOT NULL,
  coste numeric(12,2),
  notas text DEFAULT ''::text NOT NULL,
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_peritaciones (
  id text NOT NULL,
  lead_id text,
  vehiculo_titulo text DEFAULT ''::text NOT NULL,
  estado text DEFAULT 'Por encargar'::text NOT NULL,
  perito text DEFAULT ''::text NOT NULL,
  donde text DEFAULT ''::text NOT NULL,
  contacto text DEFAULT ''::text NOT NULL,
  fecha_prevista date,
  fecha_hecha timestamp with time zone,
  veredicto text,
  notas text DEFAULT ''::text NOT NULL,
  coste numeric(12,2),
  encargo_enviado_at timestamp with time zone,
  encargo_enviado_a text DEFAULT ''::text NOT NULL,
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  factura_numero text DEFAULT ''::text NOT NULL,
  factura_fecha date,
  cita_avisada_at timestamp with time zone,
  cita_avisada_a text DEFAULT ''::text NOT NULL,
  hora_prevista text DEFAULT ''::text NOT NULL,
  telefono text DEFAULT ''::text NOT NULL,
  quien_va text DEFAULT ''::text NOT NULL,
  quien_va_email text DEFAULT ''::text NOT NULL,
  quien_va_tel text DEFAULT ''::text NOT NULL,
  factura_pedida_at timestamp with time zone,
  factura_pedida_a text DEFAULT ''::text NOT NULL,
  informe_url text
);

CREATE TABLE IF NOT EXISTS erp_proveedores (
  id text NOT NULL,
  nombre text NOT NULL,
  clave text NOT NULL,
  tipos text[] DEFAULT '{}'::text[] NOT NULL,
  nif text DEFAULT ''::text NOT NULL,
  telefono text DEFAULT ''::text NOT NULL,
  email text DEFAULT ''::text NOT NULL,
  direccion text DEFAULT ''::text NOT NULL,
  notas text DEFAULT ''::text NOT NULL,
  activo boolean DEFAULT true NOT NULL,
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  matriz_id text,
  iban text DEFAULT ''::text NOT NULL,
  contacto text DEFAULT ''::text NOT NULL,
  horario text DEFAULT ''::text NOT NULL,
  relacion text,
  nombre_comercial text DEFAULT ''::text NOT NULL,
  cp text DEFAULT ''::text NOT NULL,
  municipio text DEFAULT ''::text NOT NULL,
  provincia text DEFAULT ''::text NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_refresh_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  token text NOT NULL,
  email text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_revisiones_taller (
  id text NOT NULL,
  vehicle_id character varying(64) NOT NULL,
  encargo_id text,
  estado text DEFAULT 'Por llevar'::text NOT NULL,
  taller text DEFAULT ''::text NOT NULL,
  cita_at timestamp with time zone,
  hecha_at timestamp with time zone,
  resultado text,
  notas text DEFAULT ''::text NOT NULL,
  coste numeric(12,2),
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  direccion text DEFAULT ''::text NOT NULL,
  avisado_at timestamp with time zone,
  cliente_pidio text,
  cliente_pidio_at timestamp with time zone,
  cliente_motivo text DEFAULT ''::text NOT NULL,
  recordado_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS erp_staff (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  nombre text NOT NULL,
  rol text NOT NULL,
  activo boolean DEFAULT true NOT NULL,
  creado_por text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  last_login_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS erp_staff_passwords (
  email text NOT NULL,
  password_hash text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_tarifas_gestoria (
  id text NOT NULL,
  proveedor_id text NOT NULL,
  tramite text NOT NULL,
  honorarios numeric(10,2),
  tasas numeric(10,2),
  tasa_colegio numeric(10,2),
  colegio_con_iva boolean DEFAULT false NOT NULL,
  vigente_hasta date,
  notas text DEFAULT ''::text NOT NULL,
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_tarifas_transporte (
  id text NOT NULL,
  proveedor_id text NOT NULL,
  origen_pais text DEFAULT 'DE'::text NOT NULL,
  origen_zona text DEFAULT ''::text NOT NULL,
  destino_pais text DEFAULT 'ES'::text NOT NULL,
  destino_zona text DEFAULT ''::text NOT NULL,
  precio_1 numeric(10,2),
  precio_2_3 numeric(10,2),
  precio_4_8 numeric(10,2),
  dias_transito integer,
  vigente_hasta date,
  notas text DEFAULT ''::text NOT NULL,
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_ticket_events (
  id bigint DEFAULT nextval('erp_ticket_events_id_seq'::regclass) NOT NULL,
  ticket_id text NOT NULL,
  event_at timestamp with time zone NOT NULL,
  actor text NOT NULL,
  message text NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_tickets (
  id text NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  priority text NOT NULL,
  channel text NOT NULL,
  assignee text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_tramite_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tramite_id text NOT NULL,
  operador text NOT NULL,
  campo text NOT NULL,
  antes text,
  despues text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_tramites (
  id text NOT NULL,
  tipo text NOT NULL,
  estado text DEFAULT 'Pendiente'::text NOT NULL,
  gestoria text DEFAULT ''::text NOT NULL,
  vehiculo_titulo text DEFAULT ''::text NOT NULL,
  matricula text DEFAULT ''::text NOT NULL,
  bastidor text DEFAULT ''::text NOT NULL,
  cliente_email text DEFAULT ''::text NOT NULL,
  pedido_id text,
  lead_id text,
  coste numeric(12,2),
  fecha_enviado timestamp with time zone,
  fecha_resuelto timestamp with time zone,
  notas text DEFAULT ''::text NOT NULL,
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  partidas jsonb DEFAULT '[]'::jsonb NOT NULL,
  encargo_id text,
  precio numeric(12,2),
  comprador_nombre text DEFAULT ''::text NOT NULL,
  comprador_email text DEFAULT ''::text NOT NULL,
  cobrado_at timestamp with time zone,
  cobrado_por text DEFAULT ''::text NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_transporte_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transporte_id text NOT NULL,
  operador text NOT NULL,
  campo text NOT NULL,
  antes text,
  despues text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp_transportes (
  id text NOT NULL,
  pedido_id text,
  lead_id text,
  tramo integer DEFAULT 1 NOT NULL,
  estado text DEFAULT 'Por organizar'::text NOT NULL,
  transportista text DEFAULT ''::text NOT NULL,
  desde text DEFAULT ''::text NOT NULL,
  hasta text DEFAULT ''::text NOT NULL,
  vehiculo_titulo text DEFAULT ''::text NOT NULL,
  matricula text DEFAULT ''::text NOT NULL,
  coste numeric(12,2),
  recogida_prevista date,
  entrega_prevista date,
  fecha_recogida timestamp with time zone,
  fecha_entrega timestamp with time zone,
  notas text DEFAULT ''::text NOT NULL,
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  orden_enviada_at timestamp with time zone,
  orden_enviada_a text DEFAULT ''::text NOT NULL,
  recogida_preguntada_at timestamp with time zone,
  recogida_preguntada_a text DEFAULT ''::text NOT NULL,
  contacto_origen text DEFAULT ''::text NOT NULL,
  telefono_origen text DEFAULT ''::text NOT NULL,
  horario_origen text DEFAULT ''::text NOT NULL,
  portacoches boolean,
  presupuesto_pedido_at timestamp with time zone,
  presupuesto_pedido_a text DEFAULT ''::text NOT NULL,
  aviso_recogida_at timestamp with time zone,
  aviso_recogida_a text DEFAULT ''::text NOT NULL,
  contacto_transportista text DEFAULT ''::text NOT NULL,
  telefono_transportista text DEFAULT ''::text NOT NULL,
  llegada jsonb DEFAULT '{}'::jsonb NOT NULL,
  base numeric(12,2),
  iva numeric(5,2),
  regimen text DEFAULT 'nacional'::text NOT NULL,
  factura_pedida_at timestamp with time zone,
  factura_pedida_a text DEFAULT ''::text NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_user_status_overrides (
  user_id text NOT NULL,
  status text NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_users (
  id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL,
  last_seen_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_vendedores_marketplace (
  nombre text NOT NULL,
  telefono text,
  contacto text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  horario text
);

CREATE TABLE IF NOT EXISTS erp_workshops (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  address text,
  city text,
  province text,
  postal_code text,
  phone text,
  email text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS funnel_outreach (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  anon_id text NOT NULL,
  user_email text,
  status text DEFAULT 'pending'::text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_alert_notifications (
  id integer DEFAULT nextval('market_alert_notifications_id_seq'::regclass) NOT NULL,
  alert_id text NOT NULL,
  user_email text NOT NULL,
  offer_id text NOT NULL,
  notified_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS market_alerts (
  id text NOT NULL,
  user_email text NOT NULL,
  mode text DEFAULT 'ambos'::text NOT NULL,
  brand text,
  model text,
  query_text text,
  min_price numeric,
  max_price numeric,
  min_year integer,
  max_year integer,
  min_mileage integer,
  max_mileage integer,
  fuel text,
  transmission text,
  displacement text,
  location text,
  color text,
  title text,
  notify_by_email boolean DEFAULT true NOT NULL,
  seen_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS market_garantia_coberturas (
  id bigint DEFAULT nextval('market_garantia_coberturas_id_seq'::regclass) NOT NULL,
  garantia_id text NOT NULL,
  texto text NOT NULL,
  incluida boolean DEFAULT true NOT NULL,
  orden integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS market_garantias (
  id text NOT NULL,
  nombre text NOT NULL,
  nivel integer DEFAULT 1 NOT NULL,
  es_base boolean DEFAULT false NOT NULL,
  renunciable boolean DEFAULT true NOT NULL,
  meses integer,
  km_cubiertos integer,
  precio numeric(10,2) DEFAULT 0 NOT NULL,
  coste numeric(10,2),
  proveedor_id text,
  antiguedad_max_anios integer,
  km_max_vehiculo integer,
  activo boolean DEFAULT true NOT NULL,
  notas text DEFAULT ''::text NOT NULL,
  creado_por text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  comision numeric(10,2)
);

CREATE TABLE IF NOT EXISTS moveadvisor_brand_aliases (
  id bigint DEFAULT nextval('moveadvisor_brand_aliases_id_seq'::regclass) NOT NULL,
  alias_name text NOT NULL,
  canonical_name text NOT NULL,
  alias_key text DEFAULT normalize_alias_token(alias_name),
  canonical_key text DEFAULT normalize_alias_token(canonical_name),
  source text DEFAULT 'manual'::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_brand_sweeps (
  portal text NOT NULL,
  brand text NOT NULL,
  swept_at timestamp with time zone DEFAULT now() NOT NULL,
  total_pages integer,
  pages_read integer,
  complete boolean DEFAULT false NOT NULL,
  seen_count integer,
  deactivated integer,
  blocked boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_cursores (
  clave text NOT NULL,
  valor integer DEFAULT 0 NOT NULL,
  actualizado timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_erp_brands (
  id bigint NOT NULL,
  name character varying(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_erp_models (
  id bigint NOT NULL,
  brand_id bigint NOT NULL,
  name character varying(160) NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_erp_versions (
  codversion character varying(128) NOT NULL,
  brand_id bigint NOT NULL,
  model_id bigint NOT NULL,
  label character varying(200) NOT NULL,
  fuel character varying(80) DEFAULT ''::character varying NOT NULL,
  body_type character varying(80) DEFAULT ''::character varying NOT NULL,
  cv character varying(40) DEFAULT ''::character varying NOT NULL,
  doors character varying(20) DEFAULT ''::character varying NOT NULL,
  seats character varying(20) DEFAULT ''::character varying NOT NULL,
  co2 character varying(40) DEFAULT ''::character varying NOT NULL,
  transmision character varying(80) DEFAULT ''::character varying NOT NULL,
  consumption character varying(80) DEFAULT ''::character varying NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_field_overrides (
  offer_id text NOT NULL,
  field text NOT NULL,
  value text NOT NULL,
  fuente text NOT NULL,
  set_by text NOT NULL,
  set_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_funnel_events (
  id character varying(64) NOT NULL,
  anon_id character varying(64) DEFAULT ''::character varying NOT NULL,
  user_id character varying(64),
  user_email character varying(255),
  event_type character varying(80) NOT NULL,
  utm_source character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_medium character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_campaign character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_content character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_term character varying(255) DEFAULT ''::character varying NOT NULL,
  landing_url text DEFAULT ''::text NOT NULL,
  offer_id character varying(255),
  offer_title character varying(255),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  modality character varying(32),
  section character varying(80)
);

CREATE TABLE IF NOT EXISTS moveadvisor_invoice_counters (
  series character varying(20) NOT NULL,
  year integer NOT NULL,
  last_n integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_market_leads (
  id character varying(64) NOT NULL,
  user_email character varying(255) NOT NULL,
  lead_type character varying(40) DEFAULT 'info'::character varying NOT NULL,
  vehicle_id character varying(255),
  vehicle_title character varying(255) DEFAULT ''::character varying NOT NULL,
  vehicle_url text DEFAULT ''::text NOT NULL,
  portal character varying(100) DEFAULT ''::character varying NOT NULL,
  contact_name character varying(255) DEFAULT ''::character varying NOT NULL,
  contact_phone character varying(80) DEFAULT ''::character varying NOT NULL,
  contact_when character varying(80) DEFAULT ''::character varying NOT NULL,
  status character varying(80) DEFAULT 'Pendiente'::character varying NOT NULL,
  erp_notes text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  erp_response text DEFAULT ''::text NOT NULL,
  appointment_date date,
  appointment_time character varying(10) DEFAULT ''::character varying NOT NULL,
  appointment_address text DEFAULT ''::text NOT NULL,
  appointment_contact character varying(255) DEFAULT ''::character varying NOT NULL,
  notified_at timestamp with time zone,
  reschedule_proposals jsonb,
  confirmed_at timestamp with time zone,
  utm_source character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_medium character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_campaign character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_content character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_term character varying(255) DEFAULT ''::character varying NOT NULL,
  reminder_sent_at timestamp with time zone,
  reminder_day_of_sent_at timestamp with time zone,
  followup_sent_at timestamp with time zone,
  sale_price numeric(10,2),
  sale_notes text,
  deposit_quoted numeric(10,2),
  deposit_paid_at timestamp with time zone,
  delivery_estimate date,
  deposit_payment_ref text,
  deposit_refunded_at timestamp with time zone,
  deposit_refund_ref text,
  entrega jsonb DEFAULT '{}'::jsonb NOT NULL,
  garantia_id text,
  garantia_precio numeric(10,2),
  entrega_direccion text,
  entrega_ciudad text,
  entrega_provincia text,
  entrega_cp text,
  escrow_coche numeric(10,2),
  escrow_fee numeric(10,2),
  escrow_garantia numeric(10,2),
  escrow_estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
  escrow_pagado_at timestamp with time zone,
  escrow_liberado_at timestamp with time zone,
  escrow_devuelto_at timestamp with time zone,
  verificado_alemania_at timestamp with time zone,
  escrow_impuesto numeric(10,2),
  liquidacion_at timestamp with time zone,
  servicios jsonb,
  factura_vendedor_pedida_at timestamp with time zone,
  factura_vendedor_pedida_a text,
  encargo_gestoria_enviado_at timestamp with time zone,
  encargo_gestoria_enviado_a text,
  reserva_preguntada_at timestamp with time zone,
  reserva_preguntada_a text,
  liquidacion_como character varying(20),
  escrow_transferido_at timestamp with time zone,
  plate character varying(16) DEFAULT ''::character varying NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_market_offers (
  id character varying(40) NOT NULL,
  portal character varying(60) DEFAULT ''::character varying NOT NULL,
  url character varying(1024) DEFAULT ''::character varying NOT NULL,
  brand character varying(100) DEFAULT ''::character varying NOT NULL,
  model character varying(120) DEFAULT ''::character varying NOT NULL,
  version character varying(180) DEFAULT ''::character varying NOT NULL,
  year integer,
  mileage integer,
  price numeric(12,2),
  fuel character varying(60) DEFAULT ''::character varying NOT NULL,
  transmission character varying(60) DEFAULT ''::character varying NOT NULL,
  color character varying(80) DEFAULT ''::character varying NOT NULL,
  location character varying(160) DEFAULT ''::character varying NOT NULL,
  images text DEFAULT '[]'::text NOT NULL,
  raw_payload text DEFAULT '{}'::text,
  scraped_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  listing_type character varying(40) DEFAULT ''::character varying NOT NULL,
  monthly_price numeric(18,2),
  finance_price numeric(18,2),
  province character varying(120) DEFAULT ''::character varying NOT NULL,
  city character varying(120) DEFAULT ''::character varying NOT NULL,
  image_url character varying(2000) DEFAULT ''::character varying NOT NULL,
  title character varying(500) DEFAULT ''::character varying NOT NULL,
  listed_at timestamp with time zone,
  source_updated_at timestamp with time zone,
  first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  body_type character varying(80) DEFAULT ''::character varying NOT NULL,
  environmental_label character varying(50) DEFAULT ''::character varying NOT NULL,
  doors integer,
  seats integer,
  power_cv integer,
  seller_type character varying(80) DEFAULT ''::character varying NOT NULL,
  dealer_name character varying(200) DEFAULT ''::character varying NOT NULL,
  warranty_months integer,
  traction character varying(100),
  displacement character varying(50),
  co2 character varying(50),
  next_itv character varying(50),
  power_kw integer,
  consumption numeric(6,2),
  enrich_tried_at timestamp without time zone,
  is_active boolean DEFAULT true NOT NULL,
  country character varying(2) DEFAULT 'ES'::character varying,
  market_price_es numeric,
  import_comps integer,
  import_cost numeric,
  import_margin numeric,
  import_margin_pct numeric,
  import_score numeric,
  import_published boolean DEFAULT false,
  import_locked boolean DEFAULT false,
  import_scored_at timestamp with time zone,
  last_checked_at timestamp with time zone,
  es_coche boolean,
  is_damaged boolean,
  damage_note text,
  had_accident boolean,
  price_is_net boolean,
  damage_checked_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS moveadvisor_marketplace_vo_offers (
  id character varying(64) NOT NULL,
  title text NOT NULL,
  brand character varying(120) NOT NULL,
  model character varying(140) NOT NULL,
  price numeric(12,2) NOT NULL,
  year integer,
  mileage integer,
  location character varying(160),
  color character varying(80),
  displacement integer,
  fuel character varying(80),
  power character varying(80),
  seller character varying(160),
  has_guarantee_seal boolean DEFAULT false,
  portal_score integer DEFAULT 80,
  warranty_months integer DEFAULT 0,
  description text,
  image_url text,
  source_url text,
  portal character varying(80),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  available_for_purchase boolean DEFAULT true,
  renting_available boolean DEFAULT false,
  renting_monthly numeric(10,2),
  renting_months integer DEFAULT 48,
  renting_km_year integer DEFAULT 15000,
  renting_12m numeric(10,2),
  renting_24m numeric(10,2),
  renting_36m numeric(10,2),
  renting_48m numeric(10,2),
  renting_60m numeric(10,2),
  image_urls text,
  seller_type character varying(20),
  has_stock_management boolean DEFAULT false,
  matricula character varying(20),
  peritaje_url text,
  view_count integer DEFAULT 0,
  sale_price numeric(12,2),
  internal_location character varying(160),
  version character varying(200),
  transmission character varying(80),
  provincia character varying(160),
  sold_at timestamp with time zone,
  renting_prices_json jsonb,
  carswise_fee numeric(10,2),
  vehicle_condition text DEFAULT 'usado'::text NOT NULL,
  seller_phone text DEFAULT ''::text NOT NULL,
  seller_contact text DEFAULT ''::text NOT NULL,
  body_type character varying(60),
  doors smallint,
  seats smallint,
  previous_owners smallint,
  has_service_book boolean,
  is_national boolean,
  equipment text,
  last_checked_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  brand_warranty_months smallint,
  enrich_tried_at timestamp with time zone,
  price_new numeric(12,2),
  price_new_year smallint,
  price_financed numeric
);

CREATE TABLE IF NOT EXISTS moveadvisor_marketplace_vo_units (
  id character varying(64) NOT NULL,
  offer_id character varying(64) NOT NULL,
  color character varying(80),
  mileage integer DEFAULT 0,
  status character varying(20) DEFAULT 'available'::character varying,
  notes text,
  rented_at timestamp with time zone,
  returned_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moveadvisor_model_aliases (
  id bigint DEFAULT nextval('moveadvisor_model_aliases_id_seq'::regclass) NOT NULL,
  brand_canonical_name text NOT NULL,
  canonical_name text NOT NULL,
  alias_name text NOT NULL,
  brand_key text DEFAULT normalize_alias_token(brand_canonical_name),
  canonical_key text DEFAULT normalize_alias_token(canonical_name),
  alias_key text DEFAULT normalize_alias_token(alias_name),
  source text DEFAULT 'manual'::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_offer_duplicates (
  offer_id text NOT NULL,
  canonical_id text NOT NULL,
  huella text NOT NULL,
  ubicaciones text[],
  apariciones jsonb,
  agrupado_en timestamp with time zone DEFAULT now() NOT NULL,
  agrupado_por text NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_offer_texts (
  offer_id text NOT NULL,
  portal text NOT NULL,
  descripcion text NOT NULL,
  capturado_en timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_provider_invoices (
  id character varying(40) NOT NULL,
  type character varying(40) NOT NULL,
  provider_name character varying(200),
  contract_id character varying(80),
  vehicle_title character varying(300),
  customer_name character varying(200),
  customer_email character varying(200),
  base_amount numeric(10,2),
  invoice_amount numeric(10,2),
  status character varying(20) DEFAULT 'pending'::character varying,
  issued_at timestamp with time zone DEFAULT now(),
  paid_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  direction character varying(10) DEFAULT 'emitted'::character varying NOT NULL,
  pdf_url text,
  invoice_date date,
  invoice_number character varying(40),
  iva_rate numeric(5,4) DEFAULT 0.21,
  rectifies_id character varying(40),
  cw_sent_at timestamp with time zone,
  regimen character varying(20) DEFAULT 'nacional'::character varying NOT NULL,
  autorepercusion numeric(5,4),
  iva_amount numeric(12,2),
  proveedor_id character varying(40)
);

CREATE TABLE IF NOT EXISTS moveadvisor_renting_contracts (
  id character varying(40) NOT NULL,
  lead_id character varying(80),
  offer_id character varying(80),
  user_email character varying(200),
  contact_name character varying(200),
  vehicle_title character varying(300),
  color character varying(80),
  quantity integer DEFAULT 1,
  duration_months integer,
  km_year integer,
  monthly_price numeric(10,2),
  start_date date,
  end_date date,
  status character varying(20) DEFAULT 'active'::character varying,
  idcar_id character varying(80),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moveadvisor_scraping_runs (
  id integer DEFAULT nextval('moveadvisor_scraping_runs_id_seq'::regclass) NOT NULL,
  portal character varying(60) DEFAULT ''::character varying NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  offers_found integer DEFAULT 0 NOT NULL,
  status character varying(30) DEFAULT 'ok'::character varying NOT NULL,
  error_msg text DEFAULT ''::text NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_service_requests (
  id character varying(64) NOT NULL,
  user_id character varying(64),
  user_email character varying(255) NOT NULL,
  vehicle_id character varying(64),
  vehicle_title character varying(255),
  service_type character varying(64) NOT NULL,
  preferred_partner character varying(64),
  preferred_province character varying(128),
  preferred_dates text,
  notes text,
  status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_sessions (
  id character varying(64) NOT NULL,
  user_id character varying(64) NOT NULL,
  token_hash character varying(200) NOT NULL,
  created_at timestamp with time zone NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  last_seen_at timestamp with time zone NOT NULL,
  user_agent character varying(255)
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_appointment_status_history (
  id bigint DEFAULT nextval('moveadvisor_user_appointment_status_history_id_seq'::regclass) NOT NULL,
  appointment_id character varying(64) NOT NULL,
  previous_status character varying(80) DEFAULT ''::character varying NOT NULL,
  next_status character varying(80) DEFAULT ''::character varying NOT NULL,
  changed_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_appointments (
  id character varying(64) NOT NULL,
  user_email character varying(255) NOT NULL,
  vehicle_id character varying(64) NOT NULL,
  appointment_type character varying(40) NOT NULL,
  title character varying(180) NOT NULL,
  meta text DEFAULT ''::text NOT NULL,
  status character varying(80) DEFAULT 'Pendiente'::character varying NOT NULL,
  requested_at_text character varying(60) DEFAULT ''::character varying NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  user_id character varying(64)
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_consents (
  id bigint DEFAULT nextval('moveadvisor_user_consents_id_seq'::regclass) NOT NULL,
  user_email text NOT NULL,
  tipo text NOT NULL,
  concedido boolean NOT NULL,
  ocurrio_en timestamp with time zone DEFAULT now() NOT NULL,
  origen text,
  ip text,
  user_agent text
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_insurance_documents (
  id bigint DEFAULT nextval('moveadvisor_user_insurance_documents_id_seq'::regclass) NOT NULL,
  insurance_id character varying(64) NOT NULL,
  file_name character varying(255) NOT NULL,
  file_size bigint DEFAULT 0 NOT NULL,
  file_mime_type text DEFAULT ''::text NOT NULL,
  file_content_base64 text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_insurances (
  id character varying(64) NOT NULL,
  user_email character varying(255) NOT NULL,
  vehicle_id character varying(64) NOT NULL,
  provider character varying(140) DEFAULT ''::character varying NOT NULL,
  policy_number character varying(80) DEFAULT ''::character varying NOT NULL,
  coverage_type character varying(80) DEFAULT ''::character varying NOT NULL,
  status character varying(40) DEFAULT 'active'::character varying NOT NULL,
  renewal_at_text character varying(60) DEFAULT ''::character varying NOT NULL,
  monthly_premium numeric(12,2),
  notes text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  user_id character varying(64)
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_invoices (
  id character varying(255) NOT NULL,
  email character varying(255) NOT NULL,
  number character varying(128),
  date timestamp with time zone,
  amount numeric(10,2),
  status character varying(32),
  pdf_url text,
  created_at timestamp with time zone DEFAULT now(),
  cw_invoice_number character varying(40),
  cw_pdf_url text,
  cw_sent_at timestamp with time zone,
  cw_generated_at timestamp with time zone,
  cw_paid_at timestamp with time zone,
  description text DEFAULT ''::text,
  suplidos jsonb
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_maintenance_invoices (
  id bigint DEFAULT nextval('moveadvisor_user_maintenance_invoices_id_seq'::regclass) NOT NULL,
  maintenance_id character varying(64) NOT NULL,
  file_name character varying(255) NOT NULL,
  file_size bigint DEFAULT 0 NOT NULL,
  file_mime_type text DEFAULT ''::text NOT NULL,
  file_content_base64 text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_maintenances (
  id character varying(64) NOT NULL,
  user_email character varying(255) NOT NULL,
  vehicle_id character varying(64) NOT NULL,
  maintenance_type character varying(60) DEFAULT 'maintenance'::character varying NOT NULL,
  title character varying(180) NOT NULL,
  status character varying(80) DEFAULT 'Pendiente'::character varying NOT NULL,
  scheduled_at_text character varying(60) DEFAULT ''::character varying NOT NULL,
  workshop_name character varying(140) DEFAULT ''::character varying NOT NULL,
  mileage_text character varying(40) DEFAULT ''::character varying NOT NULL,
  estimated_cost numeric(12,2),
  notes text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  user_id character varying(64)
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_market_alert_status (
  alert_id character varying(64) NOT NULL,
  user_email character varying(255) NOT NULL,
  seen_count integer DEFAULT 0 NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_market_alerts (
  id character varying(64) NOT NULL,
  user_email character varying(255) NOT NULL,
  user_id character varying(64),
  title character varying(255) DEFAULT ''::character varying NOT NULL,
  mode character varying(30) DEFAULT 'buy'::character varying NOT NULL,
  brand character varying(100) DEFAULT ''::character varying NOT NULL,
  model character varying(120) DEFAULT ''::character varying NOT NULL,
  max_price character varying(40) DEFAULT ''::character varying NOT NULL,
  max_mileage character varying(40) DEFAULT ''::character varying NOT NULL,
  fuel character varying(60) DEFAULT ''::character varying NOT NULL,
  location character varying(160) DEFAULT ''::character varying NOT NULL,
  color character varying(60) DEFAULT ''::character varying NOT NULL,
  notify_by_email boolean DEFAULT false NOT NULL,
  alert_email character varying(255) DEFAULT ''::character varying NOT NULL,
  status character varying(30) DEFAULT 'active'::character varying NOT NULL,
  alert_payload text DEFAULT '{}'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_preferences (
  user_email character varying(255) NOT NULL,
  user_id character varying(64),
  full_name character varying(120) DEFAULT ''::character varying NOT NULL,
  language character varying(10) DEFAULT 'es'::character varying NOT NULL,
  region character varying(10) DEFAULT 'es'::character varying NOT NULL,
  notify_price_alerts boolean DEFAULT true NOT NULL,
  notify_appointments boolean DEFAULT true NOT NULL,
  notify_analysis_ready boolean DEFAULT true NOT NULL,
  weekly_digest boolean DEFAULT true NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_saved_comparisons (
  id character varying(64) NOT NULL,
  user_email character varying(255) NOT NULL,
  user_id character varying(64),
  title character varying(255) DEFAULT ''::character varying NOT NULL,
  mode character varying(30) DEFAULT 'buy'::character varying NOT NULL,
  comparison_payload text DEFAULT '{}'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_saved_offers (
  id character varying(80) NOT NULL,
  user_email character varying(255) NOT NULL,
  vehicle_id character varying(64),
  title character varying(180) DEFAULT ''::character varying NOT NULL,
  offer_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  user_id character varying(64)
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_valuations (
  id character varying(64) NOT NULL,
  user_email character varying(255) NOT NULL,
  vehicle_id character varying(64),
  title character varying(180) NOT NULL,
  meta text DEFAULT ''::text NOT NULL,
  status character varying(100) DEFAULT 'Ultima tasacion disponible'::character varying NOT NULL,
  report text DEFAULT ''::text NOT NULL,
  estimate_value numeric(12,2),
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  user_id character varying(64),
  pdf_path character varying(400) DEFAULT ''::character varying NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_characteristics (
  vehicle_id character varying(64) NOT NULL,
  transmission_type character varying(40) DEFAULT ''::character varying NOT NULL,
  cv character varying(20) DEFAULT ''::character varying NOT NULL,
  color character varying(60) DEFAULT ''::character varying NOT NULL,
  horsepower character varying(20) DEFAULT ''::character varying NOT NULL,
  seats character varying(10) DEFAULT ''::character varying NOT NULL,
  doors character varying(10) DEFAULT ''::character varying NOT NULL,
  vehicle_location character varying(160) DEFAULT ''::character varying NOT NULL,
  body_type character varying(60) DEFAULT ''::character varying NOT NULL,
  environmental_label character varying(30) DEFAULT ''::character varying NOT NULL,
  last_itv character varying(40) DEFAULT ''::character varying NOT NULL,
  next_itv character varying(40) DEFAULT ''::character varying NOT NULL,
  co2 character varying(30) DEFAULT ''::character varying NOT NULL,
  price character varying(40) DEFAULT ''::character varying NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_documents (
  id bigint DEFAULT nextval('moveadvisor_user_vehicle_documents_id_seq'::regclass) NOT NULL,
  vehicle_id character varying(64) NOT NULL,
  document_type character varying(40) NOT NULL,
  file_name character varying(255) NOT NULL,
  file_size bigint DEFAULT 0 NOT NULL,
  file_mime_type text DEFAULT ''::text NOT NULL,
  file_content_base64 text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  file_url text DEFAULT ''::text NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_files (
  id bigint DEFAULT nextval('moveadvisor_user_vehicle_files_id_seq'::regclass) NOT NULL,
  vehicle_id character varying(64) NOT NULL,
  file_type character varying(20) NOT NULL,
  file_name character varying(255) NOT NULL,
  file_size bigint DEFAULT 0 NOT NULL,
  created_at timestamp with time zone NOT NULL,
  file_mime_type text DEFAULT ''::text NOT NULL,
  file_content_base64 text DEFAULT ''::text NOT NULL,
  file_url text DEFAULT ''::text NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicle_states (
  id bigint DEFAULT nextval('moveadvisor_user_vehicle_states_id_seq'::regclass) NOT NULL,
  user_email character varying(255) NOT NULL,
  vehicle_id character varying(64) NOT NULL,
  state character varying(30) NOT NULL,
  listing_url text DEFAULT ''::text NOT NULL,
  notes text DEFAULT ''::text NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  user_id character varying(64),
  is_listed boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_user_vehicles (
  id character varying(64) NOT NULL,
  user_email character varying(255) NOT NULL,
  title character varying(180) NOT NULL,
  brand character varying(100) NOT NULL,
  model character varying(120) NOT NULL,
  year character varying(20) DEFAULT ''::character varying NOT NULL,
  plate character varying(30) DEFAULT ''::character varying NOT NULL,
  mileage character varying(40) DEFAULT ''::character varying NOT NULL,
  fuel character varying(60) DEFAULT ''::character varying NOT NULL,
  policy_company character varying(120) DEFAULT ''::character varying NOT NULL,
  notes text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  version character varying(160) DEFAULT ''::character varying NOT NULL,
  transmission_type character varying(40) DEFAULT ''::character varying NOT NULL,
  cv character varying(20) DEFAULT ''::character varying NOT NULL,
  color character varying(60) DEFAULT ''::character varying NOT NULL,
  horsepower character varying(20) DEFAULT ''::character varying NOT NULL,
  seats character varying(10) DEFAULT ''::character varying NOT NULL,
  doors character varying(10) DEFAULT ''::character varying NOT NULL,
  vehicle_location character varying(160) DEFAULT ''::character varying NOT NULL,
  body_type character varying(60) DEFAULT ''::character varying NOT NULL,
  environmental_label character varying(30) DEFAULT ''::character varying NOT NULL,
  last_itv character varying(40) DEFAULT ''::character varying NOT NULL,
  next_itv character varying(40) DEFAULT ''::character varying NOT NULL,
  co2 character varying(30) DEFAULT ''::character varying NOT NULL,
  price character varying(40) DEFAULT ''::character varying NOT NULL,
  marketplace_pricing_mode character varying(30) DEFAULT 'manual'::character varying NOT NULL,
  user_id character varying(64),
  year_int smallint,
  mileage_km integer,
  price_amount numeric(12,2),
  co2_g_km numeric(10,2),
  last_itv_date date,
  next_itv_date date,
  sold_at timestamp with time zone,
  purchased_from character varying(50) DEFAULT ''::character varying NOT NULL,
  source_lead_id character varying(64) DEFAULT ''::character varying NOT NULL,
  renting_contract_id character varying(40),
  renting_end_date date,
  renting_monthly_price numeric(10,2),
  renting_km_year integer,
  renting_duration_months integer,
  service_book character varying(16) DEFAULT ''::character varying NOT NULL,
  official_service character varying(16) DEFAULT ''::character varying NOT NULL,
  last_service_date character varying(40) DEFAULT ''::character varying NOT NULL,
  last_service_km character varying(40) DEFAULT ''::character varying NOT NULL,
  displacement character varying(16)
);

CREATE TABLE IF NOT EXISTS moveadvisor_users (
  id character varying(64) NOT NULL,
  name character varying(120) NOT NULL,
  email character varying(255) NOT NULL,
  password_salt character varying(64) NOT NULL,
  password_hash character varying(200) NOT NULL,
  created_at timestamp with time zone NOT NULL,
  last_login_at timestamp with time zone NOT NULL,
  plan_id character varying(20) DEFAULT 'free'::character varying NOT NULL,
  plan_status character varying(20) DEFAULT 'inactivo'::character varying NOT NULL,
  plan_updated_at timestamp with time zone,
  stripe_subscription_id character varying(100),
  next_billing_date timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false NOT NULL,
  stripe_customer_id character varying(100),
  apellidos character varying(160) DEFAULT ''::character varying NOT NULL,
  phone character varying(30) DEFAULT ''::character varying NOT NULL,
  company_name text DEFAULT ''::text,
  tax_id text DEFAULT ''::text,
  billing_address text DEFAULT ''::text,
  iban text DEFAULT ''::text,
  profile_updated_at timestamp with time zone,
  consent_legal_at timestamp with time zone,
  consent_marketing_at timestamp with time zone,
  consent_experian_at timestamp with time zone,
  registration_ip character varying(64) DEFAULT ''::character varying NOT NULL,
  registration_ua text DEFAULT ''::text NOT NULL,
  utm_source character varying(200) DEFAULT ''::character varying NOT NULL,
  utm_medium character varying(200) DEFAULT ''::character varying NOT NULL,
  utm_campaign character varying(200) DEFAULT ''::character varying NOT NULL,
  utm_content character varying(200) DEFAULT ''::character varying NOT NULL,
  affiliate_data jsonb,
  referer text DEFAULT ''::text NOT NULL,
  landing_url text DEFAULT ''::text NOT NULL,
  language character varying(20) DEFAULT ''::character varying NOT NULL,
  consents_reviewed_at timestamp with time zone,
  consent_marketing_email_at timestamp with time zone,
  consent_marketing_sms_at timestamp with time zone,
  consent_thirdparty_email_at timestamp with time zone,
  consent_thirdparty_sms_at timestamp with time zone,
  client_type character varying(20) DEFAULT 'individual'::character varying NOT NULL,
  billing_street character varying(300) DEFAULT ''::character varying NOT NULL,
  billing_postal_code character varying(10) DEFAULT ''::character varying NOT NULL,
  billing_province character varying(100) DEFAULT ''::character varying NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_alerts (
  id character varying(64) NOT NULL,
  email character varying(255) NOT NULL,
  vehicle_url text NOT NULL,
  vehicle_title character varying(255) DEFAULT ''::character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  notified_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_brands (
  id integer DEFAULT nextval('moveadvisor_vehicle_brands_id_seq'::regclass) NOT NULL,
  name character varying(100) NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_brands_copia_20260822 (
  id integer,
  name character varying(100),
  is_active boolean,
  sort_order integer
);

CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_condition_reports (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id character varying(64) NOT NULL,
  capture_vehicle_uuid uuid NOT NULL,
  capture_session_id uuid NOT NULL,
  capture_url text DEFAULT ''::text NOT NULL,
  status character varying(32) DEFAULT 'iniciada'::character varying NOT NULL,
  created_by_email character varying(255),
  expires_at timestamp with time zone,
  status_checked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  notified_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_models (
  id integer DEFAULT nextval('moveadvisor_vehicle_models_id_seq'::regclass) NOT NULL,
  brand_id integer NOT NULL,
  name character varying(120) NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_models_copia_20260822 (
  id integer,
  brand_id integer,
  name character varying(120),
  is_active boolean,
  sort_order integer
);

CREATE TABLE IF NOT EXISTS moveadvisor_verify_runs (
  id bigint DEFAULT nextval('moveadvisor_verify_runs_id_seq'::regclass) NOT NULL,
  portal text NOT NULL,
  run_at timestamp with time zone DEFAULT now() NOT NULL,
  checked integer DEFAULT 0 NOT NULL,
  alive integer DEFAULT 0 NOT NULL,
  deactivated integer DEFAULT 0 NOT NULL,
  unclassified integer DEFAULT 0 NOT NULL,
  transient integer DEFAULT 0 NOT NULL,
  blocked boolean DEFAULT false NOT NULL,
  wait_seconds integer
);

CREATE TABLE IF NOT EXISTS moveadvisor_viewing_appointments (
  id character varying(64) NOT NULL,
  offer_id character varying(255) NOT NULL,
  vehicle_title character varying(255) DEFAULT ''::character varying NOT NULL,
  vehicle_image text DEFAULT ''::text NOT NULL,
  buyer_email character varying(255) NOT NULL,
  buyer_name character varying(255) DEFAULT ''::character varying NOT NULL,
  buyer_message text DEFAULT ''::text NOT NULL,
  seller_email character varying(255) NOT NULL,
  status character varying(40) DEFAULT 'pending_seller'::character varying NOT NULL,
  proposed_slots jsonb DEFAULT '[]'::jsonb NOT NULL,
  confirmed_slot timestamp with time zone,
  token_seller character varying(64),
  token_buyer character varying(64),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS sell_report_telemetry (
  id bigint DEFAULT nextval('sell_report_telemetry_id_seq'::regclass) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  brand text,
  model text,
  slope_km double precision,
  slope_year double precision,
  usage_used_default boolean,
  usage_impact integer,
  raw_usage_impact integer,
  med_km integer,
  med_yr integer,
  n integer,
  used_fallback boolean,
  cascade_relaxed jsonb,
  damage_factor double precision,
  effective_factor double precision,
  market_median integer,
  depreciation_estimate integer,
  usage_segment text,
  segment_matched boolean,
  model_version text DEFAULT ''::text NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_visit_availability (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  offer_id text NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  status character varying(20) DEFAULT 'available'::character varying NOT NULL,
  source character varying(20) DEFAULT 'marketplace'::character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_visit_bookings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  availability_id uuid,
  offer_id text NOT NULL,
  vehicle_title text DEFAULT ''::text NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  buyer_email text NOT NULL,
  buyer_name text DEFAULT ''::text NOT NULL,
  buyer_phone text DEFAULT ''::text NOT NULL,
  seller_email text,
  status character varying(20) NOT NULL,
  token_buyer text DEFAULT (gen_random_uuid())::text NOT NULL,
  token_seller text DEFAULT (gen_random_uuid())::text NOT NULL,
  notes text DEFAULT ''::text,
  source character varying(20) DEFAULT 'marketplace'::character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  reminder_sent_at timestamp with time zone,
  reminder_day_of_sent_at timestamp with time zone,
  followup_sent_at timestamp with time zone,
  meeting_place text DEFAULT ''::text NOT NULL,
  meeting_contact text DEFAULT ''::text NOT NULL,
  resultado text,
  resultado_at timestamp with time zone,
  quiere_financiar boolean DEFAULT false NOT NULL,
  utm_source character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_medium character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_campaign character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_content character varying(255) DEFAULT ''::character varying NOT NULL,
  utm_term character varying(255) DEFAULT ''::character varying NOT NULL,
  financiacion_llamada_at timestamp with time zone,
  financiacion_llamada_por text DEFAULT ''::text NOT NULL,
  financiacion_resultado text,
  financiacion_entidad text DEFAULT ''::text NOT NULL,
  financiacion_importe numeric,
  financiacion_cerrada_at timestamp with time zone,
  financiacion_cerrada_por text DEFAULT ''::text NOT NULL,
  recordatorio_resultado_at timestamp with time zone,
  recordatorio_vendedor_at timestamp with time zone,
  recordatorio_horas_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS visit_booking_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  booking_id uuid NOT NULL,
  evento text NOT NULL,
  actor text DEFAULT 'sistema'::text NOT NULL,
  datos jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS workshop_locations (
  id integer DEFAULT nextval('workshop_locations_id_seq'::regclass) NOT NULL,
  partner character varying(64) DEFAULT 'norauto'::character varying NOT NULL,
  osm_id character varying(64),
  name character varying(255) NOT NULL,
  address text,
  city character varying(128),
  postcode character varying(16),
  province character varying(128),
  lat double precision,
  lon double precision,
  phone character varying(64),
  website character varying(512),
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  service_type character varying(64),
  source character varying(32) DEFAULT 'osm'::character varying,
  external_id character varying(128),
  rating numeric(3,1),
  rating_count integer,
  opening_hours jsonb,
  photos jsonb,
  enriched_at timestamp with time zone,
  service_types text[] DEFAULT '{}'::text[],
  business_hours text
);

-- --------------------------------------------------------------------------
-- Claves, únicos, comprobaciones y relaciones
--
-- `ADD CONSTRAINT` no entiende de IF NOT EXISTS, así que cada una se
-- pregunta antes si ya está. Así el fichero se puede aplicar sobre la base
-- que ya existe sin que pase nada.
-- --------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_anuncios_de_portal_pkey') THEN
    ALTER TABLE erp_anuncios_de_portal ADD CONSTRAINT erp_anuncios_de_portal_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_appointments_pkey') THEN
    ALTER TABLE erp_appointments ADD CONSTRAINT erp_appointments_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_audit_log_pkey') THEN
    ALTER TABLE erp_audit_log ADD CONSTRAINT erp_audit_log_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_calculos_guardados_pkey') THEN
    ALTER TABLE erp_calculos_guardados ADD CONSTRAINT erp_calculos_guardados_pkey PRIMARY KEY (clave);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_documentos_pkey') THEN
    ALTER TABLE erp_documentos ADD CONSTRAINT erp_documentos_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_encargos_venta_pkey') THEN
    ALTER TABLE erp_encargos_venta ADD CONSTRAINT erp_encargos_venta_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_gastos_pedido_pkey') THEN
    ALTER TABLE erp_gastos_pedido ADD CONSTRAINT erp_gastos_pedido_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_inventory_pkey') THEN
    ALTER TABLE erp_inventory ADD CONSTRAINT erp_inventory_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_invoices_pkey') THEN
    ALTER TABLE erp_invoices ADD CONSTRAINT erp_invoices_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_kpis_pkey') THEN
    ALTER TABLE erp_kpis ADD CONSTRAINT erp_kpis_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_lead_documentos_pkey') THEN
    ALTER TABLE erp_lead_documentos ADD CONSTRAINT erp_lead_documentos_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_lead_history_pkey') THEN
    ALTER TABLE erp_lead_history ADD CONSTRAINT erp_lead_history_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_leads_pkey') THEN
    ALTER TABLE erp_leads ADD CONSTRAINT erp_leads_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_password_resets_pkey') THEN
    ALTER TABLE erp_password_resets ADD CONSTRAINT erp_password_resets_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_pedido_history_pkey') THEN
    ALTER TABLE erp_pedido_history ADD CONSTRAINT erp_pedido_history_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_pedidos_pkey') THEN
    ALTER TABLE erp_pedidos ADD CONSTRAINT erp_pedidos_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_peritacion_danos_pkey') THEN
    ALTER TABLE erp_peritacion_danos ADD CONSTRAINT erp_peritacion_danos_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_peritaciones_pkey') THEN
    ALTER TABLE erp_peritaciones ADD CONSTRAINT erp_peritaciones_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_proveedores_pkey') THEN
    ALTER TABLE erp_proveedores ADD CONSTRAINT erp_proveedores_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_refresh_tokens_pkey') THEN
    ALTER TABLE erp_refresh_tokens ADD CONSTRAINT erp_refresh_tokens_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_revisiones_taller_pkey') THEN
    ALTER TABLE erp_revisiones_taller ADD CONSTRAINT erp_revisiones_taller_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_staff_pkey') THEN
    ALTER TABLE erp_staff ADD CONSTRAINT erp_staff_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_staff_passwords_pkey') THEN
    ALTER TABLE erp_staff_passwords ADD CONSTRAINT erp_staff_passwords_pkey PRIMARY KEY (email);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_tarifas_gestoria_pkey') THEN
    ALTER TABLE erp_tarifas_gestoria ADD CONSTRAINT erp_tarifas_gestoria_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_tarifas_transporte_pkey') THEN
    ALTER TABLE erp_tarifas_transporte ADD CONSTRAINT erp_tarifas_transporte_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_ticket_events_pkey') THEN
    ALTER TABLE erp_ticket_events ADD CONSTRAINT erp_ticket_events_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_tickets_pkey') THEN
    ALTER TABLE erp_tickets ADD CONSTRAINT erp_tickets_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_tramite_history_pkey') THEN
    ALTER TABLE erp_tramite_history ADD CONSTRAINT erp_tramite_history_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_tramites_pkey') THEN
    ALTER TABLE erp_tramites ADD CONSTRAINT erp_tramites_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_transporte_history_pkey') THEN
    ALTER TABLE erp_transporte_history ADD CONSTRAINT erp_transporte_history_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_transportes_pkey') THEN
    ALTER TABLE erp_transportes ADD CONSTRAINT erp_transportes_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_user_status_overrides_pkey') THEN
    ALTER TABLE erp_user_status_overrides ADD CONSTRAINT erp_user_status_overrides_pkey PRIMARY KEY (user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_users_pkey') THEN
    ALTER TABLE erp_users ADD CONSTRAINT erp_users_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_vendedores_marketplace_pkey') THEN
    ALTER TABLE erp_vendedores_marketplace ADD CONSTRAINT erp_vendedores_marketplace_pkey PRIMARY KEY (nombre);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_workshops_pkey') THEN
    ALTER TABLE erp_workshops ADD CONSTRAINT erp_workshops_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'funnel_outreach_pkey') THEN
    ALTER TABLE funnel_outreach ADD CONSTRAINT funnel_outreach_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_alert_notifications_pkey') THEN
    ALTER TABLE market_alert_notifications ADD CONSTRAINT market_alert_notifications_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_alerts_pkey') THEN
    ALTER TABLE market_alerts ADD CONSTRAINT market_alerts_pkey PRIMARY KEY (id, user_email);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_garantia_coberturas_pkey') THEN
    ALTER TABLE market_garantia_coberturas ADD CONSTRAINT market_garantia_coberturas_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_garantias_pkey') THEN
    ALTER TABLE market_garantias ADD CONSTRAINT market_garantias_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_brand_aliases_pkey') THEN
    ALTER TABLE moveadvisor_brand_aliases ADD CONSTRAINT moveadvisor_brand_aliases_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_brand_sweeps_pkey') THEN
    ALTER TABLE moveadvisor_brand_sweeps ADD CONSTRAINT moveadvisor_brand_sweeps_pkey PRIMARY KEY (portal, brand);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_cursores_pkey') THEN
    ALTER TABLE moveadvisor_cursores ADD CONSTRAINT moveadvisor_cursores_pkey PRIMARY KEY (clave);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_erp_brands_pkey') THEN
    ALTER TABLE moveadvisor_erp_brands ADD CONSTRAINT moveadvisor_erp_brands_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_erp_models_pkey') THEN
    ALTER TABLE moveadvisor_erp_models ADD CONSTRAINT moveadvisor_erp_models_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_erp_versions_pkey') THEN
    ALTER TABLE moveadvisor_erp_versions ADD CONSTRAINT moveadvisor_erp_versions_pkey PRIMARY KEY (codversion);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_field_overrides_pkey') THEN
    ALTER TABLE moveadvisor_field_overrides ADD CONSTRAINT moveadvisor_field_overrides_pkey PRIMARY KEY (offer_id, field);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_funnel_events_pkey') THEN
    ALTER TABLE moveadvisor_funnel_events ADD CONSTRAINT moveadvisor_funnel_events_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_invoice_counters_pkey') THEN
    ALTER TABLE moveadvisor_invoice_counters ADD CONSTRAINT moveadvisor_invoice_counters_pkey PRIMARY KEY (series, year);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_market_leads_pkey') THEN
    ALTER TABLE moveadvisor_market_leads ADD CONSTRAINT moveadvisor_market_leads_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_market_offers_pkey') THEN
    ALTER TABLE moveadvisor_market_offers ADD CONSTRAINT moveadvisor_market_offers_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_marketplace_vo_offers_pkey') THEN
    ALTER TABLE moveadvisor_marketplace_vo_offers ADD CONSTRAINT moveadvisor_marketplace_vo_offers_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_marketplace_vo_units_pkey') THEN
    ALTER TABLE moveadvisor_marketplace_vo_units ADD CONSTRAINT moveadvisor_marketplace_vo_units_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_model_aliases_pkey') THEN
    ALTER TABLE moveadvisor_model_aliases ADD CONSTRAINT moveadvisor_model_aliases_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_offer_duplicates_pkey') THEN
    ALTER TABLE moveadvisor_offer_duplicates ADD CONSTRAINT moveadvisor_offer_duplicates_pkey PRIMARY KEY (offer_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_offer_texts_pkey') THEN
    ALTER TABLE moveadvisor_offer_texts ADD CONSTRAINT moveadvisor_offer_texts_pkey PRIMARY KEY (offer_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_provider_invoices_pkey') THEN
    ALTER TABLE moveadvisor_provider_invoices ADD CONSTRAINT moveadvisor_provider_invoices_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_renting_contracts_pkey') THEN
    ALTER TABLE moveadvisor_renting_contracts ADD CONSTRAINT moveadvisor_renting_contracts_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_scraping_runs_pkey') THEN
    ALTER TABLE moveadvisor_scraping_runs ADD CONSTRAINT moveadvisor_scraping_runs_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_service_requests_pkey') THEN
    ALTER TABLE moveadvisor_service_requests ADD CONSTRAINT moveadvisor_service_requests_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_sessions_pkey') THEN
    ALTER TABLE moveadvisor_sessions ADD CONSTRAINT moveadvisor_sessions_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_appointment_status_history_pkey') THEN
    ALTER TABLE moveadvisor_user_appointment_status_history ADD CONSTRAINT moveadvisor_user_appointment_status_history_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_appointments_pkey') THEN
    ALTER TABLE moveadvisor_user_appointments ADD CONSTRAINT moveadvisor_user_appointments_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_consents_pkey') THEN
    ALTER TABLE moveadvisor_user_consents ADD CONSTRAINT moveadvisor_user_consents_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_insurance_documents_pkey') THEN
    ALTER TABLE moveadvisor_user_insurance_documents ADD CONSTRAINT moveadvisor_user_insurance_documents_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_insurances_pkey') THEN
    ALTER TABLE moveadvisor_user_insurances ADD CONSTRAINT moveadvisor_user_insurances_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_invoices_pkey') THEN
    ALTER TABLE moveadvisor_user_invoices ADD CONSTRAINT moveadvisor_user_invoices_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_maintenance_invoices_pkey') THEN
    ALTER TABLE moveadvisor_user_maintenance_invoices ADD CONSTRAINT moveadvisor_user_maintenance_invoices_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_maintenances_pkey') THEN
    ALTER TABLE moveadvisor_user_maintenances ADD CONSTRAINT moveadvisor_user_maintenances_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_market_alert_status_pkey') THEN
    ALTER TABLE moveadvisor_user_market_alert_status ADD CONSTRAINT moveadvisor_user_market_alert_status_pkey PRIMARY KEY (alert_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_market_alerts_pkey') THEN
    ALTER TABLE moveadvisor_user_market_alerts ADD CONSTRAINT moveadvisor_user_market_alerts_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_preferences_pkey') THEN
    ALTER TABLE moveadvisor_user_preferences ADD CONSTRAINT moveadvisor_user_preferences_pkey PRIMARY KEY (user_email);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_saved_comparisons_pkey') THEN
    ALTER TABLE moveadvisor_user_saved_comparisons ADD CONSTRAINT moveadvisor_user_saved_comparisons_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_saved_offers_pkey') THEN
    ALTER TABLE moveadvisor_user_saved_offers ADD CONSTRAINT moveadvisor_user_saved_offers_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_valuations_pkey') THEN
    ALTER TABLE moveadvisor_user_valuations ADD CONSTRAINT moveadvisor_user_valuations_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_characteristics_pkey') THEN
    ALTER TABLE moveadvisor_user_vehicle_characteristics ADD CONSTRAINT moveadvisor_user_vehicle_characteristics_pkey PRIMARY KEY (vehicle_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_documents_pkey') THEN
    ALTER TABLE moveadvisor_user_vehicle_documents ADD CONSTRAINT moveadvisor_user_vehicle_documents_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_files_pkey') THEN
    ALTER TABLE moveadvisor_user_vehicle_files ADD CONSTRAINT moveadvisor_user_vehicle_files_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_states_pkey') THEN
    ALTER TABLE moveadvisor_user_vehicle_states ADD CONSTRAINT moveadvisor_user_vehicle_states_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicles_pkey') THEN
    ALTER TABLE moveadvisor_user_vehicles ADD CONSTRAINT moveadvisor_user_vehicles_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_users_pkey') THEN
    ALTER TABLE moveadvisor_users ADD CONSTRAINT moveadvisor_users_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_vehicle_alerts_pkey') THEN
    ALTER TABLE moveadvisor_vehicle_alerts ADD CONSTRAINT moveadvisor_vehicle_alerts_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_vehicle_brands_pkey') THEN
    ALTER TABLE moveadvisor_vehicle_brands ADD CONSTRAINT moveadvisor_vehicle_brands_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_vehicle_condition_reports_pkey') THEN
    ALTER TABLE moveadvisor_vehicle_condition_reports ADD CONSTRAINT moveadvisor_vehicle_condition_reports_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_vehicle_models_pkey') THEN
    ALTER TABLE moveadvisor_vehicle_models ADD CONSTRAINT moveadvisor_vehicle_models_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_verify_runs_pkey') THEN
    ALTER TABLE moveadvisor_verify_runs ADD CONSTRAINT moveadvisor_verify_runs_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_viewing_appointments_pkey') THEN
    ALTER TABLE moveadvisor_viewing_appointments ADD CONSTRAINT moveadvisor_viewing_appointments_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sell_report_telemetry_pkey') THEN
    ALTER TABLE sell_report_telemetry ADD CONSTRAINT sell_report_telemetry_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_visit_availability_pkey') THEN
    ALTER TABLE vehicle_visit_availability ADD CONSTRAINT vehicle_visit_availability_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_visit_bookings_pkey') THEN
    ALTER TABLE vehicle_visit_bookings ADD CONSTRAINT vehicle_visit_bookings_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visit_booking_events_pkey') THEN
    ALTER TABLE visit_booking_events ADD CONSTRAINT visit_booking_events_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workshop_locations_pkey') THEN
    ALTER TABLE workshop_locations ADD CONSTRAINT workshop_locations_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_password_resets_token_key') THEN
    ALTER TABLE erp_password_resets ADD CONSTRAINT erp_password_resets_token_key UNIQUE (token);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_refresh_tokens_token_key') THEN
    ALTER TABLE erp_refresh_tokens ADD CONSTRAINT erp_refresh_tokens_token_key UNIQUE (token);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_staff_email_key') THEN
    ALTER TABLE erp_staff ADD CONSTRAINT erp_staff_email_key UNIQUE (email);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'funnel_outreach_anon_id_key') THEN
    ALTER TABLE funnel_outreach ADD CONSTRAINT funnel_outreach_anon_id_key UNIQUE (anon_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_alert_notifications_alert_id_user_email_offer_id_key') THEN
    ALTER TABLE market_alert_notifications ADD CONSTRAINT market_alert_notifications_alert_id_user_email_offer_id_key UNIQUE (alert_id, user_email, offer_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_moveadvisor_brand_aliases_alias_key') THEN
    ALTER TABLE moveadvisor_brand_aliases ADD CONSTRAINT uq_moveadvisor_brand_aliases_alias_key UNIQUE (alias_key);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_moveadvisor_model_aliases_brand_alias') THEN
    ALTER TABLE moveadvisor_model_aliases ADD CONSTRAINT uq_moveadvisor_model_aliases_brand_alias UNIQUE (brand_key, alias_key);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_insurances_user_email_vehicle_id_key') THEN
    ALTER TABLE moveadvisor_user_insurances ADD CONSTRAINT moveadvisor_user_insurances_user_email_vehicle_id_key UNIQUE (user_email, vehicle_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_states_user_email_vehicle_id_key') THEN
    ALTER TABLE moveadvisor_user_vehicle_states ADD CONSTRAINT moveadvisor_user_vehicle_states_user_email_vehicle_id_key UNIQUE (user_email, vehicle_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_users_email_key') THEN
    ALTER TABLE moveadvisor_users ADD CONSTRAINT moveadvisor_users_email_key UNIQUE (email);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_vehicle_condition_reports_capture_session_id_key') THEN
    ALTER TABLE moveadvisor_vehicle_condition_reports ADD CONSTRAINT moveadvisor_vehicle_condition_reports_capture_session_id_key UNIQUE (capture_session_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workshop_locations_osm_id_key') THEN
    ALTER TABLE workshop_locations ADD CONSTRAINT workshop_locations_osm_id_key UNIQUE (osm_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_relacion_del_proveedor') THEN
    ALTER TABLE erp_proveedores ADD CONSTRAINT chk_relacion_del_proveedor CHECK (((relacion IS NULL) OR (relacion = ANY (ARRAY['sede'::text, 'filial'::text]))));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_marketplace_vo_offers_vehicle_condition_check') THEN
    ALTER TABLE moveadvisor_marketplace_vo_offers ADD CONSTRAINT moveadvisor_marketplace_vo_offers_vehicle_condition_check CHECK ((vehicle_condition = ANY (ARRAY['usado'::text, 'nuevo'::text, 'km0'::text])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_scraping_runs_status_check') THEN
    ALTER TABLE moveadvisor_scraping_runs ADD CONSTRAINT moveadvisor_scraping_runs_status_check CHECK (((status)::text = ANY ((ARRAY['ok'::character varying, 'error'::character varying, 'partial'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_market_alert_status_seen_count_check') THEN
    ALTER TABLE moveadvisor_user_market_alert_status ADD CONSTRAINT moveadvisor_user_market_alert_status_seen_count_check CHECK ((seen_count >= 0));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_market_alerts_status_check') THEN
    ALTER TABLE moveadvisor_user_market_alerts ADD CONSTRAINT moveadvisor_user_market_alerts_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'deleted'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_documents_document_type_check') THEN
    ALTER TABLE moveadvisor_user_vehicle_documents ADD CONSTRAINT moveadvisor_user_vehicle_documents_document_type_check CHECK (((document_type)::text = ANY ((ARRAY['technical_sheet'::character varying, 'circulation_permit'::character varying, 'itv'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_files_file_type_check') THEN
    ALTER TABLE moveadvisor_user_vehicle_files ADD CONSTRAINT moveadvisor_user_vehicle_files_file_type_check CHECK (((file_type)::text = ANY ((ARRAY['photo'::character varying, 'document'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_states_state_check') THEN
    ALTER TABLE moveadvisor_user_vehicle_states ADD CONSTRAINT moveadvisor_user_vehicle_states_state_check CHECK (((state)::text = ANY ((ARRAY['owned'::character varying, 'active_sale'::character varying, 'sold'::character varying])::text[])));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_moveadvisor_user_vehicles_mileage_km_valid') THEN
    ALTER TABLE moveadvisor_user_vehicles ADD CONSTRAINT ck_moveadvisor_user_vehicles_mileage_km_valid CHECK (((mileage_km IS NULL) OR (mileage_km >= 0)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_moveadvisor_user_vehicles_price_amount_valid') THEN
    ALTER TABLE moveadvisor_user_vehicles ADD CONSTRAINT ck_moveadvisor_user_vehicles_price_amount_valid CHECK (((price_amount IS NULL) OR (price_amount >= (0)::numeric)));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_moveadvisor_user_vehicles_year_int_valid') THEN
    ALTER TABLE moveadvisor_user_vehicles ADD CONSTRAINT ck_moveadvisor_user_vehicles_year_int_valid CHECK (((year_int IS NULL) OR ((year_int >= 1950) AND (year_int <= 2100))));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_resultado_de_la_visita') THEN
    ALTER TABLE vehicle_visit_bookings ADD CONSTRAINT chk_resultado_de_la_visita CHECK (((resultado IS NULL) OR (resultado = ANY (ARRAY['no_fue'::text, 'fue'::text, 'compro'::text]))));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_ticket') THEN
    ALTER TABLE erp_ticket_events ADD CONSTRAINT fk_event_ticket FOREIGN KEY (ticket_id) REFERENCES erp_tickets(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ticket_user') THEN
    ALTER TABLE erp_tickets ADD CONSTRAINT fk_ticket_user FOREIGN KEY (user_id) REFERENCES erp_users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_erp_models_brand_id_fkey') THEN
    ALTER TABLE moveadvisor_erp_models ADD CONSTRAINT moveadvisor_erp_models_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES moveadvisor_erp_brands(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_erp_versions_brand_id_fkey') THEN
    ALTER TABLE moveadvisor_erp_versions ADD CONSTRAINT moveadvisor_erp_versions_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES moveadvisor_erp_brands(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_erp_versions_model_id_fkey') THEN
    ALTER TABLE moveadvisor_erp_versions ADD CONSTRAINT moveadvisor_erp_versions_model_id_fkey FOREIGN KEY (model_id) REFERENCES moveadvisor_erp_models(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_marketplace_vo_units_offer_id_fkey') THEN
    ALTER TABLE moveadvisor_marketplace_vo_units ADD CONSTRAINT moveadvisor_marketplace_vo_units_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES moveadvisor_marketplace_vo_offers(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_sessions_user_id') THEN
    ALTER TABLE moveadvisor_sessions ADD CONSTRAINT fk_moveadvisor_sessions_user_id FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_appointment_status_history_appointment_id_fkey') THEN
    ALTER TABLE moveadvisor_user_appointment_status_history ADD CONSTRAINT moveadvisor_user_appointment_status_history_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES moveadvisor_user_appointments(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_appointments_user_id') THEN
    ALTER TABLE moveadvisor_user_appointments ADD CONSTRAINT fk_moveadvisor_user_appointments_user_id FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_appointments_vehicle_id_fkey') THEN
    ALTER TABLE moveadvisor_user_appointments ADD CONSTRAINT moveadvisor_user_appointments_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_insurance_documents_insurance_id_fkey') THEN
    ALTER TABLE moveadvisor_user_insurance_documents ADD CONSTRAINT moveadvisor_user_insurance_documents_insurance_id_fkey FOREIGN KEY (insurance_id) REFERENCES moveadvisor_user_insurances(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_insurances_user_id') THEN
    ALTER TABLE moveadvisor_user_insurances ADD CONSTRAINT fk_moveadvisor_user_insurances_user_id FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_insurances_vehicle_id_fkey') THEN
    ALTER TABLE moveadvisor_user_insurances ADD CONSTRAINT moveadvisor_user_insurances_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_maintenance_invoices_maintenance_id_fkey') THEN
    ALTER TABLE moveadvisor_user_maintenance_invoices ADD CONSTRAINT moveadvisor_user_maintenance_invoices_maintenance_id_fkey FOREIGN KEY (maintenance_id) REFERENCES moveadvisor_user_maintenances(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_maintenances_user_id') THEN
    ALTER TABLE moveadvisor_user_maintenances ADD CONSTRAINT fk_moveadvisor_user_maintenances_user_id FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_maintenances_vehicle_id_fkey') THEN
    ALTER TABLE moveadvisor_user_maintenances ADD CONSTRAINT moveadvisor_user_maintenances_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_market_alert_status_alert') THEN
    ALTER TABLE moveadvisor_user_market_alert_status ADD CONSTRAINT fk_market_alert_status_alert FOREIGN KEY (alert_id) REFERENCES moveadvisor_user_market_alerts(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_saved_offers_user_id') THEN
    ALTER TABLE moveadvisor_user_saved_offers ADD CONSTRAINT fk_moveadvisor_user_saved_offers_user_id FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_saved_offers_vehicle_id_fkey') THEN
    ALTER TABLE moveadvisor_user_saved_offers ADD CONSTRAINT moveadvisor_user_saved_offers_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_valuations_user_id') THEN
    ALTER TABLE moveadvisor_user_valuations ADD CONSTRAINT fk_moveadvisor_user_valuations_user_id FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_characteristics_vehicle_id_fkey') THEN
    ALTER TABLE moveadvisor_user_vehicle_characteristics ADD CONSTRAINT moveadvisor_user_vehicle_characteristics_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_documents_vehicle_id_fkey') THEN
    ALTER TABLE moveadvisor_user_vehicle_documents ADD CONSTRAINT moveadvisor_user_vehicle_documents_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_files_vehicle_id_fkey') THEN
    ALTER TABLE moveadvisor_user_vehicle_files ADD CONSTRAINT moveadvisor_user_vehicle_files_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_vehicle_states_user_id') THEN
    ALTER TABLE moveadvisor_user_vehicle_states ADD CONSTRAINT fk_moveadvisor_user_vehicle_states_user_id FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_user_vehicle_states_vehicle_id_fkey') THEN
    ALTER TABLE moveadvisor_user_vehicle_states ADD CONSTRAINT moveadvisor_user_vehicle_states_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_moveadvisor_user_vehicles_user_id') THEN
    ALTER TABLE moveadvisor_user_vehicles ADD CONSTRAINT fk_moveadvisor_user_vehicles_user_id FOREIGN KEY (user_id) REFERENCES moveadvisor_users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_vehicle_condition_reports_vehicle_id_fkey') THEN
    ALTER TABLE moveadvisor_vehicle_condition_reports ADD CONSTRAINT moveadvisor_vehicle_condition_reports_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moveadvisor_vehicle_models_brand_id_fkey') THEN
    ALTER TABLE moveadvisor_vehicle_models ADD CONSTRAINT moveadvisor_vehicle_models_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES moveadvisor_vehicle_brands(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_visit_bookings_availability_id_fkey') THEN
    ALTER TABLE vehicle_visit_bookings ADD CONSTRAINT vehicle_visit_bookings_availability_id_fkey FOREIGN KEY (availability_id) REFERENCES vehicle_visit_availability(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visit_booking_events_booking_id_fkey') THEN
    ALTER TABLE visit_booking_events ADD CONSTRAINT visit_booking_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES vehicle_visit_bookings(id) ON DELETE CASCADE;
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- Índices
-- --------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS ux_anuncio_vivo_por_coche_y_portal ON public.erp_anuncios_de_portal USING btree (vehicle_id, portal) WHERE (retirado_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_erp_audit_log_resource ON public.erp_audit_log USING btree (resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_documentos_ambito ON public.erp_documentos USING btree (ambito, ambito_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_encargo_vivo_por_coche ON public.erp_encargos_venta USING btree (vehicle_id) WHERE (cerrado_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_gastos_pedido ON public.erp_gastos_pedido USING btree (pedido_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_documentos_lead ON public.erp_lead_documentos USING btree (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON public.erp_pedidos USING btree (estado, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_lead ON public.erp_pedidos USING btree (lead_id) WHERE (lead_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_peritacion_danos_peritacion ON public.erp_peritacion_danos USING btree (peritacion_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_peritaciones_lead ON public.erp_peritaciones USING btree (lead_id) WHERE (lead_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedores_clave ON public.erp_proveedores USING btree (clave);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedores_nif ON public.erp_proveedores USING btree (nif) WHERE ((nif <> ''::text) AND (COALESCE(relacion, ''::text) <> 'sede'::text));
CREATE UNIQUE INDEX IF NOT EXISTS ux_revision_viva_por_coche ON public.erp_revisiones_taller USING btree (vehicle_id) WHERE (estado <> 'Hecha'::text);
CREATE INDEX IF NOT EXISTS idx_erp_staff_email ON public.erp_staff USING btree (lower(email));
CREATE INDEX IF NOT EXISTS idx_tarifas_gestoria_prov ON public.erp_tarifas_gestoria USING btree (proveedor_id, tramite);
CREATE INDEX IF NOT EXISTS idx_tarifas_corredor ON public.erp_tarifas_transporte USING btree (origen_pais, destino_pais, proveedor_id);
CREATE INDEX IF NOT EXISTS idx_erp_ticket_events_ticket ON public.erp_ticket_events USING btree (ticket_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tramites_encargo_tipo ON public.erp_tramites USING btree (encargo_id, tipo) WHERE (encargo_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_tramites_estado ON public.erp_tramites USING btree (estado, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tramites_lead_tipo ON public.erp_tramites USING btree (lead_id, tipo) WHERE (lead_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tramites_pedido_tipo ON public.erp_tramites USING btree (pedido_id, tipo) WHERE (pedido_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_transportes_estado ON public.erp_transportes USING btree (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_garantia_coberturas ON public.market_garantia_coberturas USING btree (garantia_id, orden);
CREATE UNIQUE INDEX IF NOT EXISTS idx_garantias_una_base ON public.market_garantias USING btree ((true)) WHERE (es_base AND activo);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_brand_aliases_canonical_key ON public.moveadvisor_brand_aliases USING btree (canonical_key);
CREATE INDEX IF NOT EXISTS ix_brand_sweeps_turno ON public.moveadvisor_brand_sweeps USING btree (portal, swept_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_erp_brands_name ON public.moveadvisor_erp_brands USING btree (name);
CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_erp_models_brand_name ON public.moveadvisor_erp_models USING btree (brand_id, name);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_erp_versions_brand_model ON public.moveadvisor_erp_versions USING btree (brand_id, model_id);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_erp_versions_label ON public.moveadvisor_erp_versions USING btree (label);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_erp_versions_model ON public.moveadvisor_erp_versions USING btree (model_id);
CREATE INDEX IF NOT EXISTS idx_market_offers_danados ON public.moveadvisor_market_offers USING btree (country, is_damaged) WHERE ((country)::text = 'DE'::text);
CREATE INDEX IF NOT EXISTS idx_market_offers_danos_pendientes ON public.moveadvisor_market_offers USING btree (damage_checked_at) WHERE (((country)::text = 'DE'::text) AND is_active AND (is_damaged IS NULL));
CREATE INDEX IF NOT EXISTS idx_mmo_bm_lower ON public.moveadvisor_market_offers USING btree (lower((brand)::text), lower((model)::text), year);
CREATE INDEX IF NOT EXISTS idx_mmo_country ON public.moveadvisor_market_offers USING btree (country);
CREATE INDEX IF NOT EXISTS ix_market_last_checked ON public.moveadvisor_market_offers USING btree (last_checked_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS ix_market_offers_active ON public.moveadvisor_market_offers USING btree (portal, is_active);
CREATE INDEX IF NOT EXISTS ix_market_offers_brand_model ON public.moveadvisor_market_offers USING btree (brand, model);
CREATE INDEX IF NOT EXISTS ix_market_offers_portal ON public.moveadvisor_market_offers USING btree (portal);
CREATE INDEX IF NOT EXISTS ix_market_offers_price ON public.moveadvisor_market_offers USING btree (price);
CREATE INDEX IF NOT EXISTS ix_market_offers_url ON public.moveadvisor_market_offers USING btree (url);
CREATE INDEX IF NOT EXISTS ix_offers_no_es_coche ON public.moveadvisor_market_offers USING btree (portal) WHERE (es_coche IS FALSE);
CREATE INDEX IF NOT EXISTS idx_vo_offers_vehicle_condition ON public.moveadvisor_marketplace_vo_offers USING btree (vehicle_condition);
CREATE INDEX IF NOT EXISTS ix_marketplace_vo_offers_active ON public.moveadvisor_marketplace_vo_offers USING btree (is_active, portal_score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_marketplace_vo_offers_brand_model ON public.moveadvisor_marketplace_vo_offers USING btree (brand, model);
CREATE INDEX IF NOT EXISTS ix_marketplace_vo_offers_price ON public.moveadvisor_marketplace_vo_offers USING btree (price);
CREATE INDEX IF NOT EXISTS ix_marketplace_vo_por_enriquecer ON public.moveadvisor_marketplace_vo_offers USING btree (portal, enrich_tried_at NULLS FIRST) WHERE is_active;
CREATE INDEX IF NOT EXISTS ix_marketplace_vo_por_verificar ON public.moveadvisor_marketplace_vo_offers USING btree (portal, last_checked_at NULLS FIRST) WHERE is_active;
CREATE INDEX IF NOT EXISTS ix_vo_units_offer_id ON public.moveadvisor_marketplace_vo_units USING btree (offer_id, status);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_model_aliases_brand_canonical_key ON public.moveadvisor_model_aliases USING btree (brand_key, canonical_key);
CREATE INDEX IF NOT EXISTS ix_dups_canonical ON public.moveadvisor_offer_duplicates USING btree (canonical_id);
CREATE INDEX IF NOT EXISTS ix_dups_solo_canonicos ON public.moveadvisor_offer_duplicates USING btree (offer_id) WHERE (offer_id = canonical_id);
CREATE INDEX IF NOT EXISTS ix_dups_ubicaciones ON public.moveadvisor_offer_duplicates USING gin (ubicaciones);
CREATE INDEX IF NOT EXISTS ix_offer_texts_portal ON public.moveadvisor_offer_texts USING btree (portal);
CREATE INDEX IF NOT EXISTS ix_provider_invoices_status ON public.moveadvisor_provider_invoices USING btree (status, issued_at DESC);
CREATE INDEX IF NOT EXISTS ix_renting_contracts_user ON public.moveadvisor_renting_contracts USING btree (user_email, status);
CREATE INDEX IF NOT EXISTS ix_scraping_runs_portal ON public.moveadvisor_scraping_runs USING btree (portal, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_svc_req_email ON public.moveadvisor_service_requests USING btree (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_svc_req_status ON public.moveadvisor_service_requests USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_sessions_expires_at ON public.moveadvisor_sessions USING btree (expires_at);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_sessions_user_id ON public.moveadvisor_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_appointment_status_history_appointment ON public.moveadvisor_user_appointment_status_history USING btree (appointment_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_appointments_email ON public.moveadvisor_user_appointments USING btree (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_appointments_user_id ON public.moveadvisor_user_appointments USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moveadvisor_user_consents_quien ON public.moveadvisor_user_consents USING btree (lower(user_email), tipo, ocurrio_en DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_insurance_documents_insurance ON public.moveadvisor_user_insurance_documents USING btree (insurance_id);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_insurances_email ON public.moveadvisor_user_insurances USING btree (user_email, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_insurances_user_id ON public.moveadvisor_user_insurances USING btree (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_invoices_email ON public.moveadvisor_user_invoices USING btree (lower((email)::text));
CREATE INDEX IF NOT EXISTS ix_moveadvisor_maintenance_invoices_maintenance ON public.moveadvisor_user_maintenance_invoices USING btree (maintenance_id);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_maintenances_email ON public.moveadvisor_user_maintenances USING btree (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_maintenances_user_id ON public.moveadvisor_user_maintenances USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_user_market_alert_status_email ON public.moveadvisor_user_market_alert_status USING btree (user_email);
CREATE INDEX IF NOT EXISTS ix_user_market_alerts_email ON public.moveadvisor_user_market_alerts USING btree (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_user_market_alerts_user_id ON public.moveadvisor_user_market_alerts USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_user_saved_comparisons_email ON public.moveadvisor_user_saved_comparisons USING btree (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_user_saved_comparisons_user_id ON public.moveadvisor_user_saved_comparisons USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_saved_offers_email ON public.moveadvisor_user_saved_offers USING btree (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_saved_offers_user_id ON public.moveadvisor_user_saved_offers USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_valuations_user_id ON public.moveadvisor_user_valuations USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_valuations_email ON public.moveadvisor_user_valuations USING btree (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_documents_vehicle ON public.moveadvisor_user_vehicle_documents USING btree (vehicle_id, document_type);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_files_vehicle ON public.moveadvisor_user_vehicle_files USING btree (vehicle_id, file_type);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_vehicle_states_user_id ON public.moveadvisor_user_vehicle_states USING btree (user_id, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_states_email ON public.moveadvisor_user_vehicle_states USING btree (user_email, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_vehicles_email ON public.moveadvisor_user_vehicles USING btree (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_user_vehicles_user_id ON public.moveadvisor_user_vehicles USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_users_email ON public.moveadvisor_users USING btree (email);
CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_brands_name ON public.moveadvisor_vehicle_brands USING btree (name);
CREATE INDEX IF NOT EXISTS ix_moveadvisor_condition_reports_vehicle ON public.moveadvisor_vehicle_condition_reports USING btree (vehicle_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_vehicle_models_brand_name ON public.moveadvisor_vehicle_models USING btree (brand_id, name);
CREATE INDEX IF NOT EXISTS ix_verify_runs_portal_fecha ON public.moveadvisor_verify_runs USING btree (portal, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_srt_brand_model ON public.sell_report_telemetry USING btree (brand, model);
CREATE INDEX IF NOT EXISTS idx_srt_created_at ON public.sell_report_telemetry USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_srt_model_version ON public.sell_report_telemetry USING btree (model_version);
CREATE INDEX IF NOT EXISTS idx_srt_used_fallback ON public.sell_report_telemetry USING btree (used_fallback);
CREATE INDEX IF NOT EXISTS idx_vva_offer_status ON public.vehicle_visit_availability USING btree (offer_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_visit_bookings_recordatorios ON public.vehicle_visit_bookings USING btree (starts_at) WHERE ((status)::text = 'confirmed'::text);
CREATE INDEX IF NOT EXISTS idx_vvb_buyer ON public.vehicle_visit_bookings USING btree (buyer_email);
CREATE INDEX IF NOT EXISTS idx_vvb_offer ON public.vehicle_visit_bookings USING btree (offer_id);
CREATE INDEX IF NOT EXISTS idx_vvb_seller ON public.vehicle_visit_bookings USING btree (seller_email);
CREATE INDEX IF NOT EXISTS idx_vvb_token_b ON public.vehicle_visit_bookings USING btree (token_buyer);
CREATE INDEX IF NOT EXISTS idx_vvb_token_s ON public.vehicle_visit_bookings USING btree (token_seller);
CREATE INDEX IF NOT EXISTS idx_visit_booking_events_reserva ON public.visit_booking_events USING btree (booking_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workshop_locations_partner ON public.workshop_locations USING btree (partner);
CREATE INDEX IF NOT EXISTS idx_workshop_locations_province ON public.workshop_locations USING btree (province);
CREATE INDEX IF NOT EXISTS idx_workshop_partner ON public.workshop_locations USING btree (partner);
CREATE INDEX IF NOT EXISTS idx_workshop_province ON public.workshop_locations USING btree (province);
CREATE INDEX IF NOT EXISTS idx_workshop_service ON public.workshop_locations USING btree (service_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workshop_source_extid ON public.workshop_locations USING btree (source, external_id);
