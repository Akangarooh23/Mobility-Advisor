export const STEPS = [
  {
    id: "perfil",
    block: "Perfil",
    blockIcon: "👤",
    question: "¿Para quién es la movilidad?",
    subtitle: "Esto nos ayuda a personalizar el análisis completo",
    type: "cards",
    options: [
      { value: "particular", label: "Para mí / familia", icon: "👤", desc: "Uso personal o familiar" },
      { value: "empresa", label: "Para mi empresa", icon: "🏢", desc: "Flota o vehículo de empresa" },
      { value: "autonomo", label: "Soy autónomo", icon: "💼", desc: "Uso mixto profesional / personal" },
    ],
  },
  {
    id: "flexibilidad",
    block: "Vinculación",
    blockIcon: "🤝",
    question: "¿Cómo vas a adquirir el vehículo?",
    subtitle: "Cada modelo tiene implicaciones financieras y de riesgo muy distintas",
    type: "cards",
    options: [
      { value: "propiedad_contado", label: "Pagando al contado", icon: "💶" },
      { value: "propiedad_financiada", label: "Financiado", icon: "📝" },
      { value: "propiedad_entrada_inicial", label: "Quiero dar una entrada y financiar el resto", icon: "💳" },
      { value: "renting", label: "Renting o Suscripción", icon: "📅", desc: "Pagar una cuota y no tener el coche en propiedad" },
      { value: "no_tengo_claro", label: "No lo tengo claro", icon: "🤔", desc: "Ayúdame a decidir cuál es la mejor opción" },
    ],
  },
  {
    /*
     * Cuánto se puede pagar al mes.
     *
     * `cuota_mensual` ya pesaba en el motor —decide parte del coste del
     * score y si la recomendación tira a contado o a financiado— pero se
     * preguntaba **después** de recomendar, en la validación rápida. Así,
     * el resultado decía «330-540 €/mes» sin haber preguntado nunca qué
     * puede pagar quien lo lee.
     */
    /*
     * Hasta cuánto quiere gastarse.
     *
     * Es lo primero que mira cualquiera en un coche de segunda mano y el
     * test no lo preguntaba: el precio se deducía de la cuota mensual, lo
     * que obliga a inventarse un plazo y un interés para llegar a una cifra
     * que el cliente sabe y podría haber dicho.
     *
     * Y es el filtro que más estrecha la búsqueda: con un tope de precio la
     * consulta usa índice, y sin él recorre el pool entero.
     */
    id: "presupuesto_total",
    block: "Presupuesto",
    blockIcon: "💰",
    question: "¿Cuánto quieres gastarte como máximo?",
    subtitle: "El precio del coche, sin contar seguro ni mantenimiento. Es lo que usamos para buscarte ofertas.",
    type: "cards",
    options: [
      { value: "hasta_10k", label: "Hasta 10.000 €", icon: "🪙", desc: "Coches con más años o más kilómetros" },
      { value: "10k_15k", label: "De 10.000 a 15.000 €", icon: "💶", desc: "El tramo con más oferta del mercado" },
      { value: "15k_20k", label: "De 15.000 a 20.000 €", icon: "💶", desc: "Compactos recientes y SUV pequeños" },
      { value: "20k_30k", label: "De 20.000 a 30.000 €", icon: "💳", desc: "Seminuevos y algún híbrido" },
      { value: "30k_45k", label: "De 30.000 a 45.000 €", icon: "💎", desc: "Eléctricos, premium o casi nuevos" },
      { value: "mas_45k", label: "Más de 45.000 €", icon: "🏆", desc: "Sin tope por nuestra parte" },
    ],
  },
  {
    id: "cuota_mensual",
    /*
     * Solo a quien vaya a financiar.
     *
     * A quien paga al contado la cuota no le dice nada, y el precio total ya
     * se le ha preguntado. «No lo tengo claro» sí la ve: puede acabar
     * financiando y es a quien más le sirve saber en qué cuota cae.
     */
    soloSi: { flexibilidad: ["propiedad_financiada", "propiedad_entrada_inicial", "renting", "no_tengo_claro"] },
    block: "Presupuesto",
    blockIcon: "💶",
    question: "¿Cuánto puedes destinar al coche cada mes?",
    subtitle: "Todo incluido: cuota o ahorro para la compra, seguro, combustible o luz, mantenimiento e impuestos.",
    type: "cards",
    options: [
      { value: "menos_200", label: "Menos de 200 €", icon: "🪙", desc: "Un coche pequeño y usado, o movilidad sin coche propio" },
      { value: "200_350", label: "Entre 200 y 350 €", icon: "💶", desc: "Lo más común en un compacto de segunda mano" },
      { value: "350_500", label: "Entre 350 y 500 €", icon: "💳", desc: "Da acceso a coches recientes o a renting" },
      { value: "mas_500", label: "Más de 500 €", icon: "💎", desc: "Sin apreturas: SUV, premium o eléctrico nuevo" },
    ],
  },
  {
    id: "propulsion_preferida",
    block: "Energía",
    blockIcon: "⚡",
    question: "¿Qué motorización prefieres?",
    subtitle: "Es una decisión clave porque condiciona coste total del mantenimiento, etiqueta DGT y prima aproximada del seguro.",
    type: "multi",
    options: [
      { value: "electrico_puro", label: "Eléctrico puro (BEV)", icon: "⚡", desc: "Etiqueta CERO — recarga 100% eléctrica" },
      { value: "hibrido_no_enchufable", label: "Híbrido (HEV/MHEV)", icon: "🔋", desc: "Etiqueta ECO — sin enchufe, muy eficiente en ciudad" },
      { value: "hibrido_enchufable", label: "Híbrido enchufable (PHEV)", icon: "🔌", desc: "Requiere punto de carga accesible" },
      { value: "gasolina", label: "Gasolina", icon: "⛽", desc: "Etiqueta DGT posible: B, C o ECO (según versión y año)" },
      { value: "diesel", label: "Diésel", icon: "🛢️", desc: "Etiqueta DGT posible: B, C o ECO (según versión y año)" },
      { value: "glp_gnc", label: "GLP / GNC", icon: "🟢", desc: "Alternativa interesante si tienes un punto de recarga cerca" },
      { value: "indiferente_motor", label: "Sin preferencia", icon: "🤷", desc: "Elegir lo más conveniente en base al resto de mis respuestas" },
    ],
    helpInfo: {
      title: "Ver Coste Aproximado cada 100 kms en consumo interurbano por tipo de motor",
      table: [
        { type: "Eléctrico (en casa)", consumption: "15-20 kWh/100 km", cost: "2,00 € - 4,00 €" },
        { type: "Híbrido Enchufable (PHEV)", consumption: "1-2 L + electricidad*", cost: "4,00 € - 7,00 € (con cargas)" },
        { type: "Híbrido (HEV/MHEV sin enchufe)", consumption: "4-5 L/100 km", cost: "7,00 € - 9,00 €" },
        { type: "Diésel", consumption: "5-6 L/100 km", cost: "8,00 € - 11,00 €" },
        { type: "Gasolina", consumption: "6-7 L/100 km", cost: "10,00 € - 14,00 €" },
      ]
    }
  },
  {
    id: "horizonte_y_antiguedad",
    block: "Compra",
    blockIcon: "🕒",
    question: "¿Cuánto tiempo vas a querer quedarte con el coche? ¿Antigüedad máxima?",
    subtitle: "Estas dos preguntas nos ayudan a definir tu estrategia de compra.",
    type: "dual_timeline",
    compositeKeys: ["horizonte_tenencia", "antiguedad_vehiculo_buscada"],
    fields: {
      horizonte_tenencia: {
        title: "¿Cuánto tiempo vas a querer quedarte con el coche?",
        selectionMode: "single",
        options: [
          { value: "menos_1_ano", label: "Menos de 1 año" },
          { value: "2_3", label: "2 o 3 años" },
          { value: "4_6", label: "4 a 6 años" },
          { value: "mas_7", label: "7 o más años" },
          { value: "no_claro", label: "Aún no lo tengo claro" },
        ],
      },
      antiguedad_vehiculo_buscada: {
        title: "¿Qué antigüedad máxima aceptas?",
        selectionMode: "single",
        options: [
          { value: "cero_anos", label: "0 años o Kilómetro 0" },
          { value: "2_3_anos", label: "2-3 años" },
          { value: "5_anos", label: "5 años" },
          { value: "7_anos", label: "7 años" },
          { value: "mas_7_anos", label: "Más de 7 años" },
          { value: "indiferente", label: "Me es indiferente" },
        ],
      },
    },
  },
  {
    id: "uso_km_anuales",
    block: "Uso real",
    blockIcon: "🛣️",
    question: "¿Cuántos kilómetros haces al año?",
    subtitle: "Influye en los costes de mantenimiento y en el tipo de motor más conveniente",
    type: "cards",
    options: [
      { value: "menos_10k", label: "Menos de 10.000 kms", desc: "Uso muy reducido" },
      { value: "10k_20k", label: "De 10.001 a 20.000 kms", desc: "Uso moderado" },
      { value: "20k_35k", label: "De 20.001 a 35.000 kms", desc: "Uso frecuente" },
      { value: "mas_35k", label: "De 35.000 kms en adelante", desc: "Uso muy intensivo" },
    ],
  },
  {
    id: "entorno_uso",
    block: "Uso real",
    blockIcon: "🗺️",
    question: "¿Por dónde sueles conducir?",
    subtitle: "Incluye tu contexto de ciudad/zona (ZBE), consumo real y tipo de uso",
    type: "cards",
    options: [
      { value: "ciudad", label: "Ciudad principalmente", icon: "🏙️", desc: "Tráfico, atascos, aparcamiento" },
      { value: "interurbano", label: "Carretera interurbana", icon: "🛤️", desc: "Tramos mixtos, pueblos" },
      { value: "autopista", label: "Autopista / largo radio", icon: "🛣️", desc: "Viajes frecuentes >100 km" },
      { value: "mixto", label: "Todo por igual", icon: "🔄", desc: "Sin un entorno claro" },
    ],
  },
  {
    id: "uso_principal",
    block: "Uso real",
    blockIcon: "🎯",
    question: "¿Para qué lo usas principalmente?",
    subtitle: "Selecciona todas las que apliquen",
    type: "multi",
    options: [
      { value: "trabajo_diario", label: "Ir al trabajo cada día", icon: "🏃" },
      { value: "viajes_ocio", label: "Viajes de ocio o vacaciones", icon: "✈️" },
      { value: "visitas_clientes", label: "Visitar clientes / reuniones", icon: "🤝" },
      { value: "compras_recados", label: "Compras y recados puntuales", icon: "🛒" },
      { value: "familia", label: "Llevar familia / niños", icon: "👨‍👩‍👧" },
      { value: "remolque", label: "Remolcar (caravana, tráiler)", icon: "🚚" },
    ],
  },
  {
    id: "ocupantes",
    block: "Capacidad",
    blockIcon: "💺",
    question: "¿Qué combinación de plazas y maletero necesitas habitualmente?",
    subtitle: "Así recogemos en una sola respuesta el espacio para personas y carga diaria",
    type: "cards",
    options: [
      { value: "2_plazas_maletero_pequeno", label: "1-2 plazas + maletero pequeño", icon: "👤", desc: "Uso individual o pareja" },
      { value: "5_plazas_maletero_medio", label: "3-5 plazas + maletero medio", icon: "👨‍👩‍👧", desc: "Uso familiar equilibrado" },
      { value: "7_plazas_maletero_grande", label: "6-7 plazas + maletero grande", icon: "🚐", desc: "Familia numerosa o mucho equipaje" },
    ],
  },
  {
    /*
     * De qué provincia quiere el coche.
     *
     * La pantalla de resultados tenía un desplegable de ubicación **encima
     * de las ofertas ya elegidas**: filtraba doce coches que la base ya
     * había decidido. Preguntarlo aquí filtra en la base, que es donde hay
     * millón y medio, y de paso hace la consulta más rápida.
     *
     * La lista sale de `lib/de-donde-quiere-el-coche.js`, que además guarda
     * con qué escrituras se busca cada una. No se saca de la columna del
     * pool porque ahí hay **3.444 «provincias» distintas**: «Madrid» y
     * «MADRID» por separado, y 11.600 ofertas cuya provincia es PATERNA,
     * que es un pueblo de Valencia.
     */
    id: "provincia_del_coche",
    block: "Vehículo",
    blockIcon: "📍",
    question: "¿De qué provincia quieres el coche?",
    subtitle: "Si te da igual, buscamos en toda España. Elegir una acota mucho, pero deja fuera buenas ofertas de al lado.",
    type: "cards",
    options: [
      { value: "cualquier_provincia", label: "Me da igual, de cualquier provincia", icon: "🇪🇸", desc: "Más ofertas entre las que elegir" },
      { value: "alava", label: "Álava", icon: "📍" },
      { value: "albacete", label: "Albacete", icon: "📍" },
      { value: "alicante", label: "Alicante", icon: "📍" },
      { value: "almeria", label: "Almería", icon: "📍" },
      { value: "asturias", label: "Asturias", icon: "📍" },
      { value: "avila", label: "Ávila", icon: "📍" },
      { value: "badajoz", label: "Badajoz", icon: "📍" },
      { value: "baleares", label: "Baleares", icon: "📍" },
      { value: "barcelona", label: "Barcelona", icon: "📍" },
      { value: "burgos", label: "Burgos", icon: "📍" },
      { value: "caceres", label: "Cáceres", icon: "📍" },
      { value: "cadiz", label: "Cádiz", icon: "📍" },
      { value: "cantabria", label: "Cantabria", icon: "📍" },
      { value: "castellon", label: "Castellón", icon: "📍" },
      { value: "ceuta", label: "Ceuta", icon: "📍" },
      { value: "ciudad_real", label: "Ciudad Real", icon: "📍" },
      { value: "cordoba", label: "Córdoba", icon: "📍" },
      { value: "cuenca", label: "Cuenca", icon: "📍" },
      { value: "girona", label: "Girona", icon: "📍" },
      { value: "granada", label: "Granada", icon: "📍" },
      { value: "guadalajara", label: "Guadalajara", icon: "📍" },
      { value: "gipuzkoa", label: "Gipuzkoa", icon: "📍" },
      { value: "huelva", label: "Huelva", icon: "📍" },
      { value: "huesca", label: "Huesca", icon: "📍" },
      { value: "jaen", label: "Jaén", icon: "📍" },
      { value: "a_coruna", label: "A Coruña", icon: "📍" },
      { value: "la_rioja", label: "La Rioja", icon: "📍" },
      { value: "las_palmas", label: "Las Palmas", icon: "📍" },
      { value: "leon", label: "León", icon: "📍" },
      { value: "lleida", label: "Lleida", icon: "📍" },
      { value: "lugo", label: "Lugo", icon: "📍" },
      { value: "madrid", label: "Madrid", icon: "📍" },
      { value: "malaga", label: "Málaga", icon: "📍" },
      { value: "melilla", label: "Melilla", icon: "📍" },
      { value: "murcia", label: "Murcia", icon: "📍" },
      { value: "navarra", label: "Navarra", icon: "📍" },
      { value: "ourense", label: "Ourense", icon: "📍" },
      { value: "palencia", label: "Palencia", icon: "📍" },
      { value: "pontevedra", label: "Pontevedra", icon: "📍" },
      { value: "salamanca", label: "Salamanca", icon: "📍" },
      { value: "tenerife", label: "Santa Cruz de Tenerife", icon: "📍" },
      { value: "segovia", label: "Segovia", icon: "📍" },
      { value: "sevilla", label: "Sevilla", icon: "📍" },
      { value: "soria", label: "Soria", icon: "📍" },
      { value: "tarragona", label: "Tarragona", icon: "📍" },
      { value: "teruel", label: "Teruel", icon: "📍" },
      { value: "toledo", label: "Toledo", icon: "📍" },
      { value: "valencia", label: "Valencia", icon: "📍" },
      { value: "valladolid", label: "Valladolid", icon: "📍" },
      { value: "bizkaia", label: "Bizkaia", icon: "📍" },
      { value: "zamora", label: "Zamora", icon: "📍" },
      { value: "zaragoza", label: "Zaragoza", icon: "📍" },
    ],
  },
  {
    /*
     * Hasta cuántos kilómetros acepta.
     *
     * Junto al precio, lo que todo el mundo mira en un usado. No se
     * preguntaba en absoluto, así que la búsqueda no podía descartar un
     * coche de 250.000 km para alguien que quería uno con pocos.
     */
    id: "km_maximos_coche",
    block: "Vehículo",
    blockIcon: "🛞",
    question: "¿Hasta cuántos kilómetros aceptarías?",
    subtitle: "A más kilómetros, menos precio y más mantenimiento por delante.",
    type: "cards",
    options: [
      { value: "hasta_50k", label: "Hasta 50.000 km", icon: "✨", desc: "Casi nuevo, y se paga" },
      { value: "hasta_100k", label: "Hasta 100.000 km", icon: "👍", desc: "El equilibrio habitual" },
      { value: "hasta_150k", label: "Hasta 150.000 km", icon: "🛣️", desc: "Más barato, revisa el mantenimiento" },
      { value: "sin_limite_km", label: "Me da igual", icon: "🤷", desc: "Si el coche está bien cuidado, no me importa" },
    ],
  },
  {
    /*
     * Qué tipo de coche.
     *
     * La recomendación decía «un compacto equilibrado» sin haberlo
     * preguntado: lo deducía de los ocupantes y del uso. Y es de las pocas
     * cosas que la gente tiene decidida de antemano, así que deducirla es
     * arriesgarse a acertar la modalidad y fallar el coche.
     *
     * «Me da igual» está de primero a propósito: quien no lo tenga decidido
     * no debe sentir que tiene que elegir.
     */
    id: "carroceria_preferida",
    block: "Vehículo",
    blockIcon: "🚗",
    question: "¿Qué tipo de coche buscas?",
    subtitle: "Si no lo tienes claro, lo deducimos del resto de respuestas.",
    type: "cards",
    options: [
      { value: "indiferente_carroceria", label: "Me da igual", icon: "🤷", desc: "Elegid vosotros según lo demás" },
      { value: "urbano", label: "Urbano pequeño", icon: "🚙", desc: "Para ciudad y aparcar fácil" },
      { value: "compacto", label: "Compacto", icon: "🚗", desc: "El equilibrio habitual entre tamaño y precio" },
      { value: "berlina", label: "Berlina", icon: "🚘", desc: "Más maletero y más confort en carretera" },
      { value: "familiar", label: "Familiar", icon: "🚐", desc: "Maletero largo sin subir de altura" },
      { value: "suv", label: "SUV o todocamino", icon: "🚙", desc: "Postura alta y más espacio" },
      { value: "monovolumen", label: "Monovolumen", icon: "🚌", desc: "Seis o siete plazas" },
    ],
  },
  {
    /*
     * Cambio, vendedor y potencia.
     *
     * Las tres salen de columnas que el pool tiene rellenas -el cambio y el
     * vendedor en el 100% de las ofertas, la potencia en el 95%- y las tres
     * son decisiones que la gente ya trae tomada de casa. Preguntar algo que
     * la base no sabe responder no estrecha la búsqueda: la ralentiza.
     *
     * Por eso NO se pregunta por plazas ni por tracción aunque parezcan
     * útiles: las plazas están en el 26% de las ofertas y la tracción en el
     * 16%, así que filtrar por ellas escondería tres de cada cuatro coches
     * buenos por no haberlos sabido describir.
     */
    id: "cambio_preferido",
    block: "Vehículo",
    blockIcon: "⚙️",
    question: "¿Cambio automático o manual?",
    subtitle: "El automático se paga más caro de salida y en ciudad se agradece cada día.",
    type: "cards",
    options: [
      { value: "indiferente_cambio", label: "Me da igual", icon: "🤷", desc: "Lo que mejor encaje con lo demás" },
      { value: "automatico", label: "Automático", icon: "🅰️", desc: "Menos cansado en atascos y en ciudad" },
      { value: "manual", label: "Manual", icon: "🇲", desc: "Más barato de comprar y de reparar" },
    ],
  },
  {
    id: "quien_vende",
    block: "Vehículo",
    blockIcon: "🤝",
    question: "¿A quién prefieres comprárselo?",
    subtitle: "Un profesional responde con garantía legal de doce meses; un particular suele salir más barato.",
    type: "cards",
    options: [
      { value: "indiferente_vendedor", label: "Me da igual", icon: "🤷", desc: "Lo importante es el coche" },
      { value: "profesional", label: "Profesional", icon: "🏢", desc: "Concesionario o compraventa, con garantía" },
      { value: "particular", label: "Particular", icon: "👤", desc: "Sin garantía, pero suele costar menos" },
    ],
  },
  {
    id: "potencia_minima",
    block: "Vehículo",
    blockIcon: "🐎",
    question: "¿Necesitas potencia de sobra?",
    subtitle: "Cuenta si haces carretera con el coche cargado o si arrastras remolque o caravana.",
    type: "cards",
    options: [
      { value: "indiferente_potencia", label: "Me da igual", icon: "🤷", desc: "Con la potencia normal de su categoría me vale" },
      { value: "al_menos_110", label: "Al menos 110 CV", icon: "🛣️", desc: "Carretera con gente y equipaje sin ir justo" },
      { value: "al_menos_150", label: "Al menos 150 CV", icon: "🚀", desc: "Remolque, caravana o mucha autopista cargado" },
    ],
  },
  {
    /*
     * Si le vale un coche importado.
     *
     * Uno de cada siete anuncios del pool viene de Alemania: 6.214 de 47.696
     * medidos, y la columna está rellena en el 100%, así que filtra de verdad.
     *
     * Pero esta pregunta no está solo por estrechar. La mediana con la que se
     * juzga si un coche está bien de precio **se calcula solo con coches ya
     * matriculados en España**, así que un importado sale siempre «por debajo
     * del mercado» en parte porque todavía no está matriculado aquí. Ese
     * descuento no es un chollo: es la matriculación, el impuesto y la ITV que
     * quien lo compre va a pagar después.
     *
     * Quien no quiera papeleo lo dice aquí y no los ve. Quien diga que le da
     * igual los ve marcados como importados, para que sepa lo que compara.
     */
    id: "coche_importado",
    block: "Vehículo",
    blockIcon: "🌍",
    question: "¿Te vale un coche importado?",
    subtitle: "Uno de cada siete anuncios viene de Alemania. Salen más baratos, pero hay que matricularlos aquí y eso son trámites y dinero.",
    type: "cards",
    options: [
      { value: "solo_nacional", label: "Solo coches ya en España", icon: "🇪🇸", desc: "Matriculado aquí, sin trámites pendientes" },
      { value: "importado_vale", label: "También importado", icon: "🌍", desc: "Más barato de partida, con el papeleo por hacer" },
    ],
  },
  {
    id: "marca_preferencia",
    block: "Preferencias",
    blockIcon: "🏷️",
    question: "¿Tienes preferencia de marca?",
    subtitle: "Las gamas de entrada premium suelen ofrecer peor relación valor/precio",
    type: "cards",
    options: [
      {
        value: "generalista_europea",
        label: "Generalista europea",
        icon: "🔧",
        desc: "Precio equilibrado y red de talleres amplia",
        brandChips: [
          { short: "VW", tone: "var(--marca-oscuro)", label: "Volkswagen" },
          { short: "SE", tone: "var(--gris-900)", label: "Seat" },
          { short: "RE", tone: "#f59e0b", label: "Renault" },
          { short: "SK", tone: "#16a34a", label: "Skoda" },
        ],
      },
      {
        value: "asiatica_fiable",
        label: "Asiática enfocada en fiabilidad",
        icon: "🛡️",
        desc: "Muy buena reputación en consumo y durabilidad",
        brandChips: [
          { short: "TY", tone: "#ef4444", label: "Toyota" },
          { short: "HY", tone: "var(--gris-700)", label: "Hyundai" },
          { short: "KI", tone: "#dc2626", label: "Kia" },
          { short: "NS", tone: "var(--gris-500)", label: "Nissan" },
        ],
      },
      {
        value: "premium_alemana",
        label: "Premium alemana",
        icon: "⭐",
        desc: "Imagen, tecnología y coste superior de mantenimiento",
        brandChips: [
          { short: "BM", tone: "var(--marca)", label: "BMW" },
          { short: "MB", tone: "var(--gris-900)", label: "Mercedes" },
          { short: "AU", tone: "var(--gris-500)", label: "Audi" },
        ],
      },
      {
        value: "premium_escandinava",
        label: "Premium escandinava",
        icon: "❄️",
        desc: "Seguridad y confort como prioridad",
        brandChips: [{ short: "VO", tone: "var(--gris-900)", label: "Volvo" }],
      },
      {
        value: "nueva_china",
        label: "Nuevas marcas",
        icon: "🆕",
        desc: "Equipamientos potentes en relación al precio y motores electrificados",
        brandChips: [
          { short: "BY", tone: "#dc2626", label: "BYD" },
          { short: "MG", tone: "#ef4444", label: "MG" },
          { short: "XP", tone: "var(--gris-900)", label: "XPeng" },
        ],
      },
      {
        value: "sin_preferencia",
        label: "Sin preferencia de marca",
        icon: "🤷",
      },
    ],
  },
  {
    id: "vehiculo_actual",
    block: "Restricciones",
    blockIcon: "🔁",
    question: "¿Tienes un vehículo para entregar o vender?",
    subtitle: "Si lo tienes podemos buscar vendedores que lo acepten como parte del pago o podemos ayudarte a venderlo directamente nosotros.",
    type: "cards",
    options: [
      { value: "si_entrego", label: "Sí, quiero entregarlo al comprar.", icon: "🔄", desc: "Reduce el importe a abonar en la compra" },
      { value: "si_vendo", label: "Sí, prefiero venderlo a un tercero.", icon: "💶", desc: "Ganas más, pero el proceso requiere más tiempo." },
      { value: "no", label: "No tengo vehículo actualmente", icon: "0️⃣", desc: "Ya lo he vendido o es mi primer coche" },
    ],
  },
  {
    id: "ponderacion_score_personalizada",
    block: "Prioridades",
    blockIcon: "🎛️",
    question: "¿Qué criterios son más importantes para ti?",
    subtitle: "Arrastra las tarjetas para ordenarlas: el primero es el que más peso tendrá en tus ofertas.",
    type: "score_weights",
    metrics: [
      { key: "marca_preferencia", label: "Marca o tipo de marca", icon: "🏷️" },
      { key: "propulsion_preferida", label: "Motorización", icon: "⚡" },
      { key: "flexibilidad", label: "Tipo de compra o relación con el coche", icon: "🤝" },
      { key: "antiguedad_vehiculo_buscada", label: "Antigüedad máxima del coche", icon: "🕒" },
      { key: "ocupantes", label: "Número de plazas y espacio", icon: "💺" },
    ],
  },
];

