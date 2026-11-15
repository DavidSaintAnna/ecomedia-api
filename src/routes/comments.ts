import { count, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { comments, posts, users } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { forbidden, notFound } from "../utils/errors.js";
import { idParam, paginated, paginationSchema } from "../utils/pagination.js";

export const commentsRouter = Router();

const bodySchema = z.object({
  content: z.string().trim().min(1).max(500),
});

const selectComment = () =>
  db
    .select({
      id: comments.id,
      postId: comments.postId,
      content: comments.content,
      createdAt: comments.createdAt,
      author: { id: users.id, name: users.name, avatarUrl: users.avatarUrl },
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId));

async function assertPostExists(postId: number) {
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!post) throw notFound("Post não encontrado");
}

// GET /posts/:id/comments: public, oldest first
commentsRouter.get("/posts/:id/comments", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { page, limit } = paginationSchema.parse(req.query);
  await assertPostExists(id);

  const [{ total }] = await db
    .select({ total: count() })
    .from(comments)
    .where(eq(comments.postId, id));
  const rows = await selectComment()
    .where(eq(comments.postId, id))
    .orderBy(comments.createdAt, comments.id)
    .limit(limit)
    .offset((page - 1) * limit);

  res.json(paginated(rows, total, page, limit));
});

// POST /posts/:id/comments: logged-in users
commentsRouter.post("/posts/:id/comments", authenticate, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = bodySchema.parse(req.body);
  await assertPostExists(id);

  const [created] = await db
    .insert(comments)
    .values({ postId: id, authorId: req.user!.id, content: body.content })
    .returning({ id: comments.id });

  const [row] = await selectComment().where(eq(comments.id, created.id));
  res.status(201).json(row);
});

// DELETE /comments/:id: comment author or admin
commentsRouter.delete("/comments/:id", authenticate, async (req, res) => {
  const { id } = idParam.parse(req.params);
  const [comment] = await db.select().from(comments).where(eq(comments.id, id));
  if (!comment) throw notFound("Comentário não encontrado");
  if (req.user!.role !== "ADMIN" && comment.authorId !== req.user!.id) {
    throw forbidden("Você só pode excluir os seus próprios comentários");
  }
  await db.delete(comments).where(eq(comments.id, id));
  res.status(204).end();
});
