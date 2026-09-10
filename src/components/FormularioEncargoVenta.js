import { useState, useEffect } from "react";
import { PLAZOS, faltaParaMandarlo, loQueSeManda } from "../utils/encargoDeVentaWeb";
import { getGarageVehiclesJson } from "../utils/apiClient";

/**
 * El formulario de «Nosotros lo vendemos por ti».
 *
 * Cinco campos y ninguno de relleno. Antes este botón llevaba al formulario de
 * contacto general, que pedía nombre, apellido, correo, teléfono y un mensaje
 * libre — y no preguntaba **ni qué coche ni en cuánto tiempo**, que es
 * exactamente lo que el botón prometía preguntar.
 *
 * ## Qué coche es, dicho por quien lo sabe
 *
 * Si ha entrado, elige el coche de una lista: los suyos, los que ya tiene dados
 * de alta. Escrito a mano —«Volkswagen T-Roc R line 2022»— no identifica nada:
 * con un coche se adivina y con tres no, y quien lo tiene que adivinar es el
 * que coge el teléfono, que es justo quien menos lo sabe.
 *
 * Si ha entrado y no tiene ninguno, se le dice que lo dé de alta y se le lleva
 * ahí. No se le puede pedir después: el coche lo sube él, con sus fotos y sus
 * papeles.
 *
 * Y si **no ha entrado**, texto libre, como hasta ahora. Obligarle a registrarse
 * para pedir presupuesto es el mismo error que el candado de las visitas: se
 * pierde a la mayoría en la puerta. De esos, cuál es el coche se averigua en la
 * llamada, que es lo que pasaba siempre.
 */
export default function FormularioEncargoVenta({ userEmail = "" }) {
  const [datos, setDatos] = useState({
    coche: "", plazo: "", nombre: "", telefono: "", email: "",
    vehicleId: "",
  });
  const [misCoches, setMisCoches] = useState(null);
  const [fallo, setFallo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  const haySesion = Boolean(String(userEmail || "").trim());

  useEffect(() => {
    if (!haySesion) { setMisCoches([]); return; }
    let tirado = false;
    (async () => {
      try {
        const { response, data } = await getGarageVehiclesJson(userEmail);
        if (tirado) return;
        setMisCoches(response.ok && Array.isArray(data?.vehicles) ? data.vehicles : []);
      } catch {
        // Sin lista se sigue con texto libre: es peor no poder pedirlo.
        if (!tirado) setMisCoches([]);
      }
    })();
    return () => { tirado = true; };
  }, [userEmail, haySesion]);

  const pon = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  /** Al elegir de la lista se rellena también el texto, que es lo que se lee. */
  const eligeCoche = (e) => {
    const id = e.target.value;
    const suyo = (misCoches || []).find((v) => String(v.id) === id);
    setDatos((d) => ({
      ...d,
      vehicleId: id,
      coche: suyo ? comoSeLlama(suyo) : d.coche,
    }));
  };

  async function manda() {
    const falta = faltaParaMandarlo(datos);
    if (falta) { setFallo(falta); return; }

    setEnviando(true);
    setFallo("");
    try {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...loQueSeManda(datos),
          // Cuál de sus coches es, cuando lo ha elegido él.
          vehicle_id: datos.vehicleId || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFallo(d.error || "No hemos podido enviarlo. Inténtalo en un momento.");
        return;
      }
      setHecho(true);
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

  // Ha entrado y no tiene ningún coche dado de alta: eso hay que resolverlo
  // antes, y no en la llamada — el coche lo sube él.
  const sinCoches = haySesion && Array.isArray(misCoches) && misCoches.length === 0;

  return (
    <div className="fev-caja">
      {sinCoches ? (
        <div className="fev-aviso">
          <strong>Primero da de alta tu coche</strong>
          <p>
            Para que lo vendamos por ti necesitamos su ficha: matrícula, fotos y papeles.
            Se crea en un momento desde tu panel y luego vuelves aquí.
          </p>
          <a className="fev-aviso-boton" href="/panel/vehiculos">Dar de alta mi coche</a>
          <a className="fev-aviso-guia" href="/como-subir-tu-coche">O mira antes cómo se hace</a>
        </div>
      ) : (
        <div className="fev-campo">
          <label htmlFor="fev-coche">¿Qué coche quieres vender?</label>
          {haySesion && misCoches && misCoches.length > 0 ? (
            <select id="fev-coche" value={datos.vehicleId} onChange={eligeCoche}>
              <option value="">Elige tu coche…</option>
              {misCoches.map((v) => (
                <option key={v.id} value={v.id}>{comoSeLlama(v)}</option>
              ))}
            </select>
          ) : (
            <input
              id="fev-coche" value={datos.coche} onChange={pon("coche")}
              placeholder="Seat Ibiza 2019, o su matrícula"
            />
          )}
        </div>
      )}

      {!sinCoches && (
        <>
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

          <button className="fev-boton" type="button" onClick={manda} disabled={enviando}>
            {enviando ? "Enviando…" : "Quiero vender mi coche"}
            <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>

          {/*
            * Los tres números del trato, aquí y no en la llamada.
            *
            * «No adelantas un euro» es lo mejor que hay que contar y estaba
            * escondido hasta que alguien cogía el teléfono. Enseñarlo aquí hace
            * que la llamada empiece con un argumento en vez de con una sorpresa.
            */}
          <p className="fev-letra">
            Cero euros por delante. Se cobran <strong>299 €</strong> solo si vendemos tu coche.
            Nos damos <strong>30 días</strong>: si aceptas nuestro precio y pasan sin venderlo,
            lo dejas sin pagar nada. Si te sales antes, son <strong>150 €</strong>.
          </p>
        </>
      )}
    </div>
  );
}

/** «Volkswagen T-Roc 2022 · 8888LXR», con lo que haya. */
function comoSeLlama(v) {
  const nombre = [v?.brand, v?.model, v?.year].filter(Boolean).join(" ")
    || String(v?.title || "").trim();
  const matricula = String(v?.plate || "").trim().toUpperCase();
  if (nombre && matricula) return `${nombre} · ${matricula}`;
  return nombre || matricula || "Mi coche";
}
