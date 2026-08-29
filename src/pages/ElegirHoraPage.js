import React, { useEffect, useState } from "react";

/**
 * La pagina que abre el cliente desde el correo de «no puede ser a esa hora».
 *
 * El concesionario ha dado otras horas y aqui las elige. No hay sesion: la
 * llave es el token de su cita, el mismo que abre /mi-cita.
 *
 * Los botones del correo traen ya una hora en la direccion, pero la eleccion no
 * se aplica al abrir: los lectores de correo abren solos los enlaces para
 * comprobarlos, y una cita no puede quedar confirmada porque un antivirus haya
 * mirado el mensaje. Por eso se enseña, se pincha, y entonces se manda.
 */

const API = "/api/visit-availability";

const ZONA = "Europe/Madrid";
const fmtDia = (iso) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });
const fmtHora = (iso) =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });

function Logo() {
  return (
    <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: "var(--gris-900)", letterSpacing: "-.3px" }}>
        <span style={{ color: "var(--marca, #FFC400)" }}>Pop</span>Car
      </span>
    </div>
  );
}

export default function ElegirHoraPage() {
  const params    = new URLSearchParams(window.location.search);
  const bookingId = params.get("id") || "";
  const token     = params.get("token") || "";
  // La hora que traia el boton del correo. Solo la deja marcada.
  const sugerida  = params.get("h") || "";

  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState("");
  const [booking, setBooking]   = useState(null);
  const [horas, setHoras]       = useState([]);
  const [elegida, setElegida]   = useState(sugerida);
  const [mandando, setMandando] = useState(false);
  const [hecha, setHecha]       = useState(null);

  useEffect(() => {
    if (!bookingId || !token) { setError("El enlace no está completo."); setCargando(false); return; }
    (async () => {
      try {
        const r = await fetch(`${API}?route=propuesta&bookingId=${encodeURIComponent(bookingId)}&token=${encodeURIComponent(token)}`);
        const d = await r.json();
        if (!d.ok) { setError(d.error || "No hemos encontrado tu cita."); return; }
        setBooking(d.booking);
        setHoras(d.horas || []);
        // Si la que traia el correo ya no esta entre las propuestas, no se deja
        // marcada: enseñar marcada una hora que no vale es prometer de mas.
        const vale = (d.horas || []).some((h) => new Date(h).getTime() === new Date(sugerida).getTime());
        if (!vale) setElegida("");
      } catch (e) {
        setError("No hemos podido cargar tu cita.");
      } finally {
        setCargando(false);
      }
    })();
  }, [bookingId, token, sugerida]);

  async function confirma() {
    if (!elegida) return;
    setMandando(true);
    setError("");
    try {
      const r = await fetch(`${API}?route=elegir_hora`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, token, startsAt: elegida }),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error || "No hemos podido confirmar esa hora."); return; }
      setHecha(d.booking);
    } catch (e) {
      setError("No hemos podido confirmar esa hora.");
    } finally {
      setMandando(false);
    }
  }

  const F = styles;
  const coche = booking?.vehicle_title || "el vehículo";

  if (cargando) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center", padding: "32px 0", color: "var(--gris-400)", fontSize: 14 }}>Cargando…</div>
    </div></div>
  );

  if (hecha) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={F.title}>Tu visita está confirmada</div>
        <div style={F.sub}>Te hemos mandado el correo con el calendario.</div>
      </div>
      <div style={F.vehicleTitle}>{hecha.vehicle_title || coche}</div>
      <div style={F.dateCard}>
        <div style={F.dateCardLabel}>Fecha y hora</div>
        <div style={F.dateCardDate}>{fmtDia(hecha.starts_at)}</div>
        <div style={F.dateCardTime}>{fmtHora(hecha.starts_at)}</div>
      </div>
      <a href={`/mi-cita?id=${bookingId}&token=${encodeURIComponent(token)}`} style={F.btnPrimary}>Ver mi cita →</a>
    </div></div>
  );

  if (error && !booking) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <div style={F.title}>No hemos encontrado tu cita</div>
        <div style={F.sub}>{error}</div>
        <a href="/" style={F.btnPrimary}>Ir al marketplace →</a>
      </div>
    </div></div>
  );

  // Ya la ha confirmado alguien: no se le pide que elija otra vez.
  if (booking?.status === "confirmed") return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center" }}>
        <div style={F.title}>Tu visita ya está confirmada</div>
        <div style={F.sub}>No hace falta que elijas nada más.</div>
      </div>
      <div style={F.vehicleTitle}>{coche}</div>
      <div style={F.dateCard}>
        <div style={F.dateCardLabel}>Fecha y hora</div>
        <div style={F.dateCardDate}>{fmtDia(booking.starts_at)}</div>
        <div style={F.dateCardTime}>{fmtHora(booking.starts_at)}</div>
      </div>
      <a href={`/mi-cita?id=${bookingId}&token=${encodeURIComponent(token)}`} style={F.btnPrimary}>Ver mi cita →</a>
    </div></div>
  );

  if (booking?.status === "cancelled") return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={F.title}>Esta visita está cancelada</div>
        <div style={F.sub}>Puedes pedir otra desde la ficha del coche.</div>
        <a href={`/marketplace-vo/${booking.offer_id}`} style={F.btnPrimary}>Ver el coche →</a>
      </div>
    </div></div>
  );

  if (!horas.length) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={F.title}>No hay horas que elegir</div>
        <div style={F.sub}>Puede que ya hayas elegido una, o que te escribamos con otras. Tu solicitud sigue en pie.</div>
        <a href={`/mi-cita?id=${bookingId}&token=${encodeURIComponent(token)}`} style={F.btnPrimary}>Ver mi cita →</a>
      </div>
    </div></div>
  );

  return (
    <div style={F.page}>
      <div style={F.card}>
        <Logo />
        <div style={F.title}>Elige la hora de tu visita</div>
        <div style={F.sub}>
          A la hora que pediste no podía ser. Estas son las que nos ha dado quien tiene el coche.
        </div>
        <div style={F.vehicleTitle}>{coche}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {horas.map((h) => {
            const activa = new Date(h).getTime() === new Date(elegida).getTime();
            return (
              <button key={h} type="button" onClick={() => setElegida(h)} style={{
                ...F.opcion,
                ...(activa ? F.opcionActiva : null),
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, textTransform: "capitalize" }}>{fmtDia(h)}</span>
                <span style={{ fontSize: 20, fontWeight: 800 }}>{fmtHora(h)}</span>
              </button>
            );
          })}
        </div>

        {error && <div style={F.errMsg}>{error}</div>}

        <button onClick={confirma} disabled={!elegida || mandando} style={{
          ...F.btnPrimary,
          opacity: !elegida || mandando ? 0.5 : 1,
          cursor: !elegida || mandando ? "default" : "pointer",
        }}>
          {mandando ? "Confirmando…" : "Confirmar esta hora"}
        </button>

        <div style={{ fontSize: 12, color: "var(--gris-400)", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
          Al confirmar, tu visita queda cerrada a esa hora y te mandamos el calendario.
          Si ninguna te viene bien, entra en tu panel, en Solicitudes, y cancélala o pide otro día.
        </div>
      </div>
    </div>
  );
}

const styles = {
  page:          { minHeight: "100vh", background: "var(--gris-50)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  card:          { background: "#fff", borderRadius: 20, boxShadow: "0 8px 48px rgba(0,0,0,.1)", padding: "32px 28px", maxWidth: 440, width: "100%" },
  title:         { fontSize: 22, fontWeight: 800, color: "var(--gris-900)", marginBottom: 6, textAlign: "center" },
  sub:           { fontSize: 14, color: "var(--gris-500)", marginBottom: 20, lineHeight: 1.6, textAlign: "center" },
  vehicleTitle:  { fontSize: 16, fontWeight: 700, color: "var(--gris-900)", textAlign: "center", marginBottom: 16 },
  dateCard:      { background: "linear-gradient(135deg, var(--acento-tenue), var(--gris-50))", border: "1.5px solid var(--gris-200)", borderRadius: 14, padding: "20px", marginBottom: 14, textAlign: "center" },
  dateCardLabel: { fontSize: 11, fontWeight: 700, color: "var(--gris-300)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 },
  dateCardDate:  { fontSize: 15, fontWeight: 700, color: "var(--gris-900)", marginBottom: 4, textTransform: "capitalize" },
  dateCardTime:  { fontSize: 26, fontWeight: 800, color: "var(--gris-900)" },

  opcion:        { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "#fff", border: "1.5px solid var(--gris-200)", borderRadius: 12, padding: "14px 18px", color: "var(--gris-900)", cursor: "pointer", textAlign: "left" },
  opcionActiva:  { background: "var(--acento-tenue)", borderColor: "var(--marca, #FFC400)", boxShadow: "0 0 0 3px rgba(255,196,0,.18)" },

  btnPrimary:    { display: "block", width: "100%", background: "linear-gradient(135deg, var(--gris-700), var(--gris-900))", color: "#fff", textDecoration: "none", padding: "13px 0", borderRadius: 10, fontWeight: 800, fontSize: 15, textAlign: "center", border: "none", cursor: "pointer", boxSizing: "border-box", marginTop: 4 },
  errMsg:        { background: "var(--gris-100)", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 },
};
