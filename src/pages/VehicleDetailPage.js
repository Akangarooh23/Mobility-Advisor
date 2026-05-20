import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  buildImageProxyUrl,
  buildOfferPlaceholderImage,
  buildOfferLocalImageCandidates,
  slugifyOfferFolderName,
} from "../utils/offerHelpers";

const VEHICLE_DETAIL_CSS = `
/* ══ TOKENS ══ */
.vd-root{
  --bg:#f5f3ef;--bg2:#ffffff;--surface:#faf9f7;--border:#e8e4dc;
  --border2:rgba(0,0,0,.07);--txt:#1a1814;--muted:#7a756c;--subtle:#b0aca4;
  --acc:#BA7517;--acc2:#9a6010;--acc-bg:rgba(186,117,23,.08);
  --acc-border:rgba(186,117,23,.2);
  --eco-bg:#e8f5e9;--eco-txt:#2e7d32;
  --c-bg:#fff8e7;--c-txt:#7a5c00;
  --ev-bg:#e3f2fd;--ev-txt:#1565c0;
  --r:12px;--rs:8px;
  font-family:'DM Sans',sans-serif;
  font-weight:300;
  line-height:1.6;
  color:var(--txt);
  background:var(--bg);
  min-height:100vh;
}
.vd-root *,.vd-root *::before,.vd-root *::after{box-sizing:border-box;margin:0;padding:0}
/* BACK BAR */
.vd-back-bar{padding:1.25rem 2.5rem 0;max-width:1240px;margin:0 auto}
.vd-btn-back{display:inline-flex;align-items:center;gap:.45rem;background:#fff;border:1px solid var(--border);border-radius:30px;padding:.4rem 1rem;font-size:12px;font-weight:400;color:var(--muted);cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;text-decoration:none;font-weight:300}
.vd-btn-back:hover{border-color:var(--acc-border);color:var(--txt)}
.vd-btn-back svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
/* MAIN LAYOUT */
.vd-main{max-width:1240px;margin:0 auto;padding:1.25rem 2.5rem 4rem;display:grid;grid-template-columns:1fr 340px;gap:2rem;align-items:start}
.vd-left-primary,.vd-left-secondary{min-width:0}
.vd-left-secondary{grid-column:1/2}
/* GALLERY */
.vd-gallery{border-radius:16px;overflow:hidden;background:#000;position:relative;margin-bottom:1.25rem;aspect-ratio:16/9}
.vd-gallery img{width:100%;height:100%;object-fit:cover;display:block}
.vd-gallery-badge{position:absolute;top:1rem;left:1rem;background:var(--txt);color:#fff;font-size:10px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;padding:.3rem .75rem;border-radius:20px;display:flex;align-items:center;gap:.4rem}
.vd-gallery-badge::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--acc)}
.vd-portal-source{position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-radius:6px;padding:.3rem .65rem;font-size:11px;font-weight:500;color:var(--muted)}
/* TITLE */
.vd-car-brand{font-size:11px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:var(--acc);margin-bottom:.4rem}
.vd-car-name{font-family:'Playfair Display',serif;font-size:30px;font-weight:500;color:var(--txt);line-height:1.15;margin-bottom:.35rem}
.vd-car-version{font-size:14px;color:var(--muted);font-weight:300;margin-bottom:.9rem}
.vd-car-metas{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:1.5rem}
.vd-label-badge{display:inline-flex;align-items:center;gap:.3rem;font-size:11px;font-weight:600;padding:.25rem .65rem;border-radius:20px}
.vd-label-eco{background:var(--eco-bg);color:var(--eco-txt)}
.vd-label-c{background:var(--c-bg);color:var(--c-txt)}
.vd-label-0{background:var(--ev-bg);color:var(--ev-txt)}
.vd-label-b{background:#fce4ec;color:#880e4f}
.vd-fuel-pill{background:var(--acc-bg);border:1px solid var(--acc-border);color:var(--acc);font-size:11px;font-weight:500;padding:.25rem .7rem;border-radius:20px}
.vd-year-pill{background:var(--surface);border:1px solid var(--border);color:var(--muted);font-size:11px;padding:.25rem .7rem;border-radius:20px}
/* SPECS GRID */
.vd-specs-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin-bottom:1.5rem}
.vd-spec-card{background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:1rem .9rem;transition:border-color .15s}
.vd-spec-card:hover{border-color:var(--acc-border)}
.vd-spec-icon{font-size:18px;margin-bottom:.4rem;display:block}
.vd-spec-val{font-size:16px;font-weight:500;color:var(--txt);line-height:1;margin-bottom:.2rem}
.vd-spec-lbl{font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--subtle)}
/* SECTION */
.vd-section{background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:1.5rem;margin-bottom:1rem}
.vd-section-title{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:1.1rem;display:flex;align-items:center;gap:.5rem}
.vd-section-title::after{content:'';flex:1;height:1px;background:var(--border)}
.vd-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
.vd-detail-row{display:flex;justify-content:space-between;align-items:center;padding:.55rem .75rem;background:var(--surface);border-radius:var(--rs)}
.vd-detail-key{font-size:12px;color:var(--muted);font-weight:400}
.vd-detail-val{font-size:12.5px;font-weight:500;color:var(--txt);text-align:right}
/* CO2 BAR */
.vd-co2-wrap{display:flex;align-items:center;gap:.75rem}
.vd-co2-bar-bg{flex:1;height:6px;background:linear-gradient(90deg,#43a047,#ffb300,#e53935);border-radius:3px;position:relative}
.vd-co2-marker{position:absolute;top:-4px;width:14px;height:14px;border-radius:50%;background:var(--txt);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);transform:translateX(-50%)}
.vd-co2-val{font-size:12px;font-weight:600;color:var(--txt);white-space:nowrap}
/* ANALYSIS BOX */
.vd-analysis-box{background:linear-gradient(135deg,var(--txt) 0%,#2a2520 100%);border-radius:var(--r);padding:1.5rem;margin-bottom:1rem;color:#fff}
.vd-ab-title{font-family:'Playfair Display',serif;font-size:16px;color:#fff;margin-bottom:1rem}
.vd-ab-rows{display:flex;flex-direction:column;gap:.5rem}
.vd-ab-row{display:flex;align-items:center;gap:.75rem;font-size:12.5px;padding:.5rem .75rem;background:rgba(255,255,255,.07);border-radius:8px}
.vd-ab-ico{font-size:15px;flex-shrink:0}
.vd-ab-txt{color:rgba(255,255,255,.8)}
.vd-ab-val{margin-left:auto;font-weight:500;color:#fff;font-size:12px;text-align:right}
.vd-ab-link{color:inherit;text-decoration:none;display:inline-flex;align-items:center;justify-content:flex-end;cursor:pointer}
.vd-ab-link:hover{text-decoration:underline;text-underline-offset:2px}
.vd-ab-positive{color:#66bb6a}
.vd-ab-neutral{color:#ffa726}
/* PRICE CARD */
.vd-price-card{background:#fff;border:1px solid var(--border);border-radius:16px;padding:1.5rem;overflow:hidden;position:relative}
.vd-price-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--acc),#d4881e)}
.vd-price-main-label{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--subtle);margin-bottom:.35rem}
.vd-price-main{font-family:'Playfair Display',serif;font-size:36px;font-weight:500;color:var(--txt);line-height:1;margin-bottom:.2rem}
.vd-price-main sup{font-size:20px;vertical-align:super;font-family:'DM Sans',sans-serif;font-weight:400}
.vd-price-saving{font-size:12px;color:var(--eco-txt);font-weight:500;margin-bottom:1.1rem;display:flex;align-items:center;gap:.35rem}
.vd-finance-block{background:var(--acc-bg);border:1px solid var(--acc-border);border-radius:10px;padding:1rem;margin-bottom:1.1rem}
.vd-finance-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem}
.vd-finance-row:last-child{margin-bottom:0}
.vd-finance-key{font-size:12px;color:var(--muted)}
.vd-finance-val{font-size:13px;font-weight:500;color:var(--txt)}
.vd-finance-monthly{font-size:18px;font-weight:600;color:var(--acc);line-height:1}
.vd-finance-monthly span{font-size:12px;font-weight:400;color:var(--muted)}
/* BUTTONS */
.vd-btn-primary{display:block;background:var(--acc);color:#fff;border:none;border-radius:10px;padding:.8rem;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;text-align:center;margin-bottom:.5rem;transition:background .2s;letter-spacing:.02em;width:100%}
.vd-btn-primary:hover{background:var(--acc2)}
.vd-btn-secondary{display:block;background:#fff;color:var(--txt);border:1.5px solid var(--border);border-radius:10px;padding:.75rem;font-size:13px;font-weight:400;font-family:'DM Sans',sans-serif;cursor:pointer;text-align:center;margin-bottom:.5rem;transition:all .15s;width:100%}
.vd-btn-secondary:hover{border-color:var(--acc-border);color:var(--acc)}
.vd-btn-ghost{display:block;background:none;border:none;color:var(--muted);font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer;text-align:center;padding:.4rem;transition:color .15s;width:100%}
.vd-btn-ghost:hover{color:var(--txt)}
/* TRUST ROW */
.vd-trust-row{display:flex;justify-content:center;gap:1.25rem;margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border)}
.vd-trust-item{display:flex;flex-direction:column;align-items:center;gap:.2rem}
.vd-trust-ico{font-size:16px}
.vd-trust-lbl{font-size:10px;color:var(--subtle);font-weight:400;text-align:center;line-height:1.3}
/* SELLER CARD */
.vd-seller-card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:1.25rem}
.vd-seller-type{display:inline-flex;align-items:center;gap:.3rem;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--acc);background:var(--acc-bg);padding:.2rem .6rem;border-radius:20px;margin-bottom:.6rem}
.vd-seller-name{font-size:14px;font-weight:500;color:var(--txt);margin-bottom:.25rem}
.vd-seller-meta{font-size:12px;color:var(--muted)}
.vd-seller-portal{display:flex;align-items:center;gap:.4rem;margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border);font-size:11.5px;color:var(--muted)}
.vd-portal-dot{width:6px;height:6px;border-radius:50%;background:var(--acc);flex-shrink:0}
/* WARRANTY */
.vd-warranty-row{display:flex;align-items:center;gap:.6rem;background:var(--eco-bg);border-radius:8px;padding:.6rem .85rem;font-size:12px;color:var(--eco-txt);font-weight:500}
/* RIGHT COL */
.vd-right{display:flex;flex-direction:column;gap:1rem;position:sticky;top:1.25rem}
/* MODAL */
.vd-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);z-index:200;display:none;align-items:center;justify-content:center}
.vd-modal-overlay.open{display:flex}
.vd-modal{background:#fff;border-radius:20px;padding:2rem;max-width:440px;width:90%;position:relative}
.vd-modal h3{font-family:'Playfair Display',serif;font-size:20px;margin-bottom:.5rem}
.vd-modal p{font-size:13px;color:var(--muted);margin-bottom:1.25rem;line-height:1.65}
.vd-modal-fields{display:flex;flex-direction:column;gap:.6rem;margin-bottom:1.25rem}
.vd-modal-input{border:1px solid var(--border);border-radius:8px;padding:.65rem .9rem;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;transition:border-color .15s;width:100%}
.vd-modal-input:focus{border-color:var(--acc-border)}
.vd-modal-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)}
.vd-modal-submit{background:var(--acc);color:#fff;border:none;border-radius:8px;padding:.75rem;font-size:14px;font-weight:500;width:100%;cursor:pointer;font-family:'DM Sans',sans-serif}
.vd-modal-note{font-size:11px;color:var(--subtle);text-align:center;margin-top:.65rem}
/* RESPONSIVE */
@media(max-width:900px){
  .vd-main{grid-template-columns:1fr;padding:1.25rem 1rem}
  .vd-specs-grid{grid-template-columns:repeat(2,1fr)}
  .vd-detail-grid{grid-template-columns:1fr}
  .vd-right{position:static}
  .vd-left-secondary{grid-column:auto}
  .vd-back-bar{padding:1.25rem 1rem 0}
}
`;

