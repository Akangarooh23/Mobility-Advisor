import { useState, useEffect } from "react";
import { PLAZOS, faltaParaMandarlo, loQueSeManda, loQueLeQueda, GUIA, elAlta, elCocheQueDijo } from "../utils/encargoDeVentaWeb";
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
 * Si ha entrado y tiene coches, elige el suyo de una lista: ahí el coche está
 * identificado por su ficha, que es lo mejor que puede pasar.
 *
 * Si no, escribe **la matrícula**. Antes era texto libre, y «Volkswagen T-Roc R
 * line 2022» no identifica ningún coche: hay miles, y el que tiene que adivinar
 * cuál es es el que coge el teléfono — justo el que menos lo sabe. Con la
 * matrícula se sabe antes de marcar si ese coche ya tiene ficha.
 *
 * ## Por qué no se le obliga a nada
 *
 * Aquí no hay muro, ni de registro ni de ficha. Lo hubo para quien había
 * entrado sin coches —«primero da de alta tu coche»— y era peor de lo que
 * parecía: sin cuenta sí se podía preguntar, así que registrarse te lo ponía
 * más difícil.
 *
 * Y no conseguía lo que buscaba. La ficha —seis fotos, permiso, ficha técnica e
 * ITV— la hace él con el coche delante, y eso no lo hace nadie **antes** de que
 * le digan por cuánto se está vendiendo su coche. Lo hace cuando ya le interesa.
 * Poner esa puerta al principio no adelanta la ficha: quita la llamada, que es
 * lo único que convierte.
 *
 * La ficha sigue siendo obligatoria **para publicar**. Esas puertas están en el
 * ERP, son seis, y no se han tocado: sin ellas el servidor no deja sacar el
 * anuncio, ni aquí ni en coches.net.
 */
export default function FormularioEncargoVenta({ userEmail = "" }) {
  const [datos, setDatos] = useState({
    coche: "", matricula: "", plazo: "", nombre: "", telefono: "", email: "",
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
    /*
     * Lo que le queda por hacer depende de si sabemos que su coche existe.
     *
     * Aquí había un solo texto y decía «no tienes que hacer nada más». Para
     * quien no ha entrado eso no lo podemos sostener: no sabemos si tiene la
     * ficha creada, y si no la tiene, lo que le espera es justo lo contrario.
     * Prometérselo y pedírselo en la llamada es empezar la llamada mal.
     */
    const queda = loQueLeQueda({ haySesion, eligioUnCoche: Boolean(datos.vehicleId) });
    return (
      <div className="fev-hecho">
        <div className="fev-hecho-icono">✅</div>
        <div className="fev-hecho-titulo">Hecho. Te llamamos nosotros.</div>
        {/*
          * Se le repite qué coche dijo.
          *
          * Es el único sitio donde ve lo que escribió: si se equivocó al
          * teclear la matrícula, esta es la última oportunidad de que lo vea
          * antes de que alguien llame preguntando por un coche que no es suyo.
          *
          * Sin botón de corregir a propósito: el lead ya está mandado, y
          * rehacer el formulario después de enviarlo complica la pantalla para
          * algo que la llamada resuelve en diez segundos.
          */}
        <p className="fev-hecho-texto">
          Te llamamos al {datos.telefono}
          {elCocheQueDijo(datos) && <> por el <strong>{elCocheQueDijo(datos)}</strong></>}
          {' '}en menos de 24 horas laborables para contarte a qué precio se está
          vendiendo tu coche y cómo lo haríamos. {queda.texto}
        </p>
        {queda.guia && (
          <div className="fev-hecho-acciones">
            <a className="fev-hecho-boton" href={elAlta(datos.matricula)}>
              Crear la ficha de mi coche
            </a>
            <a className="fev-hecho-guia" href={GUIA}>O mira antes cómo se hace</a>
          </div>
        )}
      </div>
    );
  }

  /*
   * Aquí ya no hay bloqueo.
   *
   * Quien había entrado y no tenía ningún coche dado de alta se encontraba un
   * muro —«primero da de alta tu coche»— y no podía ni preguntar. Sin cuenta sí
   * podía: o sea que registrarse te lo ponía **más difícil**, que es lo
   * contrario de lo que se pretendía.
   *
   * Y lo que el muro buscaba no lo conseguía: la ficha la hace él, con el coche
   * delante, y eso no lo hace nadie antes de que le digan por cuánto se está
   * vendiendo su coche. Lo hace cuando ya le interesa. La ficha sigue siendo
   * obligatoria para publicar —esas puertas están en el ERP y no se han
   * tocado—, pero no para preguntar.
   */
  const tieneCoches = haySesion && Array.isArray(misCoches) && misCoches.length > 0;

  return (
    <div className="fev-caja">
      <div className="fev-campo">
        <label htmlFor="fev-coche">¿Qué coche quieres vender?</label>
        {tieneCoches ? (
          <select id="fev-coche" value={datos.vehicleId} onChange={eligeCoche}>
            <option value="">Elige tu coche…</option>
            {misCoches.map((v) => (
              <option key={v.id} value={v.id}>{comoSeLlama(v)}</option>
            ))}
          </select>
        ) : (
          <>
            {/*
              * La matrícula, no texto libre.
              *
              * «Volkswagen T-Roc R line 2022» no identifica ningún coche: hay
              * miles, y el que tiene que adivinar cuál es es el que coge el
              * teléfono. Con la matrícula se sabe antes de marcar si ese coche
              * ya tiene ficha o hay que pedirla.
              */}
            <input
              id="fev-coche"
              value={datos.matricula}
              onChange={pon("matricula")}
              placeholder="8888 LXR"
              autoCapitalize="characters"
              autoComplete="off"
            />
            {/*
              * Y la guía, también aquí.
              *
              * Vivía solo dentro del aviso de «no tienes coches», que únicamente
              * veía quien había entrado. Desde fuera no se llegaba a ella por
              * ningún lado — y de fuera es de donde viene el que llega de
              * coches.net.
              */}
            <p className="fev-nota">
              La de tu coche, para saber cuál es. Para venderlo necesitaremos
              también su ficha —fotos y papeles—;{" "}
              <a href={GUIA}>aquí se explica cómo se crea</a>.
            </p>
          </>
        )}
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
