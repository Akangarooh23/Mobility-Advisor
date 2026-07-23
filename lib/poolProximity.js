'use strict';

/* ------------------------------------------------------------------ *
 * Selección del pool por cuota de año — Ola 2, paso 2
 *
 * Diagnóstico que motiva el módulo (Ola 1):
 *   Golf 2020 / 50.000 km  →  pool con medYr=2023, medKm=37.029
 *   El sujeto queda en la cola y el OLS extrapola en vez de interpolar.
 *
 * Objetivo: pool SIMÉTRICO alrededor del sujeto, no ESTRECHO.
 *   - Simétrico   → la mediana se acerca al sujeto, se acaba la extrapolación.
 *   - No estrecho → se conserva la varianza en km y año que el OLS necesita.
 *
 * DOS MECANISMOS INDEPENDIENTES (dos interruptores, para poder atribuir
 * el drift a uno u otro por separado):
 *
 *   1. useProximity — reordena los candidatos por proximidad (km, año) antes
 *                     de aplicar la cuota; los comparables más cercanos tienen
 *                     prioridad dentro de cada lado.
 *                     IMPORTANTE: es un booleano, no un knob numérico.
 *                     exp(−d²) y exp(−α·d²) producen idéntico ranking para
 *                     cualquier α>0 porque la exponencial es monótona en d².
 *                     α solo sería un knob real si hubiera un segundo predictor
 *                     (relevanceKey≠null) que contrabalancee la proximidad.
 *                     Sin relevanceKey, cualquier α>0 da el mismo resultado.
 *   2. balance     — cuota por lado (más antiguos / más nuevos que el sujeto).
 *                     Es lo que CENTRA el pool. balance=false → inerte.
 *
 * Con { useProximity: false, balance: false } la salida es idéntica al
 * comportamiento actual: se puede mergear en oscuro y verificar 0 DRIFT.
 *
 * Por qué la proximidad sola no basta: la oferta del mercado es asimétrica
 * (muchos más 2023 que 2017). Una penalización simétrica sobre un suministro
 * asimétrico sigue dando un pool descentrado, solo que además estrecho —
 * peor que el actual. La cuota es lo que arregla el centrado.
 * La proximidad, dentro de cada lado de la cuota, concentra la selección en
 * el sub-segmento de km similar al sujeto; en pools pequeños esto puede
 * sesgar la mediana de precio — véase diagnóstico Stelvio en §1d.
 * ------------------------------------------------------------------ */

const DEFAULT_OPTS = {
  useProximity: false,  // booleano — ver docblock arriba.
  balance: false,       // false = sin cuota por lado.
  kmScale: null,        // null → derivado de la dispersión de candidatos.
  yearScale: 3,         // años. Escala del kernel en la dimensión temporal.
  maxImbalance: 2.0,    // ratio máx. lado mayor / lado menor tras la cuota.
  minPool: 20,          // por debajo se afloja la cuota antes que perder n.
  targetSize: 400,      // tamaño máximo del pool devuelto.
  relevanceKey: null,   // si el candidato ya trae score previo, se multiplica.
  kmKey: 'km',
  yearKey: 'year',
};

/* ---------------------------- helpers ---------------------------- */

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function quantile(values, q) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Pearson. Devuelve null (no NaN) si alguna varianza es cero. */
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  return Number.isFinite(r) ? r : null;
}

/**
 * Rango medio: (below + 0.5 × equal) / n.
 * Con x <= v, los empates del mismo año o km inflaban yrPct/kmPct
 * de forma sistemática (e.g., 5 coches del mismo año que el sujeto
 * contaban todos como "por debajo"). El rango medio elimina ese sesgo.
 */
function percentileOf(values, v) {
  if (!values.length) return null;
  let below = 0, equal = 0;
  for (const x of values) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return (below + 0.5 * equal) / values.length;
}

