import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { categories, comments, likes, posts, users } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { idParam, paginated, paginationSchema } from "../utils/pagination.js";

export const postsRouter = Router();

// Only http(s) image links, so the front-end never renders javascript: URLs
const imageUrl = z.url({ protocol: /^https?$/ }).max(500);

const createSchema = z.object({
  categoryId: z.number().int().positive(),
  content: z.string().trim().min(3).max(1000),
  imageUrl: imageUrl.optional(),
  city: z.string().trim().min(1).max(100).optional(),
});

const updateSchema = z
  .object({
    categoryId: z.number().int().positive(),
    content: z.string().trim().min(3).max(1000),
    imageUrl: imageUrl.nullable(),
    city: z.string().trim().min(1).max(100).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Send at least one field to update",
  });

const listQuery = paginationSchema.extend({
  q: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  authorId: z.coerce.number().int().positive().optional(),
});

// One select used by every endpoint, so the post always has the same shape
const selectPost = () =>
  db
    .select({
      id: posts.id,
      content: posts.content,
      imageUrl: posts.imageUrl,
      city: posts.city,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      author: { id: users.id, name: users.name, avatarUrl: users.avatarUrl },
      category: { id: categories.id, name: categories.name },
      likesCount: sql<number>`(select count(*)::int from ${likes} where ${likes.postId} = ${posts.id})`,
      commentsCount: sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id})`,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .innerJoin(categories, eq(categories.id, posts.categoryId));

async function loadPost(id: number) {
  const [row] = await selectPost().where(eq(posts.id, id));
  if (!row) throw notFound("Post not found");
  return row;
}

async function assertCategory(id: number) {
  const [c] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, id));
  if (!c) throw badRequest("categoryId does not exist");
}

// GET /posts: public, filterable and paginated
postsRouter.get("/", async (req, res) => {
  const { page, limit, q, city, categoryId, authorId } = listQuery.parse(
    req.query,
  );

  const conditions = [];
  if (q) conditions.push(ilike(posts.content, `%${q}%`));
  if (city) conditions.push(ilike(posts.city, `%${city}%`));
  if (categoryId) conditions.push(eq(posts.categoryId, categoryId));
  if (authorId) conditions.push(eq(posts.authorId, authorId));
  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(posts)
    .where(where);
  const rows = await selectPost()
    .where(where)
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json(paginated(rows, total, page, limit));
});

// GET /posts/:id: public
postsRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await loadPost(id));
});

// POST /posts: logged-in users
postsRouter.post("/", authenticate, async (req, res) => {
  const body = createSchema.parse(req.body);
  await assertCategory(body.categoryId);

  // If no city is sent, use the author's own city
  let city = body.city;
  if (!city) {
    const [me] = await db
      .select({ city: users.city })
      .from(users)
      .where(eq(users.id, req.user!.id));
    city = me?.city ?? undefined;
  }

  const [created] = await db
    .insert(posts)
    .values({ ...body, city, authorId: req.user!.id })
    .returning({ id: posts.id });

  res.status(201).json(await loadPost(created.id));
});

// Author or admin only
async function assertCanEdit(
  postId: number,
  user: { id: number; role: string },
) {
  const [post] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!post) throw notFound("Post not found");
  if (user.role !== "ADMIN" && post.authorId !== user.id)
    throw forbidden("You can only change your own posts");
}

// PATCH /posts/:id
postsRouter.patch("/:id", authenticate, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = updateSchema.parse(req.body);
  await assertCanEdit(id, req.user!);
  if (body.categoryId) await assertCategory(body.categoryId);

  await db
    .update(posts)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(posts.id, id));
  res.json(await loadPost(id));
});

// DELETE /posts/:id
postsRouter.delete("/:id", authenticate, async (req, res) => {
  const { id } = idParam.parse(req.params);
  await assertCanEdit(id, req.user!);
  await db.delete(posts).where(eq(posts.id, id));
  res.status(204).end();
});
