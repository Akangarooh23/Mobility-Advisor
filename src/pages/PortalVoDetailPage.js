export default function PortalVoDetailPage({
  themeMode,
  styles,
  selectedPortalVoOffer,
  relatedPortalVoOffers,
  ResolvedOfferImage,
  getOfferBadgeStyle,
  getPortalVoEcoLabel,
  getPortalVoTransmission,
  buildPortalVoHighlights,
  buildPortalVoEquipment,
  formatCurrency,
  onBackToMarketplace,
  onGoHome,
  onOpenRelatedOffer,
}) {
  const isDark = themeMode === "dark";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#dbeafe" : "#334155";
  const metaColor = isDark ? "#93c5fd" : "#1d4ed8";
  const panelCardBg = isDark ? "rgba(15,23,42,0.3)" : "rgba(241,245,249,0.92)";
  const specCardBg = isDark ? "rgba(15,23,42,0.34)" : "rgba(248,250,252,0.96)";

  return (
    <div style={styles.center}>
      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>🚗 FICHA DEL VEHÍCULO</div>
      <div style={{ ...styles.panel, marginBottom: 18, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: isDark ? "#67e8f9" : "#0284c7", fontWeight: 800, letterSpacing: "0.6px", marginBottom: 4 }}>
              DETALLE DEL VEHÍCULO VO
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: titleColor }}>{selectedPortalVoOffer.title}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onBackToMarketplace}
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.95)",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(148,163,184,0.32)",
                color: isDark ? "#cbd5e1" : "#475569",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ← Volver al marketplace
            </button>
            <button
              type="button"
              onClick={onGoHome}
              style={{
                background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                border: "none",
                color: "#ffffff",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ⌂ Volver al inicio
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(148,163,184,0.16)", background: isDark ? "rgba(2,6,23,0.45)" : "rgba(248,250,252,0.96)" }}>
            <ResolvedOfferImage
              offer={selectedPortalVoOffer}
              alt={selectedPortalVoOffer.title}
              style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
            />
          </div>

          <div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={getOfferBadgeStyle(selectedPortalVoOffer.hasGuaranteeSeal ? "green" : "slate")}>
                {selectedPortalVoOffer.hasGuaranteeSeal ? `Garantía ${selectedPortalVoOffer.warrantyMonths} meses` : "Publicado por usuario"}
              </span>
              <span style={getOfferBadgeStyle("slate")}>{getPortalVoEcoLabel(selectedPortalVoOffer)}</span>
              <span style={getOfferBadgeStyle("slate")}>{selectedPortalVoOffer.color}</span>
            </div>

            <div style={{ fontSize: 28, fontWeight: 800, color: titleColor, marginBottom: 6 }}>
              {formatCurrency(selectedPortalVoOffer.price)}
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: bodyColor, lineHeight: 1.7 }}>
              {selectedPortalVoOffer.description} Unidad ubicada en {selectedPortalVoOffer.location}, con
              {` ${Number(selectedPortalVoOffer.mileage || 0).toLocaleString("es-ES")} km`} y motorización
              {` ${selectedPortalVoOffer.fuel.toLowerCase()}${selectedPortalVoOffer.power ? ` de ${selectedPortalVoOffer.power}` : ""}` }.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
              {[
                ["Año", selectedPortalVoOffer.year],
                ["Kilómetros", `${Number(selectedPortalVoOffer.mileage || 0).toLocaleString("es-ES")} km`],
                ["Combustible", selectedPortalVoOffer.fuel],
                ["Potencia", selectedPortalVoOffer.power],
                ["Cambio", getPortalVoTransmission(selectedPortalVoOffer)],
                ["Cilindrada", selectedPortalVoOffer.displacement > 0 ? `${selectedPortalVoOffer.displacement.toLocaleString("es-ES")} cc` : "EV"],
                ["Ubicación", selectedPortalVoOffer.location],
                ["Vendedor", selectedPortalVoOffer.seller],
              ].map(([label, value]) => (
                <div
                  key={`${selectedPortalVoOffer.id}-${label}`}
                  style={{
                    background: specCardBg,
                    border: "1px solid rgba(148,163,184,0.14)",
                    borderRadius: 12,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: 10, color: metaColor, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 12, color: titleColor, fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 16 }}>
          <div style={{ background: panelCardBg, border: "1px solid rgba(148,163,184,0.14)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: isDark ? "#60a5fa" : "#0369a1", fontWeight: 700, marginBottom: 8 }}>PUNTOS CLAVE</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: bodyColor, fontSize: 12, lineHeight: 1.7 }}>
              {buildPortalVoHighlights(selectedPortalVoOffer).map((item) => (
                <li key={`${selectedPortalVoOffer.id}-${item}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div style={{ background: panelCardBg, border: "1px solid rgba(148,163,184,0.14)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: isDark ? "#60a5fa" : "#0369a1", fontWeight: 700, marginBottom: 8 }}>CARACTERÍSTICAS / EQUIPAMIENTO</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {buildPortalVoEquipment(selectedPortalVoOffer).map((item) => (
                <span key={`${selectedPortalVoOffer.id}-feature-${item}`} style={getOfferBadgeStyle("slate")}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {relatedPortalVoOffers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 700, marginBottom: 8 }}>OTRAS UNIDADES RELACIONADAS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
              {relatedPortalVoOffers.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => onOpenRelatedOffer(offer)}
                  style={{
                    textAlign: "left",
                    background: panelCardBg,
                    border: "1px solid rgba(148,163,184,0.14)",
                    borderRadius: 12,
                    padding: 12,
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: titleColor, marginBottom: 4 }}>{offer.title}</div>
                  <div style={{ fontSize: 11, color: metaColor, marginBottom: 4 }}>{offer.year} · {offer.location}</div>
                  <div style={{ fontSize: 13, color: isDark ? "#34d399" : "#059669", fontWeight: 800 }}>{formatCurrency(offer.price)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
