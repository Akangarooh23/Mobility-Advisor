/**
 * Una importación hace dos viajes, y el panel enseña los dos.
 *
 * De Alemania a Zaragoza, donde se matricula, y de Zaragoza a su casa, con
 * semanas de trámites en medio. En el ERP los dos se llaman igual —«En
 * transporte»— porque es el mismo tipo de cosa. Para quien espera el coche son
 * dos momentos distintos, y llamarlos igual hacía dos daños:
 *
 * - Decía «Está de camino a España» con el coche ya matriculado y entrando en
 *   la calle del cliente, justo después de mandarle un correo con lo contrario.
 * - La línea de tiempo iba **hacia atrás**: «En transporte» está antes que «En
 *   trámites», así que quien ayer vio seis de siete hoy veía cinco. En el panel
 *   de un cliente, eso se lee como que algo ha salido mal.
 *
 * Aquí no se renombra nada del ERP: se **desdobla** lo que ya estaba doblado. Y
 * lo que distingue un viaje del otro no es el estado, es si el segundo camión ya
 * ha cargado.
 */
import fs from "fs";
import path from "path";

const lee = (...p) => fs.readFileSync(path.join(__dirname, ...p), "utf8").replace(/\r\n/g, "\n");

const PANEL = lee("userDashboard", "UserDashboardSolicitudes.js");
const TIENDA = fs.readFileSync(
  path.join(__dirname, "..", "..", "lib", "billingStore.js"), "utf8"
).replace(/\r\n/g, "\n");

describe("los dos viajes son dos pasos", () => {
  test("y el segundo va después de los trámites, no antes", () => {
    // Es lo que hacía retroceder la barra.
    expect(PANEL).toContain('A_ESPANA, "En trámites", A_DOMICILIO, "Entregado",');
    expect(PANEL).toContain('const A_ESPANA = "En transporte a España"');
    expect(PANEL).toContain('const A_DOMICILIO = "En transporte a domicilio"');
  });

  test("cuál es se mira por el camión, no por el estado", () => {
    // Un camión contratado no es un coche en la carretera.
    expect(PANEL).toContain("function etapaVisible(estado, meta = {})");
    expect(PANEL).toContain("return meta.viaje_a_casa ? A_DOMICILIO : A_ESPANA;");
  });

  test("el paso que se ve manda en la barra, en el chip y en la frase", () => {
    expect(PANEL).toContain("const etapa = etapaVisible(item.status, meta);");
    expect(PANEL).toContain("const donde = IMPORTACION_PASOS.indexOf(etapa);");
    expect(PANEL).toContain('{etapa || "Pendiente"}');
    expect(PANEL).toContain("<strong>{etapa}.</strong>");
    expect(PANEL).toContain("IMPORTACION_PASOS.includes(etapa)");
  });

  test("el primero avisa de que todavía no va a su casa", () => {
    // Es la frase que le sujeta la expectativa las semanas de los trámites.
    expect(PANEL).toContain("Todavía no va a tu casa");
    expect(PANEL).toContain("Zaragoza");
  });

  test("y el segundo dice a dónde va y qué hay que hacer", () => {
    expect(PANEL).toContain("sale hacia tu dirección");
    expect(PANEL).toContain("tienes que estar para recibirlo y firmar");
    expect(PANEL).toContain("Su matrícula es la ${meta.matricula}");
    expect(PANEL).toContain("Llega el ${formatDate(meta.llegada_a_casa)}");
  });

  test("no se enseñan dos fechas distintas a la vez", () => {
    // La estimación del principio es de antes de comprar el coche. Con un día
    // dado por el transportista, dos fechas no informan: hacen dudar de las dos.
    expect(PANEL).toContain("!(etapa === A_DOMICILIO && meta.llegada_a_casa)");
  });

  test("y el último tramo se ve distinto: ya casi está", () => {
    expect(PANEL).toContain('"En transporte a domicilio": { bg: "rgba(16,185,129,0.14)"');
  });
});

describe("y la consulta se lo cuenta", () => {
  test("los tres datos, en las dos consultas que leen los leads", () => {
    // Hay dos caminos: la consulta suelta y la CTE que lo trae todo de una.
    // Tocar solo uno deja el panel diciendo una cosa u otra según por dónde
    // haya entrado, que es peor que no tocarlo.
    expect(TIENDA.match(/AS matricula,/g)).toHaveLength(2);
    expect(TIENDA.match(/AS viaje_a_casa,/g)).toHaveLength(2);
    expect(TIENDA.match(/AS llegada_a_casa/g)).toHaveLength(2);
    expect(TIENDA.match(/viaje_a_casa: Boolean\(/g)).toHaveLength(2);
  });

  test("el viaje a casa se mira por el camión, no por el estado", () => {
    expect(TIENDA).toContain("AND tr.tramo > 1");
    expect(TIENDA).toContain("AND tr.fecha_recogida IS NOT NULL) AS viaje_a_casa");
  });
});

describe("la dirección de entrega", () => {
  test("se da por puesta con la calle y algo que la sitúe", () => {
    // Pedía calle y ciudad, que es lo que valida el formulario de este panel.
    // Pero puede llegar por otro camino —la puso al pedir el coche— con calle,
    // código postal y provincia y sin ciudad: entonces la tarjeta le pedía una
    // dirección y le decía que ya no podía cambiarla, las dos cosas a la vez.
    expect(PANEL).toContain("puesta.direccion && (puesta.ciudad || puesta.provincia || puesta.cp)");
    expect(PANEL).not.toContain("Boolean(puesta.direccion && puesta.ciudad)");
  });

  test("y se escribe sin huecos cuando falta alguna parte", () => {
    expect(PANEL).toContain('{puesta.ciudad ? ` ${puesta.ciudad}` : ""}');
  });
});
