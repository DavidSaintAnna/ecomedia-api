import { count, desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db/index.js";
import { follows, posts } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { paginated, paginationSchema } from "../utils/pagination.js";
import { selectPost } from "./posts.js";

export const feedRouter = Router();

// GET /feed: posts from the people I follow, newest first
feedRouter.get("/", authenticate, async (req, res) => {
  const { page, limit } = paginationSchema.parse(req.query);
  const me = req.user!.id;

  const followed = db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, me));
  const where = inArray(posts.authorId, followed);

  const [{ total }] = await db
    .select({ total: count() })
    .from(posts)
    .where(where);
  const rows = await selectPost(me)
    .where(where)
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json(paginated(rows, total, page, limit));
});
