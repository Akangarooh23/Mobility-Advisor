import { useMemo, useState } from "react";
import "./ContactCarswisePage.css";

function getContactContent(language) {
  if (language === "en") {
    return {
      topics: [
        { key: "compra", emoji: "🔍", label: "Car purchase" },
        { key: "gestion", emoji: "⚙️", label: "Vehicle management" },
        { key: "venta", emoji: "💰", label: "Car sale" },
        { key: "otro", emoji: "💡", label: "Other topic" },
      ],
      chatSuggestions: [
        "Which car do you recommend?",
        "When should I change my car?",
        "How can I sell my car better?",
        "Electric or hybrid?",
      ],
      faqItems: [
        {
          q: "Does CarsWise charge for advice?",
          a: "The first consultation is free. For advanced buying, management or selling services, we use a transparent fee model that we explain with no commitment.",
        },
        {
          q: "Which areas do you operate in?",
          a: "We operate across Spain. Financial and model advisory is 100% digital.",
        },
        {
          q: "How long does a response take?",
          a: "We reply within a maximum of 24 hours on business days. Messages received Friday afternoon are handled on Monday.",
        },
      ],
      botWelcome:
        "Hi, I am the CarsWise assistant. I help you make better decisions about buying, managing or selling your car. How can I help?",
      eyebrow: "Let's talk",
      heroTitlePrefix: "Tell us how we can",
      heroTitleAccent: "help",
      heroSubtitle: "Whether you want to buy, manage or sell your car, we are here to guide you with real criteria.",
      responseHours: "Response hours",
      responseSchedule: "Mon - Fri, 9:00 - 18:00",
      tabWrite: "Write to us",
      tabChat: "AI Chatbot",
      formTitle: "Write to us",
      formSubtitle: "Response in less than 24 hours on business days.",
      firstName: "First name",
      firstNamePlaceholder: "Your first name",
      lastName: "Last name",
      lastNamePlaceholder: "Your last name",
      phone: "Phone",
      message: "Message",
      messagePlaceholder: "Tell us your situation, the type of car you are looking for, or any question...",
      selectedTopic: "Selected topic",
      other: "Other",
      sendMessage: "Send message",
      aiAssistantTitle: "CarsWise AI assistant",
      aiAssistantSubtitle: "Ask me about buying, managing or selling your car.",
      questionPlaceholder: "Write your question...",
      send: "Send",
      sentTitle: "Message sent",
      sentSubtitle: "Thanks for contacting CarsWise. We will reply in less than 24 hours.",
      sendAnother: "Send another message",
      faqTitle: "Frequently asked questions",
      commitmentTitle: "Our commitment",
      promiseResponseTitle: "Reply in less than 24h",
      promiseResponseText: "No generic forms. A real person will answer you.",
      promiseDirectTitle: "No fluff",
      promiseDirectText: "We give direct criteria, not empty marketing.",
      promiseDataTitle: "Your data is safe",
      promiseDataText: "GDPR compliant. We do not sell or share your information.",
    };
  }

  return {
    topics: [
      { key: "compra", emoji: "🔍", label: "Compra de coche" },
      { key: "gestion", emoji: "⚙️", label: "Gestion de vehiculo" },
      { key: "venta", emoji: "💰", label: "Venta de coche" },
      { key: "otro", emoji: "💡", label: "Otro tema" },
    ],
    chatSuggestions: [
      "Que coche me recomiendas?",
      "Cuando debo cambiar el coche?",
      "Como vendo mejor mi coche?",
      "Electrico o hibrido?",
    ],
    faqItems: [
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
    ],
    botWelcome:
      "Hola, soy el asistente de CarsWise. Te ayudo a decidir mejor sobre compra, gestion o venta de coche. En que te ayudo?",
    eyebrow: "Hablemos",
    heroTitlePrefix: "Cuentanos en que",
    heroTitleAccent: "podemos",
    heroSubtitle: "Ya sea que quieras comprar, gestionar o vender tu coche, estamos aqui para orientarte con criterio real.",
    responseHours: "Horario de respuesta",
    responseSchedule: "Lun - Vie, 9:00 - 18:00",
    tabWrite: "Escribenos",
    tabChat: "Chatbot IA",
    formTitle: "Escribenos",
    formSubtitle: "Respuesta en menos de 24 horas en dias laborables.",
    firstName: "Nombre",
    firstNamePlaceholder: "Tu nombre",
    lastName: "Apellido",
    lastNamePlaceholder: "Tu apellido",
    phone: "Telefono",
    message: "Mensaje",
    messagePlaceholder: "Cuentanos tu situacion, el tipo de coche que buscas o cualquier pregunta...",
    selectedTopic: "Tema seleccionado",
    other: "Otro",
    sendMessage: "Enviar mensaje",
    aiAssistantTitle: "Asistente CarsWise IA",
    aiAssistantSubtitle: "Preguntame sobre compra, gestion o venta de tu coche.",
    questionPlaceholder: "Escribe tu pregunta...",
    send: "Enviar",
    sentTitle: "Mensaje enviado",
    sentSubtitle: "Gracias por contactar con CarsWise. Te responderemos en menos de 24 horas.",
    sendAnother: "Enviar otro mensaje",
    faqTitle: "Preguntas frecuentes",
    commitmentTitle: "Nuestro compromiso",
    promiseResponseTitle: "Respuesta en menos de 24h",
    promiseResponseText: "Sin formularios genericos. Una persona real te contestara.",
    promiseDirectTitle: "Sin rodeos",
    promiseDirectText: "Te daremos criterio directo, no marketing vacio.",
    promiseDataTitle: "Tus datos seguros",
    promiseDataText: "Cumplimos RGPD. No vendemos ni cedemos informacion.",
  };
}

