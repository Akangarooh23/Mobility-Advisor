/**
 * Lo que ofrece la ficha de un coche a quien está mirando comprar.
 *
 * Dos cambios, pedidos a la vez:
 *
 *   · Fuera la realidad aumentada. En la ficha de venta no ayudaba a decidir y
 *     quitaba sitio a lo que sí, que es el informe.
 *   · Y el bloque de «¿Y el coche que tienes ahora?» vende la gestión de venta,
 *     no la tasación. Quien mira un coche para comprar tiene casi siempre otro
 *     que vender, y la tasación le decía cuánto vale y ahí lo dejaba.
 *
 * Se lee la fuente: montar la ficha entera pide veinte props y una oferta, y lo
 * que se protege aquí son tres frases y un cable.
 */
const fs = require("fs");
const path = require("path");

const FICHA = fs.readFileSync(path.join(__dirname, "PortalVoDetailPage.js"), "utf8");
const APP = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");

describe("la realidad aumentada, fuera", () => {
  test("no se pinta en la ficha", () => {
    expect(FICHA).not.toContain("<ConditionReportAr");
    expect(FICHA).not.toContain("Ver Realidad Aumentada");
  });

  test("pero el informe sigue", () => {
    // Es lo que separa nuestro anuncio de uno de Milanuncios.
    expect(FICHA).toContain("<ConditionReportDownload");
  });
});

describe("el coche que tiene ahora", () => {
  test("se mantiene la pregunta y la promesa", () => {
    expect(FICHA).toContain("¿Y el coche que tienes ahora?");
    expect(FICHA).toContain("Si buscas venderlo, te ayudamos.");
  });

  test("y lo que se le ofrece es venderlo, con su precio", () => {
    expect(FICHA).toContain("Véndelo con nosotros");
    // La cifra de la constante, no escrita a mano: el día que cambie la tarifa
    // cambia aquí sin buscarla.
    expect(FICHA).toContain("{FEE_DE_GESTION} €");
    expect(FICHA).toContain('import { FEE_DE_GESTION } from "../utils/comoSubirTuCoche"');
  });

  test("ya no se le ofrece tasar", () => {
    expect(FICHA).not.toContain("Tasar mi coche");
    expect(FICHA).not.toContain("gratis y en 30 segundos");
  });

  test("y el botón lleva a «Lo vendemos por ti»", () => {
    /*
     * Por el mismo camino que el menú de Vender, con su puerta de acceso: el
     * encargo se guarda en su portal. Sin este cable el botón caería en la
     * tasación de antes, que es a lo que se vuelve si no llega.
     */
    expect(APP).toContain('onVenderConNosotros={() => abrirVenta("certificate")}');
    expect(FICHA).toContain("onClick={onVenderConNosotros || onTasar}");
  });
});
