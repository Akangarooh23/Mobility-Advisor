/**
 * El contrato con la API de Wallapop, comprobado en frio.
 *
 * Los tres workflows de Wallapop -el scraper, el enriquecedor y el verificador-
 * no leen HTML: leen JSON de api.wallapop.com. Eso los hace rapidos y fiables,
 * y tambien los hace callados cuando el JSON cambia de forma. Un campo que pasa
 * de booleano a objeto no da error: da falso siempre, y el catalogo se llena de
 * huecos sin que nadie se entere.
 *
 * Ya paso una vez, en pequeno: `reserved` no es `true`, es `{ flag: true }`.
 * Leerlo como booleano no rompia nada, solo devolvia que nunca hay reservados.
 * Y las fechas van en milisegundos en el buscador y en segundos en la ficha,
 * asi que confundirlas manda una publicacion al ano 58633 sin quejarse.
 *
 * El 404 que se comprueba abajo es ademas el unico veredicto con el que el
 * verificador da una oferta de baja: si dejara de darse, dejariamos de retirar
 * los coches vendidos.
 *
 * Esto comprueba lo que los workflows dan por hecho. No toca la base: solo pide
 * a la API y mira si sigue contestando lo que decia.
 *
 *   node scripts/comprueba-wallapop.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const SCRAPER = path.join(RAIZ, "n8n-workflows", "wallapop-scraper-offers.json");
const ENRICH = path.join(RAIZ, "n8n-workflows", "wallapop-enrich-offers.json");

const CABECERAS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
  // Sin esto la API contesta en ingles y los mapeos de carroceria no cuadran.
  "Accept-Language": "es-ES,es;q=0.9",
  "X-DeviceOS": "0",
};

const BUSCADOR =
  "https://api.wallapop.com/api/v3/search?category_ids=100&order_by=newest" +
  "&latitude=40.4168&longitude=-3.7038&distance=600000&source=search_box";

const FICHA = "https://api.wallapop.com/api/v3/items/";

/** Un id con la forma correcta pero que no existe: debe dar 404. */
const ID_INVENTADO = "zzzzzzzzzzzz";

/** Los ultimos veinte anos, en milisegundos. Sirve para cazar unidades cambiadas. */
const HACE_VEINTE_ANOS = Date.now() - 20 * 365 * 24 * 3600 * 1000;

const fallos = [];
const notas = [];

/**
 * Las tablas de traduccion que usa el enriquecedor, leidas del propio workflow.
 *
 * Se sacan de ahi y no se copian aqui a proposito: si manana alguien anade una
 * carroceria al workflow, esta comprobacion la tiene en cuenta sola. Una copia
 * se queda vieja y empieza a mentir.
 */
function mapasDelWorkflow() {
  const js = JSON.parse(fs.readFileSync(ENRICH, "utf8")).nodes
    .find((n) => n.type.endsWith(".code")).parameters.jsCode;
  const claves = (nombre) => {
    const bloque = js.match(new RegExp("const " + nombre + " = \\{([\\s\\S]*?)\\};"));
    if (!bloque) return null;
    return (bloque[1].match(/(\w+)\s*:/g) || []).map((s) => s.replace(/\s*:$/, ""));
  };
  return { gear: claves("gearMap"), body: claves("bodyMap"), eco: claves("ecoMap") };
}

async function pide(url) {
  const r = await fetch(url, { headers: CABECERAS, signal: AbortSignal.timeout(25000) });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch (e) { /* 404 viene sin cuerpo */ }
  return { status: r.status, json };
}

