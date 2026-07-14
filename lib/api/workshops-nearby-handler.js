const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeToken(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const PREFIX_COORDINATES = {
  "01": { lat: 42.8467, lon: -2.6716, province: "Álava" },
  "02": { lat: 38.9942, lon: -1.8585, province: "Albacete" },
  "03": { lat: 38.3452, lon: -0.4815, province: "Alicante" },
  "04": { lat: 36.8381, lon: -2.4597, province: "Almería" },
  "05": { lat: 40.6561, lon: -4.681,  province: "Ávila" },
  "06": { lat: 38.8786, lon: -6.9703, province: "Badajoz" },
  "07": { lat: 39.5696, lon: 2.6502,  province: "Islas Baleares" },
  "08": { lat: 41.3874, lon: 2.1686,  province: "Barcelona" },
  "09": { lat: 42.3439, lon: -3.6969, province: "Burgos" },
  "10": { lat: 39.4765, lon: -6.3722, province: "Cáceres" },
  "11": { lat: 36.5271, lon: -6.2886, province: "Cádiz" },
  "12": { lat: 39.9864, lon: -0.0376, province: "Castellón" },
  "13": { lat: 38.9848, lon: -3.9274, province: "Ciudad Real" },
  "14": { lat: 37.8882, lon: -4.7794, province: "Córdoba" },
  "15": { lat: 43.3623, lon: -8.4115, province: "La Coruña" },
  "16": { lat: 40.0704, lon: -2.1374, province: "Cuenca" },
  "17": { lat: 41.9794, lon: 2.8214,  province: "Gerona" },
  "18": { lat: 37.1773, lon: -3.5986, province: "Granada" },
  "19": { lat: 40.633,  lon: -3.166,  province: "Guadalajara" },
  "20": { lat: 43.3183, lon: -1.9812, province: "Guipúzcoa" },
  "21": { lat: 37.2614, lon: -6.9447, province: "Huelva" },
  "22": { lat: 42.1401, lon: -0.4089, province: "Huesca" },
  "23": { lat: 37.7796, lon: -3.7849, province: "Jaén" },
  "24": { lat: 42.5987, lon: -5.5671, province: "León" },
  "25": { lat: 41.6176, lon: 0.62,    province: "Lérida" },
  "26": { lat: 42.4627, lon: -2.4449, province: "La Rioja" },
  "27": { lat: 43.0121, lon: -7.5558, province: "Lugo" },
  "28": { lat: 40.4168, lon: -3.7038, province: "Madrid" },
  "29": { lat: 36.7213, lon: -4.4214, province: "Málaga" },
  "30": { lat: 37.9922, lon: -1.1307, province: "Murcia" },
  "31": { lat: 42.8169, lon: -1.6432, province: "Navarra" },
  "32": { lat: 42.3358, lon: -7.8639, province: "Orense" },
  "33": { lat: 43.3614, lon: -5.8494, province: "Asturias" },
  "34": { lat: 42.0118, lon: -4.528,  province: "Palencia" },
  "35": { lat: 28.1235, lon: -15.4363, province: "Las Palmas" },
  "36": { lat: 42.2406, lon: -8.7207, province: "Pontevedra" },
  "37": { lat: 40.9701, lon: -5.6635, province: "Salamanca" },
  "38": { lat: 28.4636, lon: -16.2518, province: "Santa Cruz de Tenerife" },
  "39": { lat: 43.4623, lon: -3.8099, province: "Cantabria" },
  "40": { lat: 40.9429, lon: -4.1088, province: "Segovia" },
  "41": { lat: 37.3891, lon: -5.9845, province: "Sevilla" },
  "42": { lat: 41.7662, lon: -2.479,  province: "Soria" },
  "43": { lat: 41.1189, lon: 1.2445,  province: "Tarragona" },
  "44": { lat: 40.3456, lon: -1.1065, province: "Teruel" },
  "45": { lat: 39.8628, lon: -4.0273, province: "Toledo" },
  "46": { lat: 39.4699, lon: -0.3763, province: "Valencia" },
  "47": { lat: 41.6523, lon: -4.7245, province: "Valladolid" },
  "48": { lat: 43.263,  lon: -2.935,  province: "Vizcaya" },
  "49": { lat: 41.5033, lon: -5.7446, province: "Zamora" },
  "50": { lat: 41.6488, lon: -0.8891, province: "Zaragoza" },
  "51": { lat: 35.8894, lon: -5.3213, province: "Ceuta" },
  "52": { lat: 35.2923, lon: -2.9381, province: "Melilla" },
};

const PARTNER_LABELS = {
  norauto: "Norauto",
  midas: "MIDAS",
  carglass: "Carglass",
  euromaster: "Euromaster",
  kwik_fit: "Kwik Fit",
};

// Named partners shown first, in this order
const PARTNER_ORDER = ["norauto", "midas", "carglass", "euromaster", "kwik_fit"];

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveUserLocation(postalCode = "", province = "") {
  const prefix = normalizeText(postalCode).slice(0, 2);
  const fromPrefix = PREFIX_COORDINATES[prefix];
  if (fromPrefix) {
    return { lat: fromPrefix.lat, lon: fromPrefix.lon, province: fromPrefix.province, source: "postal_prefix" };
  }

  const token = normalizeToken(province);
  const byProvince = Object.values(PREFIX_COORDINATES).find(
    (item) => normalizeToken(item.province) === token
  );
  if (byProvince) {
    return { lat: byProvince.lat, lon: byProvince.lon, province: byProvince.province, source: "province_fallback" };
  }

  return null;
}

function addDistance(rows, userLat, userLon) {
  return rows
    .map((w) => ({
      ...w,
      distanceKm: Math.round(haversineKm(userLat, userLon, w.lat, w.lon) * 10) / 10,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function workshopShape(w) {
  return {
    id: String(w.id),
    name: w.name || "",
    address: [w.address, w.city].filter(Boolean).join(", ") || "",
    postalCode: w.postcode || "",
    province: w.province || "",
    lat: w.lat != null ? Number(w.lat) : null,
    lon: w.lon != null ? Number(w.lon) : null,
    distanceKm: w.distanceKm,
    etaMinutes: Math.max(5, Math.round((w.distanceKm / 35) * 60)),
    phone: w.phone || null,
  };
}

async function queryNearbyWorkshops(userLat, userLon) {
  // Named partners: large bounding box (Norauto has 89 centers spread across Spain)
  const partnerLatD = 1.35; // ~150km
  const partnerLonD = 1.8;

  // Independents: ~40km box
  const indLatD = 0.36;
  const indLonD = 0.48;

  const client = await pool.connect();
  try {
    const [{ rows: partnerRows }, { rows: indRows }] = await Promise.all([
      client.query(
        `SELECT id, name, address, city, postcode, province, lat, lon, partner, phone
         FROM workshop_locations
         WHERE is_active = true
           AND partner != 'independent'
           AND lat IS NOT NULL
           AND lat BETWEEN $1 AND $2
           AND lon BETWEEN $3 AND $4
         LIMIT 100`,
        [userLat - partnerLatD, userLat + partnerLatD, userLon - partnerLonD, userLon + partnerLonD]
      ),
      client.query(
        `SELECT id, name, address, city, postcode, province, lat, lon, partner, phone
         FROM workshop_locations
         WHERE is_active = true
           AND partner = 'independent'
           AND lat IS NOT NULL
           AND name IS NOT NULL AND name != ''
           AND lat BETWEEN $1 AND $2
           AND lon BETWEEN $3 AND $4
         LIMIT 300`,
        [userLat - indLatD, userLat + indLatD, userLon - indLonD, userLon + indLonD]
      ),
    ]);
    return { partnerRows, indRows };
  } finally {
    client.release();
  }
}

module.exports = async function workshopsNearbyHandler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const postalCode = normalizeText(req.query?.postalCode || "");
  const province   = normalizeText(req.query?.province   || "");

  if (!/^\d{5}$/.test(postalCode)) {
    return res.status(400).json({ error: "postalCode must be a 5-digit code" });
  }

  const userLocation = resolveUserLocation(postalCode, province);
  if (!userLocation) {
    return res.status(422).json({ error: "Could not resolve user location from postalCode/province" });
  }

  let partnerRows = [];
  let indRows = [];

  try {
    ({ partnerRows, indRows } = await queryNearbyWorkshops(userLocation.lat, userLocation.lon));
  } catch (err) {
    console.error("[workshops-nearby] DB error:", err.message);
  }

  // Named partners — closest one per brand, in preferred order
  const partnersByKey = {};
  for (const w of addDistance(partnerRows, userLocation.lat, userLocation.lon)) {
    if (!partnersByKey[w.partner]) partnersByKey[w.partner] = w;
  }

  const partnerProviders = PARTNER_ORDER
    .filter((key) => partnersByKey[key])
    .map((key) => {
      const w = partnersByKey[key];
      return {
        providerKey: key,
        providerName: PARTNER_LABELS[key] || key,
        available: true,
        workshop: workshopShape(w),
      };
    });

  // Independent talleres — closest 20 with a name
  const indProviders = addDistance(indRows, userLocation.lat, userLocation.lon)
    .filter((w) => w.name && w.name.trim().length > 2)
    .slice(0, 20)
    .map((w) => ({
      providerKey: `ind-${w.id}`,
      providerName: w.name,
      available: true,
      isIndependent: true,
      workshop: workshopShape(w),
    }));

  return res.status(200).json({
    ok: true,
    search: {
      postalCode,
      province: province || userLocation.province,
      source: userLocation.source,
    },
    userLocation: { lat: userLocation.lat, lon: userLocation.lon },
    providers: [...partnerProviders, ...indProviders],
  });
};
