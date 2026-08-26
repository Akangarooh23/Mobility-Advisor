import React, { useState } from "react";
import { COMPARE_CARS_API_ENDPOINT } from "../utils/apiClient";
import "./ComparadorPage.css";

/**
 * Comparador de coches.
 *
 * Se añaden hasta cinco vehículos de uno en uno y se pide a la IA que los
 * puntúe y diga cuál conviene. Marca y modelo son obligatorios; versión,
 * potencia y año son opcionales, porque quien está comparando muchas veces
 * todavía no los tiene decididos, y exigirlos le echaría de la pantalla.
 *
 * La comparación es sobre datos generales del modelo, no sobre las unidades
 * concretas que esté mirando el usuario. Eso lo dice la pantalla antes de
 * comparar y lo repite con el resultado: un comparador que da un ganador sin
 * decir sobre qué compara invita a confiar más de lo que puede sostener.
 */

const MAXIMO = 5;

const TEXTOS = {
  es: {
    volver: "← Volver",
    eyebrow: "COMPARA",
    titulo: "Compara entre varias opciones",
    entrada: "Añade hasta cinco coches que estés valorando y te decimos cuál conviene más y por qué. Uno a uno: marca y modelo bastan para empezar.",
    marca: "Marca", modelo: "Modelo", version: "Versión", cv: "Potencia (CV)", anio: "Año",
    marcaPh: "Volkswagen", modeloPh: "T-Roc", versionPh: "R-Line", cvPh: "150", anioPh: "2022",
    anadir: "Añadir a la comparación",
    listaTitulo: "En la comparación",
    listaVacia: "Todavía no has añadido ningún coche.",
    quitar: "Quitar",
    lleno: "Ya son cinco, el máximo. Quita alguno si quieres cambiarlo.",
    faltan: "Añade al menos dos coches para poder comparar.",
    faltaMarca: "Hacen falta la marca y el modelo.",
    comparar: "Comparar",
    comparando: "Comparando…",
    empezarDeCero: "Empezar de cero",
    ganador: "La mejor opción",
    criterios: "Qué se ha mirado",
    caraACara: "Cara a cara con el segundo",
    cuandoOtro: "Cuándo elegiría otro",
    limites: "Lo que esta comparación no sabe",
    puntos: "puntos",
    fuerte: "A favor",
    flojo: "En contra",
    detalle: { fiabilidad: "Fiabilidad", coste_uso: "Coste de uso", equipamiento: "Equipamiento", prestaciones: "Prestaciones", valor_reventa: "Valor de reventa" },
    avisoPrevio: "La comparación se hace sobre datos generales de cada modelo. No incluye el estado, los kilómetros ni el historial del coche que tengas delante.",
    errorGenerico: "No se ha podido completar la comparación. Inténtalo de nuevo en un momento.",
  },
  en: {
    volver: "← Back",
    eyebrow: "COMPARE",
    titulo: "Compare several options",
    entrada: "Add up to five cars you are considering and we will tell you which one suits you best, and why. One at a time: make and model are enough to start.",
    marca: "Make", modelo: "Model", version: "Trim", cv: "Power (HP)", anio: "Year",
    marcaPh: "Volkswagen", modeloPh: "T-Roc", versionPh: "R-Line", cvPh: "150", anioPh: "2022",
    anadir: "Add to comparison",
    listaTitulo: "In the comparison",
    listaVacia: "You have not added any car yet.",
    quitar: "Remove",
    lleno: "That is five, the maximum. Remove one if you want to swap it.",
    faltan: "Add at least two cars to compare.",
    faltaMarca: "Make and model are required.",
    comparar: "Compare",
    comparando: "Comparing…",
    empezarDeCero: "Start over",
    ganador: "Best option",
    criterios: "What was looked at",
    caraACara: "Head to head with the runner-up",
    cuandoOtro: "When another one would win",
    limites: "What this comparison cannot know",
    puntos: "points",
    fuerte: "For",
    flojo: "Against",
    detalle: { fiabilidad: "Reliability", coste_uso: "Running cost", equipamiento: "Equipment", prestaciones: "Performance", valor_reventa: "Resale value" },
    avisoPrevio: "The comparison uses general data for each model. It does not include the condition, mileage or history of the actual car in front of you.",
    errorGenerico: "The comparison could not be completed. Try again in a moment.",
  },
};

