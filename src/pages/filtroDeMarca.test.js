/**
 * El desplegable de marca del marketplace.
 *
 * Esta pantalla no usa el `<select>` del navegador: usa una lista propia. Cuando
 * el desplegable de marca pasó a tener dos bloques —«con coches disponibles» y
 * «resto del catálogo»— las 443 marcas quedaron dentro de `<optgroup>`, y la
 * lista propia solo miraba los hijos directos que fueran `<option>`.
 *
 * Resultado: el filtro se quedó con una sola entrada, la de «Marca», y no se
 * podía elegir ninguna. Esta prueba fija que un grupo no se traga sus opciones.
 */
import fs from "fs";
import path from "path";

const FUENTE = fs.readFileSync(
  path.join(__dirname, "PortalVoMarketplacePage.js"),
  "utf8"
);

describe("el desplegable de los filtros", () => {
  test("lee las opciones que van dentro de un grupo", () => {
    expect(FUENTE).toContain('hijo.type === "optgroup"');
  });

  test("no se queda solo con los hijos sueltos", () => {
    // El filtro de antes: `.filter((c) => c && c.type === "option")` aplicado
    // directamente a los hijos, que dejaba fuera los grupos enteros.
    const filtroViejo = 'React.Children.toArray(children)\n    .filter((c) => c && c.type === "option")';
    expect(FUENTE).not.toContain(filtroViejo);
  });

  test("el título del grupo no se puede pulsar", () => {
    // Si una cabecera fuera seleccionable, elegirla pondría el filtro a
    // «Con coches disponibles», que no es ninguna marca.
    expect(FUENTE).toContain("opt.cabecera !== undefined");
  });

  test("un grupo sin opciones no pinta su título", () => {
    expect(FUENTE).toContain("if (!dentro.length) continue;");
  });

  test("el filtro de marca sigue usando los dos bloques", () => {
    expect(FUENTE).toContain('optgroup label="Con coches disponibles"');
    expect(FUENTE).toContain('optgroup label="Resto del catálogo"');
  });
});

/**
 * El precio cuando se cambia de garantía.
 *
 * Elegir una ampliación cambiaba **solo** el total del desglose. El precio
 * grande de arriba, la cuota del mes, la fianza y el ahorro se quedaban con lo
 * de antes: cinco números para el mismo coche, y cuatro de ellos mintiendo.
 */
const FICHA = fs.readFileSync(
  path.join(__dirname, "PortalVoDetailPage.js"),
  "utf8"
);

describe("el precio con la garantía elegida", () => {
  test("el precio grande sale de la garantía elegida, no de la oferta", () => {
    expect(FICHA).toContain("{formatCurrency(precioFinanciable)}");
    expect(FICHA).not.toContain(
      "{formatCurrency(selectedPortalVoOffer.salePrice ?? selectedPortalVoOffer.price)}"
    );
  });

  test("lo que se financia también", () => {
    expect(FICHA).toContain("const precioFinanciable = isImport");
    expect(FICHA).toContain("? precioConGarantia");
  });

  test("y la fianza: el 30 % de lo que va a pagar", () => {
    expect(FICHA).toContain("Math.round(precioConGarantia * 0.30)");
    expect(FICHA).not.toContain(
      "{formatCurrency(selectedPortalVoOffer.importDeposit)}"
    );
  });

  test("el ahorro se recalcula, o la resta no cuadraría", () => {
    expect(FICHA).toContain("const ahorroConGarantia");
    expect(FICHA).not.toContain("Number(selectedPortalVoOffer.importSavings).toLocaleString");
  });

  test("la garantía elegida viaja con la solicitud", () => {
    // Sin esto, el cliente elige la ampliada y se le guarda la básica.
    expect(FICHA).toContain("garantia_id: garantiaElegida");
  });

  test("solo afecta a los coches de importación", () => {
    // Un coche de concesionario no tiene este catálogo y sigue con su precio.
    expect(FICHA).toContain("isImport\n    ? precioConGarantia");
  });
});

describe("la línea de garantía del desglose", () => {
  const FICHA2 = fs.readFileSync(
    path.join(__dirname, "PortalVoDetailPage.js"),
    "utf8"
  );

  test("enseña la elegida, no la base", () => {
    expect(FICHA2).toContain("etiquetaDeGarantia(garantiaDelCoche)");
    expect(FICHA2).not.toContain("etiquetaDeGarantia(garantiaBase)");
  });

  test("y lo que suma al total, no «incluida» siempre", () => {
    expect(FICHA2).toContain("importeDeGarantia(garantiaDelCoche.diferencia, formatCurrency)");
  });
});

