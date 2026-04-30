import { useState, useEffect } from "react";

export default function QuestionnairePage({
  styles,
  themeMode,
  currentStep,
  step,
  totalSteps,
  advancedMode,
  toggleAdvancedMode,
  remainingQuestions,
  completionPct,
  multiSelected,
  dualTimelineSelection,
  scoreWeightsSelection,
  answers,
  BRAND_LOGOS,
  onHandleMultiToggle,
  onHandleDualTimelineSelect,
  onHandleScoreWeightSelect,
  onSetScoreWeights,
  onHandleSingle,
  onHandleMultiNext,
  onHandleDualTimelineNext,
  onHandleScoreWeightsNext,
  onGoPrevious,
  onRestartQuestionnaire,
  onTellMeNow,
  answeredSteps,
}) {
  const [hoveredOption, setHoveredOption] = useState(null);
  const [dragOrder, setDragOrder] = useState(null);
  const [dragSrcIdx, setDragSrcIdx] = useState(null);

  // Initialize score_weights step with default order on first visit
  useEffect(() => {
    if (currentStep?.type === "score_weights") {
      const metrics = currentStep.metrics || [];
      setDragOrder(metrics.map((m) => m.key));
      const defaultWeights = {};
      metrics.forEach((m, pos) => {
        defaultWeights[m.key] = metrics.length - pos;
      });
      onSetScoreWeights(defaultWeights);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep?.id]);
  const [showHelpInfoModal, setShowHelpInfoModal] = useState(false);
  const isDark = themeMode === "dark";

  const hasCompleteRange = (value) => Array.isArray(value) && value.length > 0 && value.every(Boolean);
  const hasCompleteScoreWeights = (stepConfig, selection) => {
    const metrics = Array.isArray(stepConfig?.metrics) ? stepConfig.metrics : [];
    if (metrics.length === 0) {
      return false;
    }

    const ranks = metrics
      .map((metric) => Number(selection?.[metric?.key]))
      .filter((rank) => Number.isInteger(rank) && rank >= 1 && rank <= metrics.length);

    return ranks.length === metrics.length && new Set(ranks).size === metrics.length;
  };

  const renderTimelineField = (fieldKey, fieldConfig, selectedValue, tone = "#38bdf8") => {
    const options = Array.isArray(fieldConfig?.options) ? fieldConfig.options : [];
    if (options.length === 0) {
      return null;
    }

    const isMultiSelectionField = fieldConfig?.selectionMode === "multi";
    const isSingleSelectionField = fieldConfig?.selectionMode === "single";
    const selectedValues = Array.isArray(selectedValue)
      ? selectedValue.filter(Boolean)
      : selectedValue
      ? [selectedValue]
      : [];

    const resolveOptionLabel = (value) =>
      options.find((item) => item.value === value)?.label || value;

    if (isMultiSelectionField) {
      const selectedSet = new Set(selectedValues);
      const selectionLabel = selectedValues.length > 0
        ? selectedValues.map(resolveOptionLabel).join(" · ")
        : "Selecciona uno o varios tramos";

      const toggleMultiValue = (optionValue) => {
        const nextValues = selectedSet.has(optionValue)
          ? selectedValues.filter((value) => value !== optionValue)
          : [...selectedValues, optionValue];

        const orderedValues = options
          .map((item) => item.value)
          .filter((value) => nextValues.includes(value));

        onHandleDualTimelineSelect(fieldKey, orderedValues);
      };

      return (
        <div
          style={{
            background: isDark
              ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
              : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))",
            border: isDark ? "1px solid rgba(148,163,184,0.34)" : "1px solid rgba(148,163,184,0.22)",
            borderRadius: 14,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 12, color: isDark ? "#e2e8f0" : "#334155", fontWeight: 700, marginBottom: 10 }}>
            {fieldConfig?.title}
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(37,99,235,0.12)",
              border: "1px solid rgba(125,211,252,0.25)",
              color: "#1e3a8a",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            <span>☑</span>
            <span>{selectionLabel}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: 6, marginTop: 6 }}>
            {options.map((opt) => {
              const isSelected = selectedSet.has(opt.value);

              return (
                <button
                  key={`${fieldKey}-${opt.value}`}
                  type="button"
                  onClick={() => toggleMultiValue(opt.value)}
                  style={{
                    background: isSelected
                      ? (isDark ? "rgba(37,99,235,0.3)" : "rgba(37,99,235,0.12)")
                      : (isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.9)"),
                    border: `1px solid ${isSelected ? "rgba(125,211,252,0.52)" : "rgba(148,163,184,0.22)"}`,
                    borderRadius: 10,
                    color: isSelected ? (isDark ? "#bfdbfe" : "#1e3a8a") : (isDark ? "#cbd5e1" : "#475569"),
                    fontSize: 11,
                    fontWeight: isSelected ? 800 : 600,
                    padding: "8px 6px",
                    lineHeight: 1.25,
                    cursor: "pointer",
                    minHeight: 56,
                  }}
                >
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{opt.icon}</div>
                  <div>{opt.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (isSingleSelectionField) {
      const selectedSingleValue = selectedValues[0] || "";

      return (
        <div
          style={{
            background: isDark
              ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
              : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))",
            border: isDark ? "1px solid rgba(148,163,184,0.34)" : "1px solid rgba(148,163,184,0.22)",
            borderRadius: 14,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 12, color: isDark ? "#e2e8f0" : "#334155", fontWeight: 700, marginBottom: 10 }}>
            {fieldConfig?.title}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {options.map((opt) => {
              const isSelected = selectedSingleValue === opt.value;

              return (
                <button
                  key={`${fieldKey}-${opt.value}`}
                  type="button"
                  onClick={() => onHandleDualTimelineSelect(fieldKey, [opt.value, opt.value])}
                  style={{
                    background: isSelected
                      ? (isDark ? "rgba(37,99,235,0.3)" : "rgba(37,99,235,0.12)")
                      : (isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.9)"),
                    border: `1px solid ${isSelected ? "rgba(125,211,252,0.52)" : "rgba(148,163,184,0.22)"}`,
                    borderRadius: 10,
                    color: isSelected ? (isDark ? "#bfdbfe" : "#1e3a8a") : (isDark ? "#cbd5e1" : "#475569"),
                    fontSize: 12,
                    fontWeight: isSelected ? 800 : 600,
                    padding: "10px 8px",
                    lineHeight: 1.3,
                    cursor: "pointer",
                    minHeight: 54,
                    textAlign: "left",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    const normalizedRange = Array.isArray(selectedValue) && selectedValue.length > 0
      ? [selectedValue[0], selectedValue[selectedValue.length - 1]]
      : selectedValue
      ? [selectedValue, selectedValue]
      : [];
    const startIndexRaw = options.findIndex((item) => item.value === normalizedRange[0]);
    const endIndexRaw = options.findIndex((item) => item.value === normalizedRange[1]);
    const startIndex = startIndexRaw < 0 ? 0 : startIndexRaw;
    const endIndex = endIndexRaw < 0 ? startIndex : endIndexRaw;
    const safeStartIndex = Math.min(startIndex, endIndex);
    const safeEndIndex = Math.max(startIndex, endIndex);
    const leftPct = options.length > 1 ? (safeStartIndex / (options.length - 1)) * 100 : 0;
    const rightPct = options.length > 1 ? (safeEndIndex / (options.length - 1)) * 100 : 0;
    const startLabel = options[safeStartIndex]?.label || "";
    const endLabel = options[safeEndIndex]?.label || "";
    const selectionLabel = startLabel && endLabel
      ? (startLabel === endLabel ? startLabel : `${startLabel} → ${endLabel}`)
      : "Selecciona un punto o rango";

    const updateRangeIndex = (bound, nextIndex) => {
      const boundedIndex = Math.max(0, Math.min(options.length - 1, nextIndex));
      const nextStart = bound === "start" ? boundedIndex : Math.min(safeStartIndex, boundedIndex);
      const nextEnd = bound === "end" ? boundedIndex : Math.max(safeEndIndex, boundedIndex);
      const normalizedStart = Math.min(nextStart, nextEnd);
      const normalizedEnd = Math.max(nextStart, nextEnd);

      onHandleDualTimelineSelect(fieldKey, [
        options[normalizedStart]?.value,
        options[normalizedEnd]?.value,
      ].filter(Boolean));
    };

    return (
      <div
        style={{
          background: isDark
            ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
            : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))",
          border: isDark ? "1px solid rgba(148,163,184,0.34)" : "1px solid rgba(148,163,184,0.22)",
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ fontSize: 12, color: isDark ? "#e2e8f0" : "#334155", fontWeight: 700, marginBottom: 10 }}>
          {fieldConfig?.title}
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(37,99,235,0.12)",
            border: "1px solid rgba(125,211,252,0.25)",
            color: "#1e3a8a",
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          <span>↔</span>
          <span>{selectionLabel}</span>
        </div>

        <div style={{ position: "relative", padding: "12px 4px 8px" }}>
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 4,
              right: 4,
              height: 6,
              borderRadius: 999,
              background: "rgba(148,163,184,0.24)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 20,
              left: `calc(${leftPct}% + 4px)`,
              width: `${Math.max(rightPct - leftPct, 0)}%`,
              height: 6,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${tone}, #2563eb)`,
              transition: "left 0.22s ease, width 0.22s ease",
            }}
          />

          <input
            type="range"
            min={0}
            max={options.length - 1}
            step={1}
            value={safeStartIndex}
            onChange={(event) => {
              const nextIndex = Number(event.target.value);
              updateRangeIndex("start", Math.min(nextIndex, safeEndIndex));
            }}
            style={{
              width: "100%",
              margin: 0,
              accentColor: tone,
              cursor: "pointer",
              background: "transparent",
              position: "relative",
              zIndex: 3,
            }}
            aria-label={`${fieldConfig?.title || fieldKey} inicio`}
          />

          <input
            type="range"
            min={0}
            max={options.length - 1}
            step={1}
            value={safeEndIndex}
            onChange={(event) => {
              const nextIndex = Number(event.target.value);
              updateRangeIndex("end", Math.max(nextIndex, safeStartIndex));
            }}
            style={{
              width: "100%",
              margin: 0,
              accentColor: tone,
              cursor: "pointer",
              background: "transparent",
              position: "absolute",
              left: 0,
              top: 12,
              zIndex: 4,
              pointerEvents: "auto",
            }}
            aria-label={`${fieldConfig?.title || fieldKey} fin`}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: 4, marginTop: 6 }}>
          {options.map((opt, idx) => {
            const isWithinRange = idx >= safeStartIndex && idx <= safeEndIndex;
            const isEdge = idx === safeStartIndex || idx === safeEndIndex;

            return (
              <button
                key={`${fieldKey}-${opt.value}`}
                type="button"
                onClick={() => onHandleDualTimelineSelect(fieldKey, [opt.value, opt.value])}
                style={{
                  background: isWithinRange
                    ? (isDark ? "rgba(37,99,235,0.3)" : "rgba(37,99,235,0.12)")
                    : (isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.9)"),
                  border: `1px solid ${isEdge ? "rgba(125,211,252,0.52)" : isWithinRange ? "rgba(96,165,250,0.28)" : "rgba(148,163,184,0.22)"}`,
                  borderRadius: 10,
                  color: isWithinRange ? (isDark ? "#bfdbfe" : "#1e3a8a") : (isDark ? "#cbd5e1" : "#475569"),
                  fontSize: 11,
                  fontWeight: isEdge ? 800 : isWithinRange ? 700 : 600,
                  padding: "8px 6px",
                  lineHeight: 1.25,
                  cursor: "pointer",
                  minHeight: 56,
                }}
              >
                <div style={{ fontSize: 14, marginBottom: 2 }}>{opt.icon}</div>
                <div>{opt.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.center}>
      <div style={styles.blockBadge(currentStep.block)}>
        {currentStep.blockIcon} {currentStep.block.toUpperCase()}
      </div>
      <div style={{ fontSize: 11, color: isDark ? "#cbd5e1" : "#334155", letterSpacing: "1px", marginBottom: 6 }}>
        PREGUNTA {step + 1} DE {totalSteps}
      </div>
      <h2
        style={{
          fontSize: "clamp(18px,4vw,26px)",
          fontWeight: 700,
          letterSpacing: "-0.6px",
          margin: "0 0 8px",
          color: isDark ? "#f8fafc" : "#0f172a",
          lineHeight: 1.3,
        }}
      >
        {currentStep.question}
      </h2>
      <p style={{ color: isDark ? "#cbd5e1" : "#64748b", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
        {currentStep.subtitle}
      </p>

      <div
        style={{
          background: isDark ? "rgba(13,148,136,0.2)" : "rgba(20,184,166,0.08)",
          border: isDark ? "1px solid rgba(94,234,212,0.26)" : "1px solid rgba(20,184,166,0.22)",
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: isDark ? "#99f6e4" : "#0d9488", fontWeight: 700, marginBottom: 4 }}>
              🧪 Test avanzado opcional
            </div>
            <div style={{ fontSize: 12, color: isDark ? "#ccfbf1" : "#0f766e", lineHeight: 1.5 }}>
              {advancedMode
                ? "Activado: añadimos preguntas de zona, ZBE, garaje, presupuesto cómodo, capital y riesgo para afinar la recomendación."
                : "Puedes activar 6 preguntas extra para llevar el análisis a un nivel mucho más preciso sin tocar el flujo base."}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleAdvancedMode}
            style={{
              background: advancedMode ? "rgba(20,184,166,0.14)" : "rgba(37,99,235,0.12)",
              border: `1px solid ${advancedMode ? "rgba(153,246,228,0.4)" : "rgba(147,197,253,0.35)"}`,
              color: advancedMode ? (isDark ? "#99f6e4" : "#0f766e") : (isDark ? "#bfdbfe" : "#1e3a8a"),
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
          background: isDark ? "rgba(3,105,161,0.24)" : "rgba(14,165,233,0.08)",
          border: isDark ? "1px solid rgba(125,211,252,0.28)" : "1px solid rgba(14,165,233,0.2)",
          borderRadius: 12,
          padding: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: isDark ? "#bae6fd" : "#0369a1", fontWeight: 600 }}>
            ✅ Te quedan {remainingQuestions} pregunta{remainingQuestions === 1 ? "" : "s"}
          </div>
          <div style={{ fontSize: 12, color: isDark ? "#7dd3fc" : "#0ea5e9" }}>
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

      {currentStep.helpInfo && (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setShowHelpInfoModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 12px",
              borderRadius: 10,
              border: "1px solid rgba(37,99,235,0.24)",
              background: isDark ? "rgba(37,99,235,0.18)" : "rgba(219,234,254,0.7)",
              color: isDark ? "#bfdbfe" : "#1d4ed8",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <span>ℹ️</span>
            <span>{currentStep.helpInfo.title}</span>
          </button>

          {showHelpInfoModal && (
            <div
              role="dialog"
              aria-modal="true"
              onClick={() => setShowHelpInfoModal(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15,23,42,0.45)",
                display: "grid",
                placeItems: "center",
                zIndex: 1000,
                padding: 16,
              }}
            >
              <div
                onClick={(event) => event.stopPropagation()}
                style={{
                  width: "min(920px, 100%)",
                  maxHeight: "80vh",
                  overflow: "auto",
                  borderRadius: 14,
                  border: isDark ? "1px solid rgba(148,163,184,0.34)" : "1px solid rgba(148,163,184,0.25)",
                  background: isDark ? "rgba(15,23,42,0.98)" : "#ffffff",
                  boxShadow: "0 20px 48px rgba(15,23,42,0.28)",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>
                    {currentStep.helpInfo.title}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHelpInfoModal(false)}
                    style={{
                      border: "1px solid rgba(148,163,184,0.3)",
                      background: "transparent",
                      color: isDark ? "#e2e8f0" : "#334155",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Cerrar
                  </button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      fontSize: 11,
                      color: isDark ? "#cbd5e1" : "#475569",
                      borderCollapse: "collapse",
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.35)" }}>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a" }}>Tipo</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a" }}>Consumo Estimado</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a" }}>Coste/100km</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentStep.helpInfo.table.map((row, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid rgba(148,163,184,0.15)",
                            background: idx % 2 === 0 ? (isDark ? "rgba(255,255,255,0.02)" : "rgba(148,163,184,0.06)") : "transparent",
                          }}
                        >
                          <td style={{ padding: "6px 8px", color: isDark ? "#e2e8f0" : "#334155" }}>{row.type}</td>
                          <td style={{ padding: "6px 8px" }}>{row.consumption}</td>
                          <td style={{ padding: "6px 8px", fontWeight: 700, color: "#16a34a" }}>{row.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep.type !== "dual_timeline" && currentStep.type !== "score_weights" && currentStep.options.map((opt) => {
        const selected =
          currentStep.type === "multi"
            ? multiSelected.includes(opt.value)
            : answers[currentStep.id] === opt.value;
        const isHovered = hoveredOption === opt.value;
        return (
          <button
            key={opt.value}
            onMouseEnter={() => setHoveredOption(opt.value)}
            onMouseLeave={() => setHoveredOption(null)}
            style={{
              ...styles.card(selected),
              background: selected
                ? "linear-gradient(145deg, rgba(219,234,254,0.9), rgba(191,219,254,0.75))"
                : isDark
                ? "linear-gradient(145deg, rgba(15,23,42,0.95), rgba(30,41,59,0.92))"
                : "linear-gradient(145deg, #ffffff, #f8fafc)",
              border: selected
                ? "1px solid rgba(59,130,246,0.38)"
                : isHovered
                ? "1px solid rgba(96,165,250,0.35)"
                : isDark
                ? "1px solid rgba(148,163,184,0.3)"
                : "1px solid rgba(148,163,184,0.22)",
              boxShadow: selected
                ? "0 14px 30px rgba(37,99,235,0.16)"
                : isHovered
                ? "0 10px 24px rgba(15,23,42,0.08)"
                : "0 4px 12px rgba(15,23,42,0.05)",
              transform: isHovered ? "translateY(-1px)" : "translateY(0)",
              transition: "all 0.2s ease",
            }}
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
                  color: selected ? "#2563eb" : isDark ? "#f8fafc" : "#0f172a",
                }}
              >
                {opt.label}
              </div>
              {opt.desc && (
                <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#475569", marginTop: 2 }}>{opt.desc}</div>
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
                          color: logo?.color || chip.tone || "#334155",
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
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
          {renderTimelineField(
            "horizonte_tenencia",
            currentStep.fields?.horizonte_tenencia,
            dualTimelineSelection?.horizonte_tenencia,
            "#06b6d4"
          )}
          {renderTimelineField(
            "antiguedad_vehiculo_buscada",
            currentStep.fields?.antiguedad_vehiculo_buscada,
            dualTimelineSelection?.antiguedad_vehiculo_buscada,
            "#22c55e"
          )}
        </div>
      )}

      {currentStep.type === "score_weights" && (() => {
        const metrics = currentStep.metrics || [];
        const order = dragOrder && dragOrder.length === metrics.length ? dragOrder : metrics.map((m) => m.key);

        const handleDragStart = (idx) => {
          setDragSrcIdx(idx);
        };

        const handleDragEnter = (idx) => {
          if (idx === dragSrcIdx) return;
          const newOrder = [...order];
          const [moved] = newOrder.splice(dragSrcIdx, 1);
          newOrder.splice(idx, 0, moved);
          setDragSrcIdx(idx);
          setDragOrder(newOrder);
          // sync scoreWeightsSelection: position 0 = most important = rank N, position N-1 = rank 1
          const newWeights = {};
          newOrder.forEach((key, pos) => {
            newWeights[key] = metrics.length - pos;
          });
          onSetScoreWeights(newWeights);
        };

        const handleDragEnd = () => {
          setDragSrcIdx(null);
        };

        return (
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                background: isDark ? "rgba(37,99,235,0.12)" : "rgba(219,234,254,0.6)",
                border: "1px solid rgba(125,211,252,0.25)",
                borderRadius: 10,
                padding: "10px 14px",
                color: isDark ? "#93c5fd" : "#1e3a8a",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              Arrastra para reordenar · El <strong>primero</strong> tendrá más peso · El <strong>último</strong> menos
            </div>
            {order.map((key, pos) => {
              const metric = metrics.find((m) => m.key === key);
              if (!metric) return null;
              const rank = metrics.length - pos; // 5 = top, 1 = bottom
              const isBeingDragged = dragSrcIdx === pos;
              return (
                <div
                  key={key}
                  draggable
                  onDragStart={() => handleDragStart(pos)}
                  onDragEnter={() => handleDragEnter(pos)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: isBeingDragged
                      ? isDark ? "rgba(37,99,235,0.22)" : "rgba(219,234,254,0.85)"
                      : isDark
                        ? "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(30,41,59,0.82))"
                        : "linear-gradient(160deg, rgba(255,255,255,0.97), rgba(241,245,249,0.95))",
                    border: isBeingDragged
                      ? "2px dashed rgba(99,102,241,0.6)"
                      : isDark ? "1px solid rgba(148,163,184,0.34)" : "1px solid rgba(148,163,184,0.22)",
                    borderRadius: 14,
                    padding: "12px 14px",
                    cursor: "grab",
                    userSelect: "none",
                    opacity: isBeingDragged ? 0.55 : 1,
                    transition: "box-shadow 0.15s",
                    boxShadow: isBeingDragged ? "0 4px 18px rgba(99,102,241,0.18)" : "none",
                  }}
                >
                  {/* drag handle */}
                  <span style={{ color: isDark ? "#64748b" : "#94a3b8", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>⠿</span>
                  {/* rank badge */}
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: rank === metrics.length ? "rgba(37,99,235,0.85)" : isDark ? "rgba(51,65,85,0.8)" : "rgba(226,232,240,0.9)",
                      color: rank === metrics.length ? "#fff" : isDark ? "#94a3b8" : "#475569",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {pos + 1}
                  </span>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{metric.icon || "•"}</span>
                  <span style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: 13, fontWeight: 600, flex: 1 }}>{metric.label}</span>
                </div>
              );
            })}
          </div>
        );
      })()}

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
          disabled={!hasCompleteRange(dualTimelineSelection?.horizonte_tenencia) || !hasCompleteRange(dualTimelineSelection?.antiguedad_vehiculo_buscada)}
          style={{
            ...styles.btn,
            width: "100%",
            marginTop: 14,
            opacity: !hasCompleteRange(dualTimelineSelection?.horizonte_tenencia) || !hasCompleteRange(dualTimelineSelection?.antiguedad_vehiculo_buscada) ? 0.35 : 1,
          }}
        >
          {!hasCompleteRange(dualTimelineSelection?.horizonte_tenencia) || !hasCompleteRange(dualTimelineSelection?.antiguedad_vehiculo_buscada)
            ? "Completa ambas líneas temporales"
            : "Continuar →"}
        </button>
      )}

      {currentStep.type === "score_weights" && (
        <button
          onClick={onHandleScoreWeightsNext}
          disabled={!hasCompleteScoreWeights(currentStep, scoreWeightsSelection)}
          style={{
            ...styles.btn,
            width: "100%",
            marginTop: 14,
            opacity: !hasCompleteScoreWeights(currentStep, scoreWeightsSelection) ? 0.35 : 1,
          }}
        >
          {!hasCompleteScoreWeights(currentStep, scoreWeightsSelection)
            ? "Numera todos los criterios (sin repetir números)"
            : "Continuar →"}
        </button>
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
            background: isDark ? "rgba(30,41,59,0.86)" : "rgba(241,245,249,0.9)",
            border: isDark ? "1px solid rgba(148,163,184,0.36)" : "1px solid rgba(148,163,184,0.28)",
            color: isDark ? "#e2e8f0" : "#334155",
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
            color: "#991b1b",
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
