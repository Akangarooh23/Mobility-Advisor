import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { getUserById, listUsers, updateUserStatus, UserStatus } from "../data/store.js";

export const usersRouter = Router();

usersRouter.get("/users", requireRole(["admin", "support", "operations", "sales"]), async (req, res) => {
  try {
    const data = await listUsers({
      q: String(req.query.q || ""),
      status: String(req.query.status || ""),
    });
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: "users_list_failed", detail: error instanceof Error ? error.message : String(error) });
  }
});

usersRouter.get("/users/:id", requireRole(["admin", "support", "operations", "sales"]), async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ ok: false, error: "user_not_found" });
    }

    res.json({ ok: true, data: user });
  } catch (error) {
    res.status(500).json({ ok: false, error: "user_get_failed", detail: error instanceof Error ? error.message : String(error) });
  }
});

usersRouter.patch("/users/:id/status", requireRole(["admin", "support", "operations"]), async (req, res) => {
  const nextStatus = String(req.body?.status || "") as UserStatus;
  if (nextStatus !== "active" && nextStatus !== "at_risk" && nextStatus !== "blocked") {
    return res.status(400).json({ ok: false, error: "invalid_status" });
  }

  try {
    const user = await updateUserStatus(req.params.id, nextStatus);
    if (!user) {
      return res.status(404).json({ ok: false, error: "user_not_found" });
    }

    res.json({ ok: true, data: user });
  } catch (error) {
    res.status(500).json({ ok: false, error: "user_update_failed", detail: error instanceof Error ? error.message : String(error) });
  }
});