/** Dispersión robusta de km, con suelo para no colapsar el kernel. */
function deriveKmScale(candidates, userKm, kmKey) {
  const kms = candidates.map((c) => c[kmKey]).filter(Number.isFinite);
  const iqr = kms.length >= 4 ? quantile(kms, 0.75) - quantile(kms, 0.25) : 0;
  const robust = iqr / 1.349; // consistente con sigma bajo normalidad
  return Math.max(10000, robust || 0, 0.20 * (userKm || 0));
}

/* ------------------------- kernel + cuota ------------------------- */

/**
 * Score de proximidad: exp(-(dkm²+dyr²)).
 * useProximity=false → 1 para todos (preserva el orden de entrada).
 * El coeficiente dentro del exponente es 1 — cualquier constante positiva
 * produciría el mismo ranking (ver docblock del módulo).
 */
function proximityWeight(offer, user, o) {
  if (!o.useProximity) return 1;
  const dkm = ((offer[o.kmKey] ?? user.km) - user.km) / o.kmScale;
  const dyr = ((offer[o.yearKey] ?? user.year) - user.year) / o.yearScale;
  const base = o.relevanceKey ? (offer[o.relevanceKey] ?? 1) : 1;
  return base * Math.exp(-(dkm * dkm + dyr * dyr));
}

/**
 * Selecciona el pool final.
 * @returns {{ pool: Array, diagnostics: Object, applied: Object }}
 */
function selectBalancedPool(candidates, user, options = {}) {
  const o = { ...DEFAULT_OPTS, ...options };
  if (o.kmScale == null) o.kmScale = deriveKmScale(candidates, user.km, o.kmKey);

  // Camino inerte: idéntico al comportamiento actual, bit a bit.
  if (!o.useProximity && !o.balance) {
    const pool = candidates.slice(0, o.targetSize);
    return {
      pool,
      diagnostics: poolDiagnostics(pool, user, o),
      applied: { useProximity: false, balance: false, relaxed: false, kmScale: o.kmScale },
    };
  }

  const scored = candidates.map((c) => ({ offer: c, score: proximityWeight(c, user, o) }));
  scored.sort((a, b) => b.score - a.score);

  if (!o.balance) {
    const pool = scored.slice(0, o.targetSize).map((s) => s.offer);
    return {
      pool,
      diagnostics: poolDiagnostics(pool, user, o),
      applied: { useProximity: o.useProximity, balance: false, relaxed: false, kmScale: o.kmScale },
    };
  }

  // Cuota por lado sobre el eje AÑO (el eje diagnosticado en Ola 1).
  // El balance en km se mide en los diagnósticos, no se fuerza: km y año
  // están correlacionados, así que centrar en año centra parcialmente km.
  const older = [], newer = [], same = [];
  for (const s of scored) {
    const y = s.offer[o.yearKey];
    if (!Number.isFinite(y) || y === user.year) same.push(s);
    else if (y < user.year) older.push(s);
    else newer.push(s);
  }

  const budget = Math.max(0, o.targetSize - same.length);
  let take = Math.floor(budget / 2);
  const smaller = Math.min(older.length, newer.length);
  // Acota el desequilibrio en vez de exigir simetría perfecta: si un lado
  // es escaso, permitir hasta maxImbalance evita tirar señal útil.
  take = Math.min(take, Math.max(smaller, Math.ceil(smaller * o.maxImbalance)));

  let pool = [...same, ...older.slice(0, take), ...newer.slice(0, take)]
    .map((s) => s.offer);

  // Aflojar antes que perder n: cruzar hacia abajo los escalones de
  // confianza (>=80, >=40, >=15) degradaría el informe sin que el modelo
  // haya empeorado.
  let relaxed = false;
  if (pool.length < o.minPool) {
    relaxed = true;
    const chosen = new Set(pool);
    for (const s of scored) {
      if (pool.length >= Math.min(o.minPool, candidates.length)) break;
      if (!chosen.has(s.offer)) { pool.push(s.offer); chosen.add(s.offer); }
    }
  }

  return {
    pool,
    diagnostics: poolDiagnostics(pool, user, o),
    applied: {
      useProximity: o.useProximity, balance: true, relaxed, kmScale: Math.round(o.kmScale),
      sides: { older: older.length, newer: newer.length, same: same.length, take },
    },
  };
}

