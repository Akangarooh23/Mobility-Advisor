/**
 * Las tarjetas del marketplace son enlaces, y se comportan como tales.
 *
 * ## Lo que pasaba
 *
 * Eran `<div onClick>` sin `role`, sin `tabIndex` y sin teclas. Con el tabulador **no
 * había forma de abrir un coche desde el listado**, y un lector de pantalla las leía
 * como texto suelto. Y no es un rincón: es el camino del listado a la ficha, la acción
 * principal del producto.
 *
 * ## Qué se fija aquí
 *
 * Lo que un `role="button" tabIndex={0}` **no** habría dado y por lo que se eligió un
 * enlace de verdad: que el cliente pueda abrir en otra pestaña. Esa es la parte que se
 * rompe sola si alguien «simplifica» el manejador a un `preventDefault()` a secas, y es
 * la que no se nota hasta que alguien se queja.
 */

import { laFichaDe, abreLaFicha } from "./laFichaDeUnCoche";

describe("la dirección de una ficha", () => {
  test("es la misma que ya usa el resto de la aplicación", () => {
    // `App.js` escribe `/marketplace-vo/<id>` en la barra al abrir una ficha, y
    // `onIrAlCoche` navega a lo mismo. Aquí solo se pone donde faltaba.
    expect(laFichaDe({ id: "idcar-1" })).toBe("/marketplace-vo/idcar-1");
    expect(laFichaDe({ id: "modrive_2304734" })).toBe("/marketplace-vo/modrive_2304734");
  });

  test("y escapa lo que haga falta", () => {
    expect(laFichaDe({ id: "a b/c?d" })).toBe("/marketplace-vo/a%20b%2Fc%3Fd");
  });

  test("sin id devuelve `undefined`, que no es lo mismo que una cadena vacía", () => {
    /*
     * `<a href="">` apunta a la página actual, así que un fallo de datos se convertiría
     * en un enlace que recarga y no lleva a ninguna parte. Sin `href`, el navegador no
     * lo trata como enlace y se nota enseguida.
     */
    expect(laFichaDe({})).toBeUndefined();
    expect(laFichaDe(null)).toBeUndefined();
    expect(laFichaDe({ id: "" })).toBeUndefined();
  });
});

describe("al pulsar una tarjeta", () => {
  const evento = (extra = {}) => ({
    preventDefault: jest.fn(),
    metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, button: 0,
    ...extra,
  });

  test("navega la aplicación, como hasta ahora", () => {
    const e = evento();
    const abrir = jest.fn();
    const oferta = { id: "idcar-1" };

    abreLaFicha(e, oferta, abrir);

    expect(e.preventDefault).toHaveBeenCalled();
    expect(abrir).toHaveBeenCalledWith(oferta);
  });

  test("pero con Ctrl, Cmd, Mayúsculas, Alt o el botón central, manda el navegador", () => {
    /*
     * Ésta es la prueba que protege lo que se vino a ganar. Un `preventDefault()` a
     * secas se come el «abrir en otra pestaña», el «abrir en otra ventana» y el clic
     * central — que en un listado de coches se usan constantemente — y el enlace se
     * queda siendo un `div` con mejores modales.
     */
    for (const modificador of [
      { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 },
    ]) {
      const e = evento(modificador);
      const abrir = jest.fn();

      abreLaFicha(e, { id: "idcar-1" }, abrir);

      expect(e.preventDefault).not.toHaveBeenCalled();
      expect(abrir).not.toHaveBeenCalled();
    }
  });

  test("y no revienta si no le dan manejador", () => {
    const e = evento();
    expect(() => abreLaFicha(e, { id: "x" }, undefined)).not.toThrow();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test("ni si no le dan evento", () => {
    expect(() => abreLaFicha(null, { id: "x" }, jest.fn())).not.toThrow();
  });
});
