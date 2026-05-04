import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const TEST_COPY = {
  en: {
    steps: {
      perfil: {
        question: "Who is this mobility solution for?",
        subtitle: "This helps us personalize the full analysis",
        options: {
          particular: { label: "For me / family", desc: "Personal or family use" },
          empresa: { label: "For my company", desc: "Fleet or company vehicle" },
          autonomo: { label: "I am self-employed", desc: "Mixed business / personal use" },
        },
      },
      flexibilidad: {
        question: "How will you acquire the vehicle?",
        subtitle: "Each option has very different financial and risk implications",
        options: {
          propiedad_contado: { label: "Paying cash" },
          propiedad_financiada: { label: "Financed" },
          propiedad_entrada_inicial: { label: "I want to pay a down payment and finance the rest" },
          renting: { label: "Leasing or subscription", desc: "Pay a monthly fee without owning the car" },
          no_tengo_claro: { label: "I am not sure yet", desc: "Help me decide which option is best" },
        },
      },
      propulsion_preferida: {
        question: "Which powertrain do you prefer?",
        subtitle: "This is key because it affects total maintenance cost, environmental label, and approximate insurance premium.",
        helpInfo: {
          title: "View approximate cost per 100 km in interurban driving by engine type",
          table: [
            { type: "Electric (home charging)", consumption: "15-20 kWh/100 km", cost: "EUR 2.00 - 4.00" },
            { type: "Plug-in hybrid (PHEV)", consumption: "1-2 L + electricity*", cost: "EUR 4.00 - 7.00 (with charging)" },
            { type: "Hybrid (HEV/MHEV, non plug-in)", consumption: "4-5 L/100 km", cost: "EUR 7.00 - 9.00" },
            { type: "Diesel", consumption: "5-6 L/100 km", cost: "EUR 8.00 - 11.00" },
            { type: "Gasoline", consumption: "6-7 L/100 km", cost: "EUR 10.00 - 14.00" },
          ],
        },
        options: {
          electrico_puro: { label: "Battery electric (BEV)", desc: "ZERO label - 100% electric charging" },
          hibrido_no_enchufable: { label: "Hybrid (HEV/MHEV)", desc: "ECO label - no plug, very efficient in city" },
          hibrido_enchufable: { label: "Plug-in hybrid (PHEV)", desc: "Requires access to a charging point" },
          gasolina: { label: "Gasoline", desc: "Possible label: B, C or ECO (depending on version and year)" },
          diesel: { label: "Diesel", desc: "Possible label: B, C or ECO (depending on version and year)" },
          glp_gnc: { label: "LPG / CNG", desc: "Interesting alternative if you have a nearby refuel point" },
          indiferente_motor: { label: "No preference", desc: "Choose the most convenient option based on the rest of my answers" },
        },
      },
      horizonte_y_antiguedad: {
        question: "How long do you plan to keep the car? Maximum age?",
        subtitle: "These two questions help us define your purchase strategy.",
        fields: {
          horizonte_tenencia: {
            title: "How long do you plan to keep the car?",
            options: {
              menos_1_ano: "Less than 1 year",
              "2_3": "2 or 3 years",
              "4_6": "4 to 6 years",
              mas_7: "7 years or more",
              no_claro: "I am not sure yet",
            },
          },
          antiguedad_vehiculo_buscada: {
            title: "What maximum vehicle age do you accept?",
            options: {
              cero_anos: "0 years or nearly new",
              "2_3_anos": "2-3 years",
              "5_anos": "5 years",
              "7_anos": "7 years",
              mas_7_anos: "More than 7 years",
              indiferente: "No preference",
            },
          },
        },
      },
      uso_km_anuales: {
        question: "How many kilometers do you drive per year?",
        subtitle: "It affects maintenance costs and the most suitable engine type",
        options: {
          menos_10k: { label: "Less than 10,000 km", desc: "Very low usage" },
          "10k_20k": { label: "10,001 to 20,000 km", desc: "Moderate usage" },
          "20k_35k": { label: "20,001 to 35,000 km", desc: "Frequent usage" },
          mas_35k: { label: "35,000 km and above", desc: "Very intensive usage" },
        },
      },
      entorno_uso: {
        question: "Where do you usually drive?",
        subtitle: "Includes your city/area context (LEZ), real consumption and usage type",
        options: {
          ciudad: { label: "Mostly city", desc: "Traffic, congestion, parking" },
          interurbano: { label: "Interurban roads", desc: "Mixed routes, small towns" },
          autopista: { label: "Highway / long distance", desc: "Frequent trips over 100 km" },
          mixto: { label: "A bit of everything", desc: "No clear dominant environment" },
        },
      },
      uso_principal: {
        question: "What do you mainly use it for?",
        subtitle: "Select all that apply",
        options: {
          trabajo_diario: { label: "Daily commuting" },
          viajes_ocio: { label: "Leisure trips or vacations" },
          visitas_clientes: { label: "Client visits / meetings" },
          compras_recados: { label: "Shopping and errands" },
          familia: { label: "Transporting family / children" },
          remolque: { label: "Towing (caravan, trailer)" },
        },
      },
      ocupantes: {
        question: "What combination of seats and trunk space do you usually need?",
        subtitle: "This captures people and daily cargo space in one answer",
        options: {
          "2_plazas_maletero_pequeno": { label: "1-2 seats + small trunk", desc: "Individual or couple use" },
          "5_plazas_maletero_medio": { label: "3-5 seats + medium trunk", desc: "Balanced family use" },
          "7_plazas_maletero_grande": { label: "6-7 seats + large trunk", desc: "Large family or lots of luggage" },
        },
      },
      marca_preferencia: {
        question: "Do you have a preferred brand?",
        subtitle: "Entry-level premium ranges often offer a worse value/price ratio",
        options: {
          generalista_europea: { label: "European mainstream", desc: "Balanced price and broad service network" },
          asiatica_fiable: { label: "Asian reliability-focused", desc: "Strong reputation for efficiency and durability" },
          premium_alemana: { label: "German premium", desc: "Image, technology, and higher maintenance cost" },
          premium_escandinava: { label: "Scandinavian premium", desc: "Safety and comfort first" },
          nueva_china: { label: "New brands", desc: "Strong equipment for the price and electrified engines" },
          sin_preferencia: { label: "No brand preference" },
        },
      },
      vehiculo_actual: {
        question: "Do you have a vehicle to trade in or sell?",
        subtitle: "If you do, we can search sellers who accept it as part of payment, or we can help you sell it directly.",
        options: {
          si_entrego: { label: "Yes, I want to trade it in when buying.", desc: "Reduces the amount to pay in the purchase" },
          si_vendo: { label: "Yes, I prefer selling it to a third party.", desc: "You may earn more, but it takes more time." },
          no: { label: "I currently have no vehicle", desc: "I already sold it or this is my first car" },
        },
      },
      ponderacion_score_personalizada: {
        question: "Which criteria matter most to you?",
        subtitle: "Drag cards to reorder them: the first one will have the highest weight in your offers.",
        metrics: {
          marca_preferencia: "Brand or brand type",
          propulsion_preferida: "Powertrain",
          flexibilidad: "Purchase type or relationship with the car",
          antiguedad_vehiculo_buscada: "Maximum car age",
          ocupantes: "Seats and space",
        },
      },
      provincia_zona: {
        question: "What kind of area do you usually move in?",
        subtitle: "Real coverage and mobility weighting vary a lot by city, LEZ, or rural area",
        options: {
          madrid_barcelona: { label: "Madrid / Barcelona", desc: "Maximum carsharing, transport and stock availability" },
          capital_zbe: { label: "Capital city with LEZ", desc: "Label and access restrictions matter a lot" },
          ciudad_media: { label: "Mid-size city / metro area", desc: "Mixed use with medium availability" },
          zona_rural: { label: "Town / dispersed rural area", desc: "Range and full availability matter more" },
          islas: { label: "Islands", desc: "More limited market and stronger dependency on local stock" },
        },
      },
      garaje: {
        question: "What is your real parking and charging situation?",
        subtitle: "Key to know if an EV or PHEV truly fits your life",
        options: {
          garaje_cargador: { label: "I have a spot and can charge", desc: "Electrification gains many points" },
          garaje_sin_cargador: { label: "I have a spot but no charger", desc: "I could install one or partially depend on public charging" },
          sin_garaje: { label: "No fixed spot / street parking", desc: "Much harder to make a pure EV worthwhile" },
        },
      },
      zbe_impacto: {
        question: "How much do LEZ and urban restrictions affect you?",
        subtitle: "This can completely change which engine and mobility solution are smartest",
        options: {
          alta: { label: "A lot", desc: "I frequently enter restricted zones" },
          media: { label: "Somewhat", desc: "It affects me in specific situations" },
          baja: { label: "Little or none", desc: "My daily use barely depends on LEZ" },
        },
      },
      capital_propio: {
        question: "If you bought, what upfront capital could you provide without stress?",
        subtitle: "This helps separate what looks attractive from what is truly financially healthy",
        options: {
          sin_capital: { label: "No available down payment", desc: "I need to finance 100% of the price" },
          menos_5k: { label: "Less than EUR 5,000", desc: "Very limited down payment" },
          "5k_10k": { label: "EUR 5,000 - 10,000", desc: "Tight but useful down payment" },
          "10k_20k": { label: "EUR 10,000 - 20,000", desc: "Already gives strong negotiation margin" },
          mas_20k: { label: "More than EUR 20,000", desc: "Strong capacity to reduce financing" },
        },
      },
      gestion_riesgo: {
        question: "How much control do you want over cost surprises and risk?",
        subtitle: "Defines whether we prioritize maximum predictability or more savings with some risk",
        options: {
          alto: { label: "I want maximum control", desc: "I prefer avoiding surprises even if I pay a bit more" },
          medio: { label: "Reasonable balance", desc: "I want a good cost vs peace-of-mind ratio" },
          bajo: { label: "I can take some risk", desc: "I prioritize savings even with more variability" },
        },
      },
      vehiculo_actual_antiguedad: {
        question: "What year is the car you trade in or sell?",
        subtitle: "Age directly affects valuation and buyer profile",
        options: {
          no_entrego: { label: "I am not trading in or selling any vehicle", desc: "This question does not apply to me" },
          menos_3: { label: "Less than 3 years", desc: "Relatively new vehicle, strong valuation" },
          "3_5": { label: "3 to 5 years", desc: "Good balance between depreciation and market price" },
          "6_10": { label: "6 to 10 years", desc: "Price drops more, but still has demand" },
          mas_10: { label: "More than 10 years", desc: "Advanced depreciation, better for direct sale strategy" },
        },
      },
      vehiculo_actual_km: {
        question: "How many kilometers does the car have that you trade in or sell?",
        subtitle: "Mileage is one of the most important valuation factors",
        options: {
          no_entrego_km: { label: "I am not trading in or selling any vehicle", desc: "This question does not apply to me" },
          menos_50k: { label: "Less than 50,000 km", desc: "Low mileage, high valuation" },
          "50k_100k": { label: "50,000 - 100,000 km", desc: "Normal use, medium valuation" },
          "100k_150k": { label: "100,000 - 150,000 km", desc: "High mileage, noticeable depreciation" },
          mas_150k: { label: "More than 150,000 km", desc: "Very high mileage, more limited market" },
        },
      },
      vehiculo_actual_deuda: {
        question: "Does it still have outstanding financing?",
        subtitle: "If there is debt, it must be cancelled before transferring the vehicle or using its value in a purchase",
        options: {
          sin_deuda: { label: "No, it is debt-free", desc: "You can use 100% of the valuation" },
          deuda_pequena: { label: "Yes, less than EUR 3,000", desc: "Easy to cancel with part of the sale" },
          deuda_media: { label: "Yes, between EUR 3,000 and 10,000", desc: "Must be covered before transfer" },
          deuda_grande: { label: "Yes, more than EUR 10,000", desc: "May limit how much you can apply to the next purchase" },
          no_se_deuda: { label: "I do not know", desc: "We can help you calculate it" },
        },
      },
      financiacion_plazo: {
        question: "What financing term would you like?",
        subtitle: "Longer terms mean lower monthly payment but higher total interest",
        options: {
          no_financio_plazo: { label: "I do not want financing", desc: "I will pay cash" },
          "12_24": { label: "12-24 months", desc: "Higher monthly payment but much lower total interest" },
          "36_48": { label: "36-48 months", desc: "Most common term, good balance" },
          "60_72": { label: "60-72 months", desc: "More comfortable monthly payment, higher financial cost" },
          mas_84: { label: "84 months or more", desc: "Maximum monthly comfort, high total cost" },
          no_se_plazo: { label: "I am not sure", desc: "We can advise based on your situation" },
        },
      },
      financiacion_gestion: {
        question: "How do you prefer to manage financing?",
        subtitle: "Always compare real APR, regardless of who offers it",
        options: {
          no_financio_gestion: { label: "I do not want financing", desc: "I will pay cash" },
          banco_propio: { label: "With my trusted bank", desc: "More control and room to negotiate interest rate" },
          concesionario: { label: "With dealer financing", desc: "More convenient, but always compare APR" },
          broker_comparador: { label: "Through a broker or comparison service", desc: "Useful if you want the best market offer" },
          no_se_financiacion: { label: "I still do not know", desc: "We guide you during the purchase process" },
        },
      },
    },
  },
};

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
  uiLanguage = "es",
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
  const { t } = useTranslation();
  const isDark = themeMode === "dark";
  const isEn = uiLanguage === "en";

  const getStepI18n = (stepId) => TEST_COPY.en.steps?.[stepId] || null;
  const stepI18n = getStepI18n(currentStep?.id);

  const getStepText = (key, fallback = "") => {
    if (!isEn) {
      return fallback;
    }
    return stepI18n?.[key] || fallback;
  };

  const getOptionText = (option, key) => {
    if (!isEn) {
      return option?.[key] || "";
    }
    return stepI18n?.options?.[option?.value]?.[key] || option?.[key] || "";
  };

  const getFieldTitleText = (fieldKey, fallback = "") => {
    if (!isEn) {
      return fallback;
    }
    return stepI18n?.fields?.[fieldKey]?.title || fallback;
  };

  const getFieldOptionLabel = (fieldKey, option) => {
    if (!isEn) {
      return option?.label || "";
    }
    return stepI18n?.fields?.[fieldKey]?.options?.[option?.value] || option?.label || "";
  };

  const getMetricLabel = (metric) => {
    if (!isEn) {
      return metric?.label || "";
    }
    return stepI18n?.metrics?.[metric?.key] || metric?.label || "";
  };

  const getHelpInfo = () => {
    if (!currentStep?.helpInfo) {
      return null;
    }
    if (!isEn) {
      return currentStep.helpInfo;
    }
    const helpI18n = stepI18n?.helpInfo;
    return {
      ...currentStep.helpInfo,
      title: helpI18n?.title || currentStep.helpInfo.title,
      table: Array.isArray(helpI18n?.table) ? helpI18n.table : currentStep.helpInfo.table,
    };
  };

  const localizedHelpInfo = getHelpInfo();

  const getLocalizedBlockName = (blockNameES) => {
    const blockTranslations = {
      Perfil: { en: "Profile", es: "Perfil" },
      "Uso real": { en: "Real Usage", es: "Uso real" },
      Capacidad: { en: "Capacity", es: "Capacidad" },
      Preferencias: { en: "Preferences", es: "Preferencias" },
      Energía: { en: "Energy", es: "Energía" },
      Financiero: { en: "Financial", es: "Financiero" },
      Restricciones: { en: "Restrictions", es: "Restricciones" },
      Vinculación: { en: "Binding", es: "Vinculación" },
      Riesgo: { en: "Risk", es: "Riesgo" },
      Avanzado: { en: "Advanced", es: "Avanzado" },
      Compra: { en: "Purchase", es: "Compra" },
      Prioridades: { en: "Priorities", es: "Prioridades" },
      "Coche a entregar": { en: "Trade-in Car", es: "Coche a entregar" },
      Financiación: { en: "Financing", es: "Financiación" },
    };
    const translation = blockTranslations[blockNameES];
    return translation ? translation[uiLanguage] : blockNameES;
  };

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

    const resolveOptionLabel = (value) => {
      const option = options.find((item) => item.value === value);
      return getFieldOptionLabel(fieldKey, option) || value;
    };

    if (isMultiSelectionField) {
      const selectedSet = new Set(selectedValues);
      const selectionLabel = selectedValues.length > 0
        ? selectedValues.map(resolveOptionLabel).join(" · ")
        : t("questionnaire.selectOneOrMore");

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
            {getFieldTitleText(fieldKey, fieldConfig?.title)}
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
                  <div>{getFieldOptionLabel(fieldKey, opt)}</div>
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
            {getFieldTitleText(fieldKey, fieldConfig?.title)}
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
                  {getFieldOptionLabel(fieldKey, opt)}
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
      : t("questionnaire.selectRange");

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
            aria-label={`${getFieldTitleText(fieldKey, fieldConfig?.title || fieldKey)} ${t("questionnaire.rangeStart")}`}
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
            aria-label={`${getFieldTitleText(fieldKey, fieldConfig?.title || fieldKey)} ${t("questionnaire.rangeEnd")}`}
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
                <div>{getFieldOptionLabel(fieldKey, opt)}</div>
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
        {currentStep.blockIcon} {getLocalizedBlockName(currentStep.block).toUpperCase()}
      </div>
      <div style={{ fontSize: 11, color: isDark ? "#cbd5e1" : "#334155", letterSpacing: "1px", marginBottom: 6 }}>
        {t("questionnaire.questionOf", { step: step + 1, total: totalSteps })}
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
        {getStepText("question", currentStep.question)}
      </h2>
      <p style={{ color: isDark ? "#cbd5e1" : "#64748b", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
        {getStepText("subtitle", currentStep.subtitle)}
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
              🧪 {t("questionnaire.advancedTestLabel")}
            </div>
            <div style={{ fontSize: 12, color: isDark ? "#ccfbf1" : "#0f766e", lineHeight: 1.5 }}>
              {advancedMode
                ? t("questionnaire.advancedModeOn")
                : t("questionnaire.advancedModeOff")}
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
            {advancedMode ? t("questionnaire.advancedModeActive") : t("questionnaire.advancedModeActivate")}
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
            ✅ {t("questionnaire.remaining", { count: remainingQuestions })}
          </div>
          <div style={{ fontSize: 12, color: isDark ? "#7dd3fc" : "#0ea5e9" }}>
            {completionPct}% {t("questionnaire.completed")}
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

      {localizedHelpInfo && (
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
            <span>{localizedHelpInfo.title}</span>
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
                    {localizedHelpInfo.title}
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
                    {t("questionnaire.close")}
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
                        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a" }}>{t("questionnaire.tableType")}</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a" }}>{t("questionnaire.tableConsumption")}</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a" }}>{t("questionnaire.tableCost")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localizedHelpInfo.table.map((row, idx) => (
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
                {getOptionText(opt, "label")}
              </div>
              {opt.desc && (
                <div style={{ fontSize: 12, color: isDark ? "#cbd5e1" : "#475569", marginTop: 2 }}>{getOptionText(opt, "desc")}</div>
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

        const applyOrder = (newOrder) => {
          setDragOrder(newOrder);
          // position 0 = most important = rank N, position N-1 = rank 1
          const newWeights = {};
          newOrder.forEach((key, pos) => {
            newWeights[key] = metrics.length - pos;
          });
          onSetScoreWeights(newWeights);
        };

        const moveMetric = (fromIdx, toIdx) => {
          if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= order.length || toIdx >= order.length) {
            return;
          }

          const newOrder = [...order];
          const [moved] = newOrder.splice(fromIdx, 1);
          newOrder.splice(toIdx, 0, moved);
          applyOrder(newOrder);
        };

        const handleDragStart = (idx) => {
          setDragSrcIdx(idx);
        };

        const handleDragEnter = (idx) => {
          if (dragSrcIdx === null) return;
          if (idx === dragSrcIdx) return;
          moveMetric(dragSrcIdx, idx);
          setDragSrcIdx(idx);
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
              {t("questionnaire.dragInstruction")}
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
                    touchAction: "manipulation",
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
                  <span style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: 13, fontWeight: 600, flex: 1 }}>{getMetricLabel(metric)}</span>
                  <div style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        moveMetric(pos, pos - 1);
                      }}
                      disabled={pos === 0}
                      aria-label={`${t("questionnaire.ariaUp")} ${getMetricLabel(metric)}`}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: "1px solid rgba(148,163,184,0.35)",
                        background: isDark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.92)",
                        color: isDark ? "#e2e8f0" : "#334155",
                        fontSize: 14,
                        cursor: pos === 0 ? "not-allowed" : "pointer",
                        opacity: pos === 0 ? 0.4 : 1,
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        moveMetric(pos, pos + 1);
                      }}
                      disabled={pos === metrics.length - 1}
                      aria-label={`${t("questionnaire.ariaDown")} ${getMetricLabel(metric)}`}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: "1px solid rgba(148,163,184,0.35)",
                        background: isDark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.92)",
                        color: isDark ? "#e2e8f0" : "#334155",
                        fontSize: 14,
                        cursor: pos === metrics.length - 1 ? "not-allowed" : "pointer",
                        opacity: pos === metrics.length - 1 ? 0.4 : 1,
                      }}
                    >
                      ↓
                    </button>
                  </div>
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
            ? t("questionnaire.selectAtLeastOne")
            : `${t("questionnaire.continueWith")} (${multiSelected.length}) →`}
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
            ? t("questionnaire.completeBothTimelines")
            : t("questionnaire.continue")}
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
            ? t("questionnaire.numberAllCriteria")
            : t("questionnaire.continue")}
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
          {t("questionnaire.goBack")}
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
          {t("questionnaire.restart")}
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
          {t("questionnaire.tellMeNow")}
        </button>
      </div>
    </div>
  );
}
