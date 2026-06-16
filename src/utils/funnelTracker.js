import { getStoredUtm } from "./utmTracker";

const ANON_ID_KEY = "cw_anon_id";

export function getAnonId() {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return "anon-unknown";
  }
}

export async function trackFunnelEvent({ event_type, user_id, user_email, offer_id, offer_title, modality }) {
  try {
    const utm = getStoredUtm() || {};
    const body = {
      anon_id:      getAnonId(),
      user_id:      user_id      || null,
      user_email:   user_email   || null,
      event_type,
      utm_source:   utm.utm_source   || "",
      utm_medium:   utm.utm_medium   || "",
      utm_campaign: utm.utm_campaign || "",
      utm_content:  utm.utm_content  || "",
      utm_term:     utm.utm_term     || "",
      landing_url:  window.location.href,
      offer_id:     offer_id    || null,
      offer_title:  offer_title || null,
      modality:     modality    || null,
    };
    await fetch("/api/funnel-event", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
  } catch {
    // fire-and-forget — never block the UI
  }
}
