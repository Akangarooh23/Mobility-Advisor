import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { ADVANCED_STEPS, STEPS } from "../data/questionnaireSteps";

const ALL_STEPS = [...STEPS, ...ADVANCED_STEPS];
const STEP_BY_ID = new Map(ALL_STEPS.map((step) => [step.id, step]));

const SCORE_FALLBACK_DERIVATION = {
  encaje_uso: 0.3,
  coste_total: 0.22,
  flexibilidad: 0.18,
  viabilidad_real: 0.17,
  ajuste_preferencias: 0.13,
};

const ENGINE_RULES = [
  "Se prioriza coherencia entre uso real y solucion propuesta: horizonte, km, entorno y patron de uso tienen prioridad estructural.",
  "El TCO manda sobre precio gancho: la logica incorpora base mensual, seguro, energia, mantenimiento, extras y esfuerzo inicial.",
  "Las preferencias se consideran, pero no anulan viabilidad: marca o gusto de motor no deben imponerse a coste o factibilidad operativa.",
  "Si la solucion es electrificada, se exige consistencia con garaje, posibilidad real de carga y contexto urbano/restricciones.",
  "Con horizonte corto, el sistema penaliza compromisos largos y propiedad rigida; con horizonte largo, penaliza formulas poco eficientes por uso.",
  "La decision final se acompana de comparador, confianza, supuestos y validaciones pendientes para transparencia de riesgo.",
  "El plan de accion usa semaforo (verde, ambar, rojo) para transformar recomendacion en ejecucion operativa.",
];

const NORMALIZATION_GUARDRAILS = [
  "Encaje de uso se recorta entre 0 y 25 puntos.",
  "Coste total se recorta entre 0 y 20 puntos.",
  "Flexibilidad se recorta entre 0 y 20 puntos.",
  "Viabilidad real se recorta entre 0 y 20 puntos.",
  "Ajuste de preferencias se recorta entre 0 y 15 puntos.",
  "Cuando falta desglose de score, se deriva desde el score total con pesos de respaldo y despues se aplica clamp por eje.",
  "El TCO se normaliza a estructura numerica con limites para evitar valores inverosimiles.",
  "La app exige campos minimos para considerar el resultado completo: tipo, score, resumen, ventajas, inconvenientes, alternativas, TCO y siguiente paso.",
];

const AXIS_KEYS = [
  "encaje_uso",
  "coste_total",
  "flexibilidad",
  "viabilidad_real",
  "ajuste_preferencias",
];

const STEP_AXIS_WEIGHTS = {
  perfil: { encaje_uso: 0.2, coste_total: 0.15, flexibilidad: 0.1, viabilidad_real: 0.2, ajuste_preferencias: 0.35 },
  flexibilidad: { encaje_uso: 0.1, coste_total: 0.15, flexibilidad: 0.45, viabilidad_real: 0.1, ajuste_preferencias: 0.2 },
  propulsion_preferida: { encaje_uso: 0.1, coste_total: 0.1, flexibilidad: 0.05, viabilidad_real: 0.5, ajuste_preferencias: 0.25 },
  horizonte: { encaje_uso: 0.35, coste_total: 0.2, flexibilidad: 0.35, viabilidad_real: 0.05, ajuste_preferencias: 0.05 },
  km_anuales: { encaje_uso: 0.35, coste_total: 0.35, flexibilidad: 0.05, viabilidad_real: 0.2, ajuste_preferencias: 0.05 },
  entorno_uso: { encaje_uso: 0.35, coste_total: 0.15, flexibilidad: 0.05, viabilidad_real: 0.35, ajuste_preferencias: 0.1 },
  uso_principal: { encaje_uso: 0.5, coste_total: 0.15, flexibilidad: 0.1, viabilidad_real: 0.2, ajuste_preferencias: 0.05 },
  ocupantes: { encaje_uso: 0.45, coste_total: 0.1, flexibilidad: 0.1, viabilidad_real: 0.25, ajuste_preferencias: 0.1 },
  marca_preferencia: { encaje_uso: 0.05, coste_total: 0.15, flexibilidad: 0.05, viabilidad_real: 0.15, ajuste_preferencias: 0.6 },
  vehiculo_actual: { encaje_uso: 0.05, coste_total: 0.45, flexibilidad: 0.2, viabilidad_real: 0.1, ajuste_preferencias: 0.2 },
  provincia_zona: { encaje_uso: 0.2, coste_total: 0.15, flexibilidad: 0.05, viabilidad_real: 0.5, ajuste_preferencias: 0.1 },
  garaje: { encaje_uso: 0.1, coste_total: 0.15, flexibilidad: 0.05, viabilidad_real: 0.6, ajuste_preferencias: 0.1 },
  zbe_impacto: { encaje_uso: 0.1, coste_total: 0.15, flexibilidad: 0.1, viabilidad_real: 0.45, ajuste_preferencias: 0.2 },
  cuota_mensual: { encaje_uso: 0.05, coste_total: 0.65, flexibilidad: 0.1, viabilidad_real: 0.1, ajuste_preferencias: 0.1 },
  capital_propio: { encaje_uso: 0.05, coste_total: 0.55, flexibilidad: 0.15, viabilidad_real: 0.1, ajuste_preferencias: 0.15 },
  gestion_riesgo: { encaje_uso: 0.05, coste_total: 0.2, flexibilidad: 0.35, viabilidad_real: 0.2, ajuste_preferencias: 0.2 },
};

function asArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

function safeText(value, fallback = "No indicado") {
  const text = String(value || "").trim();
  return text || fallback;
}

function labelForAnswer(stepId, rawValue) {
  const step = STEP_BY_ID.get(stepId);

  if (!step) {
    return asArray(rawValue).map((item) => safeText(item)).join(", ") || "No indicado";
  }

  const values = asArray(rawValue);
  if (!values.length) {
    return "No indicado";
  }

  return values
    .map((value) => step.options?.find((option) => option.value === value)?.label || safeText(value))
    .join(", ");
}

function describeOutcomeType(type) {
  const catalog = {
    compra_contado:
      "compra al contado: prioriza propiedad inmediata, evita coste financiero y asume toda la depreciacion y mantenimiento desde el primer dia.",
    compra_financiada:
      "compra financiada: busca equilibrio entre acceso al vehiculo y esfuerzo inicial, aceptando coste financiero y mayor necesidad de disciplina presupuestaria.",
    renting_largo:
      "renting de largo plazo: prima cuota previsible, servicios incluidos y control de riesgo frente a la propiedad.",
    renting_corto:
      "renting de corto plazo o suscripcion: busca flexibilidad contractual y menor compromiso temporal.",
    rent_a_car:
      "alquiler por dias: solo compensa cuando el uso es puntual y no conviene soportar un fijo mensual permanente.",
    carsharing:
      "carsharing: encaja cuando la necesidad es urbana, intermitente y con buena cobertura local.",
    carpooling:
      "carpooling: tiene sentido cuando el uso recurrente puede compartirse y el coste fijo propio seria ineficiente.",
    transporte_publico:
      "transporte publico: gana cuando el patron de movilidad no justifica la estructura de costes de un vehiculo propio.",
    micromovilidad:
      "micromovilidad: se favorece cuando el entorno es urbano, distancias cortas y la necesidad de carga o plazas es baja.",
  };

  return (
    catalog[type] ||
    "solucion de movilidad seleccionada por mejor equilibrio global entre uso, coste, riesgo y preferencias."
  );
}

function buildScoreFormulaLines(scoreBreakdownEntries, scoreBreakdown, totalScore) {
  const lines = [
    `Score final observado: ${Number(totalScore || 0)}/100.`,
    "La logica del veredicto se estructura en cinco ejes ponderados y el resultado final se interpreta como una suma de puntos parciales.",
  ];

  scoreBreakdownEntries.forEach((entry) => {
    const value = Number(scoreBreakdown?.[entry.key] || 0);
    lines.push(`${entry.label}: ${value}/${entry.max}.`);
  });

  lines.push(
    "Si la IA no devuelve el desglose completo, la app reparte el score total con una derivacion de respaldo: 30% encaje de uso, 22% coste total, 18% flexibilidad, 17% viabilidad real y el resto ajuste con preferencias."
  );

  return lines;
}

