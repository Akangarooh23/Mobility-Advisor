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
 * Lo que cubre el transporte, dicho en la ficha.
 *
 * La línea del desglose dice «Transporte desde Alemania» y se queda a medias:
 * no aclara hasta dónde. Es un precio único para toda la península, y eso hay
 * que decirlo antes de que pague la fianza, no después.
 */
describe("la entrega en la ficha del coche", () => {
  const FICHA3 = fs.readFileSync(
    path.join(__dirname, "PortalVoDetailPage.js"),
    "utf8"
  );

  test("hay una sección de transporte con sus dos puntas", () => {
    // «Transporte desde Alemania» dice de dónde y no dice a dónde.
    expect(FICHA3).toContain("El viaje del coche, con sus dos puntas");
    expect(FICHA3).toContain(">Desde</span>");
    expect(FICHA3).toContain(">Hasta</span>");
  });

  test("el origen sale de la oferta, no de un texto fijo", () => {
    expect(FICHA3).toContain("selectedPortalVoOffer.location");
  });

  test("y el destino, de lo que ha dicho el cliente", () => {
    expect(FICHA3).toContain("cualquier punto de la península");
    expect(FICHA3).toContain("Cambiar dirección de envío");
  });

  test("avisa del recargo de fuera, sin ponerle cifra", () => {
    expect(FICHA3).toContain("Fuera de la península la entrega puede llevar un recargo");
    // Un número inventado en un precio público es peor que decir que se confirma.
    const aviso = FICHA3.slice(
      FICHA3.indexOf("Fuera de la península la entrega"),
      FICHA3.indexOf("Fuera de la península la entrega") + 300
    );
    expect(aviso).not.toMatch(/\d+\s*€/);
  });

  test("y que se puede cambiar hasta pagar la fianza, no hasta que salga", () => {
    // Con la fianza pagada queda fijada: lo que se le cobró incluye llevárselo
    // a donde dijo.
    expect(FICHA3).toContain("cambiar hasta que pagues la fianza");
  });
});

describe("cambiar la dirección desde la propia ficha", () => {
  const FICHA4 = fs.readFileSync(
    path.join(__dirname, "PortalVoDetailPage.js"),
    "utf8"
  );

  test("hay un botón para decir dónde se lo llevamos", () => {
    expect(FICHA4).toContain("Cambiar dirección de envío");
  });

  test("se recuerda entre coches: quien compara cinco no lo escribe cinco veces", () => {
    expect(FICHA4).toContain("popcar_entrega");
    expect(FICHA4).toContain("leeEntregaGuardada");
  });

  test("el aviso del recargo sale aquí, antes de pagar la fianza", () => {
    expect(FICHA4).toContain("llevaRecargo(entrega.provincia)");
    expect(FICHA4).toContain("antes de que pagues nada");
  });

  test("y lo que ha dicho viaja con la solicitud", () => {
    expect(FICHA4).toContain("entrega_ciudad: entrega.ciudad");
    expect(FICHA4).toContain("entrega_provincia: entrega.provincia");
  });
});
