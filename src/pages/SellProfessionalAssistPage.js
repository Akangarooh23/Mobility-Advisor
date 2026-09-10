import { useRef } from "react";
import "./SellProfessionalAssistPage.css";
import FormularioEncargoVenta from "../components/FormularioEncargoVenta";

/**
 * «Nosotros lo vendemos por ti».
 *
 * Es la página que tiene que convencer a un particular de dejarnos su coche. Se
 * lee de arriba abajo y acaba en un formulario, así que no lleva el recorrido
 * con pin de «Cómo funciona»: allí el scroll **es** el contenido, y aquí el
 * contenido es algo que hay que poder alcanzar. Lo que sí se toma prestado es
 * su idioma: portada con manchas, pasos numerados unidos por una línea, el
 * titular a dos líneas con la segunda en amarillo.
 *
 * ## Lo que esta página dice y antes no
 *
 * **Los tres números del trato, en la portada.** Cero por delante, 299 € solo
 * si vendemos y los 30 días que nos damos. Estaban escondidos hasta que alguien
 * cogía el teléfono, y son lo mejor que hay que contar: quien duda de dejarnos
 * su coche duda por lo que le va a costar.
 *
 * **Y contados desde nuestro lado.** El plazo decía «y puedes irte», «nadie te
 * retiene». El fallo no era la palabra: era contestar una objeción que nadie
 * había hecho, y al contestarla se planta. Ese mes es lo que nos ponemos
 * nosotros para venderlo, pagando el informe, el taller y el anuncio.
 *
 * **Y quién hace cada paso.** La mitad del argumento es que de seis pasos, él
 * solo toca dos — y eso no se ve si todos los pasos se pintan igual.
 *
 * ## Lo que ya no dice
 *
 * No nombra cuatro portales. Se publica en uno, y prometer cuatro por su
 * nombre era un compromiso que no se iba a cumplir.
 *
 * No dice que el informe de estado sea opcional: es obligatorio, y es lo que
 * separa este anuncio de uno de Milanuncios.
 *
 * Y no promete garantía mecánica dentro del trato: es un producto aparte que el
 * cliente contrata o no, y no es lo que hace que el coche esté verificado.
 */

const Tic = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

const Flecha = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
);

/**
 * Los pasos, contados desde su lado.
 *
 * `quien` no es decoración: es el argumento. De los seis, el cliente toca dos
 * —tasar y subir el coche— y enseñarlo cuando llegue el comprador. Lo demás lo
 * llevamos nosotros, y eso es exactamente lo que está pagando.
 */
const PASOS = [
  {
    quien: "tú",
    titulo: "Tasamos tu coche gratis",
    texto:
      "Contestas cuatro preguntas y te decimos a cuánto se está vendiendo un coche como el tuyo. Sin coste y sin compromiso: de aquí sale el precio del que hablamos después.",
    detalles: [
      "Precio de mercado, no una cifra inventada para captarte",
      "Si no te encaja, ahí se acaba y no debes nada",
    ],
  },
  {
    quien: "tú",
    titulo: "Subes el coche a tu cuenta",
    texto:
      "Fotos, permiso de circulación, ficha técnica e ITV. Y el informe de estado, que se hace con el móvil siguiendo lo que te va pidiendo la pantalla.",
    detalles: [
      "El informe acompaña al anuncio: es lo que hace que un comprador se fíe",
      "También eliges en qué horas puedes enseñarlo, para que nadie te llame a deshora",
    ],
  },
  {
    quien: "nosotros",
    titulo: "Lo revisamos en un taller",
    texto:
      "Llevamos el coche a un taller de la red y lo revisan. Con esa revisión el anuncio deja de ser una foto bonita y pasa a ser un coche comprobado.",
    detalles: [
      "Lo pagamos nosotros, esté como esté el coche",
      "Si aparece algo, te lo contamos antes de publicar nada",
    ],
  },
  {
    quien: "nosotros",
    titulo: "Lo publicamos y damos la cara",
    texto:
      "Escribimos el anuncio, lo publicamos y el teléfono que sale es el nuestro. Las llamadas, los mensajes y los que solo quieren regatear los cogemos nosotros.",
    detalles: [
      "En nuestro marketplace y en el portal donde está tu comprador",
      "Tú no recibes ni una llamada de un desconocido",
    ],
  },
  {
    quien: "nosotros",
    titulo: "Te llevamos compradores de verdad",
    texto:
      "Filtramos quién va en serio y le damos cita en las horas que tú marcaste. Llega a verlo alguien que ya sabe el precio, ha visto el informe y viene a comprar.",
    detalles: [
      "Las citas caen en tu horario, no en el nuestro",
      "Sabes quién viene y a qué hora antes de que aparezca",
    ],
  },
  {
    quien: "nosotros",
    titulo: "Cerramos y hacemos el papeleo",
    texto:
      "Contrato de compraventa, notificación a la DGT y transferencia de titularidad. Te acompañamos hasta que el dinero está en tu cuenta.",
    detalles: [
      "El contrato lo redactamos y lo revisamos nosotros",
      "Los 299 € se cobran aquí, cuando el coche ya está vendido",
    ],
  },
];

const CIFRAS = [
  { valor: "0 €", texto: "por adelantado" },
  { valor: "299 €", texto: "solo si lo vendemos" },
  { valor: "30 días", texto: "es lo que nos damos" },
];

