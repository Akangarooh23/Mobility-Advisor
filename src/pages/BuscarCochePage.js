import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SEARCH_OFFERS_API_ENDPOINT } from "../utils/apiClient";
import "./BuscarCochePage.css";

/**
 * Comprar › Buscar coche.
 *
 * Se entra y estan todas las ofertas activas, sin contestar nada. Los filtros
 * viven en la columna de la izquierda y van recortando el listado; quitarlos lo
 * devuelve. No hay boton de buscar a proposito: el listado es el resultado.
 *
 * Marca y modelo estan siempre a la vista porque son los dos que usa casi todo
 * el mundo; el resto se despliega, para que la columna no abrume de entrada.
 *
 * Los desplegables se llenan con lo que hay en las ofertas y con su recuento,
 * no con un catalogo aparte: asi nunca se ofrece una opcion que no devuelve
 * nada, y se ve cuanto queda antes de pulsarla.
 */

const POR_PAGINA = 24;

const VACIO = {
  brand: "", model: "", query: "",
  minPrice: "", maxPrice: "", minYear: "", maxYear: "",
  maxMileage: "", minPower: "",
  fuel: "", transmission: "", bodyType: "", province: "",
  sort: "recientes",
};

const TEXTOS = {
  es: {
    volver: "← Volver",
    eyebrow: "COMPRA",
    titulo: "Buscar coche",
    entrada: "Todas las ofertas del mercado que tenemos ahora mismo. Filtra por la izquierda y el listado se ajusta solo.",
    filtros: "Filtros",
    limpiar: "Quitar filtros",
    marca: "Marca", modelo: "Modelo",
    todasMarcas: "Todas las marcas", todosModelos: "Todos los modelos",
    eligeMarca: "Elige antes una marca",
    mas: "Más filtros", menos: "Menos filtros",
    buscar: "Buscar por texto", buscarPh: "Golf GTI, familiar, automático…",
    precio: "Precio (€)", anio: "Año", desde: "Desde", hasta: "Hasta",
    kmMax: "Kilómetros como máximo", cvMin: "Potencia mínima (CV)",
    combustible: "Combustible", cambio: "Cambio", carroceria: "Carrocería", provincia: "Provincia",
    cualquiera: "Cualquiera",
    orden: "Ordenar por",
    ordenes: { recientes: "Más recientes", precio_asc: "Precio: de menor a mayor", precio_desc: "Precio: de mayor a menor", km_asc: "Menos kilómetros", anio_desc: "Más nuevos" },
    ofertas: "ofertas", oferta: "oferta",
    cargando: "Buscando…",
    ninguna: "Ninguna oferta cumple estos filtros.",
    ningunaAyuda: "Prueba a quitar alguno.",
    verMas: "Ver más ofertas",
    verEn: "Ver en", km: "km", cv: "CV", alMes: "/mes",
    error: "No se han podido cargar las ofertas.",
  },
  en: {
    volver: "← Back",
    eyebrow: "BUY",
    titulo: "Find a car",
    entrada: "Every market listing we have right now. Filter on the left and the list adjusts by itself.",
    filtros: "Filters",
    limpiar: "Clear filters",
    marca: "Make", modelo: "Model",
    todasMarcas: "All makes", todosModelos: "All models",
    eligeMarca: "Pick a make first",
    mas: "More filters", menos: "Fewer filters",
    buscar: "Search by text", buscarPh: "Golf GTI, estate, automatic…",
    precio: "Price (€)", anio: "Year", desde: "From", hasta: "To",
    kmMax: "Maximum mileage", cvMin: "Minimum power (HP)",
    combustible: "Fuel", cambio: "Gearbox", carroceria: "Body", provincia: "Province",
    cualquiera: "Any",
    orden: "Sort by",
    ordenes: { recientes: "Most recent", precio_asc: "Price: low to high", precio_desc: "Price: high to low", km_asc: "Fewest miles", anio_desc: "Newest" },
    ofertas: "listings", oferta: "listing",
    cargando: "Searching…",
    ninguna: "No listing matches these filters.",
    ningunaAyuda: "Try removing one.",
    verMas: "Show more listings",
    verEn: "View on", km: "km", cv: "HP", alMes: "/mo",
    error: "The listings could not be loaded.",
  },
};

const num = (n) => (n === null || n === undefined ? "" : Number(n).toLocaleString("es-ES"));

