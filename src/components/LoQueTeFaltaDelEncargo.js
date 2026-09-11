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

export default function LoQueTeFaltaDelEncargo({ puertas = [], isDark = false }) {
  if (!Array.isArray(puertas) || puertas.length === 0) return null;

  const faltan = puertas.filter((p) => !p.abierta).length;
  const hechas = puertas.length - faltan;

  const textoFuerte = isDark ? "var(--gris-100)" : "#1f2937";
  const textoFlojo = isDark ? "var(--gris-400)" : "#6b7280";
  const verde = "#059669";
  const ambar = isDark ? "#fbbf24" : "#b45309";

  return (
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
        {hechas} de {puertas.length} hechas
      </div>

      {/*
        * La barra dice cuánto lleva andado.
        *
        * Una lista de cinco filas se lee como cinco tareas sueltas; la barra es
        * lo que dice que son un camino y que va por la mitad.
        */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {puertas.map((p) => (
          <div key={p.clave} title={p.nombre} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: p.abierta ? verde : "rgba(139,92,246,0.20)",
          }} />
        ))}
      </div>

      <div style={{ display: "grid", gap: 2 }}>
        {puertas.map((p) => {
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
  );
}
