import { count, eq } from 'drizzle-orm';
import express, { Router } from 'express';
import { db } from '../db/index.js';
import { images } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { AppError, notFound } from '../utils/errors.js';
import { IMAGENS_POR_PESSOA, limparImagensSoltas, TAMANHO_MAXIMO, tipoPelosBytes } from '../utils/imagens.js';
import { idParam } from '../utils/pagination.js';

export const imagesRouter = Router();

// The image arrives as the raw body of the request (no multipart form needed)
const corpoDaImagem = express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: TAMANHO_MAXIMO });

// POST /images: send a photo from the computer. Returns the link to put in avatarUrl / imageUrl.
imagesRouter.post('/', authenticate, corpoDaImagem, async (req, res) => {
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new AppError(415, 'Envie uma imagem PNG, JPEG ou WebP', 'UnsupportedMediaType');
  }
  const tipo = tipoPelosBytes(bytes);
  if (!tipo || tipo !== req.headers['content-type']?.split(';')[0].trim()) {
    throw new AppError(415, 'O arquivo não é uma imagem PNG, JPEG ou WebP válida', 'UnsupportedMediaType');
  }

  const dono = req.user!.id;
  await limparImagensSoltas(dono);
  const [{ total }] = await db.select({ total: count() }).from(images).where(eq(images.ownerId, dono));
  if (total >= IMAGENS_POR_PESSOA) {
    throw new AppError(
      409,
      `Você chegou ao limite de ${IMAGENS_POR_PESSOA} imagens. Exclua publicações antigas com foto ou troque a foto do perfil e tente de novo`,
      'Conflict',
    );
  }

  const [nova] = await db
    .insert(images)
    .values({ ownerId: dono, contentType: tipo, size: bytes.length, data: bytes })
    .returning({ id: images.id, contentType: images.contentType, size: images.size });

  const url = `${req.protocol}://${req.get('host')}/api/images/${nova.id}`;
  res.status(201).json({ ...nova, url });
});

// GET /images/:id: public, so an <img> tag can show it
imagesRouter.get('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const [img] = await db
    .select({ contentType: images.contentType, data: images.data })
    .from(images)
    .where(eq(images.id, id));
  if (!img) throw notFound('Imagem não encontrada');

  res.set({
    'Content-Type': img.contentType,
    // an image never changes under the same id, so browsers may keep it for a year
    'Cache-Control': 'public, max-age=31536000, immutable',
    // helmet blocks other sites from embedding our resources by default; the site on another address needs this
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(img.data);
});
