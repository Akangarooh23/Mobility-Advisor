"use strict";

/**
 * La hoja de «Nosotros lo vendemos por ti».
 *
 * Es una página de producción que prometía cosas que ya no son verdad: el
 * informe de estado marcado como opcional cuando es obligatorio, y un botón que
 * decía «cuéntanos qué coche tienes» para llevar a un formulario que no lo
 * preguntaba y que no creaba ningún lead.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

/**
 * Lo mismo, pero sin comentarios.
 *
 * Las reglas de aquí son sobre el código, y el comentario que explica por qué se
 * quitó un color o una palabra tiene que nombrarlos. Sin esto, documentar un
 * arreglo rompe la prueba que vigila ese arreglo — que es exactamente lo que
 * pasó al reescribir esta página.
 */
const soloCodigo = (texto) => texto
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

const PAGINA = leer("src/pages/SellProfessionalAssistPage.js");
const CSS = leer("src/pages/SellProfessionalAssistPage.css");
const FORM = leer("src/components/FormularioEncargoVenta.js");
const ES = JSON.parse(leer("src/locales/es.json"));
const LEADS = leer("lib/api/leads-handler.js");

describe("el botón lleva a un formulario propio", () => {
  test("y no al formulario de contacto general", () => {
    assert.match(PAGINA, /<FormularioEncargoVenta \/>/);
    assert.ok(!/onStartRequest/.test(PAGINA), "sigue saltando al contacto general");
  });

  test("que pregunta las dos cosas que el botón promete", () => {
    assert.match(FORM, /¿Qué coche quieres vender\?/);
    assert.match(FORM, /¿En cuánto tiempo\?/);
  });

  test("y que crea un lead de verdad", () => {
    // Antes esto acababa en un correo a una bandeja: el cliente no aparecía en
    // ninguna pantalla del ERP.
    assert.match(FORM, /fetch\("\/api\/leads"/);
    assert.match(FORM, /loQueSeManda\(datos\)/);
  });

  test("el tipo nuevo lo acepta el servidor", () => {
    /*
     * Sin esto el lead entraría como «info» y se mezclaría con las consultas
     * del marketplace: nadie sabría cuántos encargos entran por la web.
     */
    assert.match(LEADS, /ALLOWED_TYPES\s*=\s*\[[^\]]*"venta_gestionada"/);
    /*
     * La etiqueta se mete dentro de «tu solicitud de X sobre Y», asi que tiene
     * que ser un nombre y no una frase en tercera persona: con «quiere que le
     * vendamos el coche» salia «tu solicitud de quiere que le vendamos el
     * coche sobre Volkswagen T-Roc».
     */
    assert.match(LEADS, /venta_gestionada: "gestión de venta"/);
  });
});

describe("lo que la página promete", () => {
  test("el informe de estado no se pinta como opcional", () => {
    /*
     * Llevaba la etiqueta «Opcional segun caso» y es obligatorio: es lo que
     * separa este anuncio de uno de Milanuncios. Ahora la pagina no tiene
     * etiquetas de opcional en ningun paso.
     */
    assert.match(PAGINA, /informe de estado/i);
    assert.ok(!/opcional/i.test(soloCodigo(PAGINA)), "la pagina vuelve a llamar opcional a algo");
  });

  test("los tres números del trato se dicen antes de enviar nada", () => {
    /*
     * «No adelantas un euro» es lo mejor que hay que contar y estaba escondido
     * hasta que alguien cogía el teléfono. Enseñarlo aquí hace que la llamada
     * empiece con un argumento en vez de con una sorpresa.
     */
    assert.match(FORM, /299 €/);
    assert.match(FORM, /30 días/);
    assert.match(FORM, /150 €/);
  });
});

describe("lo visual", () => {
  test("esta hoja no estrena paleta propia", () => {
    /*
     * Tenia la suya: un ambar #ba7517 que no era de ningun sitio, con el que el
     * boton principal de esta pantalla salia de otro color que el de la
     * anterior. Y veinticuatro colores mas escritos a mano, asi que el dia que
     * cambiara la paleta esta pagina no se enteraba.
     *
     * Lo unico que se admite a mano es el rojo del error: no esta en los
     * tokens.
     */
    const aMano = [...soloCodigo(CSS).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    const permitidos = new Set(["#b91c1c", "#fef2f2"]);
    const sobran = [...new Set(aMano)].filter((c) => !permitidos.has(c));
    assert.deepEqual(sobran, [], `colores a mano fuera de los tokens: ${sobran.join(", ")}`);
  });

  test("la accion principal es el negro de la marca", () => {
    // Eran dos pantallas seguidas con el boton principal de dos colores.
    assert.match(CSS, /\.vpt-cta \{[\s\S]{0,320}background: var\(--gris-900\)/);
  });

  test("nada puede desbordarse a lo ancho", () => {
    /*
     * El desperfecto anterior fue una tarjeta con min-width dentro de un
     * contenedor con flex-shrink: 0, que se salia por la derecha. La forma de
     * que no vuelva a pasar no es ajustar numeros: es que no haya ningun ancho
     * minimo y que el contenido tenga tope y centro.
     */
    assert.ok(!/min-width:\s*\d/.test(CSS), "hay un ancho minimo, que es como se desbordo la ultima vez");
    assert.match(CSS, /\.vpt-form-inner \{[\s\S]{0,160}max-width: 460px/);
    assert.match(CSS, /overflow-x: clip/);
  });

  test("y los pasos se leen en el movil", () => {
    // El numero y su linea se encogen: a 44 px el camino sigue siendo un
    // camino y el texto no se queda en una tira.
    assert.match(CSS, /@media \(max-width: 640px\)[\s\S]{0,300}\.vpt-paso \{ grid-template-columns: 44px/);
  });

  test("los campos del formulario tienen foco visible", () => {
    // Se rellena con el teclado y desde el móvil.
    assert.match(CSS, /\.fev-campo input:focus[\s\S]{0,160}outline:/);
  });

  test("y en el móvil los dos campos de una línea se apilan", () => {
    assert.match(CSS, /@media \(max-width: 640px\)[\s\S]{0,220}\.fev-dos \{ grid-template-columns: 1fr; \}/);
  });
});

describe("el correo que recibe el cliente", () => {
  /*
   * La plantilla comun se le quedaba torcida a este tipo de solicitud. En la
   * prueba real salio: «Tu solicitud de quiere que le vendamos el coche sobre
   * Volkswagen T-Roc R line 2022 ha quedado registrada» y «Cuando te viene
   * bien: Quiere vender: en un mes».
   */
  test("no le habla de «su solicitud sobre» un coche que es suyo", () => {
    assert.match(LEADS, /Hemos apuntado tu <strong>\$\{esc\(vehicle_title\)\}<\/strong> para venderlo por ti/);
  });

  test("la fila del plazo dice «cuando quieres venderlo», no «cuando te viene bien»", () => {
    // Es lo que hacia que saliera un doble rotulo sin sentido.
    assert.match(LEADS, /esVentaGestionada \? "Cuándo quieres venderlo"/);
  });

  test("y no repite «Quiere vender» dentro del valor", () => {
    assert.ok(
      LEADS.includes('replace(/^Quiere vender:\\s*/i, "")'),
      "el valor entra tal cual y sale «Cuándo quieres venderlo: Quiere vender: en un mes»",
    );
  });

  test("promete lo mismo que la web: 24 horas, no dos", () => {
    /*
     * El formulario dice «en menos de 24 horas laborables» y el correo decia
     * «en menos de dos horas». Prometer dos y llamar al dia siguiente es peor
     * que prometer un dia y cumplirlo.
     */
    assert.match(LEADS, /esVentaGestionada \? "Te llamamos en menos de 24 horas laborables"/);
    assert.match(FORM, /24 horas laborables/);
  });
});

describe("el panel del cliente", () => {
  const PANEL = leer("src/pages/userDashboard/UserDashboardSolicitudes.js");

  test("no le enseña la clave del tipo en crudo", () => {
    /*
     * Salia «venta_gestionada» tal cual en la tarjeta de su solicitud. En el ERP
     * eso es feo; aqui lo lee el cliente.
     */
    assert.match(PANEL, /venta_gestionada: "🤝 Lo vendemos por ti"/);
    assert.match(PANEL, /venta_gestionada: \{ bg:/, "y sin color, el chip sale del estilo por defecto");
  });

  test("no le ofrece anular una cita que no existe", () => {
    /*
     * El boton decia «Anular cita» en una solicitud donde nadie ha quedado a
     * ninguna hora. Le hace pensar que quedo con nosotros y no se acuerda.
     */
    assert.match(PANEL, /\{esUnaCita \? "Anular cita" : "Anular solicitud"\}/);
  });

  test("y la regla no es «renting o no», que dejaba fuera a info y question", () => {
    // Esas dos tampoco tienen cita, y llevaban desde siempre diciendo «Anular
    // cita».
    assert.match(PANEL, /const CON_CITA = \['visit', 'viewing_seller', 'visita_marketplace'\]/);
    assert.match(PANEL, /const esUnaCita = CON_CITA\.includes\(item\.type\) \|\| !!meta\.appointment_date/);
  });

  test("una solicitud con hora puesta sigue contando como cita", () => {
    // Un lead de tipo «info» al que se le acaba dando cita desde el ERP: ahi si
    // hay una hora que anular.
    assert.match(PANEL, /!!meta\.appointment_date/);
  });
});

describe("el trato no se cuenta como una condena", () => {
  /*
   * La tarjeta de los 30 dias decia «Y eres libre… nadie te retiene». El fallo
   * no era la palabra: era contestar una objecion que nadie habia hecho. Al
   * negar que le retengamos se planta la idea de que podriamos, y quien lo lee
   * deduce que durante ese mes esta atrapado.
   *
   * Y es al reves: ese plazo nos lo ponemos nosotros.
   */
  const PALABRAS_DE_CARCEL = [
    /nadie te retiene/i,
    /eres libre/i,
    /puedes irte/i,
    /puedes salirte/i,
    /sin compromiso de permanencia/i,
    /puedes cancelarlo cuando quieras/i,
    /en exclusiva/i,
    /atado/i,
    /obligad/i,
  ];

  test("ni en la pagina", () => {
    for (const mala of PALABRAS_DE_CARCEL) {
      assert.doesNotMatch(soloCodigo(PAGINA), mala, `la pagina vuelve a sonar a carcel: ${mala}`);
    }
  });

  test("ni en la letra pequeña del formulario", () => {
    for (const mala of PALABRAS_DE_CARCEL) {
      assert.doesNotMatch(soloCodigo(FORM), mala, `la letra pequeña vuelve a sonar a carcel: ${mala}`);
    }
  });

  test("el plazo se cuenta como algo nuestro", () => {
    // «Nos damos un mes» dice lo mismo que «puedes irte», pero lo dice desde
    // nuestro lado: es el tiempo que nos ponemos para vender su coche.
    assert.match(PAGINA, /Nos damos un mes/);
    assert.match(FORM, /Nos damos <strong>30 días<\/strong>/);
  });

  test("y el encargo ya no dice que dure 30 dias, porque no caduca", () => {
    // Se extiende hasta que el cliente lo deja o hasta que vendemos. Los 30
    // dias son hasta cuando se le puede cobrar la cancelacion.
    assert.doesNotMatch(soloCodigo(FORM), /encargo dura/i);
  });
});
