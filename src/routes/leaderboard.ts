import { count, countDistinct, desc, eq, ilike } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { likes, posts, users } from "../db/schema.js";

export const leaderboardRouter = Router();

const query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  city: z.string().trim().min(1).optional(),
});

leaderboardRouter.get("/", async (req, res) => {
  const { limit, city } = query.parse(req.query);

  const likesReceived = count(likes.postId);
  const postsCount = countDistinct(posts.id);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      city: users.city,
      avatarUrl: users.avatarUrl,
      postsCount,
      likesReceived,
    })
    .from(users)
    .innerJoin(posts, eq(posts.authorId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(city ? ilike(users.city, `%${city}%`) : undefined)
    .groupBy(users.id)
    .orderBy(desc(likesReceived), desc(postsCount), users.id)
    .limit(limit);

  res.json(rows.map((r, i) => ({ rank: i + 1, ...r })));
});
