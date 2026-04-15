export default function DecisionPage({
  styles,
  lockedOperation,
  decisionAnswers,
  updateDecisionAnswer,
  MARKET_BRANDS,
  decisionModels,
  needsMonthlyBudget,
  needsCashBudget,
  needsFinanceAmount,
  needsEntryAmount,
  MONTHLY_BUDGET_OPTIONS,
  TOTAL_PURCHASE_OPTIONS,
  FINANCE_AMOUNT_OPTIONS,
  ENTRY_AMOUNT_OPTIONS,
  AGE_FILTER_OPTIONS,
  MILEAGE_FILTER_OPTIONS,
  estimatedFinanceMonthly,
  estimatedMixedMonthly,
  decisionFlowReady,
  analyzeDecisionWithAI,
  decisionLoading,
  decisionError,
  decisionAiResult,
  searchDecisionListing,
  decisionListingLoading,
  decisionListingError,
  decisionListingResult,
  rankedOffers,
  formatCurrency,
  onSwitchToAdvice,
  onRestart,
}) {
  const effectiveOperation = lockedOperation || decisionAnswers.operation;
  const operationChoices =
    lockedOperation === "comprar"
      ? [["comprar", "Compra", "🔑"]]
      : lockedOperation === "renting"
        ? [["renting", "Renting", "📅"]]
        : [
            ["comprar", "Compra", "🔑"],
            ["renting", "Renting", "📅"],
          ];

  return (
    <div style={styles.center}>
      <style>
        {`
          .decision-choice {
            position: relative;
            overflow: hidden;
            border-radius: 13px;
            border: 1px solid rgba(37,99,235,0.2);
            box-shadow: 0 8px 18px rgba(15,23,42,0.08);
            transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease, filter 170ms ease;
          }

          .decision-choice::after {
            content: "";
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 90% 8%, rgba(56,189,248,0.16), rgba(56,189,248,0) 45%);
            pointer-events: none;
            opacity: 0.85;
          }

          .decision-choice:hover,
          .decision-choice:focus-visible {
            transform: translateY(-2px);
            border-color: rgba(14,165,233,0.5);
            box-shadow: 0 14px 24px rgba(14,116,144,0.16), 0 0 18px rgba(14,165,233,0.14);
            filter: saturate(1.03);
          }

          .decision-choice.is-active {
            border-color: rgba(37,99,235,0.58);
            box-shadow: 0 0 0 1px rgba(37,99,235,0.2) inset, 0 12px 22px rgba(37,99,235,0.16);
          }
        `}
      </style>

      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>🧭 OFERTAS DE MERCADO</div>
      <h2
        style={{
          fontSize: "clamp(22px,4vw,30px)",
          fontWeight: 800,
          letterSpacing: "-1px",
          margin: "0 0 10px",
          color: "#000000",
        }}
      >
        Afina marca, modelo y condiciones para ordenar las ofertas
      </h2>
      <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
        Aquí priorizamos el mercado actual para una necesidad ya concreta. Puedes filtrar por modalidad,
        estado, antigüedad y kilometraje antes de ver un ranking de oportunidades.
      </p>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, letterSpacing: "0.6px" }}>
          1. TIPO DE OPERACIÓN
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
          {operationChoices.map(([value, label, icon]) => (
            <button
              key={value}
              style={styles.card(effectiveOperation === value)}
              className={`decision-choice ${effectiveOperation === value ? "is-active" : ""}`}
              onClick={() => {
                if (lockedOperation) return;
                updateDecisionAnswer("operation", value);
              }}
            >
              <span style={{ fontSize: 22, minWidth: 30 }}>{icon}</span>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#000000" }}>{label}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, letterSpacing: "0.6px" }}>
          2. MODALIDAD
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
          {(effectiveOperation === "renting"
            ? [
                ["particular", "Renting particular", "👤"],
                ["empresa", "Renting empresa", "🏢"],
                ["flexible", "Renting flexible", "⚡"],
              ]
            : [
                ["contado", "Compra al contado", "💶"],
                ["financiado", "Compra financiada", "📝"],
                ["mixto", "Entrada + financiación", "📊"],
              ]).map(([value, label, icon]) => (
            <button
              key={value}
              style={styles.card(decisionAnswers.acquisition === value)}
              className={`decision-choice ${decisionAnswers.acquisition === value ? "is-active" : ""}`}
              onClick={() => updateDecisionAnswer("acquisition", value)}
            >
              <span style={{ fontSize: 22, minWidth: 30 }}>{icon}</span>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#000000" }}>{label}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#475569", marginBottom: 10, letterSpacing: "0.6px" }}>
          3. MARCA Y MODELO
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 10 }}>
          {[
            ["si", "Sí, ya sé marca y modelo", "🏷️"],
            ["no", "No, solo sé el tipo de operación", "🧭"],
          ].map(([value, label, icon]) => (
            <button
              key={value}
              style={styles.card(decisionAnswers.hasBrand === value)}
              className={`decision-choice ${decisionAnswers.hasBrand === value ? "is-active" : ""}`}
              onClick={() => updateDecisionAnswer("hasBrand", value)}
            >
              <span style={{ fontSize: 22, minWidth: 30 }}>{icon}</span>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#000000" }}>{label}</div>
            </button>
          ))}
        </div>

        {decisionAnswers.hasBrand === "si" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Marca</div>
              <select
                value={decisionAnswers.brand}
                onChange={(event) => updateDecisionAnswer("brand", event.target.value)}
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
                value={decisionAnswers.model}
                onChange={(event) => updateDecisionAnswer("model", event.target.value)}
                disabled={!decisionAnswers.brand}
                style={{
                  ...styles.select,
                  opacity: decisionAnswers.brand ? 1 : 0.55,
                }}
              >
                <option value="">Selecciona modelo</option>
                {decisionModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Vehículo</div>
          <select
            value={decisionAnswers.condition}
            onChange={(event) => updateDecisionAnswer("condition", event.target.value)}
            style={styles.select}
          >
            <option value="">Nuevo u ocasión</option>
            <option value="nuevo">Nuevo</option>
            <option value="seminuevo">Seminuevo</option>
            <option value="ocasion">Ocasión</option>
          </select>
        </div>
        {needsMonthlyBudget && (
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Cuota objetivo</div>
            <select
              value={decisionAnswers.monthlyBudget}
              onChange={(event) => updateDecisionAnswer("monthlyBudget", event.target.value)}
              style={styles.select}
            >
              <option value="">Presupuesto mensual</option>
              {MONTHLY_BUDGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {needsCashBudget && (
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Presupuesto total</div>
            <select
              value={decisionAnswers.cashBudget}
              onChange={(event) => updateDecisionAnswer("cashBudget", event.target.value)}
              style={styles.select}
            >
              <option value="">Importe total de compra</option>
              {TOTAL_PURCHASE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {needsFinanceAmount && (
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
              {decisionAnswers.acquisition === "mixto" ? "Importe a financiar" : "Cuánto necesitas financiar"}
            </div>
            <select
              value={decisionAnswers.financeAmount}
              onChange={(event) => updateDecisionAnswer("financeAmount", event.target.value)}
              style={styles.select}
            >
              <option value="">Selecciona importe a financiar</option>
              {FINANCE_AMOUNT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {needsEntryAmount && (
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Entrada disponible</div>
            <select
              value={decisionAnswers.entryAmount}
              onChange={(event) => updateDecisionAnswer("entryAmount", event.target.value)}
              style={styles.select}
            >
              <option value="">Selecciona la entrada</option>
              {ENTRY_AMOUNT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {decisionAnswers.hasBrand === "si" && (
          <>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Tramo de antigüedad</div>
              <select
                value={decisionAnswers.ageFilter}
                onChange={(event) => updateDecisionAnswer("ageFilter", event.target.value)}
                style={styles.select}
              >
                {AGE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Kilometraje máximo</div>
              <select
                value={decisionAnswers.mileageFilter}
                onChange={(event) => updateDecisionAnswer("mileageFilter", event.target.value)}
                style={styles.select}
              >
                {MILEAGE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {decisionAnswers.operation === "comprar" && decisionAnswers.acquisition === "financiado" && decisionAnswers.financeAmount && (
        <div
          style={{
            background: "rgba(124,58,237,0.08)",
            border: "1px solid rgba(124,58,237,0.18)",
            borderRadius: 14,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 11, color: "#c4b5fd", letterSpacing: "0.6px", marginBottom: 6 }}>
            ESTIMACIÓN DE CUOTA
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f5f3ff", marginBottom: 6 }}>
            ~{estimatedFinanceMonthly} €/mes
          </div>
          <p style={{ margin: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
            Estimación orientativa para una financiación a 72 meses con un coste financiero aproximado del 8,99% TIN.
          </p>
        </div>
      )}

      {decisionAnswers.operation === "comprar" && decisionAnswers.acquisition === "mixto" && decisionAnswers.entryAmount && decisionAnswers.financeAmount && (
        <div
          style={{
            background: "rgba(124,58,237,0.08)",
            border: "1px solid rgba(124,58,237,0.18)",
            borderRadius: 14,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 11, color: "#c4b5fd", letterSpacing: "0.6px", marginBottom: 6 }}>
            ESTIMACIÓN DE CUOTA CON ENTRADA
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f5f3ff", marginBottom: 6 }}>
            ~{estimatedMixedMonthly} €/mes
          </div>
          <p style={{ margin: 0, color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
            Con una entrada de {ENTRY_AMOUNT_OPTIONS.find((option) => option.value === decisionAnswers.entryAmount)?.label || "0 €"} y el importe a financiar seleccionado.
          </p>
        </div>
      )}

      {decisionFlowReady ? (
        <div
          style={{
            background: "rgba(37,99,235,0.08)",
            border: "1px solid rgba(37,99,235,0.18)",
            borderRadius: 14,
            padding: 18,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: "0.6px", marginBottom: 8 }}>
            SIGUIENTE PASO DEL FLUJO
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
            {decisionAnswers.hasBrand === "si"
              ? `Buscar la mejor oferta para ${decisionAnswers.brand} ${decisionAnswers.model}`
              : "Comparar las mejores opciones del mercado para tu operación"}
          </div>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
            Con esto ya podemos pedir a la IA que priorice las opciones con mejor relación valor/precio,
            riesgo y encaje con tu modalidad de compra o renting.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button
              onClick={analyzeDecisionWithAI}
              disabled={decisionLoading}
              style={{
                ...styles.btn,
                padding: "10px 16px",
                fontSize: 13,
                opacity: decisionLoading ? 0.7 : 1,
              }}
            >
              {decisionLoading ? "Analizando con IA..." : "🤖 Analizar operación con IA"}
            </button>
            <span style={{ fontSize: 12, color: "#bfdbfe", alignSelf: "center" }}>
              La IA te devolverá una recomendación principal y un único anuncio real para abrir.
            </span>
          </div>
        </div>
      ) : (
        <p style={{ color: "#64748b", fontSize: 13, marginBottom: 18 }}>
          Completa al menos la operación, la modalidad y si ya tienes clara la marca/modelo.
        </p>
      )}

      {decisionError && (
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
          {decisionError}
        </div>
      )}

      {decisionLoading && (
        <div style={{ ...styles.panel, marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
            IA ANALIZANDO LA OPERACIÓN
          </div>
          <div style={{ fontSize: 13, color: "#cbd5e1" }}>
            Cruzando modalidad, presupuesto, estado, financiación y riesgo para devolverte la mejor recomendación.
          </div>
        </div>
      )}

      {decisionAiResult && (
        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          <div style={styles.panel}>
            <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, letterSpacing: "0.6px" }}>
              RECOMENDACIÓN IA PARA ESTA OPERACIÓN
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>
              {decisionAiResult.oferta_top.titulo}
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              {decisionAiResult.resumen}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              {decisionAiResult.oferta_top.precio_objetivo && (
                <span style={{ background: "rgba(37,99,235,0.14)", border: "1px solid rgba(96,165,250,0.22)", color: "#dbeafe", padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                  Precio objetivo: {decisionAiResult.oferta_top.precio_objetivo}
                </span>
              )}
              {decisionAiResult.oferta_top.cuota_estimada && (
                <span style={{ background: "rgba(5,150,105,0.14)", border: "1px solid rgba(52,211,153,0.22)", color: "#d1fae5", padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                  Cuota estimada: {decisionAiResult.oferta_top.cuota_estimada}
                </span>
              )}
              {decisionAiResult.oferta_top.riesgo && (
                <span style={{ background: "rgba(245,158,11,0.14)", border: "1px solid rgba(251,191,36,0.22)", color: "#fde68a", padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                  Riesgo: {decisionAiResult.oferta_top.riesgo}
                </span>
              )}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
              <strong>Criterio principal:</strong> {decisionAiResult.criterio_principal}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
              {decisionAiResult.oferta_top.razon}
            </p>
          </div>

          <div style={styles.panel}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => searchDecisionListing(decisionAiResult)}
                disabled={decisionListingLoading}
                style={{
                  ...styles.btn,
                  padding: "10px 16px",
                  fontSize: 13,
                  opacity: decisionListingLoading ? 0.7 : 1,
                }}
              >
                {decisionListingLoading ? "Buscando anuncio real..." : "🔎 Ver anuncio real recomendado"}
              </button>
              <span style={{ fontSize: 12, color: "#bfdbfe", alignSelf: "center" }}>
                Te mostramos una única opción real para entrar directamente en el anuncio.
              </span>
            </div>

            {decisionListingError && (
              <div
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.18)",
                  borderRadius: 12,
                  padding: 12,
                  color: "#fecaca",
                  fontSize: 12,
                }}
              >
                {decisionListingError}
              </div>
            )}

            {decisionListingResult && (
              <div
                style={{
                  background: "rgba(2,6,23,0.42)",
                  border: "1px solid rgba(96,165,250,0.22)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 10, color: "#67e8f9", marginBottom: 6, fontWeight: 700, letterSpacing: "0.6px" }}>
                  {decisionListingResult.listingType === "renting" ? "📅 OFERTA REAL RECOMENDADA" : "🚗 ANUNCIO REAL RECOMENDADO"}
                  {Number.isFinite(Number(decisionListingResult.rankingScore ?? decisionListingResult.profileScore)) ? ` · ENCAJE ${Number(decisionListingResult.rankingScore ?? decisionListingResult.profileScore)}/100` : ""}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
                      {decisionListingResult.title}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                      {decisionListingResult.description || "Opción real localizada para esta operación."}
                    </p>
                  </div>
                  {decisionListingResult.price && (
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>
                      {decisionListingResult.price}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a
                    href={decisionListingResult.url}
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

          {(decisionAiResult.alertas.length > 0 || decisionAiResult.siguiente_paso) && (
            <div style={styles.panel}>
              {decisionAiResult.alertas.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 6, letterSpacing: "0.6px" }}>
                    ALERTAS A REVISAR
                  </div>
                  <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>
                    {decisionAiResult.alertas.map((alerta) => (
                      <div key={alerta} style={{ fontSize: 12, color: "#fde68a", lineHeight: 1.5 }}>• {alerta}</div>
                    ))}
                  </div>
                </>
              )}
              {decisionAiResult.siguiente_paso && (
                <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                  <strong>Siguiente paso:</strong> {decisionAiResult.siguiente_paso}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!decisionAiResult && rankedOffers.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#60a5fa", letterSpacing: "0.6px", marginBottom: 10 }}>
            VISTA RÁPIDA DE MERCADO
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {rankedOffers.slice(0, 1).map((offer, index) => (
              <div key={offer.id} style={styles.panel}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 4 }}>
                      #{index + 1} EN EL MERCADO ACTUAL · SCORE {offer.score}/100
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
                      {offer.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                      {offer.seller} · {offer.age} años · {offer.mileage.toLocaleString("es-ES")} km
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 21, fontWeight: 800, color: "#f1f5f9" }}>
                      {formatCurrency(offer.price)}
                    </div>
                    {offer.monthly ? (
                      <div style={{ fontSize: 12, color: "#60a5fa", marginTop: 4 }}>
                        ~{offer.monthly} €/mes
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#60a5fa", marginTop: 4 }}>
                        Compra directa
                      </div>
                    )}
                  </div>
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                  {offer.insight}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onSwitchToAdvice} style={styles.btn}>
          Cambiar al flujo de decisión →
        </button>
        <button
          onClick={onRestart}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8",
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
