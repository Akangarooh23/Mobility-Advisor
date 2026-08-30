/**
 * El enlace «ver anuncio» de una solicitud.
 *
 * Se escribió porque no llevaba a la ficha del coche. Lo que se guarda en la
 * solicitud es la dirección de nuestra propia ficha, y el panel la buscaba por
 * dirección en el marketplace de ocasión —que guarda la del vendedor—, así que
 * no encontraba nada y abría una ficha vacía. Y los coches de importación están
 * en otra tabla.
 */
import { idDeAnuncioPropio, ofertaDelMarketplacePorId } from "./anuncioPropio";

describe("de qué coche habla el enlace guardado", () => {
  test("saca el id del que se guardó entero", () => {
    expect(idDeAnuncioPropio("https://www.popcar.tech/marketplace-vo/as_1")).toBe("as_1");
  });

  test("y del que se guardó a medias, que es como están los de antes", () => {
    expect(idDeAnuncioPropio("/marketplace-vo/as_1")).toBe("as_1");
  });

  test("aguanta la barra final y lo que venga detrás", () => {
    expect(idDeAnuncioPropio("/marketplace-vo/as_1/")).toBe("as_1");
    expect(idDeAnuncioPropio("/marketplace-vo/as_1?de=correo")).toBe("as_1");
  });

  test("un id con caracteres raros vuelve como se guardó", () => {
    expect(idDeAnuncioPropio("/marketplace-vo/as%2F1")).toBe("as/1");
  });

  test("el anuncio de un tercero no es una ficha nuestra", () => {
    expect(idDeAnuncioPropio("https://www.mobile.de/coche/1")).toBe("");
    expect(idDeAnuncioPropio("/marketplace-vo")).toBe("");
    expect(idDeAnuncioPropio("")).toBe("");
  });
});

describe("buscar el coche por su id", () => {
  const respuesta = (cuerpo, ok = true) => ({ ok, json: async () => cuerpo });

  test("si está en ocasión, ese", async () => {
    const pedidas = [];
    const buscar = async (u) => { pedidas.push(u); return respuesta({ offer: { id: "vo_1" } }); };
    expect(await ofertaDelMarketplacePorId("vo_1", buscar)).toEqual({ id: "vo_1" });
    expect(pedidas).toHaveLength(1);
  });

  test("si no está, se mira en importación: es otra tabla", async () => {
    const pedidas = [];
    const buscar = async (u) => {
      pedidas.push(u);
      if (u.includes("marketplace-vo")) return respuesta({ offer: null }, false);
      return respuesta({ ok: true, offer: { id: "as_1", isImport: true } });
    };
    const oferta = await ofertaDelMarketplacePorId("as_1", buscar);
    expect(oferta).toEqual({ id: "as_1", isImport: true });
    expect(pedidas.some((u) => u.includes("import-offers"))).toBe(true);
  });

  test("si no está en ninguna, no se inventa una ficha vacía", async () => {
    const buscar = async () => respuesta({ ok: false, offer: null }, false);
    expect(await ofertaDelMarketplacePorId("no_existe", buscar)).toBe(null);
  });

  test("un fallo de red no rompe el panel", async () => {
    const buscar = async () => { throw new Error("sin red"); };
    expect(await ofertaDelMarketplacePorId("as_1", buscar)).toBe(null);
  });
});

/**
 * Que el panel lo use de verdad.
 *
 * El fallo no estaba en saber buscar el coche: estaba en que el botón no lo
 * hacía. Una función correcta que nadie llama deja el enlace igual de roto.
 */
describe("el botón del panel busca por id", () => {
  const fs = require("fs");
  const path = require("path");
  const app = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");

  test("«ver anuncio» pasa por la búsqueda por id", () => {
    const trozo = app.slice(app.indexOf("onOpenVehicleDetail={async (sparseOffer)"));
    const cuerpo = trozo.slice(0, trozo.indexOf("onNavigate="));
    expect(cuerpo).toContain("idDeAnuncioPropio(targetUrl)");
    expect(cuerpo).toContain("ofertaDelMarketplacePorId(");
  });

  test("y lo hace antes de buscar por dirección, que es lo que fallaba", () => {
    const trozo = app.slice(app.indexOf("onOpenVehicleDetail={async (sparseOffer)"));
    const cuerpo = trozo.slice(0, trozo.indexOf("onNavigate="));
    expect(cuerpo.indexOf("ofertaDelMarketplacePorId(")).toBeLessThan(
      cuerpo.indexOf("route=vo&url=")
    );
  });
});
