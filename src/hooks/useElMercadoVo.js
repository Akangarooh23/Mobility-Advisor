import { useCallback, useEffect, useState } from "react";
import { getMarketplaceVoJson, rutaApi } from "../utils/apiClient";
import { INITIAL_PORTAL_VO_FILTERS } from "../utils/portalVoHelpers";
import { trackFunnelEvent } from "../utils/funnelTracker";

/**
 * El mercado de VO: los filtros, la página que se está viendo, las ofertas que
 * han llegado y las que ya están reservadas.
 *
 * ## Qué había
 *
 * Nueve `useState` en `App`, la función que pide una página, tres efectos y dos
 * manejadores, repartidos por seiscientas líneas. Y el número de página y las
 * ofertas se movían por separado.
 *
 * ## El número de página subía antes de que llegara la página
 *
 * `goToMarketplacePage` hacía `setMarketplaceVoPage(page)` y **después** pedía
 * la página. Si la petición fallaba, el aviso de «no se ha podido cargar» solo
 * se ponía cuando `page === 0`; en cualquier otra, las ofertas se quedaban como
 * estaban -a propósito, para no vaciar la pantalla- **pero el número ya había
 * subido**.
 *
 * El paginador resalta la página actual -`isActive = page === currentPage`, en
 * `PortalVoMarketplacePage`. Así que quien pulsaba «3» y tenía mala suerte se
 * quedaba mirando los quince coches de la página 2 con el 3 resaltado, sin un
 * solo aviso. Los coches eran reales; la página, mentira.
 *
 * Ahora el número lo mueve la respuesta, no el clic: `goToMarketplacePage` pide
 * primero y solo se queda con la página **si la página ha llegado**. Si falla,
 * se queda donde estaba, con lo que ya había, y el número dice la verdad.
 *
 * Lo que sigue faltando, y no se inventa aquí: un aviso visible cuando falla
 * una página que no es la primera. Hoy el clic simplemente no hace nada, que es
 * peor que un aviso y mejor que una mentira.
 *
 * ## `portalVoOffersLive` tiene dos usos, y por eso no se vacía
 *
 * Es la lista paginada **y** el sitio donde se deja la oferta de un enlace
 * directo a una ficha, para que la ficha pueda leerla sin pedir la página
 * entera -que además haría bucle con el efecto de la ruta. Esa segunda parte
 * estaba escrita dos veces, con el mismo cuerpo, una para VO y otra para
 * importación; ahora es `metePorDelante`.
 */

/** Cuántas ofertas trae una página. La pantalla usa el mismo número. */
export const MARKETPLACE_PAGE_SIZE = 15;

