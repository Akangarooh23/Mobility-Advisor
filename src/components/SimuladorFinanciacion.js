import { useEffect, useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Simulador de financiación — Marketplace VO (concesionarios,        */
/*  renting y particulares). NO aplica a importación.                  */
/*  Estilos inline + theme-aware (isDark) para encajar con la ficha.   */
/* ------------------------------------------------------------------ */

/* ---- Matemática financiera (préstamo francés + VFG opcional) ------ */

/** Cuota de un préstamo francés con valor final opcional (VFG / balloon). */
export function calcularCuota({ capital, tinAnual, meses, valorFinal = 0 }) {
  if (capital <= 0 || meses <= 0) return 0;
  const i = tinAnual / 12;
  if (i === 0) return (capital - valorFinal) / meses;
  const vfDescontado = valorFinal / Math.pow(1 + i, meses);
  return ((capital - vfDescontado) * i) / (1 - Math.pow(1 + i, -meses));
}

/**
 * TAE real por bisección: busca el tipo mensual que iguala el importe
 * neto recibido con el valor actual de todos los pagos (cuotas + valor final).
 * Correcto cuando hay comisión de apertura: la comisión encarece la operación
 * y por eso la TAE sube por encima del TIN.
 */
export function calcularTae({ importeNeto, cuota, meses, valorFinal = 0 }) {
  if (importeNeto <= 0 || cuota <= 0) return 0;
  const van = (i) => {
    let acc = 0;
    for (let k = 1; k <= meses; k++) acc += cuota / Math.pow(1 + i, k);
    acc += valorFinal / Math.pow(1 + i, meses);
    return acc - importeNeto;
  };
  let lo = 0;
  let hi = 1;
  for (let n = 0; n < 80; n++) {
    const mid = (lo + hi) / 2;
    if (van(mid) > 0) lo = mid;
    else hi = mid;
  }
  const mensual = (lo + hi) / 2;
  return Math.pow(1 + mensual, 12) - 1;
}

const eur = (n) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));

const pct = (n) =>
  new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n * 100) + " %";

/* ------------------------------------------------------------------ */

