import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { buildImageProxyUrl, buildOfferLocalImageCandidates, slugifyOfferFolderName } from "../utils/offerHelpers";
import { getUtmPayload } from "../utils/utmTracker";
import { trackLead } from "../utils/metaPixel";
import { trackFunnelEvent } from "../utils/funnelTracker";
import { readUserBillingProfile } from "../utils/storage";

function getAvailableDurations(offer) {
  if (offer.rentingPricesJson?.km_options) {
    return ['24m','36m','48m','60m'].filter(d => {
      const prices = offer.rentingPricesJson[d];
      return Array.isArray(prices) && prices.some(p => p != null && p > 0);
    });
  }
  return ['24m','36m','48m','60m'].filter(d => (offer[`renting${d}`] || 0) > 0);
}

function getRentingPriceForSelection(offer, duration, km) {
  if (offer.rentingPricesJson?.km_options) {
    const kmIdx = offer.rentingPricesJson.km_options.indexOf(Number(km));
    const prices = offer.rentingPricesJson[duration];
    if (kmIdx >= 0 && Array.isArray(prices) && prices[kmIdx] != null) return prices[kmIdx];
    return null;
  }
  if (Number(km) === 15000) return offer[`renting${duration}`] || null;
  return null;
}

function getPrefilledForm(currentUser) {
  try {
    const billing = readUserBillingProfile();
    return {
      name:    currentUser?.name  || billing?.fullName || "",
      phone:   currentUser?.phone || billing?.phone    || "",
      email:   currentUser?.email || billing?.email    || "",
      when:    "",
      type:    "info",
      message: "",
    };
  } catch {
    return { name: "", phone: "", email: "", when: "", type: "info", message: "" };
  }
}

