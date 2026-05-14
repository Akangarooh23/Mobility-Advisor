import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { createTicket, listTickets, TicketPriority, TicketStatus, updateTicket } from "../data/store.js";

export const ticketsRouter = Router();

ticketsRouter.get("/tickets", requireRole(["admin", "support", "operations", "sales"]), async (req, res) => {
  try {
    const data = await listTickets({ q: String(req.query.q || ""), status: String(req.query.status || "") });
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: "tickets_list_failed", detail: error instanceof Error ? error.message : String(error) });
  }
});

ticketsRouter.post("/tickets", requireRole(["admin", "support", "operations", "sales"]), async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim();
  const userId = String(req.body?.userId || "").trim();
  const priority = String(req.body?.priority || "medium") as TicketPriority;
  const channel = String(req.body?.channel || "web") as "web" | "phone" | "email";

  if (!title || !description || !userId) {
    return res.status(400).json({ ok: false, error: "invalid_payload" });
  }

  try {
    const ticket = await createTicket({
      userId,
      title,
      description,
      priority: priority === "low" || priority === "high" || priority === "urgent" ? priority : "medium",
      channel: channel === "phone" || channel === "email" ? channel : "web",
      actor: req.user?.id || "system",
    });
    res.status(201).json({ ok: true, data: ticket });
  } catch (error) {
    res.status(500).json({ ok: false, error: "ticket_create_failed", detail: error instanceof Error ? error.message : String(error) });
  }
});

ticketsRouter.patch("/tickets/:id", requireRole(["admin", "support", "operations"]), async (req, res) => {
  const nextStatus = String(req.body?.status || "") as TicketStatus;
  const assignee = String(req.body?.assignee || "").trim();
  const note = String(req.body?.note || "").trim();

  try {
    const ticket = await updateTicket({
      ticketId: req.params.id,
      status:
        nextStatus === "open" || nextStatus === "in_progress" || nextStatus === "waiting_customer" || nextStatus === "resolved"
          ? nextStatus
          : undefined,
      assignee: assignee || undefined,
      note: note || undefined,
      actor: req.user?.id || "system",
    });

    if (!ticket) {
      return res.status(404).json({ ok: false, error: "ticket_not_found" });
    }

    res.json({ ok: true, data: ticket });
  } catch (error) {
    res.status(500).json({ ok: false, error: "ticket_update_failed", detail: error instanceof Error ? error.message : String(error) });
  }
});
