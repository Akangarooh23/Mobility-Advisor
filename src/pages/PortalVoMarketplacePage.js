import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getMarketplaceVoJson, getImportOffersJson, getVehicleCatalogJson } from "../utils/apiClient";
import { getBrandOptionSegments } from "../utils/brandCatalog";
import { getMinRentingPrice } from "../utils/portalVoHelpers";

function FilterSelect({ value, onChange, style = {}, disabled, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const options = React.Children.toArray(children)
    .filter((c) => c && c.type === "option")
    .map((c) => ({ value: c.props.value ?? "", label: String(c.props.children ?? "") }));

  const displayLabel =
    options.find((o) => String(o.value) === String(value ?? ""))?.label ??
    options[0]?.label ??
    "";

  const isDarkBg = String(style.background ?? "").includes("0f1b2d");
  const selectedBg = isDarkBg ? "rgba(255,255,255,0.12)" : "rgba(14,165,233,0.10)";
  const hoverBg    = isDarkBg ? "rgba(255,255,255,0.07)" : "rgba(14,165,233,0.06)";

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", width: style.width ?? "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          background: style.background,
          color: style.color,
          border: style.border,
          borderRadius: style.borderRadius,
          padding: style.padding,
          boxShadow: style.boxShadow,
          outline: "none",
          boxSizing: "border-box",
          fontFamily: "inherit",
          fontSize: 14,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
          {displayLabel}
        </span>
        <span style={{ fontSize: 9, flexShrink: 0, opacity: 0.6, marginLeft: 2 }}>▾</span>
      </button>
      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            background: style.background ?? "#ffffff",
            border: style.border ?? "1px solid rgba(148,163,184,0.3)",
            borderRadius: style.borderRadius ?? 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {options.map((opt, i) => (
            <div
              key={i}
              onMouseDown={() => { onChange({ target: { value: opt.value } }); setOpen(false); }}
              onMouseEnter={(e) => { if (String(opt.value) !== String(value ?? "")) e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = String(opt.value) === String(value ?? "") ? selectedBg : "transparent"; }}
              style={{
                padding: "9px 14px",
                cursor: "pointer",
                color: style.color ?? "#0f172a",
                fontSize: 14,
                background: String(opt.value) === String(value ?? "") ? selectedBg : "transparent",
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
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
  offersUnavailable = false,
  totalUniverse = 0,
  currentPage = 0,
  totalPages = 1,
  onGoToPage,
  reservedVoUrls = new Set(),
  reservedMarketplaceIds = new Set(),
  modalityMode = "compra",
  onModalityChange,
  onCreateAlert,
  onRequestLogin,
  initialCompraTab = "concesionarios",
}) {
  const isDark = themeMode === "dark";
  const { t } = useTranslation();
  const windowWidth = useWindowWidth();
  const gridCols = windowWidth < 500 ? 1 : windowWidth < 750 ? 2 : windowWidth < 1050 ? 3 : 5;
  const [compraTab, setCompraTab] = useState(initialCompraTab || "concesionarios");
  // Catálogo completo (todas las marcas/modelos) para los desplegables — así se puede
  // filtrar/alertar por una marca aunque no haya stock ahora mismo.
  const [catalogBrands, setCatalogBrands] = useState([]); // [{ name, models: [] }]
  // Marcas con anuncios: ordenan el desplegable, igual que en el asesor.
  const [marcasConAnuncios, setMarcasConAnuncios] = useState(null);
  const [alertSent, setAlertSent] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getVehicleCatalogJson()
      .then(({ data }) => {
        if (cancelled) return;
        setCatalogBrands(Array.isArray(data?.brands) ? data.brands : []);
        setMarcasConAnuncios(data?.matchedModelsByBrand || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
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
    getImportOffersJson({
      limit: 60,
      query:        portalVoFilters.query,
      brand:        portalVoFilters.brand,
      model:        portalVoFilters.model,
      minPrice:     portalVoFilters.minPrice,
      maxPrice:     portalVoFilters.maxPrice,
      minYear:      portalVoFilters.minYear,
      maxYear:      portalVoFilters.maxYear,
      minMileage:   portalVoFilters.minMileage,
      maxMileage:   portalVoFilters.maxMileage,
      fuel:         portalVoFilters.fuel,
      color:        portalVoFilters.color,
      transmission: portalVoFilters.transmission,
      displacement: portalVoFilters.displacement,
    })
      .then(({ data }) => {
        if (cancelled) return;
        setImportOffers(Array.isArray(data?.offers) ? data.offers : []);
        setImportTotal(Number(data?.total || 0));
      })
      .catch(() => { if (!cancelled) { setImportOffers([]); setImportTotal(0); } })
      .finally(() => { if (!cancelled) setImportLoading(false); });
    return () => { cancelled = true; };
  }, [compraTab, portalVoFilters]);
  // Al cambiar los filtros, volver a la página 1 (los concesionarios se filtran en servidor).
  useEffect(() => { setConcesionariosPage(0); setAlertSent(false); }, [portalVoFilters]);
  useEffect(() => {
    if (compraTab !== "concesionarios") return;
    let cancelled = false;
    setConcesionariosLoading(true);
    getMarketplaceVoJson({
      seller_type: "concesionario,importador",
      limit: 15,
      offset: concesionariosPage * 15,
      modalityMode: "compra",
      // Filtros: el fetch de concesionarios los aplica en SERVIDOR (está paginado 15/pág,
      // no se puede filtrar en cliente). El handler soporta todos estos.
      query:          portalVoFilters.query,
      brand:          portalVoFilters.brand,
      model:          portalVoFilters.model,
      minPrice:       portalVoFilters.minPrice,
      maxPrice:       portalVoFilters.maxPrice,
      minYear:        portalVoFilters.minYear,
      maxYear:        portalVoFilters.maxYear,
      minMileage:     portalVoFilters.minMileage,
      maxMileage:     portalVoFilters.maxMileage,
      location:       portalVoFilters.location,
      color:          portalVoFilters.color,
      fuel:           portalVoFilters.fuel,
      transmission:   portalVoFilters.transmission,
      displacement:   portalVoFilters.displacement,
      onlyGuaranteed: portalVoFilters.onlyGuaranteed,
      sort:           portalVoFilters.sort,
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
  }, [compraTab, concesionariosPage, portalVoFilters]);
  const titleColor = isDark ? "#f1f5f9" : "#0f172a";
  const bodyColor = isDark ? "#94a3b8" : "#475569";
  const cardBg = isDark ? "rgba(15,23,42,0.34)" : "rgba(255,255,255,0.96)";
  const cardBorder = isDark ? "1px solid rgba(148,163,184,0.16)" : "1px solid rgba(148,163,184,0.26)";

  const PRICE_STEPS = Array.from({ length: 80 }, (_, i) => (i + 1) * 2500); // 2500 … 200000

  // Opciones de marca/modelo: catálogo completo si cargó; si no, las del pool cargado.
  const normStr = (s) => String(s || "").trim().toLowerCase();
  const brandOptions = catalogBrands.length ? catalogBrands.map((b) => b.name) : portalVoBrands;
  /**
   * Sin repetir la misma marca escrita de dos formas.
   *
   * El catálogo llega de la unión de varias fuentes y trae «Volkswagen» y
   * «VOLKSWAGEN» como entradas distintas. Se agrupan ignorando mayúsculas y
   * acentos, conservando la grafía escrita por una persona.
   */
  const brandOptionsUnicas = (() => {
    const porClave = new Map();
    const mezclada = (v) => v !== v.toUpperCase() && v !== v.toLowerCase();
    for (const b of brandOptions) {
      const nombre = String(b || "").trim();
      const k = nombre
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (!k) continue;
      const previa = porClave.get(k);
      if (!previa || (mezclada(nombre) && !mezclada(previa))) porClave.set(k, nombre);
    }
    return [...porClave.values()];
  })();
  const { knownBrands: voKnownBrands, otherBrands: voOtherBrands } = getBrandOptionSegments(
    Object.fromEntries(brandOptionsUnicas.map((b) => [b, true])),
    marcasConAnuncios
  );
  const modelOptions = (() => {
    if (!portalVoFilters.brand) return portalVoModels;
    const found = catalogBrands.find((b) => normStr(b.name) === normStr(portalVoFilters.brand));
    const catModels = found ? found.models : [];
    return catModels.length ? [...new Set([...catModels, ...portalVoModels])] : portalVoModels;
  })();

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

  // "Generar alerta": cuando una búsqueda con marca/modelo no da resultados.
  const currentOffersCount = compraTab === "importacion" ? importOffers.length : modeOffers.length;
  const hasSpecificFilter = Boolean(
    portalVoFilters.brand || portalVoFilters.model || portalVoFilters.query ||
    portalVoFilters.fuel || portalVoFilters.minPrice || portalVoFilters.maxPrice ||
    portalVoFilters.minYear || portalVoFilters.maxYear ||
    portalVoFilters.minMileage || portalVoFilters.maxMileage ||
    portalVoFilters.location || portalVoFilters.color ||
    portalVoFilters.transmission || portalVoFilters.displacement
  );
  const sinCargar = offersUnavailable && !effectiveLoadingOffers && !importLoading;
  // Si el catálogo no se ha podido cargar, ofrecer una alerta es peor que no
  // ofrecer nada: invita a esperar por unos coches que probablemente ya están
  // ahí. La alerta solo se propone cuando de verdad no hay resultados.
  const showAlertCta = !sinCargar && !effectiveLoadingOffers && !importLoading && currentOffersCount === 0 && hasSpecificFilter;
  const handleGenerarAlerta = async () => {
    if (typeof onCreateAlert !== "function") {
      if (typeof onRequestLogin === "function") onRequestLogin();
      return;
    }
    const created = await onCreateAlert({
      ...portalVoFilters,
      mode: isRenting ? "renting" : "compra",
      notifyByEmail: true,
    });
    setAlertSent(created ? "ok" : "error");
  };

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
            { key: "renting_empresa", icon: "🏢", label: "Ex-Renting",     color: "#2563eb" },
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


      {/* Importación: coches DE seleccionados por el motor + por qué es buena oferta */}
      {compraTab === "importacion" && (
        <div style={{ ...styles.panel, marginBottom: 16, padding: "16px 18px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0891b2", marginBottom: 4 }}>
            🌍 Vehículos de Importación · seleccionados por precio
          </div>
          <div style={{ fontSize: 12.5, color: bodyColor, lineHeight: 1.6 }}>
            Coches de Alemania que <strong>salen más baratos que su precio de mercado en España</strong>. Nosotros los compramos,
            importamos, matriculamos y te los entregamos con garantía. Cada oferta muestra su ahorro frente a vehículos comparables españoles.
          </div>
        </div>
      )}

      {/* Filters + offers grid */}
      {(isRenting || compraTab === "renting_empresa" || compraTab === "particulares" || compraTab === "concesionarios" || compraTab === "importacion") && (
      <>

      <div style={{ ...styles.panel, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 10, letterSpacing: "0.6px" }}>
          {t("marketplace.filtersLabel")}
        </div>
        {/* Row 1: query, marca, modelo, precio, año, km, ubicación */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, alignItems: "start" }}>
          <input
            value={portalVoFilters.query}
            onChange={(event) => updatePortalVoFilter("query", event.target.value)}
            placeholder={t("marketplace.filterQuery")}
            style={styles.input}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <FilterSelect
              value={portalVoFilters.brand}
              onChange={(event) => onUpdateBrandFilter ? onUpdateBrandFilter(event.target.value) : updatePortalVoFilter("brand", event.target.value)}
              style={styles.select}
            >
              <option value="">Marca</option>
              {/* El catálogo entero, en dos bloques: primero las marcas de las
                  que hay coches, después el resto, cada uno de la A a la Z.
                  Todas seleccionables — quien elija una sin ofertas verá que no
                  hay y podrá pedir aviso cuando entre alguna, que es mejor
                  respuesta que no encontrarla en la lista. */}
              <optgroup label="Con coches disponibles">
                {voKnownBrands.map((b) => <option key={`hay-${b}`} value={b}>{b}</option>)}
              </optgroup>
              {voOtherBrands.length > 0 && (
                <optgroup label="Resto del catálogo">
                  {voOtherBrands.map((b) => <option key={`resto-${b}`} value={b}>{b}</option>)}
                </optgroup>
              )}
            </FilterSelect>
          </div>
          <FilterSelect
            value={portalVoFilters.model}
            onChange={(event) => updatePortalVoFilter("model", event.target.value)}
            style={styles.select}
            disabled={!portalVoFilters.brand}
          >
            <option value="">Modelo</option>
            {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </FilterSelect>
          <FilterSelect
            value={portalVoFilters.minPrice || ""}
            onChange={(event) => updatePortalVoFilter("minPrice", event.target.value)}
            style={styles.select}
          >
            <option value="">Precio mínimo</option>
            {PRICE_STEPS.filter((p) => !portalVoFilters.maxPrice || p < Number(portalVoFilters.maxPrice)).map((p) => (
              <option key={p} value={p}>{p.toLocaleString("es-ES")} €</option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={portalVoFilters.maxPrice || ""}
            onChange={(event) => updatePortalVoFilter("maxPrice", event.target.value)}
            style={styles.select}
          >
            <option value="">Precio máximo</option>
            {PRICE_STEPS.filter((p) => !portalVoFilters.minPrice || p > Number(portalVoFilters.minPrice)).map((p) => (
              <option key={p} value={p}>{p.toLocaleString("es-ES")} €</option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={portalVoFilters.minYear || ""}
            onChange={(event) => updatePortalVoFilter("minYear", event.target.value)}
            style={styles.select}
          >
            <option value="">Año mínimo</option>
            {Array.from({ length: new Date().getFullYear() - 1999 }, (_, i) => new Date().getFullYear() - i)
              .filter((y) => !portalVoFilters.maxYear || y <= Number(portalVoFilters.maxYear))
              .map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
          </FilterSelect>
          <FilterSelect
            value={portalVoFilters.maxYear || ""}
            onChange={(event) => updatePortalVoFilter("maxYear", event.target.value)}
            style={styles.select}
          >
            <option value="">Año máximo</option>
            {Array.from({ length: new Date().getFullYear() - 1999 }, (_, i) => new Date().getFullYear() - i)
              .filter((y) => !portalVoFilters.minYear || y >= Number(portalVoFilters.minYear))
              .map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
          </FilterSelect>
          <FilterSelect
            value={portalVoFilters.minMileage || ""}
            onChange={(event) => updatePortalVoFilter("minMileage", event.target.value)}
            style={styles.select}
          >
            <option value="">Km mínimo</option>
            {Array.from({ length: 40 }, (_, i) => (i + 1) * 5000)
              .filter((k) => !portalVoFilters.maxMileage || k < Number(portalVoFilters.maxMileage))
              .map((k) => (
                <option key={k} value={k}>{k.toLocaleString("es-ES")} km</option>
              ))}
          </FilterSelect>
          <FilterSelect
            value={portalVoFilters.maxMileage || ""}
            onChange={(event) => updatePortalVoFilter("maxMileage", event.target.value)}
            style={styles.select}
          >
            <option value="">Km máximo</option>
            {Array.from({ length: 40 }, (_, i) => (i + 1) * 5000)
              .filter((k) => !portalVoFilters.minMileage || k > Number(portalVoFilters.minMileage))
              .map((k) => (
                <option key={k} value={k}>{k.toLocaleString("es-ES")} km</option>
              ))}
          </FilterSelect>
          <FilterSelect
            value={portalVoFilters.location}
            onChange={(event) => updatePortalVoFilter("location", event.target.value)}
            style={styles.select}
          >
            <option value="">{t("marketplace.filterLocation")}</option>
            {portalVoLocations.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={portalVoFilters.color}
            onChange={(event) => updatePortalVoFilter("color", event.target.value)}
            style={styles.select}
          >
            <option value="">{t("marketplace.filterColor")}</option>
            {portalVoColors.map((color) => (
              <option key={color} value={color}>{color}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={portalVoFilters.fuel}
            onChange={(event) => updatePortalVoFilter("fuel", event.target.value)}
            style={styles.select}
          >
            <option value="">Combustible</option>
            {portalVoFuels.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={portalVoFilters.transmission}
            onChange={(event) => updatePortalVoFilter("transmission", event.target.value)}
            style={styles.select}
          >
            <option value="">Cambio</option>
            {portalVoTransmissions.map((tr) => (
              <option key={tr} value={tr}>{tr}</option>
            ))}
          </FilterSelect>
          <FilterSelect
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
          </FilterSelect>
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
            <FilterSelect
              value={portalVoFilters.sort || ""}
              onChange={(event) => updatePortalVoFilter("sort", event.target.value)}
              style={{ ...styles.select, minWidth: 180 }}
            >
              <option value="">Relevancia</option>
              <option value="price_asc">Precio: más bajo primero</option>
              <option value="price_desc">Precio: más alto primero</option>
            </FilterSelect>
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

      {/*
        Decir que no se ha podido cargar, en vez de decir que no hay nada.
        Son dos frases distintas porque son dos situaciones distintas, y hasta
        hoy la web daba la segunda cuando la cierta era la primera.
      */}
      {sinCargar && (
        <div style={{
          ...styles.panel, marginBottom: 18, textAlign: "center", padding: "24px 20px",
          border: `1px dashed ${isDark ? "rgba(251,191,36,0.45)" : "rgba(217,119,6,0.35)"}`,
        }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 6 }}>
            No hemos podido cargar el catálogo
          </div>
          <div style={{ fontSize: 13, color: bodyColor, maxWidth: 440, margin: "0 auto 14px", lineHeight: 1.6 }}>
            No es que no haya coches: es que ahora mismo no podemos consultarlos. Vuelve a intentarlo en
            un momento.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", color: "#fff",
              padding: "12px 22px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 10px 24px rgba(37,99,235,0.2)",
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {showAlertCta && (
        <div style={{
          ...styles.panel, marginBottom: 18, textAlign: "center", padding: "24px 20px",
          border: `1px dashed ${isDark ? "rgba(96,165,250,0.45)" : "rgba(37,99,235,0.35)"}`,
        }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🔔</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 6 }}>
            No hay ofertas para esta búsqueda
          </div>
          <div style={{ fontSize: 13, color: bodyColor, maxWidth: 440, margin: "0 auto 14px", lineHeight: 1.6 }}>
            {(portalVoFilters.brand || portalVoFilters.model)
              ? `No encontramos ${[portalVoFilters.brand, portalVoFilters.model].filter(Boolean).join(" ")} ahora mismo. Crea una alerta y te avisamos en cuanto aparezca.`
              : "Crea una alerta con esta búsqueda y te avisamos en cuanto entre algo que encaje."}
          </div>
          {alertSent === "ok" ? (
            <div style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>✓ Alerta creada — te avisaremos por email</div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGenerarAlerta}
                style={{
                  background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", color: "#fff",
                  padding: "12px 22px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer",
                  boxShadow: "0 10px 24px rgba(37,99,235,0.2)",
                }}
              >
                🔔 Generar alerta
              </button>
              {alertSent === "error" && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                  No se pudo guardar la alerta. Inténtalo de nuevo.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {compraTab === "importacion" && (
        importLoading ? (
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
                <div key={offer.id}
                  onClick={() => onOpenOffer(offer)}
                  title="Ver ficha completa"
                  style={{
                    background: isDark ? "#0f172a" : "#fff",
                    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(148,163,184,0.22)",
                    borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer",
                  }}>
                  <div style={{ position: "relative" }}>
                    {offer.image
                      ? <img src={offer.image} alt={offer.title} referrerPolicy="no-referrer" style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />
                      : <div style={{ width: "100%", height: 150, background: isDark ? "#1e293b" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🚗</div>}
                    <span style={{ position: "absolute", top: 8, left: 8, fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: "rgba(8,145,178,0.92)", color: "#fff" }}>🇩🇪 Importación</span>
                    {offer.importSavingsPct != null && offer.importSavingsPct > 0 && (
                      <span style={{ position: "absolute", top: 8, right: 8, fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: "#059669", color: "#fff" }}>−{offer.importSavingsPct}%</span>
                    )}
                  </div>
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a", lineHeight: 1.3 }}>{offer.title}</div>
                    <div style={{ fontSize: 11, color: isDark ? "#cbd5e1" : "#334155" }}>
                      {offer.year} · {offer.mileage != null ? `${Number(offer.mileage).toLocaleString("es-ES")} km` : "—"}{offer.fuel ? ` · ${offer.fuel}` : ""}
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: isDark ? "#94a3b8" : "#64748b" }}>Precio importado estimado</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>{formatCurrency(offer.importPrice)}</div>
                    </div>
                    {offer.marketPriceEs != null && (
                      <div style={{ background: isDark ? "rgba(5,150,105,0.12)" : "rgba(5,150,105,0.07)", border: "1px solid rgba(5,150,105,0.25)", borderRadius: 10, padding: "8px 10px", marginTop: 2 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#34d399" : "#047857", marginBottom: 3 }}>
                          {offer.importSavings != null && offer.importSavings > 0 ? `Ahorras ~${Number(offer.importSavings).toLocaleString("es-ES")} €` : "Buen precio de mercado"}
                        </div>
                        <div style={{ fontSize: 10.5, color: isDark ? "#a7f3d0" : "#065f46", lineHeight: 1.5 }}>
                          Precio medio en España: <strong>{Number(offer.marketPriceEs).toLocaleString("es-ES")} €</strong>
                          {offer.importComparables != null && <> · según {offer.importComparables} vehículos comparables</>}
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: "auto", textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "#0891b2", paddingTop: 6 }}>
                      Ver ficha →
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {compraTab !== "importacion" && (<>
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
                    {offer.color ? <span style={getOfferBadgeStyle("info")}>{offer.color}</span> : null}
                    <span style={getOfferBadgeStyle("info")}>{offer.displacement > 0 ? `${offer.displacement.toLocaleString("es-ES")} cc` : "EV"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? "#cbd5e1" : "#334155", lineHeight: 1.6 }}>
                    {offer.year} · {Number(offer.mileage).toLocaleString("es-ES")} km · {offer.location}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#64748b", lineHeight: 1.6, marginTop: 4 }}>
                    {offer.fuel}{offer.power ? ` · ${offer.power}` : ""}
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
      </>)}

      </> )}



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
