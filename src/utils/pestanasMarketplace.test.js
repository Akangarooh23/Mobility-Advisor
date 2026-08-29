/**
 * Cada pestaña enseña lo suyo.
 *
 * Ex-Renting estaba escrita por exclusión —«todo lo que no sea de particular»—.
 * La lista que se filtra no siempre es la que se descargó: abrir el enlace
 * directo de un coche mete ese coche en la lista, así que con abrir una ficha de
 * concesionario y volver al marketplace, ese coche aparecía en Ex-Renting.
 *
 * Es un fallo que no da error y que solo se ve si te fijas en que un coche está
 * en la sección que no le toca.
 */
import { ofertasDeLaPestana, tipoDeVendedor } from "./pestanasMarketplace";

const oferta = (id, sellerType, extra = {}) => ({ id, sellerType, ...extra });

const LISTA = [
  oferta("astara-1", "professional"),
  oferta("leasys-2", "professional"),
  oferta("user_veh-3", "particular"),
  oferta("dealer-4", "concesionario"),
  oferta("imp-5", "importador"),
];

describe("qué coches salen en cada pestaña", () => {
  test("Ex-Renting: solo flota de empresa", () => {
    const r = ofertasDeLaPestana("renting_empresa", LISTA);
    expect(r.map((o) => o.id)).toEqual(["astara-1", "leasys-2"]);
  });

  test("un coche de concesionario no se cuela en Ex-Renting", () => {
    const r = ofertasDeLaPestana("renting_empresa", LISTA);
    expect(r.some((o) => o.id === "dealer-4")).toBe(false);
  });

  test("ni uno de importación", () => {
    const r = ofertasDeLaPestana("renting_empresa", LISTA);
    expect(r.some((o) => o.id === "imp-5")).toBe(false);
  });

  test("Particulares: solo particulares", () => {
    expect(ofertasDeLaPestana("particulares", LISTA).map((o) => o.id)).toEqual(["user_veh-3"]);
  });

  test("Importación: por tipo o por la marca de importado", () => {
    const conMarca = [...LISTA, oferta("imp-6", "", { isImport: true })];
    expect(ofertasDeLaPestana("importacion", conMarca).map((o) => o.id)).toEqual(["imp-5", "imp-6"]);
  });

  test("una pestaña que no conocemos no esconde nada", () => {
    expect(ofertasDeLaPestana("otra", LISTA)).toHaveLength(LISTA.length);
  });

  test("sin lista no revienta", () => {
    expect(ofertasDeLaPestana("renting_empresa")).toEqual([]);
    expect(ofertasDeLaPestana("renting_empresa", null)).toEqual([]);
  });

  test("el tipo se lee aunque venga con mayúsculas o espacios", () => {
    expect(tipoDeVendedor({ sellerType: "  Professional " })).toBe("professional");
    expect(tipoDeVendedor({})).toBe("");
    expect(ofertasDeLaPestana("renting_empresa", [oferta("x", " PROFESSIONAL ")])).toHaveLength(1);
  });
});
