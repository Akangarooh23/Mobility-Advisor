/**
 * El anuncio al que apunta una solicitud.
 *
 * Lo que se guarda en una solicitud no es la dirección del anuncio original del
 * vendedor: es la de nuestra propia ficha, `/marketplace-vo/<id>`. En el panel
 * se buscaba el coche **por esa dirección** en el marketplace de ocasión, que no
 * la conoce, y se abría una ficha vacía. Y los coches de importación ni siquiera
 * están en esa tabla.
 *
 * Aquí se saca el id de la dirección y se busca por id en las dos tablas.
 */

const BASE = "/marketplace-vo";

/** El id del coche si la dirección es una ficha nuestra; si no, cadena vacía. */
export function idDeAnuncioPropio(url = "") {
  const bruta = String(url || "").trim();
  if (!bruta) return "";

  // Vale tanto entera —así se guarda desde hoy, para que el ERP pueda abrirla—
  // como solo con el trozo final, que es como están las de antes.
  let camino = bruta;
  const esEntera = /^https?:\/\//i.test(bruta);
  if (esEntera) {
    try { camino = new URL(bruta).pathname; } catch { return ""; }
  }

  const limpia = camino.split("?")[0].split("#")[0].replace(/\/+$/, "");
  if (!limpia.toLowerCase().startsWith(`${BASE}/`)) return "";
  const trozo = limpia.slice(BASE.length + 1);
  if (!trozo || trozo.includes("/")) return "";
  try { return decodeURIComponent(trozo); } catch { return trozo; }
}

/**
 * El coche por su id: primero en ocasión, y si no está, en importación.
 *
 * Son dos tablas distintas. Mirar solo en una es lo que hacía que un coche de
 * Alemania no apareciera por ningún lado.
 */
export async function ofertaDelMarketplacePorId(id, buscar = fetch) {
  const limpio = String(id || "").trim();
  if (!limpio) return null;

  try {
    const r = await buscar(`/api/marketplace-vo?id=${encodeURIComponent(limpio)}`);
    const d = r && r.ok ? await r.json() : null;
    if (d && d.offer && d.offer.id) return d.offer;
  } catch {}

  try {
    const r = await buscar(`/api/import-offers?id=${encodeURIComponent(limpio)}`);
    const d = r && r.ok ? await r.json() : null;
    if (d && d.ok && d.offer && d.offer.id) return d.offer;
  } catch {}

  return null;
}
