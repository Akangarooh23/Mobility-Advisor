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
function SubirElMandato({ mandato, isDark }) {
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
      const res = await fetch(rutaApi("/api/mandato-firmado"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        {subiendo ? "Subiendo…" : "Subir el mandato firmado"}
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

export default function LoQueTeFaltaDelEncargo({ puertas = [], mandato = null, isDark = false }) {
  const suyas = Array.isArray(puertas) ? puertas : [];
  if (suyas.length === 0 && !mandato) return null;

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
  const todas = mandato
    ? [{
      clave: 'mandato',
      nombre: 'El mandato firmado',
      abierta: Boolean(mandato.firmado),
      falta: `Te lo mandamos por correo (${mandato.mandato_id}). Fírmalo y súbelo aquí.`,
      donde: null,
      mandato,
    }, ...suyas]
    : suyas;

  const hayPuertas = todas.length > 0;
  const faltan = todas.filter((p) => !p.abierta).length;
  const hechas = todas.length - faltan;

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
        {faltan === 0
          ? "Ya está todo. Nos ponemos con la venta"
          : faltan === 1
            ? "Te queda una cosa para que podamos publicarlo"
            : `Te quedan ${faltan} cosas para que podamos publicarlo`}
      </div>
      <div style={{ fontSize: 12, color: textoFlojo, marginBottom: 10 }}>
        {hechas} de {todas.length} hechas
      </div>

      {/*
        * La barra dice cuánto lleva andado.
        *
        * Una lista de cinco filas se lee como cinco tareas sueltas; la barra es
        * lo que dice que son un camino y que va por la mitad.
        */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {todas.map((p) => (
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
                {!p.abierta && p.mandato && <SubirElMandato mandato={p.mandato} isDark={isDark} />}
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
    </>
  );
}
