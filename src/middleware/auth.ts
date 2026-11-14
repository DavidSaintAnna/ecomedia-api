import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { forbidden, unauthorized } from "../utils/errors.js";

export type Role = "USER" | "ADMIN";
export interface AuthUser {
  id: number;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized();
  try {
    const payload = jwt.verify(
      header.slice(7),
      config.jwtSecret,
    ) as jwt.JwtPayload;
    req.user = { id: Number(payload.sub), role: payload.role as Role };
    next();
  } catch {
    throw unauthorized("Invalid or expired token");
  }
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