(async () => {
  const mapas = mapasDelWorkflow();
  if (!mapas.gear || !mapas.body || !mapas.eco) {
    fallos.push("no encuentro gearMap/bodyMap/ecoMap en el workflow de enriquecimiento: o se han renombrado, o esta comprobacion ya no mira donde debe");
  }

  // --- 1) El buscador, que es de donde come el scraper -------------------
  const busq = await pide(BUSCADOR);
  if (busq.status !== 200) {
    fallos.push(`el buscador responde ${busq.status}; el scraper no traera nada`);
  }

  const items = (busq.json && busq.json.data && busq.json.data.section &&
    busq.json.data.section.payload && busq.json.data.section.payload.items) || [];
  const coches = items.filter((x) => x.type_attributes && x.type_attributes.brand);

  if (!items.length) {
    fallos.push("el buscador contesta 200 pero sin items: ha cambiado la forma de la respuesta (data.section.payload.items)");
  } else if (!coches.length) {
    fallos.push(`llegan ${items.length} items pero ninguno con type_attributes.brand: el scraper los filtraria todos y no guardaria un solo coche`);
  }

  if (coches.length) {
    const c = coches[0];

    // Banderas que parecen booleanos y no lo son.
    for (const campo of ["reserved", "has_warranty", "is_refurbished"]) {
      const v = c[campo];
      if (v === undefined) {
        notas.push(`el buscador ya no manda "${campo}"`);
      } else if (typeof v === "boolean") {
        fallos.push(`"${campo}" ahora es un booleano y el scraper lo lee como { flag }: hay que simplificar flag() o dejara de verlo`);
      } else if (!v || typeof v !== "object" || !("flag" in v)) {
        fallos.push(`"${campo}" ya no tiene la forma { flag: ... }: llega ${JSON.stringify(v)}`);
      }
    }

    // Fechas del buscador: milisegundos.
    for (const campo of ["created_at", "modified_at"]) {
      const n = Number(c[campo]);
      if (!n) {
        fallos.push(`el buscador ya no manda "${campo}": listed_at y source_updated_at se quedarian vacios`);
      } else if (n < HACE_VEINTE_ANOS) {
        fallos.push(`"${campo}" llega como ${c[campo]}, que no son milisegundos: el scraper lo dividiria entre 1000 y guardaria una fecha absurda`);
      }
    }

    const ta = c.type_attributes;
    for (const campo of ["brand", "model", "year", "km", "engine", "horsepower", "version"]) {
      if (ta[campo] === undefined) notas.push(`el buscador ya no manda type_attributes.${campo}`);
    }
  }

  // --- 2) La ficha, que es de donde come el enriquecedor -----------------
  if (coches.length) {
    const ficha = await pide(FICHA + coches[0].id);
    if (ficha.status !== 200) {
      fallos.push(`la ficha de un coche que acaba de salir en el buscador responde ${ficha.status}; el enriquecedor no rellenaria nada`);
    } else {
      const ta = ficha.json.type_attributes || {};
      // Lo que el enriquecedor va a buscar ahi y no encuentra en ningun otro sitio.
      for (const campo of ["doors", "seats", "gear_box", "body_type"]) {
        if (!ta[campo] || ta[campo].value === undefined) {
          fallos.push(`la ficha ya no trae "${campo}": es justo el hueco que venia a tapar el enriquecedor`);
        }
      }

      // Fecha de la ficha: segundos, al reves que el buscador.
      const md = Number(ficha.json.modified_date);
      if (!md) {
        notas.push("la ficha ya no manda modified_date");
      } else if (md > HACE_VEINTE_ANOS) {
        fallos.push(`modified_date llega como ${md}, que son milisegundos y no segundos: el enriquecedor guardaria una fecha del ano 58000`);
      }

      // La descripcion, de donde sale el poco color que se puede sacar.
      //
      // En el buscador es un texto y en la ficha es un objeto { original }. Ya
      // se colo una vez: el codigo le hacia String() y parseaba literalmente la
      // cadena "[object Object]", asi que no encontraba un color jamas y no se
      // quejaba. Si vuelve a cambiar de forma, que salte aqui.
      const desc = ficha.json.description;
      if (desc === undefined || desc === null) {
        notas.push("la ficha ya no manda description: se acabo el color que se sacaba de ahi");
      } else if (typeof desc === "string") {
        notas.push("description ahora es un texto y no un objeto { original }: el enriquecedor lo aguanta, pero conviene simplificarlo");
      } else if (typeof desc !== "object" || typeof desc.original !== "string") {
        fallos.push(`description ya no es { original: "..." }: llega ${JSON.stringify(desc).slice(0, 80)}, y de ahi sale el color`);
      }

      // Valores nuevos que el workflow no sabria traducir.
      if (mapas.gear && ta.gear_box && !mapas.gear.includes(String(ta.gear_box.value))) {
        notas.push(`cambio "${ta.gear_box.value}" no esta en gearMap: esa oferta se quedara sin transmision`);
      }
      if (mapas.body && ta.body_type && !mapas.body.includes(String(ta.body_type.value))) {
        notas.push(`carroceria "${ta.body_type.value}" no esta en bodyMap: se guardara el texto tal cual ("${ta.body_type.text}")`);
      }
      if (mapas.eco && ta.eco_label && !mapas.eco.includes(String(ta.eco_label.value))) {
        notas.push(`etiqueta "${ta.eco_label.value}" no esta en ecoMap: esa oferta se quedara sin etiqueta`);
      }

      // El idioma, que decide si las carrocerias cuadran con las de la base.
      //
      // Se mira el titulo del campo y no su valor: "Año" en espanol y "Year" en
      // ingles, siempre, en cualquier coche. Mirar el valor no vale, porque hay
      // carrocerias que se escriben igual en los dos idiomas -"SUV/4X4"- y la
      // comprobacion pasaria segun que coche tocara.
      const titulo = ta.year && ta.year.title ? String(ta.year.title) : "";
      if (titulo && titulo.toLowerCase() !== "año") {
        fallos.push(`la ficha contesta en otro idioma (el campo del ano se llama "${titulo}", no "Año") pese a pedirla en espanol: las carrocerias y las etiquetas no cuadraran con las de la base`);
      }
    }
  }

  // --- 3) Que un anuncio que no existe siga dando 404 --------------------
  // De ahi sale la baja automatica. Si pasara a devolver 200 con un cuerpo
  // vacio, dejariamos de dar de baja los vendidos sin enterarnos.
  const muerto = await pide(FICHA + ID_INVENTADO);
  if (muerto.status !== 404 && muerto.status !== 410) {
    fallos.push(`una ficha inexistente responde ${muerto.status} en vez de 404: el enriquecedor dejaria de dar de baja los anuncios retirados`);
  }

  // --- Resultado ---------------------------------------------------------
  if (notas.length) {
    console.log("[wallapop] avisos (no rompen nada, pero conviene mirarlos):\n");
    notas.forEach((n) => console.log("  · " + n));
    console.log("");
  }

  if (fallos.length) {
    console.error("[wallapop] FALLA — los workflows de Wallapop no haran lo que dicen:\n");
    fallos.forEach((f) => console.error("  · " + f));
    console.error("");
    process.exit(1);
  }

  console.log(
    `[wallapop] OK: el buscador da ${coches.length} coches con atributos, la ficha trae puertas, plazas, ` +
    "cambio y carroceria, las fechas van en las unidades esperadas y un anuncio retirado sigue dando 404."
  );
})().catch((e) => {
  console.error("[wallapop] FALLA — no se ha podido comprobar: " + e.message);
  process.exit(1);
});
