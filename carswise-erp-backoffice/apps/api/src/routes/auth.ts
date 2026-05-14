import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { UserRole } from "../middleware/auth.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authRouter = Router();

type StaffUser = { email: string; password: string; role: UserRole };

const STAFF_USERS: StaffUser[] = [
  {
    email: "admin@carswise.local",
    password: String(process.env.ERP_ADMIN_PASSWORD || "admin123456"),
    role: "admin",
  },
  {
    email: "support@carswise.local",
    password: String(process.env.ERP_SUPPORT_PASSWORD || "support123456"),
    role: "support",
  },
  {
    email: "ops@carswise.local",
    password: String(process.env.ERP_OPS_PASSWORD || "ops123456"),
    role: "operations",
  },
  {
    email: "sales@carswise.local",
    password: String(process.env.ERP_SALES_PASSWORD || "sales123456"),
    role: "sales",
  },
];

authRouter.post("/auth/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "invalid_payload" });
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;
  const user = STAFF_USERS.find((item) => item.email === email && item.password === password);
  if (!user) {
    return res.status(401).json({ ok: false, error: "invalid_credentials" });
  }

  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  if (!jwtSecret) {
    return res.status(500).json({ ok: false, error: "missing_jwt_secret" });
  }

  const token = jwt.sign({ role: user.role }, jwtSecret, {
    subject: user.email,
    expiresIn: "8h",
  });

  res.json({
    ok: true,
    token,
    user: { id: user.email, role: user.role },
  });
});

authRouter.get("/auth/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  res.json({ ok: true, user: req.user });
});
