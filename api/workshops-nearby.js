function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeToken(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const PREFIX_COORDINATES = {
  "01": { lat: 42.8467, lon: -2.6716, province: "Alava" },
  "02": { lat: 38.9942, lon: -1.8585, province: "Albacete" },
  "03": { lat: 38.3452, lon: -0.4815, province: "Alicante" },
  "04": { lat: 36.8381, lon: -2.4597, province: "Almeria" },
  "05": { lat: 40.6561, lon: -4.681, province: "Avila" },
  "06": { lat: 38.8786, lon: -6.9703, province: "Badajoz" },
  "07": { lat: 39.5696, lon: 2.6502, province: "Baleares" },
  "08": { lat: 41.3874, lon: 2.1686, province: "Barcelona" },
  "09": { lat: 42.3439, lon: -3.6969, province: "Burgos" },
  "10": { lat: 39.4765, lon: -6.3722, province: "Caceres" },
  "11": { lat: 36.5271, lon: -6.2886, province: "Cadiz" },
  "12": { lat: 39.9864, lon: -0.0376, province: "Castellon" },
  "13": { lat: 38.9848, lon: -3.9274, province: "Ciudad Real" },
  "14": { lat: 37.8882, lon: -4.7794, province: "Cordoba" },
  "15": { lat: 43.3623, lon: -8.4115, province: "Coruna" },
  "16": { lat: 40.0704, lon: -2.1374, province: "Cuenca" },
  "17": { lat: 41.9794, lon: 2.8214, province: "Girona" },
  "18": { lat: 37.1773, lon: -3.5986, province: "Granada" },
  "19": { lat: 40.633, lon: -3.166, province: "Guadalajara" },
  "20": { lat: 43.3183, lon: -1.9812, province: "Guipuzcoa" },
  "21": { lat: 37.2614, lon: -6.9447, province: "Huelva" },
  "22": { lat: 42.1401, lon: -0.4089, province: "Huesca" },
  "23": { lat: 37.7796, lon: -3.7849, province: "Jaen" },
  "24": { lat: 42.5987, lon: -5.5671, province: "Leon" },
  "25": { lat: 41.6176, lon: 0.62, province: "Lleida" },
  "26": { lat: 42.4627, lon: -2.4449, province: "La Rioja" },
  "27": { lat: 43.0121, lon: -7.5558, province: "Lugo" },
  "28": { lat: 40.4168, lon: -3.7038, province: "Madrid" },
  "29": { lat: 36.7213, lon: -4.4214, province: "Malaga" },
  "30": { lat: 37.9922, lon: -1.1307, province: "Murcia" },
  "31": { lat: 42.8169, lon: -1.6432, province: "Navarra" },
  "32": { lat: 42.3358, lon: -7.8639, province: "Ourense" },
  "33": { lat: 43.3614, lon: -5.8494, province: "Asturias" },
  "34": { lat: 42.0118, lon: -4.528, province: "Palencia" },
  "35": { lat: 28.1235, lon: -15.4363, province: "Las Palmas" },
  "36": { lat: 42.2406, lon: -8.7207, province: "Pontevedra" },
  "37": { lat: 40.9701, lon: -5.6635, province: "Salamanca" },
  "38": { lat: 28.4636, lon: -16.2518, province: "Santa Cruz de Tenerife" },
  "39": { lat: 43.4623, lon: -3.8099, province: "Cantabria" },
  "40": { lat: 40.9429, lon: -4.1088, province: "Segovia" },
  "41": { lat: 37.3891, lon: -5.9845, province: "Sevilla" },
  "42": { lat: 41.7662, lon: -2.479, province: "Soria" },
  "43": { lat: 41.1189, lon: 1.2445, province: "Tarragona" },
  "44": { lat: 40.3456, lon: -1.1065, province: "Teruel" },
  "45": { lat: 39.8628, lon: -4.0273, province: "Toledo" },
  "46": { lat: 39.4699, lon: -0.3763, province: "Valencia" },
  "47": { lat: 41.6523, lon: -4.7245, province: "Valladolid" },
  "48": { lat: 43.263, lon: -2.935, province: "Vizcaya" },
  "49": { lat: 41.5033, lon: -5.7446, province: "Zamora" },
  "50": { lat: 41.6488, lon: -0.8891, province: "Zaragoza" },
  "51": { lat: 35.8894, lon: -5.3213, province: "Ceuta" },
  "52": { lat: 35.2923, lon: -2.9381, province: "Melilla" },
};

const WORKSHOPS = [
  { id: "norauto-mad-sur", provider: "norauto", name: "Norauto Madrid Sur", address: "Calle de la Ribera 12", postalCode: "28021", province: "Madrid", lat: 40.349, lon: -3.704 },
  { id: "norauto-mad-norte", provider: "norauto", name: "Norauto Madrid Norte", address: "Av. Europa 45", postalCode: "28108", province: "Madrid", lat: 40.542, lon: -3.637 },
  { id: "midas-mad-centro", provider: "midas", name: "MIDAS Madrid Centro", address: "Calle Embajadores 88", postalCode: "28012", province: "Madrid", lat: 40.405, lon: -3.704 },
  { id: "midas-mad-oeste", provider: "midas", name: "MIDAS Pozuelo", address: "Av. de Europa 7", postalCode: "28224", province: "Madrid", lat: 40.434, lon: -3.813 },

  { id: "norauto-barna", provider: "norauto", name: "Norauto Barcelona", address: "Carrer de la Marina 102", postalCode: "08013", province: "Barcelona", lat: 41.398, lon: 2.19 },
  { id: "midas-barna", provider: "midas", name: "MIDAS Barcelona Sants", address: "Carrer de Sants 233", postalCode: "08028", province: "Barcelona", lat: 41.378, lon: 2.142 },

  { id: "norauto-valencia", provider: "norauto", name: "Norauto Valencia", address: "Av. del Cid 76", postalCode: "46018", province: "Valencia", lat: 39.468, lon: -0.407 },
  { id: "midas-valencia", provider: "midas", name: "MIDAS Valencia Centro", address: "Gran Via 34", postalCode: "46005", province: "Valencia", lat: 39.465, lon: -0.369 },

  { id: "norauto-sevilla", provider: "norauto", name: "Norauto Sevilla", address: "Av. Kansas City 54", postalCode: "41007", province: "Sevilla", lat: 37.395, lon: -5.957 },
  { id: "midas-sevilla", provider: "midas", name: "MIDAS Sevilla Nervion", address: "Calle Luis Montoto 130", postalCode: "41018", province: "Sevilla", lat: 37.385, lon: -5.964 },

  { id: "norauto-malaga", provider: "norauto", name: "Norauto Malaga", address: "Av. Velazquez 15", postalCode: "29004", province: "Malaga", lat: 36.704, lon: -4.452 },
  { id: "midas-malaga", provider: "midas", name: "MIDAS Malaga Centro", address: "Calle Hilera 9", postalCode: "29007", province: "Malaga", lat: 36.719, lon: -4.43 },
];

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function resolveUserLocation(postalCode = "", province = "") {
  const cleanPostalCode = normalizeText(postalCode);
  const prefix = cleanPostalCode.slice(0, 2);
  const fromPrefix = PREFIX_COORDINATES[prefix];
  if (fromPrefix) {
    return {
      lat: fromPrefix.lat,
      lon: fromPrefix.lon,
      province: fromPrefix.province,
      source: "postal_prefix",
    };
  }

  const provinceToken = normalizeToken(province);
  const byProvince = Object.values(PREFIX_COORDINATES).find((item) => normalizeToken(item.province) === provinceToken);
  if (byProvince) {
    return {
      lat: byProvince.lat,
      lon: byProvince.lon,
      province: byProvince.province,
      source: "province_fallback",
    };
  }

  return null;
}

function buildProviderResult(providerKey, workshops) {
  if (!workshops.length) {
    return {
      providerKey,
      providerName: providerKey === "midas" ? "MIDAS" : "Norauto",
      available: false,
      workshop: null,
    };
  }

  const closest = workshops[0];
  return {
    providerKey,
    providerName: providerKey === "midas" ? "MIDAS" : "Norauto",
    available: true,
    workshop: {
      id: closest.id,
      name: closest.name,
      address: closest.address,
      postalCode: closest.postalCode,
      province: closest.province,
      distanceKm: closest.distanceKm,
      etaMinutes: Math.max(5, Math.round((closest.distanceKm / 35) * 60)),
    },
  };
}

module.exports = async function workshopsNearbyHandler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const postalCode = normalizeText(req.query?.postalCode || "");
  const province = normalizeText(req.query?.province || "");

  if (!/^\d{5}$/.test(postalCode)) {
    return res.status(400).json({ error: "postalCode must be a 5-digit code" });
  }

  const userLocation = resolveUserLocation(postalCode, province);
  if (!userLocation) {
    return res.status(422).json({ error: "Could not resolve user location from postalCode/province" });
  }

  const scoped = WORKSHOPS.map((workshop) => {
    const distanceKm = haversineKm(userLocation.lat, userLocation.lon, workshop.lat, workshop.lon);
    return {
      ...workshop,
      distanceKm: Number(distanceKm.toFixed(1)),
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);

  const byProvider = {
    norauto: scoped.filter((item) => item.provider === "norauto"),
    midas: scoped.filter((item) => item.provider === "midas"),
  };

  return res.status(200).json({
    ok: true,
    search: {
      postalCode,
      province: province || userLocation.province,
      source: userLocation.source,
    },
    providers: [
      buildProviderResult("norauto", byProvider.norauto),
      buildProviderResult("midas", byProvider.midas),
    ],
  });
};
