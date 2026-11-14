import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { categories } from "../db/schema.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { conflict, notFound } from "../utils/errors.js";
import { idParam } from "../utils/pagination.js";

export const categoriesRouter = Router();

const bodySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).nullable().optional(),
});

// Public
categoriesRouter.get("/", async (_req, res) => {
  res.json(await db.select().from(categories).orderBy(categories.name));
});

categoriesRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const [row] = await db.select().from(categories).where(eq(categories.id, id));
  if (!row) throw notFound("Category not found");
  res.json(row);
});

// Admin only
categoriesRouter.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const body = bodySchema.parse(req.body);
    const [exists] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, body.name));
    if (exists) throw conflict("Category already exists");
    const [row] = await db.insert(categories).values(body).returning();
    res.status(201).json(row);
  },
);

categoriesRouter.put(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const { id } = idParam.parse(req.params);
    const body = bodySchema.parse(req.body);
    const [row] = await db
      .update(categories)
      .set(body)
      .where(eq(categories.id, id))
      .returning();
    if (!row) throw notFound("Category not found");
    res.json(row);
  },
);

categoriesRouter.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const { id } = idParam.parse(req.params);
    const [row] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning();
    if (!row) throw notFound("Category not found");
    res.status(204).end();
  },
);
