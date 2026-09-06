import React, { useEffect, useState } from "react";

/**
 * La pagina que abre el cliente desde el correo de «¿que tal fue la visita?».
 *
 * Antes ese correo le pedia que contestara escribiendo. Contestar escribiendo
 * significa que alguien lea el correo y lo apunte a mano, y lo que no se apunta
 * no existe: la visita se quedaba confirmada para siempre y nadie sabia si
 * llego a ir.
 *
 * No hay sesion: la llave es el token de su cita, el mismo que abre /mi-cita.
 *
 * El boton del correo trae ya la respuesta en la direccion, pero **no se aplica
 * al abrir**: los lectores de correo abren solos los enlaces para comprobarlos,
 * y una visita no puede quedar cerrada como «no fue» porque un antivirus haya
 * mirado el mensaje. Por eso se enseña marcada, se confirma, y entonces se
 * manda.
 */

const API = "/api/visit-availability";

const ZONA = "Europe/Madrid";
const fmtDia = (iso) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });

/** Las tres respuestas, en el orden en que se leen: de peor a mejor. */
const RESPUESTAS = [
  { valor: "no_fue", texto: "No pude ir",             pie: "No llegaste a ver el coche" },
  { valor: "fue",    texto: "Lo vi y no me lo quedé", pie: "Fuiste, lo viste y lo dejaste pasar" },
  { valor: "compro", texto: "Me lo quedé",            pie: "Te lo llevaste" },
];

const esRespuesta = (v) => RESPUESTAS.some((r) => r.valor === v);

function Logo() {
  return (
    <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: "var(--gris-900)", letterSpacing: "-.3px" }}>
        <span style={{ color: "var(--marca, #FFC400)" }}>Pop</span>Car
      </span>
    </div>
  );
}