export default function BuscarCochePage({ onGoBack, uiLanguage = "es" }) {
  const t = uiLanguage === "en" ? TEXTOS.en : TEXTOS.es;

  const [filtros, setFiltros] = useState(VACIO);
  const [abierto, setAbierto] = useState(false);
  const [ofertas, setOfertas] = useState([]);
  const [total, setTotal] = useState(null);
  const [desde, setDesde] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [marcas, setMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [extra, setExtra] = useState({ combustible: [], cambio: [], carroceria: [], provincia: [] });

  const peticion = useRef(0);

  const parametros = useCallback((extraParams = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filtros, ...extraParams })) {
      if (v !== "" && v !== null && v !== undefined) p.set(k, String(v));
    }
    return p;
  }, [filtros]);

  // ── Listado ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const mio = ++peticion.current;
    setCargando(true);
    setError("");
    const p = parametros({ limit: POR_PAGINA, offset: desde });
    fetch(`${SEARCH_OFFERS_API_ENDPOINT}?${p}`)
      .then((r) => r.json())
      .then((d) => {
        if (mio !== peticion.current) return;   // llegó una respuesta vieja
        if (!d?.ok) { setError(d?.error || t.error); return; }
        setTotal(d.total);
        setOfertas((prev) => (desde === 0 ? d.ofertas : [...prev, ...d.ofertas]));
      })
      .catch(() => { if (mio === peticion.current) setError(t.error); })
      .finally(() => { if (mio === peticion.current) setCargando(false); });
  }, [parametros, desde, t.error]);

  // ── Marcas: dependen del resto de filtros, no de la marca elegida ────────
  useEffect(() => {
    const p = parametros({ facets: "brands", brand: "", model: "" });
    fetch(`${SEARCH_OFFERS_API_ENDPOINT}?${p}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setMarcas(d.marcas || []); })
      .catch(() => {});
  }, [parametros]);

  // ── Modelos: solo cuando hay marca ───────────────────────────────────────
  useEffect(() => {
    if (!filtros.brand) { setModelos([]); return; }
    const p = parametros({ facets: "models", model: "" });
    fetch(`${SEARCH_OFFERS_API_ENDPOINT}?${p}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setModelos(d.modelos || []); })
      .catch(() => {});
  }, [parametros, filtros.brand]);

  // ── El resto de desplegables, solo si están a la vista ───────────────────
  useEffect(() => {
    if (!abierto) return;
    const p = parametros({ facets: "extra" });
    fetch(`${SEARCH_OFFERS_API_ENDPOINT}?${p}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setExtra({ combustible: d.combustible || [], cambio: d.cambio || [], carroceria: d.carroceria || [], provincia: d.provincia || [] }); })
      .catch(() => {});
  }, [parametros, abierto]);

  const cambiar = (campo, valor) => {
    setDesde(0);
    setFiltros((f) => {
      // Cambiar de marca invalida el modelo elegido: seguir con el anterior
      // devolveria cero resultados sin decir por que.
      if (campo === "brand") return { ...f, brand: valor, model: "" };
      return { ...f, [campo]: valor };
    });
  };

  const hayFiltros = useMemo(
    () => Object.entries(filtros).some(([k, v]) => k !== "sort" && v !== ""),
    [filtros]
  );

  const Desplegable = ({ etiqueta, campo, opciones, vacio, deshabilitado }) => (
    <label className="bc-campo">
      <span>{etiqueta}</span>
      <select
        value={filtros[campo]}
        disabled={deshabilitado}
        onChange={(e) => cambiar(campo, e.target.value)}
      >
        <option value="">{vacio}</option>
        {opciones.map((o) => (
          <option key={o.nombre} value={o.nombre}>{o.nombre} ({num(o.n)})</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="bc-root">
      <div className="bc-ancho">
        <button type="button" className="bc-volver" onClick={onGoBack}>{t.volver}</button>
        <p className="bc-eyebrow">{t.eyebrow}</p>
        <h1 className="bc-titulo">{t.titulo}</h1>
        <p className="bc-entrada">{t.entrada}</p>

        <div className="bc-columnas">
          {/* ── Filtros ── */}
          <aside className="bc-filtros">
            <div className="bc-filtros-cabecera">
              <h2>{t.filtros}</h2>
              {hayFiltros && (
                <button type="button" onClick={() => { setFiltros({ ...VACIO, sort: filtros.sort }); setDesde(0); }}>
                  {t.limpiar}
                </button>
              )}
            </div>

            <Desplegable etiqueta={t.marca} campo="brand" opciones={marcas} vacio={t.todasMarcas} />
            <Desplegable
              etiqueta={t.modelo} campo="model" opciones={modelos}
              vacio={filtros.brand ? t.todosModelos : t.eligeMarca}
              deshabilitado={!filtros.brand}
            />

            <button type="button" className="bc-mas" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
              {abierto ? t.menos : t.mas}
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                   style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                <path d="m6 9.5 6 6 6-6" />
              </svg>
            </button>

            {abierto && (
              <div className="bc-mas-panel">
                <label className="bc-campo">
                  <span>{t.buscar}</span>
                  <input value={filtros.query} placeholder={t.buscarPh}
                         onChange={(e) => cambiar("query", e.target.value)} />
                </label>

                <div className="bc-rango">
                  <span>{t.precio}</span>
                  <div>
                    <input inputMode="numeric" placeholder={t.desde} value={filtros.minPrice}
                           onChange={(e) => cambiar("minPrice", e.target.value.replace(/[^0-9]/g, ""))} />
                    <input inputMode="numeric" placeholder={t.hasta} value={filtros.maxPrice}
                           onChange={(e) => cambiar("maxPrice", e.target.value.replace(/[^0-9]/g, ""))} />
                  </div>
                </div>

                <div className="bc-rango">
                  <span>{t.anio}</span>
                  <div>
                    <input inputMode="numeric" maxLength={4} placeholder={t.desde} value={filtros.minYear}
                           onChange={(e) => cambiar("minYear", e.target.value.replace(/[^0-9]/g, ""))} />
                    <input inputMode="numeric" maxLength={4} placeholder={t.hasta} value={filtros.maxYear}
                           onChange={(e) => cambiar("maxYear", e.target.value.replace(/[^0-9]/g, ""))} />
                  </div>
                </div>

                <label className="bc-campo">
                  <span>{t.kmMax}</span>
                  <input inputMode="numeric" placeholder="150000" value={filtros.maxMileage}
                         onChange={(e) => cambiar("maxMileage", e.target.value.replace(/[^0-9]/g, ""))} />
                </label>

                <label className="bc-campo">
                  <span>{t.cvMin}</span>
                  <input inputMode="numeric" placeholder="90" value={filtros.minPower}
                         onChange={(e) => cambiar("minPower", e.target.value.replace(/[^0-9]/g, ""))} />
                </label>

                <Desplegable etiqueta={t.combustible} campo="fuel" opciones={extra.combustible} vacio={t.cualquiera} />
                <Desplegable etiqueta={t.cambio} campo="transmission" opciones={extra.cambio} vacio={t.cualquiera} />
                <Desplegable etiqueta={t.carroceria} campo="bodyType" opciones={extra.carroceria} vacio={t.cualquiera} />
                <Desplegable etiqueta={t.provincia} campo="province" opciones={extra.provincia} vacio={t.cualquiera} />
              </div>
            )}
          </aside>

          {/* ── Resultados ── */}
          <section className="bc-resultados">
            <div className="bc-barra">
              <p className="bc-total">
                {total === null
                  ? t.cargando
                  : <><b>{num(total)}</b> {total === 1 ? t.oferta : t.ofertas}</>}
              </p>
              <label className="bc-orden">
                <span>{t.orden}</span>
                <select value={filtros.sort} onChange={(e) => cambiar("sort", e.target.value)}>
                  {Object.entries(t.ordenes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>

            {error ? <p className="bc-error">{error}</p> : null}

            {!error && total === 0 && !cargando ? (
              <div className="bc-vacio"><b>{t.ninguna}</b><span>{t.ningunaAyuda}</span></div>
            ) : null}

            <div className="bc-rejilla">
              {ofertas.map((o) => (
                <article key={o.id} className="bc-oferta">
                  <div className="bc-foto">
                    {o.imagen
                      ? <img src={o.imagen} alt="" loading="lazy" />
                      : <div className="bc-sinfoto" aria-hidden="true" />}
                    {o.portal ? <span className="bc-portal">{o.portal}</span> : null}
                  </div>
                  <div className="bc-cuerpo">
                    <h3>{o.marca} {o.modelo}</h3>
                    {o.version ? <p className="bc-version">{o.version}</p> : null}
                    <p className="bc-datos">
                      {[o.anio, o.km !== null ? `${num(o.km)} ${t.km}` : "", o.potencia ? `${o.potencia} ${t.cv}` : "", o.combustible, o.cambio]
                        .filter(Boolean).join(" · ")}
                    </p>
                    <div className="bc-pie">
                      <div className="bc-precio">
                        {o.precio !== null ? <b>{num(o.precio)} €</b> : <b>—</b>}
                        {o.precioMensual ? <small>{num(o.precioMensual)} €{t.alMes}</small> : null}
                      </div>
                      {o.url ? (
                        <a href={o.url} target="_blank" rel="noopener noreferrer">{t.verEn} {o.portal || "el portal"} →</a>
                      ) : null}
                    </div>
                    {o.provincia ? <p className="bc-provincia">{o.provincia}</p> : null}
                  </div>
                </article>
              ))}
            </div>

            {cargando ? <p className="bc-cargando">{t.cargando}</p> : null}

            {!cargando && total !== null && ofertas.length < total ? (
              <button type="button" className="bc-verMas" onClick={() => setDesde(ofertas.length)}>
                {t.verMas}
              </button>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
