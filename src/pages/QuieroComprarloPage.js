import React, { useEffect, useState } from "react";
import { rutaApi } from "../utils/apiClient";

/**
 * «Quiero comprarlo»: la abre el comprador desde el correo de «¿te lo quedas?».
 *
 * Aquí empieza la compra del coche de un particular. Se le pide lo que hace
 * falta para el contrato y el cambio de nombre —DNI o NIE y domicilio— y si va
 * a financiarlo. Al enviarlo, el coche queda reservado para él.
 *
 * Sin sesión: la llave es el testigo de su cita. Y nada se hace al abrir el
 * enlace —los lectores de correo los abren solos—: se rellena y se envía.
 */

const API = rutaApi("/api/visit-availability");
const euros = (n) => (Number(n) > 0 ? `${Math.round(Number(n)).toLocaleString("es-ES")} €` : "");

function Logo() {
  return (
    <div style={{ marginBottom: 24 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: "var(--gris-900)", letterSpacing: "-.3px" }}>
        <span style={{ color: "var(--acento, #FFC400)" }}>Pop</span>Car
      </span>
    </div>
  );
}

export default function QuieroComprarloPage() {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("id") || "";
  const token = params.get("token") || "";

  const [cargando, setCargando] = useState(true);
  const [compra, setCompra] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ dni: "", direccion: "", codigoPostal: "", ciudad: "", financia: null });
  const [enviando, setEnviando] = useState(false);
  const [hecha, setHecha] = useState(false);

  useEffect(() => {
    if (!bookingId || !token) { setError("El enlace no está completo."); setCargando(false); return; }
    (async () => {
      try {
        const r = await fetch(`${API}?route=compra&bookingId=${encodeURIComponent(bookingId)}&token=${encodeURIComponent(token)}`);
        const d = await r.json();
        if (!d.ok) { setError(d.error || "No encontramos esa visita."); return; }
        setCompra(d);
      } catch {
        setError("No hemos podido cargar la compra.");
      } finally {
        setCargando(false);
      }
    })();
  }, [bookingId, token]);

  const cambia = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function envia() {
    setEnviando(true);
    setError("");
    try {
      const r = await fetch(`${API}?route=quiero_comprarlo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: "quiero_comprarlo", bookingId, token, ...form }),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.error || "No se ha podido guardar."); return; }
      setHecha(true);
    } catch {
      setError("No se ha podido guardar.");
    } finally {
      setEnviando(false);
    }
  }

  const F = styles;

  if (cargando) return <div style={F.page}><div style={F.card}><Logo /><div style={F.sub}>Cargando…</div></div></div>;

  if (!compra) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={F.title}>No encontramos esa visita</div>
      <div style={F.sub}>{error}</div>
    </div></div>
  );

  const cabecera = (
    <div style={F.cocheCard}>
      <div style={F.coche}>{compra.coche}</div>
      {compra.precio && <div style={F.precio}>{euros(compra.precio)}</div>}
    </div>
  );

  if (hecha || compra.ya_la_ha_pedido) {
    const financia = hecha ? form.financia : null;
    return (
      <div style={F.page}><div style={F.card}><Logo />
        <div style={F.title}>{hecha ? "¡Es tuyo! Nos ponemos con la compra" : "Ya nos has dicho que lo compras"}</div>
        {cabecera}
        <div style={F.sub}>El coche queda reservado para ti. Te hemos mandado un correo con los siguientes pasos.</div>
        <ol style={F.pasos}>
          {financia && <li>Estudiamos tu financiación con la entidad y te escribimos en cuanto conteste.</li>}
          <li>Haces el ingreso del precio{financia ? " (con la parte que financie la entidad)" : ""}.</li>
          <li>Nos ponemos con el cambio de nombre en Tráfico.</li>
          <li>Cuando esté a tu nombre, recoges el coche.</li>
        </ol>
      </div></div>
    );
  }

  if (compra.no_puede) return (
    <div style={F.page}><div style={F.card}><Logo />
      <div style={F.title}>No se puede comprar desde aquí</div>
      {cabecera}
      <div style={F.sub}>{compra.no_puede}</div>
    </div></div>
  );

  const listo = form.dni.trim() && form.direccion.trim() && form.codigoPostal.trim() && form.ciudad.trim() && form.financia !== null;

  return (
    <div style={F.page}>
      <div style={F.card}>
        <Logo />
        <div style={F.title}>Quiero comprarlo</div>
        <div style={F.sub}>Necesitamos estos datos para el contrato y el cambio de nombre. Al enviarlos, te reservamos el coche.</div>
        {cabecera}

        <div style={{ display: "grid", gap: 12 }}>
          <label style={F.label}>DNI o NIE
            <input style={F.input} value={form.dni} onChange={cambia("dni")} placeholder="12345678Z" autoComplete="off" />
          </label>
          <label style={F.label}>Dirección
            <input style={F.input} value={form.direccion} onChange={cambia("direccion")} placeholder="Calle, número, piso" autoComplete="street-address" />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ ...F.label, width: 120 }}>Código postal
              <input style={F.input} value={form.codigoPostal} onChange={cambia("codigoPostal")} placeholder="28001" inputMode="numeric" autoComplete="postal-code" />
            </label>
            <label style={{ ...F.label, flex: 1 }}>Ciudad
              <input style={F.input} value={form.ciudad} onChange={cambia("ciudad")} placeholder="Madrid" autoComplete="address-level2" />
            </label>
          </div>

          <fieldset style={F.fieldset}>
            <legend style={F.legend}>¿Vas a financiarlo?</legend>
            <div style={{ display: "flex", gap: 10 }}>
              {[[true, "Sí, quiero financiar"], [false, "No, lo pago yo"]].map(([valor, texto]) => (
                <label key={texto} style={{ ...F.opcion, ...(form.financia === valor ? F.opcionActiva : null) }}>
                  <input type="radio" name="financia" checked={form.financia === valor}
                         onChange={() => setForm((f) => ({ ...f, financia: valor }))} style={{ marginRight: 8 }} />
                  {texto}
                </label>
              ))}
            </div>
            {form.financia === true && (
              <div style={F.nota}>Primero estudiamos la financiación con la entidad. Hasta que conteste no tienes que pagar nada.</div>
            )}
          </fieldset>

          {error && <div style={F.errMsg}>{error}</div>}

          <button type="button" onClick={envia} disabled={!listo || enviando}
                  style={{ ...F.btnPrimary, opacity: !listo || enviando ? 0.5 : 1 }}>
            {enviando ? "Enviando…" : "Quiero comprarlo"}
          </button>
          <div style={F.letraPequena}>Tus datos solo se usan para el contrato y el cambio de nombre del coche.</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "var(--gris-50)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { background: "#fff", borderRadius: 20, boxShadow: "0 8px 48px rgba(0,0,0,.1)", padding: "32px 28px", maxWidth: 480, width: "100%", boxSizing: "border-box" },
  title: { fontSize: 22, fontWeight: 800, color: "var(--gris-900)", marginBottom: 6, textAlign: "center" },
  sub: { fontSize: 14, color: "var(--gris-500)", margin: "0 0 16px", lineHeight: 1.6, textAlign: "center" },
  cocheCard: { background: "linear-gradient(135deg, var(--acento-tenue), var(--gris-50))", border: "1.5px solid var(--gris-200)", borderRadius: 14, padding: 16, marginBottom: 18, textAlign: "center" },
  coche: { fontSize: 15, fontWeight: 700, color: "var(--gris-900)" },
  precio: { fontSize: 24, fontWeight: 800, color: "var(--gris-900)", marginTop: 4 },
  label: { display: "grid", gap: 5, fontSize: 13, fontWeight: 600, color: "var(--gris-700)" },
  input: { border: "1.5px solid var(--gris-200)", borderRadius: 10, padding: "10px 12px", fontSize: 15, color: "var(--gris-900)", boxSizing: "border-box", width: "100%", fontWeight: 400 },
  fieldset: { border: "none", padding: 0, margin: 0 },
  legend: { fontSize: 13, fontWeight: 600, color: "var(--gris-700)", marginBottom: 6 },
  opcion: { flex: 1, display: "flex", alignItems: "center", border: "1.5px solid var(--gris-200)", borderRadius: 10, padding: "10px 12px", fontSize: 14, cursor: "pointer", color: "var(--gris-900)" },
  opcionActiva: { borderColor: "var(--acento, #FFC400)", background: "var(--acento-tenue)" },
  nota: { fontSize: 12.5, color: "var(--gris-600)", marginTop: 8, lineHeight: 1.5 },
  pasos: { fontSize: 14, color: "var(--gris-700)", lineHeight: 1.7, paddingLeft: 20, margin: 0 },
  btnPrimary: { display: "block", width: "100%", background: "linear-gradient(135deg, var(--gris-700), var(--gris-900))", color: "#fff", padding: "13px 0", borderRadius: 10, fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer" },
  letraPequena: { fontSize: 11.5, color: "var(--gris-400)", textAlign: "center" },
  errMsg: { background: "var(--gris-100)", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13 },
};