export default function ComoFuePage() {
  const params    = new URLSearchParams(window.location.search);
  const bookingId = params.get("id") || "";
  const token     = params.get("token") || "";
  // La que traia el boton del correo. Solo la deja marcada.
  const sugerida  = params.get("r") || "";

  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState("");
  const [booking, setBooking]   = useState(null);
  const [elegida, setElegida]   = useState(esRespuesta(sugerida) ? sugerida : "");
  const [mandando, setMandando] = useState(false);
  const [hecha, setHecha]       = useState(false);

  useEffect(() => {
    if (!bookingId || !token) { setError("El enlace no está completo."); setCargando(false); return; }
    (async () => {
      try {
        const r = await fetch(`${API}?route=booking_detail&bookingId=${encodeURIComponent(bookingId)}&token=${encodeURIComponent(token)}`);
        const d = await r.json();
        if (!d.ok) { setError(d.error || "No hemos encontrado tu cita."); return; }
        setBooking(d.booking);
      } catch (e) {
        setError("No hemos podido cargar tu cita.");
      } finally {
        setCargando(false);
      }
    })();
  }, [bookingId, token]);

  async function confirma() {
    if (!elegida) return;
    setMandando(true);
    setError("");
    try {
      const r = await fetch(`${API}?route=como_fue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, token, resultado: elegida }),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error || "No hemos podido guardar tu respuesta."); return; }
      setHecha(true);
    } catch (e) {
      setError("No hemos podido guardar tu respuesta.");
    } finally {
      setMandando(false);
    }
  }

  const F = styles;
  const coche = booking?.vehicle_title || "el vehículo";
  const verMiCita = `/mi-cita?id=${encodeURIComponent(bookingId)}&token=${encodeURIComponent(token)}`;

  if (cargando) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center", padding: "32px 0", color: "var(--gris-400)", fontSize: 14 }}>Cargando…</div>
    </div></div>
  );

  if (hecha) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🙏</div>
        <div style={F.title}>Gracias</div>
        <div style={F.sub}>
          {elegida === "compro"
            ? "Enhorabuena por el coche. Si necesitas algo con el papeleo o el seguro, escríbenos."
            : "Nos ayuda a saber con quién seguimos contando. Si quieres ver otros coches, aquí estamos."}
        </div>
      </div>
      <a href="/marketplace-vo" style={F.btnPrimary}>Ver más coches →</a>
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

  // Ya la cerro alguien. Puede haber sido el mismo desde otro correo, o un
  // trabajador que hablo con quien tiene el coche: en los dos casos, no se le
  // vuelve a preguntar.
  if (booking?.resultado) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={F.title}>Ya lo teníamos apuntado</div>
        <div style={F.sub}>Gracias de todas formas. Si algo no cuadra, respóndenos al correo y lo miramos.</div>
        <a href={verMiCita} style={F.btnPrimary}>Ver mi cita →</a>
      </div>
    </div></div>
  );

  if (booking && booking.status !== "confirmed") return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={F.title}>Esta visita no llegó a ser</div>
        <div style={F.sub}>
          {booking.status === "cancelled"
            ? "Se canceló. Puedes pedir otra desde la ficha del coche."
            : "Todavía estaba por confirmar, así que no hay nada que contar."}
        </div>
        <a href={verMiCita} style={F.btnPrimary}>Ver mi cita →</a>
      </div>
    </div></div>
  );

  // Una visita que todavia no ha sido: el correo no deberia haber salido, pero
  // el enlace se puede abrir a mano.
  if (booking && new Date(booking.starts_at).getTime() > Date.now()) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={F.title}>Tu visita todavía no ha sido</div>
        <div style={F.sub}>Es el {fmtDia(booking.starts_at)}. Te preguntamos después.</div>
        <a href={verMiCita} style={F.btnPrimary}>Ver mi cita →</a>
      </div>
    </div></div>
  );

  return (
    <div style={F.page}>
      <div style={F.card}>
        <Logo />
        <div style={F.title}>¿Qué tal fue la visita?</div>
        <div style={F.sub}>
          Con un toque nos vale. Nos sirve para saber si hay que seguir contando con quien tiene
          el coche.
        </div>
        <div style={F.vehicleTitle}>{coche}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {RESPUESTAS.map((r) => (
            <button key={r.valor} type="button" onClick={() => setElegida(r.valor)} style={{
              ...F.opcion,
              ...(elegida === r.valor ? F.opcionActiva : null),
            }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{r.texto}</span>
              <span style={{ fontSize: 12, color: "var(--gris-400)" }}>{r.pie}</span>
            </button>
          ))}
        </div>

        {error && <div style={F.errMsg}>{error}</div>}

        <button onClick={confirma} disabled={!elegida || mandando} style={{
          ...F.btnPrimary,
          opacity: !elegida || mandando ? 0.5 : 1,
          cursor: !elegida || mandando ? "default" : "pointer",
        }}>
          {mandando ? "Guardando…" : "Enviar"}
        </button>

        <div style={{ fontSize: 12, color: "var(--gris-400)", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
          Esto no compromete a nada. Si prefieres contárnoslo con más detalle, responde al correo.
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

  opcion:        { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, width: "100%", background: "#fff", border: "1.5px solid var(--gris-200)", borderRadius: 12, padding: "14px 18px", color: "var(--gris-900)", cursor: "pointer", textAlign: "left" },
  opcionActiva:  { background: "var(--acento-tenue)", borderColor: "var(--marca, #FFC400)", boxShadow: "0 0 0 3px rgba(255,196,0,.18)" },

  btnPrimary:    { display: "block", width: "100%", background: "linear-gradient(135deg, var(--gris-700), var(--gris-900))", color: "#fff", textDecoration: "none", padding: "13px 0", borderRadius: 10, fontWeight: 800, fontSize: 15, textAlign: "center", border: "none", cursor: "pointer", boxSizing: "border-box", marginTop: 4 },
  errMsg:        { background: "var(--gris-100)", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 },
};
