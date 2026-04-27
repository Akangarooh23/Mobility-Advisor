import { useState } from "react";
import { getBrandOptionSegments } from "../utils/brandCatalog";

export default function SellPage({
  styles,
  uiLanguage = "es",
  sellFlowType,
  selectedValuationVehicleSummary,
  sellAnswers,
  setSellAnswers,
  MARKET_BRANDS,
  sellModels,
  SELL_FUEL_OPTIONS,
  analyzeSellWithAI,
  sellLoading,
  sellError,
  sellAiResult,
  sellEstimate,
  searchSellComparableListing,
  sellListingLoading,
  sellListingError,
  sellListingResult,
  formatCurrency,
  onRestart,
}) {
  const language = String(uiLanguage || "").toLowerCase() === "en" ? "en" : "es";
  const text = {
    pageBadgeCertificate: language === "en" ? "📑 B2CARS CERTIFICATE" : "📑 CERTIFICADO B2CARS",
    pageBadgeReport: language === "en" ? "📊 B2CARS REPORT" : "📊 INFORME B2CARS",
    pageTitleCertificate: language === "en" ? "Prepare your car's official certification" : "Prepara la certificación oficial de tu coche",
    pageTitleReport: language === "en" ? "Calculate your car's listing price" : "Calcula el precio de salida de tu coche",
    pageDescriptionCertificate:
      language === "en"
        ? "We gather key vehicle information to issue an official certification and help you sell with stronger backing for the buyer."
        : "Recopilamos la información clave del vehículo para emitir una certificación oficial y ayudarte en la venta con mayor respaldo frente al comprador.",
    pageDescriptionReport:
      language === "en"
        ? "We provide real-time information on average price, historical trend, similar stock, and a launch range so you can publish with clear criteria."
        : "Te damos información en tiempo real sobre precio medio, tendencia histórica, stock de coches similares y una horquilla de salida para publicar con criterio.",
    selectedFromPlate: language === "en" ? "VEHICLE SELECTED FROM PLATE" : "VEHÍCULO SELECCIONADO DESDE MATRÍCULA",
    noPlate: language === "en" ? "No plate" : "Sin matrícula",
    brand: language === "en" ? "Brand" : "Marca",
    selectBrand: language === "en" ? "Select brand" : "Selecciona marca",
    moreBrands: language === "en" ? "+ more brands" : "+ más marcas",
    model: language === "en" ? "Model" : "Modelo",
    selectModel: language === "en" ? "Select model" : "Selecciona modelo",
    year: language === "en" ? "Year" : "Año",
    selectYear: language === "en" ? "Select year" : "Selecciona año",
    mileage: language === "en" ? "Mileage" : "Kilometraje",
    selectMileage: language === "en" ? "Select mileage" : "Selecciona kilometraje",
    upTo20k: language === "en" ? "Up to 20,000 km" : "Hasta 20.000 km",
    from20kTo50k: language === "en" ? "20,000 - 50,000 km" : "20.000 - 50.000 km",
    from50kTo80k: language === "en" ? "50,000 - 80,000 km" : "50.000 - 80.000 km",
    from80kTo120k: language === "en" ? "80,000 - 120,000 km" : "80.000 - 120.000 km",
    over120k: language === "en" ? "Over 120,000 km" : "Más de 120.000 km",
    fuel: language === "en" ? "Fuel" : "Combustible",
    salesChannel: language === "en" ? "Sales channel" : "Canal de venta",
    privateSeller: language === "en" ? "Private seller" : "Particular",
    professionalSeller: language === "en" ? "Professional" : "Profesional",
    dealerTradeIn: language === "en" ? "Dealer trade-in" : "Entrega en concesionario",
    aiValuation: language === "en" ? "AI VALUATION" : "VALORACIÓN CON IA",
    valuing: language === "en" ? "Valuing with AI..." : "Valorando con IA...",
    valueWithAi: language === "en" ? "🤖 Value car with AI" : "🤖 Valorar coche con IA",
    aiHint:
      language === "en"
        ? "AI will return the valuation and one real comparable listing for review."
        : "La IA te devolverá la valoración y un anuncio comparable real para revisar.",
    aiTargetPrice: language === "en" ? "AI TARGET PRICE" : "PRECIO OBJETIVO IA",
    reasonableRange: language === "en" ? "Reasonable range between" : "Rango razonable entre",
    estimatedDemand: language === "en" ? "ESTIMATED DEMAND" : "DEMANDA ESTIMADA",
    average: language === "en" ? "Average" : "Media",
    estimatedSaleTime: language === "en" ? "ESTIMATED SALE TIME" : "TIEMPO ESTIMADO DE VENTA",
    saleTimeFallback: language === "en" ? "Depends on price and demand" : "Depende del precio y la demanda",
    aiSummary: language === "en" ? "AI REPORT SUMMARY" : "RESUMEN DEL INFORME IA",
    strategy: language === "en" ? "Strategy" : "Estrategia",
    searchingComparable: language === "en" ? "Searching comparable..." : "Buscando comparable...",
    viewComparable: language === "en" ? "🔎 View real comparable listing" : "🔎 Ver anuncio comparable real",
    comparableHint:
      language === "en"
        ? "We show one real market comparable listing so you can contrast your price."
        : "Te mostramos un único anuncio comparable del mercado para contrastar el precio.",
    marketComparable: language === "en" ? "🚗 MARKET COMPARABLE LISTING" : "🚗 ANUNCIO COMPARABLE DE MERCADO",
    comparableDescriptionFallback:
      language === "en"
        ? "Real comparable found to help you defend your listing price."
        : "Comparable real localizado para ayudarte a defender el precio de salida.",
    openListing: language === "en" ? "Open listing ↗" : "Abrir anuncio ↗",
    localPricePreview: language === "en" ? "LOCAL PRICE PREVIEW" : "PREVIEW LOCAL DE PRECIO",
    indicativeRange: language === "en" ? "Indicative range between" : "Rango orientativo entre",
    whileAiRuns: language === "en" ? "while you launch AI valuation." : "mientras lanzas la valoración con IA.",
    backHome: language === "en" ? "Back to home" : "Volver al inicio",
  };

  const isCertificateFlow = sellFlowType === "certificate";
  const pageBadge = isCertificateFlow ? text.pageBadgeCertificate : text.pageBadgeReport;
  const pageTitle = isCertificateFlow
    ? text.pageTitleCertificate
    : text.pageTitleReport;
  const pageDescription = isCertificateFlow
    ? text.pageDescriptionCertificate
    : text.pageDescriptionReport;
  const [showAllBrands, setShowAllBrands] = useState(true);
  const { knownBrands, otherBrands, knownBrandSet } = getBrandOptionSegments(MARKET_BRANDS);
  const hasUnknownSelectedBrand = Boolean(sellAnswers.brand && !knownBrandSet.has(sellAnswers.brand));
  const shouldShowAllBrands = showAllBrands || hasUnknownSelectedBrand;
  const visibleBrands = shouldShowAllBrands ? [...knownBrands, ...otherBrands] : knownBrands;
  const modelOptions = sellAnswers.model && !sellModels.includes(sellAnswers.model) ? [sellAnswers.model, ...sellModels] : sellModels;
  const currentYear = new Date().getFullYear();
  const minYear = 1990;
  const defaultYearOptions = Array.from(
    { length: currentYear - minYear + 1 },
    (_, index) => currentYear - index
  );
  const yearOptions =
    sellAnswers.year && !defaultYearOptions.includes(Number(sellAnswers.year))
      ? [Number(sellAnswers.year), ...defaultYearOptions]
      : defaultYearOptions;

  return (
    <div style={styles.center}>
      <div style={{ ...styles.blockBadge("Pricing"), marginBottom: 10 }}>{pageBadge}</div>
      <h2
        style={{
          fontSize: "clamp(22px,4vw,30px)",
          fontWeight: 800,
          letterSpacing: "-1px",
          margin: "0 0 10px",
          color: "#000000",
        }}
      >
        {pageTitle}
      </h2>
      <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
        {pageDescription}
      </p>

      {selectedValuationVehicleSummary ? (
        <div
          style={{
            background: "rgba(37,99,235,0.08)",
            border: "1px solid rgba(37,99,235,0.2)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            display: "grid",
            gap: 4,
          }}
        >
          <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 800, letterSpacing: "0.3px" }}>
            {text.selectedFromPlate}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
            {selectedValuationVehicleSummary.plate || text.noPlate}
            {selectedValuationVehicleSummary.title ? ` · ${selectedValuationVehicleSummary.title}` : ""}
          </div>
          <div style={{ fontSize: 12, color: "#475569" }}>
            {`${selectedValuationVehicleSummary.brand || ""} ${selectedValuationVehicleSummary.model || ""}`.trim()}
            {selectedValuationVehicleSummary.year ? ` · ${selectedValuationVehicleSummary.year}` : ""}
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.brand}</div>
          <select
            value={sellAnswers.brand}
            onChange={(event) => {
              if (event.target.value === "__SHOW_MORE_BRANDS__") {
                setShowAllBrands(true);
                setSellAnswers((prev) => ({ ...prev, brand: "", model: "" }));
                return;
              }

              setSellAnswers((prev) => ({ ...prev, brand: event.target.value, model: "" }));
            }}
            style={styles.select}
          >
            <option value="">{text.selectBrand}</option>
            {visibleBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
            {!shouldShowAllBrands && otherBrands.length > 0 && (
              <option value="__SHOW_MORE_BRANDS__">{text.moreBrands} ({otherBrands.length})</option>
            )}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.model}</div>
          <select
            value={sellAnswers.model}
            onChange={(event) => setSellAnswers((prev) => ({ ...prev, model: event.target.value }))}
            disabled={!sellAnswers.brand}
            style={{ ...styles.select, opacity: sellAnswers.brand ? 1 : 0.55 }}
          >
            <option value="">{text.selectModel}</option>
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.year}</div>
          <select
            value={sellAnswers.year}
            onChange={(event) => setSellAnswers((prev) => ({ ...prev, year: event.target.value }))}
            style={styles.select}
          >
            <option value="">{text.selectYear}</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.mileage}</div>
          <select
            value={sellAnswers.mileage}
            onChange={(event) => setSellAnswers((prev) => ({ ...prev, mileage: event.target.value }))}
            style={styles.select}
          >
            <option value="">{text.selectMileage}</option>
            <option value="20000">{text.upTo20k}</option>
            <option value="50000">{text.from20kTo50k}</option>
            <option value="80000">{text.from50kTo80k}</option>
            <option value="120000">{text.from80kTo120k}</option>
            <option value="160000">{text.over120k}</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.fuel}</div>
          <select
            value={sellAnswers.fuel}
            onChange={(event) => setSellAnswers((prev) => ({ ...prev, fuel: event.target.value }))}
            style={styles.select}
          >
            {SELL_FUEL_OPTIONS.map((fuel) => (
              <option key={fuel} value={fuel}>
                {fuel}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{text.salesChannel}</div>
          <select
            value={sellAnswers.sellerType}
            onChange={(event) => setSellAnswers((prev) => ({ ...prev, sellerType: event.target.value }))}
            style={styles.select}
          >
            <option value="particular">{text.privateSeller}</option>
            <option value="profesional">{text.professionalSeller}</option>
            <option value="entrega">{text.dealerTradeIn}</option>
          </select>
        </div>
      </div>

      {sellAnswers.brand && sellAnswers.model && sellAnswers.year && sellAnswers.mileage && (
        <div
          style={{
            background: "rgba(37,99,235,0.08)",
            border: "1px solid rgba(37,99,235,0.18)",
            borderRadius: 14,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: "0.6px", marginBottom: 8 }}>
            {text.aiValuation}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={analyzeSellWithAI}
              disabled={sellLoading}
              style={{
                ...styles.btn,
                padding: "10px 16px",
                fontSize: 13,
                opacity: sellLoading ? 0.7 : 1,
              }}
            >
              {sellLoading ? text.valuing : text.valueWithAi}
            </button>
            <span style={{ fontSize: 12, color: "#bfdbfe", alignSelf: "center" }}>
              {text.aiHint}
            </span>
          </div>
        </div>
      )}

      {sellError && (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.18)",
            borderRadius: 12,
            padding: 14,
            marginBottom: 18,
            color: "#fecaca",
            fontSize: 12,
          }}
        >
          {sellError}
        </div>
      )}

      {sellAiResult && (
        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          <div style={styles.panel}>
            <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 6, letterSpacing: "0.6px" }}>
              {text.aiTargetPrice}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#000000", marginBottom: 8 }}>
              {sellAiResult.precio_objetivo}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              {text.reasonableRange} {sellAiResult.rango_publicacion.min} y {sellAiResult.rango_publicacion.max}.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <div style={styles.panel}>
              <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
                {text.estimatedDemand}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#000000" }}>{sellAiResult.nivel_demanda || text.average}</div>
            </div>
            <div style={styles.panel}>
              <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
                {text.estimatedSaleTime}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#000000" }}>{sellAiResult.tiempo_estimado_venta || text.saleTimeFallback}</div>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={{ fontSize: 11, color: "#34d399", marginBottom: 6, letterSpacing: "0.6px" }}>
              {text.aiSummary}
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
              {sellAiResult.resumen}
            </p>
            {sellAiResult.argumentos_clave.length > 0 && (
              <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>
                {sellAiResult.argumentos_clave.map((item) => (
                  <div key={item} style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>• {item}</div>
                ))}
              </div>
            )}
            {sellAiResult.alertas.length > 0 && (
              <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>
                {sellAiResult.alertas.map((item) => (
                  <div key={item} style={{ fontSize: 12, color: "#fde68a", lineHeight: 1.5 }}>• {item}</div>
                ))}
              </div>
            )}
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
              <strong>{text.strategy}:</strong> {sellAiResult.estrategia_publicacion}
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                type="button"
                onClick={searchSellComparableListing}
                disabled={sellListingLoading}
                style={{
                  ...styles.btn,
                  padding: "10px 16px",
                  fontSize: 13,
                  opacity: sellListingLoading ? 0.7 : 1,
                }}
              >
                {sellListingLoading ? text.searchingComparable : text.viewComparable}
              </button>
              <span style={{ fontSize: 12, color: "#bfdbfe", alignSelf: "center" }}>
                {text.comparableHint}
              </span>
            </div>

            {sellListingError && (
              <div
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.18)",
                  borderRadius: 12,
                  padding: 12,
                  color: "#fecaca",
                  fontSize: 12,
                  marginBottom: 10,
                }}
              >
                {sellListingError}
              </div>
            )}

            {sellListingResult && (
              <div
                style={{
                  background: "rgba(2,6,23,0.42)",
                  border: "1px solid rgba(96,165,250,0.22)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 10, color: "#67e8f9", marginBottom: 6, fontWeight: 700, letterSpacing: "0.6px" }}>
                  {text.marketComparable}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#000000", marginBottom: 6 }}>
                      {sellListingResult.title}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                      {sellListingResult.description || text.comparableDescriptionFallback}
                    </p>
                  </div>
                  {sellListingResult.price && (
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>
                      {sellListingResult.price}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a
                    href={sellListingResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: "linear-gradient(135deg,#10b981,#059669)",
                      color: "white",
                      textDecoration: "none",
                      padding: "9px 13px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {text.openListing}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!sellAiResult && sellEstimate && (
        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          <div style={styles.panel}>
            <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 6, letterSpacing: "0.6px" }}>
              {text.localPricePreview}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#000000", marginBottom: 8 }}>
              {formatCurrency(sellEstimate.targetPrice)}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              {text.indicativeRange} {formatCurrency(sellEstimate.lowPrice)} y {formatCurrency(sellEstimate.highPrice)} {text.whileAiRuns}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onRestart} style={styles.btn}>
          {text.backHome}
        </button>
      </div>
    </div>
  );
}
