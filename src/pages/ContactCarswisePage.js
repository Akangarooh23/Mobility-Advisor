import { useMemo, useState } from "react";
import "./ContactCarswisePage.css";

const TOPICS = [
  { key: "compra", emoji: "🔍", label: "Compra de coche" },
  { key: "gestion", emoji: "⚙️", label: "Gestion de vehiculo" },
  { key: "venta", emoji: "💰", label: "Venta de coche" },
  { key: "otro", emoji: "💡", label: "Otro tema" },
];

const CHAT_SUGGESTIONS = [
  "Que coche me recomiendas?",
  "Cuando debo cambiar el coche?",
  "Como vendo mejor mi coche?",
  "Electrico o hibrido?",
];

const FAQ_ITEMS = [
  {
    q: "CarsWise cobra por el asesoramiento?",
    a: "La primera consulta es gratuita. Para servicios avanzados de compra, gestion o venta existe un modelo de honorarios transparente que te explicamos sin compromiso.",
  },
  {
    q: "En que zonas operais?",
    a: "Operamos en todo el territorio espanol. El asesoramiento financiero y de modelo es 100% digital.",
  },
  {
    q: "Cuanto tarda una respuesta?",
    a: "Respondemos en un maximo de 24 horas en dias laborables. Lo recibido en viernes tarde se gestiona el lunes.",
  },
];

function buildBotReply(text) {
  const normalized = String(text || "").toLowerCase();

  if (normalized.includes("electrico") || normalized.includes("hibr")) {
    return "Si haces muchos km urbanos y puedes cargar en casa, electrico. Si haces viajes largos frecuentes y quieres flexibilidad, hibrido o gasolina eficiente. Si quieres, te ayudo a decidir con tu uso mensual.";
  }

  if (normalized.includes("vender") || normalized.includes("venta")) {
    return "Para vender mejor, define precio objetivo por mercado real, prepara historial de mantenimiento y publica con fotos consistentes. En CarsWise te ayudamos a fijar precio y estrategia de salida.";
  }

  if (normalized.includes("recom") || normalized.includes("coche")) {
    return "Te recomiendo elegir por coste total, no solo por cuota inicial. Si me dices presupuesto, km al ano y tipo de uso, te doy una recomendacion concreta en 2-3 opciones.";
  }

  return "Perfecto. Para darte una respuesta precisa necesito tu presupuesto mensual aproximado, kilometros al ano y si priorizas compra, gestion o venta.";
}

