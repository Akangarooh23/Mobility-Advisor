import { useEffect, useRef } from "react";

const PARTNER_COLORS = {
  norauto: "#2563eb",
  midas: "#dc2626",
  carglass: "#059669",
  euromaster: "#d97706",
  kwik_fit: "#7c3aed",
};


export default function WorkshopMapModal({
  providers = [],
  userLocation,
  selectedProvider,
  onSelectProvider,
  onClose,
}) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    // Dynamic import to avoid SSR issues
    import("leaflet").then((L) => {
      // Fix default icon path issue with webpack
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const centerLat = userLocation?.lat || 40.4168;
      const centerLon = userLocation?.lon || -3.7038;

      const map = L.map(mapRef.current, { zoomControl: true }).setView([centerLat, centerLon], 13);
      leafletMapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // User location marker — bigger + pulsing when precise, small/dashed when approximate
      if (userLocation?.lat) {
        const isPrecise = userLocation.source === "precise_geocode";
        const userIcon = L.divIcon({
          html: isPrecise
            ? `<div style="position:relative;width:20px;height:20px">
                <div style="position:absolute;inset:0;border-radius:50%;background:#1d4ed8;border:3px solid white;box-shadow:0 2px 10px rgba(29,78,216,0.6)"></div>
                <div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid #1d4ed8;opacity:0.4;animation:pulse 1.5s ease-out infinite"></div>
               </div>`
            : `<div style="width:14px;height:14px;border-radius:50%;background:white;border:2px dashed #1d4ed8;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
          className: "",
          iconSize: isPrecise ? [20, 20] : [14, 14],
          iconAnchor: isPrecise ? [10, 10] : [7, 7],
        });
        L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
          .addTo(map)
          .bindPopup(isPrecise
            ? "<b>📍 Tu ubicación exacta</b>"
            : "<b>📍 Ubicación aproximada</b><br><small>Introduce tu calle o usa 'Usar mi ubicación' para mayor precisión</small>"
          );
      }

      // Workshop markers
      const workshopsWithCoords = providers.filter(
        (p) => p.workshop?.lat != null && p.workshop?.lon != null
      );

      workshopsWithCoords.forEach((provider) => {
        const { workshop, providerKey, providerName, isIndependent } = provider;
        const color = isIndependent ? "#475569" : (PARTNER_COLORS[providerKey] || "#6366f1");
        const isSelected = providerKey === selectedProvider;

        const icon = L.divIcon({
          html: `<div style="
            width:${isSelected ? 38 : 30}px;
            height:${isSelected ? 38 : 30}px;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            background:${color};
            border:2px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,${isSelected ? 0.5 : 0.3});
            ${isSelected ? "outline:3px solid " + color + "66;" : ""}
          "></div>`,
          className: "",
          iconSize: [isSelected ? 38 : 30, isSelected ? 38 : 30],
          iconAnchor: [isSelected ? 19 : 15, isSelected ? 38 : 30],
          popupAnchor: [0, isSelected ? -38 : -30],
        });

        const distText = workshop.distanceKm != null ? `${workshop.distanceKm} km · ETA ${workshop.etaMinutes} min` : "";
        const phoneText = workshop.phone ? `<br>📞 ${workshop.phone}` : "";
        const badgeText = isIndependent ? `<span style="background:#e2e8f0;color:#475569;font-size:10px;padding:1px 6px;border-radius:4px;font-weight:700">Independiente</span>` : `<span style="background:${color}22;color:${color};font-size:10px;padding:1px 6px;border-radius:4px;font-weight:700">${providerName}</span>`;

        const popup = L.popup({ maxWidth: 260 }).setContent(`
          <div style="font-family:system-ui,sans-serif;min-width:200px">
            <div style="margin-bottom:6px">${badgeText}</div>
            <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">${workshop.name || providerName}</div>
            ${workshop.address ? `<div style="font-size:12px;color:#64748b;margin-bottom:4px">📍 ${workshop.address}</div>` : ""}
            ${distText ? `<div style="font-size:12px;color:#64748b;margin-bottom:4px">🚗 ${distText}</div>` : ""}
            ${phoneText}
            <button onclick="window.__cwSelectProvider('${providerKey}')" style="
              margin-top:10px;width:100%;padding:7px 0;border:none;border-radius:7px;
              background:${color};color:white;font-size:12px;font-weight:700;cursor:pointer;
            ">
              ${isSelected ? "✓ Seleccionado" : "Seleccionar este taller"}
            </button>
          </div>
        `);

        const marker = L.marker([workshop.lat, workshop.lon], { icon })
          .addTo(map)
          .bindPopup(popup);

        markersRef.current.push(marker);
      });

      // Fit bounds to all markers
      if (workshopsWithCoords.length > 0) {
        const allPoints = [
          ...(userLocation?.lat ? [[userLocation.lat, userLocation.lon]] : []),
          ...workshopsWithCoords.map((p) => [p.workshop.lat, p.workshop.lon]),
        ];
        map.fitBounds(allPoints, { padding: [40, 40], maxZoom: 14 });
      }
    });

    // Expose select callback for popup button
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

  const withCoords = providers.filter((p) => p.workshop?.lat != null);

  return (
    <>
      {/* Leaflet CSS + pulse keyframe */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`@keyframes pulse{0%{transform:scale(1);opacity:0.4}70%{transform:scale(2.2);opacity:0}100%{transform:scale(2.2);opacity:0}}`}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#fff", borderRadius: 16, overflow: "hidden",
            width: "min(860px, 96vw)", height: "min(600px, 92vh)",
            display: "flex", flexDirection: "column", zIndex: 9999,
            boxShadow: "0 24px 60px rgba(0,0,0,0.30)",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid #e2e8f0",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "#f8fafc",
          }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                Talleres cercanos
              </span>
              <span style={{ fontSize: 12, color: "#64748b", marginLeft: 10 }}>
                {withCoords.length} con ubicación disponible
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff",
                padding: "5px 12px", fontSize: 13, cursor: "pointer", color: "#475569",
              }}
            >
              ✕ Cerrar
            </button>
          </div>

          {/* Map */}
          <div ref={mapRef} style={{ flex: 1, minHeight: 0 }} />

          {/* Legend */}
          <div style={{
            padding: "10px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc",
            display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center",
          }}>
            {Object.entries(PARTNER_COLORS).map(([key, color]) => {
              const found = providers.find((p) => p.providerKey === key);
              if (!found) return null;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>
                    {found.providerName}
                  </span>
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
