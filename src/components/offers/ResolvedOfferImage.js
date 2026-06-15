import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  buildImageProxyUrl,
  buildImageSearchProxyUrl,
  buildOfferImageSearchQuery,
  buildOfferLocalImageCandidates,
  buildOfferPlaceholderImage,
  slugifyOfferFolderName,
} from "../../utils/offerHelpers";

function OfferGuaranteeSeal({ months = 12, size = 54 }) {
  const { t } = useTranslation();
  const warrantyText = t("resolvedOfferImage.vehicleWithWarranty", { months });
  return (
    <div
      aria-label={warrantyText}
      title={warrantyText}
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        width: size,
        height: size,
        zIndex: 2,
        pointerEvents: "none",
        filter: "drop-shadow(0 6px 10px rgba(15,23,42,0.22))",
      }}
    >
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          background: "linear-gradient(90deg,#c8aa4f 0%, #e9e2a6 48%, #b8923f 100%)",
          clipPath: "polygon(50% 0%, 61% 4%, 72% 1%, 80% 9%, 91% 9%, 96% 19%, 100% 30%, 96% 41%, 100% 52%, 94% 62%, 94% 74%, 84% 81%, 76% 91%, 64% 94%, 50% 100%, 36% 94%, 24% 91%, 16% 81%, 6% 74%, 6% 62%, 0% 52%, 4% 41%, 0% 30%, 4% 19%, 9% 9%, 20% 9%, 28% 1%, 39% 4%)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "20%",
            width: "60%",
            height: "60%",
            display: "block",
          }}
        >
          <path
            d="M20 6.5 9.5 17 4 11.5"
            fill="none"
            stroke="#050505"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

export default function ResolvedOfferImage({ offer = {}, alt, loading = "lazy", style = {} }) {

  const fallbackSrc = buildOfferPlaceholderImage(offer);
  const searchQuery = buildOfferImageSearchQuery(offer);
  const localFolder = slugifyOfferFolderName(offer);
  const localCandidates = useMemo(
    () => buildOfferLocalImageCandidates({ imageFolder: localFolder }),
    [localFolder]
  );

  // Build direct image candidates from offer.images (array) first, then offer.image as fallback
  const directImageCandidates = useMemo(() => {
    const fromImages = Array.isArray(offer?.images)
      ? offer.images.map((u) => buildImageProxyUrl(u)).filter(Boolean)
      : [];
    const fromSingle = buildImageProxyUrl(offer?.image);
    const combined = fromImages.length > 0 ? fromImages : (fromSingle ? [fromSingle] : []);
    // Deduplicate
    return [...new Set(combined)];
  }, [offer?.images, offer?.image]);

  const imageCandidates = useMemo(() => {
    const aiCandidate = buildImageSearchProxyUrl(searchQuery);
    return [
      ...localCandidates,
      ...(offer?.preferAiImage
        ? [aiCandidate, ...directImageCandidates]
        : [...directImageCandidates, aiCandidate]),
      fallbackSrc,
    ].filter((candidate, index, array) => candidate && array.indexOf(candidate) === index);
  }, [searchQuery, directImageCandidates, offer?.preferAiImage, localCandidates, fallbackSrc]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [fallbackBlocked, setFallbackBlocked] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setFallbackBlocked(false);
  }, [imageCandidates]);

  const currentSrc = imageCandidates[Math.min(candidateIndex, imageCandidates.length - 1)] || fallbackSrc;
  const numericHeight =
    typeof style?.height === "number"
      ? style.height
      : Number.parseInt(String(style?.height || ""), 10);
  const sealSize = Number.isFinite(numericHeight)
    ? Math.max(42, Math.min(58, Math.round(numericHeight * 0.28)))
    : 54;

  return (
    <div
      style={{
        position: "relative",
        width: style?.width || "100%",
        height: style?.height,
        minHeight: style?.minHeight,
        maxHeight: style?.maxHeight,
        borderRadius: style?.borderRadius,
        overflow: style?.overflow || (style?.borderRadius ? "hidden" : undefined),
        display: "block",
        lineHeight: 0,
      }}
    >
      {!fallbackBlocked ? (
        <img
          src={currentSrc}
          alt={alt || offer?.title || "Oferta"}
          loading={loading}
          referrerPolicy="no-referrer"
          onError={() => {
            setCandidateIndex((current) => {
              const nextIndex = Math.min(current + 1, imageCandidates.length - 1);
              if (nextIndex === current) {
                setFallbackBlocked(true);
              }
              return nextIndex;
            });
          }}
          style={{
            ...style,
            width: "100%",
            height: style?.height || "auto",
            display: "block",
          }}
        />
      ) : (
        <div
          aria-label={alt || offer?.title || "Imagen no disponible"}
          style={{
            ...style,
            width: "100%",
            height: style?.height || "100%",
            minHeight: style?.minHeight || 120,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            padding: "14px 16px",
            background: "linear-gradient(135deg,#0f172a 0%,#0ea5e9 100%)",
            color: "#f8fafc",
            lineHeight: 1.3,
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#7dd3fc", marginBottom: 6 }}>
            Imagen orientativa no disponible
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
            {offer?.title || "Oferta recomendada"}
          </div>
          <div style={{ fontSize: 11, color: "#cbd5e1" }}>
            {offer?.source || "Proveedor"}
          </div>
        </div>
      )}
      {offer?.hasGuaranteeSeal ? <OfferGuaranteeSeal months={offer?.warrantyMonths || 12} size={sealSize} /> : null}
    </div>
  );
}
