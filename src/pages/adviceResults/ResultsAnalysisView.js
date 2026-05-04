import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function ResultsAnalysisView({
  themeMode,
  mt,
  result,
  displayResult,
  scoreBreakdownEntries,
  scoreBreakdown,
  whyThisWins,
  tcoDetail,
  tcoBreakdownItems,
  formatCurrency,
  MOBILITY_TYPES,
  comparatorRows,
  transparency,
  transparencyAssumptions,
  transparencyChecks,
  confidenceLevel,
  winnerLabels,
  actionPlan,
  actionSteps,
  actionAlerts,
  trafficTone,
  trafficLabel,
  marketRadar,
  saveCurrentComparison,
  saveFeedback,
  savedComparisonItems,
  normalizeText,
  getOfferFallbackSearchUrl,
  openOfferInNewTab,
  removeSavedComparison,
  listingResult,
  showOffersPage,
  onExportLogicDocument,
  logicExportLoading,
  logicExportFeedback,
}) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const text = {
    mainRecommendation: isEn ? "MAIN RECOMMENDATION" : "RECOMENDACIÓN PRINCIPAL",
    match: isEn ? "MATCH" : "COINCIDENCIA",
    exportDesc: isEn
      ? "Export a Word document with applied logic details: score weights, answer reading, total cost, comparator, assumptions and action plan."
      : "Exporta un Word con el detalle de la lógica aplicada: pesos del score, lectura de cada respuesta, coste total, comparador, supuestos y plan de acción.",
    exporting: isEn ? "Exporting logic..." : "Exportando lógica...",
    exportWord: isEn ? "Export logic to Word" : "Exportar lógica a Word",
    scoreBreakdown: isEn ? "🔍 SCORE BREAKDOWN" : "🔍 DESGLOSE DEL SCORE",
    whyWins: isEn ? "🧠 WHY THIS OPTION WINS" : "🧠 POR QUÉ GANA ESTA OPCIÓN",
    strengths: isEn ? "✅ STRENGTHS" : "✅ VENTAJAS",
    consider: isEn ? "⚠️ POINTS TO CONSIDER" : "⚠️ A TENER EN CUENTA",
    estimatedCost: isEn ? "ESTIMATED COST" : "COSTE ESTIMADO",
    dgtLabel: isEn ? "DGT LABEL" : "ETIQUETA DGT",
    viablePowertrains: isEn ? "VIABLE POWERTRAINS" : "PROPULSIONES VIABLES",
    marketSearch: isEn ? "MARKET SEARCH" : "BÚSQUEDA DE MERCADO",
    marketSearchDesc: isEn ? "We contrast public stock and show only the best final option found by AI." : "Contrastamos stock público y solo mostramos la mejor opción final encontrada por la IA.",
    profileTension: isEn ? "⚡ TENSION DETECTED IN YOUR PROFILE" : "⚡ TENSIÓN DETECTADA EN TU PERFIL",
    tcoTitle: isEn ? "📊 REAL TCO - TOTAL COST OF OWNERSHIP / USE" : "📊 TCO REAL — COSTE TOTAL DE PROPIEDAD / USO",
    monthly: isEn ? "month" : "mes",
    annual: isEn ? "year" : "año",
    downPayment: isEn ? "Indicative down payment / upfront capital" : "Entrada / capital inicial orientativo",
    monthlyBreakdown: isEn ? "MONTHLY BREAKDOWN" : "DESGLOSE MENSUAL",
    reading: isEn ? "Reading" : "Lectura",
    finalComparator: isEn ? "🆚 FINAL COMPARATOR" : "🆚 COMPARADOR FINAL",
    transparency: isEn ? "🔎 VERDICT TRANSPARENCY" : "🔎 TRANSPARENCIA DEL VEREDICTO",
    selectedOption: isEn ? "Selected option" : "Opción elegida",
    alternative1: isEn ? "Alternative 1" : "Alternativa 1",
    alternative2: isEn ? "Alternative 2" : "Alternativa 2",
    keyAssumptions: isEn ? "KEY ASSUMPTIONS" : "SUPUESTOS CLAVE",
    pendingChecks: isEn ? "PENDING VALIDATIONS" : "VALIDACIONES PENDIENTES",
    finalDecision: isEn ? "🚦 FINAL DECISION TRAFFIC LIGHT" : "🚦 SEMÁFORO DE DECISIÓN FINAL",
    doNow: isEn ? "WHAT TO DO NOW" : "QUÉ HACER AHORA",
    redAlerts: isEn ? "RED ALERTS" : "ALERTAS ROJAS",
    marketRadar: isEn ? "📌 MARKET RADAR AND SAVED COMPARISONS" : "📌 RADAR DE MERCADO Y COMPARATIVAS GUARDADAS",
    saveComparison: isEn ? "📌 Save comparison" : "📌 Guardar comparativa",
    enterSignals: isEn ? "ENTRY SIGNALS" : "SEÑALES PARA ENTRAR",
    waitSignals: isEn ? "WHEN TO WAIT OR DISCARD" : "CUÁNDO ESPERAR O DESCARTAR",
    latestComparisons: isEn ? "LATEST COMPARISONS" : "ÚLTIMAS COMPARATIVAS",
    openSavedOffer: isEn ? "Open saved offer" : "Abrir oferta guardada",
    remove: isEn ? "Remove" : "Quitar",
    confidence: isEn ? "confidence" : "confianza",
    reference: isEn ? "reference" : "referencia",
    openOffer: isEn ? "Open offer ↗" : "Abrir oferta ↗",
    generalMarket: isEn ? "General market" : "Mercado general",
    expertTip: isEn ? "💡 EXPERT TIP" : "💡 CONSEJO DE EXPERTO",
    realOfferReady: isEn ? "✅ REAL OFFER PRESELECTED" : "✅ OFERTA REAL PRESELECCIONADA",
    realOfferSearch: isEn ? "🧭 REAL OFFER SEARCH" : "🧭 BÚSQUEDA DE OFERTA REAL",
    realOfferHelp: isEn
      ? "Set your target monthly payment and launch the search so AI reviews multiple portals and brings you a single real option."
      : "Indica tu cuota objetivo y lanza la búsqueda para que la IA revise automáticamente varios portales y te traiga una única opción real.",
    viewOffers: isEn ? "🚗 View your offers" : "🚗 Ver tus ofertas",
  };
  const [hoveredCard, setHoveredCard] = useState(null);
  const isDark = themeMode === "dark";
  const cardBg = isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.95)";
  const cardBorder = isDark ? "rgba(148,163,184,0.32)" : "rgba(31,41,55,0.1)";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          background: `${mt.color}14`,
          border: `1px solid ${mt.color}30`,
          borderRadius: 18,
          padding: 24,
          marginBottom: 14,
          boxShadow: "0 14px 30px rgba(15,23,42,0.1)",
        }}
      >
        <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 13,
              background: `${mt.color}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            {mt.icon}
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                color: mt.color,
                letterSpacing: "0.8px",
                marginBottom: 4,
                fontWeight: 600,
              }}
            >
              {text.mainRecommendation} · {result.solucion_principal?.score}% {text.match}
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: titleColor }}>
              {displayResult.solucion_principal?.titulo}
            </h3>
            <p style={{ margin: 0, color: isDark ? "#cbd5e1" : "#64748b", fontSize: 13, lineHeight: 1.6 }}>
              {displayResult.solucion_principal?.resumen}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: bodyColor, lineHeight: 1.5, maxWidth: 720 }}>
            {text.exportDesc}
          </div>
          <button
            type="button"
            onClick={onExportLogicDocument}
            disabled={logicExportLoading}
            style={{
              background: logicExportLoading ? "rgba(14,165,233,0.12)" : "linear-gradient(135deg,#0ea5e9,#0284c7)",
              border: "1px solid rgba(125,211,252,0.28)",
              color: "#f0f9ff",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              cursor: logicExportLoading ? "progress" : "pointer",
              opacity: logicExportLoading ? 0.82 : 1,
              boxShadow: logicExportLoading ? "none" : "0 10px 24px rgba(14,165,233,0.16)",
            }}
          >
            {logicExportLoading ? text.exporting : text.exportWord}
          </button>
        </div>

        {logicExportFeedback && (
          <div style={{ marginBottom: 12, fontSize: 12, color: "#0369a1" }}>
            {logicExportFeedback}
          </div>
        )}

        <div
          style={{
            height: 5,
            background: isDark ? "rgba(148,163,184,0.26)" : "rgba(255,255,255,0.07)",
            borderRadius: 3,
            overflow: "hidden",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${result.solucion_principal?.score}%`,
              background: mt.color,
              borderRadius: 3,
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: cardBg,
              border: isDark ? "1px solid rgba(125,211,252,0.22)" : "1px solid rgba(3,105,161,0.1)",
              borderRadius: 12,
              padding: 12,
              boxShadow: "0 8px 20px rgba(3,105,161,0.08)",
            }}
          >
            <div style={{ fontSize: 10, color: "#0369a1", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
              {text.scoreBreakdown}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {scoreBreakdownEntries.map((item) => {
                const value = Number(scoreBreakdown[item.key] || 0);
                return (
                  <div key={item.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: bodyColor, marginBottom: 4 }}>
                      <span>{item.label}</span>
                      <span style={{ color: item.color, fontWeight: 700 }}>{value}/{item.max}</span>
                    </div>
                    <div style={{ height: 5, background: "rgba(31,41,55,0.08)", borderRadius: 999, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, (value / item.max) * 100)}%`,
                          background: item.color,
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              background: cardBg,
              border: isDark ? "1px solid rgba(110,231,183,0.22)" : "1px solid rgba(16,185,129,0.1)",
              borderRadius: 12,
              padding: 12,
              boxShadow: "0 8px 20px rgba(16,185,129,0.08)",
            }}
          >
            <div style={{ fontSize: 10, color: "#047857", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
              {text.whyWins}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {whyThisWins.map((reason, index) => (
                <div key={`why-win-${index}`} style={{ fontSize: 12, color: "#065f46", lineHeight: 1.5 }}>
                  • {reason}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: bodyColor, marginBottom: 8, fontWeight: 600, letterSpacing: "0.6px" }}>
              {text.strengths}
            </div>
            {(displayResult.solucion_principal?.ventajas || []).map((v, i) => (
              <div key={i} style={{ fontSize: 12, color: bodyColor, marginBottom: 5, lineHeight: 1.4 }}>
                → {v}
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 10, color: bodyColor, marginBottom: 8, fontWeight: 600, letterSpacing: "0.6px" }}>
              {text.consider}
            </div>
            {(displayResult.solucion_principal?.inconvenientes || []).map((v, i) => (
              <div key={i} style={{ fontSize: 12, color: bodyColor, marginBottom: 5, lineHeight: 1.4 }}>
                → {v}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 14, background: cardBg, borderRadius: 10, border: `1px solid ${cardBorder}` }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: bodyColor, marginBottom: 4 }}>{text.estimatedCost}</div>
              <div style={{ fontWeight: 700, color: mt.color, fontSize: 14 }}>
                {result.solucion_principal?.coste_estimado}
              </div>
            </div>
            {result.solucion_principal?.etiqueta_dgt && result.solucion_principal.etiqueta_dgt !== "No aplica" && (
              <div>
                <div style={{ fontSize: 10, color: bodyColor, marginBottom: 4 }}>{text.dgtLabel}</div>
                <div style={{ fontWeight: 700, color: "#34d399", fontSize: 14 }}>
                  {result.solucion_principal.etiqueta_dgt}
                </div>
              </div>
            )}
          </div>
          {result.propulsiones_viables && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: bodyColor, marginBottom: 6, letterSpacing: "0.6px" }}>
                {text.viablePowertrains}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {result.propulsiones_viables.map((p) => (
                  <span
                    key={p}
                    style={{
                      background: "rgba(5,150,105,0.15)",
                      border: "1px solid rgba(5,150,105,0.25)",
                      padding: "2px 9px",
                      borderRadius: 100,
                      fontSize: 11,
                      color: "#34d399",
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
              <div style={{ fontSize: 10, color: bodyColor, marginBottom: 6, letterSpacing: "0.6px" }}>
            {text.marketSearch}
          </div>
          <div style={{ fontSize: 11, color: bodyColor, lineHeight: 1.6 }}>
            {text.marketSearchDesc}
          </div>
        </div>
      </div>

      {result.solucion_principal?.tension_principal && (
        <div
          style={{
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.18)",
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 10, color: "#b91c1c", marginBottom: 6, fontWeight: 600, letterSpacing: "0.6px" }}>
            {text.profileTension}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
            {displayResult.solucion_principal.tension_principal}
          </p>
        </div>
      )}

      {(result.tco_aviso || Number(tcoDetail.total_mensual || 0) > 0) && (
        <div
          style={{
            background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.18)",
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 10, color: "#fbbf24", marginBottom: 8, fontWeight: 600, letterSpacing: "0.6px" }}>
            {text.tcoTitle}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                background: cardBg,
                border: "1px solid rgba(251,191,36,0.24)",
                borderRadius: 12,
                padding: 12,
                boxShadow: "0 8px 18px rgba(217,119,6,0.08)",
              }}
            >
              <div style={{ fontSize: 10, color: "#b45309", marginBottom: 6, letterSpacing: "0.5px" }}>
                TOTAL ORIENTATIVO
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: titleColor, marginBottom: 2 }}>
                {formatCurrency(Number(tcoDetail.total_mensual || 0))} / {text.monthly}
              </div>
              <div style={{ fontSize: 12, color: "#92400e", marginBottom: 6 }}>
                ≈ {formatCurrency(Number(tcoDetail.total_anual || 0))} / {text.annual}
              </div>
              {Number(tcoDetail.entrada_inicial || 0) > 0 && (
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                  {text.downPayment}: <strong>{formatCurrency(Number(tcoDetail.entrada_inicial || 0))}</strong>
                </div>
              )}
            </div>

            <div
              style={{
                background: cardBg,
                border: "1px solid rgba(251,191,36,0.24)",
                borderRadius: 12,
                padding: 12,
                boxShadow: "0 8px 18px rgba(217,119,6,0.08)",
              }}
            >
              <div style={{ fontSize: 10, color: "#92400e", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                {text.monthlyBreakdown}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {tcoBreakdownItems.map((item) => {
                  const value = Number(tcoDetail[item.key] || 0);
                  const total = Math.max(1, Number(tcoDetail.total_mensual || 0));
                  return (
                    <div key={item.key}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#475569", marginBottom: 4 }}>
                        <span>{item.label}</span>
                        <span style={{ color: item.color, fontWeight: 700 }}>{formatCurrency(value)}</span>
                      </div>
                      <div style={{ height: 5, background: "rgba(31,41,55,0.08)", borderRadius: 999, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, (value / total) * 100)}%`,
                            background: item.color,
                            borderRadius: 999,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {displayResult.tco_aviso && (
            <p style={{ margin: "0 0 6px", fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
              {displayResult.tco_aviso}
            </p>
          )}
          {displayResult.tco_detalle?.nota && (
            <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
              <strong>{text.reading}:</strong> {displayResult.tco_detalle.nota}
            </p>
          )}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        {(displayResult.alternativas || []).map((alt, i) => {
          const mt2 = MOBILITY_TYPES[alt.tipo] || {
            label: alt.tipo,
            icon: "🚗",
            color: "#64748b",
          };
          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredCard(`alt-${i}`)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                background: cardBg,
                border: hoveredCard === `alt-${i}`
                  ? "1px solid rgba(59,130,246,0.32)"
                  : "1px solid rgba(31,41,55,0.1)",
                borderRadius: 12,
                padding: 14,
                boxShadow: hoveredCard === `alt-${i}`
                  ? "0 14px 30px rgba(59,130,246,0.14)"
                  : "0 8px 18px rgba(15,23,42,0.06)",
                transform: hoveredCard === `alt-${i}` ? "translateY(-2px)" : "translateY(0)",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                <span style={{ fontSize: 18 }}>{mt2.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: titleColor }}>{alt.titulo}</div>
                  <div style={{ fontSize: 11, color: mt2.color }}>{alt.score}% coincidencia</div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{alt.razon}</p>
            </div>
          );
        })}
      </div>

      {(comparatorRows.length > 0 || transparency.confianza_motivo || transparencyAssumptions.length > 0 || transparencyChecks.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 10,
            marginBottom: 16,
          }}
        >
          {comparatorRows.length > 0 && (
            <div
              style={{
                background: "rgba(37,99,235,0.07)",
                border: "1px solid rgba(96,165,250,0.18)",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 10, color: "#1d4ed8", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                {text.finalComparator}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {comparatorRows.map((row, index) => (
                  <div
                    key={`compare-${row.criterio || index}`}
                    style={{
                      background: cardBg,
                      border: "1px solid rgba(148,163,184,0.12)",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: titleColor }}>{row.criterio}</div>
                      <span
                        style={{
                          background: "rgba(16,185,129,0.14)",
                          border: "1px solid rgba(52,211,153,0.24)",
                          color: "#047857",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {winnerLabels[row.ganador] || "Gana la recomendada"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gap: 5 }}>
                      <div style={{ fontSize: 11, color: "#1e3a8a", lineHeight: 1.5 }}><strong>{text.selectedOption}:</strong> {row.opcion_principal}</div>
                      {row.alternativa_1 && (
                        <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}><strong>{text.alternative1}:</strong> {row.alternativa_1}</div>
                      )}
                      {row.alternativa_2 && (
                        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}><strong>{text.alternative2}:</strong> {row.alternativa_2}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(transparency.confianza_motivo || transparencyAssumptions.length > 0 || transparencyChecks.length > 0) && (
            <div
              style={{
                background: "rgba(16,185,129,0.07)",
                border: "1px solid rgba(52,211,153,0.18)",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 10, color: "#047857", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                {text.transparency}
              </div>
              {transparency.confianza_motivo && (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#065f46", lineHeight: 1.6 }}>
                  <strong>{confidenceLevel ? `${text.reading} ${confidenceLevel}` : text.reading}:</strong> {transparency.confianza_motivo}
                </p>
              )}
              {transparencyAssumptions.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#047857", marginBottom: 6, letterSpacing: "0.5px" }}>{text.keyAssumptions}</div>
                  <div style={{ display: "grid", gap: 5 }}>
                    {transparencyAssumptions.map((item, index) => (
                      <div key={`assumption-${index}`} style={{ fontSize: 11, color: "#065f46", lineHeight: 1.5 }}>• {item}</div>
                    ))}
                  </div>
                </div>
              )}
              {transparencyChecks.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: "#047857", marginBottom: 6, letterSpacing: "0.5px" }}>{text.pendingChecks}</div>
                  <div style={{ display: "grid", gap: 5 }}>
                    {transparencyChecks.map((item, index) => (
                      <div key={`check-${index}`} style={{ fontSize: 11, color: "#065f46", lineHeight: 1.5 }}>• {item}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(actionPlan.estado || actionPlan.resumen || actionSteps.length > 0 || actionAlerts.length > 0) && (
        <div
          style={{
            background: trafficTone.bg,
            border: `1px solid ${trafficTone.border}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: trafficTone.text, fontWeight: 700, letterSpacing: "0.6px" }}>
              {text.finalDecision}
            </div>
            <span
              style={{
                background: trafficTone.chip,
                border: `1px solid ${trafficTone.border}`,
                color: trafficTone.text,
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {trafficLabel}
            </span>
          </div>
          {actionPlan.estado && <div style={{ fontSize: 16, fontWeight: 800, color: titleColor, marginBottom: 6 }}>{actionPlan.estado}</div>}
          {actionPlan.resumen && <p style={{ margin: "0 0 10px", fontSize: 12, color: bodyColor, lineHeight: 1.6 }}>{actionPlan.resumen}</p>}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 12,
            }}
          >
            {actionSteps.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: trafficTone.text, marginBottom: 6, letterSpacing: "0.5px" }}>{text.doNow}</div>
                <div style={{ display: "grid", gap: 5 }}>
                  {actionSteps.map((item, index) => (
                    <div key={`action-step-${index}`} style={{ fontSize: 11, color: titleColor, lineHeight: 1.5 }}>
                      {index + 1}. {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {actionAlerts.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "#b91c1c", marginBottom: 6, letterSpacing: "0.5px" }}>{text.redAlerts}</div>
                <div style={{ display: "grid", gap: 5 }}>
                  {actionAlerts.map((item, index) => (
                    <div key={`action-alert-${index}`} style={{ fontSize: 11, color: "#991b1b", lineHeight: 1.5 }}>
                      • {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          background: "rgba(14,165,233,0.07)",
          border: "1px solid rgba(125,211,252,0.18)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: "#0369a1", fontWeight: 700, letterSpacing: "0.6px" }}>
            {text.marketRadar}
          </div>
          <button
            type="button"
            onClick={saveCurrentComparison}
            style={{
              background: "rgba(14,165,233,0.18)",
              border: "1px solid rgba(125,211,252,0.28)",
              color: "#0c4a6e",
              padding: "6px 10px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {text.saveComparison}
          </button>
        </div>

        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#1e3a8a", lineHeight: 1.6 }}>{marketRadar.objetivo}</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "#075985", marginBottom: 6, letterSpacing: "0.5px" }}>{text.enterSignals}</div>
            <div style={{ display: "grid", gap: 5 }}>
              {marketRadar.senales_verdes.map((item, index) => (
                <div key={`radar-green-${index}`} style={{ fontSize: 11, color: "#0c4a6e", lineHeight: 1.5 }}>
                  • {item}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#b91c1c", marginBottom: 6, letterSpacing: "0.5px" }}>{text.waitSignals}</div>
            <div style={{ display: "grid", gap: 5 }}>
              {marketRadar.alertas.map((item, index) => (
                <div key={`radar-alert-${index}`} style={{ fontSize: 11, color: "#991b1b", lineHeight: 1.5 }}>
                  • {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {saveFeedback && <div style={{ fontSize: 11, color: "#0c4a6e", marginBottom: 10 }}>{saveFeedback}</div>}

        {savedComparisonItems.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#075985", marginBottom: 8, letterSpacing: "0.5px" }}>{text.latestComparisons}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {savedComparisonItems.map((item) => {
                const savedOfferHref =
                  normalizeText(item?.targetUrl) ||
                  getOfferFallbackSearchUrl(
                    {
                      title: item?.listingTitle || item?.title,
                      source: item?.sourceLabel || text.generalMarket,
                      listingType: item?.typeKey || "movilidad",
                    },
                    { solucion_principal: { tipo: item?.typeKey || "movilidad", titulo: item?.title || "" } }
                  );

                return (
                  <div
                    key={item.id}
                    onClick={() => savedOfferHref && openOfferInNewTab(savedOfferHref)}
                    title={savedOfferHref ? text.openSavedOffer : undefined}
                    onMouseEnter={() => setHoveredCard(`saved-${item.id}`)}
                    onMouseLeave={() => setHoveredCard(null)}
                    style={{
                      background: cardBg,
                      border: hoveredCard === `saved-${item.id}`
                        ? "1px solid rgba(59,130,246,0.3)"
                        : "1px solid rgba(148,163,184,0.14)",
                      borderRadius: 10,
                      padding: 10,
                      cursor: savedOfferHref ? "pointer" : "default",
                      boxShadow: hoveredCard === `saved-${item.id}`
                        ? "0 14px 30px rgba(59,130,246,0.14)"
                        : "0 8px 18px rgba(15,23,42,0.06)",
                      transform: hoveredCard === `saved-${item.id}` ? "translateY(-2px)" : "translateY(0)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: titleColor }}>{item.title}</div>
                      <button
                        type="button"
                        onClick={() => removeSavedComparison(item.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#b91c1c",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        {text.remove}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: "#1d4ed8", marginBottom: 4 }}>
                      {item.typeLabel} · {item.score}% · {text.confidence} {String(item.confidence || "media").toUpperCase()} · {item.savedAt}
                    </div>
                    <div style={{ fontSize: 11, color: bodyColor, lineHeight: 1.5 }}>
                      {item.monthlyTotal > 0 ? `${formatCurrency(item.monthlyTotal)}/${text.monthly}` : item.budgetLabel}
                      {item.listingTitle ? ` · ${text.reference}: ${item.listingTitle}` : ""}
                      {item.listingPrice ? ` · ${item.listingPrice}` : ""}
                    </div>
                    {savedOfferHref && <div style={{ fontSize: 11, color: "#0369a1", marginTop: 5, fontWeight: 700 }}>{text.openOffer}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 10,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "rgba(234,179,8,0.07)",
            border: "1px solid rgba(234,179,8,0.18)",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 10px 24px rgba(217,119,6,0.08)",
          }}
        >
          <div style={{ fontSize: 10, color: "#eab308", marginBottom: 7, fontWeight: 600, letterSpacing: "0.6px" }}>
            {text.expertTip}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{displayResult.consejo_experto}</p>
        </div>
        <div
          style={{
            background: "rgba(16,185,129,0.07)",
            border: "1px solid rgba(16,185,129,0.18)",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 10px 24px rgba(5,150,105,0.08)",
          }}
        >
          <div style={{ fontSize: 10, color: "#047857", marginBottom: 7, fontWeight: 600, letterSpacing: "0.6px" }}>
            {listingResult ? text.realOfferReady : text.realOfferSearch}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
            {listingResult
              ? `${listingResult.title}${listingResult.price ? ` · ${listingResult.price}` : ""}`
              : text.realOfferHelp}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={showOffersPage}
          style={{
            background: "linear-gradient(135deg,#10b981,#059669)",
            border: "none",
            color: "white",
            padding: "12px 20px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 12px 30px rgba(16,185,129,0.18)",
          }}
        >
          {text.viewOffers}
        </button>
      </div>
    </div>
  );
}
