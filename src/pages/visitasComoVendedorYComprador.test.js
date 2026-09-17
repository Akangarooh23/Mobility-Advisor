/**
 * En el panel, las visitas a tu coche y las que has pedido tú, separadas.
 *
 * Quien vende su coche con nosotros también puede estar mirando otros. Las dos
 * cosas salían mezcladas: la visita que había pedido como comprador se llamaba
 * «Visita» a secas, y la que le pedían a él —que tiene que confirmar o mover—
 * no salía en ninguna parte del panel. Parecía que lo único que podía hacer era
 * anularla, y no había por dónde contestar como vendedor.
 */
import fs from "fs";
import path from "path";

const lee = (...p) => fs.readFileSync(path.join(__dirname, ...p), "utf8").replace(/\r\n/g, "\n");

const PANEL = lee("userDashboard", "UserDashboardSolicitudes.js");
const TIENDA = fs.readFileSync(path.join(__dirname, "..", "..", "lib", "billingStore.js"), "utf8").replace(/\r\n/g, "\n");

describe("las visitas a tu coche, como vendedor", () => {
  test("el servidor las trae con el encargo, solo las suyas y las que vienen", () => {
    expect(TIENDA).toContain("visitas_a_tu_coche: visitasPorLead[s(r.id)] || null,");
    expect(TIENDA).toContain("AND lower(COALESCE(b.seller_email, '')) = $2");
    expect(TIENDA).toContain("AND b.status IN ('pending', 'confirmed')");
    expect(TIENDA).toContain("AND b.ends_at > NOW()");
  });

  test("con la llave para contestar, pero sin el correo ni el teléfono del comprador", () => {
    const trozo = TIENDA.slice(TIENDA.indexOf("const vis = await pool.query("), TIENDA.indexOf("visitasPorLead[s(r.id)] = vis.rows.map"));
    expect(trozo).not.toContain("buyer_email");
    expect(trozo).not.toContain("buyer_phone");
    expect(TIENDA).toContain("/cita-vendedor?id=");
  });

  test("salen aparte, con su nombre y el botón para contestar", () => {
    expect(PANEL).toContain("Visitas a tu coche · como vendedor");
    expect(PANEL).toContain("Te toca contestar");
    expect(PANEL).toContain("Confirmar o proponer hora →");
  });

  test("y van antes que las que ha pedido él", () => {
    expect(PANEL.indexOf("Visitas a tu coche · como vendedor")).toBeLessThan(PANEL.indexOf("como comprador"));
  });
});

describe("las que has pedido tú, como comprador", () => {
  test("se llaman así, no «Visita» a secas", () => {
    expect(PANEL).toContain('visita_marketplace: "Visita que has pedido",');
    expect(PANEL).toContain("Visita que has pedido · como comprador");
  });

  test("y no prometen que confirmamos nosotros", () => {
    // En el coche de un particular la confirma él, no nosotros.
    expect(PANEL).not.toContain("a la espera de que confirmemos el horario");
  });
});
