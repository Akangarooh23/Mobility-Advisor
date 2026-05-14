import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type UserRole = "admin" | "support" | "operations" | "sales";
type TokenPayload = { sub: string; role: UserRole };

function normalizeRole(input: unknown): UserRole {
  const value = String(input || "").toLowerCase().trim();
  if (value === "support" || value === "operations" || value === "sales") {
    return value;
  }
  return "admin";
}

export function withUser(req: Request, _res: Response, next: NextFunction) {
  const authHeader = String(req.header("authorization") || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  if (!token || !jwtSecret) {
    return next();
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as TokenPayload;
    req.user = {
      id: String(payload.sub || "").trim(),
      role: normalizeRole(payload.role),
    };
  } catch {
    req.user = undefined;
  }

  next();
}

export function requireRole(allowed: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    next();
  };
}
