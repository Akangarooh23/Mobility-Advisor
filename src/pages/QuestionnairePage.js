export default function QuestionnairePage({
  styles,
  currentStep,
  step,
  totalSteps,
  advancedMode,
  toggleAdvancedMode,
  remainingQuestions,
  completionPct,
  multiSelected,
  dualTimelineSelection,
  answers,
  BRAND_LOGOS,
  onHandleMultiToggle,
  onHandleDualTimelineSelect,
  onHandleSingle,
  onHandleMultiNext,
  onHandleDualTimelineNext,
  onGoPrevious,
  onRestartQuestionnaire,
  onTellMeNow,
  answeredSteps,
}) {
  return (
    <div style={styles.center}>
      <div style={styles.blockBadge(currentStep.block)}>
        {currentStep.blockIcon} {currentStep.block.toUpperCase()}
      </div>
      <div style={{ fontSize: 11, color: "#334155", letterSpacing: "1px", marginBottom: 6 }}>
        PREGUNTA {step + 1} DE {totalSteps}
      </div>
      <h2
        style={{
          fontSize: "clamp(18px,4vw,26px)",
          fontWeight: 700,
          letterSpacing: "-0.6px",
          margin: "0 0 8px",
          color: "#f1f5f9",
          lineHeight: 1.3,
        }}
      >
        {currentStep.question}
      </h2>
      <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
        {currentStep.subtitle}
      </p>

      <div
        style={{
          background: "rgba(20,184,166,0.08)",
          border: "1px solid rgba(20,184,166,0.22)",
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#99f6e4", fontWeight: 700, marginBottom: 4 }}>
              🧪 Test avanzado opcional
            </div>
            <div style={{ fontSize: 12, color: "#ccfbf1", lineHeight: 1.5 }}>
              {advancedMode
                ? "Activado: añadimos preguntas de zona, ZBE, garaje, presupuesto cómodo, capital y riesgo para afinar la recomendación."
                : "Puedes activar 6 preguntas extra para llevar el análisis a un nivel mucho más preciso sin tocar el flujo base."}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleAdvancedMode}
            style={{
              background: advancedMode ? "rgba(20,184,166,0.22)" : "rgba(37,99,235,0.18)",
              border: `1px solid ${advancedMode ? "rgba(153,246,228,0.4)" : "rgba(147,197,253,0.35)"}`,
              color: advancedMode ? "#ccfbf1" : "#dbeafe",
              padding: "8px 12px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {advancedMode ? "✓ Modo avanzado activado" : "+ Activar test avanzado"}
          </button>
        </div>
      </div>

      <div
        style={{
          background: "rgba(14,165,233,0.08)",
          border: "1px solid rgba(14,165,233,0.2)",
          borderRadius: 12,
          padding: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "#bae6fd", fontWeight: 600 }}>
            ✅ Te quedan {remainingQuestions} pregunta{remainingQuestions === 1 ? "" : "s"}
          </div>
          <div style={{ fontSize: 12, color: "#7dd3fc" }}>
            {completionPct}% completado
          </div>
        </div>
        <div
          style={{
            marginTop: 8,
            height: 4,
            borderRadius: 4,
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${completionPct}%`,
              height: "100%",
              background: "linear-gradient(90deg,#22d3ee,#2563eb)",
              transition: "width 0.35s ease",
            }}
          />
        </div>
      </div>

      {currentStep.type !== "dual_timeline" && currentStep.options.map((opt) => {
        const selected =
          currentStep.type === "multi"
            ? multiSelected.includes(opt.value)
            : answers[currentStep.id] === opt.value;
        return (
          <button
            key={opt.value}
            style={styles.card(selected)}
            onClick={() =>
              currentStep.type === "multi"
                ? onHandleMultiToggle(opt.value)
                : onHandleSingle(opt.value)
            }
          >
            <span style={{ fontSize: 22, minWidth: 30 }}>{opt.icon}</span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: selected ? "#93c5fd" : "#e2e8f0",
                }}
              >
                {opt.label}
              </div>
              {opt.desc && (
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{opt.desc}</div>
              )}
              {Array.isArray(opt.brandChips) && opt.brandChips.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {opt.brandChips.map((chip) => {
                    const logo = BRAND_LOGOS[chip.label];
                    const LogoIcon = logo?.icon;

                    return (
                      <span
                        key={`${opt.value}-${chip.short}`}
                        title={chip.label || chip.short}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.2px",
                          color: "#f8fafc",
                          background: logo?.color || chip.tone || "#334155",
                          border: "1px solid rgba(255,255,255,0.18)",
                        }}
                      >
                        {LogoIcon ? <LogoIcon size={14} /> : chip.short}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            {selected && (
              <span
                style={{
                  width: 20,
                  height: 20,
                  background: "#2563EB",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
            )}
          </button>
        );
      })}

      {currentStep.type === "dual_timeline" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 700, marginBottom: 8 }}>
              {currentStep.fields?.horizonte?.title}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 8 }}>
              {(currentStep.fields?.horizonte?.options || []).map((opt) => {
                const selected = dualTimelineSelection?.horizonte === opt.value;
                return (
                  <button
                    key={`h-${opt.value}`}
                    style={styles.card(selected)}
                    onClick={() => onHandleDualTimelineSelect("horizonte", opt.value)}
                  >
                    <span style={{ fontSize: 20, minWidth: 26 }}>{opt.icon}</span>
                    <div style={{ fontWeight: 600, fontSize: 13, color: selected ? "#93c5fd" : "#e2e8f0" }}>
                      {opt.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 700, marginBottom: 8 }}>
              {currentStep.fields?.km_anuales?.title}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 8 }}>
              {(currentStep.fields?.km_anuales?.options || []).map((opt) => {
                const selected = dualTimelineSelection?.km_anuales === opt.value;
                return (
                  <button
                    key={`k-${opt.value}`}
                    style={styles.card(selected)}
                    onClick={() => onHandleDualTimelineSelect("km_anuales", opt.value)}
                  >
                    <span style={{ fontSize: 20, minWidth: 26 }}>{opt.icon}</span>
                    <div style={{ fontWeight: 600, fontSize: 13, color: selected ? "#93c5fd" : "#e2e8f0" }}>
                      {opt.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {currentStep.type === "multi" && (
        <button
          onClick={onHandleMultiNext}
          disabled={multiSelected.length === 0}
          style={{
            ...styles.btn,
            width: "100%",
            marginTop: 14,
            opacity: multiSelected.length === 0 ? 0.35 : 1,
          }}
        >
          {multiSelected.length === 0
            ? "Selecciona al menos una opción"
            : `Continuar (${multiSelected.length} seleccionada${multiSelected.length > 1 ? "s" : ""}) →`}
        </button>
      )}

      {currentStep.type === "dual_timeline" && (
        <button
          onClick={onHandleDualTimelineNext}
          disabled={!dualTimelineSelection?.horizonte || !dualTimelineSelection?.km_anuales}
          style={{
            ...styles.btn,
            width: "100%",
            marginTop: 14,
            opacity: !dualTimelineSelection?.horizonte || !dualTimelineSelection?.km_anuales ? 0.35 : 1,
          }}
        >
          {!dualTimelineSelection?.horizonte || !dualTimelineSelection?.km_anuales
            ? "Completa ambas líneas temporales"
            : "Continuar →"}
        </button>
      )}

      {currentStep.helpInfo && (
        <div
          style={{
            marginTop: 20,
            padding: 14,
            background: "rgba(30,41,59,0.8)",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 10 }}>
            ℹ️ {currentStep.helpInfo.title}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                fontSize: 11,
                color: "#cbd5e1",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.35)" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, color: "#e2e8f0" }}>Tipo</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, color: "#e2e8f0" }}>Consumo Estimado</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, color: "#e2e8f0" }}>Coste/100km</th>
                </tr>
              </thead>
              <tbody>
                {currentStep.helpInfo.table.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: "1px solid rgba(148,163,184,0.15)",
                      background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "6px 8px", color: "#cbd5e1" }}>{row.type}</td>
                    <td style={{ padding: "6px 8px", color: "#94a3b8" }}>{row.consumption}</td>
                    <td style={{ padding: "6px 8px", fontWeight: 600, color: "#86efac" }}>{row.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={onGoPrevious}
          disabled={step === 0}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#cbd5e1",
            padding: "9px 14px",
            borderRadius: 9,
            fontSize: 12,
            cursor: step === 0 ? "not-allowed" : "pointer",
            opacity: step === 0 ? 0.45 : 1,
          }}
        >
          ← Volver a la pregunta anterior
        </button>

        <button
          onClick={onRestartQuestionnaire}
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fecaca",
            padding: "9px 14px",
            borderRadius: 9,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ↺ Reiniciar preguntas
        </button>

        <button
          onClick={onTellMeNow}
          disabled={answeredSteps === 0}
          style={{
            background: "linear-gradient(135deg,#0ea5e9,#2563eb)",
            border: "none",
            color: "white",
            padding: "9px 14px",
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 700,
            cursor: answeredSteps === 0 ? "not-allowed" : "pointer",
            opacity: answeredSteps === 0 ? 0.45 : 1,
          }}
        >
          ⚡ ¡Dímelo ya!
        </button>
      </div>
    </div>
  );
}