function fmt(n) {
  return Number(n || 0).toLocaleString("es-ES");
}

function labelClass(l) {
  const v = (l || "").toUpperCase();
  if (v === "ECO") return "vd-label-eco";
  if (v === "0" || v === "0 EMISIONES") return "vd-label-0";
  if (v === "B") return "vd-label-b";
  return "vd-label-c";
}

function co2Pct(s) {
  const n = parseInt(s) || 0;
  return Math.min(100, Math.round((n / 200) * 100));
}

function fuelIcon(f) {
  const m = {
    Diésel: "⛽",
    Gasolina: "⛽",
    Híbrido: "🔋",
    GLP: "🟢",
    Eléctrico: "⚡",
    "Híbrido Enchufable": "🔌",
  };
  return m[f] || "⛽";
}

function portalLabel(p) {
  return (
    {
      flexicar: "Flexicar",
      autohero: "Autohero",
      autoscout24: "AutoScout24",
      "coches.com": "Coches.com",
      "coches.net": "Coches.net",
    }[p] || p
  );
}

function safeText(value) {
  return String(value || "").trim();
}

function toNumberLoose(value) {
  if (Number.isFinite(value)) {
    return Number(value);
  }

  const raw = safeText(value);
  if (!raw) {
    return null;
  }

  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) {
    return null;
  }

  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseYear(text) {
  const match = safeText(text).match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function parseKm(text) {
  const match = safeText(text).match(/(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*km\b/i);
  if (!match) {
    return null;
  }
  return toNumberLoose(match[1]);
}

function parseCv(text) {
  const match = safeText(text).match(/(\d{2,3})\s*cv\b/i);
  return match ? Number(match[1]) : null;
}

function parseKw(text) {
  const match = safeText(text).match(/(\d{2,3})\s*kw\b/i);
  return match ? Number(match[1]) : null;
}

function parseDisplacementCc(text) {
  const match = safeText(text).match(/\b(\d(?:[.,]\d)?)\b/);
  if (!match) {
    return "";
  }

  const liters = Number(String(match[1]).replace(",", "."));
  if (!Number.isFinite(liters) || liters < 0.8 || liters > 8) {
    return "";
  }

  return `${Math.round(liters * 1000)}cc`;
}

function parseFuel(text) {
  const haystack = safeText(text).toLowerCase();
  if (/diesel|di[eé]sel/.test(haystack)) return "Diésel";
  if (/gasolina/.test(haystack)) return "Gasolina";
  if (/h[ií]brido|hybrid/.test(haystack)) return "Híbrido";
  if (/el[eé]ctrico|electric/.test(haystack)) return "Eléctrico";
  if (/glp/.test(haystack)) return "GLP";
  return "";
}

function parseTransmission(text) {
  const haystack = safeText(text).toLowerCase();
  if (/autom[aá]tica|automatic/.test(haystack)) return "Automática";
  if (/manual/.test(haystack)) return "Manual";
  return "";
}

function parseBrandModelVersion(offer) {
  const explicitBrand = safeText(offer?.brand);
  const explicitModel = safeText(offer?.model);
  const explicitVersion = safeText(offer?.version);
  if (explicitBrand || explicitModel || explicitVersion) {
    return { brand: explicitBrand, model: explicitModel, version: explicitVersion };
  }

  const title = safeText(offer?.title);
  if (!title) {
    return { brand: "", model: "", version: "" };
  }

  const parts = title.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { brand: parts[0], model: title, version: "" };
  }

  return {
    brand: parts[0],
    model: parts.slice(1, 3).join(" ") || parts[1] || "",
    version: parts.slice(3).join(" "),
  };
}

function normalizeOffer(offer) {
  const desc = safeText(offer?.description);
  const title = safeText(offer?.title);
  const fullText = `${title} ${desc}`;
  const parsed = parseBrandModelVersion(offer);

  const priceValue = toNumberLoose(offer?.price) || toNumberLoose(offer?.priceText);
  const monthlyPriceValue = toNumberLoose(offer?.monthlyPrice);
  const yearValue = toNumberLoose(offer?.year) || parseYear(desc);
  const mileageValue = toNumberLoose(offer?.mileage) || parseKm(desc);
  const powerCvValue = toNumberLoose(offer?.powerCv) || toNumberLoose(offer?.power) || parseCv(fullText);
  const powerKwValue = toNumberLoose(offer?.powerKw) || parseKw(fullText);
  const financePriceValue = toNumberLoose(offer?.financePrice);

  const fuelValue = safeText(offer?.fuel) || parseFuel(fullText);
  const transmissionValue = safeText(offer?.transmission) || parseTransmission(fullText);

  return {
    ...offer,
    ...parsed,
    model: parsed.model || title || "Vehículo",
    version: parsed.version || desc,
    price: priceValue,
    monthlyPrice: monthlyPriceValue,
    financePrice: financePriceValue,
    year: yearValue,
    mileage: mileageValue,
    powerCv: powerCvValue,
    fuel: fuelValue,
    transmission: transmissionValue,
    bodyType: safeText(offer?.bodyType || offer?.body),
    environmentalLabel: safeText(offer?.environmentalLabel || offer?.label || "C"),
    displacement: safeText(offer?.displacement) || parseDisplacementCc(title),
    powerKw: powerKwValue,
    city: safeText(offer?.city),
    province: safeText(offer?.province),
    sellerType: safeText(offer?.sellerType),
    dealerName: safeText(offer?.dealerName),
  };
}

function GalleryImage({ offer }) {
  const [candidates] = useState(() => {
    const direct = buildImageProxyUrl(offer?.image || offer?.imageUrl || "");
    const local = buildOfferLocalImageCandidates({ imageFolder: slugifyOfferFolderName(offer) });
    const fallback = buildOfferPlaceholderImage(offer);
    return [direct, ...local, fallback].filter((c, i, a) => c && a.indexOf(c) === i);
  });
  const [idx, setIdx] = useState(0);
  const src = candidates[Math.min(idx, candidates.length - 1)];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={offer?.title || ""}
      referrerPolicy="no-referrer"
      onError={() => setIdx((i) => Math.min(i + 1, candidates.length - 1))}
    />
  );
}

