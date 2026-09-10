import { useEffect, useState } from "react";
import { DOMINIO_UID } from "../marca";
import { getUtmPayload } from "../utils/utmTracker";

const API = "/api/visit-availability";

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDayShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    weekday: d.toLocaleDateString("es-ES", { weekday: "short" }),
    day:     d.toLocaleDateString("es-ES", { day: "numeric" }),
    month:   d.toLocaleDateString("es-ES", { month: "short" }),
  };
}
function fmtDayLong(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function isToday(dateStr) {
  return dateStr === new Date().toISOString().slice(0, 10);
}
function isMorning(iso) {
  return new Date(iso).getHours() < 14;
}
function buildIcsBlob(booking) {
  function dt(iso) { return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"; }
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PopCar//ES", "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `DTSTART:${dt(booking.starts_at)}`, `DTEND:${dt(booking.ends_at)}`,
    `SUMMARY:Visita: ${booking.vehicle_title || "Vehículo"}`,
    `DESCRIPTION:Cita confirmada.\\nID: ${booking.id}`,
    `UID:${booking.id}@${DOMINIO_UID}`, "STATUS:CONFIRMED",
    "END:VEVENT", "END:VCALENDAR",
  ];
  return new Blob([lines.join("\r\n")], { type: "text/calendar" });
}

function groupByDay(slots) {
  const map = {};
  slots.forEach((s) => {
    const day = s.starts_at.slice(0, 10);
    if (!map[day]) map[day] = [];
    map[day].push(s);
  });
  return map;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SlotPicker({ offerId, vehicleTitle, userEmail, userName, userPhone, source, onBooked, haySesion = true, onEntrar }) {
  const [slots,      setSlots]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [activeDay,  setActiveDay]  = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [step,       setStep]       = useState("pick"); // pick | confirm | done
  /*
   * `email` y `quiereFinanciar` solo se usan sin sesión.
   *
   * Con sesión el correo lo pone el servidor y preguntarlo sería pedir un dato
   * que ya tenemos. Sin ella es la pieza entera: es a donde va el enlace que
   * prueba que quien pide la visita es quien dice.
   */
  const [form,       setForm]       = useState({
    name: userName || "", phone: userPhone || "", notes: "",
    email: "", quiereFinanciar: false,
  });
  const [booking,    setBooking]    = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!offerId) return;
    fetch(`${API}?offerId=${encodeURIComponent(offerId)}`)
      .then((r) => r.json())
      .then((d) => {
        const s = d.slots || [];
        setSlots(s);
        if (s.length) setActiveDay(s[0].starts_at.slice(0, 10));
        setLoading(false);
      })
      .catch(() => { setError("No se pudieron cargar los horarios"); setLoading(false); });
  }, [offerId]);

  async function confirmBooking() {
    if (!selected) return;
    if (haySesion && !userEmail) return;
    setSubmitting(true);
    setError("");
    try {
      /*
       * Dos caminos, y el que se toma depende de si sabemos quién es.
       *
       * Con sesión se reserva directamente: el correo lo pone el servidor desde
       * la sesión. Sin ella se **pide**, y lo que llega es un enlace al correo:
       * hasta que lo pulsa no hay reserva y el hueco sigue libre para otro.
       */
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route: haySesion ? "book" : "solicitar",
          slotId: selected.id, offerId, vehicleTitle,
          buyerEmail: haySesion ? userEmail : form.email,
          buyerName: form.name, buyerPhone: form.phone,
          // El correo del vendedor lo pone el servidor: es a dónde va el aviso,
          // y no puede depender de lo que mande el navegador.
          notes: form.notes,
          quiereFinanciar: form.quiereFinanciar,
          source: source || "marketplace",
          /*
           * De dónde vino, igual que en los leads.
           *
           * Sin esto, el comprador que llega de coches.net, pide cita y no deja
           * lead entra como si hubiera aparecido de la nada — y ese es justo el
           * camino del que viene del portal: pulsa el enlace corto, ve el coche
           * y pide hora. Y es la única forma de contestar si el portal trae
           * gente o solo cuesta dinero.
           */
          ...getUtmPayload(),
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Error al reservar");
        if (d.error?.includes("disponible")) {
          setSlots((prev) => prev.filter((s) => s.id !== selected.id));
          setSelected(null); setStep("pick");
        }
      } else if (d.pendienteDeConfirmar) {
        setStep("correo");
      } else {
        setBooking(d.booking); setStep("done");
        if (onBooked) onBooked(d.booking);
      }
    } catch { setError("Error de conexión"); }
    setSubmitting(false);
  }

  function downloadIcs() {
    if (!booking) return;
    const url = URL.createObjectURL(buildIcsBlob(booking));
    const a = document.createElement("a");
    a.href = url; a.download = "cita-popcar.ics"; a.click();
    URL.revokeObjectURL(url);
  }

  const byDay  = groupByDay(slots);
  const days   = Object.keys(byDay).sort().slice(0, 14);
  const daySlots = activeDay ? (byDay[activeDay] || []) : [];
  const morning  = daySlots.filter((s) => isMorning(s.starts_at));
  const afternoon = daySlots.filter((s) => !isMorning(s.starts_at));

  /*
   * Sin sesión ya no se bloquea: se pide el correo.
   *
   * Antes aquí había un candado y un botón de entrar. Quien llega de un portal
   * a ver un coche no se hace una cuenta para mirar tres huecos, así que ese
   * candado era el final del camino para casi todos.
   *
   * Lo que la sesión probaba —que el correo es tuyo— lo prueba ahora el enlace
   * que se manda: hasta que se pulsa no hay reserva. El servidor lo exige
   * igual, así que esto no es un permiso que se dé la pantalla.
   */

  // ── El enlace está en su correo ────────────────────────────────────────────
  if (step === "correo") return (
    <div style={{ textAlign: "center", padding: "18px 0" }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>✉️</div>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, color: "var(--gris-900)" }}>
        Mira tu correo
      </div>
      <p style={{ fontSize: 13, color: "var(--gris-500)", lineHeight: 1.5, margin: "0 0 6px" }}>
        Te hemos escrito a <strong>{form.email}</strong> con un enlace para confirmar la visita.
      </p>
      <p style={{ fontSize: 12.5, color: "var(--gris-500)", lineHeight: 1.5, margin: 0 }}>
        Todavía no está reservada: la hora se guarda cuando pulses el enlace.
      </p>
    </div>
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={S.loading}>
      <span style={S.spinner} />
      Cargando disponibilidad…
    </div>
  );

  // ── Done ──────────────────────────────────────────────────────────────────
  // Si el horario lo generó el sistema en vez de publicarlo el vendedor, la
  // reserva nace pendiente: decir aquí «¡confirmada!» y ofrecer el calendario
  // sería prometer algo que nadie ha dicho todavía.
  if (step === "done" && booking) {
    const pendiente = booking.status === "pending";
    return (
      <div style={S.doneWrap}>
        <div style={S.doneIcon}>{pendiente ? "🕐" : "✅"}</div>
        <div style={S.doneTitle}>{pendiente ? "Solicitud enviada" : "¡Visita confirmada!"}</div>
        <div style={S.doneCard}>
          <div style={S.doneDate}>{fmtDayLong(booking.starts_at.slice(0, 10))}</div>
          <div style={S.doneTime}>{fmtTime(booking.starts_at)} – {fmtTime(booking.ends_at)}</div>
        </div>
        <p style={S.doneHint}>
          {pendiente
            ? "Nos falta confirmar ese horario con quien tiene el coche. Te escribimos en cuanto lo tengamos, y si no puede ser te proponemos otro. No tienes que hacer nada."
            : "Recibirás un email de confirmación con todos los detalles y un archivo para tu calendario."}
        </p>
        {!pendiente && (
          <button onClick={downloadIcs} style={S.icsBtn}>
            ⬇ Añadir al calendario (.ics)
          </button>
        )}
      </div>
    );
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  if (step === "confirm" && selected) return (
    <div style={S.confirmWrap}>
      <button onClick={() => { setStep("pick"); setError(""); }} style={S.backLink}>
        ← Cambiar hora
      </button>

      <div style={S.selectedBadge}>
        <span style={S.selectedIcon}>📅</span>
        <div>
          <div style={S.selectedDate}>{fmtDayLong(selected.starts_at.slice(0, 10))}</div>
          <div style={S.selectedTime}>{fmtTime(selected.starts_at)} – {fmtTime(selected.ends_at)}</div>
        </div>
      </div>

      {error && <div style={S.errMsg}>{error}</div>}

      <div style={S.field}>
        <label style={S.label}>Tu nombre <span style={{ color: "#ef4444" }}>*</span></label>
        <input
          style={S.input}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Ana García"
          autoFocus
        />
      </div>
      <div style={S.field}>
        <label style={S.label}>Teléfono de contacto</label>
        <input
          style={S.input}
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="600 000 000"
          type="tel"
        />
      </div>
      {/*
        * El correo solo se pregunta a quien no ha entrado.
        *
        * Con sesión ya lo sabemos, y volver a pedirlo abre la puerta a que
        * escriba otro distinto: eso es justo lo que no puede pasar, porque el
        * correo es a donde van los avisos de la cita.
        */}
      {!haySesion && (
        <>
          <div style={S.field}>
            <label style={S.label}>Tu correo <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              style={S.input}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="tu@correo.com"
              type="email"
              autoComplete="email"
            />
            <div style={{ fontSize: 11.5, color: "var(--gris-500)", marginTop: 5, lineHeight: 1.45 }}>
              Te mandamos ahí un enlace para confirmar. Sin pulsarlo no se reserva la hora.
            </div>
          </div>

          {/*
            * Una sola pregunta, sí o no.
            *
            * Nada de datos económicos para ver un coche: eso espanta a la mitad
            * de la gente y este formulario es la boca del embudo. Al que diga
            * que sí se le llama.
            */}
          <label style={{ ...S.field, display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.quiereFinanciar}
              onChange={(e) => setForm((f) => ({ ...f, quiereFinanciar: e.target.checked }))}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--marca)" }}
            />
            <span style={{ fontSize: 13, color: "var(--gris-700)", lineHeight: 1.45 }}>
              ¿Te interesaría financiarlo?
              <span style={{ display: "block", fontSize: 11.5, color: "var(--gris-500)" }}>
                Sin compromiso. Solo para saber si te llamamos con opciones.
              </span>
            </span>
          </label>
        </>
      )}

      <div style={S.field}>
        <label style={S.label}>Notas para el vendedor (opcional)</label>
        <textarea
          style={{ ...S.input, height: 64, resize: "vertical", paddingTop: 10 }}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="¿Algún detalle que quieras comentar?"
        />
      </div>

      {(() => {
        // Sin sesión hacen falta correo y teléfono: el correo porque es donde va
        // el enlace, y el teléfono porque al vendedor le prometemos compradores
        // con los que se pueda hablar.
        const listo = form.name.trim()
          && (haySesion || (form.email.trim() && form.phone.trim()));
        return (
          <button
            style={{ ...S.confirmBtn, opacity: submitting || !listo ? 0.55 : 1 }}
            disabled={submitting || !listo}
            onClick={confirmBooking}
          >
            {submitting
              ? (haySesion ? "Reservando…" : "Enviando…")
              : (haySesion ? "Confirmar visita →" : "Pedir la visita →")}
          </button>
        );
      })()}
    </div>
  );

  // ── Pick ──────────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      <div style={S.pickerTitle}>Elige fecha y hora</div>

      {slots.length === 0 ? (
        <div style={S.noSlots}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🗓</div>
          No hay horarios disponibles en este momento.
        </div>
      ) : (
        <>
          {/* Day tabs */}
          <div style={S.dayTabsWrap}>
            <div style={S.dayTabs}>
              {days.map((day) => {
                const { weekday, day: d, month } = fmtDayShort(day);
                const isActive = activeDay === day;
                const today = isToday(day);
                return (
                  <button
                    key={day}
                    onClick={() => setActiveDay(day)}
                    style={{
                      ...S.dayTab,
                      ...(isActive ? S.dayTabActive : {}),
                      ...(today && !isActive ? { borderColor: "var(--gris-700)", color: "var(--gris-700)" } : {}),
                    }}
                  >
                    <span style={S.dayTabWeekday}>{today ? "Hoy" : weekday}</span>
                    <span style={S.dayTabNum}>{d}</span>
                    <span style={S.dayTabMonth}>{month}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot grid */}
          <div style={S.slotSection}>
            {morning.length > 0 && (
              <>
                <div style={S.periodLabel}>Mañana</div>
                <div style={S.slotGrid}>
                  {morning.map((s) => (
                    <SlotButton key={s.id} slot={s} selected={selected} onSelect={() => { setSelected(s); setStep("confirm"); setError(""); }} />
                  ))}
                </div>
              </>
            )}
            {afternoon.length > 0 && (
              <>
                <div style={{ ...S.periodLabel, marginTop: morning.length ? 16 : 0 }}>Tarde</div>
                <div style={S.slotGrid}>
                  {afternoon.map((s) => (
                    <SlotButton key={s.id} slot={s} selected={selected} onSelect={() => { setSelected(s); setStep("confirm"); setError(""); }} />
                  ))}
                </div>
              </>
            )}
            {morning.length === 0 && afternoon.length === 0 && (
              <div style={S.noSlots}>No hay horarios disponibles este día.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SlotButton({ slot, selected, onSelect }) {
  const isActive = selected?.id === slot.id;
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...S.slotBtn,
        ...(isActive || hover ? S.slotBtnActive : {}),
      }}
    >
      {new Date(slot.starts_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
    </button>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  loading:       { display: "flex", alignItems: "center", gap: 10, color: "var(--gris-500)", fontSize: 14, padding: "24px 0" },
  spinner:       { width: 16, height: 16, border: "2px solid var(--gris-200)", borderTopColor: "var(--gris-700)", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 },

  wrap:          { },
  pickerTitle:   { fontSize: 15, fontWeight: 700, color: "var(--gris-900)", marginBottom: 14 },
  noSlots:       { color: "var(--gris-400)", fontSize: 13, textAlign: "center", padding: "20px 0", lineHeight: 1.6 },

  dayTabsWrap:   { overflowX: "auto", marginBottom: 18, paddingBottom: 4, WebkitOverflowScrolling: "touch" },
  dayTabs:       { display: "flex", gap: 8, minWidth: "max-content" },
  dayTab:        { background: "#fff", border: "1.5px solid var(--gris-200)", borderRadius: 10, padding: "8px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 56, transition: "all .15s", color: "var(--gris-600)" },
  dayTabActive:  { background: "var(--gris-700)", borderColor: "var(--gris-700)", color: "#fff" },
  dayTabWeekday: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", opacity: 0.7 },
  dayTabNum:     { fontSize: 18, fontWeight: 800, lineHeight: 1 },
  dayTabMonth:   { fontSize: 10, opacity: 0.65 },

  slotSection:   { },
  periodLabel:   { fontSize: 11, fontWeight: 700, color: "var(--gris-400)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 },
  slotGrid:      { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 },
  slotBtn:       { background: "var(--gris-50)", border: "1.5px solid var(--gris-200)", color: "var(--gris-800)", borderRadius: 8, padding: "9px 6px", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all .12s", textAlign: "center" },
  slotBtnActive: { background: "var(--gris-700)", borderColor: "var(--gris-700)", color: "#fff", transform: "scale(1.04)" },

  // Confirm step
  confirmWrap:   { },
  backLink:      { background: "none", border: "none", color: "var(--gris-700)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16, display: "flex", alignItems: "center", gap: 4 },
  selectedBadge: { display: "flex", alignItems: "center", gap: 12, background: "var(--gris-50)", border: "1.5px solid #86efac", borderRadius: 12, padding: "14px 16px", marginBottom: 20 },
  selectedIcon:  { fontSize: 22, flexShrink: 0 },
  selectedDate:  { fontSize: 14, fontWeight: 700, color: "#166534" },
  selectedTime:  { fontSize: 13, color: "#15803d", marginTop: 2 },
  field:         { marginBottom: 14 },
  label:         { display: "block", fontSize: 12, fontWeight: 700, color: "var(--gris-600)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".3px" },
  input:         { width: "100%", border: "1.5px solid var(--gris-200)", borderRadius: 8, padding: "10px 13px", fontSize: 14, color: "var(--gris-900)", boxSizing: "border-box", outline: "none", fontFamily: "inherit", transition: "border-color .15s" },
  confirmBtn:    { width: "100%", background: "linear-gradient(135deg, var(--gris-700), var(--gris-900))", border: "none", color: "#fff", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 800, cursor: "pointer", marginTop: 4, letterSpacing: ".2px", transition: "all .15s" },
  errMsg:        { background: "var(--gris-100)", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 },

  // Done step
  doneWrap:      { textAlign: "center", padding: "12px 0", },
  doneIcon:      { fontSize: 44, marginBottom: 10 },
  doneTitle:     { fontSize: 20, fontWeight: 800, color: "var(--gris-900)", marginBottom: 12 },
  doneCard:      { background: "var(--gris-50)", border: "1.5px solid #86efac", borderRadius: 12, padding: "16px 20px", marginBottom: 14, display: "inline-block", minWidth: 220 },
  doneDate:      { fontSize: 15, fontWeight: 700, color: "#166534", marginBottom: 4 },
  doneTime:      { fontSize: 20, fontWeight: 800, color: "var(--gris-900)" },
  doneHint:      { fontSize: 13, color: "var(--gris-500)", lineHeight: 1.6, marginBottom: 16 },
  icsBtn:        { background: "var(--gris-50)", border: "1.5px solid var(--gris-200)", color: "var(--gris-600)", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
};
