import { useEffect, useMemo, useState } from "react";
import { getVehicleCatalogJson } from "../utils/apiClient";
import { normalizeText } from "../utils/offerHelpers";
import localVehicleCatalog from "../data/vehicle-catalog.json";

function buildFallbackMarketCatalogFromOffers(offers = []) {
  const safeOffers = Array.isArray(offers) ? offers : [];

  return safeOffers.reduce((acc, offer) => {
    const brand = normalizeText(offer?.brand);
    const model = normalizeText(offer?.model);

    if (!brand || !model) {
      return acc;
    }

    if (!Array.isArray(acc[brand])) {
      acc[brand] = [];
    }

    if (!acc[brand].includes(model)) {
      acc[brand].push(model);
    }

    return acc;
  }, {});
}

/**
 * Para comparar marcas y modelos: sin mayúsculas, acentos ni espacios de más.
 *
 * Los acentos hacen falta tanto como las mayúsculas. En datos de coches
 * conviven «Citroën» y «CITROEN», «Škoda» y «Skoda», y para una cadena de texto
 * son marcas distintas — el desplegable las enseñaba por separado, cada una con
 * la mitad de los modelos.
 */
function claveComparable(valor) {
  return normalizeText(valor)
    .normalize("NFD")
    // Los diacríticos, por su código: escritos como caracteres sueltos son
    // invisibles en el editor y cualquiera los borra sin darse cuenta.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * De las formas en que viene escrita una marca, la que se le enseña al usuario.
 *
 * Las fuentes no se ponen de acuerdo: el catálogo dice «Volkswagen», la
 * cobertura de inventario «VOLKSWAGEN» y algún anuncio suelto «volkswagen» o
 * «Vw». Se prefiere la que ya viene con mayúsculas y minúsculas mezcladas, que
 * es la escrita por una persona; si solo hay gritadas o en minúscula, se
 * capitaliza a mano.
 */
function mejorNombreDeMarca(a, b) {
  if (!a) return b;
  if (!b) return a;
  const mezclada = (v) => v !== v.toUpperCase() && v !== v.toLowerCase();
  if (mezclada(a) && !mezclada(b)) return a;
  if (mezclada(b) && !mezclada(a)) return b;
  return a.length >= b.length ? a : b;
}

function capitalizar(valor) {
  if (valor !== valor.toUpperCase() && valor !== valor.toLowerCase()) return valor;
  return valor
    .toLowerCase()
    .replace(/(^|[\s-])([a-záéíóúñ])/g, (_, sep, letra) => sep + letra.toUpperCase());
}

/**
 * Fusiona dos catálogos agrupando por marca **sin distinguir mayúsculas**.
 *
 * Antes se agrupaba por la cadena exacta, y eso partía una misma marca en
 * varias entradas del desplegable: «Volkswagen» con 133 modelos, «VOLKSWAGEN»
 * con 78, «Vw» con 2. Quien eligiera la equivocada no encontraba su coche —un
 * Taigo con seis anuncios activos no aparecía— sin ninguna pista de por qué.
 *
 * Los modelos se juntan igual: «Taigo» y «TAIGO» son el mismo coche y salían
 * dos veces seguidas en la lista.
 */
function mergeCatalogMaps(primaryMap = {}, secondaryMap = {}) {
  const porMarca = new Map();

  const acumular = (mapa) => {
    for (const [nombreBruto, modelos] of Object.entries(mapa || {})) {
      const nombre = normalizeText(nombreBruto);
      const clave = claveComparable(nombre);
      if (!clave) continue;

      const entrada = porMarca.get(clave) || { nombre, modelos: new Map() };
      entrada.nombre = mejorNombreDeMarca(entrada.nombre, nombre);
      for (const modeloBruto of Array.isArray(modelos) ? modelos : []) {
        const modelo = normalizeText(modeloBruto);
        const claveModelo = claveComparable(modelo);
        if (!claveModelo) continue;
        entrada.modelos.set(claveModelo, mejorNombreDeMarca(entrada.modelos.get(claveModelo), modelo));
      }
      porMarca.set(clave, entrada);
    }
  };

  // Primero el secundario, para que el principal mande al elegir la grafía.
  acumular(secondaryMap);
  acumular(primaryMap);

  const merged = {};
  for (const { nombre, modelos } of porMarca.values()) {
    if (modelos.size === 0) continue;
    merged[capitalizar(nombre)] = [...modelos.values()];
  }
  return merged;
}

function buildFallbackCatalogFromLocalFile() {
  const rawCatalog = localVehicleCatalog && typeof localVehicleCatalog === "object" ? localVehicleCatalog : {};

  return Object.entries(rawCatalog).reduce((acc, [brandName, models]) => {
    const cleanBrand = normalizeText(brandName);

    if (!cleanBrand || !Array.isArray(models)) {
      return acc;
    }

    const cleanModels = Array.from(
      new Set(
        models
          .map((modelName) => normalizeText(modelName))
          .filter(Boolean)
      )
    );

    if (cleanModels.length > 0) {
      acc[cleanBrand] = cleanModels;
    }

    return acc;
  }, {});
}

export function useMarketCatalog(fallbackOffers = []) {
  const fallbackCatalog = useMemo(() => {
    const fullCatalogFallback = buildFallbackCatalogFromLocalFile();
    const offersCatalogFallback = buildFallbackMarketCatalogFromOffers(fallbackOffers);

    return mergeCatalogMaps(fullCatalogFallback, offersCatalogFallback);
  }, [fallbackOffers]);
  // "Más buscados" should come from real inventory coverage (API), not static fallback offers.
  const fallbackMatchedModels = useMemo(() => ({}), []);
  const [marketBrandsCatalog, setMarketBrandsCatalog] = useState(() => fallbackCatalog);
  const [matchedModelsByBrand, setMatchedModelsByBrand] = useState(() => fallbackMatchedModels);
  const [marketCatalogSource, setMarketCatalogSource] = useState("fallback");

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { data } = await getVehicleCatalogJson();
        const nextCatalog = (Array.isArray(data?.brands) ? data.brands : []).reduce((acc, brandEntry) => {
          const brandName = normalizeText(brandEntry?.name);

          if (!brandName) {
            return acc;
          }

          const models = Array.isArray(brandEntry?.models)
            ? brandEntry.models.map((modelName) => normalizeText(modelName)).filter(Boolean)
            : [];

          acc[brandName] = models;
          return acc;
        }, {});
        const nextMatchedModels = Object.entries(data?.matchedModelsByBrand || {}).reduce((acc, [brandName, models]) => {
          const cleanBrand = normalizeText(brandName);
          if (!cleanBrand || !Array.isArray(models)) {
            return acc;
          }

          const cleanModels = Array.from(new Set(models.map((modelName) => normalizeText(modelName)).filter(Boolean)));
          if (cleanModels.length > 0) {
            acc[cleanBrand] = cleanModels;
          }
          return acc;
        }, {});

        // Include real inventory coverage models even if catalog master table is lagging.
        const catalogWithCoverage = mergeCatalogMaps(nextMatchedModels, nextCatalog);
        const mergedCatalog = mergeCatalogMaps(catalogWithCoverage, fallbackCatalog);
        const mergedMatchedModels = nextMatchedModels;

        if (isMounted && Object.keys(mergedCatalog).length > 0) {
          setMarketBrandsCatalog(mergedCatalog);
          setMatchedModelsByBrand(mergedMatchedModels);
          setMarketCatalogSource(Object.keys(nextCatalog).length > 0 ? "api+fallback" : "fallback");
        }
      } catch {
        if (isMounted) {
          setMatchedModelsByBrand({});
          setMarketCatalogSource("fallback");
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [fallbackCatalog]);

  return { marketBrandsCatalog, matchedModelsByBrand, marketCatalogSource };
}
