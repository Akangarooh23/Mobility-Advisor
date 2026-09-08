/**
 * Los dos correos con los que se entrega una tasacion.
 *
 * Vivian dentro de billing-webhook-handler.js, que era su unico sitio de uso
 * cuando una tasacion solo existia pagando. Desde que la primera es gratuita
 * hay un segundo camino que no pasa por Stripe ni por el webhook, y los dos
 * tienen que mandar exactamente el mismo correo: con la plantilla duplicada,
 * el dia que cambiara una, el cliente recibiria una cosa u otra segun hubiera
 * pagado.
 *
 * Aqui no se decide si se cobra ni se registra nada: solo se manda.
 */
"use strict";

const { MARCA, remitente, respuestaA } = require("./marca");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function sendValuationEmail({ to, pdfBuffer, reportData, vehicle: vehFallback }) {
  const apiKey = normalizeText(process.env.RESEND_API_KEY);
  const from   = remitente();
  if (!apiKey) {
    console.warn("[valuation] RESEND_API_KEY not set, skipping email.");
    return;
  }

  const veh = reportData.vehicle || vehFallback || {};
  const vehicleLabel = [veh.brand, veh.model, veh.year ? `(${veh.year})` : ""].filter(Boolean).join(" ") || "tu vehículo";
  const priceStr = reportData.priceOptimal
    ? new Intl.NumberFormat("es-ES").format(reportData.priceOptimal) + " €"
    : "–";

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111111;">
      <div style="background:#111111;padding:28px 32px 24px;border-bottom:4px solid #FFC400;">
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;"><span style="color:#FFC400">Pop</span><span style="color:#fff">Car</span></span>
        <span style="font-size:11px;color:#9A9A93;margin-left:10px;letter-spacing:0.06em;">TASACIÓN DE MERCADO</span>
      </div>
      <div style="padding:28px 32px;">
        <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;">Tu informe está listo</h1>
        <p style="color:#5E5E59;margin:0 0 24px;">Adjunto a este email encontrarás el PDF con el análisis completo de mercado para <strong>${vehicleLabel}</strong>.</p>
        <div style="background:#FFF6D9;border:1.5px solid #FFC400;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6B5200;font-weight:700;margin-bottom:6px;">Precio óptimo de venta</div>
          <div style="font-size:36px;font-weight:800;color:#111111;line-height:1;">${priceStr}</div>
          <div style="font-size:12px;color:#5E5E59;margin-top:6px;">Basado en ${reportData.comparables || 0} comparables · Confianza ${reportData.confidence || 0}%</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
          <div style="background:#fff;border:1px solid #E4E4DF;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#111111;">${reportData.comparables || "–"}</div>
            <div style="font-size:11px;color:#5E5E59;margin-top:4px;">Unidades en portales</div>
          </div>
          <div style="background:#fff;border:1px solid #E4E4DF;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#111111;">–</div>
            <div style="font-size:11px;color:#5E5E59;margin-top:4px;">Días medios de venta</div>
          </div>
          <div style="background:#fff;border:1px solid #E4E4DF;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#6B5200;">${reportData.demand || "–"}</div>
            <div style="font-size:11px;color:#5E5E59;margin-top:4px;">Nivel de demanda</div>
          </div>
        </div>
        <p style="font-size:13px;color:#5E5E59;">El PDF adjunto incluye el análisis completo por portales, histograma de precios, estrategia de venta y recomendaciones personalizadas.</p>
        <p style="font-size:12px;color:#96968F;margin-top:24px;">Este informe es válido durante 30 días desde su emisión · ${MARCA.nombre} · <a href="${MARCA.sitioUrl}" style="color:#111111;">${MARCA.sitio}</a></p>
      </div>
    </div>`;

  const payload = {
    from,
    reply_to: respuestaA(),
    to: [to],
    subject: `Tu informe de mercado — ${vehicleLabel}`,
    html,
    ...(pdfBuffer ? { attachments: [{ filename: `Informe_de_Mercado_${MARCA.nombre}.pdf`, content: pdfBuffer.toString("base64") }] } : {}),
  };

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    console.error("[valuation] Resend error:", err);
    throw new Error(err?.message || "Error enviando email de tasacion.");
  }
}

async function sendFleetEmail({ to, reports, vehicles }) {
  const apiKey = normalizeText(process.env.RESEND_API_KEY);
  const from   = remitente();
  if (!apiKey) { console.warn("[valuation_fleet] RESEND_API_KEY not set."); return; }

  const count = vehicles.length;
  const rows = vehicles.map((v, i) => {
    const r = reports[i];
    const label = [v.brand, v.model, v.year].filter(Boolean).join(" ") || `Vehículo ${i + 1}`;
    const price = r?.reportData?.priceOptimal
      ? new Intl.NumberFormat("es-ES").format(r.reportData.priceOptimal) + " €"
      : "–";
    return `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#111111;">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#111111;font-weight:700;">${price}</td>${v.plate ? `<td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#5E5E59;">${v.plate}</td>` : "<td></td>"}</tr>`;
  }).join("");

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111111;">
      <div style="background:#111111;padding:28px 32px 24px;border-bottom:4px solid #FFC400;">
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;"><span style="color:#FFC400">Pop</span><span style="color:#fff">Car</span></span>
        <span style="font-size:11px;color:#9A9A93;margin-left:10px;letter-spacing:0.06em;">TASACIÓN DE FLOTA</span>
      </div>
      <div style="padding:28px 32px;">
        <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;">Tus ${count} informes están listos</h1>
        <p style="color:#5E5E59;margin:0 0 24px;">Adjunto a este email encontrarás ${count} informes PDF, uno por cada vehículo analizado.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#fafafa;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
          <thead><tr style="background:#FFF6D9;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#5E5E59;letter-spacing:0.06em;text-transform:uppercase;">Vehículo</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#5E5E59;letter-spacing:0.06em;text-transform:uppercase;">Precio óptimo</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#5E5E59;letter-spacing:0.06em;text-transform:uppercase;">Matrícula</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:12px;color:#96968F;">Cada PDF incluye análisis por portales, histograma de precios, estrategia de venta y recomendaciones. Válido 30 días · ${MARCA.nombre}</p>
      </div>
    </div>`;

  const attachments = reports
    .map((r, i) => {
      if (!r?.pdfBuffer) return null;
      const v = vehicles[i] || {};
      const name = [v.brand, v.model, v.plate].filter(Boolean).join("_").replace(/\s+/g, "_") || `vehiculo_${i + 1}`;
      return { filename: `Informe_de_Mercado_${name}.pdf`, content: r.pdfBuffer.toString("base64") };
    })
    .filter(Boolean);

  const payload = { from, reply_to: respuestaA(), to: [to], subject: `Tus ${count} informes de mercado — ${MARCA.nombre}`, html };
  if (attachments.length) payload.attachments = attachments;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.message || "Error enviando email de flota.");
  }
}

module.exports = { sendValuationEmail, sendFleetEmail };
