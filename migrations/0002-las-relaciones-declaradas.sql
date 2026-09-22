-- --------------------------------------------------------------------------
-- 0002 · Las relaciones, declaradas
--
-- La base tenía 41 columnas que son una relación —`lead_id`, `vehicle_id`,
-- `proveedor_id`— y solo unas pocas estaban declaradas como tales. Mientras no
-- lo están, la base deja escribir un pedido de un lead que no existe y deja
-- borrar un lead dejando huérfanos su historial, sus documentos y sus trámites.
-- Nadie se entera hasta que una pantalla enseña un hueco.
--
-- Aquí se declaran las 37 que los datos de hoy aguantan sin tocar una sola
-- fila. Comprobado antes con `node scripts/que-falta-por-normalizar.mjs`.
--
-- **Lo que cuelga se borra con su padre** (ON DELETE CASCADE): el historial de
-- un lead, los gastos de un pedido, los daños de una peritación. Esas filas no
-- significan nada solas.
--
-- **Lo demás no deja borrar al padre** (el comportamiento por omisión): un lead
-- con un pedido detrás no se borra por accidente. Si de verdad hay que
-- borrarlo, primero se decide qué pasa con el pedido.
--
-- ── Lo que NO se declara, y por qué ───────────────────────────────────────
--
-- Nada que apunte a `moveadvisor_market_offers`. Las ofertas son datos de
-- fuera: los scrapers las borran y las vuelven a escribir cada día. Una visita,
-- un lead o una corrección a mano tienen que sobrevivir a que la oferta
-- desaparezca del portal, y con una relación declarada no sobrevivirían: o
-- bloquearían al scraper o se borrarían con ella. Hoy ya hay 6.566 huecos de
-- visita apuntando a ofertas que ya no están, y eso es correcto.
-- --------------------------------------------------------------------------

-- ── Lo que cuelga de un lead ──────────────────────────────────────────────
ALTER TABLE erp_lead_documentos
  ADD CONSTRAINT fk_lead_documentos_lead
  FOREIGN KEY (lead_id) REFERENCES moveadvisor_market_leads (id) ON DELETE CASCADE;

ALTER TABLE erp_lead_history
  ADD CONSTRAINT fk_lead_history_lead
  FOREIGN KEY (lead_id) REFERENCES moveadvisor_market_leads (id) ON DELETE CASCADE;

-- ── Lo que cuelga de un pedido ────────────────────────────────────────────
ALTER TABLE erp_gastos_pedido
  ADD CONSTRAINT fk_gastos_pedido
  FOREIGN KEY (pedido_id) REFERENCES erp_pedidos (id) ON DELETE CASCADE;

ALTER TABLE erp_pedido_history
  ADD CONSTRAINT fk_pedido_history_pedido
  FOREIGN KEY (pedido_id) REFERENCES erp_pedidos (id) ON DELETE CASCADE;

-- ── Lo que cuelga de una peritación ───────────────────────────────────────
ALTER TABLE erp_peritacion_danos
  ADD CONSTRAINT fk_peritacion_danos
  FOREIGN KEY (peritacion_id) REFERENCES erp_peritaciones (id) ON DELETE CASCADE;

-- ── Lo que cuelga de un coche ─────────────────────────────────────────────
ALTER TABLE erp_anuncios_de_portal
  ADD CONSTRAINT fk_anuncios_vehiculo
  FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles (id) ON DELETE CASCADE;

-- ── Lo que cuelga de un usuario ───────────────────────────────────────────
ALTER TABLE erp_user_status_overrides
  ADD CONSTRAINT fk_status_override_usuario
  FOREIGN KEY (user_id) REFERENCES moveadvisor_users (id) ON DELETE CASCADE;

ALTER TABLE moveadvisor_user_market_alerts
  ADD CONSTRAINT fk_alertas_usuario
  FOREIGN KEY (user_id) REFERENCES moveadvisor_users (id) ON DELETE CASCADE;

ALTER TABLE moveadvisor_user_preferences
  ADD CONSTRAINT fk_preferencias_usuario
  FOREIGN KEY (user_id) REFERENCES moveadvisor_users (id) ON DELETE CASCADE;

