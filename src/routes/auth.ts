import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { authenticate, signToken } from "../middleware/auth.js";
import { conflict, notFound, unauthorized } from "../utils/errors.js";

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "Too many attempts, try again later",
  },
});

const email = z.string().trim().toLowerCase().pipe(z.email());

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password: z.string().min(8).max(72),
  city: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(500).optional(),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1),
});

const publicUser = (u: typeof users.$inferSelect) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  city: u.city,
  bio: u.bio,
  avatarUrl: u.avatarUrl,
  createdAt: u.createdAt,
});

authRouter.post("/register", limiter, async (req, res) => {
  const body = registerSchema.parse(req.body);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email));
  if (existing) throw conflict("Email already registered");

  const { password, ...rest } = body;
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ ...rest, passwordHash })
    .returning();

  res
    .status(201)
    .json({
      user: publicUser(user),
      token: signToken({ id: user.id, role: user.role }),
    });
});

authRouter.post("/login", limiter, async (req, res) => {
  const body = loginSchema.parse(req.body);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email));
  const valid =
    user && (await bcrypt.compare(body.password, user.passwordHash));
  if (!valid) throw unauthorized("Invalid email or password");

  res.json({
    user: publicUser(user),
    token: signToken({ id: user.id, role: user.role }),
  });
});

authRouter.get("/me", authenticate, async (req, res) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user!.id));
  if (!user) throw notFound("User no longer exists");
  res.json(publicUser(user));
});
