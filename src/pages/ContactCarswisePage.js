import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { postAlertEmailDigestJson } from "../utils/apiClient";
import "./ContactCarswisePage.css";

export default function ContactCarswisePage() {
  const { t } = useTranslation();
  const content = useMemo(
    () => ({
      topics: t("contact.topics", { returnObjects: true }),
      chatSuggestions: t("contact.chatSuggestions", { returnObjects: true }),
      faqItems: t("contact.faqItems", { returnObjects: true }),
      botWelcome: t("contact.botWelcome"),
      eyebrow: t("contact.eyebrow"),
      heroTitlePrefix: t("contact.heroTitlePrefix"),
      heroTitleAccent: t("contact.heroTitleAccent"),
      heroTitleSuffix: t("contact.heroTitleSuffix"),
      heroSubtitle: t("contact.heroSubtitle"),
      responseHours: t("contact.responseHours"),
      responseSchedule: t("contact.responseSchedule"),
      tabWrite: t("contact.tabWrite"),
      tabChat: t("contact.tabChat"),
      formTitle: t("contact.formTitle"),
      formSubtitle: t("contact.formSubtitle"),
      firstName: t("contact.firstName"),
      firstNamePlaceholder: t("contact.firstNamePlaceholder"),
      lastName: t("contact.lastName"),
      lastNamePlaceholder: t("contact.lastNamePlaceholder"),
      phone: t("contact.phone"),
      message: t("contact.message"),
      messagePlaceholder: t("contact.messagePlaceholder"),
      selectedTopic: t("contact.selectedTopic"),
      other: t("contact.other"),
      sendMessage: t("contact.sendMessage"),
      aiAssistantTitle: t("contact.aiAssistantTitle"),
      aiAssistantSubtitle: t("contact.aiAssistantSubtitle"),
      questionPlaceholder: t("contact.questionPlaceholder"),
      send: t("contact.send"),
      sentTitle: t("contact.sentTitle"),
      sentSubtitle: t("contact.sentSubtitle"),
      sendAnother: t("contact.sendAnother"),
      faqTitle: t("contact.faqTitle"),
      commitmentTitle: t("contact.commitmentTitle"),
      promiseResponseTitle: t("contact.promiseResponseTitle"),
      promiseResponseText: t("contact.promiseResponseText"),
      promiseDirectTitle: t("contact.promiseDirectTitle"),
      promiseDirectText: t("contact.promiseDirectText"),
      promiseDataTitle: t("contact.promiseDataTitle"),
      promiseDataText: t("contact.promiseDataText"),
    }),
    [t]
  );
  const [mode, setMode] = useState("form");
  const [topic, setTopic] = useState("compra");
  const [submitted, setSubmitted] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(-1);
  const [chatInput, setChatInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isChatSubmitting, setIsChatSubmitting] = useState(false);
  const [chatError, setChatError] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [chatMessages, setChatMessages] = useState([
    {
      role: "bot",
      text: content.botWelcome,
    },
  ]);

  const hideSuggestions = chatMessages.length > 1;

  const activeTopic = useMemo(() => content.topics.find((item) => item.key === topic), [content.topics, topic]);

  function buildBotReply(text) {
    const normalized = String(text || "").toLowerCase();

    if (normalized.includes("venta") || normalized.includes("sell")) {
      return t("contact.botReply_venta");
    }

    if (normalized.includes("gestion") || normalized.includes("manage") || normalized.includes("service")) {
      return t("contact.botReply_gestion");
    }

    if (normalized.includes("compra") || normalized.includes("buy") || normalized.includes("recommend") || normalized.includes("coche") || normalized.includes("car")) {
      return t("contact.botReply_compra");
    }

    return t("contact.botReply_default");
  }

  function resetWithCurrentLanguage() {
    setMode("form");
    setTopic("compra");
    setSubmitted(false);
    setSubmitError("");
    setIsSubmitting(false);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      message: "",
    });
    setIsChatSubmitting(false);
    setChatError("");
    setOpenFaqIndex(-1);
    setChatInput("");
    setChatMessages([{ role: "bot", text: content.botWelcome }]);
  }

  function updateFormField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    const topicLabel = activeTopic?.label || content.other;

    try {
      const { response, data } = await postAlertEmailDigestJson({
        to: ["hola@carswise.es"],
        subject: `CarsWise · Nuevo contacto web · ${topicLabel}`,
        text: [
          "Nuevo mensaje recibido desde la página de contacto de CarsWise.",
          `Tema: ${topicLabel}`,
          `Nombre: ${fullName || "No indicado"}`,
          `Email: ${formData.email}`,
          `Teléfono: ${formData.phone || "No indicado"}`,
          "",
          "Mensaje:",
          formData.message,
        ].join("\n"),
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:680px;margin:0 auto;">
            <h2>Nuevo contacto web de CarsWise</h2>
            <p><strong>Tema:</strong> ${topicLabel}</p>
            <p><strong>Nombre:</strong> ${fullName || "No indicado"}<br />
            <strong>Email:</strong> ${formData.email}<br />
            <strong>Teléfono:</strong> ${formData.phone || "No indicado"}</p>
            <p><strong>Mensaje:</strong></p>
            <p>${String(formData.message || "").replace(/\n/g, "<br />")}</p>
          </div>
        `,
      });

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo enviar el mensaje.");
      }

      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo enviar el mensaje.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendMessage(rawText) {
    const value = String(rawText || chatInput).trim();
    if (!value || isChatSubmitting) {
      return;
    }

    setChatError("");
    setIsChatSubmitting(true);
    setChatMessages((prev) => [...prev, { role: "user", text: value }]);
    setChatInput("");

    try {
      const { response, data } = await postAlertEmailDigestJson({
        to: ["hola@carswise.es"],
        subject: "CarsWise · Consulta desde chat web",
        text: [
          "Nueva consulta enviada desde el chat de la página de contacto.",
          "",
          "Consulta:",
          value,
        ].join("\n"),
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:680px;margin:0 auto;">
            <h2>Nueva consulta desde el chat web de CarsWise</h2>
            <p><strong>Consulta:</strong></p>
            <p>${String(value).replace(/\n/g, "<br />")}</p>
          </div>
        `,
      });

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo enviar la consulta.");
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: `${buildBotReply(value)}\n\nHe enviado tu consulta al equipo de CarsWise para que puedan responderte por un canal humano si hace falta.`,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar la consulta.";
      setChatError(message);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "No he podido escalar tu consulta al equipo en este momento. Puedes intentarlo de nuevo o usar el formulario de contacto.",
        },
      ]);
    } finally {
      setIsChatSubmitting(false);
    }
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
              {content.heroTitlePrefix} <span className="cw-contact-title-accent">{content.heroTitleAccent}</span> {content.heroTitleSuffix}
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
                            <input type="text" required placeholder={content.firstNamePlaceholder} value={formData.firstName} onChange={(event) => updateFormField("firstName", event.target.value)} />
                          </label>
                          <label className="cw-contact-field">
                            <span>{content.lastName}</span>
                            <input type="text" placeholder={content.lastNamePlaceholder} value={formData.lastName} onChange={(event) => updateFormField("lastName", event.target.value)} />
                          </label>
                        </div>
                        <label className="cw-contact-field">
                          <span>Email</span>
                          <input type="email" required placeholder="tu@email.com" value={formData.email} onChange={(event) => updateFormField("email", event.target.value)} />
                        </label>
                        <label className="cw-contact-field">
                          <span>{content.phone}</span>
                          <input type="tel" placeholder="+34 600 000 000" value={formData.phone} onChange={(event) => updateFormField("phone", event.target.value)} />
                        </label>
                        <label className="cw-contact-field">
                          <span>{content.message}</span>
                          <textarea
                            required
                            placeholder={content.messagePlaceholder}
                            rows={4}
                            value={formData.message}
                            onChange={(event) => updateFormField("message", event.target.value)}
                          />
                        </label>
                        <div className="cw-contact-topic-hint">{content.selectedTopic}: {activeTopic?.label || content.other}</div>
                        {submitError ? <div className="cw-contact-topic-hint" style={{ color: "#b91c1c" }}>{submitError}</div> : null}
                        <button type="submit" className="cw-contact-submit-btn" disabled={isSubmitting}>
                          {isSubmitting ? "Enviando..." : content.sendMessage}
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
                        <button type="button" className="cw-contact-chat-send" onClick={() => sendMessage()} disabled={isChatSubmitting}>
                          {isChatSubmitting ? "Enviando..." : content.send}
                        </button>
                      </div>
                      {chatError ? <div className="cw-contact-topic-hint" style={{ color: "#b91c1c", marginTop: 8 }}>{chatError}</div> : null}
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
