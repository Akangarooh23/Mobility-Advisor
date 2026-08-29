import { useState, useEffect } from "react";
import { getUserMobilityDataJson } from "../../utils/apiClient";
import { proximas, ESTADO as ESTADO_CITA } from "../../utils/citas";

export default function UserDashboardSolicitudes({
  themeMode,
  userSolicitudes = [],
  panelStyle,
  getOfferBadgeStyle,
  userEmail = "",
  onOpenVehicleDetail,
}) {
  const isDark = themeMode === "dark";

  const [localSolicitudes, setLocalSolicitudes] = useState(userSolicitudes);
  const [activeTab, setActiveTab]        = useState("pendiente");
  const [cancelId, setCancelId]         = useState(null);
  const [rescheduleId, setRescheduleId] = useState(null);
  const [confirmId, setConfirmId]       = useState(null);
  const [proposals, setProposals]       = useState([{ date: "", time: "" }]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]   = useState("");
  const [outcomeId, setOutcomeId]       = useState(null);
  const [outcomeLoading, setOutcomeLoading] = useState(false);

  // Poll every 30s so the client sees status changes made by the operator in the ERP
  useEffect(() => {
    if (!userEmail) return;
    const poll = async () => {
      try {
        const { response, data } = await getUserMobilityDataJson(userEmail);
        if (response.ok && Array.isArray(data?.solicitudes)) {
          setLocalSolicitudes(data.solicitudes);
        }
      } catch {}
    };
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [userEmail]);

  const TYPE_LABEL = {
    info:            "Solicitar info",
    visit:           "Agendar visita",
    question:        "Preguntar",
    renting:         "🔑 Oferta de renting",
    viewing_seller:  "Solicitud de visita",
    visita_marketplace: "Visita",
    // Una solicitud de importación. Sin esto salía la palabra «import» a secas.
    import:          "🌍 Importar un coche",
  };
  const TYPE_COLOR = {
    info:            { bg: "rgba(255,196,0,0.12)",  color: "var(--marca-oscuro)", border: "rgba(255,196,0,0.25)" },
    visit:           { bg: "rgba(16,185,129,0.12)",  color: "#065f46", border: "rgba(16,185,129,0.25)" },
    question:        { bg: "rgba(94,94,89,0.12)",  color: "var(--gris-600)", border: "rgba(94,94,89,0.25)" },
    renting:         { bg: "rgba(5,150,105,0.12)",   color: "#065f46", border: "rgba(5,150,105,0.3)" },
    import:          { bg: "rgba(37,99,235,0.10)",   color: "#1d4ed8", border: "rgba(37,99,235,0.25)" },
    viewing_seller:  { bg: "rgba(234,88,12,0.12)",   color: "#c2410c", border: "rgba(234,88,12,0.25)" },
    visita_marketplace: { bg: "rgba(37,99,235,0.12)", color: "#1d4ed8", border: "rgba(37,99,235,0.25)" },
  };
  const STATUS_COLOR = {
    Pendiente:                  { bg: "rgba(245,158,11,0.12)",  color: "#92400e" },
    Contactado:                 { bg: "rgba(255,196,0,0.12)",  color: "var(--marca-oscuro)" },
    "En proceso":               { bg: "rgba(94,94,89,0.12)",  color: "var(--gris-600)" },
    "Cita confirmada":          { bg: "rgba(16,185,129,0.15)",  color: "#065f46" },
    Cerrado:                    { bg: "rgba(16,185,129,0.12)",  color: "#065f46" },
    "Visita realizada":         { bg: "rgba(20,184,166,0.12)",  color: "#0f766e" },
    Interesado:                 { bg: "rgba(255,196,0,0.12)",  color: "var(--gris-800)" },
    Vendido:                    { bg: "rgba(16,185,129,0.18)",  color: "#065f46" },
    Comprado:                   { bg: "rgba(16,185,129,0.18)",  color: "#065f46" },
    Contratado:                 { bg: "rgba(16,185,129,0.18)",  color: "#065f46" },
    "Renting confirmado":       { bg: "rgba(5,150,105,0.18)",   color: "#065f46" },
    Descartado:                 { bg: "rgba(94,94,89,0.10)", color: "var(--gris-600)" },
    "Reagendar solicitado":     { bg: "rgba(245,158,11,0.12)",  color: "#92400e" },
    Cancelado:                  { bg: "rgba(239,68,68,0.10)",   color: "#b91c1c" },
    "Pendiente de aprobación":   { bg: "rgba(245,158,11,0.12)",  color: "#92400e" },
    pending_seller:             { bg: "rgba(245,158,11,0.12)",  color: "#92400e" },
    pending_buyer:              { bg: "rgba(255,196,0,0.12)",  color: "var(--marca-oscuro)" },
    confirmed:                  { bg: "rgba(16,185,129,0.15)",  color: "#065f46" },
  };

  const CONTRACTED_STATUSES = ["Vendido", "Comprado", "Contratado", "Renting confirmado"];
  const VIEWING_STATUS_LABEL = {
    pending_seller: "Esperando tus fechas",
    pending_buyer:  "Comprador eligiendo fecha",
    confirmed:      "Cita confirmada",
  };

  function parseMeta(raw) {
    try { return JSON.parse(raw || "{}"); } catch { return {}; }
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return iso; }
  }

  function fmtHoraCita(iso) {
    try { return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  }

  function fmtDiaCita(iso) {
    try { return new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }); }
    catch { return ""; }
  }

  function formatAppointmentDate(dateStr) {
    if (!dateStr) return "";
    try {
      const datePart = String(dateStr).slice(0, 10);
      return new Date(datePart + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } catch { return dateStr; }
  }

  async function handleCancel(id) {
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, email: userEmail, action: "cancel" }),
      });
      if (!res.ok) throw new Error("Error al anular");
      setLocalSolicitudes((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: "Cancelado",
                meta: JSON.stringify({
                  ...parseMeta(s.meta),
                  appointment_date: "",
                  appointment_time: "",
                  appointment_address: "",
                  appointment_contact: "",
                }),
              }
            : s
        )
      );
      setCancelId(null);
    } catch {
      setActionError("No se pudo anular la cita. Inténtalo de nuevo.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReschedule(id) {
    const valid = proposals.filter((p) => p.date);
    if (!valid.length) { setActionError("Añade al menos una fecha."); return; }
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, email: userEmail, action: "reschedule", proposals: valid }),
      });
      if (!res.ok) throw new Error("Error al enviar");
      setLocalSolicitudes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "Reagendar solicitado" } : s))
      );
      setRescheduleId(null);
      setProposals([{ date: "", time: "" }]);
    } catch {
      setActionError("No se pudo enviar la solicitud. Inténtalo de nuevo.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirm(id) {
    setActionLoading(true);
    setActionError("");
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, email: userEmail, action: "confirm" }),
      });
      if (!res.ok) throw new Error("Error al confirmar");
      const data = await res.json();
      if (data.email_error) console.warn("[confirm] email_error:", data.email_error);
      setLocalSolicitudes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "Cita confirmada" } : s))
      );
      setConfirmId(null);
    } catch {
      setActionError("No se pudo confirmar la cita. Inténtalo de nuevo.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleOutcome(id, outcome) {
    setOutcomeLoading(true);
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, email: userEmail, action: "client_outcome", outcome }),
      });
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setLocalSolicitudes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: data.status } : s))
      );
      setOutcomeId(null);
    } catch {
      // silently fail — state will refresh on next poll
    } finally {
      setOutcomeLoading(false);
    }
  }

  function openReschedule(id) {
    setRescheduleId(id);
    setCancelId(null);
    setConfirmId(null);
    setProposals([{ date: "", time: "" }]);
    setActionError("");
  }

  function openCancel(id) {
    setCancelId(id);
    setRescheduleId(null);
    setConfirmId(null);
    setActionError("");
  }

  function openConfirm(id) {
    setConfirmId(id);
    setCancelId(null);
    setRescheduleId(null);
    setActionError("");
  }

  function updateProposal(idx, field, value) {
    setProposals((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  const btnBase = {
    fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8,
    border: "1px solid", cursor: "pointer", transition: "opacity 0.15s",
  };

  // Returns true if dateStr (YYYY-MM-DD or ISO) is strictly before today
  function isDatePast(dateStr) {
    if (!dateStr) return false;
    try {
      const d = new Date(String(dateStr).slice(0, 10) + "T23:59:59");
      return d < new Date();
    } catch { return false; }
  }

  // Cuándo es la cita, venga de donde venga. Las visitas del marketplace
  // guardan `starts_at`; los leads, `appointment_date`; las del vendedor,
  // `confirmed_slot`. Sin esto, una visita del marketplace se quedaba en «en
  // curso» para siempre, porque se agrupaba por un campo que no tiene.
  //
  // La regla vive en `citas.js`; aquí solo hace falta la fecha suelta para
  // decidir si la cita ya pasó.
  function cuandoEs(meta) {
    return meta.starts_at || meta.appointment_date || meta.confirmed_slot || "";
  }

  const grouped = {
    pendiente: localSolicitudes.filter((s) =>
      ["Pendiente", "Contactado", "En proceso", "Reagendar solicitado", "pending_seller", "pending_buyer", "Pendiente de aprobación"].includes(s.status)
    ),
    en_curso: localSolicitudes.filter((s) => {
      const meta = parseMeta(s.meta);
      if (s.status === "Cita confirmada") return !isDatePast(cuandoEs(meta));
      if (s.status === "confirmed")       return !isDatePast(meta.confirmed_slot);
      return false;
    }),
    finalizadas: localSolicitudes.filter((s) => {
      if (CONTRACTED_STATUSES.includes(s.status)) return false;
      const meta = parseMeta(s.meta);
      if (s.status === "Cerrado")          return true;
      if (s.status === "Visita realizada") return true;
      if (s.status === "Interesado")       return true;
      if (s.status === "Cita confirmada")  return isDatePast(cuandoEs(meta));
      if (s.status === "confirmed")        return isDatePast(meta.confirmed_slot);
      return false;
    }),
    contratadas: localSolicitudes.filter((s) => CONTRACTED_STATUSES.includes(s.status)),
    canceladas: localSolicitudes.filter((s) => ["Cancelado", "Descartado"].includes(s.status)),
  };

  const TABS = [
    { key: "pendiente",   label: "Pendiente",   color: "#d97706" },
    { key: "en_curso",    label: "En curso",    color: "var(--marca)" },
    { key: "finalizadas", label: "Finalizadas", color: "#059669" },
    { key: "contratadas", label: "Contratadas", color: "var(--gris-500)" },
    { key: "canceladas",  label: "Canceladas",  color: "#dc2626" },
  ];

  const visibleSolicitudes = grouped[activeTab] || [];

  /**
   * Las visitas del marketplace que aún no han pasado.
   *
   * Solo las que vienen: una cita de la semana pasada ya no es un aviso, es
   * historial, y sigue en la lista de abajo como todo lo demás. Las canceladas
   * tampoco, que no hay nada a lo que ir.
   */
  // Antes esto filtraba solo las del marketplace y volvía a traducirlas a mano.
  // Ahora sale de `citas.js`, así que el bloque de arriba enseña también las
  // citas que puso un trabajador sobre una solicitud: para quien las tiene son
  // lo mismo, un sitio donde hay que estar un día a una hora.
  const proximasVisitas = proximas(localSolicitudes);

  return (
    <section style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--marca-claro)", letterSpacing: "0.6px", fontWeight: 700, textTransform: "uppercase" }}>Mis solicitudes</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? "var(--gris-50)" : "var(--gris-900)" }}>Solicitudes de vehículos</div>
          <div style={{ fontSize: 12, color: isDark ? "var(--gris-400)" : "var(--gris-500)", marginTop: 2 }}>Información, visitas y consultas sobre coches que te han interesado</div>
        </div>
        <span style={{ ...getOfferBadgeStyle("blue"), fontSize: 11 }}>{localSolicitudes.length} solicitud{localSolicitudes.length !== 1 ? "es" : ""}</span>
      </div>

      {/* Las visitas que vienen, arriba y aparte.
          Una cita no es una solicitud cualquiera: tiene dia y hora. Dentro de la
          lista se pierde entre peticiones que pueden esperar, y quien se la
          pierde se planta en un sitio el dia que no era. */}
      {proximasVisitas.length > 0 && (
        <div style={{
          border: "1.5px solid rgba(37,99,235,0.25)", background: "rgba(37,99,235,0.06)",
          borderRadius: 14, padding: "14px 16px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".5px", textTransform: "uppercase", color: "#1d4ed8", marginBottom: 10 }}>
            {proximasVisitas.length === 1 ? "Tu próxima visita" : "Tus próximas visitas"}
          </div>
          {proximasVisitas.map((v) => (
            <div key={v.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "8px 0" }}>
              <div style={{ minWidth: 86 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: isDark ? "var(--gris-50)" : "var(--gris-900)", lineHeight: 1.1 }}>
                  {fmtHoraCita(v.cuando)}
                </div>
                <div style={{ fontSize: 12, color: isDark ? "var(--gris-400)" : "var(--gris-500)" }}>{fmtDiaCita(v.cuando)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? "var(--gris-50)" : "var(--gris-900)" }}>{v.titulo}</div>
                <div style={{ fontSize: 12, color: v.pendiente ? "#92400e" : "#065f46", fontWeight: 700, marginTop: 2 }}>
                  {v.eligeHora ? "Te esperamos: elige una hora" : v.pendiente ? "Pendiente de aprobación" : "✓ Confirmada"}
                </div>
              </div>
              {/* Cuando hay horas que elegir, eso es lo que hay que hacer: manda
                  sobre «ver o cambiar», que aquí no sirve de nada. */}
              {v.eligeHora ? (
                <a href={v.enlaceElegir} style={{
                  fontSize: 13, fontWeight: 800, color: "var(--gris-900)", textDecoration: "none",
                  background: "var(--marca, #FFC400)", borderRadius: 8, padding: "8px 15px",
                }}>
                  Elegir hora →
                </a>
              ) : v.enlace ? (
                <a href={v.enlace} style={{
                  fontSize: 13, fontWeight: 700, color: "#1d4ed8", textDecoration: "none",
                  border: "1.5px solid rgba(37,99,235,0.35)", borderRadius: 8, padding: "7px 14px",
                }}>
                  Ver o cambiar
                </a>
              ) : null}
            </div>
          ))}
          {proximasVisitas.some((v) => v.eligeHora) ? (
            <div style={{ fontSize: 12, color: isDark ? "var(--gris-400)" : "var(--gris-500)", marginTop: 6 }}>
              A la hora que pediste no podía ser. Elige una de las que nos ha dado quien tiene el coche y tu visita queda confirmada.
            </div>
          ) : proximasVisitas.some((v) => v.pendiente) ? (
            <div style={{ fontSize: 12, color: isDark ? "var(--gris-400)" : "var(--gris-500)", marginTop: 6 }}>
              Las pendientes están a la espera de que confirmemos el horario. Te escribimos en cuanto lo tengamos.
            </div>
          ) : null}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 16,
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "var(--gris-200)"}`,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        msOverflowStyle: "none", scrollbarWidth: "none",
      }}>
        {TABS.map((tab) => {
          const count = grouped[tab.key].length;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: "none", border: "none", cursor: "pointer", flexShrink: 0,
                padding: "8px 12px", fontSize: 12, fontWeight: isActive ? 700 : 500,
                color: isActive ? tab.color : (isDark ? "var(--gris-500)" : "var(--gris-400)"),
                borderBottom: isActive ? `2px solid ${tab.color}` : "2px solid transparent",
                marginBottom: -1, transition: "color 0.15s", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              {tab.label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 999,
                  background: isActive ? tab.color : (isDark ? "rgba(255,255,255,0.1)" : "var(--gris-200)"),
                  color: isActive ? "#fff" : (isDark ? "var(--gris-400)" : "var(--gris-500)"),
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visibleSolicitudes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: isDark ? "var(--gris-500)" : "var(--gris-400)" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>
            {activeTab === "finalizadas" ? "✅" : activeTab === "canceladas" ? "🚫" : activeTab === "en_curso" ? "📅" : activeTab === "contratadas" ? "🎉" : "📋"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: isDark ? "var(--gris-400)" : "var(--gris-500)" }}>
            {activeTab === "pendiente"   && "Sin solicitudes pendientes"}
            {activeTab === "en_curso"    && "Sin citas próximas"}
            {activeTab === "finalizadas" && "Sin solicitudes finalizadas"}
            {activeTab === "contratadas" && "Sin compras ni contratos aún"}
            {activeTab === "canceladas"  && "Sin solicitudes canceladas"}
          </div>
          <div style={{ fontSize: 12 }}>
            {activeTab === "pendiente"   && "Cuando solicites información o visita para un vehículo aparecerá aquí."}
            {activeTab === "contratadas" && "Aquí aparecerán los vehículos que hayas comprado o contratado en renting."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {visibleSolicitudes.map((item) => {
            const meta = parseMeta(item.meta);
            const typeStyle = TYPE_COLOR[item.type] || TYPE_COLOR.info;
            const statusStyle = STATUS_COLOR[item.status] || { bg: "rgba(94,94,89,0.10)", color: "var(--gris-600)" };
            const isVisit = item.type === "visit";
            const isRenting = item.type === "renting" || meta.portal === "marketplace-vo-renting";
            const isViewingSeller = item.type === "viewing_seller";
            const hasAppt = isVisit && !!meta.appointment_date;
            const isReserved = item.status === "Cita confirmada";
            // appointment box shown when visit has date and not cancelled/reschedule-pending
            const showApptBox = hasAppt && item.status !== "Cancelado" && item.status !== "Reagendar solicitado";
            // action buttons shown when not cancelled and no open dialog
            const canAct = !["Cancelado", "Cerrado", "Descartado", ...CONTRACTED_STATUSES].includes(item.status) && userEmail;
            const isCancelConfirm = cancelId === item.id;
            const isRescheduleForm = rescheduleId === item.id;
            const isConfirmDialog = confirmId === item.id;
            // "Confirmar cita" only when operator has set a date and status is Contactado/En proceso
            const canConfirm = hasAppt && ["Contactado", "En proceso"].includes(item.status);

            // Viewing seller card (P2P viewing request for seller's published IDCar)
            if (isViewingSeller) {
              const proposeUrl = meta.token_seller ? `/cita/proponer?token=${meta.token_seller}` : null;
              const confirmedSlot = meta.confirmed_slot ? new Date(meta.confirmed_slot).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
              return (
                <div key={item.id} style={{ background: isDark ? "rgba(17,17,17,0.7)" : "#fff7ed", border: "1px solid rgba(234,88,12,0.25)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: typeStyle.bg, color: typeStyle.color, border: `1px solid ${typeStyle.border}` }}>📅 Solicitud de visita</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: statusStyle.bg, color: statusStyle.color }}>{VIEWING_STATUS_LABEL[item.status] || item.status}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? "var(--gris-100)" : "var(--gris-900)", marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: isDark ? "var(--gris-400)" : "var(--gris-600)", marginBottom: 6 }}>
                    <strong>Interesado:</strong> {meta.buyer_name || "—"}
                    {meta.buyer_message && <span style={{ fontStyle: "italic" }}> · "{meta.buyer_message}"</span>}
                  </div>
                  {item.status === "confirmed" && confirmedSlot && (
                    <div style={{ background: "#dcfce7", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#166534", fontWeight: 600, marginBottom: 6 }}>
                      ✅ Cita confirmada: {confirmedSlot}
                    </div>
                  )}
                  {item.status === "pending_seller" && proposeUrl && (
                    <a href={proposeUrl} style={{ display: "inline-block", background: "var(--marca)", color: "white", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none", marginTop: 4 }}>
                      Proponer fechas →
                    </a>
                  )}
                  <div style={{ fontSize: 11, color: isDark ? "var(--gris-500)" : "var(--gris-400)", marginTop: 6 }}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString("es-ES") : ""}</div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                style={{
                  background: isDark ? "rgba(17,17,17,0.7)" : "var(--blanco)",
                  border: `1px solid ${isReserved ? (isDark ? "rgba(16,185,129,0.4)" : "#86efac") : showApptBox ? (isDark ? "rgba(255,196,0,0.3)" : "var(--gris-200)") : (isDark ? "rgba(255,255,255,0.07)" : "var(--gris-200)")}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Header row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", alignItems: "start" }}>
                  <div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: typeStyle.bg, color: typeStyle.color, border: `1px solid ${typeStyle.border}` }}>
                        {TYPE_LABEL[item.type] || item.type}
                      </span>
                      <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: statusStyle.bg, color: statusStyle.color }}>
                        {item.status || "Pendiente"}
                      </span>
                      {/* Aquí había una etiqueta verde de «✅ Cita confirmada»,
                          justo al lado de la de estado, que ya dice «Cita
                          confirmada»: el mismo texto dos veces seguidas. Se
                          queda la de estado, que cubre todos los casos. */}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? "var(--gris-100)" : "var(--gris-900)", marginBottom: 3 }}>
                      {item.title || "Vehículo"}
                    </div>
                    {isRenting && meta.when && (
                      <div style={{ fontSize: 12, color: "#059669", fontWeight: 600, marginBottom: 4 }}>
                        🔑 {meta.when}
                      </div>
                    )}
                    {/* La ficha del coche.
                        Una visita del marketplace no trae `vehicle_url` —no viene
                        de un portal— pero sí el identificador de la oferta, y con
                        eso se abre su ficha. Sin esto, quien mira su solicitud no
                        puede volver a ver el coche que pidió sin buscarlo otra
                        vez. */}
                    {/* Y si le hemos propuesto otras horas, elegir una es lo que
                        hay que hacer. Aquí también, y no solo en el recuadro de
                        arriba: ese solo enseña las que no han pasado de fecha, y
                        la hora que pidió puede haber pasado esperando respuesta. */}
                    {item.type === "visita_marketplace" && meta.propuesta &&
                      item.status === ESTADO_CITA.pending && meta.booking_id && meta.token_buyer && (
                      <a
                        href={`/elegir-hora?id=${encodeURIComponent(meta.booking_id)}&token=${encodeURIComponent(meta.token_buyer)}`}
                        style={{
                          display: "inline-block", fontSize: 12, fontWeight: 800,
                          color: "var(--gris-900)", textDecoration: "none",
                          background: "var(--marca, #FFC400)", borderRadius: 8,
                          padding: "6px 12px", marginBottom: 6, marginRight: 8,
                        }}
                      >
                        Elegir hora →
                      </a>
                    )}
                    {item.type === "visita_marketplace" && item.vehicle_id && (
                      <a
                        href={`/marketplace-vo/${encodeURIComponent(item.vehicle_id)}`}
                        style={{
                          display: "inline-block", fontSize: 12, fontWeight: 700,
                          color: "#1d4ed8", textDecoration: "none",
                          borderBottom: "1px solid rgba(37,99,235,0.35)",
                          marginBottom: 6,
                        }}
                      >
                        Ver el coche →
                      </a>
                    )}
                    {meta.vehicle_url && onOpenVehicleDetail && (
                      <button
                        type="button"
                        onClick={() => onOpenVehicleDetail({
                          id: item.vehicle_id || "",
                          title: item.title || "",
                          url: meta.vehicle_url,
                          searchUrl: meta.vehicle_url,
                          portal: meta.portal || "",
                        })}
                        style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: "var(--marca-claro)", cursor: "pointer", textDecoration: "none" }}
                      >
                        Ver anuncio →
                      </button>
                    )}
                    {meta.vehicle_url && !onOpenVehicleDetail && (
                      <a href={meta.vehicle_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--marca-claro)", textDecoration: "none" }}>
                        Ver anuncio →
                      </a>
                    )}
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 11, color: isDark ? "var(--gris-500)" : "var(--gris-400)" }}>{formatDate(item.createdAt)}</div>
                    {meta.portal && (
                      <div style={{ fontSize: 10, color: isDark ? "var(--gris-600)" : "var(--gris-300)", marginTop: 2, textTransform: "capitalize" }}>{meta.portal}</div>
                    )}
                  </div>
                </div>

                {/* Appointment box */}
                {showApptBox && (
                  <div style={{
                    background: isReserved ? (isDark ? "rgba(16,185,129,0.1)" : "var(--gris-50)") : (isDark ? "rgba(255,196,0,0.12)" : "var(--acento-tenue)"),
                    border: `1px solid ${isReserved ? (isDark ? "rgba(16,185,129,0.3)" : "#86efac") : (isDark ? "rgba(255,196,0,0.25)" : "var(--gris-200)")}`,
                    borderRadius: 8, padding: "10px 12px",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isReserved ? "#065f46" : "var(--marca-oscuro)", marginBottom: 6 }}>
                      {isReserved ? "🎉 Cita confirmada" : "📅 Cita asignada por PopCar"}
                    </div>
                    <div style={{ fontSize: 13, color: isDark ? (isReserved ? "#86efac" : "var(--gris-200)") : (isReserved ? "#166534" : "var(--gris-900)"), display: "grid", gap: 3 }}>
                      <div>📅 {formatAppointmentDate(meta.appointment_date)}</div>
                      {meta.appointment_time && <div>⏰ {meta.appointment_time}</div>}
                      {meta.appointment_address && <div>📍 {meta.appointment_address}</div>}
                      {meta.appointment_contact && <div>👤 Pregunta por <strong>{meta.appointment_contact}</strong></div>}
                    </div>
                    {meta.erp_response && (
                      <div style={{ marginTop: 8, fontSize: 12, color: isDark ? "var(--gris-300)" : "var(--gris-900)", borderTop: `1px solid ${isDark ? "rgba(255,196,0,0.2)" : "var(--gris-200)"}`, paddingTop: 8 }}>
                        {meta.erp_response}
                      </div>
                    )}
                  </div>
                )}

                {/* Visit pending — no appointment assigned yet */}
                {isVisit && !hasAppt && item.status === "Pendiente" && (
                  <div style={{ background: isDark ? "rgba(150,150,143,0.07)" : "var(--gris-50)", border: "1px solid rgba(150,150,143,0.25)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, color: isDark ? "var(--gris-400)" : "var(--gris-500)" }}>
                      ⏳ Pendiente de asignación de cita — el equipo de PopCar te contactará para concretar fecha y hora.
                    </div>
                  </div>
                )}

                {/* Non-visit response */}
                {!isVisit && meta.erp_response && item.status !== "Cancelado" && (
                  <div style={{ background: isDark ? "rgba(255,196,0,0.12)" : "var(--acento-tenue)", border: `1px solid ${isDark ? "rgba(255,196,0,0.25)" : "var(--gris-200)"}`, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--marca-oscuro)", marginBottom: 4 }}>💬 Respuesta de PopCar</div>
                    <div style={{ fontSize: 13, color: isDark ? "var(--gris-200)" : "var(--gris-900)", whiteSpace: "pre-wrap" }}>{meta.erp_response}</div>
                  </div>
                )}

                {/* Prompt to confirm cita — shown when operator has set date but client hasn't confirmed yet */}
                {canConfirm && !isCancelConfirm && !isRescheduleForm && !isConfirmDialog && (
                  <div style={{ background: isDark ? "rgba(254,252,232,0.07)" : "#fefce8", border: "2px solid #fbbf24", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                      ⚠️ Confirma tu cita para asegurar el turno
                    </div>
                    <div style={{ fontSize: 12, color: isDark ? "#d97706" : "#78350f", marginBottom: 10 }}>
                      Confirma la cita para que el turno quede asignado a tu nombre. Si no confirmas, puede ser asignado a otro cliente.
                    </div>
                    <button
                      onClick={() => openConfirm(item.id)}
                      style={{ ...btnBase, background: "#059669", color: "#fff", borderColor: "#059669", fontSize: 13, padding: "8px 18px" }}
                    >
                      ✅ Confirmar cita
                    </button>
                  </div>
                )}

                {/* Post-visit: client decides outcome (not shown for renting) */}
                {item.status === "Visita realizada" && outcomeId !== item.id && !isRenting && (
                  <div style={{ background: isDark ? "rgba(94,94,89,0.08)" : "var(--gris-100)", border: "1px solid rgba(94,94,89,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gris-600)", marginBottom: 6 }}>
                      👋 ¿Te convenció el vehículo?
                    </div>
                    <div style={{ fontSize: 12, color: isDark ? "var(--gris-400)" : "var(--gris-500)", marginBottom: 10 }}>
                      Cuéntanos si quieres seguir adelante con la compra o si finalmente no es lo que buscabas.
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => setOutcomeId(item.id)}
                        style={{ ...btnBase, background: "#059669", color: "#fff", borderColor: "#059669", fontSize: 12, padding: "7px 14px" }}
                      >
                        Quiero comprarlo
                      </button>
                      <button
                        onClick={() => handleOutcome(item.id, "not_interested")}
                        disabled={outcomeLoading}
                        style={{ ...btnBase, background: isDark ? "rgba(94,94,89,0.1)" : "var(--gris-100)", color: "var(--gris-600)", borderColor: "rgba(94,94,89,0.25)", fontSize: 12, padding: "7px 14px", opacity: outcomeLoading ? 0.6 : 1 }}
                      >
                        No me convence
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirm purchase intent (not shown for renting) */}
                {item.status === "Visita realizada" && outcomeId === item.id && !isRenting && (
                  <div style={{ background: isDark ? "rgba(5,150,105,0.1)" : "var(--gris-50)", border: "1px solid #86efac", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#065f46", marginBottom: 8 }}>
                      Nos pondremos en contacto contigo para gestionar la compra. ¿Confirmamos?
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleOutcome(item.id, "interested")}
                        disabled={outcomeLoading}
                        style={{ ...btnBase, background: "#059669", color: "#fff", borderColor: "#059669", opacity: outcomeLoading ? 0.6 : 1 }}
                      >
                        {outcomeLoading ? "Enviando…" : "Sí, quiero seguir adelante"}
                      </button>
                      <button
                        onClick={() => setOutcomeId(null)}
                        disabled={outcomeLoading}
                        style={{ ...btnBase, background: "transparent", color: isDark ? "var(--gris-400)" : "var(--gris-500)", borderColor: isDark ? "rgba(255,255,255,0.15)" : "var(--gris-200)" }}
                      >
                        Ahora no
                      </button>
                    </div>
                  </div>
                )}

                {/* Contratado / Vendido / Cerrado confirmation */}
                {(CONTRACTED_STATUSES.includes(item.status) || item.status === "Cerrado") && (
                  <div style={{ background: isDark ? "rgba(5,150,105,0.1)" : "var(--gris-50)", border: "1px solid #86efac", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#065f46", fontWeight: 600 }}>
                    {(isRenting || item.status === "Renting confirmado")
                      ? "🔑 ¡Renting confirmado! El equipo de PopCar se pondrá en contacto contigo para gestionar tu contrato."
                      : "🎉 ¡Compra confirmada! El equipo de PopCar se pondrá en contacto contigo para los próximos pasos."}
                  </div>
                )}

                {/* Interesado — waiting for operator */}
                {item.status === "Interesado" && (
                  <div style={{ background: isDark ? "rgba(255,196,0,0.08)" : "var(--gris-50)", border: "1px solid var(--gris-200)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--gris-800)" }}>
                    ⏳ Hemos recibido tu interés. El equipo de PopCar se pondrá en contacto contigo para gestionar la compra.
                  </div>
                )}

                {/* Cancelled */}
                {item.status === "Cancelado" && (
                  <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#b91c1c" }}>
                    {isRenting ? "❌ Solicitud de renting anulada" : "❌ Cita anulada"}
                  </div>
                )}

                {/* Reschedule requested */}
                {item.status === "Reagendar solicitado" && (
                  <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>🔄 Solicitud de cambio de fecha enviada</div>
                    <div style={{ fontSize: 12, color: isDark ? "#d97706" : "#78350f", marginBottom: parseMeta(item.meta).reschedule_proposals?.length > 0 ? 8 : 0 }}>
                      El equipo de PopCar está procesando tu solicitud y te confirmará una nueva fecha pronto.
                    </div>
                    {parseMeta(item.meta).reschedule_proposals?.length > 0 && (
                      <div style={{ fontSize: 11, color: isDark ? "#92400e" : "#78350f" }}>
                        <span style={{ fontWeight: 700 }}>Fechas que propusiste:</span>
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2 }}>
                          {parseMeta(item.meta).reschedule_proposals.map((p, i) => (
                            <li key={i}>
                              {formatAppointmentDate(p.date)}{p.time ? ` a las ${p.time}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                {canAct && !isCancelConfirm && !isRescheduleForm && !isConfirmDialog && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {isVisit && hasAppt && item.status !== "Reagendar solicitado" && (
                      <button
                        onClick={() => openReschedule(item.id)}
                        style={{ ...btnBase, background: isDark ? "rgba(255,196,0,0.1)" : "var(--acento-tenue)", color: "var(--marca)", borderColor: "rgba(255,196,0,0.3)" }}
                      >
                        📅 Solicitar cambio de fecha
                      </button>
                    )}
                    <button
                      onClick={() => openCancel(item.id)}
                      style={{ ...btnBase, background: isDark ? "rgba(239,68,68,0.08)" : "var(--gris-100)", color: "#dc2626", borderColor: "rgba(239,68,68,0.25)" }}
                    >
                      {isRenting ? "Anular solicitud" : "Anular cita"}
                    </button>
                  </div>
                )}

                {/* Confirm dialog */}
                {isConfirmDialog && (
                  <div style={{ background: isDark ? "rgba(5,150,105,0.1)" : "var(--gris-50)", border: "1px solid #86efac", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#065f46", marginBottom: 8 }}>
                      ¿Confirmas la cita? El turno quedará asignado a tu nombre.
                    </div>
                    {actionError && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{actionError}</div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleConfirm(item.id)}
                        disabled={actionLoading}
                        style={{ ...btnBase, background: "#059669", color: "#fff", borderColor: "#059669", opacity: actionLoading ? 0.6 : 1 }}
                      >
                        {actionLoading ? "Confirmando…" : "✅ Sí, confirmar cita"}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        disabled={actionLoading}
                        style={{ ...btnBase, background: "transparent", color: isDark ? "var(--gris-400)" : "var(--gris-500)", borderColor: isDark ? "rgba(255,255,255,0.15)" : "var(--gris-200)" }}
                      >
                        Ahora no
                      </button>
                    </div>
                  </div>
                )}

                {/* Cancel confirmation */}
                {isCancelConfirm && (
                  <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c", marginBottom: 8 }}>
                      {isRenting ? "¿Seguro que quieres anular esta solicitud de renting?" : "¿Seguro que quieres anular esta cita?"}
                      {isReserved && !isRenting && <span style={{ display: "block", fontSize: 12, fontWeight: 400, marginTop: 4 }}>La reserva del vehículo también se cancelará.</span>}
                    </div>
                    {actionError && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{actionError}</div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleCancel(item.id)}
                        disabled={actionLoading}
                        style={{ ...btnBase, background: "#dc2626", color: "#fff", borderColor: "#dc2626", opacity: actionLoading ? 0.6 : 1 }}
                      >
                        {actionLoading ? "Anulando…" : "Confirmar anulación"}
                      </button>
                      <button
                        onClick={() => setCancelId(null)}
                        disabled={actionLoading}
                        style={{ ...btnBase, background: "transparent", color: isDark ? "var(--gris-400)" : "var(--gris-500)", borderColor: isDark ? "rgba(255,255,255,0.15)" : "var(--gris-200)" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Reschedule form */}
                {isRescheduleForm && (
                  <div style={{ background: isDark ? "rgba(255,196,0,0.07)" : "var(--gris-50)", border: "1px solid rgba(255,196,0,0.2)", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "var(--gris-300)" : "var(--marca-oscuro)", marginBottom: 10 }}>
                      📅 Propón hasta 3 opciones de fecha y hora
                    </div>
                    <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                      {proposals.map((p, idx) => (
                        <div key={idx} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: isDark ? "var(--gris-500)" : "var(--gris-400)", minWidth: 56, flexShrink: 0 }}>Opción {idx + 1}</span>
                          <input
                            type="date"
                            value={p.date}
                            onChange={(e) => updateProposal(idx, "date", e.target.value)}
                            style={{ flex: "1 1 120px", minWidth: 120, border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "var(--gris-300)"}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, background: isDark ? "rgba(17,17,17,0.5)" : "#fff", color: isDark ? "var(--gris-100)" : "var(--gris-900)" }}
                          />
                          <input
                            type="time"
                            value={p.time}
                            onChange={(e) => updateProposal(idx, "time", e.target.value)}
                            style={{ flex: "1 1 80px", minWidth: 80, border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "var(--gris-300)"}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, background: isDark ? "rgba(17,17,17,0.5)" : "#fff", color: isDark ? "var(--gris-100)" : "var(--gris-900)" }}
                          />
                          {proposals.length > 1 && (
                            <button
                              onClick={() => setProposals((prev) => prev.filter((_, i) => i !== idx))}
                              style={{ fontSize: 16, lineHeight: 1, background: "none", border: "none", cursor: "pointer", color: "var(--gris-400)", padding: "0 4px", flexShrink: 0 }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {proposals.length < 3 && (
                      <button
                        onClick={() => setProposals((prev) => [...prev, { date: "", time: "" }])}
                        style={{ ...btnBase, background: "transparent", color: "var(--marca-claro)", borderColor: "rgba(255,196,0,0.3)", marginBottom: 10 }}
                      >
                        + Añadir otra opción
                      </button>
                    )}
                    {actionError && (
                      <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>{actionError}</div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleReschedule(item.id)}
                        disabled={actionLoading}
                        style={{ ...btnBase, background: "var(--marca)", color: "#fff", borderColor: "var(--marca)", opacity: actionLoading ? 0.6 : 1 }}
                      >
                        {actionLoading ? "Enviando…" : "Enviar solicitud"}
                      </button>
                      <button
                        onClick={() => { setRescheduleId(null); setActionError(""); }}
                        disabled={actionLoading}
                        style={{ ...btnBase, background: "transparent", color: isDark ? "var(--gris-400)" : "var(--gris-500)", borderColor: isDark ? "rgba(255,255,255,0.15)" : "var(--gris-200)" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
