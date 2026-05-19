import { useTranslation } from "react-i18next";
import { useState } from "react";

export default function PortalVoDetailPage({
  themeMode,
  styles,
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
}) {
  const isDark = themeMode === "dark";
  const { t } = useTranslation();
  const [galleryIdx, setGalleryIdx] = useState(0);
  const allImages = selectedPortalVoOffer.images?.length
    ? selectedPortalVoOffer.images
    : selectedPortalVoOffer.image
    ? [selectedPortalVoOffer.image]
    : [];
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
            {allImages.length > 0 ? (
              <div>
                <img
                  src={allImages[galleryIdx]}
                  alt={selectedPortalVoOffer.title}
                  referrerPolicy="no-referrer"
                  style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
                  onError={(e) => { e.target.style.display = "none"; }}
                />
                {allImages.length > 1 && (
                  <div style={{ display: "flex", gap: 6, padding: "8px 10px", overflowX: "auto", background: isDark ? "rgba(2,6,23,0.6)" : "rgba(241,245,249,0.96)" }}>
                    {allImages.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setGalleryIdx(idx)}
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
                          src={url}
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
                    {formatCurrency(selectedPortalVoOffer.price)}
                  </span>
                  <span style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b" }}>{t("marketplace.modalityPurchase", "Compra")}</span>
                </div>
              )}
              {selectedPortalVoOffer.rentingAvailable && (() => {
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
                        <div
                          key={p.label}
                          style={{
                            background: isDark ? "rgba(52,211,153,0.08)" : "rgba(5,150,105,0.06)",
                            border: isDark ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(5,150,105,0.18)",
                            borderRadius: 10,
                            padding: "6px 12px",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: 10, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? "#34d399" : "#059669" }}>{formatCurrency(p.value)}/mes</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
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

        {relatedPortalVoOffers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: isDark ? "#6ee7b7" : "#059669", fontWeight: 700, marginBottom: 8 }}>{t("marketplace.relatedLabel")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
              {relatedPortalVoOffers.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => onOpenRelatedOffer(offer)}
                  style={{
                    textAlign: "left",
                    background: panelCardBg,
                    border: "1px solid rgba(148,163,184,0.14)",
                    borderRadius: 12,
                    padding: 12,
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: titleColor, marginBottom: 4 }}>{offer.title}</div>
                  <div style={{ fontSize: 11, color: metaColor, marginBottom: 4 }}>{offer.year} · {offer.location}</div>
                  <div style={{ fontSize: 13, color: isDark ? "#34d399" : "#059669", fontWeight: 800 }}>{formatCurrency(offer.price)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
