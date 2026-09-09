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
  test("el informe de estado ya no es opcional", () => {
    // Es la puerta que se decidió exigir, y es lo que diferencia el anuncio de
    // uno de Milanuncios.
    assert.doesNotMatch(ES.sell.professionalStep1Tag, /opcional/i);
    assert.match(ES.sell.professionalStep1Tag, /obligatorio/i);
  });

  test("y tampoco lo parece por el color de su etiqueta", () => {
    // La etiqueta llevaba el estilo de «opcional». Cambiar solo el texto habría
    // dejado la palabra «obligatorio» pintada de gris de opcional.
    assert.ok(
      !/tag-opt">\{t\("sell\.professionalStep1Tag"\)\}/.test(PAGINA),
      "el texto dice obligatorio pero el estilo sigue siendo el de opcional",
    );
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
  test("la acción principal es del mismo color que en la pantalla anterior", () => {
    // Eran dos pantallas seguidas con el botón principal de dos colores: negro
    // en «Publicar con IDCar» y ámbar aquí.
    assert.match(CSS, /\.btn-gold \{[\s\S]{0,240}var\(--marca\), var\(--marca-claro\)/);
    assert.ok(!/#ba7517, #c98120/.test(CSS), "sigue el ámbar de esta hoja");
  });

  test("la banda del final va en columna, no en fila", () => {
    /*
     * Estaba en fila —mensaje a la izquierda, botones a la derecha— y
     * funcionaba mientras a la derecha hubiera dos botones. Con un formulario
     * de cinco campos, el mensaje se quedaba en una tira de 140 px y la
     * tarjeta se salia de la banda por la derecha.
     */
    assert.match(CSS, /\.dark-cta \{[\s\S]{0,400}flex-direction: column/);
  });

  test("y la tarjeta no tiene un ancho minimo que la desborde", () => {
    // Era exactamente lo que la sacaba fuera: un min-width contra un
    // contenedor con flex-shrink: 0.
    assert.ok(!/min-width: 300px/.test(CSS), "vuelve a haber un ancho minimo");
    assert.match(CSS, /\.dc-right \{[\s\S]{0,320}max-width: 420px/);
  });

  test("el breadcrumb se lee", () => {
    // Era #ccc sobre blanco: alrededor de 1,6:1 de contraste.
    assert.ok(!/\.breadcrumb \{[\s\S]{0,80}color: #ccc/.test(CSS));
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
