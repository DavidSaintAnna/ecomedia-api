import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  res
    .status(404)
    .json({
      error: "NotFound",
      message: `Route ${req.method} ${req.path} not found`,
    });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "ValidationError",
      message: "Invalid request data",
      details: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  const pgCode = err?.code ?? err?.cause?.code;
  if (pgCode === "23505") {
    res
      .status(409)
      .json({
        error: "Conflict",
        message: "A record with these values already exists",
      });
    return;
  }
  if (pgCode === "23503" || pgCode === "23001") {
    res
      .status(409)
      .json({
        error: "Conflict",
        message: "This record is referenced by other data",
      });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res
      .status(400)
      .json({ error: "BadRequest", message: "Malformed JSON body" });
    return;
  }
  console.error(err);
  res
    .status(500)
    .json({ error: "InternalServerError", message: "Something went wrong" });
};
