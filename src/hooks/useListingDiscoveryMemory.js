import { useCallback, useEffect, useRef } from "react";
import { normalizeText } from "../utils/offerHelpers";

export function useListingDiscoveryMemory(listingOptions) {
  const listingOptionsRef = useRef([]);
  const listingSeenRef = useRef({ urls: [], titles: [] });

  useEffect(() => {
    listingOptionsRef.current = listingOptions;

    if (!Array.isArray(listingOptions) || listingOptions.length === 0) {
      return;
    }

    const previousUrls = Array.isArray(listingSeenRef.current?.urls) ? listingSeenRef.current.urls : [];
    const previousTitles = Array.isArray(listingSeenRef.current?.titles) ? listingSeenRef.current.titles : [];
    const nextUrls = Array.from(
      new Set([
        ...previousUrls,
        ...listingOptions.map((item) => normalizeText(item?.url)).filter(Boolean),
      ])
    ).slice(-30);
    const nextTitles = Array.from(
      new Set([
        ...previousTitles,
        ...listingOptions.map((item) => normalizeText(item?.title)).filter(Boolean),
      ])
    ).slice(-40);

    listingSeenRef.current = { urls: nextUrls, titles: nextTitles };
  }, [listingOptions]);

  const resetListingDiscoveryMemory = useCallback(() => {
    listingOptionsRef.current = [];
    listingSeenRef.current = { urls: [], titles: [] };
  }, []);

  return {
    listingOptionsRef,
    listingSeenRef,
    resetListingDiscoveryMemory,
  };
}
