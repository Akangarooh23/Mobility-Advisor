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
 * Va por transferencia. Stripe le da un número de cuenta suyo y nos avisa cuando
 * el dinero llega: eso es lo que aporta, enterarnos solos en vez de mirar el
 * banco a mano.
 *
 * Y el número de cuenta **no se escribe en el código de la web**. Lo enseña
 * Stripe en su pantalla, contra la sesión de ese cliente. Un IBAN escrito en una
 * página es la forma más fácil de que alguien haga una captura, cambie un dígito
 * y la reenvíe.
 *
 * Mientras no haya escrow de verdad —MangoPay o PayComet— ese dinero entra en la
 * cuenta de PopCar, así que **no se le dice al cliente que está retenido**: se le
 * dice lo que es verdad, que no se le paga al vendedor hasta que vemos el coche.
 */
import fs from "fs";
import path from "path";

const lee = (...p) => fs.readFileSync(path.join(__dirname, ...p), "utf8").replace(/\r\n/g, "\n");

const FICHA = lee("PortalVoDetailPage.js");
const PANEL = lee("userDashboard", "UserDashboardSolicitudes.js");

describe("ya no se cobra ninguna fianza", () => {
  test("ni en la ficha ni en el panel queda el plan viejo", () => {
    expect(FICHA).not.toContain('planId: "fianza"');
    expect(PANEL).not.toContain('planId: "fianza"');
    expect(FICHA).not.toContain("Pagar la fianza ahora");
    expect(PANEL).not.toContain("Pagar la fianza ·");
  });

  test("el panel abre la pasarela del depósito", () => {
    expect(PANEL).toContain('planId: "deposito"');
    expect(PANEL).toContain("Ver los datos para transferir");
  });
});

/**
 * Y se puede pagar sin salir de la ficha.
 *
 * Estaba solo en el panel: cerrar el modal, entrar en «Mi panel», encontrar la
 * solicitud y pulsar allí. Cuatro pasos entre alguien que acaba de decidirse y
 * el momento de pagar, que es donde se pierde la gente.
 */
describe("pagar el depósito desde la propia ficha", () => {
  test("hay botón, y dice lo que hace", () => {
    expect(FICHA).toContain("Pagar el depósito ahora");
  });

  test("abre la misma pasarela que el panel, no otra", () => {
    // Dos formas de pagar que abrieran sesiones distintas acabarían cobrando
    // dos veces. Mismo `planId` y mismo identificador de solicitud.
    expect(FICHA).toContain("postBillingCheckoutJson");
    expect(FICHA).toContain('planId: "deposito", leadId: solicitudHecha.id');
  });

  test("y el panel sigue estando, para quien lo deje para luego", () => {
    expect(FICHA).toContain("lo tienes en");
    expect(FICHA).not.toContain("Se paga desde tu panel");
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

  test("si el coche no es el que se anunció, se devuelve entero", () => {
    expect(PANEL).toContain("devolvemos entero");
  });

  test("y no se promete que esté retenido, que hoy no lo está", () => {
    // Hasta que haya escrow de verdad, ese dinero entra en la cuenta de PopCar.
    // Decir «retenido» sería prometer una garantía que el mecanismo no da.
    expect(PANEL).not.toContain("El dinero queda retenido");
    expect(PANEL).toContain("No se lo pagamos al vendedor");
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

  test("el botón lleva a Stripe, que es quien lo enseña", () => {
    // El IBAN lo pinta Stripe contra la sesión de ese cliente, no nosotros.
    expect(PANEL).toContain("postBillingCheckoutJson");
    expect(PANEL).toContain("pideDatosDeTransferencia");
  });
});

describe("los pasos que ve el cliente", () => {
  test("«Depósito retenido» deja de significar que le hemos cobrado", () => {
    // El nombre del paso sigue siendo el del ERP —cambiarlo aquí y no allí
    // dejaría al cliente y a quien le atiende hablando de cosas distintas—
    // pero lo que significa ya no es lo mismo.
    expect(PANEL).toContain("retenido. Vamos a ver el coche en Alemania");
    expect(PANEL).not.toContain("Fianza recibida y factura emitida");
  });

  test("y «Verificado y pagado» dice que se compró en su nombre", () => {
    // No lo compramos nosotros para revendérselo: lo compra él.
    expect(PANEL).toContain("en tu nombre");
  });
});

/**
 * La liquidación del impuesto, en el panel del cliente.
 *
 * Pagó una estimación, porque el impuesto no se sabe hasta que se matricula. Si
 * le vamos a pedir otros seiscientos euros, tiene que verlo escrito **antes** de
 * que se lo pidan por teléfono: una cifra que aparece en una llamada suena a que
 * se les ha olvidado algo.
 */
describe("el ajuste del impuesto, en su panel", () => {
  test("sale lo que puso y lo que ha salido", () => {
    expect(PANEL).toContain("El impuesto de matriculación, ya ajustado");
    expect(PANEL).toContain("meta.escrow_impuesto");
    expect(PANEL).toContain("meta.impuesto_real");
  });

  test("y qué pasa con la diferencia, en los dos sentidos", () => {
    expect(PANEL).toContain("Te devolvemos");
    expect(PANEL).toContain("por pagar");
    expect(PANEL).toContain("Cuadra: no hay nada que ajustar");
  });

  test("no sale hasta que se sabe el importe real", () => {
    // Un bloque diciendo «pendiente» durante seis semanas es ruido, y el dato no
    // depende de nosotros: llega cuando la gestoría matricula.
    expect(PANEL).toContain("if (meta.impuesto_real == null) return null;");
  });
});
