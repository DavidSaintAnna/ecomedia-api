import { count, sql } from "drizzle-orm";
import { Router } from "express";
import { categories, comments, likes, posts, users } from "../db/schema.js";
import { db } from "../db/index.js";

export const statsRouter = Router();

statsRouter.get("/", async (_req, res) => {
  const [[u], [p], [c], [l], [cat], [cities]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(posts),
    db.select({ n: count() }).from(comments),
    db.select({ n: count() }).from(likes),
    db.select({ n: count() }).from(categories),
    db
      .select({ n: sql<number>`count(distinct lower(${posts.city}))::int` })
      .from(posts),
  ]);
  res.json({
    users: u.n,
    posts: p.n,
    comments: c.n,
    likes: l.n,
    categories: cat.n,
    cities: cities.n,
  });
});
