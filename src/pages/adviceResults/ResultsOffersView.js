import { useState } from "react";

export default function ResultsOffersView({
  themeMode,
  uiLanguage = "es",
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
  openOfferInNewTab,
  getOfferTrustBadges,
  getOfferBadgeStyle,
  toggleSavedRecommendation,
  isRecommendationSaved,
  getOfferActionMeta,
}) {
  const language = String(uiLanguage || "").toLowerCase() === "en" ? "en" : "es";
  const text = {
    quickValidation: language === "en" ? "✅ QUICK VALIDATION" : "✅ VALIDACIÓN RÁPIDA",
    yes: language === "en" ? "Yes" : "Sí",
    no: language === "en" ? "No" : "No",
    nextStep: language === "en" ? "🎯 NEXT STEP" : "🎯 SIGUIENTE PASO",
    nextStepDesc:
      language === "en"
        ? "Adjust this quick section and the offers block will reorder to show the best real match first."
        : "Ajusta esta parte rápida y el bloque de ofertas se reordena para enseñarte primero la mejor coincidencia real.",
    targetMonthlyFee: language === "en" ? "Target monthly fee" : "Cuota objetivo mensual",
    incomeStability: language === "en" ? "Income stability" : "Estabilidad de ingresos",
    buyChecklist:
      language === "en"
        ? [
            "Define your comfortable max monthly payment and real upfront capital.",
            "Request a detailed quote with APR/NIR, insurance and total cost.",
            "Discard any option that does not fit your target TCO.",
          ]
        : [
            "Define tu cuota máxima cómoda y el capital inicial real.",
            "Pide oferta desglosada con TIN/TAE, seguro y coste total.",
            "Descarta cualquier opción que no cuadre con el TCO objetivo.",
          ],
    altChecklist:
      language === "en"
        ? [
            "Check real coverage in your area and day-to-day availability.",
            "Compare occasional cost against fixed cost of another modality.",
            "Choose the option that creates the least friction for you now.",
          ]
        : [
            "Comprueba cobertura real en tu zona y disponibilidad diaria.",
            "Compara el coste puntual frente al coste fijo de otra modalidad.",
            "Quédate con la opción que menos fricción te meta hoy.",
          ],
    bestOffers: language === "en" ? "🏆 BEST FIT OFFERS" : "🏆 OFERTAS QUE MEJOR ENCAJAN",
    recalculating: language === "en" ? "Recalculating..." : "Recalculando...",
    recalculateOffers: language === "en" ? "Recalculate offers" : "Recalcular ofertas",
    featuredIntro:
      language === "en"
        ? "The featured offer is the best fit for your case; below you will see 3 more that can also fit, with ranking reasons."
        : "La oferta destacada es la que mejor funciona para tu caso; debajo verás otras 3 que también podrían encajar con sus motivos de posición.",
    listingCoveragePrefix: "🔎",
    refineWarning:
      language === "en"
        ? "You can already open visible options while we refine an even better match."
        : "Ya puedes abrir las opciones visibles mientras afinamos una coincidencia todavía mejor.",
    loadingRealtime:
      language === "en"
        ? "We are recalculating offers for your profile in real time."
        : "Estamos recalculando las ofertas para tu perfil en tiempo real.",
    firstLoadInfo:
      language === "en"
        ? "Offers are shown immediately; if you tweak quick validation or monthly payment, they reorder automatically."
        : "Las ofertas salen ya de primeras; si tocas validación rápida o cuota, se reordenan automáticamente.",
    openOfferNewTab: language === "en" ? "Open offer in a new tab" : "Abrir oferta en una pestaña nueva",
    featuredOffer: language === "en" ? "⭐ FEATURED OFFER" : "⭐ OFERTA DESTACADA",
    position: language === "en" ? "POSITION" : "PUESTO",
    fit: language === "en" ? "FIT" : "ENCAJE",
    featuredFallback:
      language === "en"
        ? "It is the best ranked real match for your test and current context."
        : "Es la coincidencia real mejor posicionada para tu test y tu contexto actual.",
    externalWeb: language === "en" ? "External site" : "Web externa",
    whyFirst: language === "en" ? "Why #1" : "Por qué va la 1ª",
    referenceOnly:
      language === "en"
        ? "This card is a reference only: it takes you to the provider portal, not to an exact verified listing."
        : "Esta tarjeta es una referencia orientativa: te lleva al portal del proveedor, no a una ficha exacta ya verificada.",
    searchRealNow: language === "en" ? "Search real offer now ↗" : "Buscar oferta real ahora ↗",
    saved: language === "en" ? "💖 Saved" : "💖 Guardada",
    saveFavorite: language === "en" ? "🤍 Save favorite" : "🤍 Guardar favorita",
    searchAnotherBatch: language === "en" ? "Search another batch" : "Buscar otra tanda",
    otherFittingOffers: language === "en" ? "OTHER FITTING OFFERS" : "OTRAS OFERTAS QUE TAMBIÉN ENCAJAN",
    save: language === "en" ? "🤍 Save" : "🤍 Guardar",
    inSaved: language === "en" ? "💖 In saved" : "💖 En guardadas",
    searchReal: language === "en" ? "Search real offer ↗" : "Buscar oferta real ↗",
  };

  const [hoveredCard, setHoveredCard] = useState(null);
  const isDark = themeMode === "dark";
  const cardBg = isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.95)";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#cbd5e1" : "#475569";

  return (
    <>
      {(quickValidationQuestions.length > 0 || displayResult.siguiente_paso) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              background: cardBg,
              border: isDark ? "1px solid rgba(148,163,184,0.32)" : "1px solid rgba(31,41,55,0.1)",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 10, color: titleColor, marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
              {text.quickValidation}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {quickValidationQuestions.map((item) => {
                const selected = quickValidationAnswers[item.id] || "";

                return (
                  <div
                    key={item.id}
                    style={{
                      background: cardBg,
                      border: isDark ? "1px solid rgba(96,165,250,0.26)" : "1px solid rgba(59,130,246,0.16)",
                      borderRadius: 10,
                      padding: 10,
                      boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ fontSize: 12, color: isDark ? "#e2e8f0" : "#334155", lineHeight: 1.5, marginBottom: 8 }}>
                      {item.label}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["si", "no"].map((choice) => {
                        const active = selected === choice;
                        const isYes = choice === "si";

                        return (
                          <button
                            key={`${item.id}-${choice}`}
                            type="button"
                            onClick={() => updateQuickValidationAnswer(item.id, choice)}
                            style={{
                              background: active
                                ? isYes
                                  ? "rgba(16,185,129,0.15)"
                                  : "rgba(239,68,68,0.12)"
                                : "rgba(148,163,184,0.1)",
                              border: active
                                ? isYes
                                  ? "1px solid rgba(16,185,129,0.3)"
                                  : "1px solid rgba(239,68,68,0.3)"
                                : "1px solid rgba(148,163,184,0.2)",
                              color: active ? (isYes ? "#065f46" : "#991b1b") : "#475569",
                              padding: "5px 10px",
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {isYes ? text.yes : text.no}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              background: cardBg,
              border: isDark ? "1px solid rgba(110,231,183,0.28)" : "1px solid rgba(16,185,129,0.2)",
              borderRadius: 12,
              padding: 14,
              boxShadow: isDark ? "0 10px 24px rgba(2,6,23,0.28)" : "0 10px 24px rgba(16,185,129,0.08)",
            }}
          >
            <div style={{ fontSize: 10, color: "#047857", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
              {text.nextStep}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: titleColor, marginBottom: 6 }}>
              {displayResult.siguiente_paso}
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: bodyColor, lineHeight: 1.6 }}>
              {text.nextStepDesc}
            </p>

            {isRentingOutcome ? (
              <>
                <div style={{ fontSize: 11, color: "#047857", marginBottom: 6 }}>{text.targetMonthlyFee}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {MONTHLY_BUDGET_OPTIONS.map((option) => {
                    const selected = listingFilters.budget === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateListingFilter("budget", option.value)}
                        style={{
                          background: selected ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.1)",
                          border: selected
                            ? "1px solid rgba(16,185,129,0.3)"
                            : "1px solid rgba(148,163,184,0.2)",
                          padding: "4px 10px",
                          borderRadius: 100,
                          fontSize: 11,
                          color: selected ? "#047857" : "#475569",
                          cursor: "pointer",
                          fontWeight: selected ? 700 : 500,
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize: 11, color: "#047857", marginBottom: 6 }}>{text.incomeStability}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {INCOME_STABILITY_OPTIONS.map((option) => {
                    const selected = listingFilters.income === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateListingFilter("income", option.value)}
                        style={{
                          background: selected ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.1)",
                          border: selected
                            ? "1px solid rgba(16,185,129,0.3)"
                            : "1px solid rgba(148,163,184,0.2)",
                          padding: "4px 10px",
                          borderRadius: 100,
                          fontSize: 11,
                          color: selected ? "#047857" : "#475569",
                          cursor: "pointer",
                          fontWeight: selected ? 700 : 500,
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : isBuyOrFinanceOutcome ? (
              <div style={{ display: "grid", gap: 5 }}>
                {text.buyChecklist.map((item) => (
                  <div key={item} style={{ fontSize: 11, color: isDark ? "#e2e8f0" : "#334155", lineHeight: 1.5 }}>• {item}</div>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 5 }}>
                {text.altChecklist.map((item) => (
                  <div key={item} style={{ fontSize: 11, color: isDark ? "#e2e8f0" : "#334155", lineHeight: 1.5 }}>• {item}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
              border: isDark ? "1px solid rgba(125,211,252,0.28)" : "1px solid rgba(3,105,161,0.24)",
              borderRadius: 16,
              padding: 18,
              boxShadow: isDark ? "0 14px 30px rgba(2,6,23,0.34)" : "0 14px 30px rgba(3,105,161,0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#0369a1", fontWeight: 700, letterSpacing: "0.7px" }}>
                {text.bestOffers}
              </div>
              <button
                type="button"
                onClick={() => searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true })}
                disabled={!canSearchListing || listingLoading}
                style={{
                  background: canSearchListing && !listingLoading
                    ? "linear-gradient(135deg,#0ea5e9,#2563eb)"
                    : "rgba(148,163,184,0.2)",
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
                  background: isDark ? "rgba(15,23,42,0.86)" : "rgba(255,255,255,0.95)",
                  border: isDark ? "1px solid rgba(125,211,252,0.3)" : "1px solid rgba(3,105,161,0.2)",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 10,
                  fontSize: 11,
                  color: isDark ? "#7dd3fc" : "#0369a1",
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
                  border: isDark ? "1px dashed rgba(148,163,184,0.36)" : "1px dashed rgba(148,163,184,0.24)",
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
                onClick={() => featuredOffer?.url && openOfferInNewTab(featuredOffer.url)}
                title={featuredOffer?.url ? text.openOfferNewTab : undefined}
                onMouseEnter={() => setHoveredCard("featured")}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: cardBg,
                  border: hoveredCard === "featured"
                    ? "1px solid rgba(37,99,235,0.3)"
                    : "1px solid rgba(3,105,161,0.15)",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                  cursor: featuredOffer?.url ? "pointer" : "default",
                  boxShadow: hoveredCard === "featured"
                    ? "0 18px 36px rgba(37,99,235,0.16)"
                    : "0 10px 24px rgba(15,23,42,0.08)",
                  transform: hoveredCard === "featured" ? "translateY(-2px)" : "translateY(0)",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px,260px) 1fr",
                    gap: 14,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      borderRadius: 12,
                      overflow: "hidden",
                      minHeight: 170,
                      background: "rgba(241,245,249,0.5)",
                      border: "1px solid rgba(148,163,184,0.14)",
                    }}
                  >
                    <ResolvedOfferImage
                      offer={featuredOffer}
                      uiLanguage={language}
                      alt={featuredOffer.title || "Oferta destacada"}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        minHeight: 170,
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: "#0369a1", marginBottom: 6, fontWeight: 700, letterSpacing: "0.6px" }}>
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
                      <div style={{ fontSize: 12, color: "#1d4ed8" }}>
                        {featuredOffer.source || text.externalWeb}
                      </div>
                      {featuredOffer.price && (
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#047857" }}>
                          {featuredOffer.price}
                        </div>
                      )}
                    </div>
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "#1e3a8a", lineHeight: 1.6 }}>
                      <strong>{text.whyFirst}:</strong> {featuredOffer.positionReason || featuredOffer.matchReason}
                    </p>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      {getOfferTrustBadges(featuredOffer).map((badge) => (
                        <span key={`${featuredOffer.title || "featured"}-badge-${badge.label}`} style={getOfferBadgeStyle(badge.tone)}>
                          {badge.label}
                        </span>
                      ))}
                      {Array.isArray(featuredOffer.rankingSignals) && featuredOffer.rankingSignals.slice(0, 3).map((signal) => (
                        <span
                          key={`${featuredOffer.url || featuredOffer.title || "featured"}-signal-${signal}`}
                          style={{
                            background: "rgba(37,99,235,0.1)",
                            border: "1px solid rgba(96,165,250,0.22)",
                            color: "#1e3a8a",
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
                        <a
                          href={featuredOfferAction.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          style={{
                            background: featuredOfferAction.exact
                              ? "linear-gradient(135deg,#10b981,#059669)"
                              : "rgba(245,158,11,0.14)",
                            border: featuredOfferAction.exact
                              ? "none"
                              : "1px solid rgba(251,191,36,0.28)",
                            color: "white",
                            textDecoration: "none",
                            padding: "9px 13px",
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {featuredOfferAction.label}
                        </a>
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
                          background: featuredOfferSaved ? "rgba(236,72,153,0.16)" : "rgba(241,245,249,0.9)",
                          border: featuredOfferSaved
                            ? "1px solid rgba(244,114,182,0.28)"
                            : "1px solid rgba(100,116,139,0.35)",
                          color: featuredOfferSaved ? "#9d174d" : "#1f2937",
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
                          background: "rgba(241,245,249,0.9)",
                          border: "1px solid rgba(100,116,139,0.35)",
                          color: "#1f2937",
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
                <div style={{ fontSize: 10, color: "#0369a1", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                  {text.otherFittingOffers}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {otherOffers.map((offer, index) => {
                    const offerAction = getOfferActionMeta(offer);

                    return (
                      <div
                        key={offer.url || offer.searchUrl || `${offer.title}-${index}`}
                        onClick={() => offer?.url && openOfferInNewTab(offer.url)}
                        title={offer?.url ? text.openOfferNewTab : undefined}
                        onMouseEnter={() => setHoveredCard(`other-${index}`)}
                        onMouseLeave={() => setHoveredCard(null)}
                        style={{
                          background: cardBg,
                          border: hoveredCard === `other-${index}`
                            ? "1px solid rgba(59,130,246,0.3)"
                            : "1px solid rgba(148,163,184,0.16)",
                          borderRadius: 12,
                          padding: 12,
                          cursor: offer?.url ? "pointer" : "default",
                          boxShadow: hoveredCard === `other-${index}`
                            ? "0 14px 30px rgba(59,130,246,0.14)"
                            : "0 8px 18px rgba(15,23,42,0.06)",
                          transform: hoveredCard === `other-${index}` ? "translateY(-2px)" : "translateY(0)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 12, alignItems: "start" }}>
                          <div
                            style={{
                              borderRadius: 10,
                              overflow: "hidden",
                              background: "rgba(241,245,249,0.55)",
                              border: "1px solid rgba(148,163,184,0.14)",
                              minHeight: 78,
                            }}
                          >
                            <ResolvedOfferImage
                              offer={offer}
                              uiLanguage={language}
                              alt={offer.title || "Oferta"}
                              loading="lazy"
                              style={{ width: "100%", height: 78, objectFit: "cover", display: "block" }}
                            />
                          </div>

                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: titleColor }}>
                                #{offer.rankPosition || index + 2} · {offer.title}
                              </div>
                              {offer.price && <div style={{ fontSize: 13, fontWeight: 800, color: "#047857" }}>{offer.price}</div>}
                            </div>
                            <div style={{ fontSize: 11, color: "#1d4ed8", marginBottom: 6 }}>
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
                              {Array.isArray(offer.rankingSignals) && offer.rankingSignals.slice(0, 1).map((signal) => (
                                <span
                                  key={`${offer.url || offer.searchUrl || offer.title}-signal-${signal}`}
                                  style={{
                                    background: "rgba(37,99,235,0.1)",
                                    border: "1px solid rgba(96,165,250,0.22)",
                                    color: "#1e3a8a",
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
                                <a
                                  href={offerAction.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  style={{
                                    color: offerAction.exact ? "#0369a1" : "#b45309",
                                    textDecoration: "none",
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                >
                                  {offerAction.label}
                                </a>
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
                                    color: "#0369a1",
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
                                  color: isRecommendationSaved(offer) ? "#9d174d" : "#1f2937",
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
