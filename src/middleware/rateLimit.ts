import rateLimit from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";

const message = {
  error: "TooManyRequests",
  message: "Too many requests, please try again later",
};

export const createApiLimiter = (limit: number, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message,
    skip: (req) => req.path === "/health",
  });

export const apiLimiter = createApiLimiter(isTest ? 100_000 : 300);