export default function VehicleDetailPage({ offer, onBack }) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalType, setModalType] = React.useState("info");
  const [contactForm, setContactForm] = React.useState({ name: "", phone: "", email: "", when: "" });
  const [submitted, setSubmitted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState("");
  const [isReserved, setIsReserved] = React.useState(false);
  const [alertEmail, setAlertEmail] = React.useState("");
  const [alertModalOpen, setAlertModalOpen] = React.useState(false);
  const [alertSubmitted, setAlertSubmitted] = React.useState(false);
  const [alertSubmitting, setAlertSubmitting] = React.useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    fetch("/api/leads?reserved=1")
      .then((r) => r.json())
      .then((d) => {
        const offerUrl = offer?.url || offer?.searchUrl || "";
        if (d.ok && offerUrl && Array.isArray(d.reservedUrls)) {
          setIsReserved(d.reservedUrls.includes(offerUrl));
        }
      })
      .catch(() => {});
  }, [offer]);

  if (!offer) {
    return (
      <div className="vd-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ color: "var(--muted)", fontSize: 14 }}>{t("vehicleDetail.notAvailable")}</div>
      </div>
    );
  }

  const car = normalizeOffer(offer);
  const offerUrl = safeText(car.url || car.searchUrl);

  const label = car.environmentalLabel || car.label || "C";
  const loc = [car.city, car.province].filter(Boolean).join(", ") || t("vehicleDetail.locationNA");
  const locationLabel = loc === t("vehicleDetail.locationNA") ? t("vehicleDetail.noLocation") : loc;
  const yearLabel = car.year || "N/D";

  async function handleAlertSubmit() {
    if (!alertEmail) return;
    setAlertSubmitting(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "alert",
          email: alertEmail,
          vehicle_url: car.url || car.searchUrl || "",
          vehicle_title: `${car.brand || ""} ${car.model || ""} ${car.year || ""}`.trim(),
        }),
      });
      setAlertSubmitted(true);
      setTimeout(() => { setAlertModalOpen(false); setAlertSubmitted(false); setAlertEmail(""); }, 3000);
    } catch { /* silent */ } finally {
      setAlertSubmitting(false);
    }
  }

  async function handleSubmit() {
    setSubmitError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactForm.name,
          phone: contactForm.phone,
          email: contactForm.email,
          when: contactForm.when,
          type: modalType,
          vehicle_id: car.id || car.offerId || "",
          vehicle_title: `${car.brand || ""} ${car.model || ""} ${car.year || ""}`.trim(),
          vehicle_url: car.url || car.searchUrl || "",
          portal: car.portal || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      setSubmitted(true);
      setTimeout(() => { setModalOpen(false); setSubmitted(false); }, 3000);
    } catch (err) {
      setSubmitError(err.message || "No se pudo enviar. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="vd-root">
      {/* Inject scoped CSS */}
      <style>{VEHICLE_DETAIL_CSS}</style>

      {/* BACK */}
      <div className="vd-back-bar">
        <button className="vd-btn-back" onClick={onBack}>
          <svg viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {t("vehicleDetail.back")}
        </button>
      </div>

      {/* MAIN GRID */}
      <div className="vd-main">
        {/* ── LEFT ── */}
        <div className="vd-left-primary">
          {/* GALLERY */}
          <div className="vd-gallery">
            <GalleryImage offer={car} />
            <div className="vd-gallery-badge">{t("vehicleDetail.analysisLabel")}</div>
            <div className="vd-portal-source">{t("vehicleDetail.source")}: {portalLabel(car.portal)}</div>
          </div>

          {/* TITLE BLOCK */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div className="vd-car-brand">{car.brand}</div>
            <div className="vd-car-name">{car.model}</div>
            <div className="vd-car-version">{car.version}</div>
            <div className="vd-car-metas">
              <span className={`vd-label-badge ${labelClass(label)}`}>
                {label.toUpperCase() === "0" ? "0 Emisiones" : label}
              </span>
              <span className="vd-fuel-pill">
                {fuelIcon(car.fuel)} {car.fuel || "N/D"}
              </span>
              <span className="vd-year-pill">{car.year || "N/D"}</span>
              <span className="vd-year-pill">📍 {locationLabel}</span>
            </div>
          </div>

          {/* SPECS GRID */}
          <div className="vd-specs-grid">
            <div className="vd-spec-card">
              <span className="vd-spec-icon">🛣️</span>
              <div className="vd-spec-val">{car.mileage ? `${fmt(car.mileage)} km` : "—"}</div>
              <div className="vd-spec-lbl">{t("vehicleDetail.mileage")}</div>
            </div>
            <div className="vd-spec-card">
              <span className="vd-spec-icon">⚡</span>
              <div className="vd-spec-val">{car.powerCv || car.power || "—"} CV</div>
              <div className="vd-spec-lbl">
                {t("vehicleDetail.power")}{car.powerKw ? ` · ${car.powerKw} kW` : ""}
              </div>
            </div>
            <div className="vd-spec-card">
              <span className="vd-spec-icon">⚙️</span>
              <div className="vd-spec-val">{car.transmission || "—"}</div>
              <div className="vd-spec-lbl">{t("vehicleDetail.transmission")}</div>
            </div>
            <div className="vd-spec-card">
              <span className="vd-spec-icon">🚗</span>
              <div className="vd-spec-val">{car.bodyType || car.body || "—"}</div>
              <div className="vd-spec-lbl">{t("vehicleDetail.bodyType")}</div>
            </div>
          </div>

        </div>

        {/* ── RIGHT ── */}
        <div className="vd-right">
          {/* PRICE CARD */}
          <div className="vd-price-card">
            <div className="vd-price-main-label">{t("vehicleDetail.purchasePrice")}</div>
            <div className="vd-price-main">
              <sup>€</sup>{car.price ? fmt(car.price) : "—"}
            </div>
            <div style={{ height: ".75rem" }} />

            {(car.monthlyPrice > 0 || car.financePrice > 0) && (
              <div className="vd-finance-block">
                {car.financePrice > 0 && (
                  <div className="vd-finance-row">
                    <span className="vd-finance-key">{t("vehicleDetail.financedPrice")}</span>
                    <div className="vd-finance-monthly">
                      €{fmt(car.financePrice)}
                    </div>
                  </div>
                )}
                {car.monthlyPrice > 0 && (
                  <div className="vd-finance-row">
                    <span className="vd-finance-key">{t("vehicleDetail.monthlyCost")}</span>
                    <span className="vd-finance-val">{fmt(car.monthlyPrice)} €/mes</span>
                  </div>
                )}
              </div>
            )}

            {isReserved ? (
              <>
                <div style={{ background: "#fef9c3", border: "1.5px solid #fbbf24", borderRadius: 10, padding: "12px 14px", marginBottom: ".5rem", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>🔒 Vehículo temporalmente reservado</div>
                  <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.5 }}>Este vehículo tiene una cita confirmada. Si la reserva se cancela, te avisaremos.</div>
                </div>
                <button className="vd-btn-secondary" onClick={() => setAlertModalOpen(true)} style={{ borderColor: "#3b82f6", color: "#2563eb" }}>
                  🔔 Avisarme si vuelve a estar disponible
                </button>
              </>
            ) : (
              <>
                <button className="vd-btn-primary" onClick={() => { setModalType("info"); setModalOpen(true); }}>
                  {t("vehicleDetail.requestInfo")}
                </button>
                <button className="vd-btn-secondary" onClick={() => { setModalType("visit"); setModalOpen(true); }}>
                  {t("vehicleDetail.scheduleVisit")}
                </button>
                <button className="vd-btn-secondary" onClick={() => { setModalType("question"); setModalOpen(true); }}>
                  {t("vehicleDetail.askAboutCar")}
                </button>
              </>
            )}
            <button
              className="vd-btn-ghost"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: `${car.brand} ${car.model}`, url: window.location.href });
                } else {
                  navigator.clipboard?.writeText(window.location.href);
                }
              }}
            >
              {t("vehicleDetail.shareCard")}
            </button>

            <div className="vd-trust-row">
              <div className="vd-trust-item">
                <span className="vd-trust-ico">🛡️</span>
                <span className="vd-trust-lbl">{t("vehicleDetail.trustNoData")}<br />{t("vehicleDetail.trustToSeller")}</span>
              </div>
              <div className="vd-trust-item">
                <span className="vd-trust-ico">⚡</span>
                <span className="vd-trust-lbl">{t("vehicleDetail.trustResponse")}<br />&lt; 2 {t("vehicleDetail.trustHours")}</span>
              </div>
              <div className="vd-trust-item">
                <span className="vd-trust-ico">📊</span>
                <span className="vd-trust-lbl">{t("vehicleDetail.trustPrice")}<br />{t("vehicleDetail.trustAnalyzed")}</span>
              </div>
              <div className="vd-trust-item">
                <span className="vd-trust-ico">🆓</span>
                <span className="vd-trust-lbl">{t("vehicleDetail.trustService")}<br />{t("vehicleDetail.trustFree")}</span>
              </div>
            </div>
          </div>

          {/* SELLER CARD */}
          <div className="vd-seller-card">
            <div className="vd-seller-type">
              {car.sellerType === "profesional" ? `🏢 ${t("vehicleDetail.professional")}` : `👤 ${t("vehicleDetail.private")}`}
            </div>
            <div className="vd-seller-name">
              {car.dealerName || t("vehicleDetail.verifiedSeller")}
            </div>
            <div className="vd-seller-meta">
              {t("vehicleDetail.contactDataInfo")}
            </div>
            <div className="vd-seller-portal">
              <div className="vd-portal-dot" />
              {t("vehicleDetail.listingPublished", { portal: portalLabel(car.portal) })}
            </div>
          </div>

          {car.warrantyMonths > 0 && (
            <div className="vd-warranty-row">
              ✅ {t("vehicleDetail.warrantyIncluded", { months: car.warrantyMonths })}
            </div>
          )}
        </div>

        <div className="vd-left-secondary">
          {/* TECHNICAL */}
          <div className="vd-section">
            <div className="vd-section-title">{t("vehicleDetail.technicalSheet")}</div>
            <div className="vd-detail-grid">
              <div className="vd-detail-row">
                <span className="vd-detail-key">{t("vehicleDetail.displacement")}</span>
                <span className="vd-detail-val">{car.displacement || "—"}</span>
              </div>
              <div className="vd-detail-row">
                <span className="vd-detail-key">{t("vehicleDetail.traction")}</span>
                <span className="vd-detail-val">{car.traction || "—"}</span>
              </div>
              <div className="vd-detail-row">
                <span className="vd-detail-key">{t("vehicleDetail.transmission")}</span>
                <span className="vd-detail-val">{car.transmission || "—"}</span>
              </div>
              <div className="vd-detail-row">
                <span className="vd-detail-key">{t("vehicleDetail.sellerType")}</span>
                <span className="vd-detail-val">
                  {car.sellerType === "profesional"
                    ? t("vehicleDetail.professional")
                    : car.sellerType === "particular"
                      ? t("vehicleDetail.private")
                      : car.sellerType || "—"}
                </span>
              </div>
              <div className="vd-detail-row">
                <span className="vd-detail-key">{t("vehicleDetail.doors")}</span>
                <span className="vd-detail-val">{car.doors || "—"}</span>
              </div>
              <div className="vd-detail-row">
                <span className="vd-detail-key">{t("vehicleDetail.seats")}</span>
                <span className="vd-detail-val">{car.seats || "—"}</span>
              </div>
              <div className="vd-detail-row">
                <span className="vd-detail-key">{t("vehicleDetail.color")}</span>
                <span className="vd-detail-val">{car.color || "—"}</span>
              </div>
              <div className="vd-detail-row">
                <span className="vd-detail-key">{t("vehicleDetail.avgConsumption")}</span>
                <span className="vd-detail-val">{car.consumption ? `${car.consumption} l/100km` : "—"}</span>
              </div>
              <div className="vd-detail-row">
                <span className="vd-detail-key">{t("vehicleDetail.nextITV")}</span>
                <span className="vd-detail-val">{car.nextITV || "—"}</span>
              </div>
              <div className="vd-detail-row">
                <span className="vd-detail-key">{t("vehicleDetail.warranty")}</span>
                <span className="vd-detail-val">{car.warrantyMonths > 0 ? `${car.warrantyMonths} ${t("vehicleDetail.months")}` : "—"}</span>
              </div>
            </div>
          </div>

          {/* CO2 */}
          <div className="vd-section">
            <div className="vd-section-title">{t("vehicleDetail.co2Emissions")}</div>
            <div className="vd-co2-wrap">
              <div className="vd-co2-val">{car.co2 || "N/D"}</div>
              <div className="vd-co2-bar-bg">
                <div
                  className="vd-co2-marker"
                  style={{ left: `${car.co2 ? co2Pct(car.co2) : 50}%` }}
                />
              </div>
              <div className="vd-co2-val" style={{ color: "var(--subtle)", fontWeight: 400 }}>
                200 g/km
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--subtle)", marginTop: ".6rem" }}>
              {t("vehicleDetail.envLabel")}:{" "}
              <strong style={{ color: "var(--txt)" }}>
                {label.toUpperCase() === "0" ? "0 Emisiones (CERO)" : label}
              </strong>
            </div>
          </div>

          {/* CARSWISE ANALYSIS */}
          <div className="vd-analysis-box">
            <div className="vd-ab-title">{t("vehicleDetail.analysisTitle")}</div>
            <div className="vd-ab-rows">
              <div className="vd-ab-row">
                <span className="vd-ab-ico">🛡️</span>
                <span className="vd-ab-txt">{t("vehicleDetail.verifiedSellerLabel")}</span>
                <span className="vd-ab-val">
                  {car.sellerType === "profesional" ? `✓ ${t("vehicleDetail.professional")}` : t("vehicleDetail.private")}
                </span>
              </div>
              <div className="vd-ab-row">
                <span className="vd-ab-ico">📅</span>
                <span className="vd-ab-txt">{t("vehicleDetail.age")}</span>
                <span className="vd-ab-val">
                  {yearLabel}
                </span>
              </div>
              <div className="vd-ab-row">
                <span className="vd-ab-ico">📍</span>
                <span className="vd-ab-txt">{t("vehicleDetail.location")}</span>
                <span className="vd-ab-val">{loc}</span>
              </div>
              <div className="vd-ab-row">
                <span className="vd-ab-ico">🔗</span>
                <span className="vd-ab-txt">{t("vehicleDetail.publishedIn")}</span>
                <span className="vd-ab-val">
                  {offerUrl ? (
                    <a
                      className="vd-ab-link"
                      href={offerUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={t("vehicleDetail.openOriginal")}
                      aria-label={`${t("vehicleDetail.openOfferIn")} ${portalLabel(car.portal)}`}
                    >
                      {portalLabel(car.portal)}
                    </a>
                  ) : (
                    portalLabel(car.portal)
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ALERT MODAL */}
      {alertModalOpen && (
        <div className="vd-modal-overlay open" onClick={(e) => e.target === e.currentTarget && setAlertModalOpen(false)}>
          <div className="vd-modal">
            <button className="vd-modal-close" onClick={() => setAlertModalOpen(false)}>×</button>
            <h3>🔔 Alerta de disponibilidad</h3>
            <p>Te avisaremos por email en cuanto este vehículo vuelva a estar disponible.</p>
            {alertSubmitted ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--eco-txt)", fontWeight: 500 }}>
                ✅ ¡Alerta activada! Te avisaremos si se libera.
              </div>
            ) : (
              <>
                <div className="vd-modal-fields">
                  <input
                    className="vd-modal-input"
                    type="email"
                    placeholder="Tu email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                  />
                </div>
                <button className="vd-modal-submit" onClick={handleAlertSubmit} disabled={alertSubmitting || !alertEmail}>
                  {alertSubmitting ? "Guardando…" : "Activar alerta"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* CONTACT MODAL */}
      {modalOpen && (
        <div
          className="vd-modal-overlay open"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="vd-modal">
            <button className="vd-modal-close" onClick={() => setModalOpen(false)}>
              ×
            </button>
            <h3>{t("vehicleDetail.modalTitle")}</h3>
            <p>{t("vehicleDetail.modalDesc")}</p>
            {submitted ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--eco-txt)", fontWeight: 500 }}>
                ✅ {t("vehicleDetail.requestSent")}
              </div>
            ) : (
              <>
                <div className="vd-modal-fields">
                  <input
                    className="vd-modal-input"
                    type="text"
                    placeholder={t("vehicleDetail.yourName")}
                    value={contactForm.name}
                    onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <input
                    className="vd-modal-input"
                    type="tel"
                    placeholder={t("vehicleDetail.yourPhone")}
                    value={contactForm.phone}
                    onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                  <input
                    className="vd-modal-input"
                    type="email"
                    placeholder="Email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                  />
                  <select
                    className="vd-modal-input"
                    style={{ appearance: "none", cursor: "pointer" }}
                    value={contactForm.when}
                    onChange={(e) => setContactForm((f) => ({ ...f, when: e.target.value }))}
                  >
                    <option value="">{t("vehicleDetail.whenOption")}</option>
                    <option value="thisweek">{t("vehicleDetail.thisWeek")}</option>
                    <option value="nextweek">{t("vehicleDetail.nextWeek")}</option>
                    <option value="them">{t("vehicleDetail.theyIndicate")}</option>
                  </select>
                </div>
                {submitError && (
                  <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 8, padding: "6px 10px", background: "#ffeaea", borderRadius: 6 }}>
                    {submitError}
                  </div>
                )}
                <button className="vd-modal-submit" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Enviando…" : t("vehicleDetail.requestAppointment")}
                </button>
                <div className="vd-modal-note">
                  {t("vehicleDetail.dataPrivacyNote")}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