/* -------------------------- diagnósticos -------------------------- */

/**
 * Todo lo que hay que mirar en shadow mode antes de encender nada.
 *
 * kmPct / yrPct son la métrica clave: miden si el sujeto está en la cola.
 * Objetivo ~0.50. En Ola 1 el Golf 2020 estaba en la cola de un pool de
 * 2023, que es exactamente lo que hacía extrapolar al OLS.
 *
 * r es el otro dato a vigilar: tras estandarizar, es el único riesgo
 * numérico que queda (kappa = (1+|r|)/(1-|r|)). Si al centrar el pool sube
 * la correlación km-año, el condicionamiento empeora y los slopes se
 * vuelven inestables — hay que poder distinguir eso de un problema de
 * composición del pool.
 */
function poolDiagnostics(pool, user, options = {}) {
  const o = { ...DEFAULT_OPTS, ...options };
  const kms = pool.map((p) => p[o.kmKey]).filter(Number.isFinite);
  const yrs = pool.map((p) => p[o.yearKey]).filter(Number.isFinite);
  const n = pool.length;
  // Filtrar pares completos antes de calcular r: slice() a longitud común
  // desalineaba km de oferta A con año de oferta B cuando alguna tenía solo uno.
  const pairs = pool
    .map((p) => [p[o.kmKey], p[o.yearKey]])
    .filter(([k, y]) => Number.isFinite(k) && Number.isFinite(y));
  const r = pearson(pairs.map(([k]) => k), pairs.map(([, y]) => y));

  return {
    n,
    medKm:    median(kms),
    medYr:    median(yrs),
    r:        r == null ? null : Number(r.toFixed(3)),
    kappa:    r == null ? null : Number(((1 + Math.abs(r)) / (1 - Math.abs(r))).toFixed(1)),
    // kmPct es siempre ≈1.00 porque la query filtra maxMileage: userKm — el pool
    // no contiene coches con más km que el sujeto por diseño. Métrica informativa
    // solo si el criterio de corte cambia a uno no acotado superiormente.
    kmPct:    kms.length ? Number(percentileOf(kms, user.km).toFixed(2))   : null,
    yrPct:    yrs.length ? Number(percentileOf(yrs, user.year).toFixed(2)) : null,
    kmIqr:    kms.length >= 4 ? Math.round(quantile(kms, 0.75) - quantile(kms, 0.25)) : null,
    yrSpread: yrs.length ? Math.max(...yrs) - Math.min(...yrs) : null,
  };
}

/**
 * Barrido para shadow mode: calcula qué pool SALDRÍA con cada configuración
 * sin aplicar ninguna.
 * useProximity es un booleano — no hay knob numérico que barrer (ver docblock).
 */
function sweepDiagnostics(candidates, user, configs, options = {}) {
  const list = configs || [
    { useProximity: false, balance: false },  // actual (inerte)
    { useProximity: false, balance: true  },  // solo cuota
    { useProximity: true,  balance: false },  // solo proximidad (advierte kmIqr estrecho)
    { useProximity: true,  balance: true  },  // cuota + proximidad
  ];
  return list.map((cfg) => {
    const { diagnostics, applied } = selectBalancedPool(candidates, user, { ...options, ...cfg });
    return { ...cfg, ...diagnostics, relaxed: applied.relaxed };
  });
}

/** Línea única, en el mismo formato que la tupla [SELL_REPORT]. */
function logPoolDiagnostics(tag, diag, extra = {}) {
  console.log('[POOL]', tag, JSON.stringify({ ...diag, ...extra }));
}

module.exports = {
  DEFAULT_OPTS,
  proximityWeight,
  selectBalancedPool,
  poolDiagnostics,
  sweepDiagnostics,
  logPoolDiagnostics,
  // exportados para test unitario
  _internals: { median, quantile, pearson, percentileOf, deriveKmScale },
};
