import { and, count, eq } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db/index.js";
import { likes, posts } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { notFound } from "../utils/errors.js";
import { idParam } from "../utils/pagination.js";

export const likesRouter = Router();

// POST /posts/:id/like: toggles. First call likes, second call removes the like.
likesRouter.post("/posts/:id/like", authenticate, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const userId = req.user!.id;

  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, id));
  if (!post) throw notFound("Post not found");

  const removed = await db
    .delete(likes)
    .where(and(eq(likes.postId, id), eq(likes.userId, userId)))
    .returning();

  let liked = false;
  if (removed.length === 0) {
    await db.insert(likes).values({ postId: id, userId }).onConflictDoNothing();
    liked = true;
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(likes)
    .where(eq(likes.postId, id));
  res.json({ liked, likesCount: total });
});