function buildAxisExplanation({ key, labels, result, scoreBreakdown, scoreBreakdownEntries, tcoDetail }) {
  const current = Number(scoreBreakdown?.[key] || 0);
  const max = scoreBreakdownEntries.find((item) => item.key === key)?.max || 0;
  const scorePrefix = `Resultado del eje: ${current}/${max}.`;

  if (key === "encaje_uso") {
    return [
      scorePrefix,
      `Este eje se alimenta sobre todo del horizonte (${labels.horizonte}), kilometros (${labels.km_anuales}), entorno (${labels.entorno_uso}), uso principal (${labels.uso_principal}) y necesidad de plazas/maletero (${labels.ocupantes}).`,
      `La recomendacion termina en ${safeText(result?.solucion_principal?.titulo)} porque el motor entiende que ${describeOutcomeType(result?.solucion_principal?.tipo)}`,
      `En este caso, el patron de uso obliga a priorizar una solucion que no rompa con ${labels.uso_principal} y que siga siendo coherente con ${labels.entorno_uso}.`,
    ];
  }

  if (key === "coste_total") {
    return [
      scorePrefix,
      `Aqui pesan la cuota comoda (${labels.cuota_mensual}), el capital inicial (${labels.capital_propio}), la existencia de vehiculo actual (${labels.vehiculo_actual}) y el TCO mensual estimado.`,
      `El sistema consolida un coste orientativo de ${safeText(result?.solucion_principal?.coste_estimado)} con un TCO de ${Number(tcoDetail?.total_mensual || 0) > 0 ? `${Number(tcoDetail.total_mensual || 0)} EUR/mes aprox.` : "referencia mensual no detallada."}`,
      "La logica no se limita a la cuota anunciada: intenta absorber seguro, energia, mantenimiento, extras y esfuerzo inicial para evitar falsos baratos.",
    ];
  }

  if (key === "flexibilidad") {
    return [
      scorePrefix,
      `Este bloque compara la relacion deseada con el vehiculo (${labels.flexibilidad}) frente al compromiso temporal (${labels.horizonte}) y al apetito de riesgo (${labels.gestion_riesgo}).`,
      `La eleccion final favorece ${safeText(result?.solucion_principal?.titulo)} porque la preferencia declarada no apunta solo al precio, sino al nivel de permanencia, propiedad y reversibilidad aceptada.`,
      "Cuando el horizonte es corto o incierto, la logica penaliza soluciones rigidas; cuando el horizonte es largo y la propiedad es prioritaria, penaliza formulas demasiado temporales.",
    ];
  }

  if (key === "viabilidad_real") {
    return [
      scorePrefix,
      `Se calcula con la motorizacion preferida (${labels.propulsion_preferida}), la realidad de garaje/carga (${labels.garaje}), el impacto de ZBE (${labels.zbe_impacto}) y el tipo de zona (${labels.provincia_zona}).`,
      `La etiqueta ambiental considerada en la solucion es ${safeText(result?.solucion_principal?.etiqueta_dgt, "No aplica")}, y las propulsiones viables detectadas son ${asArray(result?.propulsiones_viables).join(", ") || "no indicadas"}.`,
      "Este eje baja cuando una opcion gusta en abstracto pero exige condiciones operativas no confirmadas: punto de carga, estabilidad de kilometraje, acceso urbano o infraestructura local.",
    ];
  }

  return [
    scorePrefix,
    `Este eje contrasta preferencias declaradas como marca (${labels.marca_preferencia}), propulsion (${labels.propulsion_preferida}) y nivel de control del riesgo (${labels.gestion_riesgo}) frente a la solucion que realmente sale mejor parada.`,
    "Si las preferencias encajan con la mejor solucion, el score sube. Si una preferencia entra en conflicto con coste, uso o viabilidad, la app la mantiene como condicionante, pero no deja que domine el veredicto final.",
    "Por eso la recomendacion final no replica automaticamente gustos: los ordena detras de logica de uso, coste y factibilidad real.",
  ];
}

