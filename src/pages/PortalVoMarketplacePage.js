export default function PortalVoMarketplacePage({
  themeMode,
  styles,
  portalVoFilters,
  updatePortalVoFilter,
  portalVoLocations,
  portalVoColors,
  onResetFilters,
  featuredPortalVoOffers,
  filteredPortalVoOffers,
  ResolvedOfferImage,
  getOfferBadgeStyle,
  formatCurrency,
  onOpenOffer,
  onGoHome,
}) {
  const isDark = themeMode === "dark";
  const titleColor = isDark ? "#f1f5f9" : "#0f172a";
  const bodyColor = isDark ? "#94a3b8" : "#475569";
  const cardBg = isDark ? "rgba(15,23,42,0.34)" : "rgba(255,255,255,0.96)";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.16)" : "1px solid rgba(148,163,184,0.26)";

  return (
    <div style={styles.center}>
      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>🏪 MARKETPLACE VO DEL PORTAL</div>
      <h2
        style={{
          fontSize: "clamp(22px,4vw,30px)",
          fontWeight: 800,
          letterSpacing: "-1px",
          margin: "0 0 10px",
          color: titleColor,
        }}
      >
        Ofertas VO únicas de nuestro portal
      </h2>
      <p style={{ color: bodyColor, fontSize: 14, lineHeight: 1.7, margin: "0 0 16px" }}>
        Aquí ves un escaparate con vehículos publicados por usuarios del portal. Arriba priorizamos
        las unidades con mejor puntuación y <strong>sello de garantía CarsWise</strong>.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 20px" }}>
        <button
          type="button"
          onClick={onGoHome}
          style={{
            background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
            border: "none",
            color: "#ffffff",
            padding: "11px 16px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 10px 24px rgba(37,99,235,0.18)",
          }}
        >
          ⌂ Volver al home
        </button>
      </div>

      <div style={{ ...styles.panel, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 10, letterSpacing: "0.6px" }}>
          FILTROS DEL MARKETPLACE
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          <input
            value={portalVoFilters.query}
            onChange={(event) => updatePortalVoFilter("query", event.target.value)}
            placeholder="Marca, modelo o versión"
            style={styles.input}
          />
          <select
            value={portalVoFilters.maxPrice}
            onChange={(event) => updatePortalVoFilter("maxPrice", event.target.value)}
            style={styles.select}
          >
            <option value="">Precio máximo</option>
            <option value="15000">Hasta 15.000 €</option>
            <option value="20000">Hasta 20.000 €</option>
            <option value="25000">Hasta 25.000 €</option>
            <option value="30000">Hasta 30.000 €</option>
            <option value="40000">Hasta 40.000 €</option>
          </select>
          <select
            value={portalVoFilters.minYear}
            onChange={(event) => updatePortalVoFilter("minYear", event.target.value)}
            style={styles.select}
          >
            <option value="">Año mínimo</option>
            {[2024, 2023, 2022, 2021, 2020, 2019].map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select
            value={portalVoFilters.maxMileage}
            onChange={(event) => updatePortalVoFilter("maxMileage", event.target.value)}
            style={styles.select}
          >
            <option value="">Kilometraje máximo</option>
            <option value="20000">Hasta 20.000 km</option>
            <option value="40000">Hasta 40.000 km</option>
            <option value="60000">Hasta 60.000 km</option>
            <option value="80000">Hasta 80.000 km</option>
            <option value="120000">Hasta 120.000 km</option>
          </select>
          <select
            value={portalVoFilters.location}
            onChange={(event) => updatePortalVoFilter("location", event.target.value)}
            style={styles.select}
          >
            <option value="">Ubicación</option>
            {portalVoLocations.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
          <select
            value={portalVoFilters.color}
            onChange={(event) => updatePortalVoFilter("color", event.target.value)}
            style={styles.select}
          >
            <option value="">Color</option>
            {portalVoColors.map((color) => (
              <option key={color} value={color}>{color}</option>
            ))}
          </select>
          <select
            value={portalVoFilters.displacement}
            onChange={(event) => updatePortalVoFilter("displacement", event.target.value)}
            style={styles.select}
          >
            <option value="">Cilindrada</option>
            <option value="electric">Eléctrico / sin cilindrada</option>
            <option value="0_1200">Hasta 1.200 cc</option>
            <option value="1200_1600">1.200 - 1.600 cc</option>
            <option value="1600_2000">1.600 - 2.000 cc</option>
            <option value="2000_plus">Más de 2.000 cc</option>
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12, color: isDark ? "#dbeafe" : "#334155", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={portalVoFilters.onlyGuaranteed}
              onChange={(event) => updatePortalVoFilter("onlyGuaranteed", event.target.checked)}
            />
            Solo con sello de garantía
          </label>
          <button
            type="button"
            onClick={onResetFilters}
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
            Limpiar filtros
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: isDark ? "#6ee7b7" : "#059669", marginBottom: 8, fontWeight: 800, letterSpacing: "0.6px" }}>
          ⭐ MEJOR PUNTUADOS CON SELLO CARSWISE
        </div>
        {featuredPortalVoOffers.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            {featuredPortalVoOffers.map((offer) => (
              <div
                key={offer.id}
                onClick={() => onOpenOffer(offer)}
                title="Ver ficha completa"
                style={{
                  position: "relative",
                  background: isDark
                    ? "linear-gradient(135deg,rgba(22,163,74,0.16),rgba(16,185,129,0.08) 45%,rgba(5,150,105,0.16))"
                    : "linear-gradient(135deg,rgba(236,253,245,0.98),rgba(220,252,231,0.96) 45%,rgba(209,250,229,0.96))",
                  border: isDark ? "1px solid rgba(74,222,128,0.55)" : "1px solid rgba(16,185,129,0.36)",
                  boxShadow: isDark ? "0 10px 28px rgba(22,163,74,0.14)" : "0 10px 28px rgba(16,185,129,0.12)",
                  borderRadius: 14,
                  overflow: "hidden",
                  cursor: "pointer",
                  animation: "portalGlowGreen 2.6s ease-in-out infinite",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(120deg,transparent 0%,rgba(187,247,208,0.04) 35%,rgba(74,222,128,0.18) 50%,transparent 65%)",
                    transform: "translateX(-120%)",
                    animation: "portalShine 3.4s linear infinite",
                    pointerEvents: "none",
                    zIndex: 0,
                  }}
                />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <ResolvedOfferImage
                    offer={offer}
                    alt={offer.title}
                    style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }}
                  />
                </div>
                <div style={{ padding: 12, position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a" }}>{offer.title}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? "#6ee7b7" : "#059669" }}>{offer.portalScore}/100</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={getOfferBadgeStyle("success")}>Sello de garantía</span>
                    <span style={getOfferBadgeStyle("info")}>{offer.warrantyMonths} meses</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 6 }}>
                    {formatCurrency(offer.price)}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? "#cbd5e1" : "#334155", lineHeight: 1.6 }}>
                    {offer.year} · {Number(offer.mileage).toLocaleString("es-ES")} km · {offer.location}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: isDark ? "#dbeafe" : "#334155", lineHeight: 1.6 }}>
                    {offer.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.panel}>No hay vehículos con sello para esos filtros ahora mismo.</div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#93c5fd", fontWeight: 800, letterSpacing: "0.6px" }}>
            🚗 TODAS LAS OFERTAS DEL PORTAL
          </div>
          <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#475569" }}>{filteredPortalVoOffers.length} resultados</div>
        </div>

        {filteredPortalVoOffers.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12 }}>
            {filteredPortalVoOffers.map((offer) => (
              <div
                key={offer.id}
                onClick={() => onOpenOffer(offer)}
                title="Ver ficha completa"
                style={{
                  background: cardBg,
                  border: cardBorder,
                  borderRadius: 14,
                  overflow: "hidden",
                  cursor: "pointer",
                }}
              >
                <ResolvedOfferImage
                  offer={offer}
                  alt={offer.title}
                  style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }}
                />
                <div style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a" }}>{offer.title}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? "#34d399" : "#059669" }}>{formatCurrency(offer.price)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={getOfferBadgeStyle(offer.hasGuaranteeSeal ? "success" : "neutral")}>
                      {offer.hasGuaranteeSeal ? "Garantía portal" : "Publicado por usuario"}
                    </span>
                    <span style={getOfferBadgeStyle("info")}>{offer.color}</span>
                    <span style={getOfferBadgeStyle("info")}>{offer.displacement > 0 ? `${offer.displacement.toLocaleString("es-ES")} cc` : "EV"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? "#cbd5e1" : "#334155", lineHeight: 1.6 }}>
                    {offer.year} · {Number(offer.mileage).toLocaleString("es-ES")} km · {offer.location}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#64748b", lineHeight: 1.6, marginTop: 4 }}>
                    {offer.fuel} · {offer.power} · vendedor: {offer.seller}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: isDark ? "#e2e8f0" : "#334155", lineHeight: 1.6 }}>
                    {offer.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.panel}>
            No hemos encontrado resultados con esos filtros. Prueba a ampliar precio, kilometraje o ubicación.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={onGoHome}
          style={{
            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.95)",
            border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(148,163,184,0.32)",
            color: isDark ? "#94a3b8" : "#475569",
            padding: "12px 20px",
            borderRadius: 10,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
