import { useEffect, useMemo, useState } from "react";
import { getVehicleCatalogJson } from "../utils/apiClient";
import { normalizeText } from "../utils/offerHelpers";
import localVehicleCatalog from "../data/vehicle-catalog.json";

function buildFallbackMarketCatalogFromOffers(offers = []) {
  const safeOffers = Array.isArray(offers) ? offers : [];

  return safeOffers.reduce((acc, offer) => {
    const brand = normalizeText(offer?.brand);
    const model = normalizeText(offer?.model);

    if (!brand || !model) {
      return acc;
    }

    if (!Array.isArray(acc[brand])) {
      acc[brand] = [];
    }

    if (!acc[brand].includes(model)) {
      acc[brand].push(model);
    }

    return acc;
  }, {});
}

/**
 * Para comparar marcas y modelos: sin mayúsculas, acentos ni espacios de más.
 *
 * Los acentos hacen falta tanto como las mayúsculas. En datos de coches
 * conviven «Citroën» y «CITROEN», «Škoda» y «Skoda», y para una cadena de texto
 * son marcas distintas — el desplegable las enseñaba por separado, cada una con
 * la mitad de los modelos.
 */
function claveComparable(valor) {
  return normalizeText(valor)
    .normalize("NFD")
    // Los diacríticos, por su código: escritos como caracteres sueltos son
    // invisibles en el editor y cualquiera los borra sin darse cuenta.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Y para las marcas, además, sin puntuación: «Land-Rover» es «Land Rover». */
function claveDeMarca(valor) {
  return claveComparable(valor).replace(/[^a-z0-9]/g, "");
}

/**
 * Marcas que son la misma con otro nombre.
 *
 * Esto no se deduce de la cadena: hay que saber que SsangYong pasó a llamarse
 * KGM y que quien escribe «Vw» se refiere a Volkswagen. Por eso es una lista
 * corta y explícita en lugar de una regla lista — adivinando se acaba juntando
 * DS con Citroën, que fueron la misma casa y hoy son marcas distintas.
 *
 * La clave va sin puntuación ni acentos; el valor es el nombre que se enseña.
 */
const MARCAS_EQUIVALENTES = {
  vw: "Volkswagen",
  mercedes: "Mercedes-Benz",
  mercedesbenz: "Mercedes-Benz",
  ssangyong: "SsangYong KGM",
  kgm: "SsangYong KGM",
  kgmssangyong: "SsangYong KGM",
  ssangyongkgm: "SsangYong KGM",
  landrover: "Land Rover",
  alfaromeo: "Alfa Romeo",
  citroen: "Citroën",
  skoda: "Škoda",
  // El nombre corto y el largo de la misma marca.
  ds: "DS Automobiles",
  // Erratas que llegan en los datos de origen y salían como marcas propias.
  madza: "Mazda",
  suzuky: "Suzuki",
  linkco: "Lynk & Co",
  // Yudo llegaba escrita de cinco formas, con un modelo suelto en cada una.
  yoodoo: "Yudo",
  yoodooo: "Yudo",
  yooudoo: "Yudo",
  yooudoo6: "Yudo",
};

/**
 * Marcas que se parecen de escritura y **no** son la misma. No se tocan.
 *
 * Se anotan porque el parecido invita a unirlas y conviene que la próxima
 * persona que lo mire sepa que ya se miró:
 *
 *   Dr Automobiles / DS Automobiles   italiana la una, francesa la otra
 *   Lifan / Livan                     emparentadas, hoy distintas
 *   Hymer / Hummer                    autocaravanas contra todoterrenos
 *   Merkur / Mercury                  dos marcas de Ford, distintas
 *   Baic / Buick, Ebro / Evo, Yudo / Yugo, Dfsk / DS
 *
 * Ojo con la última: Yudo y Yugo se parecen y son distintas —una es china y
 * eléctrica, la otra yugoslava—, mientras que «Yoodoo» y sus variantes sí son
 * Yudo mal escrita. El parecido de letras no decide nada por sí solo.
 */

/**
 * Marcas que se escriben en mayúsculas porque son siglas.
 *
 * Sacada del catálogo de referencia, no inventada: son exactamente las que él
 * escribe así. Hace falta porque la regla general —preferir la grafía mixta,
 * que suele ser la escrita por una persona— aquí se equivoca: entre «BMW» y
 * «Bmw» gana la segunda y queda mal.
 *
 * Y no se puede decidir por la longitud: «SEAT» y «Kia» tienen las mismas
 * letras y se escriben distinto.
 */
const SIGLAS = new Set([
  "amc", "baic", "bmw", "byd", "dfsk", "ds", "ebro", "faw", "fso", "gac",
  "gaz", "gmc", "ineos", "jac", "kgm", "ktm", "ldv", "levc", "mg", "nsu",
  "pgo", "seat", "swm", "tvr", "uaz", "zaz",
]);

/**
 * Lo que llega en el campo de la marca y no es una marca.
 *
 * La misma lista que usa el cargador del catálogo maestro. Hace falta también
 * aquí porque el desplegable no se alimenta solo del catálogo: mezcla las
 * marcas que aparecen en anuncios reales, y ahí siguen llegando en crudo. Sin
 * esto, «A5» y «Test» salían los primeros del bloque de marcas con coches.
 *
 * Escrita a mano y no deducida: esconder una marca de verdad por adivinar mal
 * es peor que dejar una entrada rara.
 */
const NO_SON_MARCAS = new Set([
  "a5", "audia5", "bwm", "citroenc1", "corvette", "ducato", "golf",
  "golfmontion4v6", "ichx", "ml", "t5", "touran", "test", "otrasmarcas",
  "otroscoches", "renault400", "renaultmegane19dci120cv", "fiatelliot",
  "fordtransitdreamerd51automatica", "dongfengsokondong", "1955custombelair",
]);

/**
 * Deshace las entidades HTML que llegan en los datos de origen.
 *
 * Algunos anuncios vienen con el texto ya escapado —«Lynk &amp; Co»— y eso
 * acababa siendo una marca aparte de «Lynk & Co», además de leerse fatal en el
 * desplegable. Solo las cuatro que aparecen de verdad; un decodificador
 * completo aquí sería resolver un problema que no tenemos.
 */
function decodificarHtml(valor) {
  return normalizeText(valor)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

/**
 * Umbrales para absorber una marca dentro de otra que empieza por su nombre.
 *
 * Sirven para la basura del tipo «Audi A5» o «Renault Megane 1.9 dci 120cv»:
 * el modelo se coló en el campo de la marca en origen y acaba en el desplegable
 * como si fuera un fabricante.
 *
 * Son prudentes a propósito. Solo absorbe una marca con muchos modelos, y solo
 * a una con muy pocos: con «Falcon» (1 modelo) y «Falcon Motors» (4) no se toca
 * nada, porque ahí no está claro cuál es la buena y equivocarse sería esconder
 * una marca de verdad.
 */
const MINIMO_PARA_ABSORBER = 10;
const MAXIMO_ABSORBIBLE = 3;

/**
 * De las formas en que viene escrita una marca, la que se le enseña al usuario.
 *
 * Las fuentes no se ponen de acuerdo: el catálogo dice «Volkswagen», la
 * cobertura de inventario «VOLKSWAGEN» y algún anuncio suelto «volkswagen» o
 * «Vw». Se prefiere la que ya viene con mayúsculas y minúsculas mezcladas, que
 * es la escrita por una persona; si solo hay gritadas o en minúscula, se
 * capitaliza a mano.
 */
function mejorNombreDeMarca(a, b) {
  if (!a) return b;
  if (!b) return a;
  const mezclada = (v) => v !== v.toUpperCase() && v !== v.toLowerCase();

  // Los acrónimos van al revés: entre «BMW» y «Bmw» gana la gritada.
  if (SIGLAS.has(claveDeMarca(a))) {
    const gritada = (v) => v === v.toUpperCase();
    if (gritada(a) && !gritada(b)) return a;
    if (gritada(b) && !gritada(a)) return b;
  }

  if (mezclada(a) && !mezclada(b)) return a;
  if (mezclada(b) && !mezclada(a)) return b;
  return a.length >= b.length ? a : b;
}

/**
 * Pone en caja una marca gritada, **salvo que sea un acrónimo**.
 *
 * La versión anterior bajaba a minúsculas todo lo que viniera en mayúsculas, y
 * eso convertía `BMW` en «Bmw», `MG` en «Mg» y `KTM` en «Ktm». Los acrónimos se
 * escriben en mayúsculas y así los trae el catálogo de referencia: `BMW`,
 * `SEAT`, `DS`, `INEOS`, frente a `Kia` o `Jeep`, que van mixtas.
 *
 * La regla es la longitud de cada palabra: cuatro letras o menos en mayúsculas
 * se deja como está. `INEOS` son cinco y aun así es acrónimo, pero viene bien
 * escrito del catálogo y esto solo actúa cuando no hay una grafía mejor.
 */
function capitalizar(valor) {
  if (valor !== valor.toUpperCase() && valor !== valor.toLowerCase()) return valor;
  return valor
    .split(" ")
    .map((palabra) => {
      if (palabra === palabra.toUpperCase() && palabra.replace(/[^A-Z0-9]/g, "").length <= 4) {
        return palabra;
      }
      return palabra
        .toLowerCase()
        .replace(/(^|[\s-])([a-záéíóúñ])/g, (_, sep, letra) => sep + letra.toUpperCase());
    })
    .join(" ");
}

/**
 * Fusiona dos catálogos agrupando por marca **sin distinguir mayúsculas**.
 *
 * Antes se agrupaba por la cadena exacta, y eso partía una misma marca en
 * varias entradas del desplegable: «Volkswagen» con 133 modelos, «VOLKSWAGEN»
 * con 78, «Vw» con 2. Quien eligiera la equivocada no encontraba su coche —un
 * Taigo con seis anuncios activos no aparecía— sin ninguna pista de por qué.
 *
 * Los modelos se juntan igual: «Taigo» y «TAIGO» son el mismo coche y salían
 * dos veces seguidas en la lista.
 */
function mergeCatalogMaps(primaryMap = {}, secondaryMap = {}) {
  const porMarca = new Map();

  const acumular = (mapa) => {
    for (const [nombreBruto, modelos] of Object.entries(mapa || {})) {
      const nombre = decodificarHtml(nombreBruto);
      const clave = claveDeMarca(nombre);
      if (!clave || NO_SON_MARCAS.has(clave)) continue;

      // Un alias fija tanto el grupo como el nombre que se enseña.
      const equivalente = MARCAS_EQUIVALENTES[clave];
      const claveFinal = equivalente ? claveDeMarca(equivalente) : clave;

      const entrada = porMarca.get(claveFinal) || { nombre, modelos: new Map() };
      entrada.nombre = equivalente || mejorNombreDeMarca(entrada.nombre, nombre);
      for (const modeloBruto of Array.isArray(modelos) ? modelos : []) {
        const modelo = decodificarHtml(modeloBruto);
        const claveModelo = claveComparable(modelo);
        if (!claveModelo) continue;
        entrada.modelos.set(claveModelo, mejorNombreDeMarca(entrada.modelos.get(claveModelo), modelo));
      }
      porMarca.set(claveFinal, entrada);
    }
  };

  // Primero el secundario, para que el principal mande al elegir la grafía.
  acumular(secondaryMap);
  acumular(primaryMap);

  /**
   * Y por último, el modelo que se coló en el campo de la marca.
   *
   * «Audi A5» o «Renault Megane 1.9 dci 120cv» no son fabricantes: son un error
   * de origen que llegaba al desplegable como una marca más, con un solo modelo
   * dentro. Se meten en la marca de la que salieron, con sus modelos.
   */
  const claves = [...porMarca.keys()];
  for (const hija of claves) {
    const entradaHija = porMarca.get(hija);
    if (!entradaHija || entradaHija.modelos.size > MAXIMO_ABSORBIBLE) continue;

    const madre = claves.find(
      (otra) =>
        otra !== hija &&
        hija.startsWith(otra) &&
        (porMarca.get(otra)?.modelos.size || 0) >= MINIMO_PARA_ABSORBER
    );
    if (!madre) continue;

    const entradaMadre = porMarca.get(madre);
    for (const [claveModelo, modelo] of entradaHija.modelos) {
      if (!entradaMadre.modelos.has(claveModelo)) entradaMadre.modelos.set(claveModelo, modelo);
    }
    porMarca.delete(hija);
  }

  const merged = {};
  for (const { nombre, modelos } of porMarca.values()) {
    if (modelos.size === 0) continue;
    merged[capitalizar(nombre)] = [...modelos.values()];
  }
  return merged;
}

function buildFallbackCatalogFromLocalFile() {
  const rawCatalog = localVehicleCatalog && typeof localVehicleCatalog === "object" ? localVehicleCatalog : {};

  return Object.entries(rawCatalog).reduce((acc, [brandName, models]) => {
    const cleanBrand = normalizeText(brandName);

    if (!cleanBrand || !Array.isArray(models)) {
      return acc;
    }

    const cleanModels = Array.from(
      new Set(
        models
          .map((modelName) => normalizeText(modelName))
          .filter(Boolean)
      )
    );

    if (cleanModels.length > 0) {
      acc[cleanBrand] = cleanModels;
    }

    return acc;
  }, {});
}

export function useMarketCatalog(fallbackOffers = []) {
  const fallbackCatalog = useMemo(() => {
    const fullCatalogFallback = buildFallbackCatalogFromLocalFile();
    const offersCatalogFallback = buildFallbackMarketCatalogFromOffers(fallbackOffers);

    return mergeCatalogMaps(fullCatalogFallback, offersCatalogFallback);
  }, [fallbackOffers]);
  // "Más buscados" should come from real inventory coverage (API), not static fallback offers.
  const fallbackMatchedModels = useMemo(() => ({}), []);
  const [marketBrandsCatalog, setMarketBrandsCatalog] = useState(() => fallbackCatalog);
  const [matchedModelsByBrand, setMatchedModelsByBrand] = useState(() => fallbackMatchedModels);
  const [marketCatalogSource, setMarketCatalogSource] = useState("fallback");

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { data } = await getVehicleCatalogJson();
        const nextCatalog = (Array.isArray(data?.brands) ? data.brands : []).reduce((acc, brandEntry) => {
          const brandName = normalizeText(brandEntry?.name);

          if (!brandName) {
            return acc;
          }

          const models = Array.isArray(brandEntry?.models)
            ? brandEntry.models.map((modelName) => normalizeText(modelName)).filter(Boolean)
            : [];

          acc[brandName] = models;
          return acc;
        }, {});
        const nextMatchedModels = Object.entries(data?.matchedModelsByBrand || {}).reduce((acc, [brandName, models]) => {
          const cleanBrand = normalizeText(brandName);
          if (!cleanBrand || !Array.isArray(models)) {
            return acc;
          }

          const cleanModels = Array.from(new Set(models.map((modelName) => normalizeText(modelName)).filter(Boolean)));
          if (cleanModels.length > 0) {
            acc[cleanBrand] = cleanModels;
          }
          return acc;
        }, {});

        // Include real inventory coverage models even if catalog master table is lagging.
        const catalogWithCoverage = mergeCatalogMaps(nextMatchedModels, nextCatalog);
        const mergedCatalog = mergeCatalogMaps(catalogWithCoverage, fallbackCatalog);
        const mergedMatchedModels = nextMatchedModels;

        if (isMounted && Object.keys(mergedCatalog).length > 0) {
          setMarketBrandsCatalog(mergedCatalog);
          setMatchedModelsByBrand(mergedMatchedModels);
          setMarketCatalogSource(Object.keys(nextCatalog).length > 0 ? "api+fallback" : "fallback");
        }
      } catch {
        if (isMounted) {
          setMatchedModelsByBrand({});
          setMarketCatalogSource("fallback");
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [fallbackCatalog]);

  return { marketBrandsCatalog, matchedModelsByBrand, marketCatalogSource };
}
