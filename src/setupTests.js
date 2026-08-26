// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

/**
 * jsdom no implementa `window.matchMedia`, y lo usan tanto GSAP —para su
 * `matchMedia`, que es como se separan escritorio, movil y `prefers-reduced-
 * motion`— como el propio codigo de la aplicacion. Sin esto, cualquier prueba
 * que monte un componente con animacion revienta al importarlo.
 *
 * Responde que no a todas las consultas: en pruebas eso deja el camino de
 * escritorio y con movimiento, que es el que interesa recorrer.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (consulta) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addListener: () => {},        // obsoleto, pero GSAP aun lo comprueba
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom tampoco trae estos dos, y ScrollTrigger los usa al medir.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = () => {};
}