function buildAnswerImpact(stepId, result) {
  const outcomeTitle = safeText(result?.solucion_principal?.titulo, "la solucion final");
  const outcomeType = safeText(result?.solucion_principal?.tipo, "movilidad");

  const messages = {
    perfil: `Determina si el analisis prioriza logica de uso particular, empresa o autonomo. Eso cambia el peso de previsibilidad, fiscalidad y flexibilidad contractual hacia ${outcomeTitle}.`,
    flexibilidad: `Es una respuesta determinante porque separa propiedad, financiacion, renting y uso bajo demanda. La salida ${outcomeType} se valida o se penaliza segun esta preferencia.`,
    propulsion_preferida:
      "Modula etiqueta DGT, consumo, restricciones urbanas y viabilidad energetica. Nunca se interpreta sola: se cruza con garaje, ZBE, kilometraje y trayecto.",
    horizonte:
      "Es una variable estructural: cuando el plazo es corto, la logica castiga compra y permanencias largas; cuando el plazo es largo, penaliza formatos efimeros o caros por uso.",
    km_anuales:
      "Afecta a la amortizacion del coche, a la conveniencia de cada motor y a si una cuota cerrada o una compra salen realmente racionales.",
    entorno_uso:
      "Define si pesan mas ciudad, carretera o autopista. Esto altera consumo real, restricciones ZBE y conveniencia de cada solucion.",
    uso_principal:
      "Sirve para validar si la solucion responde al patron diario de necesidad real y no solo a una preferencia aspiracional.",
    ocupantes:
      "Introduce restriccion de capacidad. Una solucion puede ser barata o flexible, pero baja en ranking si no cubre plazas y carga habituales.",
    marca_preferencia:
      "Se usa como preferencia, no como regla absoluta. Se mantiene detras de coherencia economica y de uso si entra en conflicto.",
    vehiculo_actual:
      "Impacta en entrada, diferencial economico y conveniencia de compra, financiacion o entrega.",
    provincia_zona:
      "Ajusta la logica a realidad local de infraestructura, restricciones urbanas y oferta de mercado.",
    garaje:
      "Es critica para justificar electrico puro o PHEV. Sin viabilidad operativa real, la recomendacion electrificada pierde solidez.",
    zbe_impacto:
      "Sube o baja el valor estrategico de etiquetas ambientales y soluciones electrificadas o flexibles en ciudad.",
    cuota_mensual:
      "Marca la frontera psicologica y financiera que la app intenta no sobrepasar al construir TCO y plan de accion.",
    capital_propio:
      "Afecta a si la compra es sana o si el sistema debe favorecer formulas con menos desembolso inicial.",
    gestion_riesgo:
      "Decide cuanto valor se da a previsibilidad frente a ahorro potencial con mas exposicion a mantenimiento, depreciacion o permanencia.",
  };

  return (
    messages[stepId] ||
    `Esta respuesta se utiliza para modular la recomendacion ${outcomeTitle} dentro del bloque de logica correspondiente.`
  );
}

function buildAnswerTrace(answers, labels, result) {
  return ALL_STEPS.filter((step) => asArray(answers?.[step.id]).length > 0).map((step) => ({
    question: step.question,
    answer: labels[step.id],
    logic: buildAnswerImpact(step.id, result),
  }));
}

function buildInputInventory(labels, answers = {}) {
  return ALL_STEPS.map((step) => {
    const raw = asArray(answers?.[step.id]);
    const answered = raw.length > 0;

    return {
      block: step.block,
      question: step.question,
      stepId: step.id,
      answered,
      answerLabel: labels[step.id],
      rawValue: raw,
      optionCount: Array.isArray(step.options) ? step.options.length : 0,
    };
  });
}

function formatNumber(value, digits = 2) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) {
    return "0.00";
  }

  return num.toFixed(digits);
}

