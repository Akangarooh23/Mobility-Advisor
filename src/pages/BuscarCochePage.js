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
    masMarcas: "──── Más marcas ────", masModelos: "──── Más modelos ────",
    eligeMarca: "Elige antes una marca",
    filtrarPh: "Escribe para filtrar…", nadaCoincide: "Nada coincide",
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
    verFicha: "Ver ficha", km: "km", cv: "CV", alMes: "/mes",
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
    masMarcas: "──── More makes ────", masModelos: "──── More models ────",
    eligeMarca: "Pick a make first",
    filtrarPh: "Type to filter…", nadaCoincide: "No matches",
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
    verFicha: "View details", km: "km", cv: "HP", alMes: "/mo",
    error: "The listings could not be loaded.",
  },
};

function num(n) {
  if (n === null || n === undefined || n === "") return "";
  const s = String(Math.round(Number(n)));
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ".";
    out += s[i];
  }
  return out;
}

/**
 * Un desplegable de filtro. Vive fuera del componente a proposito.
 *
 * No es un <select>. Con un desplegable nativo el navegador decide donde pone
 * la lista, y con 472 marcas la abria ocupando la pantalla entera hacia arriba,
 * tapando el filtro que acababas de pulsar. Eso no se corrige desde CSS: la
 * lista nativa no la dibuja la pagina. Asi que la dibujamos nosotros, anclada
 * debajo del campo y con su propio alto.
 *
 * Cambiar el nativo por uno propio obliga a devolver lo que el nativo ya traia,
 * o el remedio empeora la enfermedad: escribir para buscar, recorrer con las
 * flechas, Intro para elegir, Escape para cerrar y los papeles de accesibilidad
 * que lee un lector de pantalla. Con cientos de opciones, escribir para filtrar
 * no es un anadido: sin eso una lista de 472 nombres no hay quien la use.
 */