/**
 * Hasta dónde llega lo que ha pagado.
 *
 * Durante unos días la ficha prometió lo que no se había cobrado: la línea decía
 * «Transporte desde Alemania» —de dónde, no hasta dónde— y debajo salía «Hasta:
 * tu casa». Lo incluido trae el coche hasta nuestras instalaciones de Madrid,
 * que es donde pasa la ITV de homologación y donde se matricula. Llevárselo
 * desde ahí se contrata aparte, como el seguro o el reacondicionado.
 */
describe("el transporte incluido, en la ficha", () => {
  const FICHA3 = fs.readFileSync(
    path.join(__dirname, "PortalVoDetailPage.js"),
    "utf8"
  );

  test("hay una sección con las dos puntas del viaje", () => {
    expect(FICHA3).toContain("Transporte incluido");
    expect(FICHA3).toContain(">Desde</span>");
    expect(FICHA3).toContain(">Hasta</span>");
  });

  test("el origen sale de la oferta, no de un texto fijo", () => {
    expect(FICHA3).toContain("selectedPortalVoOffer.location");
  });

  test("y el viaje acaba en Madrid, no en casa del cliente", () => {
    // Es el fondo del cambio: prometer la puerta de su casa era prometer un
    // viaje que no ha pagado.
    expect(FICHA3).toContain("nuestras instalaciones de Madrid");
    expect(FICHA3).not.toContain("tu casa, en cualquier punto de la península");
  });

  test("se le dice que puede recogerlo él", () => {
    expect(FICHA3).toContain("Puedes recogerlo tú");
  });
});

/**
 * Lo que se contrata aparte, y lo que no cambia por contratarlo.
 */
describe("los servicios de la ficha", () => {
  const FICHA4 = fs.readFileSync(
    path.join(__dirname, "PortalVoDetailPage.js"),
    "utf8"
  );

  test("se pintan los que manda el servidor, no una lista escrita aquí", () => {
    expect(FICHA4).toContain("selectedPortalVoOffer.servicios");
    expect(FICHA4).toContain("servicios.map((sv)");
  });

  test("sin precio se dice «a consultar», no un cero", () => {
    // Un cero diría que es gratis. No lo es: es que todavía no se sabe.
    expect(FICHA4).toContain('"a consultar"');
    expect(FICHA4).toContain("sv.precio != null");
  });

  test("y lo que no tiene precio no suma al total", () => {
    expect(FICHA4).toContain("s.precio != null");
    expect(FICHA4).toContain("const sumaDeServicios");
  });

  test("se dice que ninguno entra en la fianza", () => {
    expect(FICHA4).toContain("Ninguno entra en la fianza");
  });

  test("y viajan con la solicitud", () => {
    expect(FICHA4).toContain("servicios: serviciosElegidos");
  });
});

/**
 * La dirección, solo si ha pedido que se la llevemos.
 *
 * Antes se preguntaba siempre, cuando la entrega iba incluida. Ya no lo va:
 * pedirle la calle a quien va a recogerlo él es un campo de más a cambio de
 * nada.
 */
describe("la dirección de entrega", () => {
  const FICHA5 = fs.readFileSync(
    path.join(__dirname, "PortalVoDetailPage.js"),
    "utf8"
  );

  test("el formulario solo sale si ha marcado la entrega", () => {
    expect(FICHA5).toContain("const quiereEntrega");
    expect(FICHA5).toContain("{quiereEntrega && (");
  });

  test("se piden calle y código postal, no solo ciudad y provincia", () => {
    expect(FICHA5).toContain('placeholder="Calle, número y piso"');
    expect(FICHA5).toContain('placeholder="C. P."');
  });

  test("se le repite a dónde se lo llevamos, entre comillas", () => {
    expect(FICHA5).toContain("Te lo llevamos a <strong>«{entregaEscrita}»</strong>");
  });

  test("si no ha dicho nada, se coge la que ya tiene en sus datos", () => {
    // Volver a pedírsela sería preguntarle algo que ya nos dijo.
    expect(FICHA5).toContain("perfil.billingStreet");
    expect(FICHA5).toContain("perfil.billingPostalCode");
    expect(FICHA5).toContain("perfil.billingProvince");
  });

  test("y solo viaja con la solicitud si la ha pedido", () => {
    // Guardar la dirección de quien va a recogerlo él abriría en el ERP un
    // viaje de entrega que nadie ha contratado.
    expect(FICHA5).toContain("entrega_direccion: quiereEntrega ? entrega.calle");
    expect(FICHA5).toContain("entrega_cp: quiereEntrega ? entrega.cp");
  });

  test("el aviso del recargo sale antes de pagar la fianza", () => {
    expect(FICHA5).toContain("recargoDeEntrega");
    expect(FICHA5).toContain("antes de que pagues nada");
  });
});