export default function SimuladorFinanciacion({
  precio,
  isDark = false,
  tinPorPlazo = { 48: 0.0845, 60: 0.0895, 72: 0.0925, 84: 0.0955, 96: 0.0985 },
  comisionAperturaPct = 0.0125,
  vfgPct = 0.32,
  entradaPorDefectoPct = 0.2,
  entradaMaxPct = 0.75,
  plazoPorDefecto = 60,
  onSolicitar,
  onCuotaChange,
}) {
  // Paleta CarsWise AI, adaptada a claro/oscuro
  const C = {
    amber: "#BA7517",
    teal: isDark ? "#5eead4" : "#137370",
    ink: isDark ? "#f1f5f9" : "#1B1B18",
    muted: isDark ? "#94a3b8" : "#6B6A64",
    line: isDark ? "rgba(148,163,184,0.18)" : "#E7E5DE",
    surface: isDark ? "rgba(15,23,42,0.45)" : "#FFFFFF",
    surfaceAlt: isDark ? "rgba(255,255,255,0.04)" : "#F7F6F2",
  };

  const plazos = Object.keys(tinPorPlazo).map(Number).sort((a, b) => a - b);
  const [entrada, setEntrada] = useState(
    Math.round((precio * entradaPorDefectoPct) / 100) * 100
  );
  const [meses, setMeses] = useState(plazoPorDefecto);
  const [conVfg, setConVfg] = useState(false);

  const r = useMemo(() => {
    const tin = tinPorPlazo[meses];
    const capital = Math.max(precio - entrada, 0);
    const comision = capital * comisionAperturaPct;
    const financiado = capital + comision;
    const valorFinal = conVfg ? precio * vfgPct : 0;
    const cuota = calcularCuota({ capital: financiado, tinAnual: tin, meses, valorFinal });
    const intereses = cuota * meses + valorFinal - financiado;
    const tae = calcularTae({ importeNeto: capital, cuota, meses, valorFinal });
    return { tin, capital, comision, financiado, valorFinal, cuota, intereses, tae };
  }, [precio, entrada, meses, conVfg, comisionAperturaPct, vfgPct, tinPorPlazo]);

  // Notifica hacia arriba para pintar el "o X €/mes" junto al precio
  useEffect(() => {
    onCuotaChange?.(r.cuota);
  }, [r.cuota, onCuotaChange]);

  const entradaMax = Math.round((precio * entradaMaxPct) / 100) * 100;
  const entradaPctNum = precio > 0 ? Math.round((entrada / precio) * 100) : 0;

  return (
    <section
      id="financiacion"
      style={{
        borderRadius: 14,
        border: `1px solid ${C.line}`,
        background: C.surface,
        padding: 20,
      }}
      aria-labelledby="fin-titulo"
    >
      <header style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden="true">🧮</span>
        <div>
          <h2 id="fin-titulo" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.ink }}>
            Calcula tu cuota mensual
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: C.muted }}>
            Estimación orientativa, sin compromiso ni consulta de solvencia.
          </p>
        </div>
      </header>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0,3fr) minmax(0,2fr)" }} className="fin-grid">
        {/* Controles */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <label htmlFor="fin-entrada" style={{ fontSize: 13, color: C.muted }}>Entrada</label>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{eur(entrada)}</span>
          </div>
          <input
            id="fin-entrada"
            type="range"
            min={0}
            max={entradaMax}
            step={100}
            value={entrada}
            onChange={(e) => setEntrada(Number(e.target.value))}
            style={{ width: "100%", cursor: "pointer", accentColor: C.amber }}
            aria-valuetext={`${eur(entrada)}, ${entradaPctNum} por ciento del precio`}
          />
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>
            {entradaPctNum} % del precio · financias {eur(r.capital)}
          </p>

          <p style={{ margin: "20px 0 8px", fontSize: 13, color: C.muted }}>Plazo</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} role="group" aria-label="Plazo en meses">
            {plazos.map((m) => {
              const activo = m === meses;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMeses(m)}
                  aria-pressed={activo}
                  style={{
                    flex: 1,
                    minWidth: 56,
                    borderRadius: 10,
                    border: `1px solid ${activo ? C.amber : C.line}`,
                    background: activo ? C.amber : "transparent",
                    color: activo ? "#FFFFFF" : C.ink,
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "background-color .15s, border-color .15s",
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 20, cursor: "pointer", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={conVfg}
              onChange={(e) => setConVfg(e.target.checked)}
              style={{ marginTop: 3, accentColor: C.amber }}
            />
            <span style={{ color: C.ink }}>
              Cuota final aplazada
              <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>
                Pagas menos cada mes. Al terminar decides: cambiar de coche, devolverlo o pagar
                la cuota final y quedártelo.
              </span>
            </span>
          </label>
        </div>

        {/* Resultado */}
        <div style={{ borderRadius: 12, padding: 16, background: C.surfaceAlt }}>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Cuota estimada</p>
          <p style={{ margin: "0 0 14px", color: C.ink }}>
            <span style={{ fontSize: 30, fontWeight: 800 }}>
              {new Intl.NumberFormat("es-ES").format(Math.round(r.cuota))}
            </span>
            <span style={{ fontSize: 16, color: C.muted }}> €/mes</span>
          </p>

          <dl style={{ margin: 0, fontSize: 12 }}>
            {[
              ["Importe financiado", eur(r.financiado)],
              ["Comisión de apertura", eur(r.comision)],
              ["Intereses totales", eur(r.intereses)],
              ["Cuota final", r.valorFinal ? eur(r.valorFinal) : "—"],
              ["TIN", pct(r.tin)],
              ["TAE", pct(r.tae)],
            ].map(([k, val]) => (
              <div
                key={k}
                style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.line}`, padding: "8px 0" }}
              >
                <dt style={{ color: C.muted }}>{k}</dt>
                <dd style={{ margin: 0, color: C.ink, fontWeight: 600 }}>{val}</dd>
              </div>
            ))}
          </dl>

          <button
            type="button"
            onClick={() =>
              onSolicitar?.({
                entrada,
                meses,
                conVfg,
                cuota: Math.round(r.cuota),
                tin: r.tin,
                tae: r.tae,
              })
            }
            style={{
              marginTop: 16,
              width: "100%",
              borderRadius: 10,
              padding: "10px 0",
              border: "none",
              background: C.amber,
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Solicitar preaprobación
          </button>

          <p style={{ margin: "12px 0 0", display: "flex", gap: 8, fontSize: 11.5, lineHeight: 1.6, color: C.muted }}>
            <span aria-hidden="true">ℹ️</span>
            <span>
              Ejemplo orientativo. Financiación sujeta a estudio y aprobación de la entidad
              financiera. No constituye oferta vinculante.
            </span>
          </p>
        </div>
      </div>

      {/* En móvil, una sola columna */}
      <style>{`@media (max-width: 640px){ .fin-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}
