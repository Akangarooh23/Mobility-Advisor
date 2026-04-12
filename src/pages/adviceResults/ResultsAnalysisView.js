export default function ResultsAnalysisView({
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
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          background: `${mt.color}14`,
          border: `1px solid ${mt.color}30`,
          borderRadius: 18,
          padding: 24,
          marginBottom: 14,
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
              RECOMENDACIÓN PRINCIPAL · {result.solucion_principal?.score}% COINCIDENCIA
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>
              {displayResult.solucion_principal?.titulo}
            </h3>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
              {displayResult.solucion_principal?.resumen}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5, maxWidth: 720 }}>
            Exporta un Word con el detalle de la lógica aplicada: pesos del score, lectura de cada respuesta, coste total, comparador, supuestos y plan de acción.
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
            {logicExportLoading ? "Exportando lógica..." : "Exportar lógica a Word"}
          </button>
        </div>

        {logicExportFeedback && (
          <div style={{ marginBottom: 12, fontSize: 12, color: "#7dd3fc" }}>
            {logicExportFeedback}
          </div>
        )}

        <div
          style={{
            height: 5,
            background: "rgba(255,255,255,0.07)",
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
              background: "rgba(15,23,42,0.28)",
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 10, color: "#7dd3fc", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
              🔍 DESGLOSE DEL SCORE
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {scoreBreakdownEntries.map((item) => {
                const value = Number(scoreBreakdown[item.key] || 0);
                return (
                  <div key={item.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#cbd5e1", marginBottom: 4 }}>
                      <span>{item.label}</span>
                      <span style={{ color: item.color, fontWeight: 700 }}>{value}/{item.max}</span>
                    </div>
                    <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
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
              background: "rgba(15,23,42,0.28)",
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 10, color: "#6ee7b7", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
              🧠 POR QUÉ GANA ESTA OPCIÓN
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {whyThisWins.map((reason, index) => (
                <div key={`why-win-${index}`} style={{ fontSize: 12, color: "#d1fae5", lineHeight: 1.5 }}>
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
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 8, fontWeight: 600, letterSpacing: "0.6px" }}>
              ✅ VENTAJAS
            </div>
            {(displayResult.solucion_principal?.ventajas || []).map((v, i) => (
              <div key={i} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 5, lineHeight: 1.4 }}>
                → {v}
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 8, fontWeight: 600, letterSpacing: "0.6px" }}>
              ⚠️ A TENER EN CUENTA
            </div>
            {(displayResult.solucion_principal?.inconvenientes || []).map((v, i) => (
              <div key={i} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 5, lineHeight: 1.4 }}>
                → {v}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 14, background: "rgba(0,0,0,0.2)", borderRadius: 10 }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>COSTE ESTIMADO</div>
              <div style={{ fontWeight: 700, color: mt.color, fontSize: 14 }}>
                {result.solucion_principal?.coste_estimado}
              </div>
            </div>
            {result.solucion_principal?.etiqueta_dgt && result.solucion_principal.etiqueta_dgt !== "No aplica" && (
              <div>
                <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>ETIQUETA DGT</div>
                <div style={{ fontWeight: 700, color: "#34d399", fontSize: 14 }}>
                  {result.solucion_principal.etiqueta_dgt}
                </div>
              </div>
            )}
          </div>
          {result.propulsiones_viables && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#475569", marginBottom: 6, letterSpacing: "0.6px" }}>
                PROPULSIONES VIABLES
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
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 6, letterSpacing: "0.6px" }}>
            BÚSQUEDA DE MERCADO
          </div>
          <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.6 }}>
            Contrastamos stock público y solo mostramos la mejor opción final encontrada por la IA.
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
          <div style={{ fontSize: 10, color: "#f87171", marginBottom: 6, fontWeight: 600, letterSpacing: "0.6px" }}>
            ⚡ TENSIÓN DETECTADA EN TU PERFIL
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
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
            📊 TCO REAL — COSTE TOTAL DE PROPIEDAD / USO
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
                background: "rgba(15,23,42,0.28)",
                border: "1px solid rgba(251,191,36,0.16)",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 10, color: "#fcd34d", marginBottom: 6, letterSpacing: "0.5px" }}>
                TOTAL ORIENTATIVO
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f8fafc", marginBottom: 2 }}>
                {formatCurrency(Number(tcoDetail.total_mensual || 0))} / mes
              </div>
              <div style={{ fontSize: 12, color: "#fde68a", marginBottom: 6 }}>
                ≈ {formatCurrency(Number(tcoDetail.total_anual || 0))} / año
              </div>
              {Number(tcoDetail.entrada_inicial || 0) > 0 && (
                <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
                  Entrada / capital inicial orientativo: <strong>{formatCurrency(Number(tcoDetail.entrada_inicial || 0))}</strong>
                </div>
              )}
            </div>

            <div
              style={{
                background: "rgba(15,23,42,0.28)",
                border: "1px solid rgba(251,191,36,0.16)",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 10, color: "#fde68a", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                DESGLOSE MENSUAL
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {tcoBreakdownItems.map((item) => {
                  const value = Number(tcoDetail[item.key] || 0);
                  const total = Math.max(1, Number(tcoDetail.total_mensual || 0));
                  return (
                    <div key={item.key}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#e2e8f0", marginBottom: 4 }}>
                        <span>{item.label}</span>
                        <span style={{ color: item.color, fontWeight: 700 }}>{formatCurrency(value)}</span>
                      </div>
                      <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
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
            <p style={{ margin: "0 0 6px", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
              {displayResult.tco_aviso}
            </p>
          )}
          {displayResult.tco_detalle?.nota && (
            <p style={{ margin: 0, fontSize: 12, color: "#fde68a", lineHeight: 1.6 }}>
              <strong>Lectura:</strong> {displayResult.tco_detalle.nota}
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
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                <span style={{ fontSize: 18 }}>{mt2.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0" }}>{alt.titulo}</div>
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
              <div style={{ fontSize: 10, color: "#93c5fd", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                🆚 COMPARADOR FINAL
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {comparatorRows.map((row, index) => (
                  <div
                    key={`compare-${row.criterio || index}`}
                    style={{
                      background: "rgba(15,23,42,0.26)",
                      border: "1px solid rgba(148,163,184,0.12)",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{row.criterio}</div>
                      <span
                        style={{
                          background: "rgba(16,185,129,0.14)",
                          border: "1px solid rgba(52,211,153,0.24)",
                          color: "#bbf7d0",
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
                      <div style={{ fontSize: 11, color: "#dbeafe", lineHeight: 1.5 }}><strong>Opción elegida:</strong> {row.opcion_principal}</div>
                      {row.alternativa_1 && (
                        <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}><strong>Alternativa 1:</strong> {row.alternativa_1}</div>
                      )}
                      {row.alternativa_2 && (
                        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}><strong>Alternativa 2:</strong> {row.alternativa_2}</div>
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
              <div style={{ fontSize: 10, color: "#6ee7b7", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                🔎 TRANSPARENCIA DEL VEREDICTO
              </div>
              {transparency.confianza_motivo && (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#d1fae5", lineHeight: 1.6 }}>
                  <strong>{confidenceLevel ? `Confianza ${confidenceLevel}` : "Lectura"}:</strong> {transparency.confianza_motivo}
                </p>
              )}
              {transparencyAssumptions.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#bbf7d0", marginBottom: 6, letterSpacing: "0.5px" }}>SUPUESTOS CLAVE</div>
                  <div style={{ display: "grid", gap: 5 }}>
                    {transparencyAssumptions.map((item, index) => (
                      <div key={`assumption-${index}`} style={{ fontSize: 11, color: "#dcfce7", lineHeight: 1.5 }}>• {item}</div>
                    ))}
                  </div>
                </div>
              )}
              {transparencyChecks.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: "#bbf7d0", marginBottom: 6, letterSpacing: "0.5px" }}>VALIDACIONES PENDIENTES</div>
                  <div style={{ display: "grid", gap: 5 }}>
                    {transparencyChecks.map((item, index) => (
                      <div key={`check-${index}`} style={{ fontSize: 11, color: "#d1fae5", lineHeight: 1.5 }}>• {item}</div>
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
              🚦 SEMÁFORO DE DECISIÓN FINAL
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
          {actionPlan.estado && <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", marginBottom: 6 }}>{actionPlan.estado}</div>}
          {actionPlan.resumen && <p style={{ margin: "0 0 10px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.6 }}>{actionPlan.resumen}</p>}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 12,
            }}
          >
            {actionSteps.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: trafficTone.text, marginBottom: 6, letterSpacing: "0.5px" }}>QUÉ HACER AHORA</div>
                <div style={{ display: "grid", gap: 5 }}>
                  {actionSteps.map((item, index) => (
                    <div key={`action-step-${index}`} style={{ fontSize: 11, color: "#f8fafc", lineHeight: 1.5 }}>
                      {index + 1}. {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {actionAlerts.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "#fda4af", marginBottom: 6, letterSpacing: "0.5px" }}>ALERTAS ROJAS</div>
                <div style={{ display: "grid", gap: 5 }}>
                  {actionAlerts.map((item, index) => (
                    <div key={`action-alert-${index}`} style={{ fontSize: 11, color: "#fecdd3", lineHeight: 1.5 }}>
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
          <div style={{ fontSize: 10, color: "#7dd3fc", fontWeight: 700, letterSpacing: "0.6px" }}>
            📌 RADAR DE MERCADO Y COMPARATIVAS GUARDADAS
          </div>
          <button
            type="button"
            onClick={saveCurrentComparison}
            style={{
              background: "rgba(14,165,233,0.18)",
              border: "1px solid rgba(125,211,252,0.28)",
              color: "#e0f2fe",
              padding: "6px 10px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📌 Guardar comparativa
          </button>
        </div>

        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#dbeafe", lineHeight: 1.6 }}>{marketRadar.objetivo}</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "#bae6fd", marginBottom: 6, letterSpacing: "0.5px" }}>SEÑALES PARA ENTRAR</div>
            <div style={{ display: "grid", gap: 5 }}>
              {marketRadar.senales_verdes.map((item, index) => (
                <div key={`radar-green-${index}`} style={{ fontSize: 11, color: "#e0f2fe", lineHeight: 1.5 }}>
                  • {item}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#fda4af", marginBottom: 6, letterSpacing: "0.5px" }}>CUÁNDO ESPERAR O DESCARTAR</div>
            <div style={{ display: "grid", gap: 5 }}>
              {marketRadar.alertas.map((item, index) => (
                <div key={`radar-alert-${index}`} style={{ fontSize: 11, color: "#fecdd3", lineHeight: 1.5 }}>
                  • {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {saveFeedback && <div style={{ fontSize: 11, color: "#67e8f9", marginBottom: 10 }}>{saveFeedback}</div>}

        {savedComparisonItems.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#bae6fd", marginBottom: 8, letterSpacing: "0.5px" }}>ÚLTIMAS COMPARATIVAS</div>
            <div style={{ display: "grid", gap: 8 }}>
              {savedComparisonItems.map((item) => {
                const savedOfferHref =
                  normalizeText(item?.targetUrl) ||
                  getOfferFallbackSearchUrl(
                    {
                      title: item?.listingTitle || item?.title,
                      source: item?.sourceLabel || "Mercado general",
                      listingType: item?.typeKey || "movilidad",
                    },
                    { solucion_principal: { tipo: item?.typeKey || "movilidad", titulo: item?.title || "" } }
                  );

                return (
                  <div
                    key={item.id}
                    onClick={() => savedOfferHref && openOfferInNewTab(savedOfferHref)}
                    title={savedOfferHref ? "Abrir oferta guardada" : undefined}
                    style={{
                      background: "rgba(15,23,42,0.28)",
                      border: "1px solid rgba(148,163,184,0.14)",
                      borderRadius: 10,
                      padding: 10,
                      cursor: savedOfferHref ? "pointer" : "default",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{item.title}</div>
                      <button
                        type="button"
                        onClick={() => removeSavedComparison(item.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#fda4af",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 4 }}>
                      {item.typeLabel} · {item.score}% · confianza {String(item.confidence || "media").toUpperCase()} · {item.savedAt}
                    </div>
                    <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}>
                      {item.monthlyTotal > 0 ? `${formatCurrency(item.monthlyTotal)}/mes` : item.budgetLabel}
                      {item.listingTitle ? ` · referencia: ${item.listingTitle}` : ""}
                      {item.listingPrice ? ` · ${item.listingPrice}` : ""}
                    </div>
                    {savedOfferHref && <div style={{ fontSize: 11, color: "#7dd3fc", marginTop: 5, fontWeight: 700 }}>Abrir oferta ↗</div>}
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
          }}
        >
          <div style={{ fontSize: 10, color: "#eab308", marginBottom: 7, fontWeight: 600, letterSpacing: "0.6px" }}>
            💡 CONSEJO DE EXPERTO
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{displayResult.consejo_experto}</p>
        </div>
        <div
          style={{
            background: "rgba(16,185,129,0.07)",
            border: "1px solid rgba(16,185,129,0.18)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 10, color: "#34d399", marginBottom: 7, fontWeight: 600, letterSpacing: "0.6px" }}>
            {listingResult ? "✅ OFERTA REAL PRESELECCIONADA" : "🧭 BÚSQUEDA DE OFERTA REAL"}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
            {listingResult
              ? `${listingResult.title}${listingResult.price ? ` · ${listingResult.price}` : ""}`
              : "Indica tu cuota objetivo y lanza la búsqueda para que la IA revise automáticamente varios portales y te traiga una única opción real."}
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
          🚗 Ver tus ofertas
        </button>
      </div>
    </div>
  );
}
