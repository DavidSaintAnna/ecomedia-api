import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

// Same JSON shape as every other error in the API
const message = { error: 'TooManyRequests', message: 'Muitas requisições. Tente novamente mais tarde' };

export const createApiLimiter = (limit: number, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message,
    // reading photos is not counted: one page of the feed can show dozens of them
    skip: (req) => req.path === '/health' || (req.method === 'GET' && req.path.startsWith('/images/')),
  });

// General limit for the whole API: 300 requests per 15 minutes per IP
export const apiLimiter = createApiLimiter(isTest ? 100_000 : 300);