function getStepWeights(stepId) {
  const configured = STEP_AXIS_WEIGHTS[stepId];

  if (configured) {
    return configured;
  }

  return {
    encaje_uso: 0.2,
    coste_total: 0.2,
    flexibilidad: 0.2,
    viabilidad_real: 0.2,
    ajuste_preferencias: 0.2,
  };
}

function buildPerAnswerMathAudit({ answers = {}, labels = {}, scoreBreakdown = {}, totalScore = 0 }) {
  const answeredSteps = ALL_STEPS.filter((step) => asArray(answers?.[step.id]).length > 0);

  if (!answeredSteps.length) {
    return [];
  }

  const axisDenominators = AXIS_KEYS.reduce((acc, axis) => {
    acc[axis] = answeredSteps.reduce((sum, step) => sum + Number(getStepWeights(step.id)?.[axis] || 0), 0);
    return acc;
  }, {});

  return answeredSteps
    .map((step) => {
      const weights = getStepWeights(step.id);
      const axisContribution = AXIS_KEYS.reduce((acc, axis) => {
        const axisScore = Number(scoreBreakdown?.[axis] || 0);
        const denominator = Number(axisDenominators[axis] || 0);
        const weight = Number(weights?.[axis] || 0);
        const points = denominator > 0 ? (axisScore * weight) / denominator : 0;

        acc[axis] = points;
        return acc;
      }, {});

      const contributionPoints = AXIS_KEYS.reduce((sum, axis) => sum + Number(axisContribution[axis] || 0), 0);
      const contributionPct = totalScore > 0 ? (contributionPoints / totalScore) * 100 : 0;

      return {
        stepId: step.id,
        question: step.question,
        answerLabel: labels[step.id],
        weights,
        axisContribution,
        contributionPoints,
        contributionPct,
      };
    })
    .sort((a, b) => b.contributionPoints - a.contributionPoints);
}

function makeHeading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
  });
}

function makeBullet(text, level = 0) {
  return new Paragraph({
    text,
    bullet: { level },
    spacing: { after: 60 },
  });
}

function makeText(text, options = {}) {
  return new Paragraph({
    children: [new TextRun(text)],
    spacing: { after: options.after ?? 90 },
    alignment: options.alignment,
  });
}

function makeCodeLine(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: "Consolas", size: 18 })],
    spacing: { after: 20 },
  });
}

function toPrettyJsonLines(value) {
  return JSON.stringify(value ?? null, null, 2).split("\n");
}

function addQuestionnaireDictionary(children, answers = {}) {
  children.push(makeHeading("Anexo A. Diccionario del cuestionario", HeadingLevel.HEADING_2));

  ALL_STEPS.forEach((step, index) => {
    const selectedValues = new Set(asArray(answers?.[step.id]));

    children.push(makeText(`${index + 1}. [${step.block}] ${step.question}`, { after: 30 }));
    children.push(makeBullet(`Id interno: ${step.id}`));
    children.push(makeBullet(`Tipo de pregunta: ${safeText(step.type)}`));
    if (step.subtitle) {
      children.push(makeBullet(`Proposito logico: ${safeText(step.subtitle)}`));
    }

    (step.options || []).forEach((option) => {
      const isSelected = selectedValues.has(option.value);
      children.push(
        makeBullet(
          `${isSelected ? "[SELECCIONADA]" : "[ ]"} ${safeText(option.value)} => ${safeText(option.label)}${option.desc ? ` | impacto: ${safeText(option.desc)}` : ""}`,
          1
        )
      );
    });
  });
}

function addTechnicalJsonSection(children, title, payload) {
  children.push(makeHeading(title, HeadingLevel.HEADING_2));
  toPrettyJsonLines(payload).forEach((line) => {
    children.push(makeCodeLine(line));
  });
}

function sanitizeFileName(value) {
  return safeText(value, "resultado")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function triggerDownload(blob, fileName) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(href), 1500);
}

