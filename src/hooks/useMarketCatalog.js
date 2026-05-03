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

function buildMatchedModelsByBrandFromOffers(offers = []) {
  return buildFallbackMarketCatalogFromOffers(offers);
}

function mergeCatalogMaps(primaryMap = {}, secondaryMap = {}) {
  const merged = {};
  const allBrands = new Set([...Object.keys(secondaryMap || {}), ...Object.keys(primaryMap || {})]);

  for (const brandName of allBrands) {
    const primaryModels = Array.isArray(primaryMap?.[brandName]) ? primaryMap[brandName] : [];
    const secondaryModels = Array.isArray(secondaryMap?.[brandName]) ? secondaryMap[brandName] : [];
    const mergedModels = Array.from(
      new Set([
        ...secondaryModels.map((name) => normalizeText(name)).filter(Boolean),
        ...primaryModels.map((name) => normalizeText(name)).filter(Boolean),
      ])
    );

    if (mergedModels.length > 0) {
      merged[brandName] = mergedModels;
    }
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

        const mergedCatalog = mergeCatalogMaps(nextCatalog, fallbackCatalog);
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
