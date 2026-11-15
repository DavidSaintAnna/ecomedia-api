import type request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, categorias, criarPost, criarUsuario, loginAdmin, SENHA } from './helpers.js';

let ana: Awaited<ReturnType<typeof criarUsuario>>;
let bob: Awaited<ReturnType<typeof criarUsuario>>;
let admin = '';
let reciclagem = 0;
let postId = 0;
let comentarioId = 0;

beforeAll(async () => {
  admin = await loginAdmin();
  ana = await criarUsuario('Ana');
  bob = await criarUsuario('Bob');
  reciclagem = (await categorias())['Reciclagem'];
  postId = (await criarPost(ana.token, reciclagem, 'Meu primeiro post')).id;
  comentarioId = (await api().post(`/api/posts/${postId}/comments`).set(auth(ana.token)).send({ content: 'Oi' })).body.id;
});

// Todas as situações de erro que a API consegue produzir
const cenarios: [string, () => request.Test, number][] = [];
const c = (nome: string, run: () => request.Test, status: number) => cenarios.push([nome, run, status]);

c('rota inexistente', () => api().get('/api/nada'), 404);
c('sem token', () => api().get('/api/auth/me'), 401);
c('token inválido', () => api().get('/api/auth/me').set(auth('lixo')), 401);
c('sem permissão (usuário comum cria categoria)', () => api().post('/api/categories').set(auth(ana.token)).send({ name: 'Solar' }), 403);
c('senha errada', () => api().post('/api/auth/login').send({ email: ana.email, password: 'errada1234' }), 401);
c('e-mail duplicado', () => api().post('/api/auth/register').send({ name: 'Ana', email: ana.email, password: SENHA }), 409);
c('validação: tudo inválido', () => api().post('/api/auth/register').send({ name: 'x', email: 'ruim', password: '1' }), 400);
c('validação: corpo vazio', () => api().post('/api/auth/register'), 400);
c('validação: tipo errado', () => api().post('/api/posts').set(auth(ana.token)).send({ categoryId: 'a', content: 5 }), 400);
c('validação: url perigosa', () => api().post('/api/posts').set(auth(ana.token)).send({ categoryId: reciclagem, content: 'texto ok', imageUrl: 'javascript:alert(1)' }), 400);
c('validação: nenhum campo para atualizar', () => api().patch('/api/users/me').set(auth(ana.token)).send({}), 400);
c('validação: paginação', () => api().get('/api/posts?limit=999'), 400);
c('id inválido', () => api().get('/api/posts/abc'), 400);
c('JSON quebrado', () => api().post('/api/auth/login').set('Content-Type', 'application/json').send('{ruim'), 400);
c('corpo grande demais', () => api().post('/api/auth/login').set('Content-Type', 'application/json').send(JSON.stringify({ a: 'x'.repeat(200_000) })), 413);
c('post inexistente', () => api().get('/api/posts/9999'), 404);
c('post inexistente (curtir)', () => api().post('/api/posts/9999/like').set(auth(ana.token)), 404);
c('post inexistente (comentar)', () => api().post('/api/posts/9999/comments').set(auth(ana.token)).send({ content: 'oi' }), 404);
c('comentário inexistente', () => api().delete('/api/comments/9999').set(auth(ana.token)), 404);
c('categoria inexistente', () => api().get('/api/categories/9999'), 404);
c('categoria inexistente dentro do post', () => api().post('/api/posts').set(auth(ana.token)).send({ categoryId: 9999, content: 'texto ok' }), 400);
c('categoria duplicada', () => api().post('/api/categories').set(auth(admin)).send({ name: 'Reciclagem' }), 409);
c('categoria em uso', () => api().delete(`/api/categories/${reciclagem}`).set(auth(admin)), 409);
c('editar post de outra pessoa', () => api().patch(`/api/posts/${postId}`).set(auth(bob.token)).send({ content: 'invadido' }), 403);
c('apagar comentário de outra pessoa', () => api().delete(`/api/comments/${comentarioId}`).set(auth(bob.token)), 403);
c('seguir a si mesmo', () => api().post(`/api/users/${ana.id}/follow`).set(auth(ana.token)), 400);
c('usuário inexistente', () => api().get('/api/users/9999'), 404);
c('usuário inexistente (seguir)', () => api().post('/api/users/9999/follow').set(auth(ana.token)), 404);

// Palavras em inglês que nunca podem aparecer numa mensagem que a pessoa vai ler
const ingles = /\b(not found|invalid|required|already|must be|too (many|small|large|big)|cannot|can't|failed|error|something went wrong|forbidden|unauthorized|expected|received|permission|please)\b/i;

describe('toda mensagem de erro está em português', () => {
  for (const [nome, rodar, status] of cenarios) {
    it(`${nome} → ${status}`, async () => {
      const r = await rodar();
      expect(r.status).toBe(status);
      expect(typeof r.body.error).toBe('string'); // o código continua em inglês, para o front-end testar
      expect(typeof r.body.message).toBe('string');
      expect(r.body.message).not.toMatch(ingles);
      for (const d of r.body.details ?? []) expect(d.message).not.toMatch(ingles);
    });
  }
});

describe('textos exatos', () => {
  it('mensagens principais', async () => {
    expect((await api().get('/api/nada')).body.message).toBe('Rota GET /api/nada não encontrada');
    expect((await api().get('/api/auth/me')).body.message).toBe('Autenticação necessária');
    expect((await api().post('/api/auth/login').send({ email: ana.email, password: 'errada1234' })).body.message).toBe('E-mail ou senha inválidos');
    expect((await api().post('/api/auth/register').send({ name: 'Ana', email: ana.email, password: SENHA })).body.message).toBe('E-mail já cadastrado');
    expect((await api().get('/api/posts/9999')).body.message).toBe('Post não encontrado');
    expect((await api().post('/api/categories').set(auth(ana.token)).send({ name: 'Solar' })).body.message).toBe('Você não tem permissão para fazer isso');
    expect((await api().post(`/api/users/${ana.id}/follow`).set(auth(ana.token))).body.message).toBe('Você não pode seguir a si mesmo');
  });

  it('detalhes de validação vêm em português, com o nome do campo em inglês', async () => {
    const r = await api().post('/api/auth/register').send({ name: 'x', email: 'ruim', password: '1' });
    expect(r.body.message).toBe('Dados da requisição inválidos');
    const por = Object.fromEntries(r.body.details.map((d: { path: string; message: string }) => [d.path, d.message]));
    expect(por.name).toMatch(/Pequeno demais/);
    expect(por.email).toMatch(/e-mail inválido/i);
    expect(por.password).toMatch(/Pequeno demais/);
  });
});
