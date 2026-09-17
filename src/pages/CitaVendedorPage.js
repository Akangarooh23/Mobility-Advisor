import React, { useEffect, useState } from "react";
import { rutaApi } from "../utils/apiClient";
import { horaDeLaVisita } from "../utils/horaDeLaVisita";

/**
 * La página donde el dueño de un coche contesta una visita.
 *
 * En el coche de un particular, la visita la confirma él —es quien enseña el
 * coche, en su casa y a su hora—, no nosotros desde el ERP. Le llega un correo
 * con este enlace y aquí puede:
 *
 *   · confirmarla, diciendo dónde es;
 *   · proponer otras horas, que el comprador elige desde su correo;
 *   · o rechazarla, y al comprador se le dice que elija otra.
 *
 * Sin sesión: la llave es el testigo del vendedor, que solo va en su correo. Y
 * nada se aplica al abrir el enlace —los lectores de correo los abren solos—:
 * se pulsa y entonces se manda.
 */

const API = rutaApi("/api/visit-availability");
const ZONA = "Europe/Madrid";
const fmtDia = (iso) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });
const fmtHora = (iso) =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });
const fmtFranja = (a, b) => horaDeLaVisita(a, b, fmtHora);

/** Una hora escrita en el formulario —día y hora de Madrid— como instante. */
function aInstante(dia, hora) {
  if (!dia || !hora) return "";
  // El navegador puede no estar en Madrid: se calcula el desfase de ese día.
  const local = new Date(`${dia}T${hora}:00Z`);
  if (Number.isNaN(local.getTime())) return "";
  const enMadrid = new Date(local.toLocaleString("en-US", { timeZone: ZONA }));
  const enUtc = new Date(local.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(local.getTime() - (enMadrid.getTime() - enUtc.getTime())).toISOString();
}

function Logo() {
  return (
    <div style={{ marginBottom: 24 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: "var(--gris-900)", letterSpacing: "-.3px" }}>
        <span style={{ color: "var(--acento, #FFC400)" }}>Pop</span>Car
      </span>
    </div>
  );
}

export default function CitaVendedorPage() {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("id") || "";
  const token = params.get("token") || "";

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [visita, setVisita] = useState(null);
  const [propuestas, setPropuestas] = useState([]);
  const [modo, setModo] = useState("");
  const [donde, setDonde] = useState("");
  const [preguntarPor, setPreguntarPor] = useState("");
  const [horas, setHoras] = useState([{ dia: "", hora: "" }]);
  const [mandando, setMandando] = useState(false);
  const [hecho, setHecho] = useState("");

  useEffect(() => {
    if (!bookingId || !token) { setError("El enlace no está completo."); setCargando(false); return; }
    (async () => {
      try {
        const r = await fetch(`${API}?route=vendedor&bookingId=${encodeURIComponent(bookingId)}&token=${encodeURIComponent(token)}`);
        const d = await r.json();
        if (!d.ok) { setError(d.error || "No encontramos esa visita."); return; }
        setVisita(d.booking);
        setPropuestas(d.horas_propuestas || []);
        setDonde(d.booking.meeting_place || d.donde_sugerido || "");
        setPreguntarPor(d.booking.meeting_contact || "");
      } catch {
        setError("No hemos podido cargar la visita.");
      } finally {
        setCargando(false);
      }
    })();
  }, [bookingId, token]);

  async function manda(route, cuerpo, siSale) {
    setMandando(true);
    setError("");
    try {
      const r = await fetch(`${API}?route=${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, bookingId, token, ...cuerpo }),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error || "No se ha podido guardar."); return; }
      setHecho(siSale);
    } catch {
      setError("No se ha podido guardar.");
    } finally {
      setMandando(false);
    }
  }

  const F = styles;

  if (cargando) return <div style={F.page}><div style={F.card}><Logo /><div style={F.sub}>Cargando…</div></div></div>;

  if (!visita) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={F.title}>No encontramos esa visita</div>
      <div style={F.sub}>{error}</div>
    </div></div>
  );

  const cabecera = (
    <>
      <div style={F.vehicleTitle}>{visita.vehicle_title || "Tu coche"}</div>
      <div style={F.dateCard}>
        <div style={F.dateCardLabel}>{visita.status === "confirmed" ? "Visita confirmada" : "Quiere verlo"}</div>
        <div style={F.dateCardDate}>{fmtDia(visita.starts_at)}</div>
        <div style={F.dateCardTime}>{fmtFranja(visita.starts_at, visita.ends_at)}</div>
        {visita.buyer_name && <div style={F.quien}>Viene {visita.buyer_name}</div>}
        {visita.notes && <div style={F.nota}>«{visita.notes}»</div>}
      </div>
    </>
  );

  if (hecho) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={{ textAlign: "center" }}>
        <div style={F.title}>{hecho}</div>
        <div style={F.sub}>
          {hecho === "Visita confirmada"
            ? "Os hemos mandado el correo con el calendario a los dos."
            : hecho === "Horas propuestas"
              ? "Le hemos mandado las horas. Cuando elija una, te llega la confirmación."
              : "Le hemos dicho que elija otra hora de las que tienes libres."}
        </div>
      </div>
      {cabecera}
    </div></div>
  );

  if (visita.status === "cancelled") return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={F.title}>Esta visita está cancelada</div>
      {cabecera}
    </div></div>
  );

  if (visita.status === "confirmed") return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={F.title}>Esta visita ya está confirmada</div>
      {cabecera}
      {visita.meeting_place && <div style={F.sub}>Dónde: {visita.meeting_place}</div>}
      {error && <div style={F.errMsg}>{error}</div>}
      <button type="button" disabled={mandando} style={F.btnSecundario}
        onClick={() => { if (window.confirm("¿Cancelar esta visita? Se lo decimos al comprador.")) manda("cancel", {}, "Visita cancelada"); }}>
        Al final no puedo: cancelarla
      </button>
    </div></div>
  );

  const pasadas = new Date(visita.starts_at).getTime() < Date.now();
  const horasValidas = horas.map((h) => aInstante(h.dia, h.hora)).filter(Boolean);

  return (
    <div style={F.page}>
      <div style={F.card}>
        <Logo />
        <div style={F.title}>Alguien quiere ver tu coche</div>
        <div style={F.sub}>Dinos si te viene bien. Hasta que no contestes, al comprador no le damos la visita por hecha.</div>
        {cabecera}

        {propuestas.length > 0 && (
          <div style={F.aviso}>
            Ya le propusiste otras horas: {propuestas.map((h) => `${fmtDia(h)} a las ${fmtHora(h)}`).join(", ")}. Si elige una, te llega la confirmación.
          </div>
        )}

        {error && <div style={F.errMsg}>{error}</div>}

        {!modo && (
          <div style={{ display: "grid", gap: 10 }}>
            <button type="button" style={F.btnPrimary} disabled={pasadas} onClick={() => setModo("confirmar")}>Me viene bien: confirmarla</button>
            <button type="button" style={F.btnSecundario} onClick={() => setModo("proponer")}>No puedo: proponer otra hora</button>
            <button type="button" style={F.btnTexto} disabled={mandando}
              onClick={() => { if (window.confirm("¿Rechazar esta visita? Le diremos que elija otra hora de las que tienes libres.")) manda("cancel", {}, "Visita rechazada"); }}>
              Rechazarla sin proponer nada
            </button>
          </div>
        )}

        {modo === "confirmar" && (
          <div style={{ display: "grid", gap: 10 }}>
            <label style={F.label} htmlFor="cv-donde">Dónde es la visita</label>
            <input id="cv-donde" style={F.input} value={donde} onChange={(e) => setDonde(e.target.value)} placeholder="Calle, número y ciudad" />
            <label style={F.label} htmlFor="cv-quien">Por quién tiene que preguntar (opcional)</label>
            <input id="cv-quien" style={F.input} value={preguntarPor} onChange={(e) => setPreguntarPor(e.target.value)} placeholder="Tu nombre" />
            <button type="button" style={{ ...F.btnPrimary, opacity: mandando || !donde.trim() ? 0.5 : 1 }} disabled={mandando || !donde.trim()}
              onClick={() => manda("vendedor_confirma", { donde, preguntarPor }, "Visita confirmada")}>
              {mandando ? "Confirmando…" : "Confirmar la visita"}
            </button>
            <button type="button" style={F.btnTexto} onClick={() => setModo("")}>Volver</button>
          </div>
        )}

        {modo === "proponer" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={F.label}>Propón hasta tres horas. Le llegan por correo y elige una.</div>
            {horas.map((h, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <input type="date" aria-label={`Día ${i + 1}`} style={{ ...F.input, flex: 1 }} value={h.dia}
                  onChange={(e) => setHoras((xs) => xs.map((x, j) => (j === i ? { ...x, dia: e.target.value } : x)))} />
                <input type="time" aria-label={`Hora ${i + 1}`} style={{ ...F.input, width: 110 }} value={h.hora}
                  onChange={(e) => setHoras((xs) => xs.map((x, j) => (j === i ? { ...x, hora: e.target.value } : x)))} />
              </div>
            ))}
            {horas.length < 3 && (
              <button type="button" style={F.btnTexto} onClick={() => setHoras((xs) => [...xs, { dia: "", hora: "" }])}>+ Añadir otra hora</button>
            )}
            <button type="button" style={{ ...F.btnPrimary, opacity: mandando || !horasValidas.length ? 0.5 : 1 }} disabled={mandando || !horasValidas.length}
              onClick={() => manda("vendedor_propone", { horas: horasValidas }, "Horas propuestas")}>
              {mandando ? "Enviando…" : "Enviarle estas horas"}
            </button>
            <button type="button" style={F.btnTexto} onClick={() => setModo("")}>Volver</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "var(--gris-50)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { background: "#fff", borderRadius: 20, boxShadow: "0 8px 48px rgba(0,0,0,.1)", padding: "32px 28px", maxWidth: 460, width: "100%", boxSizing: "border-box" },
  title: { fontSize: 22, fontWeight: 800, color: "var(--gris-900)", marginBottom: 6, textAlign: "center" },
  sub: { fontSize: 14, color: "var(--gris-500)", marginBottom: 18, lineHeight: 1.6, textAlign: "center" },
  vehicleTitle: { fontSize: 16, fontWeight: 700, color: "var(--gris-900)", textAlign: "center", marginBottom: 12 },
  dateCard: { background: "linear-gradient(135deg, var(--acento-tenue), var(--gris-50))", border: "1.5px solid var(--gris-200)", borderRadius: 14, padding: 18, marginBottom: 16, textAlign: "center" },
  dateCardLabel: { fontSize: 11, fontWeight: 700, color: "var(--gris-400)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 },
  dateCardDate: { fontSize: 15, fontWeight: 700, color: "var(--gris-900)", marginBottom: 4, textTransform: "capitalize" },
  dateCardTime: { fontSize: 22, fontWeight: 800, color: "var(--gris-900)" },
  quien: { fontSize: 13, color: "var(--gris-700)", marginTop: 8 },
  nota: { fontSize: 13, color: "var(--gris-500)", marginTop: 4, fontStyle: "italic" },
  aviso: { background: "var(--gris-50)", border: "1px solid var(--gris-200)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "var(--gris-700)", marginBottom: 14, lineHeight: 1.5 },
  label: { fontSize: 13, fontWeight: 600, color: "var(--gris-700)" },
  input: { border: "1.5px solid var(--gris-200)", borderRadius: 10, padding: "10px 12px", fontSize: 15, color: "var(--gris-900)", boxSizing: "border-box", width: "100%" },
  btnPrimary: { display: "block", width: "100%", background: "linear-gradient(135deg, var(--gris-700), var(--gris-900))", color: "#fff", padding: "13px 0", borderRadius: 10, fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer" },
  btnSecundario: { display: "block", width: "100%", background: "#fff", color: "var(--gris-900)", padding: "12px 0", borderRadius: 10, fontWeight: 700, fontSize: 15, border: "1.5px solid var(--gris-300)", cursor: "pointer" },
  btnTexto: { background: "none", border: "none", color: "var(--gris-500)", fontSize: 13, cursor: "pointer", padding: 6, textDecoration: "underline" },
  errMsg: { background: "var(--gris-100)", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 },
};
