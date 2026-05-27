import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { buildImageProxyUrl, buildOfferLocalImageCandidates, slugifyOfferFolderName } from "../utils/offerHelpers";

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
  onLeadCreated,
  isReserved = false,
}) {
  const isDark = themeMode === "dark";
  const { t } = useTranslation();
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [galleryFailed, setGalleryFailed] = useState(false);
  const [reqModal, setReqModal] = useState(false);
  const [reqForm, setReqForm] = useState({ name: "", phone: "", email: "", when: "", type: "info", message: "" });
  const [reqState, setReqState] = useState("idle");
  const [reqError, setReqError] = useState("");
  const [offerStats, setOfferStats] = useState(null);

  const isParticular = (selectedPortalVoOffer.sellerType || "").toLowerCase() === "particular";
  const isRentingReserved = isReserved && selectedPortalVoOffer.rentingAvailable && selectedPortalVoOffer.unitsAvailable <= 1 && !selectedPortalVoOffer.availableForPurchase;

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
          }),
        });
      } else {
        res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: reqForm.name,
            phone: reqForm.phone,
            email: reqForm.email,
            when: reqForm.when,
            type: reqForm.type,
            vehicle_id: selectedPortalVoOffer.id,
            vehicle_title: selectedPortalVoOffer.title,
            vehicle_url: selectedPortalVoOffer.url || "",
            portal: "marketplace-vo",
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      setReqState("done");
      if (onLeadCreated) onLeadCreated();
    } catch (err) {
      setReqState("error");
      setReqError(err.message || "No se pudo enviar la solicitud");
    }
  }

  function openReqModal() {
    setReqForm({ name: "", phone: "", email: "", when: "", type: "info", message: "" });
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
              {isRentingReserved ? "Unidad reservada" : isParticular ? "Solicitar visita al vendedor" : "Solicitar información"}
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
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a", marginBottom: 8 }}>
                  {isParticular ? "¡Solicitud enviada al vendedor!" : "¡Solicitud recibida!"}
                </div>
                <div style={{ fontSize: 13, color: isDark ? "#94a3b8" : "#475569", lineHeight: 1.6 }}>
                  {isParticular
                    ? "El vendedor recibirá un email para proponerte fechas de visita."
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
                  {isParticular ? "Solicitar visita al vendedor" : "Solicitar información"}
                </div>
                <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", marginBottom: 18 }}>
                  {selectedPortalVoOffer.title}
                </div>

                {!isParticular && (
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

                {/* Last field: depends on type */}
                {isParticular ? (
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
                    style={{ flex: 2, padding: "11px 0", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: reqState === "submitting" ? "not-allowed" : "pointer", opacity: reqState === "submitting" ? 0.7 : 1 }}
                  >
                    {reqState === "submitting" ? "Enviando…" : "Enviar solicitud"}
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