export const ADVANCED_STEPS = [
  {
    id: "provincia_zona",
    block: "Avanzado",
    blockIcon: "📍",
    question: "¿En qué tipo de zona te mueves normalmente?",
    subtitle: "La cobertura real y el peso de la movilidad cambian mucho según ciudad, ZBE o zona rural",
    type: "cards",
    options: [
      { value: "madrid_barcelona", label: "Madrid / Barcelona", icon: "🌆", desc: "Máxima oferta de carsharing, transporte y stock" },
      { value: "capital_zbe", label: "Capital con ZBE", icon: "🚦", desc: "La etiqueta y el acceso pesan bastante" },
      { value: "ciudad_media", label: "Ciudad media / área metropolitana", icon: "🧭", desc: "Uso mixto con oferta intermedia" },
      { value: "zona_rural", label: "Pueblo / zona dispersa", icon: "🌄", desc: "Importa más la autonomía y disponibilidad total" },
      { value: "islas", label: "Islas", icon: "🏝️", desc: "Mercado algo más limitado y más dependiente de stock local" },
    ],
  },
  {
    id: "garaje",
    block: "Avanzado",
    blockIcon: "🔌",
    question: "¿Qué situación real tienes para aparcar y cargar?",
    subtitle: "Clave para saber si un eléctrico o PHEV encaja de verdad en tu vida",
    type: "cards",
    options: [
      { value: "garaje_cargador", label: "Tengo plaza y puedo cargar", icon: "⚡", desc: "La electrificación gana muchos puntos" },
      { value: "garaje_sin_cargador", label: "Tengo plaza pero sin cargador", icon: "🅿️", desc: "Podría instalarlo o depender parcialmente de carga externa" },
      { value: "sin_garaje", label: "No tengo plaza fija / aparco en calle", icon: "🚧", desc: "Mucho más difícil amortizar un eléctrico puro" },
    ],
  },
  {
    /*
     * Si puede enchufar donde trabaja.
     *
     * Solo se preguntaba por el garaje de casa, y con eso un eléctrico queda
     * descartado para todo el que aparca en la calle. Con enchufe en el
     * trabajo sí es viable, y es el caso de mucha gente en ciudad.
     */
    id: "carga_trabajo",
    block: "Energía",
    blockIcon: "🔌",
    question: "¿Podrías enchufar el coche donde trabajas?",
    subtitle: "Aunque no tengas garaje en casa, esto cambia si un eléctrico te encaja o no.",
    type: "cards",
    options: [
      { value: "si_cargador_trabajo", label: "Sí, hay cargador", icon: "🔌", desc: "En el parking de la empresa o cerca" },
      { value: "no_cargador_trabajo", label: "No", icon: "🚫", desc: "No hay dónde enchufar" },
      { value: "no_lo_se_trabajo", label: "No lo sé", icon: "🤔", desc: "Habría que preguntarlo" },
    ],
  },
  {
    id: "zbe_impacto",
    block: "Avanzado",
    blockIcon: "🏙️",
    question: "¿Cuánto te afectan las ZBE y restricciones urbanas?",
    subtitle: "Esto puede cambiar totalmente qué motor y qué solución son más inteligentes",
    type: "cards",
    options: [
      { value: "alta", label: "Mucho", icon: "🚫", desc: "Entro con frecuencia a zonas restringidas" },
      { value: "media", label: "Algo", icon: "⚠️", desc: "Me afecta en momentos concretos" },
      { value: "baja", label: "Poco o nada", icon: "✅", desc: "Mi uso diario no depende apenas de ZBE" },
    ],
  },
  {
    id: "capital_propio",
    block: "Avanzado",
    blockIcon: "🏦",
    question: "Si compraras, ¿qué capital inicial podrías poner sin tensionarte?",
    subtitle: "Esto ayuda a separar lo que parece atractivo de lo que realmente es sano financieramente",
    type: "cards",
    options: [
      { value: "sin_capital", label: "Sin capital disponible para entrada", icon: "🚫", desc: "Necesito financiar el 100% del precio" },
      { value: "menos_5k", label: "Menos de 5.000 €", icon: "💸", desc: "Muy poca entrada disponible" },
      { value: "5k_10k", label: "5.000 - 10.000 €", icon: "💶", desc: "Entrada ajustada pero útil" },
      { value: "10k_20k", label: "10.000 - 20.000 €", icon: "🏁", desc: "Ya da bastante margen de negociación" },
      { value: "mas_20k", label: "Más de 20.000 €", icon: "💼", desc: "Mucha capacidad para reducir financiación" },
    ],
  },
  {
    id: "gestion_riesgo",
    block: "Avanzado",
    blockIcon: "🛡️",
    question: "¿Cuánto control quieres sobre sorpresas de coste y riesgo?",
    subtitle: "Define si priorizamos previsibilidad absoluta o más margen para ahorrar asumiendo algo de riesgo",
    type: "cards",
    options: [
      { value: "alto", label: "Quiero máximo control", icon: "🔒", desc: "Prefiero evitar sustos aunque pague algo más" },
      { value: "medio", label: "Equilibrio razonable", icon: "⚖️", desc: "Quiero buena relación entre coste y tranquilidad" },
      { value: "bajo", label: "Puedo asumir algo de riesgo", icon: "🎯", desc: "Priorizo ahorro aunque haya más variables" },
    ],
  },
  {
    id: "vehiculo_actual_antiguedad",
    soloSi: { vehiculo_actual: ["si_entrego", "si_vendo"] },
    block: "Coche a entregar",
    blockIcon: "🔁",
    question: "¿De qué año es el coche que entregas o vendes?",
    subtitle: "La antigüedad afecta directamente a la tasación y al perfil de comprador interesado",
    type: "cards",
    options: [
      { value: "no_entrego", label: "No entrego ni vendo ningún vehículo", icon: "🚫", desc: "Esta pregunta no aplica a mi caso" },
      { value: "menos_3", label: "Menos de 3 años", icon: "🆕", desc: "Vehículo relativamente nuevo, buena tasación" },
      { value: "3_5", label: "De 3 a 5 años", icon: "📅", desc: "Buen equilibrio entre depreciación y precio de mercado" },
      { value: "6_10", label: "De 6 a 10 años", icon: "🕐", desc: "El precio cae más pero sigue teniendo demanda" },
      { value: "mas_10", label: "Más de 10 años", icon: "⌛", desc: "Depreciación avanzada, mejor orientarlo a venta directa" },
    ],
  },
  {
    id: "vehiculo_actual_km",
    soloSi: { vehiculo_actual: ["si_entrego", "si_vendo"] },
    block: "Coche a entregar",
    blockIcon: "🛣️",
    question: "¿Cuántos kilómetros tiene el coche que entregas o vendes?",
    subtitle: "El kilometraje es uno de los factores más importantes en la tasación",
    type: "cards",
    options: [
      { value: "no_entrego_km", label: "No entrego ni vendo ningún vehículo", icon: "🚫", desc: "Esta pregunta no aplica a mi caso" },
      { value: "menos_50k", label: "Menos de 50.000 km", icon: "🌱", desc: "Poco rodado, valoración alta" },
      { value: "50k_100k", label: "50.000 – 100.000 km", icon: "⚖️", desc: "Uso normal, valoración media" },
      { value: "100k_150k", label: "100.000 – 150.000 km", icon: "🔧", desc: "Alto km, depreciación notable" },
      { value: "mas_150k", label: "Más de 150.000 km", icon: "📉", desc: "Muy rodado, mercado más limitado" },
    ],
  },
  {
    id: "vehiculo_actual_deuda",
    soloSi: { vehiculo_actual: ["si_entrego", "si_vendo"] },
    block: "Coche a entregar",
    blockIcon: "💳",
    question: "¿Tiene financiación pendiente?",
    subtitle: "Si hay deuda, hay que cancelarla antes de poder transferir el vehículo o aplicar su valor a la compra",
    type: "cards",
    options: [
      { value: "sin_deuda", label: "No, está libre de cargas", icon: "✅", desc: "Puedes disponer del 100% de la tasación" },
      { value: "deuda_pequena", label: "Sí, menos de 3.000 €", icon: "🟡", desc: "Fácil de cancelar con parte de la venta" },
      { value: "deuda_media", label: "Sí, entre 3.000 y 10.000 €", icon: "🟠", desc: "Hay que cubrirla antes de transferir" },
      { value: "deuda_grande", label: "Sí, más de 10.000 €", icon: "🔴", desc: "Puede condicionar cuánto puedes aplicar a la nueva compra" },
      { value: "no_se_deuda", label: "No lo sé", icon: "❓", desc: "Te ayudamos a calcularlo" },
    ],
  },
  {
    id: "financiacion_plazo",
    soloSi: { flexibilidad: ["propiedad_financiada", "propiedad_entrada_inicial", "no_tengo_claro"] },
    block: "Financiación",
    blockIcon: "📆",
    question: "¿Qué plazo de financiación te gustaría?",
    subtitle: "A más plazo, cuota más cómoda pero más intereses totales",
    type: "cards",
    options: [
      { value: "no_financio_plazo", label: "No quiero financiar", icon: "🚫", desc: "Pagaré al contado" },
      { value: "12_24", label: "12 – 24 meses", icon: "⚡", desc: "Cuota alta pero pagas muchos menos intereses en total" },
      { value: "36_48", label: "36 – 48 meses", icon: "⚖️", desc: "El plazo más habitual, buen equilibrio" },
      { value: "60_72", label: "60 – 72 meses", icon: "🗓️", desc: "Cuota más cómoda, pero más coste financiero" },
      { value: "mas_84", label: "84 meses o más", icon: "📅", desc: "Máxima comodidad mensual, coste total elevado" },
      { value: "no_se_plazo", label: "No lo tengo claro", icon: "🤔", desc: "Te asesoramos según tu situación" },
    ],
  },
  {
    id: "financiacion_gestion",
    soloSi: { flexibilidad: ["propiedad_financiada", "propiedad_entrada_inicial", "no_tengo_claro"] },
    block: "Financiación",
    blockIcon: "🏦",
    question: "¿Cómo prefieres gestionar la financiación?",
    subtitle: "Compara siempre el TAE real, independientemente de quién la ofrezca",
    type: "cards",
    options: [
      { value: "no_financio_gestion", label: "No quiero financiar", icon: "🚫", desc: "Pagaré al contado" },
      { value: "banco_propio", label: "Con mi banco de confianza", icon: "🏛️", desc: "Más control y posibilidad de negociar el tipo de interés" },
      { value: "concesionario", label: "Con el financiero del concesionario", icon: "🚗", desc: "Más cómodo, pero compara el TAE siempre" },
      { value: "broker_comparador", label: "A través de un comparador o broker", icon: "🔍", desc: "Útil si buscas la mejor oferta del mercado" },
      { value: "no_se_financiacion", label: "No lo sé todavía", icon: "💬", desc: "Te orientamos durante el proceso de compra" },
    ],
  },
];

