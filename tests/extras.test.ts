import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApiLimiter } from '../src/middleware/rateLimit.js';
import { api, auth, categorias, criarPost, criarUsuario } from './helpers.js';

let ana: Awaited<ReturnType<typeof criarUsuario>>;
let bob: Awaited<ReturnType<typeof criarUsuario>>;
let cat: Awaited<ReturnType<typeof criarUsuario>>;
let cats: Record<string, number> = {};

beforeAll(async () => {
  ana = await criarUsuario('Ana', 'Aracaju');
  bob = await criarUsuario('Bob', 'Recife');
  cat = await criarUsuario('Cat', 'Aracaju');
  cats = await categorias();

  const anaPost = (await criarPost(ana.token, cats['Reciclagem'], 'Primeiro post da Ana')).id;
  await criarPost(ana.token, cats['Mobilidade'], 'Segundo post da Ana');
  const bobPost = (await criarPost(bob.token, cats['Reciclagem'], 'Post do Bob')).id;
  // Ana recebe 2 curtidas e Bob recebe 3. Cat ainda não tem posts.
  for (const u of [bob, cat]) await api().post(`/api/posts/${anaPost}/like`).set(auth(u.token));
  for (const u of [ana, cat, bob]) await api().post(`/api/posts/${bobPost}/like`).set(auth(u.token));
  await api().post(`/api/posts/${anaPost}/comments`).set(auth(bob.token)).send({ content: 'muito legal esse post' });
});

describe('ranking de colaboradores (leaderboard)', () => {
  it('ordena por curtidas recebidas, é público e não vaza dados privados', async () => {
    const r = await api().get('/api/leaderboard');
    expect(r.status).toBe(200);
    expect(r.body.map((u: { rank: number; name: string; likesReceived: number; postsCount: number }) => [u.rank, u.name, u.likesReceived, u.postsCount])).toEqual([
      [1, 'Bob', 3, 1],
      [2, 'Ana', 2, 2],
    ]);
    expect(r.body[0].email).toBeUndefined();
    expect(r.body[0].passwordHash).toBeUndefined();
  });

  it('não inclui quem ainda não publicou', async () => {
    const r = await api().get('/api/leaderboard');
    expect(r.body.find((u: { id: number }) => u.id === cat.id)).toBeUndefined();
  });

  it('aceita limite e filtro por cidade', async () => {
    expect((await api().get('/api/leaderboard?limit=1')).body).toHaveLength(1);
    const aracaju = (await api().get('/api/leaderboard?city=aracaju')).body;
    expect(aracaju.map((u: { name: string }) => u.name)).toEqual(['Ana']);
    expect(aracaju[0].rank).toBe(1);
  });

  it('valida o limite', async () => {
    expect((await api().get('/api/leaderboard?limit=0')).status).toBe(400);
    expect((await api().get('/api/leaderboard?limit=999')).status).toBe(400);
  });

  it('quem publicou mas não tem curtidas aparece em último', async () => {
    await criarPost(cat.token, cats['Água'], 'Primeiro post da Cat');
    const r = await api().get('/api/leaderboard');
    expect(r.body.map((u: { name: string; likesReceived: number }) => [u.name, u.likesReceived])).toEqual([['Bob', 3], ['Ana', 2], ['Cat', 0]]);
  });
});

describe('estatísticas públicas', () => {
  it('devolve os contadores corretos para a página inicial', async () => {
    const r = await api().get('/api/stats');
    expect(r.status).toBe(200);
    // usuários: admin + Ana + Bob + Cat | posts: 4 | curtidas: 5 | comentários: 1 | categorias: 7 | cidades com posts: Aracaju e Recife
    expect(r.body).toEqual({ users: 4, posts: 4, comments: 1, likes: 5, categories: 7, cities: 2 });
  });
});

describe('limite de requisições (rate limit)', () => {
  it('bloqueia depois do limite, com o formato padrão de erro e os cabeçalhos', async () => {
    const mini = express();
    mini.use('/api', createApiLimiter(3));
    mini.get('/api/ping', (_q, s) => { s.json({ ok: true }); });

    for (let i = 0; i < 3; i++) expect((await request(mini).get('/api/ping')).status).toBe(200);
    const bloqueada = await request(mini).get('/api/ping');
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body).toEqual({ error: 'TooManyRequests', message: 'Muitas requisições. Tente novamente mais tarde' });
    expect(Object.keys(bloqueada.headers).some((h) => h.startsWith('ratelimit'))).toBe(true);
  });

  it('nunca limita o /health, para a hospedagem poder checar o servidor', async () => {
    const mini = express();
    mini.use('/api', createApiLimiter(1));
    mini.get('/api/health', (_q, s) => { s.json({ status: 'ok' }); });
    for (let i = 0; i < 5; i++) expect((await request(mini).get('/api/health')).status).toBe(200);
  });

  it('a API de verdade envia os cabeçalhos de limite', async () => {
    const r = await api().get('/api/categories');
    expect(Object.keys(r.headers).some((h) => h.startsWith('ratelimit'))).toBe(true);
  });
});

describe('erros e segurança', () => {
  it('rota inexistente devolve JSON 404', async () => {
    const r = await api().get('/api/nada');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: 'NotFound', message: 'Rota GET /api/nada não encontrada' });
    expect((await api().post('/qualquer/coisa')).status).toBe(404);
  });

  it('JSON quebrado devolve 400', async () => {
    const r = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{ruim');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('BadRequest');
  });

  it('corpo acima de 100 KB devolve 413 (e não 500)', async () => {
    const r = await api().post('/api/posts').set(auth(ana.token)).set('Content-Type', 'application/json')
      .send(JSON.stringify({ categoryId: cats['Reciclagem'], content: 'x'.repeat(200_000) }));
    expect(r.status).toBe(413);
    expect(r.body.error).toBe('PayloadTooLarge');
  });

  it('tipo de conteúdo errado vira erro de validação', async () => {
    const r = await api().post('/api/auth/login').set('Content-Type', 'text/plain').send('email=a');
    expect(r.status).toBe(400);
  });

  it('esconde o framework e envia cabeçalhos de segurança', async () => {
    const r = await api().get('/api/health');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });

  it('CORS só libera a origem configurada', async () => {
    const ok = await api().get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const ruim = await api().get('/api/health').set('Origin', 'http://site-malicioso.example');
    expect(ruim.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('o health check responde', async () => {
    const r = await api().get('/api/health');
    expect(r.body).toEqual({ status: 'ok' });
  });
});
