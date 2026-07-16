import { useEffect, useRef, useState } from "react";

const PARTNER_COLORS = {
  norauto:    "#2563eb",
  midas:      "#dc2626",
  carglass:   "#059669",
  euromaster: "#d97706",
  kwik_fit:   "#7c3aed",
};

function buildUserIcon(L, isPrecise) {
  return L.divIcon({
    html: isPrecise
      ? `<div style="width:18px;height:18px;border-radius:50%;background:#1d4ed8;border:3px solid white;box-shadow:0 0 0 5px rgba(29,78,216,0.25),0 2px 8px rgba(0,0,0,0.4)"></div>`
      : `<div style="width:14px;height:14px;border-radius:50%;background:white;border:2.5px dashed #1d4ed8;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
    className: "",
    iconSize:   isPrecise ? [18, 18] : [14, 14],
    iconAnchor: isPrecise ? [9, 9]   : [7, 7],
  });
}

function buildWorkshopIcon(L, color, isSelected) {
  const size = isSelected ? 38 : 30;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:${color};
      border:2px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,${isSelected ? 0.5 : 0.3});
      ${isSelected ? `outline:3px solid ${color}66;` : ""}
    "></div>`,
    className: "",
    iconSize:    [size, size],
    iconAnchor:  [isSelected ? 19 : 15, size],
    popupAnchor: [0, -size],
  });
}

