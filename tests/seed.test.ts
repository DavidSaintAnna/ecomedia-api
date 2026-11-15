import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import { categories, users } from '../src/db/schema.js';
import { api, criarPost, criarUsuario, loginAdmin } from './helpers.js';

describe('segurança dos testes', () => {
  it('nunca usam o banco real: o endereço é falso e o banco é o PGlite em memória', async () => {
    expect(process.env.DATABASE_URL).toContain('localhost:1');
    expect(process.env.NODE_ENV).toBe('test');
    const linhas = await db.select().from(users);
    expect(linhas.length).toBeGreaterThan(0); // o administrador do seed
  });
});

describe('seed', () => {
  it('cria 7 categorias e exatamente 1 administrador', async () => {
    expect(await db.select().from(categories)).toHaveLength(7);
    const admins = await db.select().from(users).where(eq(users.role, 'ADMIN'));
    expect(admins).toHaveLength(1);
    expect(admins[0].email).toBe('admin@teste.dev');
    expect(admins[0].passwordHash).not.toContain('AdminTeste123');
  });

  it('rodar de novo não duplica nada', async () => {
    await import('../src/db/seed.js?de-novo' as string);
    expect(await db.select().from(categories)).toHaveLength(7);
    expect(await db.select().from(users).where(eq(users.role, 'ADMIN'))).toHaveLength(1);
  });

  it('renomeia categorias antigas em inglês sem duplicar e sem perder os posts', async () => {
    const reciclagem = (await db.select().from(categories).where(eq(categories.name, 'Reciclagem')))[0];
    const u = await criarUsuario('Ana');
    const post = await criarPost(u.token, reciclagem.id, 'Post preso à categoria antiga');

    // simula o banco de quem já tinha o seed em inglês
    await db.update(categories).set({ name: 'Recycling', description: 'old' }).where(eq(categories.id, reciclagem.id));
    expect((await api().get('/api/categories')).body.map((c: { name: string }) => c.name)).toContain('Recycling');

    await import('../src/db/seed.js?renomear' as string);

    const nomes = (await api().get('/api/categories')).body.map((c: { name: string }) => c.name);
    expect(nomes).toHaveLength(7);
    expect(nomes).toContain('Reciclagem');
    expect(nomes).not.toContain('Recycling');
    expect((await api().get(`/api/posts/${post.id}`)).body.category.name).toBe('Reciclagem');
    expect(await loginAdmin()).toBeTruthy();
  });
});
