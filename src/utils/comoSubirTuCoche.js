/**
 * La guía que se descarga el cliente: cómo subir su coche, paso a paso.
 *
 * Quien la lee no es de la casa. Es alguien que ha llamado, ha dicho que sí, y
 * ahora tiene que entrar en su cuenta y reunir cinco cosas —el coche, los
 * papeles, la tasación, el informe y sus horas— sin nadie al lado. Si se
 * atasca, no abre un ticket: lo deja.
 *
 * Por eso se descarga. Lo puede tener abierto en el ordenador mientras hace las
 * fotos con el móvil, se lo puede reenviar a su hijo, o imprimirlo. Un correo
 * con seis enlaces no sirve para eso.
 *
 * ## Por qué el texto vive aquí y no en el HTML
 *
 * Porque hay dos sitios que lo enseñan —la página que lo lee en pantalla y el
 * fichero que se descarga— y son la misma guía. Escrito dos veces, uno de los
 * dos se queda viejo, y el que se queda viejo es siempre el que no se mira.
 */

/** El precio del trato, para no repetirlo escrito a mano en cada sitio. */
export const FEE_DE_GESTION = 299;
export const FEE_DE_CANCELACION = 150;
export const DIAS_HASTA_SALIR_GRATIS = 30;

/** Cuántas fotos y cuántas franjas se le piden. */
export const FOTOS_MINIMAS = 6;
export const FRANJAS_MINIMAS = 6;
export const DIAS_DE_FRANJAS = 14;

export const TITULO = "Cómo subir tu coche";

export const ENTRADILLA =
  "Para que podamos vender tu coche necesitamos cinco cosas. Se hacen desde tu " +
  "cuenta y se tarda menos de lo que parece: lo más largo son las fotos. " +
  "Puedes dejarlo a medias y seguir otro día — se guarda solo.";

/**
 * Los cinco pasos.
 *
 * En el orden en que conviene hacerlos: el coche primero, porque todo lo demás
 * cuelga de él, y las franjas al final, porque son lo único que caduca.
 *
 * Cada uno lleva `porque`: sin él, «sube seis fotos» es una orden. Con él es
 * una razón, y quien entiende la razón hace mejor la foto.
 */
export const PASOS = [
  {
    titulo: "Da de alta tu coche",
    donde: "Mi panel → Vehículos → Añadir vehículo",
    que: [
      "Matrícula, marca, modelo, año y kilómetros",
      `${FOTOS_MINIMAS} fotos como mínimo`,
    ],
    porque:
      "Con menos de seis fotos el anuncio se ve pobre y se pasa de largo. Las que " +
      "funcionan son las cuatro esquinas del coche, el interior y el salpicadero " +
      "con los kilómetros puestos.",
    consejo:
      "Con luz de día y el coche limpio. No hace falta un fotógrafo: hace falta " +
      "que se vea el coche entero y que no haya sombras encima.",
  },
  {
    titulo: "Sube los papeles",
    donde: "Mi panel → Vehículos → tu coche → Documentos",
    que: [
      "Permiso de circulación",
      "Ficha técnica",
      "La última ITV",
    ],
    porque:
      "Son los que demuestran que el coche es tuyo y que está en regla. Sin ellos " +
      "no se puede publicar, y en la venta habría que pararlo todo para buscarlos.",
    consejo:
      "Vale una foto con el móvil, no hace falta escáner. Que se lea entero y que " +
      "no salga cortado por ningún lado.",
  },
  {
    titulo: "Hazte la tasación gratuita",
    donde: "Mi panel → Tasaciones",
    que: [
      "Cuatro preguntas sobre el coche",
    ],
    porque:
      "De ahí sale el precio del que hablamos. Es gratis y no te compromete a " +
      "nada: te decimos a cuánto se está vendiendo un coche como el tuyo, y tú " +
      "decides si te encaja.",
    consejo:
      "Contesta los kilómetros reales aunque sean muchos. Un precio calculado " +
      "sobre datos que no son acaba en un comprador que se va al verlo.",
  },
  {
    titulo: "Haz el informe de estado",
    donde: "Mi panel → Vehículos → tu coche → Informe de estado",
    que: [
      "Fotos guiadas con el móvil, siguiendo lo que pide la pantalla",
    ],
    porque:
      "Es lo que hace que un comprador se fíe antes de venir. Va con el anuncio y " +
      "cuenta el estado del coche con sus golpes y sus arañazos, sin esconderlos.",
    consejo:
      "Enséñalo tal cual está. Un golpe que aparece en el informe no espanta a " +
      "nadie; uno que aparece en la visita, sí.",
  },
  {
    titulo: "Elige cuándo puedes enseñarlo",
    donde: "Mi panel → Vehículos → tu coche → Franjas horarias",
    que: [
      `Al menos ${FRANJAS_MINIMAS} franjas en los próximos ${DIAS_DE_FRANJAS} días`,
    ],
    porque:
      "Los compradores piden cita solo en las horas que tú marques, así que nadie " +
      "te llama a deshora. Si no hay horas libres, tu anuncio se ve pero no se " +
      "puede visitar.",
    consejo:
      "Pon las que de verdad te vengan bien, aunque sean pocas y en fin de semana. " +
      "Y vuelve a poner más cuando se vayan gastando: te avisamos.",
  },
];

/** Lo que pasa después, para que no se quede pensando que ya está todo hecho. */
export const DESPUES = [
  "Llevamos tu coche a un taller de la red y lo revisan. Lo pagamos nosotros.",
  "Escribimos el anuncio y lo publicamos, con nuestro teléfono.",
  "Filtramos las llamadas y te llevamos a los compradores que van en serio.",
  "Cuando se vende, hacemos el contrato y la transferencia en la DGT.",
];

export const EL_TRATO = [
  "No adelantas nada: ni la tasación, ni el informe, ni el taller, ni el anuncio.",
  `Se cobran ${FEE_DE_GESTION} € solo si vendemos tu coche, y con el IVA incluido.`,
  `Nos damos ${DIAS_HASTA_SALIR_GRATIS} días: si aceptas nuestro precio y pasan sin ` +
    `venderlo, lo dejas sin pagar nada. Si te sales antes, son ${FEE_DE_CANCELACION} €.`,
];

export const DUDAS =
  "Si algo no te cuadra, llámanos al 684 717 736 o contesta al correo que te " +
  "hemos mandado. No hace falta que lo tengas todo hecho para preguntar.";
