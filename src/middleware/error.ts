import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'NotFound', message: `Rota ${req.method} ${req.path} não encontrada` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Dados da requisição inválidos',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  const pgCode = err?.code ?? err?.cause?.code;
  if (pgCode === '23505') {
    res.status(409).json({ error: 'Conflict', message: 'Já existe um registro com esses valores' });
    return;
  }
  if (pgCode === '23503' || pgCode === '23001') {
    res.status(409).json({ error: 'Conflict', message: 'Este registro está sendo usado por outros dados e não pode ser removido' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'BadRequest', message: 'O corpo da requisição não é um JSON válido' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    // /api/images accepts up to 512 KB; every other route accepts JSON up to 100 KB
    const imagem = _req.path.startsWith('/api/images');
    res.status(413).json({
      error: 'PayloadTooLarge',
      message: imagem ? 'A imagem é grande demais (máximo de 512 KB)' : 'O corpo da requisição é grande demais (máximo de 100 KB)',
    });
    return;
  }
  // Other client errors raised by Express itself (unsupported charset/encoding, aborted request, ...)
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    res.status(err.status).json({ error: 'BadRequest', message: 'Não foi possível processar a requisição' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'InternalServerError', message: 'Algo deu errado. Tente novamente mais tarde' });
};
