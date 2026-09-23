import { useState } from "react";
import { rutaApi } from "../utils/apiClient";
/**
 * Lo que le falta al cliente para que podamos vender su coche.
 *
 * Las mismas cinco puertas que ve el ERP en el encargo, con el mismo semáforo,
 * y cada una cerrada llevando **a donde se hace**. Las calcula el servidor
 * (`lib/puertas-del-encargo.js`); aquí solo se pintan.
 *
 * ## Por qué se enseñan las cinco
 *
 * También las que ya están hechas. Enseñar solo lo que falta convierte cada
 * avance en una lista que se acorta sin decir hacia dónde: no se ve cuánto
 * queda ni cuánto se lleva andado, que es justo lo que sostiene a quien va por
 * la tercera de cinco.
 *
 * ## Y por qué la hecha no es un enlace
 *
 * Un enlace para algo que ya está hecho invita a volver a hacerlo. La fila
 * sigue ahí, en gris y con su marca, pero no se puede pulsar.
 */

/** El tic de una puerta abierta. */
function Hecha({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
         stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** El reloj de una que falta. */
function Pendiente({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
         stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/**
 * Y el sitio donde sube el mandato firmado.
 *
 * Antes se le pedía que contestara al correo con el papel. Entonces el papel se
 * quedaba en una bandeja de entrada y alguien tenía que acordarse de marcarlo a
 * mano en el ERP: mientras tanto el encargo decía «sin firmar» con el papel
 * firmado ya en nuestro poder — y sin mandato firmado no se le puede facturar
 * nada.
 *
 * Va como la primera fila de la lista y no en un recuadro aparte: en un recuadro,
 * el contador de arriba decía «te quedan 4 cosas» cuando le quedaban cinco, y la
 * que no contaba era la más importante — sin el mandato firmado no podemos
 * vender por él ni cobrarle nada.
 */
function SubirElMandato({ mandato, isDark, ruta = "/api/mandato-firmado", texto = "Subir el mandato firmado" }) {
  const [subiendo, setSubiendo] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [fallo, setFallo] = useState("");

  async function sube(archivo) {
    if (!archivo) return;
    setFallo("");
    setSubiendo(true);
    try {
      const contenido = await new Promise((ok, mal) => {
        const lector = new FileReader();
        lector.onload = () => ok(String(lector.result || "").split(",")[1] || "");
        lector.onerror = () => mal(new Error("no se ha podido leer"));
        lector.readAsDataURL(archivo);
      });
      const res = await fetch(rutaApi(ruta), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          encargo_id: mandato.encargo_id,
          nombre: archivo.name,
          tipo: archivo.type,
          contenido,
        }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok || !datos.ok) {
        setFallo(datos.detail || datos.error || "No se ha podido subir. Prueba otra vez.");
        return;
      }
      setHecho(true);
    } catch {
      setFallo("No se ha podido leer el archivo. Prueba con otro.");
    } finally {
      setSubiendo(false);
    }
  }

  if (hecho) {
    /*
     * Se dice aquí mismo y no se espera a recargar.
     *
     * Acaba de subirlo: si la fila siguiera diciendo «fírmalo y súbelo», lo
     * subiría otra vez pensando que no ha entrado.
     */
    return (
      <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#059669", marginTop: 4 }}>
        ✓ Recibido. Ya nos consta firmado
      </span>
    );
  }

  return (
    <span style={{ display: "block", marginTop: 4 }}>
      <label style={{
        display: "inline-block", padding: "5px 10px",
        background: "var(--marca)", color: "#fff", borderRadius: 8,
        fontSize: 12, fontWeight: 700, cursor: subiendo ? "wait" : "pointer",
      }}>
        {subiendo ? "Subiendo…" : texto}
        <input
          type="file"
          accept="application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
          disabled={subiendo}
          onChange={(e) => { void sube(e.target.files && e.target.files[0]); }}
          style={{ display: "none" }}
        />
      </label>
      <span style={{ display: "block", fontSize: 11.5, color: isDark ? "var(--gris-400)" : "#6b7280", marginTop: 4 }}>
        En PDF, Word o una foto del papel
      </span>
      {fallo && (
        <span style={{ display: "block", fontSize: 12, color: "#dc2626", marginTop: 6 }}>{fallo}</span>
      )}
    </span>
  );
}

/**
 * La cita del taller, para el que tiene que llevar el coche.
 *
 * La revisión mecánica es lo único de las seis puertas que ponemos nosotros, y
 * hasta ahora el cliente no la veía en ninguna parte: le llegaba un correo con
 * el día y ahí se acababa. Un correo se entierra en una bandeja de entrada; el
 * panel es donde vuelve a mirar el que no se acuerda de si era el jueves.
 *
 * Va **fuera de la lista de puertas** y debajo, a propósito. Esa lista es lo que
 * tiene que traer él, y su contador dice «te quedan dos cosas»: meter aquí algo
 * que ya está hecho por nuestra parte le sumaría una tarea que no es suya.
 *
 * La dirección puede no estar —hay talleres que todo el mundo ubica— y entonces
 * no se inventa: se calla esa línea.
 */
function LaCitaDelTaller({ cita, vehicleId, isDark }) {
  const [abierto, setAbierto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState("");
  const [fallo, setFallo] = useState("");

  /*
   * Lo que ya pidió, si lo pidió antes de recargar la página.
   *
   * Viene del servidor: sin esto, el que pide el cambio y vuelve mañana ve los
   * botones como si no hubiera dicho nada y lo pide otra vez.
   */
  const yaPidio = pedido || (cita && cita.cliente_pidio) || "";

  async function pide(que) {
    setEnviando(true);
    setFallo("");
    try {
      const res = await fetch(rutaApi("/api/cita-taller"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vehicle_id: vehicleId, pide: que, motivo }),
      });
      const dato = await res.json().catch(() => ({}));
      if (!res.ok || !dato?.ok) {
        setFallo(dato?.error || "No hemos podido apuntarlo. Prueba otra vez.");
        return;
      }
      setPedido(que);
      setAbierto("");
    } catch {
      setFallo("No hemos podido apuntarlo. Prueba otra vez.");
    } finally {
      setEnviando(false);
    }
  }

  if (!cita || !cita.cita_at) return null;

  const cuando = new Date(cita.cita_at);
  if (Number.isNaN(cuando.getTime())) return null;

  // En la hora de España, que es donde está el taller: quien lo mire desde
  // fuera vería una hora a la que no le espera nadie.
  const dia = cuando.toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid",
  });
  const hora = cuando.toLocaleTimeString("es-ES", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
  });

  return (
    <div style={{
      background: isDark ? "rgba(5,150,105,0.10)" : "rgba(5,150,105,0.06)",
      border: "1px solid rgba(5,150,105,0.25)", borderRadius: 10,
      padding: "12px 14px", marginBottom: 8,
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: isDark ? "var(--gris-100)" : "#1f2937", marginBottom: 4 }}>
        Tu coche tiene cita en el taller
      </div>
      <div style={{ fontSize: 13, color: isDark ? "var(--gris-200)" : "#374151", lineHeight: 1.5 }}>
        <strong>{cita.taller}</strong>
        {cita.direccion ? <><br />{cita.direccion}</> : null}
        <br />{dia} a las {hora}
      </div>
      <div style={{ fontSize: 12, color: isDark ? "var(--gris-400)" : "#6b7280", marginTop: 6, lineHeight: 1.45 }}>
        Es la revisión mecánica que nos permite anunciarlo como comprobado. Solo hay
        que acercarlo.
      </div>

      {/*
        * Y qué hacer si ese día no puede.
        *
        * Sin esto, el que no podía ir simplemente no iba: la cita seguía en pie
        * en nuestra pantalla, nadie la movía y el día señalado el coche no
        * aparecía. Decírnoslo tenía que ser más fácil que no decirlo.
        */}
      {yaPidio ? (
        <div style={{ fontSize: 12.5, fontWeight: 600, color: isDark ? "var(--gris-200)" : "#374151", marginTop: 10, lineHeight: 1.45 }}>
          {yaPidio === "cancelar"
            ? "Nos has pedido que la anulemos. Te llamamos para buscar otro momento."
            : "Nos has pedido cambiarla. Te llamamos con otra fecha."}
        </div>
      ) : abierto ? (
        <div style={{ marginTop: 10 }}>
          <label style={{ display: "block", fontSize: 12, color: isDark ? "var(--gris-300)" : "#4b5563", marginBottom: 4 }}>
            {abierto === "cancelar" ? "¿Por qué la anulamos?" : "¿Qué días te vendrían bien?"}
            <span style={{ color: isDark ? "var(--gris-500)" : "#9ca3af" }}> (opcional)</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={abierto === "cancelar" ? "Cuéntanos lo que ha pasado" : "Por ejemplo: por las tardes, o a partir del día 20"}
            style={{
              width: "100%", fontSize: 13, padding: "7px 9px", borderRadius: 8,
              border: "1px solid rgba(5,150,105,0.35)", resize: "vertical",
              background: isDark ? "rgba(0,0,0,0.25)" : "#fff",
              color: isDark ? "var(--gris-100)" : "#111827",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={enviando}
              onClick={() => { void pide(abierto); }}
              style={{
                padding: "6px 12px", borderRadius: 8, border: "none",
                background: "#059669", color: "#fff", fontSize: 12.5, fontWeight: 700,
                cursor: enviando ? "wait" : "pointer",
              }}
            >
              {enviando ? "Enviando…" : "Enviar"}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => { setAbierto(""); setFallo(""); }}
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                border: "1px solid rgba(107,114,128,0.35)", background: "transparent",
                color: isDark ? "var(--gris-300)" : "#4b5563", cursor: "pointer",
              }}
            >
              Dejarlo
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setAbierto("cambio")}
            style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              border: "1px solid rgba(5,150,105,0.45)", background: "transparent",
              color: isDark ? "#34d399" : "#047857", cursor: "pointer",
            }}
          >
            No puedo ese día
          </button>
          <button
            type="button"
            onClick={() => setAbierto("cancelar")}
            style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              border: "1px solid rgba(107,114,128,0.35)", background: "transparent",
              color: isDark ? "var(--gris-300)" : "#6b7280", cursor: "pointer",
            }}
          >
            Anular la cita
          </button>
        </div>
      )}

      {fallo && (
        <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{fallo}</div>
      )}
    </div>
  );
}