export default function WorkshopMapModal({
  providers = [],
  userLocation,
  selectedProvider,
  onSelectProvider,
  onSearchHere,
  onClose,
}) {
  const mapRef          = useRef(null);
  const leafletMapRef   = useRef(null);
  const userMarkerRef   = useRef(null);
  const workshopMarkersRef = useRef([]);

  const [showSearchBtn, setShowSearchBtn] = useState(false);
  const [pendingBbox,   setPendingBbox]   = useState(null);

  // ── Effect 1: init map + tiles + moveend listener (once) ────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    import("leaflet").then((L) => {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const centerLat = userLocation?.lat || 40.4168;
      const centerLon = userLocation?.lon || -3.7038;
      const map = L.map(mapRef.current, { zoomControl: true }).setView([centerLat, centerLon], 13);
      leafletMapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // Show "Buscar en esta zona" after any pan or zoom
      map.on("moveend", () => {
        const b = map.getBounds();
        setPendingBbox({
          latMin: b.getSouth(),
          latMax: b.getNorth(),
          lonMin: b.getWest(),
          lonMax: b.getEast(),
        });
        setShowSearchBtn(true);
      });
    });

    window.__cwSelectProvider = (key) => {
      onSelectProvider(key);
      onClose();
    };

    return () => {
      delete window.__cwSelectProvider;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: fit initial bounds once providers + map are ready ─────────
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !providers.length) return;

    import("leaflet").then((L) => {
      const withCoords = providers.filter((p) => p.workshop?.lat != null);
      if (!withCoords.length) return;
      const userPt = userLocation?.lat ? [[userLocation.lat, userLocation.lon]] : [];
      const allPts = [...userPt, ...withCoords.map((p) => [p.workshop.lat, p.workshop.lon])];
      map.fitBounds(allPts, { padding: [40, 40], maxZoom: 14 });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 3: user location marker (updates whenever userLocation changes)
  useEffect(() => {
    if (!userLocation?.lat) return;
    let disposed = false;

    import("leaflet").then((L) => {
      if (disposed) return;
      const map = leafletMapRef.current;
      if (!map) return;

      if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }

      const isPrecise = userLocation.source === "precise_geocode";
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lon], { icon: buildUserIcon(L, isPrecise) })
        .addTo(map)
        .bindPopup(isPrecise
          ? "<b>📍 Tu ubicación exacta</b>"
          : "<b>📍 Ubicación aproximada</b><br><small>Usa '📍 Usar mi ubicación actual' para mayor precisión</small>"
        );

      if (isPrecise) {
        map.setView([userLocation.lat, userLocation.lon], Math.max(map.getZoom(), 13), { animate: true });
      }
    });

    return () => { disposed = true; };
  }, [userLocation]);

  // ── Effect 4: workshop markers (redraws whenever providers list changes) ─
  useEffect(() => {
    let disposed = false;

    import("leaflet").then((L) => {
      if (disposed) return;
      const map = leafletMapRef.current;
      if (!map) return;

      // Clear previous workshop markers
      workshopMarkersRef.current.forEach((m) => m.remove());
      workshopMarkersRef.current = [];

      providers
        .filter((p) => p.workshop?.lat != null && p.workshop?.lon != null)
        .forEach((provider) => {
          const { workshop, providerKey, providerName, isIndependent } = provider;
          const color      = isIndependent ? "#475569" : (PARTNER_COLORS[providerKey] || "#6366f1");
          const isSelected = providerKey === selectedProvider;

          const distText  = workshop.distanceKm != null ? `${workshop.distanceKm} km · ETA ${workshop.etaMinutes} min` : "";
          const phoneText = workshop.phone ? `<br>📞 ${workshop.phone}` : "";
          const badge     = isIndependent
            ? `<span style="background:#e2e8f0;color:#475569;font-size:10px;padding:1px 6px;border-radius:4px;font-weight:700">Independiente</span>`
            : `<span style="background:${color}22;color:${color};font-size:10px;padding:1px 6px;border-radius:4px;font-weight:700">${providerName}</span>`;

          const popup = L.popup({ maxWidth: 260 }).setContent(`
            <div style="font-family:system-ui,sans-serif;min-width:200px">
              <div style="margin-bottom:6px">${badge}</div>
              <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">${workshop.name || providerName}</div>
              ${workshop.address ? `<div style="font-size:12px;color:#64748b;margin-bottom:4px">📍 ${workshop.address}</div>` : ""}
              ${distText ? `<div style="font-size:12px;color:#64748b;margin-bottom:4px">🚗 ${distText}</div>` : ""}
              ${phoneText}
              <button onclick="window.__cwSelectProvider('${providerKey}')" style="
                margin-top:10px;width:100%;padding:7px 0;border:none;border-radius:7px;
                background:${color};color:white;font-size:12px;font-weight:700;cursor:pointer;
              ">${isSelected ? "✓ Seleccionado" : "Seleccionar este taller"}</button>
            </div>
          `);

          const marker = L.marker([workshop.lat, workshop.lon], { icon: buildWorkshopIcon(L, color, isSelected) })
            .addTo(map)
            .bindPopup(popup);

          workshopMarkersRef.current.push(marker);
        });
    });

    return () => { disposed = true; };
  }, [providers, selectedProvider]);

  const withCoords = providers.filter((p) => p.workshop?.lat != null);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ background: "#fff", borderRadius: 16, overflow: "hidden", width: "min(860px, 96vw)", height: "min(600px, 92vh)", display: "flex", flexDirection: "column", zIndex: 9999, boxShadow: "0 24px 60px rgba(0,0,0,0.30)" }}
        >
          {/* Header */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Talleres cercanos</span>
              <span style={{ fontSize: 12, color: "#64748b", marginLeft: 10 }}>{withCoords.length} con ubicación disponible</span>
            </div>
            <button onClick={onClose} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", padding: "5px 12px", fontSize: 13, cursor: "pointer", color: "#475569" }}>
              ✕ Cerrar
            </button>
          </div>

          {/* Map container — relative so the button overlay works */}
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

            {/* "Buscar en esta zona" button */}
            {showSearchBtn && (
              <button
                onClick={() => {
                  setShowSearchBtn(false);
                  if (pendingBbox && onSearchHere) onSearchHere(pendingBbox);
                }}
                style={{
                  position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                  zIndex: 1000, padding: "8px 18px", borderRadius: 20,
                  background: "#fff", border: "1px solid #cbd5e1",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
                  fontSize: 13, fontWeight: 700, color: "#1e293b",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                🔍 Buscar en esta zona
              </button>
            )}
          </div>

          {/* Legend */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            {Object.entries(PARTNER_COLORS).map(([key, color]) => {
              const found = providers.find((p) => p.providerKey === key);
              if (!found) return null;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>{found.providerName}</span>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#475569" }} />
              <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>Independiente</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1d4ed8", border: "2px solid white", boxShadow: "0 0 0 2px #1d4ed8" }} />
              <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>Tu ubicación</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
