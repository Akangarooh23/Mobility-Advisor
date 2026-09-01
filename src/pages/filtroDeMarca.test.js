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

/**
 * Leer un fichero de código para compararlo con texto.
 *
 * Se le quitan los retornos de carro. Estas pruebas buscan trozos escritos con
 * saltos de línea, y en Windows el mismo fichero baila entre LF y CRLF según
 * quién lo haya tocado: sin esto fallan por el final de línea y no por lo que
 * de verdad comprueban, que es lo que dice el código.
 */
function lee(...args) {
  return fs.readFileSync(...args).replace(/\r\n/g, "\n");
}

const FUENTE = lee(
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
const FICHA = lee(
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

  test("y el depósito: el coche entero y nuestro servicio", () => {
    // Ya no es una fianza del 30 %. El coche se lo compra él al concesionario
    // alemán, así que ese dinero tiene que estar depositado entero.
    expect(FICHA).toContain("const depositoImport");
    expect(FICHA).toContain("depositoOferta.total + precioGarantia");
    expect(FICHA).not.toContain("* 0.30");
  });

  test("y el depósito lo dice con lo que de verdad importa: cuándo se suelta", () => {
    expect(FICHA).toContain("No se paga a Alemania hasta que veamos el coche");
    expect(FICHA).toContain("te lo devolvemos entero");
  });

  test("el impuesto se dice que va a cuenta, no como precio cerrado", () => {
    // Si fuera cerrado y el real saliera por encima, esa diferencia la pondría
    // PopCar. Decirlo antes de que pague es lo que permite ajustarlo después.
    expect(FICHA).toContain("va <strong>a cuenta</strong>");
    expect(FICHA).toContain("se te cobra la diferencia");
  });

  test("la garantía ya no se anuncia como incluida", () => {
    // No le vendemos el coche, así que no se la debemos. Decir «incluida» sería
    // prometer algo que no está en el precio ni es nuestro.
    expect(FICHA).not.toContain("<strong>Garantía incluida</strong>");
    expect(FICHA).toContain("Garantía mecánica, si la quieres");
  });

  test("y se dice lo que de verdad se compra: que reclamamos nosotros", () => {
    expect(FICHA).toContain("si hay que reclamar, reclamamos nosotros");
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
  const FICHA2 = lee(
    path.join(__dirname, "PortalVoDetailPage.js"),
    "utf8"
  );

  test("enseña la elegida, no la base", () => {
    expect(FICHA2).toContain("etiquetaDeGarantia(garantiaDelCoche)");
    expect(FICHA2).not.toContain("etiquetaDeGarantia(garantiaBase)");
  });

  test("y lo que suma al total, con su precio entero", () => {
    expect(FICHA2).toContain("importeDeGarantia(garantiaDelCoche.precio, formatCurrency)");
  });
});

/**
 * El viaje del coche, con sus tres puntos.
 *
 * «Transporte desde Alemania» decía de dónde y no decía hasta dónde. Y el viaje
 * no es directo: **todos los coches pasan por Zaragoza**, que es donde se
 * homologan y donde se preparan, y está ahí y no en Madrid porque queda a media
 * distancia de Madrid, Barcelona, Valencia y Bilbao.
 *
 * Los dos tramos van dentro del precio. Que por dentro sean dos camiones —o el
 * mismo conductor— es cosa nuestra: lo que él compra es un viaje.
 */
describe("el viaje en la ficha del coche", () => {
  const FICHA3 = lee(
    path.join(__dirname, "PortalVoDetailPage.js"),
    "utf8"
  );

  test("se ven los tres puntos, no solo el de salida", () => {
    expect(FICHA3).toContain(">Desde</span>");
    expect(FICHA3).toContain(">Pasa por</span>");
    expect(FICHA3).toContain(">Hasta</span>");
  });

  test("el origen sale de la oferta, no de un texto fijo", () => {
    expect(FICHA3).toContain("selectedPortalVoOffer.location");
  });

  test("la parada de Zaragoza se dice, y se dice para qué", () => {
    // Sin esto, tres semanas de espera no se entienden.
    expect(FICHA3).toContain("Zaragoza");
    expect(FICHA3).toContain("donde se homologa y se prepara");
  });

  test("y el viaje acaba en su casa, que es lo que ha pagado", () => {
    expect(FICHA3).toContain("tu casa, <strong>«{entregaEscrita}»</strong>");
    expect(FICHA3).toContain("Los dos tramos van en el precio");
  });

  test("se dice que va incluido, no que se contrata", () => {
    expect(FICHA3).toContain("El viaje, incluido en el precio");
  });
});

/**
 * Lo que se contrata aparte, y lo que no cambia por contratarlo.
 *
 * La entrega en su casa **no** está aquí: va dentro del precio.
 */
describe("los servicios de la ficha", () => {
  const FICHA4 = lee(
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
 * La dirección de envío.
 *
 * Se pide siempre, porque llevárselo va en el precio: no es algo que se
 * contrate. Lo que sí se le rellena es lo que ya nos dijo en sus datos.
 */
describe("la dirección de entrega", () => {
  const FICHA5 = lee(
    path.join(__dirname, "PortalVoDetailPage.js"),
    "utf8"
  );

  test("hay un botón para decir dónde se lo llevamos", () => {
    expect(FICHA5).toContain("Cambiar dirección de envío");
  });

  test("se piden calle y código postal, no solo ciudad y provincia", () => {
    expect(FICHA5).toContain('placeholder="Calle, número y piso"');
    expect(FICHA5).toContain('placeholder="C. P."');
  });

  test("si no ha dicho nada, se coge la que ya tiene en sus datos", () => {
    // Volver a pedírsela sería preguntarle algo que ya nos dijo.
    expect(FICHA5).toContain("perfil.billingStreet");
    expect(FICHA5).toContain("perfil.billingPostalCode");
    expect(FICHA5).toContain("perfil.billingProvince");
  });

  test("y viaja entera con la solicitud, siempre", () => {
    // Siempre, no solo si contrata algo: el segundo tramo, de Zaragoza a su
    // puerta, va en el precio y hay que abrirlo con una dirección.
    expect(FICHA5).toContain("entrega_direccion: entrega.calle");
    expect(FICHA5).toContain("entrega_cp: entrega.cp");
    expect(FICHA5).not.toContain("quiereEntrega ? entrega.calle");
  });

  test("se recuerda entre coches: quien compara cinco no lo escribe cinco veces", () => {
    expect(FICHA5).toContain("popcar_entrega");
    expect(FICHA5).toContain("leeEntregaGuardada");
  });

  test("el aviso del recargo sale antes de pagar la fianza, y sin cifra", () => {
    expect(FICHA5).toContain("recargoDeEntrega");
    expect(FICHA5).toContain("antes de que pagues nada");
  });

  test("y se puede cambiar hasta pagar la fianza, no hasta que salga", () => {
    expect(FICHA5).toContain("cambiar hasta");
    expect(FICHA5).toContain("que pagues la fianza");
  });
});

/**
 * La cilindrada que no se sabe.
 *
 * La ficha ponía «Cilindrada: EV» cuando no había dato. Y como ninguna oferta
 * de importación trae la cilindrada, los 1.568 coches decían ser eléctricos —un
 * Golf diésel de 2005 incluido—, en la pantalla donde el cliente decide.
 */
describe("la cilindrada en la ficha", () => {
  const FICHA6 = lee(
    path.join(__dirname, "PortalVoDetailPage.js"),
    "utf8"
  );

  test("sin dato no se dice que sea eléctrico", () => {
    expect(FICHA6).not.toContain('} cc` : "EV"');
  });

  test("se dice que no se sabe", () => {
    expect(FICHA6).toContain('} cc` : "—"');
  });
});