export function useElMercadoVo({ entryMode, currentUser } = {}) {
  const [portalVoFilters, setPortalVoFilters] = useState({ ...INITIAL_PORTAL_VO_FILTERS });
  const [portalVoModalityMode, setPortalVoModalityMode] = useState("compra");

  const [portalVoOffersLive, setPortalVoOffersLive] = useState([]);
  const [marketplaceVoPage, setMarketplaceVoPage] = useState(0);
  const [marketplaceVoTotal, setMarketplaceVoTotal] = useState(0);
  const [marketplaceVoLoading, setMarketplaceVoLoading] = useState(false);
  /*
   * «No hay ofertas» y «no he podido cargarlas» son cosas distintas y hasta
   * ahora se pintaban igual: lista vacía. Con la base caída, la web invitaba a
   * crear una alerta para coches que sí existían.
   */
  const [marketplaceVoUnavailable, setMarketplaceVoUnavailable] = useState(false);

  const [reservedVoUrls, setReservedVoUrls] = useState(new Set());
  const [reservedMarketplaceIds, setReservedMarketplaceIds] = useState(new Set());

  /**
   * Pide una página y dice si llegó.
   *
   * Devolver algo es lo que permite que el número de página lo mueva la
   * respuesta: antes no devolvía nada y quien llamaba no podía saberlo.
   */
  const fetchMarketplaceVoPage = useCallback(async (
    page = 0,
    filters = portalVoFilters,
    modality = portalVoModalityMode
  ) => {
    setMarketplaceVoLoading(true);
    try {
      const offset = page * MARKETPLACE_PAGE_SIZE;
      const params = {
        offset,
        limit: MARKETPLACE_PAGE_SIZE,
        ...filters,
        modalityMode: modality,
        exclude_seller_type: "concesionario,importador",
      };
      const { data } = await getMarketplaceVoJson(params);
      const apiOffers = Array.isArray(data?.offers) ? data.offers : [];
      const source = String(data?.source || "").toLowerCase();
      const isDedicatedSource = source === "postgres-marketplace-table";

      if (isDedicatedSource) {
        setPortalVoOffersLive(apiOffers);
        setMarketplaceVoTotal(Number(data?.totalUniverse || apiOffers.length));
        setMarketplaceVoUnavailable(false);
        return true;
      }

      if (page === 0) {
        setPortalVoOffersLive([]);
        setMarketplaceVoTotal(0);
        /*
         * Llegar aquí ya significaba que algo había fallado -el `source` no era
         * el bueno- pero se pintaba igual que una búsqueda sin resultados.
         */
        setMarketplaceVoUnavailable(true);
      }
      return false;
    } catch {
      if (page === 0) {
        setPortalVoOffersLive([]);
        setMarketplaceVoTotal(0);
        setMarketplaceVoUnavailable(true);
      }
      return false;
    } finally {
      setMarketplaceVoLoading(false);
    }
  }, [portalVoFilters, portalVoModalityMode]);

  /**
   * Va a una página: primero se pide, y el número se mueve solo si llegó.
   *
   * Al revés -que es como estaba- el paginador resalta una página cuyas ofertas
   * no están debajo.
   */
  const goToMarketplacePage = useCallback(async (page) => {
    if (marketplaceVoLoading) return;
    const haLlegado = await fetchMarketplaceVoPage(page, portalVoFilters, portalVoModalityMode);
    if (!haLlegado) return;
    setMarketplaceVoPage(page);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [marketplaceVoLoading, fetchMarketplaceVoPage, portalVoFilters, portalVoModalityMode]);

  /**
   * Cambia entre compra y renting: es otro catálogo, así que se vuelve a la
   * primera página.
   *
   * La modalidad se pasa a mano porque el estado todavía no la tiene: dejarlo
   * al valor por omisión pediría el catálogo anterior.
   */
  const handleMarketplaceModalityChange = useCallback((newModality) => {
    setPortalVoModalityMode(newModality);
    setMarketplaceVoPage(0);
    fetchMarketplaceVoPage(0, portalVoFilters, newModality);
  }, [fetchMarketplaceVoPage, portalVoFilters]);

  /** Los filtros recién puestos. Estaba escrito igual en tres sitios. */
  const empiezaSinFiltros = useCallback(() => {
    setPortalVoFilters({ ...INITIAL_PORTAL_VO_FILTERS });
  }, []);

  /**
   * Deja una oferta al principio de la lista si no estaba.
   *
   * Es para los enlaces directos a una ficha: la ficha lee de esta lista, y
   * pedir la página entera haría bucle con el efecto de la ruta. Estaba escrito
   * dos veces -una para VO y otra para importación- con el mismo cuerpo.
   */
  const metePorDelante = useCallback((offer) => {
    if (!offer?.id) return;
    setPortalVoOffersLive((prev) => (prev.some((o) => o.id === offer.id) ? prev : [offer, ...prev]));
  }, []);

  /* Se entra al mercado, o cambian los filtros: se vuelve a la primera. */
  useEffect(() => {
    if (entryMode !== "portalVo") return;
    setMarketplaceVoPage(0);
    fetchMarketplaceVoPage(0, portalVoFilters);
    trackFunnelEvent({
      event_type: "marketplace_view",
      user_id: currentUser?.id || null,
      user_email: currentUser?.email || null,
    });
    /*
     * `fetchMarketplaceVoPage` se deja fuera a propósito: cambia de identidad
     * con los filtros, así que enumerarlo aquí volvería a pedir la página por
     * cada cambio de la función, no por cada cambio de filtro.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryMode, portalVoFilters]);

  /* Cuáles están ya reservadas, para no ofrecer una visita sobre ellas. */
  useEffect(() => {
    if (entryMode !== "portalVo" && entryMode !== "portalVoDetail") return;
    fetch(rutaApi("/api/leads?reserved=1"))
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        if (Array.isArray(d.reservedUrls)) setReservedVoUrls(new Set(d.reservedUrls));
        if (Array.isArray(d.reservedMarketplaceIds)) setReservedMarketplaceIds(new Set(d.reservedMarketplaceIds));
      })
      .catch(() => {});
  }, [entryMode]);

  /* Y al volver a la pestaña se repite la página actual: puede haber cambiado
     en el ERP mientras no se miraba. */
  useEffect(() => {
    if (entryMode !== "portalVo") return undefined;
    const alVolver = () => fetchMarketplaceVoPage(marketplaceVoPage, portalVoFilters);
    window.addEventListener("focus", alVolver);
    return () => window.removeEventListener("focus", alVolver);
  }, [entryMode, marketplaceVoPage, portalVoFilters, fetchMarketplaceVoPage]);

  return {
    portalVoFilters, setPortalVoFilters,
    portalVoModalityMode, setPortalVoModalityMode,
    portalVoOffersLive, setPortalVoOffersLive,
    marketplaceVoPage, setMarketplaceVoPage,
    marketplaceVoTotal, setMarketplaceVoTotal,
    marketplaceVoLoading, setMarketplaceVoLoading,
    marketplaceVoUnavailable, setMarketplaceVoUnavailable,
    reservedVoUrls, setReservedVoUrls,
    reservedMarketplaceIds, setReservedMarketplaceIds,

    fetchMarketplaceVoPage,
    goToMarketplacePage,
    handleMarketplaceModalityChange,
    empiezaSinFiltros,
    metePorDelante,
  };
}
