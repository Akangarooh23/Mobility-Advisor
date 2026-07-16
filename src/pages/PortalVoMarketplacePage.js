import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { getMarketplaceVoJson, getImportOffersJson } from "../utils/apiClient";

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

function getMinRentingPrice(offer) {
  const prices = [offer.renting12m, offer.renting24m, offer.renting36m, offer.renting48m, offer.renting60m]
    .filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : null;
}

export default function PortalVoMarketplacePage({
  themeMode,
  styles,
  portalVoFilters,
  updatePortalVoFilter,
  portalVoLocations,
  portalVoColors,
  portalVoFuels = [],
  portalVoTransmissions = [],
  portalVoBrands = [],
  portalVoModels = [],
  onUpdateBrandFilter,
  onResetFilters,
  featuredPortalVoOffers,
  filteredPortalVoOffers,
  ResolvedOfferImage,
  getOfferBadgeStyle,
  formatCurrency,
  onOpenOffer,
  onGoHome,
  loadingOffers,
  totalUniverse = 0,
  currentPage = 0,
  totalPages = 1,
  onGoToPage,
  reservedVoUrls = new Set(),
  reservedMarketplaceIds = new Set(),
  modalityMode = "compra",
  onModalityChange,
}) {
  const isDark = themeMode === "dark";
  const { t } = useTranslation();
  const windowWidth = useWindowWidth();
  const gridCols = windowWidth < 500 ? 1 : windowWidth < 750 ? 2 : windowWidth < 1050 ? 3 : 5;
  const [viewingModal, setViewingModal] = useState(null); // { offer }
  const [viewingForm, setViewingForm] = useState({ name: "", email: "", message: "" });
  const [viewingState, setViewingState] = useState({}); // { [offerId]: 'sent' | 'error' | 'sending' }
  const [compraTab, setCompraTab] = useState("concesionarios");
  const [concesionariosOffers, setConcesionariosOffers] = useState([]);
  const [concesionariosTotal, setConcesionariosTotal] = useState(0);
  const [concesionariosLoading, setConcesionariosLoading] = useState(false);
  const [concesionariosPage, setConcesionariosPage] = useState(0);
  // Importación: coches DE auto-seleccionados por el motor de scoring (import_published)
  const [importOffers, setImportOffers] = useState([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importLoading, setImportLoading] = useState(false);
  useEffect(() => {
    if (compraTab !== "importacion") return;
    let cancelled = false;
    setImportLoading(true);
    getImportOffersJson({ limit: 60 })
      .then(({ data }) => {
        if (cancelled) return;
        setImportOffers(Array.isArray(data?.offers) ? data.offers : []);
        setImportTotal(Number(data?.total || 0));
      })
      .catch(() => { if (!cancelled) { setImportOffers([]); setImportTotal(0); } })
      .finally(() => { if (!cancelled) setImportLoading(false); });
    return () => { cancelled = true; };
  }, [compraTab]);
  useEffect(() => {
    if (compraTab !== "concesionarios") return;
    let cancelled = false;
    setConcesionariosLoading(true);
    getMarketplaceVoJson({
      seller_type: "concesionario,importador",
      limit: 15,
      offset: concesionariosPage * 15,
      modalityMode: "compra",
    }).then(({ data }) => {
      if (cancelled) return;
      const offers = Array.isArray(data?.offers) ? data.offers : [];
      setConcesionariosOffers(offers);
      setConcesionariosTotal(Number(data?.totalUniverse || offers.length));
      setConcesionariosLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setConcesionariosOffers([]);
      setConcesionariosTotal(0);
      setConcesionariosLoading(false);
    });
    return () => { cancelled = true; };
  }, [compraTab, concesionariosPage]);
  const titleColor = isDark ? "#f1f5f9" : "#0f172a";
  const bodyColor = isDark ? "#94a3b8" : "#475569";
  const cardBg = isDark ? "rgba(15,23,42,0.34)" : "rgba(255,255,255,0.96)";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.16)" : "1px solid rgba(148,163,184,0.26)";

  const isRenting = modalityMode === "renting";

  const baseOffers = filteredPortalVoOffers.filter((o) =>
    isRenting ? o.rentingAvailable : o.availableForPurchase !== false
  );
  const baseFeatured = featuredPortalVoOffers.filter((o) =>
    isRenting ? o.rentingAvailable : o.availableForPurchase !== false
  );

  // Per-tab filtering by sourceType
  const modeOffers = !isRenting && compraTab === "particulares"
    ? baseOffers.filter((o) => o.sourceType === "particulares")
    : !isRenting && compraTab === "concesionarios"
      ? concesionariosOffers
      : !isRenting && compraTab === "renting_empresa"
        ? baseOffers.filter((o) => o.sourceType !== "particulares")
        : baseOffers;

  // In "particulares" mode all user vehicles are loaded client-side — use modeOffers.length as truth
  const isParticulares = !isRenting && compraTab === "particulares";
  const isConcesionarios = !isRenting && compraTab === "concesionarios";
  const effectiveTotalUniverse = isParticulares ? modeOffers.length : isConcesionarios ? concesionariosTotal : totalUniverse;
  const PAGE_SIZE = 15;
  const effectiveTotalPages = isParticulares ? Math.max(1, Math.ceil(modeOffers.length / PAGE_SIZE)) : isConcesionarios ? Math.max(1, Math.ceil(concesionariosTotal / PAGE_SIZE)) : totalPages;

  const modefeatured = !isRenting && compraTab === "particulares"
    ? []
    : !isRenting && compraTab === "concesionarios"
      ? []
    : !isRenting && compraTab === "renting_empresa"
      ? baseFeatured.filter((o) => o.sourceType !== "particulares")
      : baseFeatured;

  const effectiveLoadingOffers = isConcesionarios ? concesionariosLoading : loadingOffers;
  const effectiveCurrentPage = isConcesionarios ? concesionariosPage : currentPage;
  const effectiveGoToPage = isConcesionarios ? setConcesionariosPage : onGoToPage;

  return (
    <div style={styles.center}>
      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>{t("marketplace.badge")}</div>
      <h2
        style={{
          fontSize: "clamp(22px,4vw,30px)",
          fontWeight: 800,
          letterSpacing: "-1px",
          margin: "0 0 10px",
          color: titleColor,
        }}
      >
        {t("marketplace.title")}
      </h2>
      <p style={{ color: bodyColor, fontSize: 14, lineHeight: 1.7, margin: "0 0 16px" }}>
        {t("marketplace.subtitle")}
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
          {t("marketplace.backHome")}
        </button>
      </div>

      {/* Compra / Renting toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { key: "compra", label: "🛒 Compra" },
          { key: "renting", label: "🔑 Renting" },
        ].map(({ key, label }) => {
          const active = modalityMode === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onModalityChange?.(key)}
              style={{
                padding: "10px 22px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                border: active
                  ? "none"
                  : isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(148,163,184,0.32)",
                background: active
                  ? (key === "renting"
                      ? "linear-gradient(135deg,#059669,#10b981)"
                      : "linear-gradient(135deg,#2563eb,#1d4ed8)")
                  : (isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.92)"),
                color: active ? "#fff" : (isDark ? "#94a3b8" : "#475569"),
                boxShadow: active ? "0 6px 18px rgba(37,99,235,0.18)" : "none",
                transition: "all 0.18s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Compra sub-tabs */}
      {!isRenting && (
        <div style={{
          display: "flex", gap: 0, marginBottom: 20,
          borderRadius: 14, overflow: "hidden",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(148,163,184,0.22)",
          background: isDark ? "rgba(15,23,42,0.4)" : "rgba(248,250,252,0.9)",
        }}>
          {[
            { key: "concesionarios",  icon: "🏪", label: "Concesionarios", color: "#059669" },
            { key: "renting_empresa", icon: "🏢", label: "VO Renting",     color: "#2563eb" },
            { key: "particulares",    icon: "👤", label: "Particulares",   color: "#7c3aed" },
            { key: "importacion",     icon: "🌍", label: "Importación",    color: "#0891b2" },
          ].map(({ key, icon, label, color }, idx, arr) => {
            const active = compraTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setCompraTab(key); setConcesionariosPage(0); }}
                style={{
                  flex: 1,
                  padding: "11px 8px",
                  border: "none",
                  borderRight: idx < arr.length - 1 ? (isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(148,163,184,0.18)") : "none",
                  background: active ? color : "transparent",
                  color: active ? "#fff" : (isDark ? "#94a3b8" : "#64748b"),
                  fontWeight: active ? 700 : 500,
                  fontSize: 11,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  lineHeight: 1.2,
                }}
              >
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ whiteSpace: "nowrap" }}>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Próximamente panels for tabs without real data yet */}
      {!isRenting && compraTab !== "renting_empresa" && compraTab !== "particulares" && compraTab !== "concesionarios" && compraTab !== "importacion" && (
        <div style={{ ...styles.panel, marginBottom: 20, textAlign: "center", padding: "40px 24px" }}>
          {compraTab === "particulares" && (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed", marginBottom: 8 }}>Particulares CarsWise</div>
              <div style={{ fontSize: 13, color: bodyColor, maxWidth: 440, margin: "0 auto 16px", lineHeight: 1.7 }}>
                ¿Quieres vender tu coche? Nosotros lo publicamos, gestionamos las visitas y los trámites administrativos por ti.
                Tú solo pones el coche.
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: isDark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.06)",
                border: "1px solid rgba(124,58,237,0.22)", borderRadius: 10, padding: "10px 18px",
                fontSize: 13, fontWeight: 700, color: "#7c3aed", marginBottom: 20,
              }}>
                Fee fijo de gestión · Sin sorpresas
              </div>
              <br />
              <span style={{
                display: "inline-block", padding: "6px 16px", borderRadius: 999,
                background: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                color: isDark ? "#94a3b8" : "#64748b", fontSize: 12, fontWeight: 600,
              }}>
                Próximamente
              </span>
            </>
          )}
          {compraTab === "importacion" && (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🌍</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0891b2", marginBottom: 8 }}>Vehículos de Importación</div>
              <div style={{ fontSize: 13, color: bodyColor, maxWidth: 440, margin: "0 auto 16px", lineHeight: 1.7 }}>
                Coches seleccionados de portales europeos y partners internacionales. Pagas una reserva y nosotros compramos,
                registramos, pasamos la ITV y te lo entregamos en tu domicilio.
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: isDark ? "rgba(8,145,178,0.12)" : "rgba(8,145,178,0.06)",
                border: "1px solid rgba(8,145,178,0.22)", borderRadius: 10, padding: "10px 18px",
                fontSize: 13, fontWeight: 700, color: "#0891b2", marginBottom: 20,
              }}>
                Garantía incluida · Entrega a domicilio
              </div>
              <br />
              <span style={{
                display: "inline-block", padding: "6px 16px", borderRadius: 999,
                background: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                color: isDark ? "#94a3b8" : "#64748b", fontSize: 12, fontWeight: 600,
              }}>
                Próximamente
              </span>
            </>
          )}
          {compraTab === "concesionarios" && (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏪</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#059669", marginBottom: 8 }}>VO Concesionarios</div>
              <div style={{ fontSize: 13, color: bodyColor, maxWidth: 440, margin: "0 auto 16px", lineHeight: 1.7 }}>
                Vehículos de ocasión de concesionarios de confianza, con garantía y proceso de compra respaldado por CarsWise.
              </div>
              <span style={{
                display: "inline-block", padding: "6px 16px", borderRadius: 999,
                background: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                color: isDark ? "#94a3b8" : "#64748b", fontSize: 12, fontWeight: 600,
              }}>
                Próximamente
              </span>
            </>
          )}
        </div>
      )}

      {/* Importación: coches DE seleccionados por el motor + por qué es buena oferta */}
      {compraTab === "importacion" && (
        <>
          <div style={{ ...styles.panel, marginBottom: 16, padding: "16px 18px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0891b2", marginBottom: 4 }}>
              🌍 Vehículos de Importación · seleccionados por precio
            </div>
            <div style={{ fontSize: 12.5, color: bodyColor, lineHeight: 1.6 }}>
              Coches de Alemania que <strong>salen más baratos que su precio de mercado en España</strong>. Nosotros los compramos,
              importamos, matriculamos y te los entregamos con garantía. Cada oferta muestra su ahorro frente a vehículos comparables españoles.
            </div>
          </div>

          {importLoading ? (
            <div style={{ textAlign: "center", padding: 24, color: isDark ? "#22d3ee" : "#0891b2" }}>Cargando oportunidades…</div>
          ) : importOffers.length === 0 ? (
            <div style={styles.panel}>Aún no hay coches de importación seleccionados. Vuelve pronto.</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", marginBottom: 10 }}>
                {importTotal.toLocaleString("es-ES")} oportunidades de importación seleccionadas
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, minmax(0,1fr))`, gap: 12 }}>
                {importOffers.map((offer) => (
                  <div key={offer.id} style={{
                    background: isDark ? "#0f172a" : "#fff",
                    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(148,163,184,0.22)",
                    borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column",
                  }}>
                    <div style={{ position: "relative" }}>
                      {offer.image_url
                        ? <img src={offer.image_url} alt={offer.title} referrerPolicy="no-referrer" style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />
                        : <div style={{ width: "100%", height: 150, background: isDark ? "#1e293b" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🚗</div>}
                      <span style={{ position: "absolute", top: 8, left: 8, fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: "rgba(8,145,178,0.92)", color: "#fff" }}>🇩🇪 Importación</span>
                      {offer.savings_pct != null && offer.savings_pct > 0 && (
                        <span style={{ position: "absolute", top: 8, right: 8, fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: "#059669", color: "#fff" }}>−{offer.savings_pct}%</span>
                      )}
                    </div>
                    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a", lineHeight: 1.3 }}>{offer.title}</div>
                      <div style={{ fontSize: 11, color: isDark ? "#cbd5e1" : "#334155" }}>
                        {offer.year} · {offer.mileage != null ? `${Number(offer.mileage).toLocaleString("es-ES")} km` : "—"}{offer.fuel ? ` · ${offer.fuel}` : ""}
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, color: isDark ? "#94a3b8" : "#64748b" }}>Precio importado estimado</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>{formatCurrency(offer.import_price)}</div>
                      </div>
                      {offer.market_price_es != null && (
                        <div style={{ background: isDark ? "rgba(5,150,105,0.12)" : "rgba(5,150,105,0.07)", border: "1px solid rgba(5,150,105,0.25)", borderRadius: 10, padding: "8px 10px", marginTop: 2 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#34d399" : "#047857", marginBottom: 3 }}>
                            {offer.savings != null && offer.savings > 0 ? `Ahorras ~${Number(offer.savings).toLocaleString("es-ES")} €` : "Buen precio de mercado"}
                          </div>
                          <div style={{ fontSize: 10.5, color: isDark ? "#a7f3d0" : "#065f46", lineHeight: 1.5 }}>
                            Precio medio en España: <strong>{Number(offer.market_price_es).toLocaleString("es-ES")} €</strong>
                            {offer.comparables != null && <> · según {offer.comparables} vehículos comparables</>}
                          </div>
                        </div>
                      )}
                      <a
                        href={`mailto:soporte@carswise.es?subject=${encodeURIComponent("Importación: " + offer.title)}&body=${encodeURIComponent("Me interesa importar este vehículo:\n" + offer.title + " (" + offer.year + ", " + (offer.mileage || "-") + " km)\nPrecio importado estimado: " + (offer.import_price || "-") + " EUR\n\nRef: " + offer.id)}`}
                        style={{ marginTop: "auto", textAlign: "center", textDecoration: "none", fontSize: 12, fontWeight: 700, padding: "9px 12px", borderRadius: 10, background: "#0891b2", color: "#fff" }}
                      >
                        Solicitar importación
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Filters + offers grid */}
      {(isRenting || compraTab === "renting_empresa" || compraTab === "particulares" || compraTab === "concesionarios") && (
      <>

      <div style={{ ...styles.panel, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 10, letterSpacing: "0.6px" }}>
          {t("marketplace.filtersLabel")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          <input
            value={portalVoFilters.query}
            onChange={(event) => updatePortalVoFilter("query", event.target.value)}
            placeholder={t("marketplace.filterQuery")}
            style={styles.input}
          />
          <select
            value={portalVoFilters.brand}
            onChange={(event) => onUpdateBrandFilter ? onUpdateBrandFilter(event.target.value) : updatePortalVoFilter("brand", event.target.value)}
            style={styles.select}
          >
            <option value="">Marca</option>
            {portalVoBrands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            value={portalVoFilters.model}
            onChange={(event) => updatePortalVoFilter("model", event.target.value)}
            style={styles.select}
            disabled={!portalVoFilters.brand}
          >
            <option value="">Modelo</option>
            {portalVoModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={portalVoFilters.maxPrice}
            onChange={(event) => updatePortalVoFilter("maxPrice", event.target.value)}
            style={styles.select}
          >
            <option value="">{t("marketplace.filterMaxPrice")}</option>
            <option value="15000">{t("marketplace.filterMaxPrice15")}</option>
            <option value="20000">{t("marketplace.filterMaxPrice20")}</option>
            <option value="25000">{t("marketplace.filterMaxPrice25")}</option>
            <option value="30000">{t("marketplace.filterMaxPrice30")}</option>
            <option value="40000">{t("marketplace.filterMaxPrice40")}</option>
          </select>
          <select
            value={portalVoFilters.minYear}
            onChange={(event) => updatePortalVoFilter("minYear", event.target.value)}
            style={styles.select}
          >
            <option value="">{t("marketplace.filterMinYear")}</option>
            {[2024, 2023, 2022, 2021, 2020, 2019].map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select
            value={portalVoFilters.maxMileage}
            onChange={(event) => updatePortalVoFilter("maxMileage", event.target.value)}
            style={styles.select}
          >
            <option value="">{t("marketplace.filterMaxMileage")}</option>
            <option value="20000">{t("marketplace.filterMaxMileage20")}</option>
            <option value="40000">{t("marketplace.filterMaxMileage40")}</option>
            <option value="60000">{t("marketplace.filterMaxMileage60")}</option>
            <option value="80000">{t("marketplace.filterMaxMileage80")}</option>
            <option value="120000">{t("marketplace.filterMaxMileage120")}</option>
          </select>
          <select
            value={portalVoFilters.location}
            onChange={(event) => updatePortalVoFilter("location", event.target.value)}
            style={styles.select}
          >
            <option value="">{t("marketplace.filterLocation")}</option>
            {portalVoLocations.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
          <select
            value={portalVoFilters.color}
            onChange={(event) => updatePortalVoFilter("color", event.target.value)}
            style={styles.select}
          >
            <option value="">{t("marketplace.filterColor")}</option>
            {portalVoColors.map((color) => (
              <option key={color} value={color}>{color}</option>
            ))}
          </select>
          <select
            value={portalVoFilters.fuel}
            onChange={(event) => updatePortalVoFilter("fuel", event.target.value)}
            style={styles.select}
          >
            <option value="">Combustible</option>
            {portalVoFuels.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {portalVoTransmissions.length > 0 && (
            <select
              value={portalVoFilters.transmission}
              onChange={(event) => updatePortalVoFilter("transmission", event.target.value)}
              style={styles.select}
            >
              <option value="">Cambio</option>
              {portalVoTransmissions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          <select
            value={portalVoFilters.displacement}
            onChange={(event) => updatePortalVoFilter("displacement", event.target.value)}
            style={styles.select}
          >
            <option value="">{t("marketplace.filterDisplacement")}</option>
            <option value="electric">{t("marketplace.filterDisplacementElectric")}</option>
            <option value="0_1200">{t("marketplace.filterDisplacement0_1200")}</option>
            <option value="1200_1600">{t("marketplace.filterDisplacement1200_1600")}</option>
            <option value="1600_2000">{t("marketplace.filterDisplacement1600_2000")}</option>
            <option value="2000_plus">{t("marketplace.filterDisplacement2000plus")}</option>
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12, color: isDark ? "#dbeafe" : "#334155", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={portalVoFilters.onlyGuaranteed}
              onChange={(event) => updatePortalVoFilter("onlyGuaranteed", event.target.checked)}
            />
            {t("marketplace.filterOnlyGuaranteed")}
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={portalVoFilters.sort || ""}
              onChange={(event) => updatePortalVoFilter("sort", event.target.value)}
              style={{ ...styles.select, minWidth: 180 }}
            >
              <option value="">Relevancia</option>
              <option value="price_asc">Precio: más bajo primero</option>
              <option value="price_desc">Precio: más alto primero</option>
            </select>
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
              {t("marketplace.filterReset")}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: isDark ? "#6ee7b7" : "#059669", marginBottom: 8, fontWeight: 800, letterSpacing: "0.6px" }}>
          {t("marketplace.featuredLabel")}
        </div>
        {modefeatured.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            {modefeatured.map((offer) => (
              <div
                key={offer.id}
                onClick={() => onOpenOffer(offer)}
                title={t("marketplace.seeFullCard")}
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
                    <span style={getOfferBadgeStyle("success")}>{t("marketplace.guaranteeSeal")}</span>
                    <span style={getOfferBadgeStyle("info")}>{t("marketplace.warrantyMonths", { months: offer.warrantyMonths })}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 6 }}>
                    {isRenting
                      ? (() => { const p = getMinRentingPrice(offer); return p ? `Desde ${formatCurrency(p)}/mes` : "—"; })()
                      : formatCurrency(offer.salePrice ?? offer.price)}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? "#cbd5e1" : "#334155", lineHeight: 1.6 }}>
                    {offer.year} · {Number(offer.mileage).toLocaleString("es-ES")} km · {offer.location}
                  </div>
                  {offer.hasStockManagement && isRenting && (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 700 }}>
                        {offer.unitsAvailable} ud{offer.unitsAvailable !== 1 ? "s" : ""} disponibles
                      </span>
                      {offer.availableColors?.map((c) => (
                        <span key={c} style={getOfferBadgeStyle("info")}>{c}</span>
                      ))}
                    </div>
                  )}
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: isDark ? "#dbeafe" : "#334155", lineHeight: 1.6 }}>
                    {t("marketplace.offerAvailableIn", { title: offer.title, location: offer.location })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.panel}>{t("marketplace.noFeatured")}</div>
        )}
      </div>


      {/* Infinite scroll offers grid */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#93c5fd", fontWeight: 800, letterSpacing: "0.6px" }}>
            {t("marketplace.allOffersLabel")}
          </div>
          <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#475569" }}>
            {modeOffers.length} {modeOffers.length !== effectiveTotalUniverse ? `/ ${effectiveTotalUniverse} ` : ""}resultados
          </div>
        </div>

        {effectiveLoadingOffers && modeOffers.length === 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, minmax(0,1fr))`, gap: 12 }}>
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} style={{ background: isDark ? "rgba(30,41,59,0.4)" : "rgba(241,245,249,0.9)", border: cardBorder, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ width: "100%", height: 150, background: isDark ? "rgba(51,65,85,0.5)" : "#e2e8f0", animation: "pulse 1.5s ease-in-out infinite" }} />
                <div style={{ padding: 12 }}>
                  <div style={{ height: 14, borderRadius: 6, background: isDark ? "rgba(51,65,85,0.5)" : "#e2e8f0", marginBottom: 8, width: "70%" }} />
                  <div style={{ height: 12, borderRadius: 6, background: isDark ? "rgba(51,65,85,0.4)" : "#f1f5f9", marginBottom: 6, width: "50%" }} />
                  <div style={{ height: 12, borderRadius: 6, background: isDark ? "rgba(51,65,85,0.4)" : "#f1f5f9", width: "60%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : modeOffers.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, minmax(0,1fr))`, gap: 12 }}>
            {modeOffers.map((offer) => {
              const hasReservedLead = (offer.url && reservedVoUrls.has(offer.url)) || (offer.id && reservedMarketplaceIds.has(offer.id));
              const isReserved = isRenting && hasReservedLead && offer.unitsAvailable <= 1;
              return (
              <div
                key={offer.id}
                onClick={() => onOpenOffer(offer)}
                title={t("marketplace.seeFullCard")}
                style={{
                  background: cardBg,
                  border: isReserved ? "1.5px solid #fbbf24" : cardBorder,
                  borderRadius: 14,
                  overflow: "hidden",
                  cursor: "pointer",
                  opacity: isReserved ? 0.82 : 1,
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
                    {isReserved ? (
                      <div style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#fef9c3", color: "#92400e", border: "1px solid #fbbf24", whiteSpace: "nowrap" }}>
                        🔒 Reservado
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? "#34d399" : "#059669" }}>
                        {isRenting
                          ? (() => { const p = getMinRentingPrice(offer); return p ? `${formatCurrency(p)}/mes` : "—"; })()
                          : formatCurrency(offer.salePrice ?? offer.price)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {offer.hasGuaranteeSeal && (
                      <span style={getOfferBadgeStyle("success")}>{t("marketplace.guaranteePortal")}</span>
                    )}
                    <span style={getOfferBadgeStyle("info")}>{offer.color}</span>
                    <span style={getOfferBadgeStyle("info")}>{offer.displacement > 0 ? `${offer.displacement.toLocaleString("es-ES")} cc` : "EV"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? "#cbd5e1" : "#334155", lineHeight: 1.6 }}>
                    {offer.year} · {Number(offer.mileage).toLocaleString("es-ES")} km · {offer.location}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#64748b", lineHeight: 1.6, marginTop: 4 }}>
                    {offer.fuel} · {offer.power}
                  </div>
                  {offer.hasStockManagement && isRenting && (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: offer.unitsAvailable > 0 ? (isDark ? "#6ee7b7" : "#059669") : (isDark ? "#94a3b8" : "#64748b") }}>
                        {offer.unitsAvailable > 0 ? `${offer.unitsAvailable} uds disponibles` : "Sin stock"}
                      </span>
                      {offer.availableColors?.map((c) => (
                        <span key={c} style={getOfferBadgeStyle("info")}>{c}</span>
                      ))}
                    </div>
                  )}
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: isDark ? "#e2e8f0" : "#334155", lineHeight: 1.6 }}>
                    {t("marketplace.offerAvailableIn", { title: offer.title, location: offer.location })}
                  </p>
                  {viewingState[offer.id] === "sent" && (
                    <p style={{ fontSize: 11, color: "#16a34a", margin: "6px 0 0", fontWeight: 600 }}>✅ Solicitud enviada al vendedor</p>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.panel}>
            {!isRenting && compraTab === "particulares"
              ? "Todavía ningún particular ha publicado su coche. Próximamente podrás hacerlo desde tu panel de vehículos."
              : t("marketplace.noResults")}
          </div>
        )}
        {effectiveLoadingOffers && (
          <div style={{ textAlign: "center", padding: 18, color: isDark ? "#60a5fa" : "#2563eb" }}>
            Cargando…
          </div>
        )}

        {/* Pagination controls */}
        {effectiveTotalPages > 1 && !effectiveLoadingOffers && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 24, flexWrap: "wrap" }}>
            <button
              onClick={() => effectiveGoToPage(effectiveCurrentPage - 1)}
              disabled={effectiveCurrentPage === 0}
              style={{
                padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: effectiveCurrentPage === 0 ? "default" : "pointer",
                background: effectiveCurrentPage === 0 ? (isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9") : (isDark ? "rgba(37,99,235,0.18)" : "#2563eb"),
                color: effectiveCurrentPage === 0 ? (isDark ? "#475569" : "#94a3b8") : "#fff",
                border: "none", opacity: effectiveCurrentPage === 0 ? 0.5 : 1,
              }}
            >
              ← Anterior
            </button>
            {Array.from({ length: Math.min(effectiveTotalPages, 7) }).map((_, i) => {
              let page;
              if (effectiveTotalPages <= 7) {
                page = i;
              } else if (effectiveCurrentPage <= 3) {
                page = i < 6 ? i : effectiveTotalPages - 1;
              } else if (effectiveCurrentPage >= effectiveTotalPages - 4) {
                page = i === 0 ? 0 : effectiveTotalPages - 6 + i;
              } else {
                const offsets = [0, null, effectiveCurrentPage - 1, effectiveCurrentPage, effectiveCurrentPage + 1, null, effectiveTotalPages - 1];
                page = offsets[i];
              }
              if (page === null) return <span key={`sep-${i}`} style={{ color: isDark ? "#475569" : "#94a3b8", fontSize: 13 }}>…</span>;
              const isActive = page === effectiveCurrentPage;
              return (
                <button
                  key={page}
                  onClick={() => !isActive && effectiveGoToPage(page)}
                  style={{
                    padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: isActive ? 800 : 500,
                    background: isActive ? (isDark ? "#2563eb" : "#2563eb") : (isDark ? "rgba(255,255,255,0.06)" : "#f8fafc"),
                    color: isActive ? "#fff" : (isDark ? "#cbd5e1" : "#334155"),
                    border: isActive ? "none" : (isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e2e8f0"),
                    cursor: isActive ? "default" : "pointer",
                    minWidth: 36,
                  }}
                >
                  {page + 1}
                </button>
              );
            })}
            <button
              onClick={() => effectiveGoToPage(effectiveCurrentPage + 1)}
              disabled={effectiveCurrentPage >= effectiveTotalPages - 1}
              style={{
                padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: effectiveCurrentPage >= effectiveTotalPages - 1 ? "default" : "pointer",
                background: effectiveCurrentPage >= effectiveTotalPages - 1 ? (isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9") : (isDark ? "rgba(37,99,235,0.18)" : "#2563eb"),
                color: effectiveCurrentPage >= effectiveTotalPages - 1 ? (isDark ? "#475569" : "#94a3b8") : "#fff",
                border: "none", opacity: effectiveCurrentPage >= effectiveTotalPages - 1 ? 0.5 : 1,
              }}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      </> )}

      {/* Viewing request modal */}
      {viewingModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setViewingModal(null)}
        >
          <div
            style={{ background: "white", borderRadius: 16, padding: "28px 32px", maxWidth: 460, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 4px", color: "#0f172a", fontSize: 18 }}>📅 Solicitar visita</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>{viewingModal.offer.title}</p>
            {viewingState[viewingModal.offer.id] === "sent" ? (
              <div style={{ background: "#dcfce7", borderRadius: 10, padding: "14px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 20 }}>✅</div>
                <strong style={{ color: "#166534" }}>Solicitud enviada</strong>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#166534" }}>El vendedor recibirá un email para proponerte fechas disponibles.</p>
                <button onClick={() => setViewingModal(null)} style={{ marginTop: 12, background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: 600 }}>Cerrar</button>
              </div>
            ) : (
              <form onSubmit={async e => {
                e.preventDefault();
                setViewingState(s => ({ ...s, [viewingModal.offer.id]: "sending" }));
                try {
                  const res = await fetch("/api/viewing-request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ offer_id: viewingModal.offer.id, buyer_email: viewingForm.email, buyer_name: viewingForm.name, buyer_message: viewingForm.message }),
                  });
                  const data = await res.json();
                  if (data.ok) {
                    setViewingState(s => ({ ...s, [viewingModal.offer.id]: "sent" }));
                  } else {
                    setViewingState(s => ({ ...s, [viewingModal.offer.id]: data.error || "Error" }));
                  }
                } catch {
                  setViewingState(s => ({ ...s, [viewingModal.offer.id]: "Error al enviar" }));
                }
              }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>Tu nombre *</label>
                  <input required value={viewingForm.name} onChange={e => setViewingForm(f => ({ ...f, name: e.target.value }))} style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>Tu email *</label>
                  <input required type="email" value={viewingForm.email} onChange={e => setViewingForm(f => ({ ...f, email: e.target.value }))} style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>Mensaje (opcional)</label>
                  <textarea value={viewingForm.message} onChange={e => setViewingForm(f => ({ ...f, message: e.target.value }))} rows={3} placeholder="Ej: Me interesa el coche, ¿podemos quedar esta semana?" style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
                </div>
                {typeof viewingState[viewingModal.offer.id] === "string" && viewingState[viewingModal.offer.id] !== "sending" && viewingState[viewingModal.offer.id] !== "sent" && (
                  <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{viewingState[viewingModal.offer.id]}</p>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setViewingModal(null)} style={{ flex: 1, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer" }}>Cancelar</button>
                  <button type="submit" disabled={viewingState[viewingModal.offer.id] === "sending"} style={{ flex: 2, background: "#2563eb", color: "white", border: "none", borderRadius: 8, padding: "10px", fontWeight: 600, cursor: "pointer", opacity: viewingState[viewingModal.offer.id] === "sending" ? 0.7 : 1 }}>
                    {viewingState[viewingModal.offer.id] === "sending" ? "Enviando…" : "Enviar solicitud"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
          {t("marketplace.backHomeBottom")}
        </button>
      </div>
    </div>
  );
}
