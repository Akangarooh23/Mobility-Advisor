import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const SPAIN_PROVINCES = [
  "A Coruna",
  "Alava",
  "Albacete",
  "Alicante",
  "Almeria",
  "Asturias",
  "Avila",
  "Badajoz",
  "Barcelona",
  "Burgos",
  "Caceres",
  "Cadiz",
  "Cantabria",
  "Castellon",
  "Ceuta",
  "Ciudad Real",
  "Cordoba",
  "Cuenca",
  "Girona",
  "Granada",
  "Guadalajara",
  "Guipuzcoa",
  "Huelva",
  "Huesca",
  "Illes Balears",
  "Jaen",
  "La Rioja",
  "Las Palmas",
  "Leon",
  "Lleida",
  "Lugo",
  "Madrid",
  "Malaga",
  "Melilla",
  "Murcia",
  "Navarra",
  "Ourense",
  "Palencia",
  "Pontevedra",
  "Salamanca",
  "Santa Cruz de Tenerife",
  "Segovia",
  "Sevilla",
  "Soria",
  "Tarragona",
  "Teruel",
  "Toledo",
  "Valencia",
  "Valladolid",
  "Vizcaya",
  "Zamora",
  "Zaragoza",
];

const PRICE_RANGE_OPTIONS = [
  { value: "", label: "Todos", min: null, max: null },
  { value: "under_15000", label: "< 15.000 EUR", min: null, max: 15000 },
  { value: "15000_25000", label: "15.000 - 25.000 EUR", min: 15000, max: 25000 },
  { value: "25000_35000", label: "25.000 - 35.000 EUR", min: 25000, max: 35000 },
  { value: "over_35000", label: "> 35.000 EUR", min: 35000, max: null },
];

