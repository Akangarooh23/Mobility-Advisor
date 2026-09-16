import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';   // antes que nada: define los colores y la fuente que usa el resto
import './styles/fuentes.css';  // y aquí se carga esa fuente
import './index.css';
import './i18n';
import App from './App';
import reportWebVitals from './reportWebVitals';

/*
 * Aquí había un borrado de todo lo guardado en el navegador.
 *
 * Nueve líneas, puestas el 4 de mayo dentro de un commit de traducciones, con
 * su `console.log` y el comentario «clean up old localStorage entries». En cada
 * carga de página, antes de pintar nada, se borraba **toda** clave que
 * empezara por `movilidad-advisor`. Entre ellas la que dice quién ha entrado.
 *
 * Lo que se veía por fuera: abres cualquier página de la cuenta y te pide la
 * contraseña otra vez, aunque la sesión del servidor siguiera abierta y aunque
 * acabaras de entrar hace diez minutos. La cookie estaba intacta —por eso, al
 * volver a entrar, el servidor borraba la sesión anterior: el navegador se la
 * seguía mandando—; lo que faltaba era la nota de este lado.
 *
 * De paso se llevaba por delante la copia de tasaciones, solicitudes y citas,
 * que es lo que enseña el panel mientras llegan los datos de verdad.
 *
 * No se sustituye por nada. Si algún día hay que tirar claves viejas, se tiran
 * por su nombre y una vez, no todas y en cada carga.
 */

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