export async function exportAdviceLogicDoc({
  answers,
  result,
  displayResult,
  scoreBreakdownEntries,
  scoreBreakdown,
  whyThisWins,
  tcoDetail,
  comparatorRows,
  transparency,
  transparencyAssumptions,
  transparencyChecks,
  actionPlan,
  actionSteps,
  actionAlerts,
  marketRadar,
  formatCurrency,
}) {
  const labels = Object.fromEntries(
    ALL_STEPS.map((step) => [step.id, labelForAnswer(step.id, answers?.[step.id])])
  );
  const answerTrace = buildAnswerTrace(answers, labels, result);
  const inputInventory = buildInputInventory(labels, answers);
  const totalScore = Number(result?.solucion_principal?.score || result?.alineacion_pct || 0);
  const perAnswerMathAudit = buildPerAnswerMathAudit({
    answers,
    labels,
    scoreBreakdown,
    totalScore,
  });
  const createdAt = new Date().toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const children = [
    new Paragraph({
      text: "Documento de logica aplicada del test",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    makeText(`Generado el ${createdAt}`, { alignment: AlignmentType.CENTER, after: 220 }),
    makeHeading("1. Resultado final"),
    makeText(`Recomendacion principal: ${safeText(displayResult?.solucion_principal?.titulo)}.`),
    makeText(`Tipo de solucion: ${safeText(result?.solucion_principal?.tipo)}.`),
    makeText(`Score de coincidencia: ${totalScore}/100.`),
    makeText(`Resumen ejecutivo: ${safeText(displayResult?.solucion_principal?.resumen)}.`),
    makeText(`Interpretacion del tipo ganador: ${describeOutcomeType(result?.solucion_principal?.tipo)}`),
    makeHeading("2. Reglas estructurales aplicadas"),
    ...ENGINE_RULES.map((rule) => makeBullet(rule)),
    makeHeading("3. Formula del score"),
    ...buildScoreFormulaLines(scoreBreakdownEntries, scoreBreakdown, totalScore).map((line) =>
      makeBullet(line)
    ),
    makeBullet(
      `Derivacion de respaldo en pesos: encaje_uso=${SCORE_FALLBACK_DERIVATION.encaje_uso}, coste_total=${SCORE_FALLBACK_DERIVATION.coste_total}, flexibilidad=${SCORE_FALLBACK_DERIVATION.flexibilidad}, viabilidad_real=${SCORE_FALLBACK_DERIVATION.viabilidad_real}, ajuste_preferencias=${SCORE_FALLBACK_DERIVATION.ajuste_preferencias}.`
    ),
    makeHeading("4. Lectura detallada por ejes"),
  ];

  scoreBreakdownEntries.forEach((entry) => {
    const current = Number(scoreBreakdown?.[entry.key] || 0);
    const ratio = entry.max > 0 ? ((current / entry.max) * 100).toFixed(1) : "0.0";
    children.push(makeText(`${entry.label} (${current}/${entry.max} · ${ratio}%)`, { after: 60 }));
    buildAxisExplanation({
      key: entry.key,
      labels,
      result,
      scoreBreakdown,
      scoreBreakdownEntries,
      tcoDetail,
    }).forEach((line) => {
      children.push(makeBullet(line));
    });
  });

  children.push(makeHeading("5. Inventario completo de entradas"));
  inputInventory.forEach((item, index) => {
    children.push(makeText(`${index + 1}. ${item.question}`, { after: 40 }));
    children.push(makeBullet(`Bloque: ${item.block}`));
    children.push(makeBullet(`Id de variable: ${item.stepId}`));
    children.push(makeBullet(`Respondida: ${item.answered ? "Si" : "No"}`));
    children.push(makeBullet(`Valor etiquetado: ${item.answerLabel}`));
    children.push(
      makeBullet(
        `Valor interno: ${item.rawValue.length ? item.rawValue.join(", ") : "Sin respuesta"}`
      )
    );
  });

  children.push(makeHeading("6. Trazabilidad de respuestas seleccionadas"));
  answerTrace.forEach((item, index) => {
    children.push(makeText(`${index + 1}. ${item.question}`, { after: 50 }));
    children.push(makeBullet(`Respuesta registrada: ${item.answer}`));
    children.push(makeBullet(`Impacto logico: ${item.logic}`));
  });

  children.push(makeHeading("7. Motivos que consolidan la recomendacion"));
  (whyThisWins || []).forEach((item) => {
    children.push(makeBullet(item));
  });

  children.push(makeHeading("8. Coste total y lectura economica"));
  children.push(
    makeBullet(
      `Coste estimado visible en resultado: ${safeText(result?.solucion_principal?.coste_estimado)}.`
    )
  );
  children.push(
    makeBullet(
      `Base mensual: ${
        Number(tcoDetail?.base_mensual || 0) > 0
          ? formatCurrency(Number(tcoDetail.base_mensual || 0))
          : "No indicada"
      }.`
    )
  );
  children.push(
    makeBullet(
      `Seguro: ${
        Number(tcoDetail?.seguro || 0) > 0
          ? formatCurrency(Number(tcoDetail.seguro || 0))
          : "No indicado"
      }.`
    )
  );
  children.push(
    makeBullet(
      `Energia o combustible: ${
        Number(tcoDetail?.energia || 0) > 0
          ? formatCurrency(Number(tcoDetail.energia || 0))
          : "No indicado"
      }.`
    )
  );
  children.push(
    makeBullet(
      `Mantenimiento: ${
        Number(tcoDetail?.mantenimiento || 0) > 0
          ? formatCurrency(Number(tcoDetail.mantenimiento || 0))
          : "No indicado"
      }.`
    )
  );
  children.push(
    makeBullet(
      `Extras o colchon: ${
        Number(tcoDetail?.extras || 0) > 0
          ? formatCurrency(Number(tcoDetail.extras || 0))
          : "No indicado"
      }.`
    )
  );
  children.push(
    makeBullet(
      `Total mensual orientativo: ${
        Number(tcoDetail?.total_mensual || 0) > 0
          ? formatCurrency(Number(tcoDetail.total_mensual || 0))
          : "No indicado"
      }.`
    )
  );
  children.push(
    makeBullet(
      `Total anual orientativo: ${
        Number(tcoDetail?.total_anual || 0) > 0
          ? formatCurrency(Number(tcoDetail.total_anual || 0))
          : "No indicado"
      }.`
    )
  );
  if (tcoDetail?.nota) {
    children.push(makeBullet(`Nota interpretativa: ${safeText(tcoDetail.nota)}.`));
  }

  children.push(makeHeading("9. Comparador, confianza y validaciones"));
  (comparatorRows || []).forEach((row) => {
    children.push(
      makeBullet(
        `${safeText(row.criterio)}. Gana: ${safeText(row.ganador)}. Opcion elegida: ${safeText(
          row.opcion_principal
        )}. Alternativa 1: ${safeText(row.alternativa_1, "Sin dato")}. Alternativa 2: ${safeText(
          row.alternativa_2,
          "Sin dato"
        )}.`
      )
    );
  });
  if (transparency?.confianza_motivo) {
    children.push(
      makeBullet(
        `Motivo de confianza ${safeText(transparency?.confianza_nivel, "media")}: ${safeText(
          transparency.confianza_motivo
        )}.`
      )
    );
  }
  (transparencyAssumptions || []).forEach((item) => {
    children.push(makeBullet(`Supuesto clave: ${item}`));
  });
  (transparencyChecks || []).forEach((item) => {
    children.push(makeBullet(`Validacion pendiente: ${item}`));
  });

  children.push(makeHeading("10. Plan de accion resultante"));
  children.push(makeBullet(`Semaforo de decision: ${safeText(actionPlan?.semaforo)}.`));
  if (actionPlan?.estado) {
    children.push(makeBullet(`Estado: ${safeText(actionPlan.estado)}.`));
  }
  if (actionPlan?.resumen) {
    children.push(makeBullet(`Resumen operativo: ${safeText(actionPlan.resumen)}.`));
  }
  (actionSteps || []).forEach((item, index) => {
    children.push(makeBullet(`Accion ${index + 1}: ${item}`));
  });
  (actionAlerts || []).forEach((item) => {
    children.push(makeBullet(`Alerta roja: ${item}`));
  });

  children.push(makeHeading("11. Radar de mercado"));
  children.push(makeBullet(`Objetivo de busqueda: ${safeText(marketRadar?.objetivo)}.`));
  asArray(marketRadar?.senales_verdes).forEach((item) => {
    children.push(makeBullet(`Senal verde: ${item}`));
  });
  asArray(marketRadar?.alertas).forEach((item) => {
    children.push(makeBullet(`Alerta de mercado: ${item}`));
  });

  children.push(makeHeading("12. Normalizacion y guardrails"));
  NORMALIZATION_GUARDRAILS.forEach((item) => {
    children.push(makeBullet(item));
  });

  children.push(makeHeading("13. Resumen de transparencia"));
  children.push(
    makeText(
      "Este documento explica la logica aplicada por la capa de recomendacion del producto: pesos del score, lectura de respuestas, veredicto resultante, supuestos y validaciones. No es una transcripcion literal del modelo, sino la trazabilidad estructurada que la aplicacion usa para justificar por que la recomendacion final ha terminado en esta opcion y no en otra."
    )
  );

  children.push(makeHeading("14. Auditoria matematica por respuesta"));
  children.push(
    makeBullet(
      "Metodo: para cada eje del score se reparte su puntuacion entre las respuestas contestadas segun una matriz de pesos por variable; despues se suma la contribucion por eje de cada respuesta."
    )
  );
  children.push(
    makeBullet(
      "Formula por respuesta y eje: contribucion(respuesta,eje) = score_eje x peso_respuesta_eje / suma_de_pesos_del_eje_en_respuestas_contestadas."
    )
  );
  children.push(
    makeBullet(
      "La suma de contribuciones de todas las respuestas aproxima el score final mostrado (puede variar por redondeo)."
    )
  );

  perAnswerMathAudit.forEach((item, index) => {
    children.push(
      makeText(
        `${index + 1}. ${item.question} | impacto total ${formatNumber(item.contributionPoints)} puntos (${formatNumber(item.contributionPct)}% del score)`,
        { after: 40 }
      )
    );
    children.push(makeBullet(`Respuesta: ${item.answerLabel}`));
    children.push(
      makeBullet(
        `Contribucion por ejes: encaje_uso=${formatNumber(item.axisContribution.encaje_uso)}, coste_total=${formatNumber(item.axisContribution.coste_total)}, flexibilidad=${formatNumber(item.axisContribution.flexibilidad)}, viabilidad_real=${formatNumber(item.axisContribution.viabilidad_real)}, ajuste_preferencias=${formatNumber(item.axisContribution.ajuste_preferencias)}.`
      )
    );
    children.push(
      makeBullet(
        `Pesos usados en esta variable: encaje_uso=${formatNumber(item.weights.encaje_uso, 3)}, coste_total=${formatNumber(item.weights.coste_total, 3)}, flexibilidad=${formatNumber(item.weights.flexibilidad, 3)}, viabilidad_real=${formatNumber(item.weights.viabilidad_real, 3)}, ajuste_preferencias=${formatNumber(item.weights.ajuste_preferencias, 3)}.`
      )
    );
  });

  addQuestionnaireDictionary(children, answers);

  addTechnicalJsonSection(children, "Anexo B. JSON de respuestas (raw)", answers || {});
  addTechnicalJsonSection(children, "Anexo C. JSON del resultado normalizado", result || {});
  addTechnicalJsonSection(children, "Anexo D. JSON del resultado para visualizacion", displayResult || {});
  addTechnicalJsonSection(children, "Anexo E. JSON de trazabilidad exportada", {
    inputInventory,
    scoreBreakdownEntries,
    scoreBreakdown,
    whyThisWins,
    tcoDetail,
    comparatorRows,
    transparency,
    transparencyAssumptions,
    transparencyChecks,
    actionPlan,
    actionSteps,
    actionAlerts,
    marketRadar,
    perAnswerMathAudit,
    createdAt,
  });

  const document = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  const fileName = `moveadvisor-logica-${sanitizeFileName(displayResult?.solucion_principal?.titulo)}.docx`;
  triggerDownload(blob, fileName);

  return fileName;
}
