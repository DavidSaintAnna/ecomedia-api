import { vi } from 'vitest';

// Troca o banco real (Neon) por um Postgres em memória (PGlite), criado do zero para cada arquivo de teste.
// As tabelas vêm das migrações reais da pasta drizzle/, então o teste usa o mesmo esquema da produção.
vi.mock('../src/db/index.js', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const schema = await import('../src/db/schema.js');
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return { db, pool: { end: async () => {} } };
});

// Categorias e administrador iniciais, usando o seed de verdade
const log = vi.spyOn(console, 'log').mockImplementation(() => {});
await import('../src/db/seed.js');
log.mockRestore();
