import { and, count, desc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { follows, posts, users } from "../db/schema.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";
import { badRequest, notFound } from "../utils/errors.js";
import { idParam, paginated, paginationSchema } from "../utils/pagination.js";

export const usersRouter = Router();

// Only http(s) links, so the front-end never renders javascript: URLs
const avatarUrl = z.url({ protocol: /^https?$/ }).max(500);

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    city: z.string().trim().min(1).max(100).nullable(),
    bio: z.string().trim().max(500).nullable(),
    avatarUrl: avatarUrl.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Send at least one field to update",
  });

// Public profile: never includes email or password hash.
// Note: in a single-table query Drizzle prints columns without the table name, so the outer
// user id is written as "users"."id" to stop it being read as the inner table's id.
async function loadProfile(id: number, viewerId?: number) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      city: users.city,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      postsCount: sql<number>`(select count(*)::int from ${posts} where ${posts.authorId} = "users"."id")`,
      followersCount: sql<number>`(select count(*)::int from ${follows} where ${follows.followingId} = "users"."id")`,
      followingCount: sql<number>`(select count(*)::int from ${follows} where ${follows.followerId} = "users"."id")`,
      followedByMe: viewerId
        ? sql<boolean>`exists (select 1 from ${follows} where ${follows.followingId} = "users"."id" and ${follows.followerId} = ${viewerId})`
        : sql<boolean>`false`,
    })
    .from(users)
    .where(eq(users.id, id));
  if (!row) throw notFound("User not found");
  return row;
}

async function assertUserExists(id: number) {
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id));
  if (!u) throw notFound("User not found");
}

// PATCH /users/me: edit my own profile
usersRouter.patch("/me", authenticate, async (req, res) => {
  const body = updateSchema.parse(req.body);
  await db.update(users).set(body).where(eq(users.id, req.user!.id));
  res.json(await loadProfile(req.user!.id, req.user!.id));
});

// GET /users/:id: public profile
usersRouter.get("/:id", optionalAuth, async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await loadProfile(id, req.user?.id));
});

// POST /users/:id/follow: toggles follow / unfollow
usersRouter.post("/:id/follow", authenticate, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const me = req.user!.id;
  if (id === me) throw badRequest("You cannot follow yourself");
  await assertUserExists(id);

  const removed = await db
    .delete(follows)
    .where(and(eq(follows.followerId, me), eq(follows.followingId, id)))
    .returning();

  let following = false;
  if (removed.length === 0) {
    await db
      .insert(follows)
      .values({ followerId: me, followingId: id })
      .onConflictDoNothing();
    following = true;
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(follows)
    .where(eq(follows.followingId, id));
  res.json({ following, followersCount: total });
});

// GET /users/:id/followers
usersRouter.get("/:id/followers", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { page, limit } = paginationSchema.parse(req.query);
  await assertUserExists(id);

  const [{ total }] = await db
    .select({ total: count() })
    .from(follows)
    .where(eq(follows.followingId, id));
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      city: users.city,
      avatarUrl: users.avatarUrl,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(eq(follows.followingId, id))
    .orderBy(desc(follows.createdAt), desc(users.id))
    .limit(limit)
    .offset((page - 1) * limit);
  res.json(paginated(rows, total, page, limit));
});

// GET /users/:id/following
usersRouter.get("/:id/following", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { page, limit } = paginationSchema.parse(req.query);
  await assertUserExists(id);

  const [{ total }] = await db
    .select({ total: count() })
    .from(follows)
    .where(eq(follows.followerId, id));
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      city: users.city,
      avatarUrl: users.avatarUrl,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingId))
    .where(eq(follows.followerId, id))
    .orderBy(desc(follows.createdAt), desc(users.id))
    .limit(limit)
    .offset((page - 1) * limit);
  res.json(paginated(rows, total, page, limit));
});
