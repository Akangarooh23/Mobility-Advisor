export default function ResultsOffersView({
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
              background: "rgba(14,165,233,0.08)",
              border: "1px solid rgba(125,211,252,0.2)",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 10, color: "#67e8f9", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
              ✅ VALIDACIÓN RÁPIDA
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {quickValidationQuestions.map((item) => {
                const selected = quickValidationAnswers[item.id] || "";

                return (
                  <div
                    key={item.id}
                    style={{
                      background: "rgba(15,23,42,0.28)",
                      border: "1px solid rgba(148,163,184,0.16)",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#dbeafe", lineHeight: 1.5, marginBottom: 8 }}>
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
                                  ? "rgba(16,185,129,0.24)"
                                  : "rgba(239,68,68,0.2)"
                                : "rgba(15,23,42,0.2)",
                              border: active
                                ? isYes
                                  ? "1px solid rgba(52,211,153,0.45)"
                                  : "1px solid rgba(248,113,113,0.42)"
                                : "1px solid rgba(148,163,184,0.18)",
                              color: active ? (isYes ? "#d1fae5" : "#fecaca") : "#cbd5e1",
                              padding: "5px 10px",
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {isYes ? "Sí" : "No"}
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
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(110,231,183,0.2)",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 10, color: "#6ee7b7", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
              🎯 SIGUIENTE PASO
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", marginBottom: 6 }}>
              {displayResult.siguiente_paso}
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#d1fae5", lineHeight: 1.6 }}>
              Ajusta esta parte rápida y el bloque de ofertas se reordena para enseñarte primero la mejor coincidencia real.
            </p>

            {isRentingOutcome ? (
              <>
                <div style={{ fontSize: 11, color: "#a7f3d0", marginBottom: 6 }}>Cuota objetivo mensual</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {MONTHLY_BUDGET_OPTIONS.map((option) => {
                    const selected = listingFilters.budget === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateListingFilter("budget", option.value)}
                        style={{
                          background: selected ? "rgba(16,185,129,0.28)" : "rgba(5,150,105,0.15)",
                          border: selected
                            ? "1px solid rgba(110,231,183,0.55)"
                            : "1px solid rgba(5,150,105,0.28)",
                          padding: "4px 10px",
                          borderRadius: 100,
                          fontSize: 11,
                          color: "#d1fae5",
                          cursor: "pointer",
                          fontWeight: selected ? 700 : 500,
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize: 11, color: "#a7f3d0", marginBottom: 6 }}>Estabilidad de ingresos</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {INCOME_STABILITY_OPTIONS.map((option) => {
                    const selected = listingFilters.income === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateListingFilter("income", option.value)}
                        style={{
                          background: selected ? "rgba(16,185,129,0.28)" : "rgba(5,150,105,0.15)",
                          border: selected
                            ? "1px solid rgba(110,231,183,0.55)"
                            : "1px solid rgba(5,150,105,0.28)",
                          padding: "4px 10px",
                          borderRadius: 100,
                          fontSize: 11,
                          color: "#d1fae5",
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
                {[
                  "Define tu cuota máxima cómoda y el capital inicial real.",
                  "Pide oferta desglosada con TIN/TAE, seguro y coste total.",
                  "Descarta cualquier opción que no cuadre con el TCO objetivo.",
                ].map((item) => (
                  <div key={item} style={{ fontSize: 11, color: "#dcfce7", lineHeight: 1.5 }}>• {item}</div>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 5 }}>
                {[
                  "Comprueba cobertura real en tu zona y disponibilidad diaria.",
                  "Compara el coste puntual frente al coste fijo de otra modalidad.",
                  "Quédate con la opción que menos fricción te meta hoy.",
                ].map((item) => (
                  <div key={item} style={{ fontSize: 11, color: "#dcfce7", lineHeight: 1.5 }}>• {item}</div>
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
              background: "linear-gradient(135deg,rgba(14,165,233,0.16),rgba(37,99,235,0.08))",
              border: "1px solid rgba(96,165,250,0.32)",
              borderRadius: 16,
              padding: 18,
              boxShadow: "0 18px 45px rgba(37,99,235,0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#7dd3fc", fontWeight: 700, letterSpacing: "0.7px" }}>
                🏆 OFERTAS QUE MEJOR ENCAJAN
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
                {listingLoading ? "Recalculando..." : "Recalcular ofertas"}
              </button>
            </div>

            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
              La oferta destacada es la que mejor funciona para tu caso; debajo verás otras 3 que también podrían encajar con sus motivos de posición.
            </p>

            {listingCoverageSummary && (
              <div
                style={{
                  background: "rgba(15,23,42,0.38)",
                  border: "1px solid rgba(125,211,252,0.22)",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 10,
                  fontSize: 11,
                  color: "#dbeafe",
                  lineHeight: 1.6,
                }}
              >
                🔎 {listingCoverageSummary}
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
                  color: featuredOffer ? "#fde68a" : "#fecaca",
                }}
              >
                {featuredOffer
                  ? `⚠️ ${listingError} Ya puedes abrir las opciones visibles mientras afinamos una coincidencia todavía mejor.`
                  : listingError}
              </div>
            )}

            {!featuredOffer && !listingLoading && !listingError && (
              <div
                style={{
                  background: "rgba(15,23,42,0.28)",
                  border: "1px dashed rgba(148,163,184,0.24)",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 12,
                  color: "#cbd5e1",
                  lineHeight: 1.6,
                }}
              >
                {listingLoading
                  ? "Estamos recalculando las ofertas para tu perfil en tiempo real."
                  : "Las ofertas salen ya de primeras; si tocas validación rápida o cuota, se reordenan automáticamente."}
              </div>
            )}

            {featuredOffer && (
              <div
                onClick={() => featuredOffer?.url && openOfferInNewTab(featuredOffer.url)}
                title={featuredOffer?.url ? "Abrir oferta en una pestaña nueva" : undefined}
                style={{
                  background: "rgba(2,6,23,0.42)",
                  border: "1px solid rgba(96,165,250,0.24)",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                  cursor: featuredOffer?.url ? "pointer" : "default",
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
                      background: "rgba(15,23,42,0.72)",
                      border: "1px solid rgba(148,163,184,0.14)",
                    }}
                  >
                    <ResolvedOfferImage
                      offer={featuredOffer}
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
                    <div style={{ fontSize: 10, color: "#67e8f9", marginBottom: 6, fontWeight: 700, letterSpacing: "0.6px" }}>
                      ⭐ OFERTA DESTACADA · PUESTO #{featuredOffer.rankPosition || 1}
                      {Number.isFinite(Number(featuredOffer.rankingScore ?? featuredOffer.profileScore))
                        ? ` · ENCAJE ${Number(featuredOffer.rankingScore ?? featuredOffer.profileScore)}/100`
                        : ""}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc", marginBottom: 6 }}>
                      {featuredOffer.title}
                    </div>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
                      {featuredOffer.description || "Es la coincidencia real mejor posicionada para tu test y tu contexto actual."}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: "#93c5fd" }}>
                        {featuredOffer.source || "Web externa"}
                      </div>
                      {featuredOffer.price && (
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#34d399" }}>
                          {featuredOffer.price}
                        </div>
                      )}
                    </div>
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "#dbeafe", lineHeight: 1.6 }}>
                      <strong>Por qué va la 1ª:</strong> {featuredOffer.positionReason || featuredOffer.matchReason}
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
                            color: "#dbeafe",
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
                      <p style={{ margin: "0 0 10px", fontSize: 11, color: "#fde68a", lineHeight: 1.6 }}>
                        Esta tarjeta es una <strong>referencia orientativa</strong>: te lleva al portal del proveedor, no a una ficha exacta ya verificada.
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
                            color: "#bbf7d0",
                            padding: "9px 13px",
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Buscar oferta real ahora ↗
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSavedRecommendation(featuredOffer);
                        }}
                        style={{
                          background: featuredOfferSaved ? "rgba(236,72,153,0.16)" : "rgba(255,255,255,0.06)",
                          border: featuredOfferSaved
                            ? "1px solid rgba(244,114,182,0.28)"
                            : "1px solid rgba(255,255,255,0.12)",
                          color: featuredOfferSaved ? "#fbcfe8" : "#e2e8f0",
                          padding: "9px 13px",
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {featuredOfferSaved ? "💖 Guardada" : "🤍 Guardar favorita"}
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          searchRealListing(listingFilters, quickValidationAnswers, { forceRefresh: true });
                        }}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "#cbd5e1",
                          padding: "9px 13px",
                          borderRadius: 10,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Buscar otra tanda
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {otherOffers.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "#bfdbfe", marginBottom: 8, fontWeight: 700, letterSpacing: "0.6px" }}>
                  OTRAS OFERTAS QUE TAMBIÉN ENCAJAN
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {otherOffers.map((offer, index) => {
                    const offerAction = getOfferActionMeta(offer);

                    return (
                      <div
                        key={offer.url || offer.searchUrl || `${offer.title}-${index}`}
                        onClick={() => offer?.url && openOfferInNewTab(offer.url)}
                        title={offer?.url ? "Abrir oferta en una pestaña nueva" : undefined}
                        style={{
                          background: "rgba(15,23,42,0.28)",
                          border: "1px solid rgba(148,163,184,0.16)",
                          borderRadius: 12,
                          padding: 12,
                          cursor: offer?.url ? "pointer" : "default",
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 12, alignItems: "start" }}>
                          <div
                            style={{
                              borderRadius: 10,
                              overflow: "hidden",
                              background: "rgba(15,23,42,0.72)",
                              border: "1px solid rgba(148,163,184,0.14)",
                              minHeight: 78,
                            }}
                          >
                            <ResolvedOfferImage
                              offer={offer}
                              alt={offer.title || "Oferta"}
                              loading="lazy"
                              style={{ width: "100%", height: 78, objectFit: "cover", display: "block" }}
                            />
                          </div>

                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>
                                #{offer.rankPosition || index + 2} · {offer.title}
                              </div>
                              {offer.price && <div style={{ fontSize: 13, fontWeight: 800, color: "#6ee7b7" }}>{offer.price}</div>}
                            </div>
                            <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 6 }}>
                              {offer.source || "Web externa"}
                              {Number.isFinite(Number(offer.rankingScore ?? offer.profileScore))
                                ? ` · ${Number(offer.rankingScore ?? offer.profileScore)}/100`
                                : ""}
                            </div>
                            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}>
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
                                    color: "#dbeafe",
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
                                    color: offerAction.exact ? "#7dd3fc" : "#fcd34d",
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
                                    color: "#7dd3fc",
                                    textDecoration: "none",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  Buscar oferta real ↗
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
                                  color: isRecommendationSaved(offer) ? "#f9a8d4" : "#cbd5e1",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                {isRecommendationSaved(offer) ? "💖 En guardadas" : "🤍 Guardar"}
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