/**
 * Por dónde va su encargo cuando ya lo ha traído todo.
 *
 * Con las ocho puertas hechas, la pantalla decía «ya está todo, nos ponemos con
 * la venta» y ahí se acababa. Por dentro el coche va al taller, se prepara el
 * anuncio y se publica; para él no se movía nada en días, y el que no ve moverse
 * nada llama a preguntar — y la llamada se gasta en leerle un estado.
 *
 * ## El resultado del taller no se cuenta aquí
 *
 * Si el taller dijo que así no se puede vender, eso se habla por teléfono: es la
 * única de las seis puertas que se resuelve hablando, y enterarse por una línea
 * del panel antes de esa llamada es la peor manera de enterarse. Lo que dice
 * esta caja es que la revisión está hecha y que le llamamos.
 */
function PorDondeVa({ estado, isDark }) {
  if (!estado) return null;

  const textoFuerte = isDark ? "var(--gris-100)" : "#1f2937";
  const textoFlojo = isDark ? "var(--gris-400)" : "#6b7280";

  /*
   * Los cuatro momentos, en orden y excluyentes.
   *
   * Uno solo cada vez: dos líneas de estado obligan a decidir cuál es la buena,
   * y la que sobra siempre es la que está desactualizada.
   */
  let titulo = "";
  let detalle = "";
  let enlace = "";

  if (estado.publicado) {
    titulo = "Tu coche ya está anunciado";
    detalle = "A partir de aquí las llamadas entran por nosotros: filtramos y solo te pasamos las visitas que valen la pena.";
    enlace = estado.anuncio_url || "";
  } else if (estado.taller_hecho && estado.taller_ok) {
    titulo = "Revisión del taller hecha";
    detalle = "Ya está todo comprobado. Estamos preparando tu anuncio y te avisamos en cuanto salga.";
  } else if (estado.taller_hecho) {
    // El taller cerró la puerta. Aquí no se dice más: se dice que llamamos.
    titulo = "Revisión del taller hecha";
    detalle = "Te llamamos para contarte el resultado.";
  } else if (estado.tiene_cita) {
    // La cita se enseña entera en su propia caja, justo encima de esta.
    return null;
  } else {
    titulo = "Buscándole cita en el taller";
    detalle = "Es la revisión mecánica que nos permite anunciarlo como comprobado. Te decimos el día en cuanto la tengamos.";
  }

  return (
    <div style={{
      background: isDark ? "rgba(5,150,105,0.10)" : "rgba(5,150,105,0.06)",
      border: "1px solid rgba(5,150,105,0.25)", borderRadius: 10,
      padding: "12px 14px", marginBottom: 8,
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: textoFuerte, marginBottom: 4 }}>
        {titulo}
      </div>
      <div style={{ fontSize: 12, color: textoFlojo, lineHeight: 1.45 }}>{detalle}</div>
      {enlace && (
        <a href={enlace} style={{
          display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 700,
          color: isDark ? "#34d399" : "#047857", textDecoration: "none",
        }}>
          Ver tu anuncio →
        </a>
      )}
    </div>
  );
}