export default function ResultsOffersView({
  themeMode,
  quickValidationQuestions,
  displayResult,
  quickValidationAnswers,
  updateQuickValidationAnswer,
  isRentingOutcome,
  isBuyOrFinanceOutcome,
  MONTHLY_BUDGET_OPTIONS,
  INCOME_STABILITY_OPTIONS,
  listingFilters,
  updateListingFilter,
  canSearchListing,
  listingLoading,
  searchRealListing,
  listingCoverageSummary,
  listingError,
  featuredOffer,
  featuredOfferAction,
  featuredOfferSaved,
  otherOffers,
  ResolvedOfferImage,
  openOfferInProductSheet,
  openOfferInNewTab,
  getOfferTrustBadges,
  getOfferBadgeStyle,
  toggleSavedRecommendation,
  isRecommendationSaved,
  getOfferActionMeta,
}) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const text = {
    quickValidation: t("resultsOffersView.quickValidation"),
    yes: t("resultsOffersView.yes"),
    no: t("resultsOffersView.no"),
    nextStep: t("resultsOffersView.nextStep"),
    nextStepDesc: t("resultsOffersView.nextStepDesc"),
    targetMonthlyFee: t("resultsOffersView.targetMonthlyFee"),
    incomeStability: t("resultsOffersView.incomeStability"),
    buyChecklist: [
      t("resultsOffersView.buyChecklistItem1"),
      t("resultsOffersView.buyChecklistItem2"),
      t("resultsOffersView.buyChecklistItem3"),
    ],
    altChecklist: [
      t("resultsOffersView.altChecklistItem1"),
      t("resultsOffersView.altChecklistItem2"),
      t("resultsOffersView.altChecklistItem3"),
    ],
    bestOffers: t("resultsOffersView.bestOffers"),
    recalculating: t("resultsOffersView.recalculating"),
    recalculateOffers: t("resultsOffersView.recalculateOffers"),
    featuredIntro: t("resultsOffersView.featuredIntro"),
    listingCoveragePrefix: "🔎",
    refineWarning: t("resultsOffersView.refineWarning"),
    loadingRealtime: t("resultsOffersView.loadingRealtime"),
    firstLoadInfo: t("resultsOffersView.firstLoadInfo"),
    openOfferNewTab: t("resultsOffersView.openOfferNewTab"),
    featuredOffer: t("resultsOffersView.featuredOffer"),
    position: t("resultsOffersView.position"),
    fit: t("resultsOffersView.fit"),
    featuredFallback: t("resultsOffersView.featuredFallback"),
    externalWeb: t("resultsOffersView.externalWeb"),
    whyFirst: t("resultsOffersView.whyFirst"),
    referenceOnly: t("resultsOffersView.referenceOnly"),
    searchRealNow: t("resultsOffersView.searchRealNow"),
    saved: t("resultsOffersView.saved"),
    saveFavorite: t("resultsOffersView.saveFavorite"),
    searchAnotherBatch: t("resultsOffersView.searchAnotherBatch"),
    otherFittingOffers: t("resultsOffersView.otherFittingOffers"),
    save: t("resultsOffersView.save"),
    inSaved: t("resultsOffersView.inSaved"),
    searchReal: t("resultsOffersView.searchReal"),
    location: isEn ? "LOCATION" : "UBICACION",
    allSpain: isEn ? "All Spain" : "Toda Espana",
    priceRange: isEn ? "PRICE RANGE" : "RANGO DE PRECIOS",
    featuredOfferAlt: isEn ? "Featured offer" : "Oferta destacada",
    offerAlt: isEn ? "Offer" : "Oferta",
    nationalDelivery: isEn ? "Nationwide delivery" : "Entrega nacional",
    viewDetails: isEn ? "View details" : "Ver ficha",
    goPortal: isEn ? "Go to portal" : "Ir al portal",
  };

  const [hoveredCard, setHoveredCard] = useState(null);
  const [isMobileOffersView, setIsMobileOffersView] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 760 : false
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setIsMobileOffersView(window.innerWidth <= 760);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const isDark = themeMode === "dark";
  const cardBg = isDark ? "rgba(17,17,17,0.88)" : "rgba(255,255,255,0.95)";
  const titleColor = isDark ? "var(--gris-50)" : "var(--gris-900)";
  const bodyColor = isDark ? "var(--gris-300)" : "var(--gris-600)";

  const formatOfferPrice = (rawPrice) => {
    const value = String(rawPrice || "").trim();
    if (!value) {
      return "";
    }

    const numeric = Number(value.replace(/[^\d]/g, ""));
    if (Number.isFinite(numeric) && numeric > 0) {
      return `${numeric.toLocaleString("es-ES")} €`;
    }

    return value.includes("€") ? value : `${value} €`;
  };

  const openOfferSheet = (offer) => {
    if (!offer) {
      return;
    }

    if (typeof openOfferInProductSheet === "function") {
      openOfferInProductSheet(offer);
      return;
    }

    const fallbackUrl = offer?.url || offer?.searchUrl;
    if (fallbackUrl) {
      openOfferInNewTab(fallbackUrl);
    }
  };

  const isNationalDeliveryOffer = (offer) => {
    const province = String(offer?.province || "").trim();
    const city = String(offer?.city || "").trim();
    const location = String(offer?.location || "").trim();
    return !province && !city && !location;
  };

  return (
    <>
      <div
        style={{
          background: isDark ? "rgba(17,17,17,0.7)" : "rgba(255,255,255,0.88)",
          border: isDark ? "1px solid rgba(150,150,143,0.22)" : "1px solid rgba(150,150,143,0.18)",
          borderRadius: 12,
          padding: "10px 14px",
          marginBottom: 14,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
        }}
      >
        {isRentingOutcome && MONTHLY_BUDGET_OPTIONS.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: isDark ? "var(--gris-400)" : "var(--gris-500)", fontWeight: 700, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
              CUOTA
            </span>
            {MONTHLY_BUDGET_OPTIONS.map((option) => {
              const selected = listingFilters.budget === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateListingFilter("budget", selected ? "" : option.value)}
                  style={{
                    background: selected ? (isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.12)") : "transparent",
                    border: selected ? "1px solid rgba(16,185,129,0.4)" : (isDark ? "1px solid rgba(150,150,143,0.28)" : "1px solid rgba(150,150,143,0.22)"),
                    color: selected ? (isDark ? "#6ee7b7" : "#047857") : (isDark ? "var(--gris-300)" : "var(--gris-600)"),
                    padding: "4px 10px",
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: selected ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: isDark ? "var(--gris-400)" : "var(--gris-500)", fontWeight: 700, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
            {text.location}
          </span>
          <select
            value={listingFilters.location || ""}
            onChange={(event) => updateListingFilter("location", event.target.value)}
            style={{
              border: isDark ? "1px solid rgba(150,150,143,0.28)" : "1px solid rgba(150,150,143,0.22)",
              background: isDark ? "rgba(17,17,17,0.9)" : "var(--blanco)",
              color: isDark ? "var(--gris-200)" : "var(--gris-800)",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 600,
              minWidth: 170,
              cursor: "pointer",
            }}
          >
            <option value="">{text.allSpain}</option>
            {SPAIN_PROVINCES.map((province) => (
              <option key={province} value={province}>{province}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: isDark ? "var(--gris-400)" : "var(--gris-500)", fontWeight: 700, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
            {text.priceRange}
          </span>
          {PRICE_RANGE_OPTIONS.map((option) => {
            const selected = (listingFilters.priceRange || "") === option.value;
            return (
              <button
                key={option.value || "all-price"}
                type="button"
                onClick={() => updateListingFilter("priceRange", option.value)}
                style={{
                  background: selected ? (isDark ? "rgba(150,150,143,0.2)" : "rgba(94,94,89,0.1)") : "transparent",
                  border: selected ? "1px solid rgba(150,150,143,0.4)" : (isDark ? "1px solid rgba(150,150,143,0.28)" : "1px solid rgba(150,150,143,0.22)"),
                  color: selected ? (isDark ? "var(--gris-300)" : "var(--gris-600)") : (isDark ? "var(--gris-300)" : "var(--gris-600)"),
                  padding: "4px 10px",
                  borderRadius: 100,
                  fontSize: 11,
                  fontWeight: selected ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
          alignItems: "start",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              background: cardBg,
              border: isDark ? "1px solid rgba(207,207,200,0.28)" : "1px solid rgba(94,94,89,0.24)",
              borderRadius: 16,
              padding: 18,
              boxShadow: isDark ? "0 14px 30px rgba(5,5,5,0.34)" : "0 14px 30px rgba(94,94,89,0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "var(--gris-800)", fontWeight: 700, letterSpacing: "0.7px" }}>
                {text.bestOffers}
              </div>
              <button
                type="button"
                onClick={() => searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true })}
                disabled={!canSearchListing || listingLoading}
                style={{
                  background: canSearchListing && !listingLoading
                    ? "linear-gradient(135deg,var(--gris-700),var(--marca))"
                    : "rgba(150,150,143,0.2)",
                  border: "none",
                  color: "white",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: canSearchListing && !listingLoading ? "pointer" : "not-allowed",
                  opacity: canSearchListing && !listingLoading ? 1 : 0.6,
                }}
              >
                {listingLoading ? text.recalculating : text.recalculateOffers}
              </button>
            </div>

            <p style={{ margin: "0 0 12px", fontSize: 12, color: bodyColor, lineHeight: 1.6 }}>
              {text.featuredIntro}
            </p>

            {listingCoverageSummary && (
              <div
                style={{
                  background: isDark ? "rgba(17,17,17,0.86)" : "rgba(255,255,255,0.95)",
                  border: isDark ? "1px solid rgba(207,207,200,0.3)" : "1px solid rgba(94,94,89,0.2)",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 10,
                  fontSize: 11,
                  color: isDark ? "var(--gris-300)" : "var(--gris-800)",
                  lineHeight: 1.6,
                }}
              >
                {text.listingCoveragePrefix} {listingCoverageSummary}
              </div>
            )}

            {listingError && (
              <div
                style={{
                  background: featuredOffer ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)",
                  border: featuredOffer ? "1px solid rgba(251,191,36,0.24)" : "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 10,
                  fontSize: 12,
                  color: featuredOffer ? "#92400e" : "#991b1b",
                }}
              >
                {featuredOffer
                  ? `⚠️ ${listingError} ${text.refineWarning}`
                  : listingError}
              </div>
            )}

            {!featuredOffer && !listingLoading && !listingError && (
              <div
                style={{
                  background: cardBg,
                  border: isDark ? "1px dashed rgba(150,150,143,0.36)" : "1px dashed rgba(150,150,143,0.24)",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 12,
                  color: bodyColor,
                  lineHeight: 1.6,
                }}
              >
                {listingLoading
                  ? text.loadingRealtime
                  : text.firstLoadInfo}
              </div>
            )}

            {featuredOffer && (
              <div
                onClick={() => openOfferSheet(featuredOffer)}
                title={featuredOffer ? text.openOfferNewTab : undefined}
                onMouseEnter={() => setHoveredCard("featured")}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: cardBg,
                  border: hoveredCard === "featured"
                    ? "1px solid rgba(255,196,0,0.3)"
                    : "1px solid rgba(94,94,89,0.15)",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                  cursor: featuredOffer ? "pointer" : "default",
                  boxShadow: hoveredCard === "featured"
                    ? "0 18px 36px rgba(255,196,0,0.16)"
                    : "0 10px 24px rgba(17,17,17,0.08)",
                  transform: hoveredCard === "featured" ? "translateY(-2px)" : "translateY(0)",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobileOffersView ? "1fr" : "minmax(220px,260px) 1fr",
                    gap: 14,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      borderRadius: 12,
                      overflow: "hidden",
                      minHeight: isMobileOffersView ? 190 : 170,
                      height: isMobileOffersView ? 190 : undefined,
                      background: "rgba(242,242,237,0.5)",
                      border: "1px solid rgba(150,150,143,0.14)",
                    }}
                  >
                    <ResolvedOfferImage
                      offer={featuredOffer}
                      alt={featuredOffer.title || text.featuredOfferAlt}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: isMobileOffersView ? 190 : "100%",
                        minHeight: isMobileOffersView ? 190 : 170,
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: "var(--gris-800)", marginBottom: 6, fontWeight: 700, letterSpacing: "0.6px" }}>
                      {text.featuredOffer} · {text.position} #{featuredOffer.rankPosition || 1}
                      {Number.isFinite(Number(featuredOffer.rankingScore ?? featuredOffer.profileScore))
                        ? ` · ${text.fit} ${Number(featuredOffer.rankingScore ?? featuredOffer.profileScore)}/100`
                        : ""}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: titleColor, marginBottom: 6 }}>
                      {featuredOffer.title}
                    </div>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: bodyColor, lineHeight: 1.6 }}>
                      {featuredOffer.description || text.featuredFallback}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: "var(--marca-oscuro)" }}>
                        {featuredOffer.source || text.externalWeb}
                      </div>
                      {featuredOffer.price && (
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#047857" }}>
                          {formatOfferPrice(featuredOffer.price)}
                        </div>
                      )}
                    </div>
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--gris-900)", lineHeight: 1.6 }}>
                      <strong>{text.whyFirst}:</strong> {featuredOffer.positionReason || featuredOffer.matchReason}
                    </p>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      {getOfferTrustBadges(featuredOffer).map((badge) => (
                        <span key={`${featuredOffer.title || "featured"}-badge-${badge.label}`} style={getOfferBadgeStyle(badge.tone)}>
                          {badge.label}
                        </span>
                      ))}
                      {isNationalDeliveryOffer(featuredOffer) && (
                        <span
                          style={{
                            background: "rgba(16,185,129,0.12)",
                            border: "1px solid rgba(52,211,153,0.3)",
                            color: "#047857",
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {text.nationalDelivery}
                        </span>
                      )}
                      {Array.isArray(featuredOffer.rankingSignals) && featuredOffer.rankingSignals.slice(0, 3).map((signal) => (
                        <span
                          key={`${featuredOffer.url || featuredOffer.title || "featured"}-signal-${signal}`}
                          style={{
                            background: "rgba(255,196,0,0.1)",
                            border: "1px solid rgba(255,196,0,0.22)",
                            color: "var(--gris-900)",
                            padding: "4px 8px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {signal}
                        </span>
                      ))}
                    </div>

                    {!featuredOffer.url && featuredOffer.searchUrl && (
                      <p style={{ margin: "0 0 10px", fontSize: 11, color: "#92400e", lineHeight: 1.6 }}>
                        {text.referenceOnly}
                      </p>
                    )}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {featuredOfferAction ? (
                        <button
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onMouseUp={(event) => event.stopPropagation()}
                          onClickCapture={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            openOfferSheet(featuredOffer);
                          }}
                          style={{
                            background: featuredOfferAction.exact
                              ? "linear-gradient(135deg,var(--marca),var(--marca-oscuro))"
                              : "rgba(245,158,11,0.16)",
                            border: featuredOfferAction.exact
                              ? "none"
                              : "1px solid rgba(245,158,11,0.35)",
                            color: featuredOfferAction.exact ? "var(--blanco)" : "#92400e",
                            padding: "9px 13px",
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {featuredOfferAction.exact ? text.viewDetails : text.goPortal}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true });
                          }}
                          style={{
                            background: "rgba(16,185,129,0.12)",
                            border: "1px solid rgba(52,211,153,0.22)",
                            color: "#065f46",
                            padding: "9px 13px",
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {text.searchRealNow}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSavedRecommendation(featuredOffer);
                        }}
                        style={{
                          background: featuredOfferSaved ? "rgba(236,72,153,0.16)" : "rgba(242,242,237,0.9)",
                          border: featuredOfferSaved
                            ? "1px solid rgba(244,114,182,0.28)"
                            : "1px solid rgba(94,94,89,0.35)",
                          color: featuredOfferSaved ? "#9d174d" : "var(--gris-800)",
                          padding: "9px 13px",
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {featuredOfferSaved ? text.saved : text.saveFavorite}
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true });
                        }}
                        style={{
                          background: "rgba(242,242,237,0.9)",
                          border: "1px solid rgba(94,94,89,0.35)",
                          color: "var(--gris-800)",
                          padding: "9px 13px",
                          borderRadius: 10,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {text.searchAnotherBatch}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {otherOffers.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "var(--gris-800)", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                  {text.otherFittingOffers}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {otherOffers.map((offer, index) => {
                    const offerAction = getOfferActionMeta(offer);

                    return (
                      <div
                        key={offer.url || offer.searchUrl || `${offer.title}-${index}`}
                        onClick={() => openOfferSheet(offer)}
                        title={offer ? text.openOfferNewTab : undefined}
                        onMouseEnter={() => setHoveredCard(`other-${index}`)}
                        onMouseLeave={() => setHoveredCard(null)}
                        style={{
                          background: cardBg,
                          border: hoveredCard === `other-${index}`
                            ? "1px solid rgba(255,196,0,0.3)"
                            : "1px solid rgba(150,150,143,0.16)",
                          borderRadius: 12,
                          padding: 12,
                          cursor: offer ? "pointer" : "default",
                          boxShadow: hoveredCard === `other-${index}`
                            ? "0 14px 30px rgba(255,196,0,0.14)"
                            : "0 8px 18px rgba(17,17,17,0.06)",
                          transform: hoveredCard === `other-${index}` ? "translateY(-2px)" : "translateY(0)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: isMobileOffersView ? "1fr" : "96px 1fr", gap: 12, alignItems: "start" }}>
                          <div
                            style={{
                              borderRadius: 10,
                              overflow: "hidden",
                              background: "rgba(242,242,237,0.55)",
                              border: "1px solid rgba(150,150,143,0.14)",
                              minHeight: isMobileOffersView ? 170 : 78,
                              height: isMobileOffersView ? 170 : undefined,
                            }}
                          >
                            <ResolvedOfferImage
                              offer={offer}
                              alt={offer.title || text.offerAlt}
                              loading="lazy"
                              style={{ width: "100%", height: isMobileOffersView ? 170 : 78, objectFit: "cover", display: "block" }}
                            />
                          </div>

                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: titleColor }}>
                                #{offer.rankPosition || index + 2} · {offer.title}
                              </div>
                              {offer.price && <div style={{ fontSize: 13, fontWeight: 800, color: "#047857" }}>{formatOfferPrice(offer.price)}</div>}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--marca-oscuro)", marginBottom: 6 }}>
                              {offer.source || text.externalWeb}
                              {Number.isFinite(Number(offer.rankingScore ?? offer.profileScore))
                                ? ` · ${Number(offer.rankingScore ?? offer.profileScore)}/100`
                                : ""}
                            </div>
                            <p style={{ margin: "0 0 6px", fontSize: 11, color: bodyColor, lineHeight: 1.5 }}>
                              {offer.positionReason || offer.matchReason}
                            </p>

                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                              {getOfferTrustBadges(offer).map((badge) => (
                                <span key={`${offer.url || offer.searchUrl || offer.title}-badge-${badge.label}`} style={getOfferBadgeStyle(badge.tone)}>
                                  {badge.label}
                                </span>
                              ))}
                              {isNationalDeliveryOffer(offer) && (
                                <span
                                  style={{
                                    background: "rgba(16,185,129,0.12)",
                                    border: "1px solid rgba(52,211,153,0.3)",
                                    color: "#047857",
                                    padding: "3px 7px",
                                    borderRadius: 999,
                                    fontSize: 10,
                                    fontWeight: 700,
                                  }}
                                >
                                  {text.nationalDelivery}
                                </span>
                              )}
                              {Array.isArray(offer.rankingSignals) && offer.rankingSignals.slice(0, 1).map((signal) => (
                                <span
                                  key={`${offer.url || offer.searchUrl || offer.title}-signal-${signal}`}
                                  style={{
                                    background: "rgba(255,196,0,0.1)",
                                    border: "1px solid rgba(255,196,0,0.22)",
                                    color: "var(--gris-900)",
                                    padding: "3px 7px",
                                    borderRadius: 999,
                                    fontSize: 10,
                                  }}
                                >
                                  {signal}
                                </span>
                              ))}
                            </div>

                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                              {offerAction ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openOfferSheet(offer);
                                  }}
                                  style={{
                                    color: offerAction.exact ? "var(--gris-800)" : "#b45309",
                                    background: "transparent",
                                    border: "none",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  {offerAction.exact ? text.viewDetails : text.goPortal}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true });
                                  }}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--gris-800)",
                                    textDecoration: "none",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  {text.searchReal}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleSavedRecommendation(offer);
                                }}
                                style={{
                                  background: isRecommendationSaved(offer) ? "rgba(236,72,153,0.14)" : "transparent",
                                  border: "none",
                                  color: isRecommendationSaved(offer) ? "#9d174d" : "var(--gris-800)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                {isRecommendationSaved(offer) ? text.inSaved : text.save}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
