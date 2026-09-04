/**
 * Una importación pasa dos veces por «En transporte».
 *
 * De Alemania a Zaragoza, donde se matricula, y de Zaragoza a su casa. El estado
 * es el mismo las dos veces, y el panel decía «Está de camino a España» con el
 * coche ya matriculado y entrando en la calle del cliente — justo después de
 * mandarle un correo diciéndole lo contrario.
 *
 * Y la barra retrocedía: «En transporte» está antes que «En trámites» en la
 * lista de pasos, así que quien ayer vio seis de siete hoy veía cinco. En el
 * panel de un cliente, una barra que va hacia atrás se lee como que algo ha
 * salido mal.
 *
 * El estado no distingue los dos viajes. Lo distingue si el segundo camión ya ha
 * cargado, que es lo que trae `viaje_a_casa`.
 */
import fs from "fs";
import path from "path";

const lee = (...p) => fs.readFileSync(path.join(__dirname, ...p), "utf8").replace(/\r\n/g, "\n");

const PANEL = lee("userDashboard", "UserDashboardSolicitudes.js");
const TIENDA = fs.readFileSync(
  path.join(__dirname, "..", "..", "lib", "billingStore.js"), "utf8"
).replace(/\r\n/g, "\n");

describe("el panel distingue los dos viajes", () => {
  test("la frase depende del viaje, no solo del estado", () => {
    expect(PANEL).toContain("function explicaImportacion(estado, meta = {})");
    expect(PANEL).toContain("explicaImportacion(item.status, meta)");
    // Y la de siempre sigue ahí para el primer viaje.
    expect(PANEL).toContain('"En transporte":        "Está de camino a España.",');
  });

  test("en el segundo dice a dónde va y qué hay que hacer", () => {
    expect(PANEL).toContain("va de camino a tu dirección");
    expect(PANEL).toContain("tienes que estar para recibirlo y firmar");
  });

  test("y con la matrícula, que es la noticia", () => {
    expect(PANEL).toContain("con la matrícula ${meta.matricula}");
  });

  test("la barra no retrocede", () => {
    // «En transporte» está antes que «En trámites» en la lista: sin esto, el
    // segundo viaje pinta un paso menos que el día anterior.
    expect(PANEL).toContain("function pasoDeImportacion(estado, meta = {})");
    expect(PANEL).toContain('Math.max(donde, IMPORTACION_PASOS.indexOf("En trámites"))');
    expect(PANEL).toContain("const donde = pasoDeImportacion(item.status, meta);");
  });

  test("y no se enseñan dos fechas distintas a la vez", () => {
    // La estimación del principio es de antes de comprar el coche. Con un día
    // dado por el transportista, dos fechas no informan: hacen dudar de las dos.
    expect(PANEL).toContain('!(item.status === "En transporte" && meta.viaje_a_casa && meta.llegada_a_casa)');
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
    // Un tramo abierto no es un coche en la carretera. Lo que lo pone en la
    // carretera es que alguien lo haya recogido.
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