export default function LoQueTeFaltaDelEncargo({
  puertas = [], mandato = null, taller = null, estado = null, precio = null,
  vehicleId = "", isDark = false,
}) {
  const suyas = Array.isArray(puertas) ? puertas : [];
  if (suyas.length === 0 && !mandato && !taller && !estado && !precio) return null;

  /*
   * El mandato es una fila más, y la primera.
   *
   * Estaba en un recuadro aparte encima de la lista, y entonces el contador
   * decía «te quedan 4 cosas» cuando le quedaban cinco — y la que no contaba
   * era la más importante: sin el mandato firmado no podemos vender por él ni
   * cobrarle nada.
   *
   * Va delante porque es lo primero del camino: se le manda nada más hablar
   * con él, antes de que traiga papeles ni fotos.
   */
  const conMandato = mandato
    ? [{
      clave: 'mandato',
      nombre: 'El mandato firmado',
      abierta: Boolean(mandato.firmado),
      falta: `Te lo mandamos por correo (${mandato.mandato_id}). Fírmalo y súbelo aquí.`,
      donde: null,
      mandato,
    }, ...suyas]
    : suyas;

  /*
   * Y el precio de salida, la última.
   *
   * Va al final porque va de verdad al final: el precio se fija con lo que diga
   * el taller —un coche «con reparos» no vale lo mismo que uno limpio—, así que
   * hasta que el coche no ha pasado por allí no hay cifra que aceptar.
   *
   * Y por eso **solo aparece cuando toca**. Si estuviera desde el principio, la
   * lista diría «8 de 9» durante semanas por una fila que él no puede tocar, y
   * una lista con una casilla imposible deja de leerse como una lista de cosas
   * que hacer.
   *
   * No es papeleo nuestro: firmarlo es lo único que le deja retirar el encargo
   * sin pagar nada pasados los treinta días. Por eso el texto dice lo que gana,
   * no lo que le pedimos.
   */
  const todas = precio
    ? [...conMandato, {
      clave: 'precio',
      nombre: 'El precio de salida',
      abierta: Boolean(precio.aceptada),
      falta: precio.importe
        ? `Te hemos mandado el documento (${precio.importe}). Fírmalo y súbelo aquí: el anuncio sale con este precio, y así puedes retirar el encargo sin pagar nada pasados 30 días desde que lo publiquemos.`
        : 'Te hemos mandado el documento por correo. Fírmalo y súbelo aquí.',
      donde: null,
      // Se sube igual que el mandato, con su ruta y su texto.
      mandato: { encargo_id: precio.encargo_id, firmado: Boolean(precio.aceptada) },
      ruta: '/api/clausula-precio',
      textoDelBoton: 'Subir el precio firmado',
    }]
    : conMandato;

  const hayPuertas = todas.length > 0;
  /*
   * El contador cuenta lo que de verdad para el anuncio.
   *
   * Decía «te quedan 4 cosas para que podamos publicarlo» metiendo dentro el
   * seguro y el historial de revisiones, que no paran nada: un coche se publica
   * y se vende sin ellos. Le estábamos diciendo que su coche no salía por una
   * factura de hace tres años.
   */
  const obligatorias = todas.filter((p) => !p.opcional);
  const faltan = obligatorias.filter((p) => !p.abierta).length;
  const hechas = obligatorias.length - faltan;

  const textoFuerte = isDark ? "var(--gris-100)" : "#1f2937";
  const textoFlojo = isDark ? "var(--gris-400)" : "#6b7280";
  const verde = "#059669";
  const ambar = isDark ? "#fbbf24" : "#b45309";

  return (
    <>
      {hayPuertas && (
    <div style={{
      background: isDark ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.05)",
      border: "1px solid rgba(139,92,246,0.22)", borderRadius: 10,
      padding: "12px 14px", marginBottom: 8,
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: textoFuerte, marginBottom: 2 }}>
        {/* Con el anuncio ya puesto, «nos ponemos» se lee como que aún no ha
            empezado: lo que toca decir es que está a la venta. */}
        {faltan === 0 && estado?.publicado
          ? "Ya está todo. Tu coche está a la venta"
          : faltan === 0
          ? "Ya está todo. Nos ponemos con la venta"
          : faltan === 1
            ? "Te queda una cosa para que podamos publicarlo"
            : `Te quedan ${faltan} cosas para que podamos publicarlo`}
      </div>
      <div style={{ fontSize: 12, color: textoFlojo, marginBottom: 10 }}>
        {hechas} de {obligatorias.length} hechas
      </div>

      {/*
        * La barra dice cuánto lleva andado.
        *
        * Una lista de cinco filas se lee como cinco tareas sueltas; la barra es
        * lo que dice que son un camino y que va por la mitad.
        */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {/* Solo las obligatorias: una barra que no llena nunca porque falta algo
            que no hace falta no dice cuánto lleva andado, dice que va mal. */}
        {obligatorias.map((p) => (
          <div key={p.clave} title={p.nombre} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: p.abierta ? verde : "rgba(139,92,246,0.20)",
          }} />
        ))}
      </div>

      <div style={{ display: "grid", gap: 2 }}>
        {todas.map((p) => {
          const dentro = (
            <>
              <span style={{ display: "flex", flexShrink: 0, marginTop: 1 }}>
                {p.abierta ? <Hecha color={verde} /> : <Pendiente color={ambar} />}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: p.abierta ? textoFlojo : textoFuerte,
                  textDecoration: "none",
                }}>
                  {p.nombre}
                </span>
                {/*
                  * Se dice cuáles no paran el anuncio.
                  *
                  * Sin esto, una fila pendiente con su aspa ámbar se lee igual
                  * que las demás: no hay manera de saber que esa se puede dejar
                  * para luego, y la lista entera parece un muro.
                  */}
                {p.opcional && !p.abierta && (
                  <span style={{
                    marginLeft: 6, fontSize: 10, fontWeight: 800, letterSpacing: ".3px",
                    color: textoFlojo, border: `1px solid ${isDark ? "rgba(150,150,143,0.4)" : "#d1d5db"}`,
                    borderRadius: 999, padding: "1px 6px", verticalAlign: "middle",
                  }}>
                    OPCIONAL
                  </span>
                )}
                {p.bloqueada && !p.abierta && (
                  <span style={{
                    marginLeft: 6, fontSize: 10, fontWeight: 800, letterSpacing: ".3px",
                    color: ambar, border: `1px solid ${ambar}`,
                    borderRadius: 999, padding: "1px 6px", verticalAlign: "middle",
                  }}>
                    TODAVÍA NO
                  </span>
                )}
                {!p.abierta && p.falta && (
                  <span style={{ display: "block", fontSize: 12, color: textoFlojo, lineHeight: 1.45 }}>
                    {p.falta}
                  </span>
                )}
                {!p.abierta && p.donde && (
                  <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6d28d9", marginTop: 2 }}>
                    {p.donde.texto} →
                  </span>
                )}
                {/*
                  * El mandato no lleva a otra pantalla: se resuelve aquí.
                  *
                  * Es la única de las filas que se hace sin salir del panel —
                  * las demás mandan a subir papeles, a tasar o a poner horas.
                  */}
                {!p.abierta && p.mandato && (
                  <SubirElMandato
                    mandato={p.mandato}
                    isDark={isDark}
                    ruta={p.ruta || "/api/mandato-firmado"}
                    texto={p.textoDelBoton || "Subir el mandato firmado"}
                  />
                )}
              </span>
            </>
          );

          const caja = {
            display: "flex", gap: 8, alignItems: "flex-start",
            padding: "7px 8px", borderRadius: 8, textDecoration: "none",
          };

          // La hecha no es un enlace: se ve, no se pulsa.
          if (p.abierta || !p.donde) {
            return <div key={p.clave} style={caja}>{dentro}</div>;
          }
          return (
            <a key={p.clave} href={p.donde.url}
               aria-label={`${p.nombre}: ${p.donde.texto}`}
               style={{ ...caja, background: isDark ? "rgba(139,92,246,0.10)" : "rgba(255,255,255,0.65)", cursor: "pointer" }}>
              {dentro}
            </a>
          );
        })}
      </div>
    </div>
      )}

      {/* Y lo que hacemos nosotros, debajo de lo suyo. */}
      <LaCitaDelTaller cita={taller} vehicleId={vehicleId} isDark={isDark} />

      {/*
        * Por dónde va, solo cuando ya no le falta nada por traer.
        *
        * Con cosas pendientes, lo que tiene que leer es qué le falta: una línea
        * diciendo «estamos preparando tu anuncio» encima de «te faltan dos
        * cosas» se contradice con ella y gana la que menos trabajo da.
        */}
      {faltan === 0 && <PorDondeVa estado={estado} isDark={isDark} />}
    </>
  );
}