const VACIO = { marca: "", modelo: "", version: "", cv: "", anio: "" };

export default function ComparadorPage({ onGoHome, uiLanguage = "es" }) {
  const t = uiLanguage === "en" ? TEXTOS.en : TEXTOS.es;

  const [coches, setCoches] = useState([]);
  const [borrador, setBorrador] = useState(VACIO);
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  const lleno = coches.length >= MAXIMO;

  function anadir(e) {
    e.preventDefault();
    if (lleno) { setAviso(t.lleno); return; }
    if (!borrador.marca.trim() || !borrador.modelo.trim()) { setAviso(t.faltaMarca); return; }
    setCoches((prev) => [...prev, { ...borrador, id: `c${Date.now()}${prev.length}` }]);
    setBorrador(VACIO);
    setAviso("");
    setResultado(null);
  }

  function quitar(id) {
    setCoches((prev) => prev.filter((c) => c.id !== id));
    setAviso("");
    setResultado(null);
  }

  async function comparar() {
    if (coches.length < 2) { setAviso(t.faltan); return; }
    setCargando(true);
    setError("");
    setResultado(null);
    try {
      const r = await fetch(COMPARE_CARS_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coches, uiLanguage }),
      });
      const datos = await r.json().catch(() => null);
      if (!r.ok || !datos || !Array.isArray(datos.coches)) {
        setError(datos?.error || t.errorGenerico);
        return;
      }
      setResultado(datos);
    } catch {
      setError(t.errorGenerico);
    } finally {
      setCargando(false);
    }
  }

  const ordenados = resultado
    ? [...resultado.coches].sort((a, b) => (a.puesto || 99) - (b.puesto || 99))
    : [];

  return (
    <div className="cmp-root">
      <div className="cmp-ancho">
        <button type="button" className="cmp-volver" onClick={onGoHome}>{t.volver}</button>
        <p className="cmp-eyebrow">{t.eyebrow}</p>
        <h1 className="cmp-titulo">{t.titulo}</h1>
        <p className="cmp-entrada">{t.entrada}</p>

        <div className="cmp-panel">
          <form className="cmp-form" onSubmit={anadir}>
            <label>{t.marca}<input value={borrador.marca} placeholder={t.marcaPh}
              onChange={(e) => setBorrador({ ...borrador, marca: e.target.value })} /></label>
            <label>{t.modelo}<input value={borrador.modelo} placeholder={t.modeloPh}
              onChange={(e) => setBorrador({ ...borrador, modelo: e.target.value })} /></label>
            <label>{t.version}<input value={borrador.version} placeholder={t.versionPh}
              onChange={(e) => setBorrador({ ...borrador, version: e.target.value })} /></label>
            <label>{t.cv}<input value={borrador.cv} placeholder={t.cvPh} inputMode="numeric"
              onChange={(e) => setBorrador({ ...borrador, cv: e.target.value.replace(/[^0-9]/g, "") })} /></label>
            <label>{t.anio}<input value={borrador.anio} placeholder={t.anioPh} inputMode="numeric" maxLength={4}
              onChange={(e) => setBorrador({ ...borrador, anio: e.target.value.replace(/[^0-9]/g, "") })} /></label>
            <button type="submit" className="cmp-anadir" disabled={lleno}>{t.anadir}</button>
          </form>

          {aviso ? <p className="cmp-aviso">{aviso}</p> : null}

          <div className="cmp-lista">
            <h2>{t.listaTitulo} <span>{coches.length}/{MAXIMO}</span></h2>
            {coches.length === 0 ? (
              <p className="cmp-vacio">{t.listaVacia}</p>
            ) : (
              <ul>
                {coches.map((c) => (
                  <li key={c.id}>
                    <span>
                      <b>{c.marca} {c.modelo}</b>
                      {[c.version, c.cv ? `${c.cv} CV` : "", c.anio].filter(Boolean).join(" · ")
                        ? <small>{[c.version, c.cv ? `${c.cv} CV` : "", c.anio].filter(Boolean).join(" · ")}</small>
                        : null}
                    </span>
                    <button type="button" onClick={() => quitar(c.id)}>{t.quitar}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="cmp-previo">{t.avisoPrevio}</p>

          <div className="cmp-acciones">
            <button type="button" className="cmp-comparar" onClick={comparar} disabled={cargando || coches.length < 2}>
              {cargando ? t.comparando : t.comparar}
            </button>
            {coches.length > 0 && (
              <button type="button" className="cmp-reset" onClick={() => { setCoches([]); setResultado(null); setAviso(""); }}>
                {t.empezarDeCero}
              </button>
            )}
          </div>

          {error ? <p className="cmp-error">{error}</p> : null}
        </div>

        {resultado && (
          <section className="cmp-resultado">
            <div className="cmp-ganador">
              <span className="cmp-etiqueta">{t.ganador}</span>
              <h2>{ordenados[0]?.etiqueta}</h2>
              <p>{resultado.resumen}</p>
            </div>

            <div className="cmp-tarjetas">
              {ordenados.map((c) => (
                <article key={c.id} className={`cmp-tarjeta${c.id === resultado.ganador_id ? " es-ganador" : ""}`}>
                  <div className="cmp-cabecera">
                    <span className="cmp-puesto">{c.puesto}</span>
                    <div>
                      <h3>{c.etiqueta}</h3>
                      <p>{c.titular}</p>
                    </div>
                    <div className="cmp-nota">
                      <b>{Math.round(Number(c.puntuacion))}</b>
                      <small>{t.puntos}</small>
                    </div>
                  </div>

                  {c.detalle && (
                    <div className="cmp-barras">
                      {Object.entries(t.detalle).map(([clave, nombre]) => {
                        const v = Math.max(0, Math.min(100, Number(c.detalle[clave]) || 0));
                        return (
                          <div key={clave} className="cmp-barra">
                            <span>{nombre}</span>
                            <i><em style={{ width: `${v}%` }} /></i>
                            <b>{v}</b>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="cmp-pros">
                    {Array.isArray(c.fuerte) && c.fuerte.length > 0 && (
                      <div><h4>{t.fuerte}</h4><ul>{c.fuerte.map((x) => <li key={x}>{x}</li>)}</ul></div>
                    )}
                    {Array.isArray(c.flojo) && c.flojo.length > 0 && (
                      <div><h4>{t.flojo}</h4><ul className="es-contra">{c.flojo.map((x) => <li key={x}>{x}</li>)}</ul></div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {Array.isArray(resultado.criterios) && resultado.criterios.length > 0 && (
              <div className="cmp-bloque">
                <h3>{t.criterios}</h3>
                <ul className="cmp-criterios">{resultado.criterios.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}

            {resultado.cara_a_cara && (
              <div className="cmp-bloque"><h3>{t.caraACara}</h3><p>{resultado.cara_a_cara}</p></div>
            )}

            {Array.isArray(resultado.cuando_elegir_otro) && resultado.cuando_elegir_otro.length > 0 && (
              <div className="cmp-bloque">
                <h3>{t.cuandoOtro}</h3>
                <ul className="cmp-otros">
                  {resultado.cuando_elegir_otro.map((o, i) => {
                    const coche = resultado.coches.find((c) => c.id === o.id);
                    return <li key={`${o.id}-${i}`}><b>{coche?.etiqueta || o.id}</b>{o.motivo}</li>;
                  })}
                </ul>
              </div>
            )}

            {/* El limite va con el resultado y no solo antes de pedirlo: es
                cuando el usuario esta a punto de tomar la decision. */}
            <p className="cmp-limites"><b>{t.limites}.</b> {resultado.limites || t.avisoPrevio}</p>
          </section>
        )}
      </div>
    </div>
  );
}
