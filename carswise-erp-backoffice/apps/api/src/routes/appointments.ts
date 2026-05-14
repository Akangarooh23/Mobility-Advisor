import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { AppointmentStatus, AppointmentType, createAppointment, listAppointments, updateAppointment } from "../data/store.js";

export const appointmentsRouter = Router();

appointmentsRouter.get("/appointments", requireRole(["admin", "support", "operations", "sales"]), async (_req, res) => {
  try {
    const data = await listAppointments();
    res.json({ ok: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ ok: false, error: "appointments_list_failed", detail: error instanceof Error ? error.message : String(error) });
  }
});

appointmentsRouter.post("/appointments", requireRole(["admin", "support", "operations", "sales"]), async (req, res) => {
  const userId = String(req.body?.userId || "").trim();
  const scheduledAt = String(req.body?.scheduledAt || "").trim();
  const type = String(req.body?.type || "inspection") as AppointmentType;

  if (!userId || !scheduledAt) {
    return res.status(400).json({ ok: false, error: "invalid_payload" });
  }

  try {
    const appointment = await createAppointment({
      userId,
      scheduledAt,
      type: type === "delivery" || type === "follow_up" ? type : "inspection",
      agent: String(req.body?.agent || "unassigned").trim() || "unassigned",
      notes: String(req.body?.notes || "").trim(),
    });

    res.status(201).json({ ok: true, data: appointment });
  } catch (error) {
    res
      .status(500)
      .json({ ok: false, error: "appointment_create_failed", detail: error instanceof Error ? error.message : String(error) });
  }
});

appointmentsRouter.patch("/appointments/:id", requireRole(["admin", "support", "operations"]), async (req, res) => {
  const status = String(req.body?.status || "") as AppointmentStatus;
  const scheduledAt = String(req.body?.scheduledAt || "").trim();

  try {
    const appointment = await updateAppointment({
      appointmentId: req.params.id,
      status: status === "scheduled" || status === "confirmed" || status === "completed" || status === "cancelled" ? status : undefined,
      scheduledAt: scheduledAt || undefined,
      notes: typeof req.body?.notes === "string" ? req.body.notes.trim() : undefined,
    });

    if (!appointment) {
      return res.status(404).json({ ok: false, error: "appointment_not_found" });
    }

    res.json({ ok: true, data: appointment });
  } catch (error) {
    res
      .status(500)
      .json({ ok: false, error: "appointment_update_failed", detail: error instanceof Error ? error.message : String(error) });
  }
});