export default function PortalVoDetailPage({
  themeMode,
  styles,
  currentUser,
  selectedPortalVoOffer,
  relatedPortalVoOffers,
  ResolvedOfferImage,
  getOfferBadgeStyle,
  getPortalVoEcoLabel,
  getPortalVoTransmission,
  buildPortalVoHighlights,
  buildPortalVoEquipment,
  formatCurrency,
  onBackToMarketplace,
  onGoHome,
  onOpenRelatedOffer,
  onLeadCreated,
  isReserved = false,
}) {
  const isDark = themeMode === "dark";
  const { t } = useTranslation();
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [galleryFailed, setGalleryFailed] = useState(false);
  const [reqModal, setReqModal] = useState(false);
  const [reqForm, setReqForm] = useState(() => getPrefilledForm(currentUser));

  useEffect(() => {
    setReqForm(getPrefilledForm(currentUser));
  }, [selectedPortalVoOffer.id, currentUser]);
  const [reqState, setReqState] = useState("idle");
  const [reqError, setReqError] = useState("");
  const [offerStats, setOfferStats] = useState(null);

  const isParticular = (selectedPortalVoOffer.sellerType || "").toLowerCase() === "particular";
  const isRentingOffer = !!(selectedPortalVoOffer.rentingAvailable && !selectedPortalVoOffer.availableForPurchase);
  const isRentingReserved = isReserved && selectedPortalVoOffer.rentingAvailable && selectedPortalVoOffer.unitsAvailable <= 1 && !selectedPortalVoOffer.availableForPurchase;
  const [rentingDuration, setRentingDuration] = useState(() => {
    const durations = getAvailableDurations(selectedPortalVoOffer);
    return durations[0] || "36m";
  });
  const [rentingKm, setRentingKm] = useState(() => {
    return selectedPortalVoOffer.rentingPricesJson?.km_options?.[1] || 15000;
  });

  useEffect(() => {
    if (!selectedPortalVoOffer.id) return;
    fetch(`/api/marketplace-vo?stats=1&vehicleId=${encodeURIComponent(selectedPortalVoOffer.id)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setOfferStats(d.stats); })
      .catch(() => {});
  }, [selectedPortalVoOffer.id]);

  async function handleReqSubmit(e) {
    e.preventDefault();
    setReqState("submitting");
    setReqError("");
    try {
      let res;
      if (isParticular) {
        res = await fetch("/api/viewing-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offer_id: selectedPortalVoOffer.id,
            buyer_name: reqForm.name,
            buyer_email: reqForm.email,
            buyer_message: reqForm.message,
            ...getUtmPayload(),
          }),
        });
      } else {
        let finalType = reqForm.type;
        let finalWhen = reqForm.when;
        if (isRentingOffer) {
          finalType = "renting";
          const price = getRentingPriceForSelection(selectedPortalVoOffer, rentingDuration, rentingKm);
          const kmLabel = Number(rentingKm) >= 1000 ? `${(Number(rentingKm)/1000).toFixed(0)}.000` : String(rentingKm);
          finalWhen = `Plazo: ${rentingDuration} · ${kmLabel} km/año${price ? ` · ${price} €/mes` : ""}`;
        }
        res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: reqForm.name,
            phone: reqForm.phone,
            email: reqForm.email,
            when: finalWhen,
            type: finalType,
            vehicle_id: selectedPortalVoOffer.id,
            vehicle_title: selectedPortalVoOffer.title,
            vehicle_url: selectedPortalVoOffer.url || "",
            portal: isRentingOffer ? "marketplace-vo-renting" : "marketplace-vo-compra",
            ...getUtmPayload(),
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      trackLead({
        vehicleTitle: selectedPortalVoOffer.title,
        vehicleId: selectedPortalVoOffer.id,
        leadType: reqForm.type || "info",
        utm: getUtmPayload(),
      });
      trackFunnelEvent({
        event_type:  "lead_request",
        user_email:  reqForm.email || null,
        offer_id:    selectedPortalVoOffer.id,
        offer_title: selectedPortalVoOffer.title || "",
        modality:    isRentingOffer ? "renting" : "compra",
      });
      setReqState("done");
      if (onLeadCreated) onLeadCreated();
    } catch (err) {
      setReqState("error");
      setReqError(err.message || "No se pudo enviar la solicitud");
    }
  }

  function openReqModal() {
    const defaultType = isRentingOffer ? "renting" : "info";
    setReqForm({ ...getPrefilledForm(currentUser), when: "", type: defaultType, message: "" });
    if (isRentingOffer) {
      const durations = getAvailableDurations(selectedPortalVoOffer);
      setRentingDuration(durations[0] || "36m");
      setRentingKm(selectedPortalVoOffer.rentingPricesJson?.km_options?.[1] || 15000);
    }
    setReqState("idle");
    setReqError("");
    setReqModal(true);
  }
  // Real images from the offer (for thumbnail strip)
  const realImages = (selectedPortalVoOffer.images?.length
    ? selectedPortalVoOffer.images
    : selectedPortalVoOffer.image
    ? [selectedPortalVoOffer.image]
    : []).map((u) => buildImageProxyUrl(u) || u);
  // Local static images take priority over remote URLs
  const localCandidates = buildOfferLocalImageCandidates(
    { imageFolder: slugifyOfferFolderName(selectedPortalVoOffer) }
  );
  const allImages = realImages.length > 0
    ? realImages
    : localCandidates.filter(Boolean);
  useEffect(() => { setGalleryIdx(0); setGalleryFailed(false); }, [selectedPortalVoOffer.id]);
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const bodyColor = isDark ? "#dbeafe" : "#334155";
  const metaColor = isDark ? "#93c5fd" : "#1d4ed8";
  const panelCardBg = isDark ? "rgba(15,23,42,0.3)" : "rgba(241,245,249,0.92)";
  const specCardBg = isDark ? "rgba(15,23,42,0.34)" : "rgba(248,250,252,0.96)";

  return (
    <div style={styles.center}>
      <div style={{ ...styles.blockBadge("Vinculación"), marginBottom: 10 }}>{t("marketplace.detailBadge")}</div>
      <div style={{ ...styles.panel, marginBottom: 18, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: isDark ? "#67e8f9" : "#0284c7", fontWeight: 800, letterSpacing: "0.6px", marginBottom: 4 }}>
              {t("marketplace.detailSubBadge")}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: titleColor }}>{selectedPortalVoOffer.title}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onBackToMarketplace}
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.95)",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(148,163,184,0.32)",
                color: isDark ? "#cbd5e1" : "#475569",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("marketplace.backToMarketplace")}
            </button>
            <button
              type="button"
              onClick={onGoHome}
              style={{
                background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                border: "none",
                color: "#ffffff",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {t("marketplace.backToHome")}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(148,163,184,0.16)", background: isDark ? "rgba(2,6,23,0.45)" : "rgba(248,250,252,0.96)" }}>
            {allImages.length > 0 && !galleryFailed ? (
              <div>
                <img
                  key={allImages[galleryIdx]}
                  src={allImages[galleryIdx]}
                  alt={selectedPortalVoOffer.title}
                  referrerPolicy="no-referrer"
                  style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
                  onError={() => setGalleryFailed(true)}
                />
                {realImages.length > 1 && (
                  <div style={{ display: "flex", gap: 6, padding: "8px 10px", overflowX: "auto", background: isDark ? "rgba(2,6,23,0.6)" : "rgba(241,245,249,0.96)" }}>
                    {realImages.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { setGalleryIdx(idx); setGalleryFailed(false); }}
                        style={{
                          flexShrink: 0,
                          width: 64,
                          height: 48,
                          padding: 0,
                          border: idx === galleryIdx
                            ? "2px solid #2563eb"
                            : "2px solid transparent",
                          borderRadius: 8,
                          overflow: "hidden",
                          cursor: "pointer",
                          background: "none",
                          opacity: idx === galleryIdx ? 1 : 0.65,
                          transition: "opacity 0.15s, border-color 0.15s",
                        }}
                      >
                        <img
                          src={buildImageProxyUrl(url) || url}
                          alt={`Foto ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          onError={(e) => { e.target.parentElement.style.display = "none"; }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <ResolvedOfferImage
                offer={selectedPortalVoOffer}
                alt={selectedPortalVoOffer.title}
                style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
              />
            )}
          </div>

          <div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={getOfferBadgeStyle(selectedPortalVoOffer.hasGuaranteeSeal ? "green" : "slate")}>
                {selectedPortalVoOffer.hasGuaranteeSeal ? t("marketplace.guaranteeLabel", { months: selectedPortalVoOffer.warrantyMonths }) : t("marketplace.postedByUser")}
              </span>
              <span style={getOfferBadgeStyle("slate")}>{getPortalVoEcoLabel(selectedPortalVoOffer)}</span>
              <span style={getOfferBadgeStyle("slate")}>{selectedPortalVoOffer.color}</span>
            </div>

            {/* Price / modality */}
            <div style={{ marginBottom: 10 }}>
              {selectedPortalVoOffer.availableForPurchase !== false && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: selectedPortalVoOffer.rentingAvailable ? 6 : 0 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: titleColor }}>
                    {formatCurrency(selectedPortalVoOffer.salePrice ?? selectedPortalVoOffer.price)}
                  </span>
                  <span style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}>{t("marketplace.modalityPurchase", "Compra")}</span>
                </div>
              )}
              {selectedPortalVoOffer.rentingAvailable && isRentingOffer && (() => {
                const durations = getAvailableDurations(selectedPortalVoOffer);
                const kmOptions = selectedPortalVoOffer.rentingPricesJson?.km_options || [selectedPortalVoOffer.rentingKmYear || 15000];
                const selectedPrice = getRentingPriceForSelection(selectedPortalVoOffer, rentingDuration, rentingKm);
                return (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 700, marginBottom: 8 }}>
                      Renting — elige tu opción
                    </div>
                    {kmOptions.length > 1 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: isDark ? "#94a3b8" : "#64748b", fontWeight: 600, marginBottom: 4 }}>km/año</div>
                        <select
                          value={rentingKm}
                          onChange={e => setRentingKm(Number(e.target.value))}
                          style={{ padding: "7px 10px", borderRadius: 8, border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0", background: isDark ? "rgba(255,255,255,0.05)" : "#f8fafc", color: isDark ? "#f8fafc" : "#0f172a", fontSize: 12, outline: "none", cursor: "pointer" }}
                        >
                          {kmOptions.map(km => (
                            <option key={km} value={km}>{Number(km) >= 1000 ? `${(Number(km)/1000).toFixed(0)}.000 km/año` : `${km} km/año`}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {durations.map(d => {
                        const price = getRentingPriceForSelection(selectedPortalVoOffer, d, rentingKm);
                        const isSelected = rentingDuration === d;
                        return (
                          <button
                            key={d} type="button"
                            onClick={() => setRentingDuration(d)}
                            style={{
                              background: isSelected ? (isDark ? "rgba(5,150,105,0.22)" : "#f0fdf4") : (isDark ? "rgba(52,211,153,0.05)" : "rgba(5,150,105,0.04)"),
                              border: isSelected ? `2px solid #059669` : (isDark ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(5,150,105,0.18)"),
                              borderRadius: 10, padding: "8px 14px", textAlign: "center", cursor: "pointer",
                              transform: isSelected ? "scale(1.03)" : "scale(1)",
                              transition: "all 0.12s",
                            }}
                          >
                            <div style={{ fontSize: 10, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 600, marginBottom: 2 }}>{d.replace("m", " meses")}</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? "#34d399" : "#059669" }}>{price != null ? `${price} €/mes` : "—"}</div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedPrice != null && (
                      <div style={{ marginTop: 10, fontSize: 12, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 600 }}>
                        Seleccionado: {rentingDuration.replace("m", " meses")} · {Number(rentingKm) >= 1000 ? `${(Number(rentingKm)/1000).toFixed(0)}.000` : rentingKm} km/año · <strong>{selectedPrice} €/mes</strong>
                      </div>
                    )}
                  </div>
                );
              })()}
              {selectedPortalVoOffer.rentingAvailable && !isRentingOffer && (() => {
                const plazos = [
                  { label: "12 meses", value: selectedPortalVoOffer.renting12m },
                  { label: "24 meses", value: selectedPortalVoOffer.renting24m },
                  { label: "36 meses", value: selectedPortalVoOffer.renting36m },
                  { label: "48 meses", value: selectedPortalVoOffer.renting48m },
                  { label: "60 meses", value: selectedPortalVoOffer.renting60m },
                ].filter((p) => p.value > 0);
                if (!plazos.length) return null;
                return (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 700, marginBottom: 6 }}>
                      {t("marketplace.modalityRenting", "Renting")} · {(selectedPortalVoOffer.rentingKmYear || 15000).toLocaleString("es-ES")} km/año
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {plazos.map((p) => (
                        <div key={p.label} style={{ background: isDark ? "rgba(52,211,153,0.08)" : "rgba(5,150,105,0.06)", border: isDark ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(5,150,105,0.18)", borderRadius: 10, padding: "6px 12px", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? "#34d399" : "#059669" }}>{formatCurrency(p.value)}/mes</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Units / color selector */}
            {selectedPortalVoOffer.hasStockManagement && selectedPortalVoOffer.availableUnits?.length > 0 && (() => {
              const byColor = selectedPortalVoOffer.availableUnits.reduce((acc, u) => {
                const c = u.color || "Sin color";
                if (!acc[c]) acc[c] = [];
                acc[c].push(u);
                return acc;
              }, {});
              return (
                <div style={{ marginBottom: 14, padding: "12px 14px", background: isDark ? "rgba(52,211,153,0.07)" : "rgba(236,253,245,0.9)", border: isDark ? "1px solid rgba(52,211,153,0.18)" : "1px solid rgba(16,185,129,0.22)", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#6ee7b7" : "#059669", marginBottom: 8 }}>
                    Unidades disponibles — elige color
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Object.entries(byColor).map(([color, us]) => (
                      <div key={color} style={{ background: isDark ? "rgba(15,23,42,0.4)" : "#fff", border: isDark ? "1px solid rgba(52,211,153,0.25)" : "1px solid rgba(16,185,129,0.3)", borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 2 }}>{color}</div>
                        <div style={{ fontSize: 11, color: isDark ? "#6ee7b7" : "#059669" }}>{us.length} ud{us.length !== 1 ? "s" : ""}</div>
                        <div style={{ fontSize: 10, color: isDark ? "#94a3b8" : "#64748b", marginTop: 2 }}>
                          {us.map((u) => `${Number(u.mileage).toLocaleString("es-ES")} km`).join(" · ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <p style={{ margin: "0 0 12px", fontSize: 13, color: bodyColor, lineHeight: 1.7 }}>
              {selectedPortalVoOffer.description}{" "}
              {t("marketplace.detailLocation", {
                location: selectedPortalVoOffer.location,
                mileage: Number(selectedPortalVoOffer.mileage || 0).toLocaleString("es-ES"),
                fuel: selectedPortalVoOffer.fuel.toLowerCase(),
                power: selectedPortalVoOffer.power ? t("marketplace.detailPower", { power: selectedPortalVoOffer.power }) : "",
              })}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
              {[
                [t("marketplace.specYear"), selectedPortalVoOffer.year],
                [t("marketplace.specKm"), `${Number(selectedPortalVoOffer.mileage || 0).toLocaleString("es-ES")} km`],
                [t("marketplace.specFuel"), selectedPortalVoOffer.fuel],
                [t("marketplace.specPower"), selectedPortalVoOffer.power],
                [t("marketplace.specTransmission"), getPortalVoTransmission(selectedPortalVoOffer)],
                [t("marketplace.specDisplacement"), selectedPortalVoOffer.displacement > 0 ? `${selectedPortalVoOffer.displacement.toLocaleString("es-ES")} cc` : "EV"],
                [t("marketplace.specLocation"), selectedPortalVoOffer.location],
                [t("marketplace.specSeller"), selectedPortalVoOffer.seller],
              ].map(([label, value]) => (
                <div
                  key={`${selectedPortalVoOffer.id}-${label}`}
                  style={{
                    background: specCardBg,
                    border: "1px solid rgba(148,163,184,0.14)",
                    borderRadius: 12,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: 10, color: metaColor, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 12, color: titleColor, fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Stats widget (compra) */}
            {offerStats && (offerStats.viewCount > 0 || offerStats.contactCount > 0) && (
              <div style={{ marginTop: 16, padding: "14px 16px", background: isDark ? "rgba(30,41,59,0.7)" : "rgba(248,250,252,0.95)", border: isDark ? "1px solid rgba(148,163,184,0.14)" : "1px solid rgba(148,163,184,0.22)", borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: isDark ? "#93c5fd" : "#2563eb", letterSpacing: "0.6px", marginBottom: 12 }}>INTERÉS EN ESTE VEHÍCULO</div>
                <div style={{ display: "flex", gap: 28 }}>
                  {offerStats.viewCount > 0 && (
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", lineHeight: 1 }}>{offerStats.viewCount}</div>
                      <div style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#64748b", marginTop: 3 }}>visitas</div>
                    </div>
                  )}
                  {offerStats.contactCount > 0 && (
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", lineHeight: 1 }}>{offerStats.contactCount}</div>
                      <div style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#64748b", marginTop: 3 }}>contactos</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CTA */}
            {isRentingReserved && (
              <div style={{ marginTop: 16, padding: "10px 14px", background: "#fef9c3", border: "1.5px solid #fbbf24", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#92400e" }}>
                🔒 Unidad en renting reservada para otro cliente
              </div>
            )}
            <button
              type="button"
              onClick={openReqModal}
              disabled={isRentingReserved}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "14px 0",
                background: isRentingReserved
                  ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(148,163,184,0.18)")
                  : isParticular
                    ? "linear-gradient(135deg,#0f172a,#1e3a5f)"
                    : isRentingOffer
                    ? "linear-gradient(135deg,#059669,#047857)"
                    : "linear-gradient(135deg,#2563eb,#1d4ed8)",
                color: isRentingReserved ? (isDark ? "#64748b" : "#94a3b8") : "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 800,
                cursor: isRentingReserved ? "not-allowed" : "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {isRentingReserved ? "Unidad reservada" : isParticular ? "Solicitar visita al vendedor" : isRentingOffer ? "🔑 Solicitar esta oferta de renting" : "Solicitar información"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 16 }}>
          <div style={{ background: panelCardBg, border: "1px solid rgba(148,163,184,0.14)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: isDark ? "#60a5fa" : "#0369a1", fontWeight: 700, marginBottom: 8 }}>{t("marketplace.keyPointsLabel")}</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: bodyColor, fontSize: 12, lineHeight: 1.7 }}>
              {buildPortalVoHighlights(selectedPortalVoOffer).map((item) => (
                <li key={`${selectedPortalVoOffer.id}-${item}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div style={{ background: panelCardBg, border: "1px solid rgba(148,163,184,0.14)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: isDark ? "#60a5fa" : "#0369a1", fontWeight: 700, marginBottom: 8 }}>{t("marketplace.featuresLabel")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {buildPortalVoEquipment(selectedPortalVoOffer).map((item) => (
                <span key={`${selectedPortalVoOffer.id}-feature-${item}`} style={getOfferBadgeStyle("slate")}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* REQUEST MODAL */}
      {reqModal && (
        <div
          onClick={() => setReqModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? "#0f172a" : "#fff",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(148,163,184,0.24)",
              borderRadius: 16, padding: 28, width: "100%", maxWidth: 420,
              boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
            }}
          >
            {reqState === "done" ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{isRentingOffer ? "🔑" : "✅"}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 8 }}>
                  {isParticular ? "¡Solicitud enviada al vendedor!" : isRentingOffer ? "¡Solicitud de renting recibida!" : "¡Solicitud recibida!"}
                </div>
                <div style={{ fontSize: 13, color: isDark ? "#94a3b8" : "#475569", lineHeight: 1.6 }}>
                  {isParticular
                    ? "El vendedor recibirá un email para proponerte fechas de visita."
                    : isRentingOffer
                    ? "Te enviaremos un email de confirmación y nos pondremos en contacto contigo para gestionar tu contrato de renting."
                    : "Te contactaremos en menos de 2 horas en el horario indicado."}
                </div>
                <button
                  type="button"
                  onClick={() => setReqModal(false)}
                  style={{ marginTop: 20, padding: "10px 28px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleReqSubmit}>
                <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 4 }}>
                  {isParticular ? "Solicitar visita al vendedor" : isRentingOffer ? "🔑 Solicitar oferta de renting" : "Solicitar información"}
                </div>
                <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", marginBottom: 18 }}>
                  {selectedPortalVoOffer.title}
                </div>

                {!isParticular && !isRentingOffer && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    {[["info","Información"],["visit","Visita"]].map(([v, l]) => (
                      <button
                        key={v} type="button"
                        onClick={() => setReqForm((f) => ({ ...f, type: v }))}
                        style={{
                          flex: 1, padding: "8px 0", border: "1px solid",
                          borderColor: reqForm.type === v ? "#2563eb" : (isDark ? "rgba(255,255,255,0.12)" : "#e2e8f0"),
                          background: reqForm.type === v ? (isDark ? "rgba(37,99,235,0.18)" : "#eff6ff") : "transparent",
                          color: reqForm.type === v ? "#2563eb" : (isDark ? "#94a3b8" : "#475569"),
                          borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}
                      >{l}</button>
                    ))}
                  </div>
                )}

                {isRentingOffer && (() => {
                  const selectedPrice = getRentingPriceForSelection(selectedPortalVoOffer, rentingDuration, rentingKm);
                  const kmLabel = Number(rentingKm) >= 1000 ? `${(Number(rentingKm)/1000).toFixed(0)}.000` : String(rentingKm);
                  return (
                    <div style={{ marginBottom: 16, background: isDark ? "rgba(5,150,105,0.12)" : "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ fontSize: 10, color: isDark ? "#6ee7b7" : "#065f46", fontWeight: 600, marginBottom: 4 }}>Opción seleccionada</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#059669" }}>
                        {rentingDuration.replace("m", " meses")} · {kmLabel} km/año{selectedPrice != null ? ` · ${selectedPrice} €/mes` : ""}
                      </div>
                    </div>
                  );
                })()}

                {[
                  ["name", "Nombre *", "text", true],
                  ...(isParticular ? [] : [["phone", "Teléfono *", "tel", true]]),
                  ["email", "Email *", "email", true],
                ].map(([field, label, inputType, required]) => (
                  <div key={field} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? "#94a3b8" : "#475569", display: "block", marginBottom: 4 }}>{label}</label>
                    <input
                      type={inputType}
                      required={required}
                      value={reqForm[field]}
                      onChange={(e) => setReqForm((f) => ({ ...f, [field]: e.target.value }))}
                      style={{
                        width: "100%", padding: "9px 12px", borderRadius: 8,
                        border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0",
                        background: isDark ? "rgba(255,255,255,0.05)" : "#f8fafc",
                        color: isDark ? "#f8fafc" : "#0f172a", fontSize: 13, outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                ))}

                {/* Last field: depends on type (hidden for renting) */}
                {isRentingOffer ? null : isParticular ? (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? "#94a3b8" : "#475569", display: "block", marginBottom: 4 }}>Mensaje (opcional)</label>
                    <input
                      type="text"
                      value={reqForm.message}
                      onChange={(e) => setReqForm((f) => ({ ...f, message: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0", background: isDark ? "rgba(255,255,255,0.05)" : "#f8fafc", color: isDark ? "#f8fafc" : "#0f172a", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                ) : reqForm.type === "visit" ? (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? "#94a3b8" : "#475569", display: "block", marginBottom: 4 }}>¿Cuándo quieres ver el coche?</label>
                    <select
                      value={reqForm.when}
                      onChange={(e) => setReqForm((f) => ({ ...f, when: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0", background: isDark ? "rgba(255,255,255,0.05)" : "#f8fafc", color: isDark ? "#f8fafc" : "#0f172a", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                    >
                      <option value="">Selecciona una opción</option>
                      <option value="Lo antes posible">Lo antes posible</option>
                      <option value="Esta semana">Esta semana</option>
                      <option value="La próxima semana">La próxima semana</option>
                      <option value="Me lo indican ellos">Me lo indican ellos</option>
                    </select>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: isDark ? "#94a3b8" : "#475569", display: "block", marginBottom: 4 }}>¿Cuándo prefieres que te llamemos? (opcional)</label>
                    <input
                      type="text"
                      value={reqForm.when}
                      onChange={(e) => setReqForm((f) => ({ ...f, when: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0", background: isDark ? "rgba(255,255,255,0.05)" : "#f8fafc", color: isDark ? "#f8fafc" : "#0f172a", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                )}

                {reqError && (
                  <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 10 }}>{reqError}</div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setReqModal(false)}
                    style={{ flex: 1, padding: "11px 0", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0", background: "transparent", color: isDark ? "#94a3b8" : "#475569", borderRadius: 10, fontSize: 13, cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={reqState === "submitting"}
                    style={{ flex: 2, padding: "11px 0", background: isRentingOffer ? "linear-gradient(135deg,#059669,#047857)" : "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: reqState === "submitting" ? "not-allowed" : "pointer", opacity: reqState === "submitting" ? 0.7 : 1 }}
                  >
                    {reqState === "submitting" ? "Enviando…" : isRentingOffer ? "🔑 Solicitar renting" : "Enviar solicitud"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