const TRATO = [
  {
    valor: "0 €",
    titulo: "No adelantas nada",
    texto:
      "Ni por tasarlo, ni por el informe, ni por la revisión del taller, ni por los anuncios. Todo eso lo ponemos nosotros antes de cobrar un euro.",
  },
  {
    valor: "299 €",
    titulo: "Solo si se vende",
    texto:
      "Es lo único que se te factura, y se factura cuando el coche ya está vendido y el dinero es tuyo. Si no lo vendemos, no pagas.",
  },
  /*
   * Esta tarjeta decía «Y eres libre… nadie te retiene», y sonaba a cárcel.
   *
   * El fallo no era la palabra: era contestar una objeción que nadie había
   * hecho. Al negar que le retengamos, se planta la idea de que podríamos —y
   * quien lo lee deduce que durante ese mes está atrapado.
   *
   * Y es justo al revés: ese plazo nos lo ponemos nosotros. Es lo que nos damos
   * para vender su coche pagando nosotros el informe, el taller y el anuncio.
   */
  {
    valor: "30 días",
    titulo: "Nos damos un mes",
    texto:
      "Es el tiempo que nos ponemos para vender tu coche. Si aceptas nuestro precio y pasa el mes sin venderlo, decides tú: seguimos o lo dejas sin pagar nada.",
  },
];

export default function SellProfessionalAssistPage({ onGoBack, onGoHome }) {
  const formulario = useRef(null);

  const alFormulario = () => {
    formulario.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="vpt-root">
      <button className="vpt-volver" type="button" onClick={onGoBack}>
        <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Volver
      </button>

      {/* ── Portada ────────────────────────────────────────────────────── */}
      <section className="vpt-hero">
        <div className="vpt-manchas" aria-hidden="true">
          <span className="vpt-mancha vpt-mancha-1" />
          <span className="vpt-mancha vpt-mancha-2" />
          <span className="vpt-mancha vpt-mancha-3" />
        </div>

        <div className="vpt-hero-texto">
          <p className="vpt-eyebrow">Vender</p>
          <h1>
            Nosotros lo<br /><span>vendemos por ti.</span>
          </h1>
          <p className="vpt-hero-apoyo">
            Tú conservas el coche y solo tienes que enseñarlo cuando venga el comprador.
            Del precio, el anuncio, las llamadas, las citas y el papeleo nos encargamos
            nosotros.
          </p>

          {/*
            * Los tres números, aquí y no en la llamada. Quien duda de dejarnos
            * su coche duda por lo que le va a costar, y esconderlo hasta el
            * teléfono convierte la conversación en una sorpresa.
            */}
          <div className="vpt-cifras">
            {CIFRAS.map((c) => (
              <span className="vpt-cifra" key={c.valor}>
                <b>{c.valor}</b>
                <span>{c.texto}</span>
              </span>
            ))}
          </div>

          <button className="vpt-cta" type="button" onClick={alFormulario}>
            Quiero vender mi coche
            <Flecha />
          </button>
        </div>
      </section>

      {/* ── Los pasos ──────────────────────────────────────────────────── */}
      <section className="vpt-pasos">
        <div className="vpt-pasos-cab">
          <p className="vpt-eyebrow">Cómo va</p>
          <h2>
            Seis pasos. <span>Tú haces dos.</span>
          </h2>
        </div>

        <div className="vpt-lista">
          {PASOS.map((p, i) => (
            <article className="vpt-paso" key={p.titulo}>
              <div className="vpt-num">{String(i + 1).padStart(2, "0")}</div>
              <div className="vpt-paso-cuerpo">
                <span className={`vpt-quien ${p.quien === "tú" ? "vpt-quien-tu" : "vpt-quien-nosotros"}`}>
                  {p.quien === "tú" ? "Lo haces tú" : "Lo hacemos nosotros"}
                </span>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
                <ul className="vpt-detalles">
                  {p.detalles.map((d) => (
                    <li key={d}><Tic />{d}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── El trato ───────────────────────────────────────────────────── */}
      <section className="vpt-trato">
        <div className="vpt-trato-inner">
          <p className="vpt-eyebrow">El trato</p>
          <h2>
            Cobramos <span>solo si vendemos.</span>
          </h2>
          <p className="vpt-trato-apoyo">
            El informe, la revisión del taller y los anuncios los pagamos nosotros por
            delante. Si el coche no se vende, ese gasto es nuestro.
          </p>

          <div className="vpt-tarjetas">
            {TRATO.map((t) => (
              <div className="vpt-tarjeta" key={t.valor}>
                <b>{t.valor}</b>
                <strong>{t.titulo}</strong>
                <small>{t.texto}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── El formulario ──────────────────────────────────────────────── */}
      <section className="vpt-form" ref={formulario}>
        <div className="vpt-form-inner">
          <p className="vpt-eyebrow">Empieza hoy</p>
          <h2>Cuéntanos qué coche tienes</h2>
          <p className="vpt-form-apoyo">
            Dos preguntas y tus datos. Te llamamos en menos de 24 horas laborables para
            decirte a qué precio se está vendiendo y cómo lo haríamos.
          </p>

          <FormularioEncargoVenta />

          <button className="vpt-volver-inicio" type="button" onClick={onGoHome}>
            Volver al inicio
          </button>
        </div>
      </section>
    </div>
  );
}
