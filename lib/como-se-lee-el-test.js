"use strict";

/**
 * Las respuestas del test, escritas como las leería una persona.
 *
 * ## Para qué
 *
 * Al cerebro que elige las ofertas se le pasaban las respuestas **en crudo**,
 * con los códigos internos. Y las usaba tal cual en su explicación:
 *
 *     «Para sus "viajes_ocio" y "7_plazas_maletero_grande", el Audi Q3
 *      Sportback ofrece un espacio interior más adecuado»
 *
 * Eso no lo puede leer un cliente. Y no es culpa del modelo: es lo que se le
 * dio. El análisis ya se lo pasa en cristiano —lo hace `buildAnswersSummary`
 * en `src/`— pero la búsqueda de ofertas recibe las respuestas crudas.
 *
 * ## Por qué esta tabla y no leer el cuestionario
 *
 * Porque el cuestionario vive en `src/` y `lib/` no puede importar de ahí. La
 * copia está permitida en este proyecto; separarse sin que nadie se entere,
 * no. Hay una prueba que compara esta tabla con las opciones de verdad y falla
 * si dejan de coincidir.
 *
 * ## Y qué pasa con lo que no esté aquí
 *
 * Se enseña el código con los guiones bajos convertidos en espacios. Feo, pero
 * legible, y nunca deja al cliente sin explicación por una respuesta nueva que
 * nadie tradujo.
 */

/** Cómo se llama cada pregunta cuando se le cuenta a alguien. */
const COMO_SE_LLAMA_LA_PREGUNTA = {
  perfil: "Para quién es",
  flexibilidad: "Cómo lo va a pagar",
  uso_principal: "Uso principal",
  entorno_uso: "Dónde conduce",
  uso_km_anuales: "Kilómetros al año",
  km_anuales: "Kilómetros al año",
  ocupantes: "Plazas y maletero",
  horizonte_tenencia: "Cuánto tiempo lo quiere",
  horizonte: "Cuánto tiempo lo quiere",
  garaje: "Garaje",
  carga_trabajo: "Cargador en el trabajo",
  zbe_impacto: "Le afectan las zonas restringidas",
  marca_preferencia: "Preferencia de marca",
  gestion_riesgo: "Ante el riesgo",
};

/** Y qué dice cada respuesta. Sale de las opciones del cuestionario. */
const COMO_SE_LEE = {
  perfil: {
    particular: "Para mí / familia",
    empresa: "Para mi empresa",
    autonomo: "Soy autónomo",
  },
  flexibilidad: {
    propiedad_contado: "Pagando al contado",
    propiedad_financiada: "Financiado",
    propiedad_entrada_inicial: "Quiero dar una entrada y financiar el resto",
    renting: "Renting o Suscripción",
    no_tengo_claro: "No lo tengo claro",
  },
  uso_principal: {
    trabajo_diario: "Ir al trabajo cada día",
    viajes_ocio: "Viajes de ocio o vacaciones",
    visitas_clientes: "Visitar clientes / reuniones",
    compras_recados: "Compras y recados puntuales",
    familia: "Llevar familia / niños",
    remolque: "Remolcar (caravana, tráiler)",
  },
  entorno_uso: {
    ciudad: "Ciudad principalmente",
    interurbano: "Carretera interurbana",
    autopista: "Autopista / largo radio",
    mixto: "Todo por igual",
  },
  uso_km_anuales: {
    menos_10k: "Menos de 10.000 kms",
    "10k_20k": "De 10.001 a 20.000 kms",
    "20k_35k": "De 20.001 a 35.000 kms",
    mas_35k: "De 35.000 kms en adelante",
  },
  ocupantes: {
    "2_plazas_maletero_pequeno": "1-2 plazas + maletero pequeño",
    "5_plazas_maletero_medio": "3-5 plazas + maletero medio",
    "7_plazas_maletero_grande": "6-7 plazas + maletero grande",
  },
  horizonte_tenencia: {
    menos_1_ano: "Menos de 1 año",
    "2_3": "2 o 3 años",
    "4_6": "4 a 6 años",
    mas_7: "7 o más años",
    no_claro: "Aún no lo tengo claro",
  },
  garaje: {
    garaje_cargador: "Tengo plaza y puedo cargar",
    garaje_sin_cargador: "Tengo plaza pero sin cargador",
    sin_garaje: "No tengo plaza fija / aparco en calle",
  },
  carga_trabajo: {
    si_cargador_trabajo: "Sí, hay cargador",
    no_cargador_trabajo: "No",
    no_lo_se_trabajo: "No lo sé",
  },
  zbe_impacto: {
    alta: "Mucho",
    media: "Algo",
    baja: "Poco o nada",
  },
  marca_preferencia: {
    generalista_europea: "Generalista europea",
    asiatica_fiable: "Asiática enfocada en fiabilidad",
    premium_alemana: "Premium alemana",
    premium_escandinava: "Premium escandinava",
    nueva_china: "Nuevas marcas",
    sin_preferencia: "Sin preferencia de marca",
  },
  gestion_riesgo: {
    alto: "Quiero máximo control",
    medio: "Equilibrio razonable",
    bajo: "Puedo asumir algo de riesgo",
  },
};

/*
 * El motor renombra dos respuestas por el camino, y aqui hacen falta las dos
 * escrituras. Ver lib/las-respuestas-del-test.js.
 */
COMO_SE_LEE.km_anuales = { ...COMO_SE_LEE.uso_km_anuales, mas_20k: "Más de 20.000 kms" };
COMO_SE_LEE.horizonte = COMO_SE_LEE.horizonte_tenencia;

const texto = (v) => String(v ?? "").trim();

/** Una respuesta en cristiano, o el código legible si no se sabe traducir. */
function comoSeLee(clave, valor) {
  const crudo = texto(valor);
  if (!crudo) return "";

  const suyas = COMO_SE_LEE[texto(clave)];
  return (suyas && suyas[crudo]) || crudo.replace(/_/g, " ");
}

/** Y el nombre de la pregunta, para que la linea se entienda sola. */
function comoSeLlamaLaPregunta(clave) {
  return COMO_SE_LLAMA_LA_PREGUNTA[texto(clave)] || texto(clave).replace(/_/g, " ");
}

module.exports = { COMO_SE_LEE, COMO_SE_LLAMA_LA_PREGUNTA, comoSeLee, comoSeLlamaLaPregunta };