ALTER TABLE moveadvisor_user_saved_comparisons
  ADD CONSTRAINT fk_comparaciones_usuario
  FOREIGN KEY (user_id) REFERENCES moveadvisor_users (id) ON DELETE CASCADE;

-- Un registro de embudo es un apunte de qué pasó: sobrevive al usuario, pero
-- sin quedarse apuntando a alguien que ya no está.
ALTER TABLE moveadvisor_funnel_events
  ADD CONSTRAINT fk_funnel_usuario
  FOREIGN KEY (user_id) REFERENCES moveadvisor_users (id) ON DELETE SET NULL;

-- Una tasación es un documento emitido: vale aunque el coche se borre.
ALTER TABLE moveadvisor_user_valuations
  ADD CONSTRAINT fk_tasacion_vehiculo
  FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles (id) ON DELETE SET NULL;

-- ── Lo que no se borra por detrás ─────────────────────────────────────────
ALTER TABLE erp_appointments
  ADD CONSTRAINT fk_cita_erp_usuario
  FOREIGN KEY (user_id) REFERENCES moveadvisor_users (id);

ALTER TABLE erp_encargos_venta
  ADD CONSTRAINT fk_encargo_lead
  FOREIGN KEY (lead_id) REFERENCES moveadvisor_market_leads (id);

ALTER TABLE erp_encargos_venta
  ADD CONSTRAINT fk_encargo_vehiculo
  FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles (id);

ALTER TABLE erp_pedidos
  ADD CONSTRAINT fk_pedido_lead
  FOREIGN KEY (lead_id) REFERENCES moveadvisor_market_leads (id);

ALTER TABLE erp_peritaciones
  ADD CONSTRAINT fk_peritacion_lead
  FOREIGN KEY (lead_id) REFERENCES moveadvisor_market_leads (id);

ALTER TABLE erp_revisiones_taller
  ADD CONSTRAINT fk_revision_encargo
  FOREIGN KEY (encargo_id) REFERENCES erp_encargos_venta (id);

ALTER TABLE erp_revisiones_taller
  ADD CONSTRAINT fk_revision_vehiculo
  FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles (id);

ALTER TABLE erp_tarifas_gestoria
  ADD CONSTRAINT fk_tarifa_gestoria_proveedor
  FOREIGN KEY (proveedor_id) REFERENCES erp_proveedores (id);

ALTER TABLE erp_tarifas_transporte
  ADD CONSTRAINT fk_tarifa_transporte_proveedor
  FOREIGN KEY (proveedor_id) REFERENCES erp_proveedores (id);

ALTER TABLE erp_tramites
  ADD CONSTRAINT fk_tramite_encargo
  FOREIGN KEY (encargo_id) REFERENCES erp_encargos_venta (id);

ALTER TABLE erp_tramites
  ADD CONSTRAINT fk_tramite_lead
  FOREIGN KEY (lead_id) REFERENCES moveadvisor_market_leads (id);

ALTER TABLE erp_tramites
  ADD CONSTRAINT fk_tramite_pedido
  FOREIGN KEY (pedido_id) REFERENCES erp_pedidos (id);

ALTER TABLE erp_transportes
  ADD CONSTRAINT fk_transporte_lead
  FOREIGN KEY (lead_id) REFERENCES moveadvisor_market_leads (id);

ALTER TABLE erp_transportes
  ADD CONSTRAINT fk_transporte_pedido
  FOREIGN KEY (pedido_id) REFERENCES erp_pedidos (id);

ALTER TABLE market_garantias
  ADD CONSTRAINT fk_garantia_proveedor
  FOREIGN KEY (proveedor_id) REFERENCES erp_proveedores (id);

ALTER TABLE moveadvisor_provider_invoices
  ADD CONSTRAINT fk_factura_proveedor
  FOREIGN KEY (proveedor_id) REFERENCES erp_proveedores (id);

ALTER TABLE moveadvisor_renting_contracts
  ADD CONSTRAINT fk_renting_lead
  FOREIGN KEY (lead_id) REFERENCES moveadvisor_market_leads (id);

ALTER TABLE moveadvisor_service_requests
  ADD CONSTRAINT fk_servicio_usuario
  FOREIGN KEY (user_id) REFERENCES moveadvisor_users (id);

