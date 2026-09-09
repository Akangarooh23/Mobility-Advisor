import { useEffect, useState } from "react";

/**
 * `/v/8888LXR` — la dirección que va en los anuncios de los portales.
 *
 * En coches.net o en Milanuncios no se puede enlazar a nuestra ficha: lo único
 * que cabe es una línea de texto que alguien teclea o copia del móvil. Por eso
 * la matrícula, que el comprador tiene delante en el propio anuncio.
 *
 * Esta página no enseña el coche: lo busca y lleva a su ficha. Lo que sí enseña
 * es **lo que pasa cuando ya no está**, que no es un caso raro: los anuncios
 * viven en los portales semanas después de que el coche se venda, y todo el que
 * pulse el enlace a partir de entonces llega aquí. A esa persona hay algo que
 * decirle y otros coches que enseñarle — no un 404.
 */
export default function CochePorMatriculaPage({ matricula, onVerOtros }) {
  const [estado, setEstado] = useState("buscando"); // buscando | vendido | noVale | fallo

  useEffect(() => {
    if (!matricula) { setEstado("noVale"); return; }

    fetch(`/api/marketplace-vo?plate=${encodeURIComponent(matricula)}`)
      .then(async (r) => ({ codigo: r.status, cuerpo: await r.json().catch(() => ({})) }))
      .then(({ codigo, cuerpo }) => {
        if (cuerpo.ok && cuerpo.offer?.id) {
          // `replace` y no `assign`: quien vuelva atrás desde la ficha tiene que
          // salir al sitio de donde vino, no rebotar otra vez contra esta.
          window.location.replace(`/marketplace-vo/${encodeURIComponent(cuerpo.offer.id)}`);
          return;
        }
        if (codigo === 404) setEstado("vendido");
        else if (codigo === 400) setEstado("noVale");
        else setEstado("fallo");
      })
      .catch(() => setEstado("fallo"));
  }, [matricula]);

  const caja = {
    maxWidth: 520, margin: "60px auto", padding: "32px 28px", textAlign: "center",
    border: "1px solid rgba(150,150,143,0.25)", borderRadius: 16, background: "var(--blanco)",
  };
  const titulo = { fontSize: 20, fontWeight: 800, color: "var(--gris-900)", margin: "0 0 8px" };
  const texto = { fontSize: 14, color: "var(--gris-500)", lineHeight: 1.55, margin: 0 };

  if (estado === "buscando") {
    return (
      <div style={caja}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>🔍</div>
        <h1 style={titulo}>Buscando el coche</h1>
        <p style={texto}>Un momento.</p>
      </div>
    );
  }

  if (estado === "vendido") {
    return (
      <div style={caja}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🚗</div>
        <h1 style={titulo}>Este coche ya no está a la venta</h1>
        <p style={texto}>
          El anuncio que has visto sigue publicado en el portal, pero el coche ya se ha
          vendido. Tenemos otros, todos con su informe de estado y con horas para verlos.
        </p>
        {onVerOtros && (
          <button className="cw-btn-acento" style={{ cursor: "pointer", marginTop: 18 }}
                  onClick={onVerOtros}>
            Ver coches disponibles
          </button>
        )}
      </div>
    );
  }

  if (estado === "noVale") {
    return (
      <div style={caja}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>✏️</div>
        <h1 style={titulo}>Esa matrícula no nos cuadra</h1>
        <p style={texto}>
          Comprueba que la has copiado entera del anuncio. Da igual si la escribes con
          espacios, con guion o en minúscula.
        </p>
        {onVerOtros && (
          <button className="cw-btn-acento" style={{ cursor: "pointer", marginTop: 18 }}
                  onClick={onVerOtros}>
            Ver coches disponibles
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={caja}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>⚠️</div>
      <h1 style={titulo}>No hemos podido buscarlo</h1>
      <p style={texto}>Ha fallado algo por nuestra parte. Inténtalo dentro de un rato.</p>
    </div>
  );
}