export function Desplegable({
  etiqueta, valor, conOfertas, sinOfertas, separador, vacio,
  deshabilitado, onChange, filtrarPh, nadaCoincide,
}) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [activo, setActivo] = useState(0);
  const caja = useRef(null);
  const entrada = useRef(null);
  const lista = useRef(null);

  // Las dos mitades —con ofertas y sin ellas— viajan juntas en una sola lista
  // para que las flechas recorran exactamente lo que se ve, separador incluido.
  const opciones = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const pasa = (o) => !q || String(o.nombre).toLowerCase().includes(q);
    const con = (conOfertas || []).filter(pasa);
    const sin = (sinOfertas || []).filter(pasa);

    const salida = [];
    if (!q) salida.push({ valor: "", texto: vacio, n: null });
    con.forEach((o) => salida.push({ valor: o.nombre, texto: o.nombre, n: o.n }));
    sin.forEach((o, i) => salida.push({ valor: o.nombre, texto: o.nombre, n: 0, separa: i === 0 }));
    return salida;
  }, [conOfertas, sinOfertas, filtro, vacio]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setFiltro("");
    setActivo(0);
  }, []);

  const elegir = useCallback((v) => {
    onChange(v);
    cerrar();
  }, [onChange, cerrar]);

  // Quitar la marca deshabilita el modelo. Si su lista estaba abierta se queda
  // abierta, y desde ahi se puede elegir un modelo sin marca: un filtro que la
  // pantalla no sabe representar. Se cierra sola.
  useEffect(() => {
    if (deshabilitado) cerrar();
  }, [deshabilitado, cerrar]);

  // Pulsar fuera cierra. Sin esto la lista se queda abierta mientras miras el
  // listado de coches, tapandolo.
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) cerrar(); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto, cerrar]);

  // La opcion marcada tiene que verse aunque se llegue a ella con el teclado.
  useEffect(() => {
    if (!abierto || !lista.current) return;
    const el = lista.current.querySelector('[data-activo="si"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [activo, abierto]);

  const teclas = (e) => {
    if (deshabilitado) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) { setAbierto(true); return; }
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setActivo((i) => {
        if (!opciones.length) return 0;
        return (i + paso + opciones.length) % opciones.length;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (abierto && opciones[activo]) elegir(opciones[activo].valor);
      else setAbierto(true);
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); cerrar(); }
    if (e.key === "Home" && abierto) { e.preventDefault(); setActivo(0); }
    if (e.key === "End" && abierto) { e.preventDefault(); setActivo(Math.max(0, opciones.length - 1)); }
  };

  return (
    <div className="bc-campo bc-combo" ref={caja}>
      <span id={"lbl-" + etiqueta}>{etiqueta}</span>

      <div className="bc-combo-caja">
        <input
          ref={entrada}
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={"lista-" + etiqueta}
          aria-labelledby={"lbl-" + etiqueta}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={deshabilitado}
          placeholder={abierto ? filtrarPh : vacio}
          value={abierto ? filtro : (valor || "")}
          onFocus={() => { if (!deshabilitado) setAbierto(true); }}
          onClick={() => { if (!deshabilitado) setAbierto(true); }}
          onChange={(e) => {
            if (deshabilitado) return;
            setFiltro(e.target.value); setActivo(0); setAbierto(true);
          }}
          onKeyDown={teclas}
        />
        {valor && !deshabilitado ? (
          <button
            type="button"
            className="bc-combo-x"
            aria-label={vacio}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => elegir("")}
          >
            ×
          </button>
        ) : null}
        <svg className="bc-combo-flecha" viewBox="0 0 24 24" width="14" height="14" fill="none"
             stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
             style={{ transform: abierto ? "rotate(180deg)" : "none" }}>
          <path d="m6 9.5 6 6 6-6" />
        </svg>
      </div>

      {abierto ? (
        <ul className="bc-combo-lista" id={"lista-" + etiqueta} role="listbox" ref={lista}>
          {opciones.length === 0 ? (
            <li className="bc-combo-nada">{nadaCoincide}</li>
          ) : (
            opciones.map((o, i) => (
              <React.Fragment key={(o.separa ? "s-" : "c-") + o.valor + "-" + i}>
                {/* El corte es un rotulo, no una opcion: ni se pulsa ni lo
                    recorren las flechas ni lo anuncia un lector. */}
                {o.separa ? <li className="bc-combo-sep" role="presentation">{separador}</li> : null}
                <li
                  role="option"
                  aria-selected={o.valor === valor}
                  data-activo={i === activo ? "si" : "no"}
                  className={
                    "bc-combo-op" +
                    (i === activo ? " es-activa" : "") +
                    (o.valor === valor ? " es-elegida" : "")
                  }
                  onMouseEnter={() => setActivo(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegir(o.valor)}
                >
                  <span>{o.texto}</span>
                  {o.n !== null ? <b>{num(o.n)}</b> : null}
                </li>
              </React.Fragment>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default function BuscarCochePage({ onGoBack, onOpenOffer, uiLanguage = "es" }) {
  const t = uiLanguage === "en" ? TEXTOS.en : TEXTOS.es;

  const [filtros, setFiltros] = useState(VACIO);
  const [abierto, setAbierto] = useState(false);
  const [ofertas, setOfertas] = useState([]);
  const [total, setTotal] = useState(null);
  const [desde, setDesde] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [marcas, setMarcas] = useState({ conOfertas: [], sinOfertas: [] });
  const [modelos, setModelos] = useState({ conOfertas: [], sinOfertas: [] });
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
      .then((d) => { if (d?.ok) setMarcas({ conOfertas: d.conOfertas || [], sinOfertas: d.sinOfertas || [] }); })
      .catch(() => {});
  }, [parametros]);

  // ── Modelos: solo cuando hay marca ───────────────────────────────────────
  useEffect(() => {
    if (!filtros.brand) { setModelos({ conOfertas: [], sinOfertas: [] }); return; }
    const p = parametros({ facets: "models", model: "" });
    fetch(`${SEARCH_OFFERS_API_ENDPOINT}?${p}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setModelos({ conOfertas: d.conOfertas || [], sinOfertas: d.sinOfertas || [] }); })
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

            <Desplegable
              etiqueta={t.marca} valor={filtros.brand}
              conOfertas={marcas.conOfertas} sinOfertas={marcas.sinOfertas}
              separador={t.masMarcas} vacio={t.todasMarcas}
              filtrarPh={t.filtrarPh} nadaCoincide={t.nadaCoincide}
              onChange={(v) => cambiar("brand", v)}
            />
            <Desplegable
              etiqueta={t.modelo} valor={filtros.model}
              conOfertas={modelos.conOfertas} sinOfertas={modelos.sinOfertas}
              separador={t.masModelos}
              vacio={filtros.brand ? t.todosModelos : t.eligeMarca}
              deshabilitado={!filtros.brand}
              filtrarPh={t.filtrarPh} nadaCoincide={t.nadaCoincide}
              onChange={(v) => cambiar("model", v)}
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

                <Desplegable etiqueta={t.combustible} valor={filtros.fuel} conOfertas={extra.combustible} vacio={t.cualquiera} onChange={(v) => cambiar("fuel", v)} />
                <Desplegable etiqueta={t.cambio} valor={filtros.transmission} conOfertas={extra.cambio} vacio={t.cualquiera} onChange={(v) => cambiar("transmission", v)} />
                <Desplegable etiqueta={t.carroceria} valor={filtros.bodyType} conOfertas={extra.carroceria} vacio={t.cualquiera} onChange={(v) => cambiar("bodyType", v)} />
                <Desplegable etiqueta={t.provincia} valor={filtros.province} conOfertas={extra.provincia} vacio={t.cualquiera} onChange={(v) => cambiar("province", v)} />
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
                <article
                  key={o.id}
                  className="bc-oferta"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenOffer && onOpenOffer(o)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenOffer && onOpenOffer(o); }
                  }}
                >
                  <div className="bc-foto">
                    {o.image
                      ? <img src={o.image} alt="" loading="lazy" />
                      : <div className="bc-sinfoto" aria-hidden="true" />}
                    {o.portal ? <span className="bc-portal">{o.portal}</span> : null}
                  </div>
                  <div className="bc-cuerpo">
                    <h3>{o.brand} {o.model}</h3>
                    {o.version ? <p className="bc-version">{o.version}</p> : null}
                    <p className="bc-datos">
                      {[o.year, o.mileage !== null ? `${num(o.mileage)} ${t.km}` : "", o.powerCv ? `${o.powerCv} ${t.cv}` : "", o.fuel, o.transmission]
                        .filter(Boolean).join(" · ")}
                    </p>
                    <div className="bc-pie">
                      <div className="bc-precio">
                        {o.price !== null ? <b>{num(o.price)} €</b> : <b>—</b>}
                        {o.monthlyPrice ? <small>{num(o.monthlyPrice)} €{t.alMes}</small> : null}
                      </div>
                      <span className="bc-ver">{t.verFicha} →</span>
                    </div>
                    {o.province ? <p className="bc-provincia">{o.province}</p> : null}
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
