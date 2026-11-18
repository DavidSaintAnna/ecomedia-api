import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { images, posts, users } from '../db/schema.js';

export const TAMANHO_MAXIMO = 512 * 1024; // 512 KB per image (the site shrinks photos long before this)
export const IMAGENS_POR_PESSOA = 20;
const CARENCIA_MINUTOS = 60; // a fresh upload may not be attached to a post or profile yet

export type TipoDeImagem = 'image/png' | 'image/jpeg' | 'image/webp';

// The type is decided by the first bytes of the file, not by what the client says it is
export function tipoPelosBytes(b: Buffer): TipoDeImagem | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

// Removes this person's images that no avatar and no post uses anymore (older than the grace period).
// Called whenever the person uploads, replaces or deletes something, so the database never fills up with leftovers.
export async function limparImagensSoltas(ownerId: number) {
  const limite = new Date(Date.now() - CARENCIA_MINUTOS * 60 * 1000);
  await db.delete(images).where(
    and(
      eq(images.ownerId, ownerId),
      lt(images.createdAt, limite),
      sql`not exists (select 1 from ${users} where ${users.avatarUrl} like '%/api/images/' || ${images.id})`,
      sql`not exists (select 1 from ${posts} where ${posts.imageUrl} like '%/api/images/' || ${images.id})`,
    ),
  );
}
