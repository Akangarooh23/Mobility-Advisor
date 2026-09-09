import { useEffect, useState, useRef } from "react";

/**
 * El enlace del correo, para quien pidió una visita sin tener cuenta.
 *
 * Aquí es donde la visita pasa de pedida a reservada. Hasta este clic el hueco
 * seguía libre para cualquiera, así que hay un desenlace que no es un fallo y
 * hay que contarlo bien: **que se lo haya llevado otro**. A esa persona no se
 * le puede enseñar un error rojo; se le dice qué ha pasado y se le manda a
 * elegir otra hora.
 */
export default function ConfirmarVisitaPage({ onIrAlCoche }) {
  const [estado, setEstado] = useState("confirmando"); // confirmando | hecha | ocupada | caducada | fallo
  const [mensaje, setMensaje] = useState("");
  const [oferta, setOferta] = useState("");
  const yaFue = useRef(false);

  useEffect(() => {
    // Una sola vez. Algunos clientes de correo abren el enlace ellos solos para
    // previsualizarlo, y en modo desarrollo React monta dos veces: sin esto se
    // pediría confirmar dos veces el mismo token.
    if (yaFue.current) return;
    yaFue.current = true;

    const token = new URLSearchParams(window.location.search).get("t") || "";
    if (!token) { setEstado("caducada"); return; }

    fetch("/api/visit-availability?route=confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route: "confirmar", token }),
    })
      .then(async (r) => ({ codigo: r.status, cuerpo: await r.json().catch(() => ({})) }))
      .then(({ codigo, cuerpo }) => {
        if (cuerpo.ok) { setEstado("hecha"); return; }
        setMensaje(cuerpo.error || "");
        setOferta(cuerpo.offerId || "");
        if (codigo === 409) setEstado("ocupada");
        else if (codigo === 410) setEstado("caducada");
        else setEstado("fallo");
      })
      .catch(() => setEstado("fallo"));
  }, []);

  const caja = {
    maxWidth: 520, margin: "60px auto", padding: "32px 28px", textAlign: "center",
    border: "1px solid rgba(150,150,143,0.25)", borderRadius: 16, background: "var(--blanco)",
  };
  const titulo = { fontSize: 20, fontWeight: 800, color: "var(--gris-900)", margin: "0 0 8px" };
  const texto = { fontSize: 14, color: "var(--gris-500)", lineHeight: 1.55, margin: 0 };

  if (estado === "confirmando") {
    return (
      <div style={caja}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>⏳</div>
        <h1 style={titulo}>Confirmando tu visita</h1>
        <p style={texto}>Un momento.</p>
      </div>
    );
  }

  if (estado === "hecha") {
    return (
      <div style={caja}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>✅</div>
        <h1 style={titulo}>Visita pedida</h1>
        {/*
          * «Pedida», no «confirmada». Toda visita nace pendiente de que alguien
          * hable con quien tiene el coche; decirle aquí que está confirmada
          * sería prometerle una hora que todavía no ha acordado nadie.
          */}
        <p style={texto}>
          Ya tenemos tu solicitud y hemos avisado a quien vende el coche. Te escribimos
          en cuanto esté confirmada la hora. Lo tienes todo en el correo que te acabamos
          de mandar.
        </p>
      </div>
    );
  }

  if (estado === "ocupada") {
    return (
      <div style={caja}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🕐</div>
        <h1 style={titulo}>Esa hora ya la ha cogido otro</h1>
        <p style={texto}>
          {mensaje || "Se te ha adelantado alguien. Elige otra y te la guardamos."}
        </p>
        {oferta && onIrAlCoche && (
          <button className="cw-btn-acento" style={{ cursor: "pointer", marginTop: 18 }}
                  onClick={() => onIrAlCoche(oferta)}>
            Elegir otra hora
          </button>
        )}
      </div>
    );
  }

  if (estado === "caducada") {
    return (
      <div style={caja}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🔗</div>
        <h1 style={titulo}>Este enlace ya no vale</h1>
        <p style={texto}>
          {mensaje || "Pide la visita otra vez desde la ficha del coche y te mandamos uno nuevo."}
        </p>
      </div>
    );
  }

  return (
    <div style={caja}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>⚠️</div>
      <h1 style={titulo}>No hemos podido confirmarla</h1>
      <p style={texto}>
        Ha fallado algo por nuestra parte. Vuelve a pulsar el enlace del correo dentro
        de un rato, o pide la visita otra vez desde la ficha del coche.
      </p>
    </div>
  );
}