export default function ContactCarswisePage() {
  const [mode, setMode] = useState("form");
  const [topic, setTopic] = useState("compra");
  const [submitted, setSubmitted] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(-1);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "bot",
      text: "Hola, soy el asistente de CarsWise. Te ayudo a decidir mejor sobre compra, gestion o venta de coche. En que te ayudo?",
    },
  ]);

  const hideSuggestions = chatMessages.length > 1;

  const activeTopic = useMemo(() => TOPICS.find((item) => item.key === topic), [topic]);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  function sendMessage(rawText) {
    const value = String(rawText || chatInput).trim();
    if (!value) {
      return;
    }

    setChatMessages((prev) => [
      ...prev,
      { role: "user", text: value },
      { role: "bot", text: buildBotReply(value) },
    ]);
    setChatInput("");
  }

  return (
    <div className="cw-contact-page">
      <div className="cw-contact-blob cw-contact-blob-1" aria-hidden="true" />
      <div className="cw-contact-blob cw-contact-blob-2" aria-hidden="true" />
      <div className="cw-contact-grid" aria-hidden="true" />

      <div className="cw-contact-shell">
        <section className="cw-contact-hero">
          <div className="cw-contact-hero-left">
            <div className="cw-contact-eyebrow">Hablemos</div>
            <h1 className="cw-contact-title">
              Cuentanos en que <span className="cw-contact-title-accent">podemos</span> ayudarte
            </h1>
            <p className="cw-contact-subtitle">
              Ya sea que quieras comprar, gestionar o vender tu coche, estamos aqui para orientarte con criterio real.
            </p>

            <div className="cw-contact-info">
              <a href="mailto:hola@carswise.es" className="cw-contact-info-card">
                <div className="cw-contact-info-icon is-blue">✉️</div>
                <div>
                  <div className="cw-contact-info-label">Email</div>
                  <div className="cw-contact-info-value">hola@carswise.es</div>
                </div>
              </a>
              <a href="https://wa.me/34600000000" target="_blank" rel="noreferrer" className="cw-contact-info-card">
                <div className="cw-contact-info-icon is-teal">💬</div>
                <div>
                  <div className="cw-contact-info-label">WhatsApp</div>
                  <div className="cw-contact-info-value">+34 600 000 000</div>
                </div>
              </a>
              <div className="cw-contact-info-card">
                <div className="cw-contact-info-icon is-amber">🕐</div>
                <div>
                  <div className="cw-contact-info-label">Horario de respuesta</div>
                  <div className="cw-contact-info-value">Lun - Vie, 9:00 - 18:00</div>
                </div>
              </div>
            </div>
          </div>

          <div className="cw-contact-hero-right">
            <div className="cw-contact-form-card">
              {!submitted ? (
                <>
                  <div className="cw-contact-mode-tabs">
                    <button
                      type="button"
                      className={`cw-contact-mode-tab ${mode === "form" ? "is-active" : ""}`}
                      onClick={() => setMode("form")}
                    >
                      EscrIbenos
                    </button>
                    <button
                      type="button"
                      className={`cw-contact-mode-tab ${mode === "chat" ? "is-active" : ""}`}
                      onClick={() => setMode("chat")}
                    >
                      Chatbot IA
                    </button>
                  </div>

                  {mode === "form" ? (
                    <div>
                      <h2 className="cw-contact-form-title">Escribenos</h2>
                      <p className="cw-contact-form-subtitle">Respuesta en menos de 24 horas en dias laborables.</p>

                      <div className="cw-contact-topic-grid">
                        {TOPICS.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            className={`cw-contact-topic-btn ${topic === item.key ? "is-active" : ""}`}
                            onClick={() => setTopic(item.key)}
                          >
                            <span>{item.emoji}</span>
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleSubmit}>
                        <div className="cw-contact-row">
                          <label className="cw-contact-field">
                            <span>Nombre</span>
                            <input type="text" required placeholder="Tu nombre" />
                          </label>
                          <label className="cw-contact-field">
                            <span>Apellido</span>
                            <input type="text" placeholder="Tu apellido" />
                          </label>
                        </div>
                        <label className="cw-contact-field">
                          <span>Email</span>
                          <input type="email" required placeholder="tu@email.com" />
                        </label>
                        <label className="cw-contact-field">
                          <span>Telefono</span>
                          <input type="tel" placeholder="+34 600 000 000" />
                        </label>
                        <label className="cw-contact-field">
                          <span>Mensaje</span>
                          <textarea
                            required
                            placeholder="Cuentanos tu situacion, el tipo de coche que buscas o cualquier pregunta..."
                            rows={4}
                          />
                        </label>
                        <div className="cw-contact-topic-hint">Tema seleccionado: {activeTopic?.label || "Otro"}</div>
                        <button type="submit" className="cw-contact-submit-btn">
                          Enviar mensaje
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div>
                      <h2 className="cw-contact-form-title">Asistente CarsWise IA</h2>
                      <p className="cw-contact-form-subtitle">Preguntame sobre compra, gestion o venta de tu coche.</p>

                      {!hideSuggestions ? (
                        <div className="cw-contact-chip-row">
                          {CHAT_SUGGESTIONS.map((item) => (
                            <button
                              key={item}
                              type="button"
                              className="cw-contact-chip"
                              onClick={() => sendMessage(item)}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="cw-contact-chat-window">
                        {chatMessages.map((msg, index) => (
                          <div key={`${msg.role}-${index}`} className={`cw-contact-chat-msg is-${msg.role}`}>
                            <div className="cw-contact-chat-bubble">{msg.text}</div>
                          </div>
                        ))}
                      </div>

                      <div className="cw-contact-chat-input-row">
                        <textarea
                          className="cw-contact-chat-input"
                          rows={2}
                          value={chatInput}
                          onChange={(event) => setChatInput(event.target.value)}
                          placeholder="Escribe tu pregunta..."
                        />
                        <button type="button" className="cw-contact-chat-send" onClick={() => sendMessage()}>
                          Enviar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="cw-contact-success">
                  <div className="cw-contact-success-icon">✓</div>
                  <h2 className="cw-contact-form-title">Mensaje enviado</h2>
                  <p className="cw-contact-form-subtitle">
                    Gracias por contactar con CarsWise. Te responderemos en menos de 24 horas.
                  </p>
                  <button type="button" className="cw-contact-submit-btn" onClick={() => setSubmitted(false)}>
                    Enviar otro mensaje
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="cw-contact-bottom">
          <article>
            <div className="cw-contact-bottom-label">Preguntas frecuentes</div>
            <div className="cw-contact-faq-list">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <button
                    key={item.q}
                    type="button"
                    className={`cw-contact-faq-item ${isOpen ? "is-open" : ""}`}
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                  >
                    <div className="cw-contact-faq-q">{item.q}</div>
                    {isOpen ? <div className="cw-contact-faq-a">{item.a}</div> : null}
                  </button>
                );
              })}
            </div>
          </article>

          <article>
            <div className="cw-contact-bottom-label">Nuestro compromiso</div>
            <div className="cw-contact-promise-list">
              <div className="cw-contact-promise-item">
                <div className="cw-contact-promise-icon is-blue">⚡</div>
                <div>
                  <div className="cw-contact-promise-title">Respuesta en menos de 24h</div>
                  <div className="cw-contact-promise-text">Sin formularios genericos. Una persona real te contestara.</div>
                </div>
              </div>
              <div className="cw-contact-promise-item">
                <div className="cw-contact-promise-icon is-teal">🎯</div>
                <div>
                  <div className="cw-contact-promise-title">Sin rodeos</div>
                  <div className="cw-contact-promise-text">Te daremos criterio directo, no marketing vacio.</div>
                </div>
              </div>
              <div className="cw-contact-promise-item">
                <div className="cw-contact-promise-icon is-amber">🔒</div>
                <div>
                  <div className="cw-contact-promise-title">Tus datos seguros</div>
                  <div className="cw-contact-promise-text">Cumplimos RGPD. No vendemos ni cedemos informacion.</div>
                </div>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
