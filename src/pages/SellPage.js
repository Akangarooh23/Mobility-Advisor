export default function SellPage({
  styles,
  sellFlowType,
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
  const isCertificateFlow = sellFlowType === "certificate";
  const pageBadge = isCertificateFlow ? "📑 CERTIFICADO B2CARS" : "📊 INFORME B2CARS";
  const pageTitle = isCertificateFlow
    ? "Prepara la certificación oficial de tu coche"
    : "Calcula el precio de salida de tu coche";
  const pageDescription = isCertificateFlow
    ? "Recopilamos la información clave del vehículo para emitir una certificación oficial y ayudarte en la venta con mayor respaldo frente al comprador."
    : "Te damos información en tiempo real sobre precio medio, tendencia histórica, stock de coches similares y una horquilla de salida para publicar con criterio.";

  return (
    <div style={styles.center}>
      <div style={{ ...styles.blockBadge("Pricing"), marginBottom: 10 }}>{pageBadge}</div>
      <h2
        style={{
          fontSize: "clamp(22px,4vw,30px)",
          fontWeight: 800,
          letterSpacing: "-1px",
          margin: "0 0 10px",
          color: "#f1f5f9",
        }}
      >
        {pageTitle}
      </h2>
      <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
        {pageDescription}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Marca</div>
          <select
            value={sellAnswers.brand}
            onChange={(event) => setSellAnswers((prev) => ({ ...prev, brand: event.target.value, model: "" }))}
            style={styles.select}
          >
            <option value="">Selecciona marca</option>
            {Object.keys(MARKET_BRANDS).map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Modelo</div>
          <select
            value={sellAnswers.model}
            onChange={(event) => setSellAnswers((prev) => ({ ...prev, model: event.target.value }))}
            disabled={!sellAnswers.brand}
            style={{ ...styles.select, opacity: sellAnswers.brand ? 1 : 0.55 }}
          >
            <option value="">Selecciona modelo</option>
            {sellModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Año</div>
          <select
            value={sellAnswers.year}
            onChange={(event) => setSellAnswers((prev) => ({ ...prev, year: event.target.value }))}
            style={styles.select}
          >
            <option value="">Selecciona año</option>
            {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Kilometraje</div>
          <select
            value={sellAnswers.mileage}
            onChange={(event) => setSellAnswers((prev) => ({ ...prev, mileage: event.target.value }))}
            style={styles.select}
          >
            <option value="">Selecciona kilometraje</option>
            <option value="20000">Hasta 20.000 km</option>
            <option value="50000">20.000 - 50.000 km</option>
            <option value="80000">50.000 - 80.000 km</option>
            <option value="120000">80.000 - 120.000 km</option>
            <option value="160000">Más de 120.000 km</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Combustible</div>
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
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Canal de venta</div>
          <select
            value={sellAnswers.sellerType}
            onChange={(event) => setSellAnswers((prev) => ({ ...prev, sellerType: event.target.value }))}
            style={styles.select}
          >
            <option value="particular">Particular</option>
            <option value="profesional">Profesional</option>
            <option value="entrega">Entrega en concesionario</option>
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
            VALORACIÓN CON IA
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
              {sellLoading ? "Valorando con IA..." : "🤖 Valorar coche con IA"}
            </button>
            <span style={{ fontSize: 12, color: "#bfdbfe", alignSelf: "center" }}>
              La IA te devolverá la valoración y un anuncio comparable real para revisar.
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
              PRECIO OBJETIVO IA
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>
              {sellAiResult.precio_objetivo}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              Rango razonable entre {sellAiResult.rango_publicacion.min} y {sellAiResult.rango_publicacion.max}.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <div style={styles.panel}>
              <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
                DEMANDA ESTIMADA
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>{sellAiResult.nivel_demanda || "Media"}</div>
            </div>
            <div style={styles.panel}>
              <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
                TIEMPO ESTIMADO DE VENTA
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{sellAiResult.tiempo_estimado_venta || "Depende del precio y la demanda"}</div>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={{ fontSize: 11, color: "#34d399", marginBottom: 6, letterSpacing: "0.6px" }}>
              RESUMEN DEL INFORME IA
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
              <strong>Estrategia:</strong> {sellAiResult.estrategia_publicacion}
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
                {sellListingLoading ? "Buscando comparable..." : "🔎 Ver anuncio comparable real"}
              </button>
              <span style={{ fontSize: 12, color: "#bfdbfe", alignSelf: "center" }}>
                Te mostramos un único anuncio comparable del mercado para contrastar el precio.
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
                  🚗 ANUNCIO COMPARABLE DE MERCADO
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
                      {sellListingResult.title}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                      {sellListingResult.description || "Comparable real localizado para ayudarte a defender el precio de salida."}
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
                    Abrir anuncio ↗
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
              PREVIEW LOCAL DE PRECIO
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>
              {formatCurrency(sellEstimate.targetPrice)}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              Rango orientativo entre {formatCurrency(sellEstimate.lowPrice)} y {formatCurrency(sellEstimate.highPrice)} mientras lanzas la valoración con IA.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onRestart} style={styles.btn}>
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
