import React, { useState } from "react";
import "./EmpresasPage.css";

/**
 * Empresas — la entrada para flotas.
 *
 * Hasta ahora «Empresas» de la barra llevaba a la página de contacto general,
 * que es la de un particular con una duda. Una empresa con cien coches no
 * quiere ese formulario: quiere saber qué se hace con una flota y con quién
 * habla. Esta pantalla dice las dos cosas.
 *
 * El formulario no envía nada todavía, porque no hay un destino para las
 * peticiones de flota. Se queda en un acuse por pantalla y con el aviso puesto,
 * en vez de fingir un envío que se pierde.
 */

const TEXTOS = {
  es: {
    volver: "← Volver",
    eyebrow: "EMPRESAS",
    titulo: "Tu flota, con el estado de cada coche documentado",
    entrada:
      "Trabajamos con concesionarios, rentadoras, empresas con flota propia y gestores de renting. " +
      "El mismo informe que hacemos coche a coche, aplicado a cientos de vehículos a la vez.",
    serviciosTitulo: "Qué hacemos con una flota",
    servicios: [
      ["Tasación de flotas",
        "Valoramos el parque completo con precios de mercado reales, no de tabla. Sirve para cerrar un ejercicio, negociar una renovación o decidir qué se vende y qué se queda."],
      ["Gestión de venta de flotas",
        "Nos ocupamos de la salida de los vehículos: documentación, publicación con su informe de estado, negociación y traspaso. Se cobra por unidad vendida."],
      ["Gestión de mantenimiento de flotas",
        "Revisiones, ITV, kilometrajes y avisos centralizados. Cada coche con su historial y su próxima cita, sin perseguir a nadie."],
      ["Gestión de seguros de flotas",
        "Comparamos y renovamos las pólizas del parque en bloque, con el estado real de cada vehículo por delante."],
    ],
    comoTitulo: "Cómo empezamos",
    pasos: [
      ["Nos cuentas la flota", "Cuántos vehículos, de qué tipo y qué necesitas resolver."],
      ["Te damos una propuesta", "Con alcance, plazos y precio por unidad. Sin compromiso."],
      ["Documentamos el parque", "Captura guiada vehículo a vehículo, con su informe de estado."],
      ["Gestionamos lo que toque", "Venta, mantenimiento o seguros, según lo acordado."],
    ],
    formTitulo: "Hablemos de tu flota",
    formTexto: "Déjanos los datos y te contestamos en un día laborable.",
    empresa: "Empresa",
    persona: "Nombre y apellidos",
    correo: "Correo electrónico",
    telefono: "Teléfono",
    tamano: "Tamaño de la flota",
    tamanos: ["Menos de 25 vehículos", "Entre 25 y 100", "Entre 100 y 500", "Más de 500"],
    interes: "Qué te interesa",
    mensaje: "Cuéntanos brevemente",
    enviar: "Enviar",
    enviado: "Recibido. Te contestamos en un día laborable.",
    aviso:
      "Este formulario todavía no está conectado: el envío no llega a ningún sitio. " +
      "Mientras tanto, escríbenos a hola@carswiseai.com y lo vemos.",
  },
  en: {
    volver: "← Back",
    eyebrow: "BUSINESS",
    titulo: "Your fleet, with every car's condition documented",
    entrada:
      "We work with dealers, rental companies, businesses running their own fleet and leasing managers. " +
      "The same report we produce car by car, applied to hundreds of vehicles at once.",
    serviciosTitulo: "What we do with a fleet",
    servicios: [
      ["Fleet valuation",
        "We value the whole fleet at real market prices, not book values. Useful to close a financial year, negotiate a renewal or decide what to sell and what to keep."],
      ["Fleet sale management",
        "We handle the vehicles on their way out: paperwork, listing with their condition report, negotiation and transfer of ownership. Charged per unit sold."],
      ["Fleet servicing management",
        "Services, MOT, mileage and reminders in one place. Every car with its history and its next appointment."],
      ["Fleet insurance management",
        "We compare and renew the fleet's policies as a block, with each vehicle's real condition up front."],
    ],
    comoTitulo: "How we start",
    pasos: [
      ["Tell us about the fleet", "How many vehicles, what kind, and what you need to solve."],
      ["We send you a proposal", "Scope, timings and price per unit. No commitment."],
      ["We document the fleet", "Guided capture vehicle by vehicle, with its condition report."],
      ["We manage what's agreed", "Sale, servicing or insurance, as arranged."],
    ],
    formTitulo: "Let's talk about your fleet",
    formTexto: "Leave us your details and we'll reply within one working day.",
    empresa: "Company",
    persona: "Full name",
    correo: "Email",
    telefono: "Phone",
    tamano: "Fleet size",
    tamanos: ["Fewer than 25 vehicles", "25 to 100", "100 to 500", "More than 500"],
    interes: "What you're interested in",
    mensaje: "Tell us briefly",
    enviar: "Send",
    enviado: "Received. We'll reply within one working day.",
    aviso:
      "This form is not connected yet: submissions do not reach anyone. " +
      "In the meantime, write to hola@carswiseai.com and we'll take it from there.",
  },
};

