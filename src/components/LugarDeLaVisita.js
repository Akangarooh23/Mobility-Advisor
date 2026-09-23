import { useEffect, useState } from "react";
import { getLugarDeVisitaJson, postLugarDeVisitaJson } from "../utils/apiClient";

/**
 * Dónde enseña el vendedor su coche.
 *
 * Esto no se guardaba en ningún sitio: lo escribía **cada vez** que confirmaba
 * una visita, en la casilla «dónde» de su enlace. Con tres compradores lo
 * escribía tres veces, y si un día lo escribía distinto —«en casa», «Alcalá
 * 120», «el parking de siempre»— cada comprador recibía una dirección
 * diferente del mismo coche.
 *
 * Vive aparte porque se usa en dos sitios: en el apartado de Visitas del panel
 * y en el diálogo de franjas de la tarjeta del coche. Estaba solo en el
 * primero, y quien entraba por el segundo —que es el camino que ya conocía—
 * veía las horas y ninguna dirección, sin nada que le dijera que existía.
 *
 * ## No es la dirección del anuncio
 *
 * El anuncio dice la ciudad, que es lo que un comprador necesita para saber si
 * le pilla lejos. Aquí va la entera, con número y piso: quien ya tiene hora
 * necesita el portal. Por eso no se publica — solo la ve quien tiene una visita
 * confirmada, en su correo.
 */

const VACIO = { direccion: "", codigoPostal: "", ciudad: "", contacto: "", notas: "" };

export default function ElLugar({ vehicleId, isDark, etiqueta }) {
  const [lugar, setLugar] = useState(null);
  const [datos, setDatos] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState("");
  const [guardado, setGuardado] = useState(false);

  const offerId = `idcar-${vehicleId}`;

  useEffect(() => {
    let tirado = false;
    (async () => {
      try {
        const { response, data } = await getLugarDeVisitaJson(offerId);
        if (tirado) return;
        const suyo = response.ok && data?.lugar ? data.lugar : null;
        setLugar(suyo);
        setDatos(suyo ? { ...VACIO, ...suyo } : VACIO);
      } catch {
        // Sin dirección se sigue: las franjas son lo principal de esta pantalla
        // y no pueden quedarse sin pintar porque falle una consulta de apoyo.
        if (!tirado) setLugar(null);
      }
    })();
    return () => { tirado = true; };
  }, [offerId]);

  const pon = (campo) => (e) => {
    setDatos((d) => ({ ...d, [campo]: e.target.value }));
    setGuardado(false);
    setFallo("");
  };

  async function guarda() {
    setGuardando(true);
    setFallo("");
    try {
      const { response, data } = await postLugarDeVisitaJson({ offerId, ...datos });
      if (!response.ok) {
        setFallo(data?.error || "No hemos podido guardarlo. Inténtalo en un momento.");
        return;
      }
      setLugar(data?.lugar || null);
      setGuardado(true);
    } catch {
      setFallo("No hemos podido guardarlo. Comprueba tu conexión.");
    } finally {
      setGuardando(false);
    }
  }

  const campo = {
    border: isDark ? "1px solid rgba(150,150,143,0.3)" : "1px solid var(--gris-200)",
    borderRadius: 9,
    padding: "9px 11px",
    fontSize: 13,
    fontFamily: "inherit",
    color: isDark ? "var(--gris-50)" : "var(--gris-900)",
    background: isDark ? "rgba(255,255,255,0.04)" : "#fff",
    width: "100%",
    boxSizing: "border-box",
  };
  const etiquetaEstilo = {
    fontSize: 11,
    fontWeight: 700,
    color: isDark ? "var(--gris-400)" : "var(--gris-700)",
    display: "block",
    marginBottom: 4,
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "var(--gris-50)" : "var(--gris-900)", marginBottom: 2 }}>
        📍 Dónde lo enseñas
      </div>
      <p style={{ fontSize: 12, color: isDark ? "var(--gris-400)" : "var(--gris-500)", margin: "0 0 10px" }}>
        La dirección entera, con número. Se la mandamos solo al comprador que ya
        tiene la visita confirmada: en el anuncio {etiqueta} sale únicamente la ciudad.
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        <div>
          <label style={etiquetaEstilo} htmlFor={`dir-${vehicleId}`}>Calle y número</label>
          <input id={`dir-${vehicleId}`} style={campo} value={datos.direccion}
                 onChange={pon("direccion")} placeholder="Calle de Alcalá 120, 3ºB" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8 }}>
          <div>
            <label style={etiquetaEstilo} htmlFor={`cp-${vehicleId}`}>Código postal</label>
            <input id={`cp-${vehicleId}`} style={campo} value={datos.codigoPostal}
                   onChange={pon("codigoPostal")} placeholder="28009" inputMode="numeric" maxLength={5} />
          </div>
          <div>
            <label style={etiquetaEstilo} htmlFor={`ciudad-${vehicleId}`}>Ciudad</label>
            <input id={`ciudad-${vehicleId}`} style={campo} value={datos.ciudad}
                   onChange={pon("ciudad")} placeholder="Madrid" />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={etiquetaEstilo} htmlFor={`quien-${vehicleId}`}>Pregunta por</label>
            <input id={`quien-${vehicleId}`} style={campo} value={datos.contacto}
                   onChange={pon("contacto")} placeholder="Ana" />
          </div>
          <div>
            <label style={etiquetaEstilo} htmlFor={`notas-${vehicleId}`}>Cómo llegar (opcional)</label>
            <input id={`notas-${vehicleId}`} style={campo} value={datos.notas}
                   onChange={pon("notas")} placeholder="Entrada del parking por Goya" />
          </div>
        </div>
      </div>

      {fallo && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "7px 9px" }}>
          {fallo}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <button
          type="button"
          onClick={guarda}
          disabled={guardando}
          style={{
            background: "rgba(255,196,0,0.14)",
            border: "1px solid rgba(255,196,0,0.34)",
            color: isDark ? "var(--gris-50)" : "var(--gris-900)",
            borderRadius: 999, padding: "8px 16px", fontSize: 12, fontWeight: 700,
            cursor: guardando ? "default" : "pointer", opacity: guardando ? 0.6 : 1,
          }}
        >
          {guardando ? "Guardando…" : "Guardar la dirección"}
        </button>
        {guardado && <span style={{ fontSize: 12, color: "#047857", fontWeight: 700 }}>Guardada</span>}
        {!guardado && lugar && !lugar.completo && (
          <span style={{ fontSize: 12, color: "#b45309", fontWeight: 700 }}>Sin dirección todavía</span>
        )}
      </div>
    </div>
  );
}
