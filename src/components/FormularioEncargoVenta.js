import { useState } from "react";
import { PLAZOS, faltaParaMandarlo, loQueSeManda } from "../utils/encargoDeVentaWeb";

/**
 * El formulario de «Nosotros lo vendemos por ti».
 *
 * Cinco campos y ninguno de relleno. Antes este botón llevaba al formulario de
 * contacto general, que pedía nombre, apellido, correo, teléfono y un mensaje
 * libre — y no preguntaba **ni qué coche ni en cuánto tiempo**, que es
 * exactamente lo que el botón prometía preguntar.
 *
 * El coche va como texto libre y no en tres desplegables: quien está decidiendo
 * si nos deja su coche no rellena marca, modelo y año. Vale la matrícula y vale
 * «un Golf del 15»; lo demás se pregunta en la llamada, que va a haber igual.
 */
export default function FormularioEncargoVenta({ onHecho }) {
  const [datos, setDatos] = useState({
    coche: "", plazo: "", nombre: "", telefono: "", email: "",
  });
  const [fallo, setFallo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  const pon = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  async function manda() {
    const falta = faltaParaMandarlo(datos);
    if (falta) { setFallo(falta); return; }

    setEnviando(true);
    setFallo("");
    try {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loQueSeManda(datos)),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFallo(d.error || "No hemos podido enviarlo. Inténtalo en un momento.");
        return;
      }
      setHecho(true);
      if (onHecho) onHecho();
    } catch {
      setFallo("No hemos podido enviarlo. Comprueba tu conexión.");
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <div className="fev-hecho">
        <div className="fev-hecho-icono">✅</div>
        <div className="fev-hecho-titulo">Hecho. Te llamamos nosotros.</div>
        <p className="fev-hecho-texto">
          Te llamamos al {datos.telefono} en menos de 24 horas laborables para contarte
          a qué precio se está vendiendo tu coche y cómo lo haríamos. No tienes que
          hacer nada más, y no hay ningún compromiso.
        </p>
      </div>
    );
  }

  return (
    <div className="fev-caja">
      <div className="fev-campo">
        <label htmlFor="fev-coche">¿Qué coche quieres vender?</label>
        <input
          id="fev-coche" value={datos.coche} onChange={pon("coche")}
          placeholder="Seat Ibiza 2019, o su matrícula"
        />
      </div>

      <div className="fev-campo">
        <label htmlFor="fev-plazo">¿En cuánto tiempo?</label>
        <select id="fev-plazo" value={datos.plazo} onChange={pon("plazo")}>
          <option value="">Elige…</option>
          {PLAZOS.map((p) => (
            <option key={p.clave} value={p.clave}>{p.etiqueta}</option>
          ))}
        </select>
      </div>

      <div className="fev-dos">
        <div className="fev-campo">
          <label htmlFor="fev-nombre">Tu nombre</label>
          <input id="fev-nombre" value={datos.nombre} onChange={pon("nombre")} placeholder="Ana García" />
        </div>
        <div className="fev-campo">
          <label htmlFor="fev-tel">Teléfono</label>
          <input id="fev-tel" type="tel" value={datos.telefono} onChange={pon("telefono")}
                 placeholder="600 000 000" />
        </div>
      </div>

      <div className="fev-campo">
        <label htmlFor="fev-email">Correo</label>
        <input id="fev-email" type="email" value={datos.email} onChange={pon("email")}
               placeholder="tu@correo.com" />
      </div>

      {fallo && <div className="fev-fallo">{fallo}</div>}

      <button className="btn-gold fev-boton" type="button" onClick={manda} disabled={enviando}>
        {enviando ? "Enviando…" : "Quiero vender mi coche"}
        <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
      </button>

      {/*
        * Los tres números del trato, aquí y no en la llamada.
        *
        * «No adelantas un euro» es lo mejor que hay que contar y estaba
        * escondido hasta que alguien cogía el teléfono. Enseñarlo aquí hace que
        * la llamada empiece con un argumento en vez de con una sorpresa.
        */}
      <p className="fev-letra">
        Cero euros por delante. Se cobran <strong>299 €</strong> solo si vendemos tu coche.
        El encargo dura <strong>30 días</strong> en exclusiva y puedes cancelarlo cuando
        quieras: si vendes por tu cuenta antes de que se cumplan, son 150 €.
      </p>
    </div>
  );
}
