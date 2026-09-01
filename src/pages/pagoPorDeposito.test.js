/**
 * Cómo se paga una importación.
 *
 * Había un botón que abría Stripe y cobraba la fianza del 30 % con tarjeta. Ya
 * no hay fianza: lo que se deposita es **el coche entero más nuestro servicio**,
 * porque el coche se lo compra el cliente al concesionario alemán y ese dinero
 * tiene que estar.
 *
 * Y eso no se cobra con tarjeta, por dos razones que no son de gusto: un coche
 * de 20.000 € lleva unos 300 € de comisión, y choca con el límite de cualquier
 * tarjeta particular.
 *
 * Va por transferencia a una cuenta de depósito. Los datos de esa cuenta **no se
 * publican en la web**: un número de cuenta en una pantalla pública es la forma
 * más fácil de que alguien haga una captura, cambie un dígito y la reenvíe.
 */
import fs from "fs";
import path from "path";

const lee = (...p) => fs.readFileSync(path.join(__dirname, ...p), "utf8").replace(/\r\n/g, "\n");

const FICHA = lee("PortalVoDetailPage.js");
const PANEL = lee("userDashboard", "UserDashboardSolicitudes.js");

describe("ya no se cobra con tarjeta", () => {
  test("la ficha no abre la pasarela", () => {
    expect(FICHA).not.toContain('planId: "fianza"');
    expect(FICHA).not.toContain("postBillingCheckoutJson");
  });

  test("ni el panel del cliente", () => {
    expect(PANEL).not.toContain('planId: "fianza"');
    expect(PANEL).not.toContain("postBillingCheckoutJson");
  });

  test("y no queda el botón de pagar la fianza", () => {
    expect(FICHA).not.toContain("Pagar la fianza ahora");
    expect(PANEL).not.toContain("Pagar la fianza ·");
  });
});

describe("lo que se le dice en su lugar", () => {
  test("la cifra va a una cuenta de depósito", () => {
    expect(FICHA).toContain("a la cuenta de depósito");
    expect(PANEL).toContain("a la cuenta de depósito");
  });

  test("y se dice cuándo se suelta, que es lo que importa", () => {
    // La cifra sola asusta. Lo que la hace aceptable es que nadie la cobra
    // hasta que alguien nuestro ha visto el coche.
    expect(FICHA).toContain("ve el coche en Alemania");
    expect(PANEL).toContain("ve el coche en Alemania");
  });

  test("si el coche no es el que se anunció, vuelve entero", () => {
    expect(PANEL).toContain("vuelve entero");
  });
});

describe("el número de cuenta no se publica", () => {
  test("no hay ningún IBAN en la ficha ni en el panel", () => {
    // Un IBAN en una pantalla pública es el vector más fácil que hay: captura,
    // un dígito cambiado y reenviado. Se dan hablando con el cliente.
    const iban = /\bES\d{2}[\s-]?\d{4}/;
    expect(FICHA).not.toMatch(iban);
    expect(PANEL).not.toMatch(iban);
  });

  test("y se dice que se dan al llamar, no que falten", () => {
    expect(PANEL).toContain("no los");
    expect(PANEL).toContain("publicamos aquí");
  });
});

describe("los pasos que ve el cliente", () => {
  test("«Fianza pagada» deja de significar que le hemos cobrado", () => {
    // El nombre del paso sigue siendo el del ERP —cambiarlo aquí y no allí
    // dejaría al cliente y a quien le atiende hablando de cosas distintas—
    // pero lo que significa ya no es lo mismo.
    expect(PANEL).toContain("retenido. Vamos a ver el coche en Alemania");
    expect(PANEL).not.toContain("Fianza recibida y factura emitida");
  });

  test("y «Pedido a Alemania» dice que se compró en su nombre", () => {
    // No lo compramos nosotros para revendérselo: lo compra él.
    expect(PANEL).toContain("en tu nombre");
  });
});