function buildBotReply(text, language = "es") {
  const normalized = String(text || "").toLowerCase();

  if (language === "en") {
    if (normalized.includes("electric") || normalized.includes("hybrid")) {
      return "If you drive many urban km and can charge at home, electric. If you do frequent long trips and want flexibility, hybrid or efficient petrol. If you want, I can help you decide with your monthly usage.";
    }

    if (normalized.includes("sell") || normalized.includes("sale")) {
      return "To sell better, define a target price based on the real market, prepare maintenance history, and publish with consistent photos. At CarsWise we help you set pricing and exit strategy.";
    }

    if (normalized.includes("recommend") || normalized.includes("car")) {
      return "I recommend choosing by total cost, not only by initial payment. If you share budget, yearly km and usage type, I will give you a concrete recommendation in 2-3 options.";
    }

    return "Perfect. To give you a precise answer I need your approximate monthly budget, yearly kilometers, and whether you prioritize buying, management or selling.";
  }

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

export default function ContactCarswisePage({ uiLanguage = "es" }) {
  const language = String(uiLanguage || "").toLowerCase() === "en" ? "en" : "es";
  const content = useMemo(() => getContactContent(language), [language]);
  const [mode, setMode] = useState("form");
  const [topic, setTopic] = useState("compra");
  const [submitted, setSubmitted] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(-1);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "bot",
      text: content.botWelcome,
    },
  ]);

  const hideSuggestions = chatMessages.length > 1;

  const activeTopic = useMemo(() => content.topics.find((item) => item.key === topic), [content.topics, topic]);

  function resetWithCurrentLanguage() {
    setMode("form");
    setTopic("compra");
    setSubmitted(false);
    setOpenFaqIndex(-1);
    setChatInput("");
    setChatMessages([{ role: "bot", text: content.botWelcome }]);
  }

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
      { role: "bot", text: buildBotReply(value, language) },
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
            <div className="cw-contact-eyebrow">{content.eyebrow}</div>
            <h1 className="cw-contact-title">
              {content.heroTitlePrefix} <span className="cw-contact-title-accent">{content.heroTitleAccent}</span> ayudarte
            </h1>
            <p className="cw-contact-subtitle">
              {content.heroSubtitle}
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
                  <div className="cw-contact-info-label">{content.responseHours}</div>
                  <div className="cw-contact-info-value">{content.responseSchedule}</div>
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
                      {content.tabWrite}
                    </button>
                    <button
                      type="button"
                      className={`cw-contact-mode-tab ${mode === "chat" ? "is-active" : ""}`}
                      onClick={() => setMode("chat")}
                    >
                      {content.tabChat}
                    </button>
                  </div>

                  {mode === "form" ? (
                    <div>
                      <h2 className="cw-contact-form-title">{content.formTitle}</h2>
                      <p className="cw-contact-form-subtitle">{content.formSubtitle}</p>

                      <div className="cw-contact-topic-grid">
                        {content.topics.map((item) => (
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
                            <span>{content.firstName}</span>
                            <input type="text" required placeholder={content.firstNamePlaceholder} />
                          </label>
                          <label className="cw-contact-field">
                            <span>{content.lastName}</span>
                            <input type="text" placeholder={content.lastNamePlaceholder} />
                          </label>
                        </div>
                        <label className="cw-contact-field">
                          <span>Email</span>
                          <input type="email" required placeholder="tu@email.com" />
                        </label>
                        <label className="cw-contact-field">
                          <span>{content.phone}</span>
                          <input type="tel" placeholder="+34 600 000 000" />
                        </label>
                        <label className="cw-contact-field">
                          <span>{content.message}</span>
                          <textarea
                            required
                            placeholder={content.messagePlaceholder}
                            rows={4}
                          />
                        </label>
                        <div className="cw-contact-topic-hint">{content.selectedTopic}: {activeTopic?.label || content.other}</div>
                        <button type="submit" className="cw-contact-submit-btn">
                          {content.sendMessage}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div>
                      <h2 className="cw-contact-form-title">{content.aiAssistantTitle}</h2>
                      <p className="cw-contact-form-subtitle">{content.aiAssistantSubtitle}</p>

                      {!hideSuggestions ? (
                        <div className="cw-contact-chip-row">
                          {content.chatSuggestions.map((item) => (
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
                          placeholder={content.questionPlaceholder}
                        />
                        <button type="button" className="cw-contact-chat-send" onClick={() => sendMessage()}>
                          {content.send}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="cw-contact-success">
                  <div className="cw-contact-success-icon">✓</div>
                  <h2 className="cw-contact-form-title">{content.sentTitle}</h2>
                  <p className="cw-contact-form-subtitle">
                    {content.sentSubtitle}
                  </p>
                  <button type="button" className="cw-contact-submit-btn" onClick={resetWithCurrentLanguage}>
                    {content.sendAnother}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="cw-contact-bottom">
          <article>
            <div className="cw-contact-bottom-label">{content.faqTitle}</div>
            <div className="cw-contact-faq-list">
              {content.faqItems.map((item, index) => {
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
            <div className="cw-contact-bottom-label">{content.commitmentTitle}</div>
            <div className="cw-contact-promise-list">
              <div className="cw-contact-promise-item">
                <div className="cw-contact-promise-icon is-blue">⚡</div>
                <div>
                  <div className="cw-contact-promise-title">{content.promiseResponseTitle}</div>
                  <div className="cw-contact-promise-text">{content.promiseResponseText}</div>
                </div>
              </div>
              <div className="cw-contact-promise-item">
                <div className="cw-contact-promise-icon is-teal">🎯</div>
                <div>
                  <div className="cw-contact-promise-title">{content.promiseDirectTitle}</div>
                  <div className="cw-contact-promise-text">{content.promiseDirectText}</div>
                </div>
              </div>
              <div className="cw-contact-promise-item">
                <div className="cw-contact-promise-icon is-amber">🔒</div>
                <div>
                  <div className="cw-contact-promise-title">{content.promiseDataTitle}</div>
                  <div className="cw-contact-promise-text">{content.promiseDataText}</div>
                </div>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
