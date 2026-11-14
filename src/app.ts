import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { categoriesRouter } from "./routes/categories.js";
import { postsRouter } from "./routes/posts.js";
import { commentsRouter } from "./routes/comments.js";
import { likesRouter } from "./routes/likes.js";
import { feedRouter } from "./routes/feed.js";
import { usersRouter } from "./routes/users.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: "100kb" }));
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({ name: "EcoMedia API", health: "/api/health" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/posts", postsRouter);
app.use("/api", likesRouter);
app.use("/api", commentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/feed", feedRouter);

app.use(notFoundHandler);
app.use(errorHandler);
