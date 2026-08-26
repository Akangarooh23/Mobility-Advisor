// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

/**
 * i18next se inicializa en src/index.js, que es el arranque de la aplicacion.
 * Las pruebas montan <App /> directamente y no pasan por ahi, asi que i18next
 * se quedaba sin instancia y cualquier cosa que llamara a changeLanguage() o a
 * t() reventaba con un error que no menciona i18n por ninguna parte.
 *
 * Eran dieciocho pruebas en rojo por un import que faltaba, no por codigo roto.
 */
import './i18n';

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