ALTER TABLE moveadvisor_service_requests
  ADD CONSTRAINT fk_servicio_vehiculo
  FOREIGN KEY (vehicle_id) REFERENCES moveadvisor_user_vehicles (id);

-- ── Y un índice por cada relación nueva ───────────────────────────────────
--
-- Postgres indexa el lado al que se apunta, no el que apunta. Sin esto, borrar
-- un lead obliga a recorrer entera cada tabla que lo referencia.
CREATE INDEX IF NOT EXISTS ix_lead_documentos_lead    ON erp_lead_documentos (lead_id);
CREATE INDEX IF NOT EXISTS ix_lead_history_lead       ON erp_lead_history (lead_id);
CREATE INDEX IF NOT EXISTS ix_gastos_pedido_pedido    ON erp_gastos_pedido (pedido_id);
CREATE INDEX IF NOT EXISTS ix_pedido_history_pedido   ON erp_pedido_history (pedido_id);
CREATE INDEX IF NOT EXISTS ix_peritacion_danos_perit  ON erp_peritacion_danos (peritacion_id);
CREATE INDEX IF NOT EXISTS ix_anuncios_vehiculo       ON erp_anuncios_de_portal (vehicle_id);
CREATE INDEX IF NOT EXISTS ix_status_override_usuario ON erp_user_status_overrides (user_id);
CREATE INDEX IF NOT EXISTS ix_alertas_usuario         ON moveadvisor_user_market_alerts (user_id);
CREATE INDEX IF NOT EXISTS ix_preferencias_usuario    ON moveadvisor_user_preferences (user_id);
CREATE INDEX IF NOT EXISTS ix_comparaciones_usuario   ON moveadvisor_user_saved_comparisons (user_id);
CREATE INDEX IF NOT EXISTS ix_funnel_usuario          ON moveadvisor_funnel_events (user_id);
CREATE INDEX IF NOT EXISTS ix_tasacion_vehiculo       ON moveadvisor_user_valuations (vehicle_id);
CREATE INDEX IF NOT EXISTS ix_cita_erp_usuario        ON erp_appointments (user_id);
CREATE INDEX IF NOT EXISTS ix_encargo_lead            ON erp_encargos_venta (lead_id);
CREATE INDEX IF NOT EXISTS ix_encargo_vehiculo        ON erp_encargos_venta (vehicle_id);
CREATE INDEX IF NOT EXISTS ix_pedido_lead             ON erp_pedidos (lead_id);
CREATE INDEX IF NOT EXISTS ix_peritacion_lead         ON erp_peritaciones (lead_id);
CREATE INDEX IF NOT EXISTS ix_revision_encargo        ON erp_revisiones_taller (encargo_id);
CREATE INDEX IF NOT EXISTS ix_revision_vehiculo       ON erp_revisiones_taller (vehicle_id);
CREATE INDEX IF NOT EXISTS ix_tarifa_gestoria_prov    ON erp_tarifas_gestoria (proveedor_id);
CREATE INDEX IF NOT EXISTS ix_tarifa_transporte_prov  ON erp_tarifas_transporte (proveedor_id);
CREATE INDEX IF NOT EXISTS ix_tramite_encargo         ON erp_tramites (encargo_id);
CREATE INDEX IF NOT EXISTS ix_tramite_lead            ON erp_tramites (lead_id);
CREATE INDEX IF NOT EXISTS ix_tramite_pedido          ON erp_tramites (pedido_id);
CREATE INDEX IF NOT EXISTS ix_transporte_lead         ON erp_transportes (lead_id);
CREATE INDEX IF NOT EXISTS ix_transporte_pedido       ON erp_transportes (pedido_id);
CREATE INDEX IF NOT EXISTS ix_garantia_proveedor      ON market_garantias (proveedor_id);
CREATE INDEX IF NOT EXISTS ix_factura_proveedor       ON moveadvisor_provider_invoices (proveedor_id);
CREATE INDEX IF NOT EXISTS ix_renting_lead            ON moveadvisor_renting_contracts (lead_id);
CREATE INDEX IF NOT EXISTS ix_servicio_usuario        ON moveadvisor_service_requests (user_id);
CREATE INDEX IF NOT EXISTS ix_servicio_vehiculo       ON moveadvisor_service_requests (vehicle_id);
