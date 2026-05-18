import { useState } from "react";

export default function UserDashboardSolicitudes({
  themeMode,
  userSolicitudes = [],
  panelStyle,
  getOfferBadgeStyle,
  userEmail = "",
}) {
  const isDark = themeMode === "dark";

  const [localSolicitudes, setLocalSolicitudes] = useState(userSolicitudes);
  const [cancelId, setCancelId]       = useState(null);
  const [rescheduleId, setRescheduleId] = useState(null);
  const [proposals, setProposals]     = useState([{ date: "", time: "" }]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const TYPE_LABEL = {
    info:     "Solicitar info",
    visit:    "Agendar visita",
    question: "Preguntar",
  };
  const TYPE_COLOR = {
    info:     { bg: "rgba(59,130,246,0.12)", color: "#1d4ed8", border: "rgba(59,130,246,0.25)" },
    visit:    { bg: "rgba(16,185,129,0.12)", color: "#065f46", border: "rgba(16,185,129,0.25)" },
    question: { bg: "rgba(139,92,246,0.12)", color: "#5b21b6", border: "rgba(139,92,246,0.25)" },
  };
  const STATUS_COLOR = {
    Pendiente:              { bg: "rgba(245,158,11,0.12)",  color: "#92400e" },
    Contactado:             { bg: "rgba(59,130,246,0.12)",  color: "#1d4ed8" },
    "En proceso":           { bg: "rgba(139,92,246,0.12)",  color: "#5b21b6" },
    Cerrado:                { bg: "rgba(16,185,129,0.12)",  color: "#065f46" },
    Descartado:             { bg: "rgba(100,116,139,0.10)", color: "#475569" },
    "Reagendar solicitado": { bg: "rgba(245,158,11,0.12)",  color: "#92400e" },
    Cancelado:              { bg: "rgba(239,68,68,0.10)",   color: "#b91c1c" },
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

  function formatAppointmentDate(dateStr) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } catch { return dateStr; }
  }

  function formatProposalDate(dateStr) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "long" });
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

  function openReschedule(id) {
    setRescheduleId(id);
    setCancelId(null);
    setProposals([{ date: "", time: "" }]);
    setActionError("");
  }

  function openCancel(id) {
    setCancelId(id);
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

  return (
    <section style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "#3b82f6", letterSpacing: "0.6px", fontWeight: 700, textTransform: "uppercase" }}>Mis solicitudes</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>Solicitudes de vehículos</div>
          <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", marginTop: 2 }}>Información, visitas y consultas sobre coches que te han interesado</div>
        </div>
        <span style={{ ...getOfferBadgeStyle("blue"), fontSize: 11 }}>{localSolicitudes.length} solicitud{localSolicitudes.length !== 1 ? "es" : ""}</span>
      </div>

      {localSolicitudes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: isDark ? "#64748b" : "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: isDark ? "#94a3b8" : "#64748b" }}>Sin solicitudes aún</div>
          <div style={{ fontSize: 12 }}>Cuando solicites información o visita para un vehículo aparecerá aquí.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {localSolicitudes.map((item) => {
            const meta = parseMeta(item.meta);
            const typeStyle = TYPE_COLOR[item.type] || TYPE_COLOR.info;
            const statusStyle = STATUS_COLOR[item.status] || { bg: "rgba(100,116,139,0.10)", color: "#475569" };
            const hasResponse = meta.erp_response || meta.appointment_date;
            const isVisit = item.type === "visit";
            const isConfirmed = isVisit && meta.appointment_date && item.status !== "Cancelado" && item.status !== "Reagendar solicitado";
            const isCancelConfirm = cancelId === item.id;
            const isRescheduleForm = rescheduleId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  background: isDark ? "rgba(15,23,42,0.7)" : "#ffffff",
                  border: `1px solid ${hasResponse ? (isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe") : (isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0")}`,
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
                      {meta.notified_at && item.status !== "Cancelado" && (
                        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(16,185,129,0.12)", color: "#065f46" }}>
                          ✓ Respondido
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 3 }}>
                      {item.title || "Vehículo"}
                    </div>
                    {meta.vehicle_url && (
                      <a href={meta.vehicle_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none" }}>
                        Ver anuncio →
                      </a>
                    )}
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 11, color: isDark ? "#64748b" : "#94a3b8" }}>{formatDate(item.createdAt)}</div>
                    {meta.portal && (
                      <div style={{ fontSize: 10, color: isDark ? "#475569" : "#cbd5e1", marginTop: 2, textTransform: "capitalize" }}>{meta.portal}</div>
                    )}
                  </div>
                </div>

                {/* Confirmed appointment box */}
                {hasResponse && item.status !== "Cancelado" && (
                  <div style={{ background: isDark ? "rgba(37,99,235,0.12)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(59,130,246,0.25)" : "#bfdbfe"}`, borderRadius: 8, padding: "10px 12px" }}>
                    {isVisit && meta.appointment_date ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", marginBottom: 6 }}>✅ Cita confirmada</div>
                        <div style={{ fontSize: 13, color: isDark ? "#bfdbfe" : "#1e40af", display: "grid", gap: 3 }}>
                          <div>📅 {formatAppointmentDate(meta.appointment_date)}</div>
                          {meta.appointment_time && <div>⏰ {meta.appointment_time}</div>}
                          {meta.appointment_address && <div>📍 {meta.appointment_address}</div>}
                          {meta.appointment_contact && <div>👤 Pregunta por <strong>{meta.appointment_contact}</strong></div>}
                        </div>
                        {meta.erp_response && (
                          <div style={{ marginTop: 8, fontSize: 12, color: isDark ? "#93c5fd" : "#1e40af", borderTop: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, paddingTop: 8 }}>
                            {meta.erp_response}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", marginBottom: 4 }}>💬 Respuesta de CarsWise</div>
                        <div style={{ fontSize: 13, color: isDark ? "#bfdbfe" : "#1e40af", whiteSpace: "pre-wrap" }}>{meta.erp_response}</div>
                      </>
                    )}
                  </div>
                )}

                {/* Cancelled */}
                {item.status === "Cancelado" && (
                  <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#b91c1c" }}>
                    ❌ Cita anulada
                  </div>
                )}

                {/* Reschedule requested */}
                {item.status === "Reagendar solicitado" && (
                  <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>🔄 Solicitud de cambio de fecha enviada</div>
                    <div style={{ fontSize: 12, color: isDark ? "#d97706" : "#78350f" }}>
                      El equipo de CarsWise está procesando tu solicitud y te confirmará una nueva fecha pronto.
                    </div>
                  </div>
                )}

                {/* Action buttons — only for confirmed visits not yet cancelled/rescheduled */}
                {isConfirmed && userEmail && !isCancelConfirm && !isRescheduleForm && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => openReschedule(item.id)}
                      style={{ ...btnBase, background: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff", color: "#2563eb", borderColor: "rgba(59,130,246,0.3)" }}
                    >
                      📅 Solicitar cambio de fecha
                    </button>
                    <button
                      onClick={() => openCancel(item.id)}
                      style={{ ...btnBase, background: isDark ? "rgba(239,68,68,0.08)" : "#fef2f2", color: "#dc2626", borderColor: "rgba(239,68,68,0.25)" }}
                    >
                      Anular cita
                    </button>
                  </div>
                )}

                {/* Cancel confirmation */}
                {isCancelConfirm && (
                  <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c", marginBottom: 8 }}>
                      ¿Seguro que quieres anular esta cita?
                    </div>
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
                        style={{ ...btnBase, background: "transparent", color: isDark ? "#94a3b8" : "#64748b", borderColor: isDark ? "rgba(255,255,255,0.15)" : "#e2e8f0" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Reschedule form */}
                {isRescheduleForm && (
                  <div style={{ background: isDark ? "rgba(59,130,246,0.07)" : "#f0f9ff", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#93c5fd" : "#1d4ed8", marginBottom: 10 }}>
                      📅 Propón hasta 3 opciones de fecha y hora
                    </div>
                    <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                      {proposals.map((p, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: isDark ? "#64748b" : "#94a3b8", minWidth: 60 }}>Opción {idx + 1}</span>
                          <input
                            type="date"
                            value={p.date}
                            onChange={(e) => updateProposal(idx, "date", e.target.value)}
                            style={{ flex: 1, border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#cbd5e1"}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, background: isDark ? "rgba(15,23,42,0.5)" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }}
                          />
                          <input
                            type="time"
                            value={p.time}
                            onChange={(e) => updateProposal(idx, "time", e.target.value)}
                            style={{ width: 90, border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#cbd5e1"}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, background: isDark ? "rgba(15,23,42,0.5)" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }}
                          />
                          {proposals.length > 1 && (
                            <button
                              onClick={() => setProposals((prev) => prev.filter((_, i) => i !== idx))}
                              style={{ fontSize: 16, lineHeight: 1, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0 2px" }}
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
                        style={{ ...btnBase, background: "transparent", color: "#3b82f6", borderColor: "rgba(59,130,246,0.3)", marginBottom: 10 }}
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
                        style={{ ...btnBase, background: "#2563eb", color: "#fff", borderColor: "#2563eb", opacity: actionLoading ? 0.6 : 1 }}
                      >
                        {actionLoading ? "Enviando…" : "Enviar solicitud"}
                      </button>
                      <button
                        onClick={() => { setRescheduleId(null); setActionError(""); }}
                        disabled={actionLoading}
                        style={{ ...btnBase, background: "transparent", color: isDark ? "#94a3b8" : "#64748b", borderColor: isDark ? "rgba(255,255,255,0.15)" : "#e2e8f0" }}
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
