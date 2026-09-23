import { useEffect, useMemo, useState } from "react";
import AvailabilityEditor from "../../components/AvailabilityEditor";
import { getLugarDeVisitaJson, postLugarDeVisitaJson } from "../../utils/apiClient";

/**
 * Cuándo y dónde puede enseñar su coche.
 *
 * Esto no tenía sitio propio. Las franjas vivían dentro de un botón de la
 * tarjeta del coche, en Vehículos, y ese botón salía **solo al ir a publicar en
 * el marketplace**: quien nos había encargado la venta leía en su panel
 * «pendiente: indicar franjas horarias», pinchaba, y aterrizaba en la lista de
 * sus coches sin nada abierto. El enlace llevaba a la página correcta y aun así
 * no llevaba a ninguna parte.
 *
 * Aquí está todo junto, que es como se decide: qué horas puedes y en qué
 * dirección. Son la misma decisión y hasta ahora estaban en dos sitios y en dos
 * momentos distintos —las horas antes de publicar, la dirección al confirmar
 * cada visita, una por una—.
 *
 * ## La dirección no es la del anuncio
 *
 * El anuncio dice la ciudad, que es lo que un comprador necesita para saber si
 * le pilla lejos. Aquí va la entera, con número y piso: quien ya tiene hora
 * necesita el portal. Y por eso no se publica en ningún sitio — solo la ve
 * quien tiene una visita confirmada, en su correo.
 */

/** Los coches a los que tiene sentido ponerles horas. */
function losQuePuedenRecibirVisitas(secciones, tieneEncargo) {
  const todos = (secciones || []).flatMap((s) => (Array.isArray(s?.items) ? s.items : []));
  const vistos = new Set();
  return todos.filter((v) => {
    if (!v?.id || vistos.has(v.id)) return false;
    vistos.add(v.id);
    // O nos han encargado venderlo, o ya está anunciado: en los dos casos va a
    // venir alguien a verlo. Un coche que solo tiene en el garaje, no.
    return tieneEncargo(v) || v?.marketplaceState === "active_sale";
  });
}

const VACIO = { direccion: "", codigoPostal: "", ciudad: "", contacto: "", notas: "" };

function ElLugar({ vehicleId, isDark, etiqueta }) {
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

export default function UserDashboardFranjas({
  themeMode,
  panelStyle,
  userVehicleSections = [],
  matriculasConEncargo = new Set(),
  onNavigate,
}) {
  const isDark = themeMode === "dark";

  const tieneEncargo = useMemo(() => (vehicle) => {
    const suya = String(vehicle?.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return Boolean(suya) && matriculasConEncargo.has(suya);
  }, [matriculasConEncargo]);

  const coches = useMemo(
    () => losQuePuedenRecibirVisitas(userVehicleSections, tieneEncargo),
    [userVehicleSections, tieneEncargo]
  );

  /*
   * Si viene con matrícula, se baja hasta ese coche.
   *
   * El aviso del encargo enlaza `/panel/visitas?matricula=8888LXR`, y quien
   * tiene tres coches llega aquí y tiene que adivinar cuál de los tres es el
   * del encargo. Mandarle a la pantalla y que busque es lo mismo que no
   * decirle dónde, que es el problema que esto venía a arreglar.
   *
   * Una sola vez: repetir el salto cada vez que se guarda una dirección
   * movería la pantalla justo mientras la está usando.
   */
  const [yaAterrizo, setYaAterrizo] = useState(false);
  useEffect(() => {
    if (yaAterrizo || typeof window === "undefined" || coches.length === 0) return;
    let pedida = "";
    try {
      pedida = new URLSearchParams(window.location.search).get("matricula") || "";
    } catch {
      pedida = "";
    }
    const suya = String(pedida).toUpperCase().replace(/[^A-Z0-9]/g, "");
    setYaAterrizo(true);
    if (!suya) return;
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`franjas-${suya}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [coches, yaAterrizo]);

  const titulo = isDark ? "var(--gris-50)" : "var(--gris-900)";
  const suave = isDark ? "var(--gris-400)" : "var(--gris-500)";

  return (
    <div style={panelStyle}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: titulo }}>Visitas a tus coches</div>
        <p style={{ fontSize: 13, color: suave, margin: "4px 0 0" }}>
          Cuándo puedes enseñar cada coche y en qué dirección. Los compradores
          solo pueden pedir hora dentro de lo que marques aquí.
        </p>
      </div>

      {coches.length === 0 ? (
        <div style={{
          border: isDark ? "1px dashed rgba(150,150,143,0.3)" : "1px dashed var(--gris-200)",
          borderRadius: 12, padding: 22, textAlign: "center",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: titulo, marginBottom: 4 }}>
            Todavía no hay ningún coche que enseñar
          </div>
          <p style={{ fontSize: 13, color: suave, margin: "0 0 12px" }}>
            Esto se llena cuando nos encargas vender un coche o lo publicas en el
            marketplace. Hasta entonces nadie puede pedirte una visita.
          </p>
          {typeof onNavigate === "function" && (
            <button
              type="button"
              onClick={() => onNavigate("vehicles")}
              style={{
                background: "rgba(255,196,0,0.14)", border: "1px solid rgba(255,196,0,0.34)",
                color: titulo, borderRadius: 999, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              Ver mis coches
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {coches.map((v) => (
            <section
              key={v.id}
              id={`franjas-${String(v.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "")}`}
              style={{
                border: isDark ? "1px solid rgba(150,150,143,0.26)" : "1px solid var(--gris-200)",
                borderRadius: 14, padding: 18,
                background: isDark ? "rgba(255,255,255,0.02)" : "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: titulo }}>
                  {v.title || [v.brand, v.model].filter(Boolean).join(" ") || "Tu coche"}
                </div>
                {v.plate && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: suave, letterSpacing: ".4px" }}>{v.plate}</span>
                )}
                {tieneEncargo(v) && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: ".3px",
                    background: "rgba(139,92,246,0.12)", color: "#6d28d9",
                    border: "1px solid rgba(139,92,246,0.25)", borderRadius: 999, padding: "2px 8px",
                  }}>
                    Lo vendemos por ti
                  </span>
                )}
              </div>

              <ElLugar vehicleId={v.id} isDark={isDark} etiqueta={v.plate ? `de ${v.plate}` : ""} />

              <div style={{ fontSize: 13, fontWeight: 800, color: titulo, marginBottom: 2 }}>
                🗓 Cuándo puedes enseñarlo
              </div>
              <p style={{ fontSize: 12, color: suave, margin: "0 0 10px" }}>
                Marca los días y las horas. Cada comprador reserva una hora suelta
                dentro de lo que marques, y tú la confirmas o propones otra.
              </p>
              <AvailabilityEditor offerId={`idcar-${v.id}`} source="marketplace" />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