const Ico = ({ d }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const ICONOS = [
  <Ico d={<><path d="M4 19.5h16" /><path d="M6.5 19.5V9l5.5-4.5L17.5 9v10.5" /><path d="M10 19.5v-4h4v4" /></>} />,
  <Ico d={<><path d="M3 7.5h13l1.6 4.2H21v5.3h-2" /><circle cx="7.2" cy="17" r="2.1" /><circle cx="16.4" cy="17" r="2.1" /><path d="M9.3 17h5" /><path d="M3 7.5V17h2.1" /></>} />,
  <Ico d={<><path d="M14.5 5.5a3.2 3.2 0 0 0 4.4 4.4l-8.4 8.4a2.2 2.2 0 0 1-3.1-3.1z" /><path d="M5 5l2.6 2.6" /></>} />,
  <Ico d={<><path d="M12 2.5 19.5 5.6v5.7c0 4.8-3.2 8.6-7.5 9.7-4.3-1.1-7.5-4.9-7.5-9.7V5.6z" /><path d="M9 11.8l2.2 2.2 4-4.2" /></>} />,
];

export default function EmpresasPage({ onGoHome, uiLanguage = "es" }) {
  const t = uiLanguage === "en" ? TEXTOS.en : TEXTOS.es;
  const [enviado, setEnviado] = useState(false);

  return (
    <div className="emp-root">
      <div className="emp-ancho">
        <button type="button" className="emp-volver" onClick={onGoHome}>{t.volver}</button>

        <p className="emp-eyebrow">{t.eyebrow}</p>
        <h1 className="emp-titulo">{t.titulo}</h1>
        <p className="emp-entrada">{t.entrada}</p>

        <h2 className="emp-h2">{t.serviciosTitulo}</h2>
        <div className="emp-servicios">
          {t.servicios.map(([titulo, texto], i) => (
            <article key={titulo} className="emp-servicio">
              <span className="emp-ico">{ICONOS[i]}</span>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </article>
          ))}
        </div>

        <h2 className="emp-h2">{t.comoTitulo}</h2>
        <ol className="emp-pasos">
          {t.pasos.map(([titulo, texto], i) => (
            <li key={titulo}>
              <span className="emp-num">{i + 1}</span>
              <div><b>{titulo}</b><span>{texto}</span></div>
            </li>
          ))}
        </ol>

        <section className="emp-form">
          <div className="emp-form-texto">
            <h2>{t.formTitulo}</h2>
            <p>{t.formTexto}</p>
            <p className="emp-aviso">{t.aviso}</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setEnviado(true); }}>
            <label>{t.empresa}<input type="text" required /></label>
            <label>{t.persona}<input type="text" required /></label>
            <label>{t.correo}<input type="email" required /></label>
            <label>{t.telefono}<input type="tel" /></label>
            <label>{t.tamano}
              <select defaultValue="">
                <option value="" disabled>—</option>
                {t.tamanos.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label>{t.interes}
              <select defaultValue="">
                <option value="" disabled>—</option>
                {t.servicios.map(([x]) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="emp-total">{t.mensaje}<textarea rows={3} /></label>
            <button type="submit" className="emp-enviar">{enviado ? t.enviado : t.enviar}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