export const getQuestionnaireSteps = (advancedMode = false) =>
  advancedMode ? [...STEPS, ...ADVANCED_STEPS] : STEPS;

/**
 * Si esta pregunta le toca a quien ha contestado esto.
 *
 * Había cinco que se le hacían a todo el mundo y solo tienen sentido para
 * algunos:
 *
 *   - el año, los kilómetros y la deuda **del coche que entrega**, a quien
 *     acababa de decir que no tiene ninguno;
 *   - el plazo y la gestión **de la financiación**, a quien acababa de decir
 *     que paga al contado.
 *
 * Se notaba en que las dos de financiación tenían «No quiero financiar»
 * como primera opción: la pregunta llevaba dentro la prueba de que se
 * estaba haciendo a quien no tocaba.
 *
 * `soloSi` es un objeto y no una función a propósito: así se lee de un
 * vistazo en la propia pregunta y no hay que ir a buscar ninguna regla.
 */
export function seLePregunta(paso, respuestas = {}) {
  const condicion = paso && paso.soloSi;
  if (!condicion) return true;

  return Object.entries(condicion).every(([clave, valen]) => {
    const contestado = respuestas ? respuestas[clave] : undefined;
    /*
     * Sin contestar todavía, la pregunta se queda.
     *
     * Esconderla aquí sería adivinar: quien aún no ha dicho si entrega
     * coche puede acabar diciendo que sí, y la pregunta tiene que estar
     * esperándole. En cuanto conteste, desaparece sola si no le toca.
     */
    if (contestado === undefined || contestado === null || contestado === "") return true;

    const lista = Array.isArray(valen) ? valen : [valen];
    if (Array.isArray(contestado)) return contestado.some((v) => lista.includes(v));
    return lista.includes(contestado);
  });
}
