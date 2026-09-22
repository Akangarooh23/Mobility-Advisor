/**
 * El resumen de alertas por correo, y por qué ya no acepta nada de fuera.
 *
 * Esta dirección estaba abierta: sin sesión, sin secreto, sin nada. Y el cuerpo
 * de la petición decidía el destinatario (`to`), el remitente (`from`) y el
 * HTML entero. Es decir: cualquiera podía mandar el correo que quisiera, a
 * quien quisiera, firmado con nuestro dominio —con su SPF y su DKIM buenos, que
 * es justo lo que hace que un engaño pase el filtro—. Un relé de correo abierto
 * no es solo un agujero nuestro: es lo que quema la reputación del dominio y
 * acaba mandando a la carpeta de no deseado también las facturas.
 *
 * La regla ahora: **manda la sesión**. El correo va a la dirección de quien
 * pide, el remitente lo pone `remitente()` y el cuerpo se arma aquí con lo
 * único que se admite de fuera —la lista de alertas, escapada—. El `to`, el
 * `from`, el `html` y el `text` que lleguen en el cuerpo se ignoran.
 *
 * El envío automático de verdad no pasa por aquí: lo hace
 * `lib/api/cron-alert-check-handler.js`, con su `CRON_SECRET`. Esto es solo el
 * botón «mándame mi resumen» del panel.
 */
const { MARCA, remitente, respuestaA } = require("../lib/marca");
const { plantilla, parrafo, datos, enlace } = require("../lib/correo");
const { identidadDeLaPeticion } = require("../lib/api/identidad");
function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeNotifications(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      title: normalizeText(item?.title),
      summary: normalizeText(item?.summary),
      newMatchesCount: Number(item?.newMatchesCount || 0),
      email: normalizeText(item?.email).toLowerCase(),
      matches: Array.isArray(item?.matches)
        ? item.matches
            .map((match) => ({
              title: normalizeText(match?.title),
              location: normalizeText(match?.location),
              price: Number(match?.price || 0),
              rentingMonthly: Number(match?.rentingMonthly || match?.renting?.monthly || 0),
            }))
            .filter((match) => match.title)
        : [],
    }))
    .filter((item) => item.title);
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMatchBudget(match = {}) {
  if (Number(match?.rentingMonthly || 0) > 0) {
    return `${formatCurrency(match.rentingMonthly)}/mes`;
  }

  return formatCurrency(match?.price);
}

function buildDigestPayload(body = {}, correoDeQuienPide = "") {
  const notifications = normalizeNotifications(body.notifications);
  // A quien pide, y a nadie más. Antes salía de `body.to`.
  const to = ensureArray(correoDeQuienPide)
    .map((item) => normalizeText(item).toLowerCase())
    .filter(Boolean);
  const subject =
    `${MARCA.nombre} · ${notifications.length || to.length || 1} alerta${notifications.length === 1 ? "" : "s"} con novedades`;

  const textLines = [
    "Hola,",
    "",
    `Este es tu resumen de novedades detectadas por ${MARCA.nombre}:`,
    "",
    ...notifications.flatMap((item) => {
      const lines = [
        `• ${item.title}`,
        `  ${item.summary || `${item.newMatchesCount} novedades detectadas`}`,
      ];

      item.matches.forEach((match) => {
        lines.push(
          `  - ${match.title}${match.location ? ` · ${match.location}` : ""}${formatMatchBudget(match) ? ` · ${formatMatchBudget(match)}` : ""}`
        );
      });

      lines.push("");
      return lines;
    }),
    `Puedes revisar tus alertas desde tu panel de ${MARCA.nombre}.`,
  ].join("\n");

  // El nombre que salía aquí era «MoveAdvisor», dos marcas por detrás, y el
  // listado usaba `display:grid`, que ningún cliente de correo entiende: las
  // tarjetas se veían apiladas sin separación.
  const html = plantilla({
    titulo: "Novedades en tus alertas",
    cuerpo:
      parrafo("Hemos encontrado coincidencias nuevas con lo que tienes guardado.") +
      notifications
        .map((item) =>
          datos([
            [escapeHtml(item.title), escapeHtml(item.summary || `${item.newMatchesCount} novedades`)],
            ...item.matches.map((match) => [
              "",
              escapeHtml(
                [match.title, match.location, formatMatchBudget(match)].filter(Boolean).join(" · ")
              ),
            ]),
          ])
        )
        .join("") +
      enlace("Revisar mis alertas", `${MARCA.sitioUrl}/panel`),
    pie: "Recibes este correo porque tienes alertas guardadas. Puedes ajustarlas desde tu panel.",
  });

  return {
    to,
    subject,
    // Ni el texto ni el HTML se cogen del cuerpo: se arman aquí con lo que ha
    // pasado por `normalizeNotifications`, que escapa lo que escribe el usuario.
    text: textLines,
    html,
    notifications,
    from: remitente(),
  };
}

async function sendViaResend(payload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: payload.from,
      reply_to: respuestaA(),
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = normalizeText(data?.message || data?.error || response.statusText);
    throw new Error(detail || "No se pudo enviar el email con Resend.");
  }

  return data;
}

module.exports = async function sendAlertEmailHandler(req, res) {
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body && typeof req.body === "object"
    ? req.body
    : (() => {
        try {
          return JSON.parse(String(req.body || "{}"));
        } catch {
          return {};
        }
      })();

  // El correo de la sesión, nunca el del cuerpo: `identidadDeLaPeticion` solo
  // admite el de la petición fuera de producción, y para probar con curl.
  const { email } = await identidadDeLaPeticion(req, { cuerpo: body });
  if (!email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = buildDigestPayload(body, email);

  if (payload.to.length === 0) {
    return res.status(400).json({ error: "Debes indicar al menos un correo de destino." });
  }

  const provider = normalizeText(process.env.ALERT_EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "console")).toLowerCase();

  if (provider === "resend" && process.env.RESEND_API_KEY) {
    try {
      const result = await sendViaResend(payload);
      return res.status(200).json({
        ok: true,
        simulated: false,
        provider: "resend",
        message: payload.to.length === 1
          ? `Resumen enviado a ${payload.to[0]}.`
          : `Resumen enviado a ${payload.to.length} destinatarios.`,
        id: result?.id || null,
        to: payload.to,
      });
    } catch (error) {
      return res.status(502).json({
        error: error instanceof Error ? error.message : "No se pudo enviar el resumen por email.",
      });
    }
  }

  console.log(`[${MARCA.nombre}] Resumen por email en modo local/simulado`);
  console.log(JSON.stringify({ to: payload.to, subject: payload.subject, notifications: payload.notifications }, null, 2));

  return res.status(200).json({
    ok: true,
    simulated: true,
    provider: "console",
    message: payload.to.length === 1
      ? `Resumen preparado para ${payload.to[0]} en modo local.`
      : `Resumen preparado para ${payload.to.length} correos en modo local.`,
    to: payload.to,
    subject: payload.subject,
  });
};
